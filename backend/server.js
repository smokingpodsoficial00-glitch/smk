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
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
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
// MULTITENANT RESOLVER & PERSISTÊNCIA DE CAMPANHAS E LISTAS POR LOJA
// ============================================================
const OFFICIAL_COMPANY_ID = 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
const DATA_DIR = path.join(__dirname, 'data');

function sanitizeTenantId(rawId) {
  if (!rawId) return OFFICIAL_COMPANY_ID;
  const cleaned = String(rawId).trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned || OFFICIAL_COMPANY_ID;
}

function getRequestCompanyId(req) {
  const raw = req.headers['x-company-id'] || req.query?.companyId || req.body?.companyId || '';
  return sanitizeTenantId(raw);
}

function getMarketingConfigPath(companyId) {
  const cid = sanitizeTenantId(companyId);
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (cid === OFFICIAL_COMPANY_ID) {
    return path.join(DATA_DIR, 'marketing_config.json');
  }
  return path.join(DATA_DIR, `marketing_config_${cid}.json`);
}

function loadMarketingConfig(companyId = OFFICIAL_COMPANY_ID) {
  const cid = sanitizeTenantId(companyId);
  const configPath = getMarketingConfigPath(cid);
  try {
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        companyId: cid,
        campaigns: [],
        lists: [],
        sentHistory: { globalSent: [] },
        idempotencyKeys: [],
        lastUpdated: null
      };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      return defaultConfig;
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.sentHistory) parsed.sentHistory = { globalSent: [] };
    return parsed;
  } catch (err) {
    console.error(`❌ [Marketing][${cid}] Erro ao carregar config:`, err.message);
    return { companyId: cid, campaigns: [], lists: [], sentHistory: { globalSent: [] }, idempotencyKeys: [], lastUpdated: null };
  }
}

function saveMarketingConfig(config, companyId = OFFICIAL_COMPANY_ID) {
  const cid = sanitizeTenantId(companyId);
  const configPath = getMarketingConfigPath(cid);
  try {
    config.companyId = cid;
    config.lastUpdated = new Date().toISOString();
    if (!config.sentHistory) config.sentHistory = { globalSent: [] };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error(`❌ [Marketing][${cid}] Erro ao salvar config:`, err.message);
  }
}

function normalizeMarketingPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function isPhoneAlreadySent(campaignId, cleanPhone, config) {
  if (!config || !config.sentHistory) return false;
  const globalSent = Array.isArray(config.sentHistory.globalSent) ? config.sentHistory.globalSent : [];
  const byCamp = Array.isArray(config.sentHistory[campaignId]) ? config.sentHistory[campaignId] : [];
  return globalSent.includes(cleanPhone) || byCamp.includes(cleanPhone);
}

function markPhoneAsSent(campaignId, cleanPhone, config) {
  if (!config.sentHistory) config.sentHistory = { globalSent: [] };
  if (!Array.isArray(config.sentHistory.globalSent)) config.sentHistory.globalSent = [];
  if (!config.sentHistory.globalSent.includes(cleanPhone)) {
    config.sentHistory.globalSent.push(cleanPhone);
  }
  if (campaignId) {
    if (!Array.isArray(config.sentHistory[campaignId])) config.sentHistory[campaignId] = [];
    if (!config.sentHistory[campaignId].includes(cleanPhone)) {
      config.sentHistory[campaignId].push(cleanPhone);
    }
  }
}

app.get('/api/marketing/campaigns', (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const config = loadMarketingConfig(companyId);
    return res.json({ success: true, companyId, campaigns: config.campaigns || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketing/campaigns', (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const { campaigns: newCampaigns } = req.body;
    if (!Array.isArray(newCampaigns)) {
      return res.status(400).json({ error: 'O campo "campaigns" deve ser um array.' });
    }
    const config = loadMarketingConfig(companyId);
    config.campaigns = newCampaigns;
    saveMarketingConfig(config, companyId);
    return res.json({ success: true, companyId, saved: newCampaigns.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/marketing/lists', (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const config = loadMarketingConfig(companyId);
    return res.json({ success: true, companyId, lists: config.lists || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketing/lists', (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const { lists: newLists } = req.body;
    if (!Array.isArray(newLists)) {
      return res.status(400).json({ error: 'O campo "lists" deve ser um array.' });
    }
    const config = loadMarketingConfig(companyId);
    config.lists = newLists;
    saveMarketingConfig(config, companyId);
    return res.json({ success: true, companyId, saved: newLists.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/marketing/sent-history', (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const config = loadMarketingConfig(companyId);
    return res.json({ success: true, companyId, sentHistory: config.sentHistory || { globalSent: [] } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/marketing/stock-cycle-status', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const config = loadMarketingConfig(companyId);
    const { data: products } = await supabase
      .from('smoking_products')
      .select('name')
      .eq('company_id', companyId)
      .gt('stock', 0)
      .eq('is_active', true);

    const modelMap = new Map();
    (products || []).forEach(p => {
      const raw = p.name ? p.name.trim() : '';
      if (!raw || raw.toUpperCase() === 'TESTE') return;
      const upper = raw.toUpperCase();
      if (!modelMap.has(upper)) {
        modelMap.set(upper, raw);
      }
    });

    const allModels = Array.from(modelMap.values());

    const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const todayStr = nowSP.toISOString().split('T')[0];

    const todayOfferedUpper = (config.dailyStockOffers?.[todayStr] || []).map(n => String(n).trim().toUpperCase());
    const cycleOfferedUpper = (config.stockOfferCycle || []).map(n => String(n).trim().toUpperCase());

    const cycleOffered = allModels.filter(m => cycleOfferedUpper.includes(m.toUpperCase()));
    const remainingInCycle = allModels.filter(m => !cycleOfferedUpper.includes(m.toUpperCase()));
    const offeredToday = allModels.filter(m => todayOfferedUpper.includes(m.toUpperCase()));
    const nextEligibleToday = remainingInCycle.filter(m => !todayOfferedUpper.includes(m.toUpperCase()));

    return res.json({
      success: true,
      companyId,
      totalModelsInStock: allModels.length,
      allModels,
      offeredInCurrentCycle: cycleOffered,
      remainingInCycle,
      cycleProgressPercent: Math.round((cycleOffered.length / (allModels.length || 1)) * 100),
      offeredToday,
      nextEligibleToday
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/marketing/lists-diagnostic', (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const config = loadMarketingConfig(companyId);
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
      companyId,
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
    const companyId = getRequestCompanyId(req);
    const config = loadMarketingConfig(companyId);
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
    saveMarketingConfig(config, companyId);

    return res.json({
      success: true,
      companyId,
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
// WHATSAPP MOTOR MULTITENANT (BAILEYS) - SESSÃO ISOLADA POR LOJA (COMPANY_ID)
// CONEXÃO PERMANENTE 24/7 (SEM DESCONEXÃO POR INATIVIDADE) & PARING RÁPIDO
// =============================================
const tenantSessions = new Map();
const activeCampaignDispatches = new Map(); // companyId -> { campaignId, campaignName, current, total, status, isRunning, abortRequested, startedAt }

// Cache global de versão do Baileys para eliminar atraso de 2-4s ao gerar QR Code
let cachedBaileysVersion = [2, 3000, 1015901307];
(async () => {
  try {
    const { version } = await fetchLatestBaileysVersion();
    if (Array.isArray(version) && version.length === 3) {
      cachedBaileysVersion = version;
      console.log(`⚡ [Baileys] Versão protocolo em cache: v${version.join('.')}`);
    }
  } catch (e) {}
})();

function getAuthDir(companyId = OFFICIAL_COMPANY_ID) {
  const cid = sanitizeTenantId(companyId);
  if (cid === OFFICIAL_COMPANY_ID) {
    return path.join(__dirname, 'baileys_auth');
  }
  return path.join(__dirname, `baileys_auth_${cid}`);
}

function getTenantSession(companyId = OFFICIAL_COMPANY_ID) {
  const cid = sanitizeTenantId(companyId);
  if (!tenantSessions.has(cid)) {
    tenantSessions.set(cid, {
      companyId: cid,
      latestQr: null,
      latestQrDataUrl: null,
      isWhatsAppReady: false,
      sock: null,
      detectedGroups: {},
      cachedGroups: [],
      lastGroupFetchAt: 0,
      nextAllowedGroupFetchAt: 0,
      groupRetryTimer: null,
      contactsMap: new Map(),
      lidToPhoneMap: new Map(),
      whatsAppSessionState: 'DISCONNECTED',
      activeConnectPromise: null,
      idleDisconnectTimeout: null
    });
  }
  return tenantSessions.get(cid);
}

function formatReadableBrPhone(clean55) {
  const without55 = String(clean55).startsWith('55') ? String(clean55).slice(2) : String(clean55);
  const ddd = without55.slice(0, 2);
  const body = without55.slice(2);
  if (body.length === 9) {
    return `(${ddd}) ${body.slice(0, 5)}-${body.slice(5)}`;
  }
  return `(${ddd}) ${body.slice(0, 4)}-${body.slice(4)}`;
}

function resolveLidToPhone(companyId, rawId) {
  if (!rawId) return null;
  const cid = sanitizeTenantId(companyId);
  const session = getTenantSession(cid);
  const cleanLid = String(rawId).split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!cleanLid) return null;

  if (session.lidToPhoneMap.has(cleanLid)) {
    return session.lidToPhoneMap.get(cleanLid);
  }

  try {
    const authDir = getAuthDir(cid);
    const reverseFile = path.join(authDir, `lid-mapping-${cleanLid}_reverse.json`);
    if (fs.existsSync(reverseFile)) {
      const val = JSON.parse(fs.readFileSync(reverseFile, 'utf-8'));
      if (val) {
        const phoneDigits = String(val).replace(/\D/g, '');
        session.lidToPhoneMap.set(cleanLid, phoneDigits);
        return phoneDigits;
      }
    }
  } catch (e) {}
  return null;
}

function isGenericContactName(name) {
  if (!name) return true;
  const trimmed = String(name).trim();
  if (!trimmed) return true;
  if (/^Contato WhatsApp/i.test(trimmed)) return true;
  if (/^Cliente \d+$/i.test(trimmed)) return true;
  if (/^[\d\s()+\-]+$/.test(trimmed)) return true;
  return false;
}

function registerDiscoveredContact(companyId, rawPhoneOrJid, rawName = '') {
  if (!rawPhoneOrJid) return null;
  const cid = sanitizeTenantId(companyId);
  const session = getTenantSession(cid);
  const str = String(rawPhoneOrJid).trim();
  if (str.endsWith('@g.us') || str.endsWith('@broadcast') || str === 'status@broadcast') return null;

  let candidateDigits = '';
  if (str.endsWith('@lid')) {
    const resolved = resolveLidToPhone(cid, str);
    if (resolved) candidateDigits = resolved;
  } else {
    const bare = str.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (bare.length > 13) {
      const resolved = resolveLidToPhone(cid, bare);
      if (resolved) candidateDigits = resolved;
    } else {
      candidateDigits = bare;
    }
  }

  if (!candidateDigits) return null;
  const structural = validateStructuralPhone(candidateDigits);
  if (!structural.valid || structural.isGroup) return null;

  const norm = structural.cleanPhone;
  const existing = session.contactsMap.get(norm);
  const incomingName = rawName ? String(rawName).trim() : '';
  const defaultName = `Contato WhatsApp ${formatReadableBrPhone(norm)}`;

  if (!existing) {
    const entry = {
      id: `${norm}@s.whatsapp.net`,
      name: (!isGenericContactName(incomingName)) ? incomingName : defaultName,
      phone: norm,
      cleanPhone: norm,
      isSaved: true
    };
    session.contactsMap.set(norm, entry);
    return entry;
  } else if (!isGenericContactName(incomingName) && isGenericContactName(existing.name)) {
    existing.name = incomingName;
    session.contactsMap.set(norm, existing);
  }
  return existing;
}

function scanAuthDirContacts(companyId = OFFICIAL_COMPANY_ID) {
  const cid = sanitizeTenantId(companyId);
  const session = getTenantSession(cid);
  const authDir = getAuthDir(cid);

  // 1. Reidrata contatos e grupos já persistidos no marketing_config da loja
  try {
    const cfg = loadMarketingConfig(cid);
    if (Array.isArray(cfg.whatsappContacts)) {
      cfg.whatsappContacts.forEach(c => {
        if (c && (c.cleanPhone || c.phone)) {
          registerDiscoveredContact(cid, c.cleanPhone || c.phone, c.name);
        }
      });
    }
    if (Array.isArray(cfg.whatsappGroups) && cfg.whatsappGroups.length > 0 && session.cachedGroups.length === 0) {
      session.cachedGroups = [...cfg.whatsappGroups];
      cfg.whatsappGroups.forEach(g => {
        if (g && g.id) session.detectedGroups[g.id] = g;
      });
    }
  } catch (e) {}

  // 2. Varre todos os arquivos lid-mapping-* e sender-key-*@g.us* da pasta baileys_auth da loja
  if (!fs.existsSync(authDir)) return session.contactsMap;
  try {
    const files = fs.readdirSync(authDir);
    for (const f of files) {
      if (f.startsWith('lid-mapping-') && f.endsWith('_reverse.json')) {
        try {
          const lidPart = f.replace('lid-mapping-', '').replace('_reverse.json', '');
          const val = JSON.parse(fs.readFileSync(path.join(authDir, f), 'utf-8'));
          if (val) {
            const digits = String(val).replace(/\D/g, '');
            if (lidPart && digits) session.lidToPhoneMap.set(lidPart, digits);
            registerDiscoveredContact(cid, digits, '');
          }
        } catch (e) {}
      } else if (f.startsWith('lid-mapping-') && f.endsWith('.json')) {
        const m = f.match(/^lid-mapping-(\d+)\.json$/);
        if (m && m[1]) {
          registerDiscoveredContact(cid, m[1], '');
        }
      } else if (f.startsWith('sender-key-') && f.includes('@g.us')) {
        // Extrai JID do grupo diretamente do arquivo sender-key-<groupId>@g.us--...
        const afterPrefix = f.slice('sender-key-'.length);
        const gJid = afterPrefix.split('--')[0];
        if (gJid && gJid.endsWith('@g.us') && !session.detectedGroups[gJid]) {
          session.detectedGroups[gJid] = {
            id: gJid,
            name: 'Grupo VIP WhatsApp',
            participantsCount: 0
          };
        }
      }
    }
  } catch (e) {
    console.warn(`⚠️ [${cid}] Erro ao varrer contatos em ${authDir}:`, e.message);
  }

  return session.contactsMap;
}

// Sincronização inteligente de grupos da loja:
// 1. Resolve metadados individuais (groupMetadata) para grupos detectados em sender-key / mensagens (NUNCA sofre rate-limit de @g.us!)
// 2. Consulta groupFetchAllParticipating com controle de cooldown anti rate-overlimit e retry automático em background
async function syncTenantGroupsSmart(companyId = OFFICIAL_COMPANY_ID, forceAttempt = false) {
  const cid = sanitizeTenantId(companyId);
  const session = getTenantSession(cid);
  scanAuthDirContacts(cid);

  if (!session.isWhatsAppReady || !session.sock) {
    return session.cachedGroups.length > 0 ? session.cachedGroups : Object.values(session.detectedGroups);
  }

  // Passo A: Resolver nomes reais e participantes de quaisquer grupos detectados (via groupMetadata individual, que não dá rate-overlimit)
  const detectedIds = Object.keys(session.detectedGroups || {});
  for (const gJid of detectedIds) {
    const current = session.detectedGroups[gJid];
    const needsMetadata = !current || !current.name || current.name === 'Grupo VIP WhatsApp' || current.name === 'Grupo WhatsApp' || !current.participantsCount;
    if (needsMetadata && session.sock) {
      try {
        const meta = await session.sock.groupMetadata(gJid);
        if (meta && meta.id) {
          session.detectedGroups[meta.id] = {
            id: meta.id,
            name: meta.subject || current?.name || 'Grupo VIP',
            participantsCount: Number(meta.size) || (Array.isArray(meta.participants) ? meta.participants.length : 0)
          };
          if (Array.isArray(meta.participants)) {
            meta.participants.forEach(p => {
              if (!p) return;
              registerDiscoveredContact(cid, p.phoneNumber || p.jid || p.id, p.notify || p.name || '');
            });
          }
        }
      } catch (metaErr) {}
    }
  }

  // Passo B: Buscar lista completa de grupos participantes respeitando janela de cooldown do WhatsApp
  const nowMs = Date.now();
  const canCallParticipating = nowMs >= (session.nextAllowedGroupFetchAt || 0) &&
    (forceAttempt || session.cachedGroups.length <= 1 || (nowMs - (session.lastGroupFetchAt || 0) > 90000));

  if (canCallParticipating && session.sock) {
    session.lastGroupFetchAt = nowMs;
    session.nextAllowedGroupFetchAt = nowMs + 25000;
    try {
      const rawGroups = await session.sock.groupFetchAllParticipating();
      const fetchedGroups = [];
      Object.values(rawGroups || {}).forEach(g => {
        if (g && g.id) {
          const groupObj = {
            id: g.id,
            name: g.subject || session.detectedGroups[g.id]?.name || 'Grupo VIP',
            participantsCount: Number(g.size) || (Array.isArray(g.participants) ? g.participants.length : 0)
          };
          fetchedGroups.push(groupObj);
          session.detectedGroups[g.id] = groupObj;
          if (Array.isArray(g.participants)) {
            g.participants.forEach(p => {
              if (!p) return;
              registerDiscoveredContact(cid, p.phoneNumber || p.jid || p.id, p.notify || p.name || '');
            });
          }
        }
      });
      if (fetchedGroups.length > 0) {
        session.cachedGroups = fetchedGroups;
        console.log(`✅ [GroupsSync][${cid}] ${fetchedGroups.length} grupos sincronizados com sucesso!`);
      }
    } catch (e) {
      // Se o WhatsApp retornar rate-overlimit, aguarda 45s sem martelar a API e agenda 1 retry silencioso
      session.nextAllowedGroupFetchAt = Date.now() + 45000;
      console.warn(`⚠️ [${cid}] Cooldown do WhatsApp ao listar todos os grupos (${e.message}). Retentativa automática agendada em 45s.`);
      if (!session.groupRetryTimer) {
        session.groupRetryTimer = setTimeout(async () => {
          session.groupRetryTimer = null;
          session.nextAllowedGroupFetchAt = 0;
          await syncTenantGroupsSmart(cid, true);
          persistDiscoveredWhatsAppData(cid);
        }, 46000);
      }
    }
  }

  // Mescla cachedGroups com detectedGroups sem duplicatas
  const mergedMap = new Map();
  (session.cachedGroups || []).forEach(g => {
    if (g && g.id) mergedMap.set(g.id, g);
  });
  Object.values(session.detectedGroups || {}).forEach(g => {
    if (g && g.id) {
      const ex = mergedMap.get(g.id);
      if (!ex || ex.name === 'Grupo VIP WhatsApp') {
        mergedMap.set(g.id, g);
      }
    }
  });

  const finalGroups = Array.from(mergedMap.values());
  if (finalGroups.length > 0) {
    session.cachedGroups = finalGroups;
  }
  return finalGroups;
}

function persistDiscoveredWhatsAppData(companyId = OFFICIAL_COMPANY_ID) {
  const cid = sanitizeTenantId(companyId);
  const session = getTenantSession(cid);
  try {
    const cfg = loadMarketingConfig(cid);
    const allContacts = Array.from(session.contactsMap.values());
    if (allContacts.length > 0) {
      cfg.whatsappContacts = allContacts;
    }
    if (session.cachedGroups && session.cachedGroups.length > 0) {
      cfg.whatsappGroups = session.cachedGroups;
    }
    saveMarketingConfig(cfg, cid);
  } catch (e) {}
}

// Helper: Verificar se existem credenciais salvas em disco para a loja
function hasSavedWhatsAppSession(companyId = OFFICIAL_COMPANY_ID) {
  const authDir = getAuthDir(companyId);
  if (!fs.existsSync(authDir)) return false;
  try {
    const credsPath = path.join(authDir, 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    const stats = fs.statSync(credsPath);
    return stats.size > 20;
  } catch (e) {
    return false;
  }
}

// Conexão 24/7 ativa: NUNCA desconecta por inatividade (garante disparos contínuos de madrugada e pausas de 35 min)
function touchWhatsAppActivity(companyId = OFFICIAL_COMPANY_ID) {
  const session = getTenantSession(companyId);
  if (session.idleDisconnectTimeout) {
    clearTimeout(session.idleDisconnectTimeout);
    session.idleDisconnectTimeout = null;
  }
}

// Helper: Desconectar o socket da loja de forma limpa SEM destruir a pasta de autenticação
async function disconnectWhatsAppSocketCleanly(companyId = OFFICIAL_COMPANY_ID, newState = 'DISCONNECTED') {
  const session = getTenantSession(companyId);
  if (session.idleDisconnectTimeout) {
    clearTimeout(session.idleDisconnectTimeout);
    session.idleDisconnectTimeout = null;
  }
  if (session.groupRetryTimer) {
    clearTimeout(session.groupRetryTimer);
    session.groupRetryTimer = null;
  }
  session.whatsAppSessionState = 'DISCONNECTING';
  session.isWhatsAppReady = false;
  session.latestQr = null;
  session.latestQrDataUrl = null;

  if (session.sock) {
    try {
      session.sock.ev.removeAllListeners('connection.update');
      session.sock.ev.removeAllListeners('creds.update');
      session.sock.ev.removeAllListeners('messages.upsert');
      session.sock.end(undefined);
    } catch (e) {
      console.warn(`⚠️ [${session.companyId}] Aviso ao encerrar socket Baileys:`, e.message);
    }
    session.sock = null;
  }

  session.whatsAppSessionState = newState;
  console.log(`🔌 [WhatsApp Socket][${session.companyId}] Desconectado limpo. Estado: ${session.whatsAppSessionState}`);
}

// Inicializar Baileys por loja (companyId) com pareamento rápido e reconexão automática
async function requestWhatsAppConnection(companyId = OFFICIAL_COMPANY_ID, allowQrGeneration = false) {
  const cid = sanitizeTenantId(companyId);
  const session = getTenantSession(cid);

  if (session.isWhatsAppReady && session.sock) {
    session.whatsAppSessionState = 'CONNECTED';
    return { success: true, companyId: cid, status: 'CONNECTED', isReady: true };
  }

  if (session.activeConnectPromise) {
    return session.activeConnectPromise;
  }

  const hasSession = hasSavedWhatsAppSession(cid);

  if (!hasSession && !allowQrGeneration) {
    session.whatsAppSessionState = 'DISCONNECTED';
    return { success: false, companyId: cid, status: 'WHATSAPP_NOT_CONNECTED', isReady: false, error: 'WHATSAPP_NOT_CONNECTED' };
  }

  session.activeConnectPromise = (async () => {
    try {
      session.whatsAppSessionState = 'CONNECTING';
      const authDir = getAuthDir(cid);
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const version = cachedBaileysVersion;
      console.log(`⚡ [WhatsApp][${cid}] Iniciando Baileys v${version.join('.')} (hasSavedSession: ${hasSession})`);

      if (session.sock) {
        try {
          session.sock.ev.removeAllListeners('connection.update');
          session.sock.ev.removeAllListeners('creds.update');
          session.sock.ev.removeAllListeners('messages.upsert');
          session.sock.end(undefined);
        } catch (e) {}
        session.sock = null;
      }

      const sockInstance = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['Smoking Pods SaaS', 'Chrome', '122.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 25000,
        connectTimeoutMs: 20000,
        defaultQueryTimeoutMs: 30000,
        generateHighQualityLinkPreview: true
      });

      // Remove listener interno do Baileys que dispara groupFetchAllParticipating no ms 0 e causa rate-overlimit
      try {
        if (sockInstance.ws && typeof sockInstance.ws.removeAllListeners === 'function') {
          sockInstance.ws.removeAllListeners('CB:ib,,dirty');
          sockInstance.ws.on('CB:ib,,dirty', async () => {
            try {
              await sockInstance.cleanDirtyBits('groups');
            } catch (e) {}
          });
        }
      } catch (e) {}

      session.sock = sockInstance;
      sockInstance.ev.on('creds.update', saveCreds);

      // Helper interno para ingerir lotes de contatos e chats do Baileys
      const ingestContactsBatch = (items = []) => {
        if (!Array.isArray(items)) return;
        for (const c of items) {
          if (!c) continue;
          const name = c.name || c.notify || c.verifiedName || c.subject || '';
          if (c.id && String(c.id).endsWith('@g.us')) {
            const gObj = {
              id: c.id,
              name: c.subject || c.name || session.detectedGroups[c.id]?.name || 'Grupo VIP WhatsApp',
              participantsCount: Number(c.size) || (Array.isArray(c.participants) ? c.participants.length : (session.detectedGroups[c.id]?.participantsCount || 0))
            };
            session.detectedGroups[c.id] = gObj;
            continue;
          }
          if (c.lid && c.id && !String(c.id).endsWith('@lid')) {
            const lidClean = String(c.lid).split('@')[0].split(':')[0].replace(/\D/g, '');
            const phoneClean = String(c.id).split('@')[0].split(':')[0].replace(/\D/g, '');
            if (lidClean && phoneClean) session.lidToPhoneMap.set(lidClean, phoneClean);
          }
          if (c.phoneNumber) registerDiscoveredContact(cid, c.phoneNumber, name);
          if (c.jid) registerDiscoveredContact(cid, c.jid, name);
          if (c.id) registerDiscoveredContact(cid, c.id, name);
        }
      };

      sockInstance.ev.on('messaging-history.set', ({ chats = [], contacts = [], messages = [] }) => {
        console.log(`📥 [HistorySync][${cid}] Recebidos ${contacts.length} contatos, ${chats.length} conversas e ${messages.length} mensagens.`);
        scanAuthDirContacts(cid);
        ingestContactsBatch(contacts);
        ingestContactsBatch(chats);
        for (const msg of messages) {
          if (!msg || !msg.key) continue;
          const pName = msg.pushName || '';
          if (msg.key.senderPn) registerDiscoveredContact(cid, msg.key.senderPn, pName);
          if (msg.key.participantAlt) registerDiscoveredContact(cid, msg.key.participantAlt, pName);
          if (msg.key.remoteJid && !String(msg.key.remoteJid).endsWith('@g.us')) {
            registerDiscoveredContact(cid, msg.key.remoteJid, pName);
          } else if (msg.key.remoteJid && String(msg.key.remoteJid).endsWith('@g.us')) {
            if (!session.detectedGroups[msg.key.remoteJid]) {
              session.detectedGroups[msg.key.remoteJid] = { id: msg.key.remoteJid, name: 'Grupo VIP WhatsApp', participantsCount: 0 };
            }
          }
        }
        persistDiscoveredWhatsAppData(cid);
      });

      sockInstance.ev.on('contacts.upsert', (contacts) => {
        scanAuthDirContacts(cid);
        ingestContactsBatch(contacts);
        persistDiscoveredWhatsAppData(cid);
      });

      sockInstance.ev.on('contacts.update', (updates) => {
        ingestContactsBatch(updates);
        persistDiscoveredWhatsAppData(cid);
      });

      sockInstance.ev.on('chats.upsert', (chats) => {
        ingestContactsBatch(chats);
        persistDiscoveredWhatsAppData(cid);
      });

      sockInstance.ev.on('groups.upsert', (groups) => {
        ingestContactsBatch(groups);
        persistDiscoveredWhatsAppData(cid);
      });

      sockInstance.ev.on('groups.update', (groups) => {
        ingestContactsBatch(groups);
        persistDiscoveredWhatsAppData(cid);
      });

      return await new Promise((resolve) => {
        let isResolved = false;

        const connectionTimeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            if (session.isWhatsAppReady) {
              resolve({ success: true, companyId: cid, status: 'CONNECTED', isReady: true });
            } else if (session.latestQr && allowQrGeneration) {
              resolve({ success: true, companyId: cid, status: 'QR_AVAILABLE', isReady: false, qr: session.latestQr, qrImageUrl: session.latestQrDataUrl });
            } else {
              resolve({ success: false, companyId: cid, status: session.whatsAppSessionState, isReady: false, error: 'TIMEOUT' });
            }
          }
        }, 10000);

        sockInstance.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            if (allowQrGeneration) {
              session.latestQr = qr;
              session.isWhatsAppReady = false;
              session.whatsAppSessionState = 'QR_AVAILABLE';
              try {
                session.latestQrDataUrl = await QRCodeImage.toDataURL(qr, { width: 360, margin: 1 });
              } catch (e) {
                console.warn(`⚠️ [${cid}] Erro ao converter QR para DataURL:`, e.message);
              }
              console.log(`📱 [WhatsApp QR Code][${cid}] QR gerado instantaneamente!`);
              if (!isResolved) {
                isResolved = true;
                clearTimeout(connectionTimeout);
                resolve({ success: true, companyId: cid, status: 'QR_AVAILABLE', isReady: false, qr: session.latestQr, qrImageUrl: session.latestQrDataUrl });
              }
            } else {
              await disconnectWhatsAppSocketCleanly(cid, 'DISCONNECTED');
              if (!isResolved) {
                isResolved = true;
                clearTimeout(connectionTimeout);
                resolve({ success: false, companyId: cid, status: 'WHATSAPP_NOT_CONNECTED', isReady: false, error: 'WHATSAPP_NOT_CONNECTED' });
              }
            }
          }

          if (connection === 'close') {
            const statusCode = (lastDisconnect?.error)?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;
            const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
            console.log(`⚠️ [${cid}] Conexão Baileys fechada (código ${statusCode}). Deslogado: ${isLoggedOut}`);

            session.isWhatsAppReady = false;
            session.latestQr = null;
            session.latestQrDataUrl = null;

            if (isLoggedOut) {
              session.whatsAppSessionState = 'SESSION_INVALID';
              try {
                fs.rmSync(authDir, { recursive: true, force: true });
                console.log(`🧹 [${cid}] Pasta de sessão removida por logout/invalidação.`);
              } catch (e) {}
            } else if (isRestartRequired || (hasSavedWhatsAppSession(cid) && session.whatsAppSessionState !== 'DISCONNECTING')) {
              const delayMs = isRestartRequired ? 150 : 1500;
              console.log(`🔄 [${cid}] Reconectando socket automaticamente em ${delayMs}ms (código ${statusCode})...`);
              session.whatsAppSessionState = 'CONNECTING';
              setTimeout(() => {
                requestWhatsAppConnection(cid, false).catch(() => {});
              }, delayMs);
            } else {
              if (session.whatsAppSessionState !== 'DISCONNECTING') {
                session.whatsAppSessionState = 'DISCONNECTED';
              }
            }

            if (!isResolved) {
              isResolved = true;
              clearTimeout(connectionTimeout);
              resolve({
                success: false,
                companyId: cid,
                status: session.whatsAppSessionState,
                isReady: false,
                error: isLoggedOut ? 'SESSION_INVALID' : 'CONNECTION_CLOSED'
              });
            }
          } else if (connection === 'open') {
            console.log(`✅ [${cid}] WhatsApp CONECTADO com sucesso via Baileys WebSocket!`);
            session.isWhatsAppReady = true;
            session.latestQr = null;
            session.latestQrDataUrl = null;
            session.whatsAppSessionState = 'CONNECTED';

            // Sincroniza contatos da pasta imediatamente e agenda sincronização de grupos após 4s (após app-state-sync)
            setTimeout(async () => {
              scanAuthDirContacts(cid);
              await syncTenantGroupsSmart(cid, false);
              persistDiscoveredWhatsAppData(cid);
            }, 4000);

            if (!isResolved) {
              isResolved = true;
              clearTimeout(connectionTimeout);
              resolve({ success: true, companyId: cid, status: 'CONNECTED', isReady: true });
            }
          }
        });

        sockInstance.ev.on('messages.upsert', async (m) => {
          const msg = m.messages?.[0];
          if (!msg || !msg.key) return;
          const jid = msg.key.remoteJid;
          if (!jid) return;

          if (msg.key.senderPn) registerDiscoveredContact(cid, msg.key.senderPn, msg.pushName || '');
          if (!jid.endsWith('@g.us')) {
            registerDiscoveredContact(cid, jid, msg.pushName || '');
          } else {
            if (!session.detectedGroups[jid] || session.detectedGroups[jid].name === 'Grupo VIP WhatsApp') {
              session.detectedGroups[jid] = {
                id: jid,
                name: session.detectedGroups[jid]?.name || 'Grupo VIP WhatsApp',
                participantsCount: session.detectedGroups[jid]?.participantsCount || 0
              };
              // Busca nome real do grupo individualmente sem rate-limit
              if (session.sock) {
                session.sock.groupMetadata(jid).then(meta => {
                  if (meta && meta.id) {
                    session.detectedGroups[meta.id] = {
                      id: meta.id,
                      name: meta.subject || 'Grupo VIP',
                      participantsCount: Number(meta.size) || (Array.isArray(meta.participants) ? meta.participants.length : 0)
                    };
                    persistDiscoveredWhatsAppData(cid);
                  }
                }).catch(() => {});
              }
            }
          }
        });
      });
    } catch (err) {
      console.error(`❌ [${cid}] Erro no requestWhatsAppConnection:`, err.message);
      session.whatsAppSessionState = 'ERROR';
      return { success: false, companyId: cid, status: 'ERROR', isReady: false, error: err.message };
    } finally {
      session.activeConnectPromise = null;
    }
  })();

  return session.activeConnectPromise;
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

// Helper: Resolver JID Canônico na rede do WhatsApp usando a sessão da loja
async function resolveCanonicalWhatsAppJid(rawPhone, companyId = OFFICIAL_COMPANY_ID) {
  const cid = sanitizeTenantId(companyId);
  const session = getTenantSession(cid);

  const structural = validateStructuralPhone(rawPhone);
  if (!structural.valid) {
    return structural;
  }

  if (structural.isGroup) {
    return { valid: true, isGroup: true, jid: rawPhone };
  }

  if (!session.sock || !session.isWhatsAppReady) {
    return {
      valid: false,
      error: 'WHATSAPP_OFFLINE',
      message: 'O WhatsApp da sua loja não está conectado. Conecte pelo QR Code na aba Marketing.'
    };
  }

  const { ddd, numberBody } = structural;
  const phoneWith9 = numberBody.length === 8 ? `9${numberBody}` : numberBody;
  const jidWith9 = `55${ddd}${phoneWith9}@s.whatsapp.net`;
  const phoneWithout9 = (numberBody.length === 9 && numberBody.startsWith('9')) ? numberBody.substring(1) : numberBody;
  const jidWithout9 = `55${ddd}${phoneWithout9}@s.whatsapp.net`;

  try {
    touchWhatsAppActivity(cid);
    const checkResults = await session.sock.onWhatsApp(jidWith9, jidWithout9);
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

// Helper: Garantir que o socket da loja esteja conectado (aguarda reconexão automática se necessário)
async function ensureTenantWhatsAppConnected(companyId = OFFICIAL_COMPANY_ID, maxWaitMs = 12000) {
  const cid = sanitizeTenantId(companyId);
  const session = getTenantSession(cid);
  if (session.isWhatsAppReady && session.sock) return true;

  if (hasSavedWhatsAppSession(cid)) {
    await requestWhatsAppConnection(cid, false).catch(() => {});
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      if (session.isWhatsAppReady && session.sock) return true;
      await new Promise(r => setTimeout(r, 400));
    }
  }
  return Boolean(session.isWhatsAppReady && session.sock);
}

// Enviar mensagem via Baileys da loja (companyId) com auto-reconexão resiliente
async function sendBaileysMessage(target, text, options = {}, companyId = OFFICIAL_COMPANY_ID) {
  const cid = sanitizeTenantId(companyId);
  const session = getTenantSession(cid);

  const ready = await ensureTenantWhatsAppConnected(cid, 12000);
  if (!ready || !session.sock) {
    throw new Error('WhatsApp da loja não está conectado.');
  }

  let jid = target;
  if (!String(target).includes('@g.us') && !String(target).includes('chat.whatsapp.com/')) {
    const probe = await resolveCanonicalWhatsAppJid(target, cid);
    if (!probe.valid) {
      throw new Error(`[${probe.error}] ${probe.message}`);
    }
    jid = probe.jid;
  }

  try {
    await session.sock.sendPresenceUpdate('composing', jid);
  } catch (e) {}

  if (options && options.imageUrl) {
    try {
      return await session.sock.sendMessage(jid, {
        image: { url: options.imageUrl },
        caption: String(text)
      });
    } catch (imgErr) {
      console.warn(`⚠️ [Baileys][${cid}] Falha ao enviar imagem (${options.imageUrl}), enviando como texto:`, imgErr.message);
      return await session.sock.sendMessage(jid, { text: String(text) });
    }
  }

  return await session.sock.sendMessage(jid, { text: String(text) });
}

// Construtor dinâmico de Oferta do Dia integrada ao estoque real da loja (companyId)
async function buildStockOfferMessage(options = {}, companyId = OFFICIAL_COMPANY_ID) {
  const cid = sanitizeTenantId(companyId);
  try {
    const cardapioUrl = options.cardapioUrl || 'https://smoking-pods.vercel.app';
    const count = Math.min(Math.max(Number(options.count) || 1, 1), 2);

    const { data: products, error } = await supabase
      .from('smoking_products')
      .select('name, brand, flavor, price, stock, image_url, is_active')
      .eq('company_id', cid)
      .gt('stock', 0)
      .eq('is_active', true);

    if (error || !products || products.length === 0) {
      console.warn(`⚠️ [StockOffer][${cid}] Nenhum produto ativo com estoque positivo encontrado.`);
      return null;
    }

    const modelMap = new Map();
    products.forEach(p => {
      const rawName = p.name ? p.name.trim() : '';
      if (!rawName) return;

      const modelUpper = rawName.toUpperCase();
      if (modelUpper === 'TESTE') return;

      if (!modelMap.has(modelUpper)) {
        modelMap.set(modelUpper, {
          name: rawName,
          upperKey: modelUpper,
          brand: p.brand || '',
          price: Number(p.price) || 0,
          imageUrl: p.image_url || null,
          flavors: []
        });
      }

      const item = modelMap.get(modelUpper);
      if (p.flavor && !item.flavors.some(f => f.toLowerCase() === p.flavor.trim().toLowerCase())) {
        item.flavors.push(p.flavor.trim());
      }
      if (p.image_url && !item.imageUrl) {
        item.imageUrl = p.image_url;
      }
      if (Number(p.price) > 0 && (item.price === 0 || Number(p.price) < item.price)) {
        item.price = Number(p.price);
      }
    });

    const allModels = Array.from(modelMap.values()).filter(m => m.flavors.length > 0);
    if (allModels.length === 0) return null;

    const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const todayStr = nowSP.toISOString().split('T')[0];

    const config = loadMarketingConfig(cid);
    if (!config.dailyStockOffers || typeof config.dailyStockOffers !== 'object') {
      config.dailyStockOffers = {};
    }
    if (!Array.isArray(config.stockOfferCycle)) {
      config.stockOfferCycle = [];
    }

    const todayOfferedUpper = (config.dailyStockOffers[todayStr] || []).map(n => String(n).trim().toUpperCase());
    const cycleOfferedUpper = config.stockOfferCycle.map(n => String(n).trim().toUpperCase());

    let unofferedInCycle = allModels.filter(m =>
      !cycleOfferedUpper.includes(m.upperKey) && !todayOfferedUpper.includes(m.upperKey)
    );

    if (unofferedInCycle.length < count) {
      console.log(`🔄 [StockOffer][${cid}] Ciclo completo atingido! Reiniciando novo ciclo...`);
      config.stockOfferCycle = [];
      unofferedInCycle = allModels.filter(m => !todayOfferedUpper.includes(m.upperKey));
      if (unofferedInCycle.length === 0) {
        unofferedInCycle = allModels;
      }
    }

    const shuffled = unofferedInCycle.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    selected.forEach(m => {
      if (!config.stockOfferCycle.some(c => c.toUpperCase() === m.upperKey)) {
        config.stockOfferCycle.push(m.name);
      }
    });

    if (!config.dailyStockOffers[todayStr]) config.dailyStockOffers[todayStr] = [];
    selected.forEach(m => {
      if (!config.dailyStockOffers[todayStr].some(c => c.toUpperCase() === m.upperKey)) {
        config.dailyStockOffers[todayStr].push(m.name);
      }
    });

    const allDates = Object.keys(config.dailyStockOffers).sort();
    if (allDates.length > 7) {
      const datesToRemove = allDates.slice(0, allDates.length - 7);
      datesToRemove.forEach(d => delete config.dailyStockOffers[d]);
    }

    saveMarketingConfig(config, cid);

    const offers = selected.map(model => {
      const formattedPrice = model.price > 0
        ? model.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0,00';

      const flavorsList = model.flavors.map(f => `• ${f}`).join('\n');

      const messageText = `🔥 OFERTA DO DIA NO VIP: ${model.name.toUpperCase()}! 💨\n\n💰 Apenas R$ ${formattedPrice}\n\n✨ Sabores disponíveis em estoque agora:\n${flavorsList}\n\n🚀 Peça direto no nosso cardápio ou no whatsapp antes que esgote:\n👉 ${cardapioUrl}`;

      return {
        modelName: model.name,
        imageUrl: model.imageUrl,
        messageText
      };
    });

    return offers;
  } catch (err) {
    console.error(`❌ [StockOffer][${cid}] Erro ao construir oferta de estoque:`, err.message);
    return null;
  }
}


// =============================================
// ROTAS DE MARKETING & CONEXÃO WHATSAPP MULTITENANT SOB DEMANDA
// =============================================

// Endpoint para consultar status atual da conexão da loja
app.get('/api/qr', (req, res) => {
  const companyId = getRequestCompanyId(req);
  const session = getTenantSession(companyId);
  const hasSaved = hasSavedWhatsAppSession(companyId);
  const fallbackUrl = session.latestQr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(session.latestQr)}`
    : null;

  let state = session.whatsAppSessionState;
  if (session.isWhatsAppReady) state = 'CONNECTED';
  else if (session.latestQr) state = 'QR_AVAILABLE';
  else if (state === 'SESSION_INVALID') state = 'SESSION_INVALID';
  else if (hasSaved) state = 'DISCONNECTED';

  res.json({
    companyId,
    status: state,
    qr: session.latestQr,
    isReady: session.isWhatsAppReady,
    hasSavedSession: hasSaved,
    qrImageUrl: session.latestQrDataUrl || fallbackUrl
  });
});

// Endpoint explícito acionado pelo botão "Conectar WhatsApp" da loja
app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const hasSession = hasSavedWhatsAppSession(companyId);
    console.log(`📲 [API /connect][${companyId}] Ação do usuário: Conectar WhatsApp (hasSavedSession: ${hasSession})`);

    const connResult = await requestWhatsAppConnection(companyId, true);
    const session = getTenantSession(companyId);

    const fallbackUrl = session.latestQr
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(session.latestQr)}`
      : null;

    return res.json({
      companyId,
      success: connResult.success,
      status: session.whatsAppSessionState,
      isReady: session.isWhatsAppReady,
      hasSavedSession: hasSession,
      qr: session.latestQr,
      qrImageUrl: session.latestQrDataUrl || fallbackUrl,
      error: connResult.error
    });
  } catch (err) {
    console.error('❌ Erro no /api/whatsapp/connect:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint explícito para cancelar tentativa ou fechar socket da loja de forma limpa
app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    console.log(`🔌 [API /disconnect][${companyId}] Fechando socket temporariamente (preservando credenciais em disco)...`);
    await disconnectWhatsAppSocketCleanly(companyId, 'DISCONNECTED');
    return res.json({ success: true, companyId, message: 'Socket desconectado de forma limpa.', status: 'DISCONNECTED' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Logout definitivo da loja: encerra socket e apaga apenas a pasta de credenciais desta loja
app.post('/api/logout', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    console.log(`🔴 [API /logout][${companyId}] Recebido comando de LOGOUT DEFINITIVO do WhatsApp...`);
    await disconnectWhatsAppSocketCleanly(companyId, 'SESSION_INVALID');

    const authPath = getAuthDir(companyId);
    if (fs.existsSync(authPath)) {
      try {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log(`🧹 [${companyId}] Pasta de sessão removida.`);
      } catch (e) {}
    }

    return res.json({ success: true, companyId, message: 'Sessão do WhatsApp da loja destruída com sucesso.', status: 'SESSION_INVALID' });
  } catch (err) {
    console.error('Erro no logout:', err);
    return res.status(500).json({ error: 'Falha ao desconectar.' });
  }
});

app.get('/api/marketing/whatsapp-data', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const session = getTenantSession(companyId);

    await ensureTenantWhatsAppConnected(companyId, 6000);

    // 1. Varre contatos sincronizados e grupos inteligentes (com groupMetadata individual sem rate-limit!)
    scanAuthDirContacts(companyId);
    const groups = await syncTenantGroupsSmart(companyId, false);

    const cfg = loadMarketingConfig(companyId);
    const contactsMap = new Map();

    for (const [norm, c] of session.contactsMap.entries()) {
      contactsMap.set(norm, { ...c });
    }

    // 2. Contatos já existentes nas listas desta loja
    try {
      (cfg.lists || []).forEach(l => {
        if (l.id === 'list-demo-vip') return;
        (l.contacts || []).forEach(c => {
          const raw = c.cleanPhone || c.phone;
          const structural = validateStructuralPhone(raw);
          if (structural.valid && !structural.isGroup) {
            const norm = structural.cleanPhone;
            const existing = contactsMap.get(norm);
            if (!existing || (isGenericContactName(existing.name) && !isGenericContactName(c.name))) {
              contactsMap.set(norm, {
                id: c.id || `${norm}@s.whatsapp.net`,
                name: c.name || existing?.name || `Contato WhatsApp ${formatReadableBrPhone(norm)}`,
                phone: c.phone || norm,
                cleanPhone: norm,
                isSaved: true
              });
            }
          }
        });
      });
    } catch (e) {}

    // 3. Contatos do CRM Supabase filtrados estritamente por company_id desta loja
    try {
      const { data: dbClients } = await supabase
        .from('smoking_clients')
        .select('id, name, phone')
        .eq('company_id', companyId)
        .limit(2000);

      (dbClients || []).forEach(cl => {
        if (!cl.phone) return;
        const structural = validateStructuralPhone(cl.phone);
        if (structural.valid && !structural.isGroup) {
          const norm = structural.cleanPhone;
          const existing = contactsMap.get(norm);
          if (!existing || (isGenericContactName(existing.name) && !isGenericContactName(cl.name))) {
            contactsMap.set(norm, {
              id: cl.id || `${norm}@s.whatsapp.net`,
              name: cl.name || existing?.name || `Cliente ${norm.slice(-4)}`,
              phone: cl.phone,
              cleanPhone: norm,
              isSaved: true
            });
          }
        }
      });
    } catch (e) {}

    const contacts = Array.from(contactsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    cfg.whatsappContacts = contacts;
    if (groups.length > 0) cfg.whatsappGroups = groups;

    if (companyId !== OFFICIAL_COMPANY_ID && contacts.length > 0) {
      const realLists = (cfg.lists || []).filter(l => l.id !== 'list-demo-vip');
      const autoListId = 'list_whatsapp_sincronizados';
      const existingAutoIdx = realLists.findIndex(l => l.id === autoListId);
      const autoListObj = {
        id: autoListId,
        name: '📲 Contatos Sincronizados do WhatsApp',
        description: `Base sincronizada automaticamente do WhatsApp da loja (${contacts.length} contatos).`,
        color: '#10b981',
        createdAt: new Date().toISOString(),
        contacts
      };
      if (realLists.length === 0) {
        cfg.lists = [autoListObj];
      } else if (existingAutoIdx !== -1) {
        realLists[existingAutoIdx] = autoListObj;
        cfg.lists = realLists;
      }
    }

    saveMarketingConfig(cfg, companyId);

    return res.json({
      companyId,
      isReady: Boolean(session.isWhatsAppReady || contacts.length > 0),
      contactsCount: contacts.length,
      groupsCount: groups.length,
      contacts,
      groups,
      lists: cfg.lists || []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketing/scan-chats', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const map = scanAuthDirContacts(companyId);
    const groups = await syncTenantGroupsSmart(companyId, true);
    persistDiscoveredWhatsAppData(companyId);
    return res.json({
      success: true,
      companyId,
      contactsCount: map.size,
      groupsCount: groups.length,
      groups,
      message: `Varredura concluída: ${map.size} contatos e ${groups.length} grupos sincronizados.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// MOTOR DE DISPARO CONTÍNUO EM BACKGROUND ("ATÉ SEGUNDA ORDEM")
// Roda 100% no servidor Node.js: mesmo fechando o navegador, o disparo continua!
// ============================================================
app.get('/api/marketing/campaigns/dispatch-status', (req, res) => {
  const companyId = getRequestCompanyId(req);
  const state = activeCampaignDispatches.get(companyId) || null;
  return res.json({
    success: true,
    companyId,
    dispatch: state
  });
});

app.post('/api/marketing/campaigns/stop-dispatch', (req, res) => {
  const companyId = getRequestCompanyId(req);
  const state = activeCampaignDispatches.get(companyId);
  if (state && state.isRunning) {
    state.abortRequested = true;
    state.status = '🛑 Interrompendo disparo a pedido do usuário...';
  }
  return res.json({
    success: true,
    companyId,
    stopped: Boolean(state)
  });
});

app.post('/api/marketing/campaigns/start-dispatch', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const { campaign, contacts, forceSend, cardapioUrl, grupoVipUrl } = req.body;

    if (!campaign || !campaign.id) {
      return res.status(400).json({ success: false, error: 'Campanha inválida.' });
    }

    const existing = activeCampaignDispatches.get(companyId);
    if (existing && existing.isRunning) {
      return res.json({
        success: true,
        companyId,
        alreadyRunning: true,
        dispatch: existing
      });
    }

    const ready = await ensureTenantWhatsAppConnected(companyId, 10000);
    if (!ready) {
      return res.status(503).json({
        success: false,
        error: 'WHATSAPP_OFFLINE',
        message: 'O WhatsApp da sua loja não está conectado. Conecte pelo QR Code primeiro.'
      });
    }

    const targetContacts = Array.isArray(contacts) ? contacts : [];
    const config = loadMarketingConfig(companyId);
    const alreadySentCount = forceSend
      ? 0
      : targetContacts.filter(c => {
          const norm = normalizeMarketingPhone(c.cleanPhone || c.phone);
          return norm && isPhoneAlreadySent(campaign.id, norm, config);
        }).length;

    const dispatchState = {
      companyId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      current: alreadySentCount,
      total: targetContacts.length || 1,
      sentInSession: 0,
      failedCount: 0,
      status: '🚀 Disparo contínuo iniciado no servidor (continua mesmo se fechar a aba)...',
      isRunning: true,
      abortRequested: false,
      startedAt: new Date().toISOString(),
      finishedAt: null
    };

    activeCampaignDispatches.set(companyId, dispatchState);

    // Executa em background no servidor até terminar todos os contatos ou até segunda ordem (stop-dispatch)
    (async () => {
      try {
        let batchCounter = 0;
        const effectiveBatchSize = (campaign.batchSize && Number(campaign.batchSize) <= 5) ? Number(campaign.batchSize) : 5;
        const effectiveBatchIntervalMinutes = (campaign.batchIntervalMinutes && Number(campaign.batchIntervalMinutes) >= 35) ? Number(campaign.batchIntervalMinutes) : 35;

        for (let i = 0; i < targetContacts.length; i++) {
          if (dispatchState.abortRequested) {
            dispatchState.status = `🛑 Disparo interrompido pelo usuário (${dispatchState.sentInSession} enviados nesta sessão).`;
            break;
          }

          const contact = targetContacts[i];
          const rawPhone = contact.cleanPhone || contact.phone;
          const normalizedPhone = normalizeMarketingPhone(rawPhone);
          if (!normalizedPhone) continue;

          const currentCfg = loadMarketingConfig(companyId);
          if (!forceSend && isPhoneAlreadySent(campaign.id, normalizedPhone, currentCfg)) {
            continue;
          }

          let chosenText = campaign.message || '';
          if (campaign.useVariations && Array.isArray(campaign.variations) && campaign.variations.length > 0) {
            const allTexts = [campaign.message, ...campaign.variations.filter(v => v && v.trim().length > 0)];
            chosenText = allTexts[batchCounter % allTexts.length];
          }

          const formattedMsg = chosenText
            .replace(/\[Nome\]/gi, contact.name || 'Cliente')
            .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, cardapioUrl || 'https://smoking-pods.vercel.app')
            .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, grupoVipUrl || '');

          dispatchState.status = `📤 Enviando para ${contact.name || normalizedPhone}...`;

          try {
            if (campaign.isStockOffer) {
              const count = Number(campaign.stockOfferCount) || 1;
              const offers = await buildStockOfferMessage({ count, cardapioUrl }, companyId);
              if (offers && offers.length > 0) {
                for (let idx = 0; idx < offers.length; idx++) {
                  const offer = offers[idx];
                  await sendBaileysMessage(normalizedPhone, offer.messageText, { imageUrl: offer.imageUrl }, companyId);
                  if (idx < offers.length - 1) await new Promise(r => setTimeout(r, 4000));
                }
              }
            } else {
              await sendBaileysMessage(normalizedPhone, formattedMsg, { imageUrl: campaign.imageUrl }, companyId);
            }

            markPhoneAsSent(campaign.id, normalizedPhone, currentCfg);
            saveMarketingConfig(currentCfg, companyId);
            dispatchState.sentInSession++;
            dispatchState.current = Math.min(dispatchState.total, dispatchState.current + 1);
            batchCounter++;

            dispatchState.status = `✅ Entregue (${dispatchState.current}/${dispatchState.total}) para ${contact.name || normalizedPhone}.`;
          } catch (sendErr) {
            console.warn(`⚠️ [Dispatch][${companyId}] Erro ao enviar para ${normalizedPhone}:`, sendErr.message);
            dispatchState.failedCount++;
            markPhoneAsSent(campaign.id, normalizedPhone, currentCfg);
            saveMarketingConfig(currentCfg, companyId);
            dispatchState.current = Math.min(dispatchState.total, dispatchState.current + 1);
            dispatchState.status = `⚠️ Falha em ${contact.name || normalizedPhone} (${sendErr.message}). Avançando...`;
            continue;
          }

          // Verifica se ainda há contatos pendentes
          const hasMorePending = targetContacts.slice(i + 1).some(c => {
            const np = normalizeMarketingPhone(c.cleanPhone || c.phone);
            return np && (forceSend || !isPhoneAlreadySent(campaign.id, np, currentCfg));
          });
          if (!hasMorePending) break;

          // Delay anti-ban individual (20 a 35s)
          const randomDelay = Math.floor(Math.random() * 15000) + 20000;
          for (let elapsed = 0; elapsed < randomDelay; elapsed += 1000) {
            if (dispatchState.abortRequested) break;
            const remSec = Math.max(0, Math.ceil((randomDelay - elapsed) / 1000));
            dispatchState.status = `⏳ Intervalo de proteção anti-ban: aguardando ${remSec}s antes do próximo contato (${dispatchState.current}/${dispatchState.total})...`;
            await new Promise(r => setTimeout(r, 1000));
          }

          if (dispatchState.abortRequested) break;

          // Pausa entre lotes (a cada 5 envios, pausa de 35 min mantendo o WhatsApp conectado!)
          if (batchCounter >= effectiveBatchSize) {
            batchCounter = 0;
            const pauseDurationMs = effectiveBatchIntervalMinutes * 60 * 1000;
            const targetEndTime = Date.now() + pauseDurationMs;

            while (Date.now() < targetEndTime) {
              if (dispatchState.abortRequested) break;
              const remSeconds = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
              const mins = Math.floor(remSeconds / 60);
              const secs = remSeconds % 60;
              dispatchState.status = `⏸️ Lote de ${effectiveBatchSize} enviado! Pausa anti-ban no servidor: ${mins}m ${secs < 10 ? '0' : ''}${secs}s restantes (${dispatchState.current}/${dispatchState.total})...`;
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }

        if (!dispatchState.abortRequested) {
          const finalCfg = loadMarketingConfig(companyId);
          const cIdx = (finalCfg.campaigns || []).findIndex(c => c.id === campaign.id);
          if (cIdx !== -1) {
            const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            finalCfg.campaigns[cIdx].lastRunDate = nowSP.toLocaleDateString('pt-BR');
            saveMarketingConfig(finalCfg, companyId);
          }
          dispatchState.status = `🎉 Campanha "${campaign.name}" concluída! (${dispatchState.sentInSession} enviados nesta sessão).`;
        }
      } catch (loopErr) {
        console.error(`❌ [Dispatch][${companyId}] Erro fatal no loop:`, loopErr.message);
        dispatchState.status = `❌ Erro no disparo: ${loopErr.message}`;
      } finally {
        dispatchState.isRunning = false;
        dispatchState.finishedAt = new Date().toISOString();
      }
    })();

    return res.json({
      success: true,
      companyId,
      dispatch: dispatchState
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/marketing/stock-offer-preview', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const count = Number(req.query.count) || 1;
    const offers = await buildStockOfferMessage({ count }, companyId);
    return res.json({ success: true, companyId, offers: offers || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/marketing/send-direct', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req);
    const session = getTenantSession(companyId);
    const { phone, name, text, campaignId, force, imageUrl, isStockOffer, stockOfferCount } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'DADOS_OBRIGATORIOS',
        message: 'Telefone é obrigatório.'
      });
    }

    if (!isStockOffer && !text) {
      return res.status(400).json({
        success: false,
        error: 'DADOS_OBRIGATORIOS',
        message: 'Texto da mensagem é obrigatório.'
      });
    }

    const ready = await ensureTenantWhatsAppConnected(companyId, 12000);
    if (!ready || !session.sock) {
      return res.status(503).json({
        success: false,
        error: 'WHATSAPP_OFFLINE',
        message: 'O WhatsApp da sua loja não está conectado. Conecte pelo QR Code na aba Marketing.'
      });
    }

    let targetJid = '';
    if (String(phone).includes('chat.whatsapp.com/')) {
      try {
        const inviteCode = String(phone).split('chat.whatsapp.com/')[1].trim().split('?')[0];
        const groupChat = await session.sock.groupAcceptInvite(inviteCode);
        targetJid = groupChat || `${inviteCode}@g.us`;
      } catch (invErr) {
        targetJid = phone;
      }
    } else if (String(phone).includes('@g.us')) {
      targetJid = String(phone);
    } else {
      const probeDetails = await resolveCanonicalWhatsAppJid(phone, companyId);
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

    const config = loadMarketingConfig(companyId);
    const cleanDigits = targetJid.replace(/\D/g, '');
    const isTestCampaign = force || (campaignId && String(campaignId).toLowerCase().includes('teste'));

    if (!force && !isTestCampaign && campaignId && isPhoneAlreadySent(campaignId, cleanDigits, config)) {
      return res.json({
        success: true,
        skipped: true,
        reason: 'Contato já recebeu esta campanha anteriormente (proteção anti-ban).'
      });
    }

    console.log(`📢 [Marketing][${companyId}] Enviando mensagem para ${targetJid} (${name || 'Cliente'})...`);

    let sentResult;
    if (isStockOffer) {
      const count = Number(stockOfferCount) || 1;
      const offers = await buildStockOfferMessage({ count }, companyId);
      if (offers && offers.length > 0) {
        for (let idx = 0; idx < offers.length; idx++) {
          const offer = offers[idx];
          sentResult = await sendBaileysMessage(targetJid, offer.messageText, { imageUrl: offer.imageUrl }, companyId);
          if (idx < offers.length - 1) {
            await new Promise(r => setTimeout(r, 4000));
          }
        }
      } else {
        return res.status(400).json({ success: false, message: 'Nenhum pod disponível com estoque positivo na sua loja no momento.' });
      }
    } else {
      sentResult = await sendBaileysMessage(targetJid, text, { imageUrl }, companyId);
    }

    if (campaignId && !isTestCampaign) {
      markPhoneAsSent(campaignId, cleanDigits, config);
      saveMarketingConfig(config, companyId);
    }

    return res.json({
      success: true,
      companyId,
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
    const companyId = getRequestCompanyId(req);
    const { campaignId } = req.body;
    if (!campaignId) {
      return res.status(400).json({ error: 'campaignId é obrigatório.' });
    }

    const config = loadMarketingConfig(companyId);
    const camp = (config.campaigns || []).find(c => c.id === campaignId);
    if (!camp) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }

    const ready = await ensureTenantWhatsAppConnected(companyId, 10000);
    if (!ready) {
      return res.status(503).json({ error: 'O WhatsApp da sua loja não está conectado.' });
    }

    const trace = [];
    trace.push(`Iniciando teste da campanha "${camp.name}"...`);

    if (camp.targetType === 'group' && camp.targetGroupId) {
      if (camp.isStockOffer) {
        const count = Number(camp.stockOfferCount) || 1;
        const offers = await buildStockOfferMessage({ count }, companyId);
        if (offers && offers.length > 0) {
          for (let idx = 0; idx < offers.length; idx++) {
            const offer = offers[idx];
            trace.push(`Enviando oferta do modelo "${offer.modelName}" com foto para o grupo ${camp.targetGroupId}...`);
            await sendBaileysMessage(camp.targetGroupId, offer.messageText, { imageUrl: offer.imageUrl }, companyId);
            if (idx < offers.length - 1) await new Promise(r => setTimeout(r, 4000));
          }
          trace.push(`✅ Ofertas disparadas com sucesso no grupo.`);
        } else {
          trace.push(`⚠️ Nenhum produto com estoque ativo encontrado para gerar a oferta.`);
        }
      } else {
        const formattedMsg = camp.message
          .replace(/\[Nome\]/gi, 'Pessoal')
          .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, 'https://smoking-pods.vercel.app')
          .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, '');

        trace.push(`Enviando mensagem para o grupo ${camp.targetGroupId}...`);
        await sendBaileysMessage(camp.targetGroupId, formattedMsg, { imageUrl: camp.imageUrl }, companyId);
        trace.push(`✅ Mensagem de texto enviada com sucesso ao grupo.`);
      }
    }

    return res.json({ success: true, companyId, trace });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/marketing/test-lab-dispatch', async (req, res) => {
  const trace = [];
  try {
    const companyId = getRequestCompanyId(req);
    const session = getTenantSession(companyId);
    const { phone, text, name } = req.body;
    trace.push({ step: 1, title: 'Recepção dos Dados', status: 'OK', details: { phone, name: name || 'Teste', companyId } });

    if (!phone || !text) {
      trace.push({ step: 2, title: 'Validação', status: 'ERROR', message: 'Telefone ou mensagem vazia.' });
      return res.status(400).json({ success: false, trace, error: 'Telefone e mensagem são obrigatórios.' });
    }

    const ready = await ensureTenantWhatsAppConnected(companyId, 10000);
    if (!ready || !session.sock) {
      trace.push({ step: 2, title: 'Status do WhatsApp', status: 'ERROR', message: 'WhatsApp da loja desconectado.' });
      return res.status(503).json({ success: false, trace, error: 'WhatsApp offline. Conecte pelo QR Code.' });
    }
    trace.push({ step: 2, title: 'Status do WhatsApp', status: 'OK', message: 'WhatsApp da loja conectado via WebSocket.' });

    const structural = validateStructuralPhone(phone);
    if (!structural.valid) {
      trace.push({ step: 3, title: 'Validação Estrutural', status: 'ERROR', message: structural.message });
      return res.status(422).json({ success: false, trace, error: structural.error, message: structural.message });
    }
    trace.push({ step: 3, title: 'Validação Estrutural', status: 'OK', details: { ddd: structural.ddd, digits: structural.cleanPhone } });

    const probe = await resolveCanonicalWhatsAppJid(phone, companyId);
    if (!probe.valid) {
      trace.push({ step: 4, title: 'Verificação no Servidor', status: 'ERROR', message: probe.message });
      return res.status(422).json({ success: false, trace, error: probe.error, message: probe.message });
    }
    trace.push({ step: 4, title: 'Verificação no Servidor', status: 'OK', message: `Conta ativa: ${probe.jid}` });

    trace.push({ step: 5, title: 'Envio da Mensagem', status: 'IN_PROGRESS', target: probe.jid });
    const result = await session.sock.sendMessage(probe.jid, { text });
    trace.push({ step: 5, title: 'Envio da Mensagem', status: 'OK', messageId: result.key.id });

    return res.json({
      success: true,
      companyId,
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
// MOTOR SCHEDULER MULTITENANT DE MARKETING (setInterval 60s)
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

function getAllConfiguredTenantIds() {
  const ids = new Set([OFFICIAL_COMPANY_ID]);
  try {
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      files.forEach(file => {
        const m = file.match(/^marketing_config_(.+)\.json$/);
        if (m && m[1]) ids.add(m[1]);
      });
    }
  } catch (e) {}
  for (const cid of tenantSessions.keys()) {
    ids.add(cid);
  }
  return Array.from(ids);
}

const runningListCampaigns = new Set();

async function runSchedulerForCompany(companyId) {
  const cid = sanitizeTenantId(companyId);
  try {
    const config = loadMarketingConfig(cid);
    if (!config.campaigns || config.campaigns.length === 0) return;

    const session = getTenantSession(cid);
    if (!session.isWhatsAppReady || !session.sock) {
      if (hasSavedWhatsAppSession(cid)) {
        console.log(`🔄 [Marketing Scheduler][${cid}] Tentando restaurar sessão Baileys salva em disco...`);
        await requestWhatsAppConnection(cid, false);
      }
    }

    if (!session.isWhatsAppReady || !session.sock) {
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
      const isTwoSlots = Boolean(camp.isStockOffer && Number(camp.stockOfferCount) === 2 && camp.scheduledTime2);

      let matchedSlot = null;
      if (camp.scheduledTime === currentTimeStr) {
        matchedSlot = 'slot1';
      } else if (isTwoSlots && camp.scheduledTime2 === currentTimeStr) {
        matchedSlot = 'slot2';
      }

      if (!matchedSlot) continue;

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
      } else if (freq > 1) {
        if (camp.lastRunDate) {
          const [d, m, y] = camp.lastRunDate.split('/').map(Number);
          const lastDate = new Date(y, m - 1, d, 0, 0, 0);
          const diffDays = Math.floor((nowSP.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < freq) continue;
        }
      }

      const idempKey = `${cid}_${camp.id}_${todayStr}_${matchedSlot}`;
      const alreadyFired = (config.idempotencyKeys || []).some(entry => entry.key === idempKey);
      if (alreadyFired) continue;

      if (camp.targetType === 'group' && camp.targetGroupId) {
        try {
          if (camp.isStockOffer) {
            const count = isTwoSlots ? 1 : (Number(camp.stockOfferCount) || 1);
            const offers = await buildStockOfferMessage({ count }, cid);
            if (offers && offers.length > 0) {
              for (let idx = 0; idx < offers.length; idx++) {
                const offer = offers[idx];
                await sendBaileysMessage(camp.targetGroupId, offer.messageText, { imageUrl: offer.imageUrl }, cid);
                if (idx < offers.length - 1) await new Promise(r => setTimeout(r, 4000));
              }
            } else {
              console.warn(`⚠️ [Scheduler Grupo][${cid}] Campanha "${camp.name}" (${matchedSlot}): Nenhum pod disponível com estoque positivo.`);
            }
          } else {
            const formattedMsg = (camp.message || '')
              .replace(/\[Nome\]/gi, 'Pessoal')
              .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, 'https://smoking-pods.vercel.app')
              .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, '');

            await sendBaileysMessage(camp.targetGroupId, formattedMsg, { imageUrl: camp.imageUrl }, cid);
          }

          const freshConfig = loadMarketingConfig(cid);
          if (!freshConfig.idempotencyKeys) freshConfig.idempotencyKeys = [];
          freshConfig.idempotencyKeys.push({ key: idempKey, timestamp: new Date().toISOString(), campaignName: camp.name });

          const campIndex = freshConfig.campaigns.findIndex(c => c.id === camp.id);
          if (campIndex !== -1) {
            freshConfig.campaigns[campIndex].lastRunDate = nowSP.toLocaleDateString('pt-BR');
          }
          saveMarketingConfig(freshConfig, cid);
          console.log(`✅ [Scheduler Grupo][${cid}] Campanha "${camp.name}" (${matchedSlot}) disparada com sucesso às ${currentTimeStr}.`);
        } catch (e) {
          console.error(`❌ [Scheduler Grupo][${cid}] Erro:`, e.message);
        }
      }

      const runLockKey = `${cid}_${camp.id}`;
      if (camp.targetType === 'lists' && !runningListCampaigns.has(runLockKey)) {
        if (!config.idempotencyKeys) config.idempotencyKeys = [];
        config.idempotencyKeys.push({ key: idempKey, timestamp: new Date().toISOString(), campaignName: camp.name });
        saveMarketingConfig(config, cid);

        runningListCampaigns.add(runLockKey);

        (async () => {
          try {
            console.log(`🚀 [Scheduler 1-a-1][${cid}] Disparando campanha autônoma: "${camp.name}"`);
            const lists = config.lists || [];
            const targetLists = lists.filter(l => (camp.selectedListIds || []).includes(l.id));
            const contactMap = new Map();
            targetLists.forEach(l => (l.contacts || []).forEach(c => contactMap.set(c.id || c.phone, c)));
            const targetContacts = Array.from(contactMap.values());

            let batchCounter = 0;
            const effectiveBatchSize = camp.batchSize || 5;
            const effectiveBatchInterval = camp.batchIntervalMinutes || 35;

            for (let i = 0; i < targetContacts.length; i++) {
              const currentConfig = loadMarketingConfig(cid);
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
                await sendBaileysMessage(formattedNumber, formattedMsg, {}, cid);
              } catch (e) {
                console.warn(`⚠️ [${cid}] Erro ao enviar para ${formattedNumber}:`, e.message);
              }

              markPhoneAsSent(camp.id, cleanPhone, currentConfig);
              saveMarketingConfig(currentConfig, cid);
              batchCounter++;

              const randomDelay = Math.floor(Math.random() * 10000) + 10000;
              await new Promise(r => setTimeout(r, randomDelay));

              if (batchCounter >= effectiveBatchSize && (i + 1) < targetContacts.length) {
                batchCounter = 0;
                console.log(`⏸️ [Scheduler 1-a-1][${cid}] Lote de ${effectiveBatchSize} enviado. Pausa de ${effectiveBatchInterval} min...`);
                await new Promise(r => setTimeout(r, effectiveBatchInterval * 60 * 1000));
              }
            }

            const finalConfig = loadMarketingConfig(cid);
            const cIdx = (finalConfig.campaigns || []).findIndex(c => c.id === camp.id);
            if (cIdx !== -1) {
              finalConfig.campaigns[cIdx].lastRunDate = nowSP.toLocaleDateString('pt-BR');
              saveMarketingConfig(finalConfig, cid);
            }
          } catch (e) {
            console.error(`❌ [Scheduler][${cid}] Erro em "${camp.name}":`, e.message);
          } finally {
            runningListCampaigns.delete(runLockKey);
          }
        })();
      }
    }
  } catch (err) {
    console.error(`❌ [Scheduler][${cid}] Erro tick:`, err.message);
  }
}

async function marketingSchedulerTick() {
  const tenantIds = getAllConfiguredTenantIds();
  for (const cid of tenantIds) {
    await runSchedulerForCompany(cid);
  }
}

setInterval(marketingSchedulerTick, 60 * 1000);

// =============================================
// SERVER START
// =============================================
// ============================================================
// AUTO-RESTORE DE SESSÕES NO BOOT & WATCHDOG KEEP-ALIVE (30s)
// Garante que nenhuma loja caia e que todos os disparos continuem até segunda ordem!
// ============================================================
function discoverAllSavedAuthTenants() {
  const ids = new Set(getAllConfiguredTenantIds());
  try {
    const rootFiles = fs.readdirSync(__dirname);
    rootFiles.forEach(f => {
      if (f === 'baileys_auth') {
        ids.add(OFFICIAL_COMPANY_ID);
      } else if (f.startsWith('baileys_auth_')) {
        const cid = f.replace('baileys_auth_', '').trim();
        if (cid && !cid.includes('test-')) ids.add(cid);
      }
    });
  } catch (e) {}
  return Array.from(ids);
}

async function restoreAndKeepAliveAllSessions() {
  const allTenants = discoverAllSavedAuthTenants();
  for (const cid of allTenants) {
    if (!hasSavedWhatsAppSession(cid)) continue;
    const session = getTenantSession(cid);
    if (!session.isWhatsAppReady && !session.activeConnectPromise && session.whatsAppSessionState !== 'SESSION_INVALID' && session.whatsAppSessionState !== 'DISCONNECTING') {
      console.log(`🔄 [Watchdog 24/7][${cid}] Restaurando sessão WhatsApp ativa automaticamente...`);
      requestWhatsAppConnection(cid, false).catch(() => {});
    }
  }
}

setInterval(restoreAndKeepAliveAllSessions, 30 * 1000);

app.listen(port, () => {
  console.log(`🚀 Servidor backend Multitenant 24/7 rodando na porta ${port}`);
  setTimeout(restoreAndKeepAliveAllSessions, 1500);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ UncaughtException capturado no backend:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ UnhandledRejection capturado no backend:', reason);
});
