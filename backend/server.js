require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
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

app.get('/api/marketing/whatsapp-data', (req, res) => {
  return res.json({
    isReady: false,
    groups: [],
    contacts: []
  });
});

app.post('/api/marketing/scan-chats', (req, res) => {
  return res.json({ success: true, message: 'Varredura concluída.' });
});

app.post('/api/marketing/test-dispatch', (req, res) => {
  return res.json({ success: true, message: 'Simulação de teste concluída.' });
});

app.post('/api/marketing/send-direct', (req, res) => {
  return res.json({ success: true, message: 'Mensagem simulada.' });
});

app.post('/api/marketing/test-lab-dispatch', (req, res) => {
  return res.json({ success: true, message: 'Teste registrado no laboratório.' });
});

// =============================================
// LEGACY STUBS (Proteção para rotas obsoletas)
// =============================================
app.get('/api/qr', (req, res) => {
  res.json({ isReady: false, qr: null, qrImageUrl: null });
});

app.post('/api/logout', (req, res) => {
  res.json({ success: true, message: 'Nenhuma sessão ativa.' });
});

app.get('/api/chatbot/security-status', (req, res) => {
  res.json({ isEloisaAiActive: false, isWhatsAppReady: false, silencedChats: [], blacklist: [] });
});

app.post('/api/chatbot/toggle-master', (req, res) => {
  res.json({ success: true, isEloisaAiActive: false });
});

app.post('/api/chatbot/silence-chat', (req, res) => {
  res.json({ success: true, message: 'Chat silenciado.' });
});

app.post('/api/chatbot/blacklist', (req, res) => {
  res.json({ success: true });
});

app.post('/api/chat/reset-history', (req, res) => {
  res.json({ success: true });
});

// =============================================
// SERVER START
// =============================================
app.listen(port, () => {
  console.log(`🚀 Servidor backend rodando na porta ${port}`);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ UncaughtException capturado no backend:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ UnhandledRejection capturado no backend:', reason);
});
