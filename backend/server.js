require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCodeImage = require('qrcode');
const { supabase } = require('./supabase');

const app = express();

// Configuração segura de CORS para produção e desenvolvimento
const rawCorsOrigins = process.env.CORS_ORIGINS || '';
const configuredOrigins = rawCorsOrigins
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3333',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3333',
  'https://smoking-pods-admin.vercel.app',
  'https://smoking-pods-catalogo.vercel.app',
  'https://smoking-pods.vercel.app',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      return callback(null, true);
    }

    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    const matchesPattern = configuredOrigins.some(pattern => {
      if (!pattern.includes('*')) return false;
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      return regex.test(origin);
    });
    if (matchesPattern) return callback(null, true);

    if (defaultDevOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS bloqueado: Origem '${origin}' não autorizada pelo servidor.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});

app.use(cors(corsOptions));
app.use(express.json());

const port = process.env.PORT || 3006;

// Helper: Obter ID da empresa principal no Supabase
async function getPrimaryCompanyId() {
  try {
    const { data } = await supabase.from('companies').select('id').limit(1).maybeSingle();
    if (data && data.id) return data.id;
  } catch (e) {}
  return null;
}

// =============================================
// HEALTH & BASE ROUTES
// =============================================
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Smoking Pods Backend API',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime()
  });
});

// =============================================
// DISPATCH WEBHOOK
// =============================================
const dispatchCooldownMap = new Map();
const DISPATCH_COOLDOWN_MS = 30 * 60 * 1000;

function checkDispatchCooldown(identifier) {
  if (!identifier) return false;
  const lastTimestamp = dispatchCooldownMap.get(identifier);
  return !!(lastTimestamp && (Date.now() - lastTimestamp < DISPATCH_COOLDOWN_MS));
}

function registerDispatchCooldown(phoneDigits, orderId) {
  const now = Date.now();
  if (phoneDigits) dispatchCooldownMap.set(phoneDigits, now);
  if (orderId) dispatchCooldownMap.set(orderId, now);
}

app.post('/api/webhook/dispatch', async (req, res) => {
  try {
    const { orderId, clientPhone, deliveryType, isNational } = req.body;
    
    if (!clientPhone) {
      return res.status(400).json({ error: 'Telefone do cliente é obrigatório.' });
    }

    if (isNational || deliveryType === 'correios' || deliveryType === 'sedex' || deliveryType === 'pac') {
      return res.json({ 
        success: true, 
        skipped: true, 
        reason: 'Envio nacional/correios não dispara notificação de motoboy local.' 
      });
    }

    const phoneDigits = clientPhone.replace(/\D/g, '');

    if (checkDispatchCooldown(phoneDigits) || (orderId && checkDispatchCooldown(orderId))) {
      return res.json({ 
        success: true, 
        skipped: true, 
        reason: 'Notificação de despacho já foi registrada recentemente.' 
      });
    }

    registerDispatchCooldown(phoneDigits, orderId);
    console.log(`📦 [Webhook Dispatch] Despacho registrado para o pedido #${orderId || 'avulso'} (${phoneDigits})`);

    return res.json({ success: true, message: 'Notificação de despacho registrada com sucesso.' });
  } catch (error) {
    console.error('❌ Erro no webhook de despacho:', error);
    return res.status(500).json({ error: 'Falha ao processar despacho.' });
  }
});

// =============================================
// CRM METADATA API
// =============================================
app.post('/api/crm/update-client', async (req, res) => {
  try {
    const { phone, name, address, flavorProfile, favoriteBrand, inVipGroup, prospectingStatus, customNotes, companyId } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Número de telefone é obrigatório.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const payload = {
      phone: formattedPhone,
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) payload.name = name;
    if (address !== undefined) payload.address = address;
    if (flavorProfile !== undefined) payload.flavor_profile = flavorProfile;
    if (favoriteBrand !== undefined) payload.favorite_brand = favoriteBrand;
    if (inVipGroup !== undefined) payload.in_vip_group = inVipGroup;
    if (prospectingStatus !== undefined) payload.prospecting_status = prospectingStatus;
    if (customNotes !== undefined) payload.custom_notes = customNotes;
    const targetCompanyId = companyId || await getPrimaryCompanyId();
    if (targetCompanyId) payload.company_id = targetCompanyId;

    const { data, error } = await supabase
      .from('smoking_clients')
      .upsert(payload, { onConflict: 'phone' })
      .select();

    if (error) {
      console.warn('⚠️ [CRM API] Aviso ao atualizar smoking_clients:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Erro no update do CRM:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MARKETING PERSISTÊNCIA DE CAMPANHAS E LISTAS
// ============================================================
const MARKETING_CONFIG_PATH = path.join(__dirname, 'data', 'marketing_config.json');

function loadMarketingConfig() {
  try {
    if (!fs.existsSync(MARKETING_CONFIG_PATH)) {
      const defaultConfig = { campaigns: [], lists: [], sentHistory: { globalSent: [] }, idempotencyKeys: [], lastUpdated: null };
      fs.writeFileSync(MARKETING_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      return defaultConfig;
    }
    const raw = fs.readFileSync(MARKETING_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.sentHistory) parsed.sentHistory = { globalSent: [] };
    return parsed;
  } catch (err) {
    console.error('❌ [Marketing] Erro ao carregar config:', err.message);
    return { campaigns: [], lists: [], sentHistory: { globalSent: [] }, idempotencyKeys: [], lastUpdated: null };
  }
}

function saveMarketingConfig(config) {
  try {
    config.lastUpdated = new Date().toISOString();
    if (!config.sentHistory) config.sentHistory = { globalSent: [] };
    fs.writeFileSync(MARKETING_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ [Marketing] Erro ao salvar config:', err.message);
  }
}

function normalizeMarketingPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

app.get('/api/marketing/campaigns', (req, res) => {
  try {
    const config = loadMarketingConfig();
    return res.json({ success: true, campaigns: config.campaigns || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketing/campaigns', (req, res) => {
  try {
    const { campaigns: newCampaigns } = req.body;
    if (!Array.isArray(newCampaigns)) {
      return res.status(400).json({ error: 'O campo "campaigns" deve ser um array.' });
    }
    const config = loadMarketingConfig();
    config.campaigns = newCampaigns;
    saveMarketingConfig(config);
    return res.json({ success: true, saved: newCampaigns.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/marketing/lists', (req, res) => {
  try {
    const config = loadMarketingConfig();
    return res.json({ success: true, lists: config.lists || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketing/lists', (req, res) => {
  try {
    const { lists: newLists } = req.body;
    if (!Array.isArray(newLists)) {
      return res.status(400).json({ error: 'O campo "lists" deve ser um array.' });
    }
    const config = loadMarketingConfig();
    config.lists = newLists;
    saveMarketingConfig(config);
    return res.json({ success: true, saved: newLists.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/marketing/sent-history', (req, res) => {
  try {
    const config = loadMarketingConfig();
    return res.json({ success: true, sentHistory: config.sentHistory || { globalSent: [] } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/marketing/lists-diagnostic', (req, res) => {
  try {
    const config = loadMarketingConfig();
    const lists = config.lists || [];
    const globalSent = config.sentHistory?.globalSent || [];

    const virginList = lists.find(l => l.id === 'list_base_virgem_oficial');
    const blindadaList = lists.find(l => l.id === 'list_base_blindada_enviados');

    const virginCount = virginList ? virginList.contacts.length : 0;
    const alreadySentCount = blindadaList ? blindadaList.contacts.length : 0;
    const totalUnique = virginCount + alreadySentCount;

    let totalContactsRaw = 0;
    lists.forEach(l => {
      totalContactsRaw += (l.contacts || []).length;
    });

    return res.json({
      success: true,
      totalContactsRaw: totalContactsRaw || totalUnique,
      totalUnique,
      duplicateCount: 0,
      alreadySentCount,
      virginCount,
      listsCount: lists.length,
      globalSentTotal: globalSent.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketing/clean-and-deduplicate-lists', (req, res) => {
  try {
    const config = loadMarketingConfig();
    const lists = config.lists || [];
    const globalSent = config.sentHistory?.globalSent || [];

    let totalOriginal = 0;
    const seenPhonesGlobal = new Set();
    const uniqueContacts = [];
    const virginContacts = [];
    const alreadySentContacts = [];

    lists.forEach(l => {
      (l.contacts || []).forEach(c => {
        totalOriginal++;
        const clean = normalizeMarketingPhone(c.cleanPhone || c.phone);

        if (clean && !seenPhonesGlobal.has(clean)) {
          seenPhonesGlobal.add(clean);
          const contactObj = {
            id: `${clean}@c.us`,
            name: c.name || `Cliente ${clean.slice(-4)}`,
            phone: clean,
            cleanPhone: clean,
            isSaved: !!c.isSaved
          };
          uniqueContacts.push(contactObj);

          if (globalSent.includes(clean)) {
            alreadySentContacts.push(contactObj);
          } else {
            virginContacts.push(contactObj);
          }
        }
      });
    });

    const sanitizedLists = [];
    const allocatedPhones = new Set();

    lists.forEach(l => {
      const cleanListContacts = [];
      (l.contacts || []).forEach(c => {
        const clean = normalizeMarketingPhone(c.cleanPhone || c.phone);
        if (clean && !allocatedPhones.has(clean)) {
          allocatedPhones.add(clean);
          cleanListContacts.push({
            id: `${clean}@c.us`,
            name: c.name || `Cliente ${clean.slice(-4)}`,
            phone: clean,
            cleanPhone: clean,
            isSaved: !!c.isSaved
          });
        }
      });

      sanitizedLists.push({
        ...l,
        contacts: cleanListContacts
      });
    });

    const virginListId = 'list_base_virgem_oficial';
    const existingVirginIdx = sanitizedLists.findIndex(l => l.id === virginListId);
    const virginListObj = {
      id: virginListId,
      name: '⭐ BASE VIRGEM (Ainda Não Enviados)',
      description: 'Lista higienizada contendo apenas contatos que NUNCA receberam mensagens de marketing',
      contacts: virginContacts,
      color: '#10b981',
      createdAt: new Date().toISOString()
    };

    if (existingVirginIdx !== -1) {
      sanitizedLists[existingVirginIdx] = virginListObj;
    } else {
      sanitizedLists.unshift(virginListObj);
    }

    if (alreadySentContacts.length > 0) {
      const sentListId = 'list_base_blindada_enviados';
      const existingSentIdx = sanitizedLists.findIndex(l => l.id === sentListId);
      const sentListObj = {
        id: sentListId,
        name: '🛡️ BASE BLINDADA (Já Contactados)',
        description: 'Contatos protegidos contra novos disparos',
        contacts: alreadySentContacts,
        color: '#6b7280',
        createdAt: new Date().toISOString()
      };
      if (existingSentIdx !== -1) {
        sanitizedLists[existingSentIdx] = sentListObj;
      } else {
        sanitizedLists.push(sentListObj);
      }
    }

    config.lists = sanitizedLists;
    saveMarketingConfig(config);

    return res.json({
      success: true,
      totalOriginal,
      totalUnique: uniqueContacts.length,
      duplicatesRemoved: totalOriginal - uniqueContacts.length,
      virginCount: virginContacts.length,
      alreadySentCount: alreadySentContacts.length,
      lists: sanitizedLists
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =============================================
// WHATSAPP MOTOR (BAILEYS) - CICLO DE VIDA LAZY / SOB DEMANDA
// =============================================
let latestQr = null;
let latestQrDataUrl = null;
let isWhatsAppReady = false;
let sock = null;
const detectedGroups = {};

// Estados formais do ciclo de vida:
// 'IDLE' | 'DISCONNECTED' | 'CONNECTING' | 'QR_AVAILABLE' | 'AUTHENTICATING' | 'CONNECTED' | 'DISCONNECTING' | 'SESSION_INVALID' | 'ERROR'
let whatsAppSessionState = 'DISCONNECTED';
let activeConnectPromise = null;
let idleDisconnectTimeout = null;
const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutos de inatividade antes de desligar socket limpo

// Helper: Verificar se existem credenciais salvas em disco
function hasSavedWhatsAppSession() {
  const authDir = path.join(__dirname, 'baileys_auth');
  if (!fs.existsSync(authDir)) return false;
  try {
    const credsPath = path.join(authDir, 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    const stats = fs.statSync(credsPath);
    return stats.size > 20; // Contém credenciais válidas gravadas
  } catch (e) {
    return false;
  }
}

// Helper: Resetar o timer de inatividade (mantém o socket vivo enquanto houver uso)
function touchWhatsAppActivity() {
  if (idleDisconnectTimeout) {
    clearTimeout(idleDisconnectTimeout);
    idleDisconnectTimeout = null;
  }
  // Só agenda idle timeout se estiver conectado
  if (isWhatsAppReady && sock) {
    idleDisconnectTimeout = setTimeout(async () => {
      console.log('💤 [WhatsApp Idle] Inatividade detectada. Desconectando socket de forma limpa (preservando credenciais)...');
      await disconnectWhatsAppSocketCleanly('IDLE');
    }, IDLE_TIMEOUT_MS);
  }
}

// Helper: Desconectar o socket de forma limpa SEM destruir a pasta de autenticação
async function disconnectWhatsAppSocketCleanly(newState = 'DISCONNECTED') {
  if (idleDisconnectTimeout) {
    clearTimeout(idleDisconnectTimeout);
    idleDisconnectTimeout = null;
  }
  whatsAppSessionState = 'DISCONNECTING';
  isWhatsAppReady = false;
  latestQr = null;
  latestQrDataUrl = null;

  if (sock) {
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ev.removeAllListeners('messages.upsert');
      sock.end(undefined);
    } catch (e) {
      console.warn('⚠️ Aviso ao encerrar socket Baileys:', e.message);
    }
    sock = null;
  }

  whatsAppSessionState = newState;
  console.log(`🔌 [WhatsApp Socket] Desconectado limpo. Estado: ${whatsAppSessionState}`);
}

// Inicializar Baileys SOB DEMANDA (com controle de QR sob requisição explícita)
async function requestWhatsAppConnection(allowQrGeneration = false) {
  if (isWhatsAppReady && sock) {
    whatsAppSessionState = 'CONNECTED';
    touchWhatsAppActivity();
    return { success: true, status: 'CONNECTED', isReady: true };
  }

  // Se já houver uma tentativa em andamento, reaproveita a mesma promessa
  if (activeConnectPromise) {
    return activeConnectPromise;
  }

  const hasSession = hasSavedWhatsAppSession();

  // Se não houver sessão salva e NÃO for permitida a geração de QR (ex: disparos autônomos de scheduler):
  if (!hasSession && !allowQrGeneration) {
    whatsAppSessionState = 'DISCONNECTED';
    console.log('ℹ️ [WhatsApp Lazy] Nenhuma sessão salva em disco e geração automática de QR desativada.');
    return { success: false, status: 'WHATSAPP_NOT_CONNECTED', isReady: false, error: 'WHATSAPP_NOT_CONNECTED' };
  }

  activeConnectPromise = (async () => {
    try {
      whatsAppSessionState = 'CONNECTING';
      const authDir = path.join(__dirname, 'baileys_auth');
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`⚡ [WhatsApp Lazy] Iniciando Baileys v${version.join('.')}, isLatest: ${isLatest}, hasSavedSession: ${hasSession}`);

      // Se já houver um socket pendente, limpa antes
      if (sock) {
        try {
          sock.ev.removeAllListeners('connection.update');
          sock.ev.removeAllListeners('creds.update');
          sock.ev.removeAllListeners('messages.upsert');
          sock.end(undefined);
        } catch (e) {}
        sock = null;
      }

      sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['Smoking Pods OS', 'Desktop', '1.0.0'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: true
      });

      sock.ev.on('creds.update', saveCreds);

      return await new Promise((resolve) => {
        let isResolved = false;

        const connectionTimeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            if (isWhatsAppReady) {
              resolve({ success: true, status: 'CONNECTED', isReady: true });
            } else if (latestQr && allowQrGeneration) {
              resolve({ success: true, status: 'QR_AVAILABLE', isReady: false, qr: latestQr, qrImageUrl: latestQrDataUrl });
            } else {
              resolve({ success: false, status: whatsAppSessionState, isReady: false, error: 'TIMEOUT' });
            }
          }
        }, 12000);

        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            if (allowQrGeneration) {
              latestQr = qr;
              isWhatsAppReady = false;
              whatsAppSessionState = 'QR_AVAILABLE';
              try {
                latestQrDataUrl = await QRCodeImage.toDataURL(qr, { width: 400, margin: 2 });
              } catch (e) {
                console.warn('⚠️ Erro ao converter QR para DataURL:', e.message);
              }
              console.log('📱 [WhatsApp QR Code Sob Demanda] QR gerado com sucesso!');
              if (!isResolved) {
                isResolved = true;
                clearTimeout(connectionTimeout);
                resolve({ success: true, status: 'QR_AVAILABLE', isReady: false, qr: latestQr, qrImageUrl: latestQrDataUrl });
              }
            } else {
              // Scheduler ou chamada silenciosa: NÃO deve gerar QR
              console.log('🛑 [WhatsApp Lazy] QR recebido mas geração não autorizada (modo silencioso). Encerrando socket.');
              await disconnectWhatsAppSocketCleanly('DISCONNECTED');
              if (!isResolved) {
                isResolved = true;
                clearTimeout(connectionTimeout);
                resolve({ success: false, status: 'WHATSAPP_NOT_CONNECTED', isReady: false, error: 'WHATSAPP_NOT_CONNECTED' });
              }
            }
          }

          if (connection === 'close') {
            const statusCode = (lastDisconnect?.error)?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;
            console.log(`⚠️ Conexão Baileys fechada (código ${statusCode}). Deslogado: ${isLoggedOut}`);

            isWhatsAppReady = false;
            latestQr = null;
            latestQrDataUrl = null;

            if (isLoggedOut) {
              whatsAppSessionState = 'SESSION_INVALID';
              try {
                fs.rmSync(authDir, { recursive: true, force: true });
                console.log('🧹 Pasta de sessão baileys_auth removida por logout/invalidação.');
              } catch (e) {}
            } else {
              if (whatsAppSessionState !== 'DISCONNECTING') {
                whatsAppSessionState = 'DISCONNECTED';
              }
            }

            if (!isResolved) {
              isResolved = true;
              clearTimeout(connectionTimeout);
              resolve({
                success: false,
                status: whatsAppSessionState,
                isReady: false,
                error: isLoggedOut ? 'SESSION_INVALID' : 'CONNECTION_CLOSED'
              });
            }
          } else if (connection === 'open') {
            console.log('✅ WhatsApp CONECTADO com sucesso via Baileys WebSocket!');
            isWhatsAppReady = true;
            latestQr = null;
            latestQrDataUrl = null;
            whatsAppSessionState = 'CONNECTED';
            touchWhatsAppActivity();

            if (!isResolved) {
              isResolved = true;
              clearTimeout(connectionTimeout);
              resolve({ success: true, status: 'CONNECTED', isReady: true });
            }
          }
        });

        sock.ev.on('messages.upsert', async (m) => {
          touchWhatsAppActivity();
          const msg = m.messages?.[0];
          if (!msg || !msg.key) return;
          const jid = msg.key.remoteJid;
          if (!jid) return;

          if (jid.endsWith('@g.us')) {
            if (!detectedGroups[jid]) {
              detectedGroups[jid] = {
                id: jid,
                name: 'Grupo VIP WhatsApp',
                unreadCount: 0,
                participantsCount: 0
              };
            }
          }
        });
      });
    } catch (err) {
      console.error('❌ Erro no requestWhatsAppConnection:', err.message);
      whatsAppSessionState = 'ERROR';
      return { success: false, status: 'ERROR', isReady: false, error: err.message };
    } finally {
      activeConnectPromise = null;
    }
  })();

  return activeConnectPromise;
}

// Helper: Formatar telefone/JID para Baileys
function formatToBaileysJid(rawTarget) {
  if (!rawTarget) return '';
  let clean = String(rawTarget).trim();
  if (clean.includes('@s.whatsapp.net') || clean.includes('@g.us')) {
    return clean;
  }
  if (clean.includes('@c.us')) {
    return clean.replace('@c.us', '@s.whatsapp.net');
  }
  const digits = clean.replace(/\D/g, '');
  const withDdi = digits.startsWith('55') ? digits : `55${digits}`;
  return `${withDdi}@s.whatsapp.net`;
}

// Helper: Validar formato do telefone
function validateStructuralPhone(rawPhone) {
  if (!rawPhone) return { valid: false, error: 'NUMERO_VAZIO', message: 'Nenhum número de telefone fornecido.' };
  const clean = String(rawPhone).trim();

  if (clean.includes('@g.us') || clean.includes('chat.whatsapp.com/')) {
    return { valid: true, isGroup: true, clean };
  }

  const digits = clean.replace(/\D/g, '');

  if (digits.length > 13) {
    return {
      valid: false,
      error: 'LID_CORROMPIDO',
      message: `O registro possui ${digits.length} dígitos (${digits}). Trata-se de um identificador interno (LID), e não de telefone com DDD válido.`
    };
  }

  const without55 = (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) ? digits.substring(2) : digits;
  if (without55.length < 10 || without55.length > 11) {
    return {
      valid: false,
      error: 'COMPRIMENTO_INVALIDO',
      message: `Número possui comprimento inválido (${without55.length} dígitos úteis). Formato correto: DDD + 8 ou 9 dígitos.`
    };
  }

  const ddd = parseInt(without55.substring(0, 2), 10);
  if (isNaN(ddd) || ddd < 11 || ddd > 99) {
    return {
      valid: false,
      error: 'DDD_INVALIDO',
      message: `DDD inválido (${without55.substring(0, 2)}).`
    };
  }

  return {
    valid: true,
    isGroup: false,
    ddd,
    numberBody: without55.substring(2),
    cleanPhone: `55${without55}`,
    without55
  };
}

// Helper: Resolver JID Canônico na rede do WhatsApp
async function resolveCanonicalWhatsAppJid(rawPhone) {
  const structural = validateStructuralPhone(rawPhone);
  if (!structural.valid) {
    return structural;
  }

  if (structural.isGroup) {
    return { valid: true, isGroup: true, jid: rawPhone };
  }

  if (!sock || !isWhatsAppReady) {
    return {
      valid: false,
      error: 'WHATSAPP_OFFLINE',
      message: 'O WhatsApp não está conectado no backend. Conecte pelo QR Code na aba Marketing.'
    };
  }

  const { ddd, numberBody } = structural;
  const phoneWith9 = numberBody.length === 8 ? `9${numberBody}` : numberBody;
  const jidWith9 = `55${ddd}${phoneWith9}@s.whatsapp.net`;
  const phoneWithout9 = (numberBody.length === 9 && numberBody.startsWith('9')) ? numberBody.substring(1) : numberBody;
  const jidWithout9 = `55${ddd}${phoneWithout9}@s.whatsapp.net`;

  try {
    touchWhatsAppActivity();
    const checkResults = await sock.onWhatsApp(jidWith9, jidWithout9);
    const match = (checkResults || []).find(r => r && (r.exists || r.jid));

    if (match && match.jid) {
      return {
        valid: true,
        isGroup: false,
        jid: match.jid,
        exists: true,
        cleanPhone: match.jid.replace('@s.whatsapp.net', '')
      };
    } else {
      return {
        valid: false,
        error: 'NUMERO_INEXISTENTE_NO_WHATSAPP',
        message: `O número (${rawPhone}) não possui conta ativa no WhatsApp.`
      };
    }
  } catch (err) {
    return {
      valid: true,
      isGroup: false,
      jid: jidWith9,
      cleanPhone: `55${ddd}${phoneWith9}`,
      warning: err.message
    };
  }
}

// Enviar mensagem via Baileys com presença "digitando"
async function sendBaileysMessage(target, text) {
  if (!sock || !isWhatsAppReady) {
    throw new Error('WhatsApp não está conectado.');
  }

  touchWhatsAppActivity();

  let jid = target;
  if (!String(target).includes('@g.us') && !String(target).includes('chat.whatsapp.com/')) {
    const probe = await resolveCanonicalWhatsAppJid(target);
    if (!probe.valid) {
      throw new Error(`[${probe.error}] ${probe.message}`);
    }
    jid = probe.jid;
  }

  try {
    await sock.sendPresenceUpdate('composing', jid);
  } catch (e) {}

  return await sock.sendMessage(jid, { text: String(text) });
}

// =============================================
// ROTAS DE MARKETING & CONEXÃO WHATSAPP SOB DEMANDA
// =============================================

// Endpoint para consultar status atual da conexão
app.get('/api/qr', (req, res) => {
  const hasSaved = hasSavedWhatsAppSession();
  const fallbackUrl = latestQr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQr)}`
    : null;

  let state = whatsAppSessionState;
  if (isWhatsAppReady) state = 'CONNECTED';
  else if (latestQr) state = 'QR_AVAILABLE';
  else if (state === 'SESSION_INVALID') state = 'SESSION_INVALID';
  else if (hasSaved) state = 'DISCONNECTED'; // Salvo mas socket parado

  res.json({
    status: state,
    qr: latestQr,
    isReady: isWhatsAppReady,
    hasSavedSession: hasSaved,
    qrImageUrl: latestQrDataUrl || fallbackUrl
  });
});

// Endpoint explícito acionado pelo botão "Conectar WhatsApp"
app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const hasSession = hasSavedWhatsAppSession();
    console.log(`📲 [API /connect] Ação do usuário: Conectar WhatsApp (hasSavedSession: ${hasSession})`);

    // Inicia a conexão permitindo gerar QR apenas se não houver sessão válida salva
    const connResult = await requestWhatsAppConnection(true);

    const fallbackUrl = latestQr
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQr)}`
      : null;

    return res.json({
      success: connResult.success,
      status: whatsAppSessionState,
      isReady: isWhatsAppReady,
      hasSavedSession: hasSession,
      qr: latestQr,
      qrImageUrl: latestQrDataUrl || fallbackUrl,
      error: connResult.error
    });
  } catch (err) {
    console.error('❌ Erro no /api/whatsapp/connect:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint explícito para cancelar tentativa ou fechar socket de forma limpa
app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    console.log('🔌 [API /disconnect] Fechando socket temporariamente (preservando credenciais em disco)...');
    await disconnectWhatsAppSocketCleanly('DISCONNECTED');
    return res.json({ success: true, message: 'Socket desconectado de forma limpa.', status: 'DISCONNECTED' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Logout definitivo: encerra socket e apaga credenciais em disco
app.post('/api/logout', async (req, res) => {
  try {
    console.log('🔴 [API /logout] Recebido comando de LOGOUT DEFINITIVO do WhatsApp...');
    await disconnectWhatsAppSocketCleanly('SESSION_INVALID');

    const authPath = path.join(__dirname, 'baileys_auth');
    if (fs.existsSync(authPath)) {
      try {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('🧹 Pasta baileys_auth removida.');
      } catch (e) {}
    }

    return res.json({ success: true, message: 'Sessão do WhatsApp destruída com sucesso.', status: 'SESSION_INVALID' });
  } catch (err) {
    console.error('Erro no logout:', err);
    return res.status(500).json({ error: 'Falha ao desconectar.' });
  }
});

app.get('/api/marketing/whatsapp-data', async (req, res) => {
  try {
    if (!isWhatsAppReady || !sock) {
      if (hasSavedWhatsAppSession()) {
        await requestWhatsAppConnection(false);
      }
    }

    if (!isWhatsAppReady || !sock) {
      return res.status(503).json({
        error: 'WhatsApp não está conectado.',
        isReady: false,
        contacts: [],
        groups: []
      });
    }

    const contactsMap = new Map();
    const groups = [];

    // 1. Grupos sincronizados
    try {
      const rawGroups = await sock.groupFetchAllParticipating();
      Object.values(rawGroups || {}).forEach(g => {
        if (g && g.id) {
          groups.push({
            id: g.id,
            name: g.subject || 'Grupo VIP',
            participantsCount: Array.isArray(g.participants) ? g.participants.length : 0
          });
        }
      });
    } catch (e) {
      console.warn('⚠️ Falha ao buscar grupos no Baileys:', e.message);
    }

    // 2. Contatos das listas locais
    try {
      const cfg = loadMarketingConfig();
      (cfg.lists || []).forEach(l => {
        (l.contacts || []).forEach(c => {
          const raw = c.cleanPhone || c.phone;
          const structural = validateStructuralPhone(raw);
          if (structural.valid && !structural.isGroup) {
            const norm = structural.cleanPhone;
            if (!contactsMap.has(norm)) {
              contactsMap.set(norm, {
                id: c.id || `${norm}@s.whatsapp.net`,
                name: c.name || `Cliente ${norm.slice(-4)}`,
                phone: c.phone || norm,
                cleanPhone: norm,
                isSaved: true
              });
            }
          }
        });
      });
    } catch (e) {}

    // 3. Contatos do Supabase
    try {
      const { data: dbClients } = await supabase
        .from('smoking_clients')
        .select('id, name, phone')
        .limit(2000);

      (dbClients || []).forEach(cl => {
        if (!cl.phone) return;
        const structural = validateStructuralPhone(cl.phone);
        if (structural.valid && !structural.isGroup) {
          const norm = structural.cleanPhone;
          if (!contactsMap.has(norm)) {
            contactsMap.set(norm, {
              id: cl.id || `${norm}@s.whatsapp.net`,
              name: cl.name || `Cliente ${norm.slice(-4)}`,
              phone: cl.phone,
              cleanPhone: norm,
              isSaved: true
            });
          }
        }
      });
    } catch (e) {}

    const contacts = Array.from(contactsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      isReady: true,
      contactsCount: contacts.length,
      groupsCount: groups.length,
      contacts,
      groups
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketing/scan-chats', async (req, res) => {
  return res.json({ success: true, message: 'Varredura concluída.' });
});

app.post('/api/marketing/send-direct', async (req, res) => {
  try {
    const { phone, name, text, campaignId, force } = req.body;

    if (!phone || !text) {
      return res.status(400).json({
        success: false,
        error: 'DADOS_OBRIGATORIOS',
        message: 'Telefone e texto da mensagem são obrigatórios.'
      });
    }

    if (!isWhatsAppReady || !sock) {
      if (hasSavedWhatsAppSession()) {
        await requestWhatsAppConnection(false);
      }
    }

    if (!isWhatsAppReady || !sock) {
      return res.status(503).json({
        success: false,
        error: 'WHATSAPP_OFFLINE',
        message: 'WhatsApp não está conectado no servidor backend. Conecte pelo QR Code na aba Marketing.'
      });
    }

    let targetJid = '';
    if (String(phone).includes('chat.whatsapp.com/')) {
      try {
        const inviteCode = String(phone).split('chat.whatsapp.com/')[1].trim().split('?')[0];
        const groupChat = await sock.groupAcceptInvite(inviteCode);
        targetJid = groupChat || `${inviteCode}@g.us`;
      } catch (invErr) {
        targetJid = phone;
      }
    } else if (String(phone).includes('@g.us')) {
      targetJid = String(phone);
    } else {
      const probeDetails = await resolveCanonicalWhatsAppJid(phone);
      if (!probeDetails.valid) {
        return res.status(422).json({
          success: false,
          error: probeDetails.error,
          message: probeDetails.message,
          phone: String(phone)
        });
      }
      targetJid = probeDetails.jid;
    }

    const config = loadMarketingConfig();
    const cleanDigits = targetJid.replace(/\D/g, '');
    const isTestCampaign = force || (campaignId && String(campaignId).toLowerCase().includes('teste'));

    if (!force && !isTestCampaign && campaignId && isPhoneAlreadySent(campaignId, cleanDigits, config)) {
      return res.json({
        success: true,
        skipped: true,
        reason: 'Contato já recebeu esta campanha anteriormente (proteção anti-ban).'
      });
    }

    console.log(`📢 [Marketing] Enviando mensagem para ${targetJid} (${name || 'Cliente'})...`);
    const sentResult = await sendBaileysMessage(targetJid, text);

    if (campaignId && !isTestCampaign) {
      markPhoneAsSent(campaignId, cleanDigits, config);
      saveMarketingConfig(config);
    }

    return res.json({
      success: true,
      targetJid,
      messageId: sentResult?.key?.id,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Erro no envio direto:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/marketing/test-dispatch', async (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId) {
      return res.status(400).json({ error: 'campaignId é obrigatório.' });
    }

    const config = loadMarketingConfig();
    const camp = config.campaigns.find(c => c.id === campaignId);
    if (!camp) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }

    if (!isWhatsAppReady || !sock) {
      return res.status(503).json({ error: 'WhatsApp não está conectado.' });
    }

    if (camp.targetType !== 'group' || !camp.targetGroupId) {
      return res.status(400).json({ error: 'Teste imediato só disponível para campanhas de grupo.' });
    }

    const formattedMsg = camp.message
      .replace(/\[Nome\]/gi, 'Pessoal')
      .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, 'https://smoking-pods.vercel.app')
      .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, '');

    let groupChatId = camp.targetGroupId;
    if (String(groupChatId).includes('chat.whatsapp.com/')) {
      try {
        const inviteCode = String(groupChatId).split('chat.whatsapp.com/')[1].trim().split('?')[0];
        const resolved = await sock.groupAcceptInvite(inviteCode);
        groupChatId = resolved || `${inviteCode}@g.us`;
      } catch (invErr) {
        console.warn('⚠️ [Test] Não resolveu convite:', invErr.message);
      }
    }

    console.log(`🧪 [Marketing Test] Disparando teste para ${groupChatId}...`);
    await sendBaileysMessage(groupChatId, formattedMsg);

    return res.json({ success: true, message: `Teste disparado com sucesso para "${camp.name}"!` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketing/test-lab-dispatch', async (req, res) => {
  const trace = [];
  try {
    const { phone, text, name } = req.body;
    trace.push({ step: 1, title: 'Recepção dos Dados', status: 'OK', details: { phone, name: name || 'Teste' } });

    if (!phone || !text) {
      trace.push({ step: 2, title: 'Validação', status: 'ERROR', message: 'Telefone ou mensagem vazia.' });
      return res.status(400).json({ success: false, trace, error: 'Telefone e mensagem são obrigatórios.' });
    }

    if (!isWhatsAppReady || !sock) {
      trace.push({ step: 2, title: 'Status do WhatsApp', status: 'ERROR', message: 'WhatsApp desconectado.' });
      return res.status(503).json({ success: false, trace, error: 'WhatsApp offline. Conecte pelo QR Code.' });
    }
    trace.push({ step: 2, title: 'Status do WhatsApp', status: 'OK', message: 'WhatsApp conectado via WebSocket.' });

    const structural = validateStructuralPhone(phone);
    if (!structural.valid) {
      trace.push({ step: 3, title: 'Validação Estrutural', status: 'ERROR', message: structural.message });
      return res.status(422).json({ success: false, trace, error: structural.error, message: structural.message });
    }
    trace.push({ step: 3, title: 'Validação Estrutural', status: 'OK', details: { ddd: structural.ddd, digits: structural.cleanPhone } });

    const probe = await resolveCanonicalWhatsAppJid(phone);
    if (!probe.valid) {
      trace.push({ step: 4, title: 'Verificação no Servidor', status: 'ERROR', message: probe.message });
      return res.status(422).json({ success: false, trace, error: probe.error, message: probe.message });
    }
    trace.push({ step: 4, title: 'Verificação no Servidor', status: 'OK', message: `Conta ativa: ${probe.jid}` });

    trace.push({ step: 5, title: 'Envio da Mensagem', status: 'IN_PROGRESS', target: probe.jid });
    const result = await sock.sendMessage(probe.jid, { text });
    trace.push({ step: 5, title: 'Envio da Mensagem', status: 'OK', messageId: result.key.id });

    return res.json({
      success: true,
      trace,
      canonicalJid: probe.jid,
      messageId: result.key.id
    });
  } catch (err) {
    trace.push({ step: 5, title: 'Envio da Mensagem', status: 'ERROR', message: err.message });
    return res.status(500).json({ success: false, trace, error: err.message });
  }
});

// =============================================
// MOTOR SCHEDULER DE MARKETING (setInterval 60s)
// =============================================
const WEEKDAY_MAP = {
  'DOMINGO': 0,
  'SEGUNDA': 1,
  'TERCA': 2,
  'TERÇA': 2,
  'QUARTA': 3,
  'QUINTA': 4,
  'SEXTA': 5,
  'SABADO': 6,
  'SÁBADO': 6
};

function cleanOldIdempotencyKeys(config) {
  const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
  if (config.idempotencyKeys && config.idempotencyKeys.length > 0) {
    config.idempotencyKeys = config.idempotencyKeys.filter(entry => {
      const ts = new Date(entry.timestamp).getTime();
      return ts > twoWeeksAgo;
    });
  }
}

const runningListCampaigns = new Set();

async function marketingSchedulerTick() {
  try {
    const config = loadMarketingConfig();
    if (!config.campaigns || config.campaigns.length === 0) return;

    // Se WhatsApp não estiver conectado, tenta restaurar sessão salva silenciosamente (sem gerar QR)
    if (!isWhatsAppReady || !sock) {
      if (hasSavedWhatsAppSession()) {
        console.log('🔄 [Marketing Scheduler] Tentando restaurar sessão Baileys salva em disco...');
        await requestWhatsAppConnection(false); // allowQrGeneration = false
      }
    }

    if (!isWhatsAppReady || !sock) {
      // Nenhuma sessão ativa ou restaurável silenciosamente
      return;
    }

    const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentWeekday = nowSP.getDay();
    const currentHour = nowSP.getHours();
    const currentMinute = nowSP.getMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    const todayStr = nowSP.toISOString().split('T')[0];

    cleanOldIdempotencyKeys(config);

    const activeCampaigns = config.campaigns.filter(c => c.status === 'active' && c.scheduledTime);
    if (activeCampaigns.length === 0) return;

    for (const camp of activeCampaigns) {
      if (camp.scheduledTime !== currentTimeStr) continue;

      if (camp.startDate) {
        const [sy, sm, sd] = camp.startDate.split('-').map(Number);
        const startMidnight = new Date(sy, sm - 1, sd, 0, 0, 0);
        const nowMidnight = new Date(nowSP.getFullYear(), nowSP.getMonth(), nowSP.getDate(), 0, 0, 0);
        if (nowMidnight < startMidnight) continue;
      }

      const freq = Number(camp.frequencyDays) || 0;
      if (freq === 7) {
        if (!camp.scheduledWeekday) continue;
        const expectedWeekday = WEEKDAY_MAP[camp.scheduledWeekday.toUpperCase()];
        if (expectedWeekday === undefined || expectedWeekday !== currentWeekday) continue;
      } else if (freq > 0) {
        if (camp.lastRunDate) {
          const [d, m, y] = camp.lastRunDate.split('/').map(Number);
          const lastDate = new Date(y, m - 1, d, 0, 0, 0);
          const diffDays = Math.floor((nowSP.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < freq) continue;
        }
      }

      const idempKey = `${camp.id}_${todayStr}_${currentTimeStr}`;
      const alreadyFired = (config.idempotencyKeys || []).some(entry => entry.key === idempKey);
      if (alreadyFired) continue;

      if (camp.targetType === 'group' && camp.targetGroupId) {
        try {
          const formattedMsg = camp.message
            .replace(/\[Nome\]/gi, 'Pessoal')
            .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, 'https://smoking-pods.vercel.app')
            .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, '');

          await sendBaileysMessage(camp.targetGroupId, formattedMsg);

          if (!config.idempotencyKeys) config.idempotencyKeys = [];
          config.idempotencyKeys.push({ key: idempKey, timestamp: new Date().toISOString(), campaignName: camp.name });

          const campIndex = config.campaigns.findIndex(c => c.id === camp.id);
          if (campIndex !== -1) {
            config.campaigns[campIndex].lastRunDate = nowSP.toLocaleDateString('pt-BR');
          }
          saveMarketingConfig(config);
          console.log(`✅ [Scheduler Grupo] Campanha "${camp.name}" disparada.`);
        } catch (e) {
          console.error(`❌ [Scheduler Grupo] Erro:`, e.message);
        }
      }

      if (camp.targetType === 'lists' && !runningListCampaigns.has(camp.id)) {
        if (!config.idempotencyKeys) config.idempotencyKeys = [];
        config.idempotencyKeys.push({ key: idempKey, timestamp: new Date().toISOString(), campaignName: camp.name });
        saveMarketingConfig(config);

        runningListCampaigns.add(camp.id);

        (async () => {
          try {
            console.log(`🚀 [Scheduler 1-a-1] Disparando campanha autônoma: "${camp.name}"`);
            const lists = config.lists || [];
            const targetLists = lists.filter(l => (camp.selectedListIds || []).includes(l.id));
            const contactMap = new Map();
            targetLists.forEach(l => (l.contacts || []).forEach(c => contactMap.set(c.id || c.phone, c)));
            const targetContacts = Array.from(contactMap.values());

            let batchCounter = 0;
            const effectiveBatchSize = camp.batchSize || 5;
            const effectiveBatchInterval = camp.batchIntervalMinutes || 35;

            for (let i = 0; i < targetContacts.length; i++) {
              const currentConfig = loadMarketingConfig();
              const currentCamp = (currentConfig.campaigns || []).find(c => c.id === camp.id);
              if (!currentCamp || currentCamp.status !== 'active') break;

              const contact = targetContacts[i];
              const rawPhone = contact.cleanPhone || contact.phone;
              const cleanPhone = normalizeMarketingPhone(rawPhone);
              if (!cleanPhone) continue;

              if (isPhoneAlreadySent(camp.id, cleanPhone, currentConfig)) continue;

              let chosenText = camp.message;
              if (camp.useVariations && camp.variations && camp.variations.length > 0) {
                const allTexts = [camp.message, ...camp.variations.filter(v => v && v.trim().length > 0)];
                chosenText = allTexts[batchCounter % allTexts.length];
              }

              const formattedMsg = chosenText
                .replace(/\[Nome\]/gi, contact.name || 'Cliente')
                .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, 'https://smoking-pods.vercel.app')
                .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, '');

              const formattedNumber = formatToBaileysJid(cleanPhone);
              try {
                await sendBaileysMessage(formattedNumber, formattedMsg);
              } catch (e) {
                console.warn(`⚠️ Erro ao enviar para ${formattedNumber}:`, e.message);
              }

              markPhoneAsSent(camp.id, cleanPhone, currentConfig);
              saveMarketingConfig(currentConfig);
              batchCounter++;

              const randomDelay = Math.floor(Math.random() * 10000) + 10000;
              await new Promise(r => setTimeout(r, randomDelay));

              if (batchCounter >= effectiveBatchSize && (i + 1) < targetContacts.length) {
                batchCounter = 0;
                console.log(`⏸️ [Scheduler 1-a-1] Lote de ${effectiveBatchSize} enviado. Pausa de ${effectiveBatchInterval} min...`);
                await new Promise(r => setTimeout(r, effectiveBatchInterval * 60 * 1000));
              }
            }

            const finalConfig = loadMarketingConfig();
            const cIdx = (finalConfig.campaigns || []).findIndex(c => c.id === camp.id);
            if (cIdx !== -1) {
              finalConfig.campaigns[cIdx].lastRunDate = nowSP.toLocaleDateString('pt-BR');
              saveMarketingConfig(finalConfig);
            }
          } catch (e) {
            console.error(`❌ [Scheduler] Erro em "${camp.name}":`, e.message);
          } finally {
            runningListCampaigns.delete(camp.id);
          }
        })();
      }
    }
  } catch (err) {
    console.error('❌ [Scheduler] Erro tick:', err.message);
  }
}

setInterval(marketingSchedulerTick, 60 * 1000);

// =============================================
// SERVER START
// =============================================
app.listen(port, () => {
  console.log(`🚀 Servidor backend rodando na porta ${port}`);
  console.log(`💡 [WhatsApp Lifecycle] Modo Sob Demanda ativo. Baileys será inicializado sob solicitação ou restauração silenciosa.`);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ UncaughtException capturado no backend:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ UnhandledRejection capturado no backend:', reason);
});
