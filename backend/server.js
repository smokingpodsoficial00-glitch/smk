require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, MessageTypes } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getAiResponse, conversationHistory, initConversation } = require('./ai_agent');
const { calculateShippingQuote } = require('./uberService');
const { supabase } = require('./supabase');
const { transcribeAudio } = require('./audioService');
const QRCodeImage = require('qrcode');
const app = express();

// Configuração segura e restrita de CORS para produção e desenvolvimento
const rawCorsOrigins = process.env.CORS_ORIGINS || '';
const configuredOrigins = rawCorsOrigins
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://smoking-pods-admin.vercel.app',
  'https://smoking-pods-catalogo.vercel.app',
  'https://smoking-pods.vercel.app',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permite requisições sem header Origin (ex: chamadas diretas servidor-a-servidor, curl, webhooks)
    if (!origin) return callback(null, true);

    // Permite domínios da Vercel (painel admin, catálogo e previews) e localhost
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

    // Suporte a wildcard em subdomínios (ex: https://*-smoking-pods.vercel.app)
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

app.use(cors(corsOptions));
app.use(express.json());

const port = process.env.PORT || 3006;

const puppeteerArgs = [
    '--no-sandbox', 
    '--disable-setuid-sandbox', 
    '--disable-extensions',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
];

const puppeteerOptions = {
    headless: true,
    args: puppeteerArgs
};

if (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
    puppeteerOptions.executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

// Inicializa o cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    },
    puppeteer: puppeteerOptions
});

let latestQr = null;
let latestQrDataUrl = null;
let isWhatsAppReady = false;
const aiSentMessages = new Set();
const detectedGroups = {};

// 🛡️ CONTROLE DE ATENDIMENTO (IA ELOISA DESATIVADA)
let isEloisaAiActive = false; // Chatbot Desativado (Atendimento 100% Humano)
const silencedChatsMap = new Map(); // Human Takeover: { [phoneOrChatId]: expireTimestamp }
const blacklistPhonesSet = new Set(); // Blacklist de números ignorados permanentemente

// Persistência em disco da Blacklist (Arquivo JSON)
const BLACKLIST_FILE = path.join(__dirname, 'blacklist_phones.json');
try {
    if (fs.existsSync(BLACKLIST_FILE)) {
        const savedBlacklist = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
        if (Array.isArray(savedBlacklist)) {
            savedBlacklist.forEach(p => blacklistPhonesSet.add(String(p)));
            console.log(`🔒 [Blacklist] ${blacklistPhonesSet.size} contatos ignorados carregados do arquivo persistente.`);
        }
    }
} catch (err) {
    console.warn('⚠️ Aviso ao carregar blacklist_phones.json:', err.message);
}

const saveBlacklistToDisk = () => {
    try {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(Array.from(blacklistPhonesSet), null, 2), 'utf8');
    } catch (e) {
        console.error('❌ Erro ao salvar blacklist em disco:', e.message);
    }
};

client.on('qr', async (qr) => {
    latestQr = qr;
    isWhatsAppReady = false;
    try {
        latestQrDataUrl = await QRCodeImage.toDataURL(qr, { width: 400, margin: 2 });
    } catch (e) {
        console.warn('⚠️ Erro ao converter QR Code para DataURL:', e.message);
    }
    console.log('----------------------------------------------------');
    console.log('🤖 Escaneie o QR Code abaixo com o seu WhatsApp:');
    console.log('----------------------------------------------------');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    latestQr = null;
    latestQrDataUrl = null;
    console.log('🔑 WhatsApp Autenticado com sucesso! Carregando conversas...');
});

client.on('loading_screen', (percent, message) => {
    latestQr = null;
    latestQrDataUrl = null;
    console.log(`⏳ Carregando WhatsApp Web: ${percent}% - ${message}`);
});

client.on('ready', async () => {
    latestQr = null;
    latestQrDataUrl = null;
    isWhatsAppReady = true;
    console.log('✅ Inteligência Artificial conectada ao WhatsApp com sucesso!');
    
    // Mapeamento Proativo de Agenda e LIDs para resposta e blacklist instantâneas
    try {
        const contacts = await client.getContacts();
        console.log(`📇 [Agenda] ${contacts.length} contatos indexados no cache do WhatsApp.`);
    } catch (e) {}
});

app.get('/api/qr', (req, res) => {
    const fallbackUrl = latestQr ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQr)}` : null;
    res.json({
        qr: latestQr,
        isReady: isWhatsAppReady,
        qrImageUrl: latestQrDataUrl || fallbackUrl
    });
});

app.post('/api/logout', async (req, res) => {
    try {
        console.log('🔴 Recebido comando de desconexão e limpeza total de sessão do WhatsApp...');
        isWhatsAppReady = false;
        latestQr = null;

        try {
            await client.logout();
        } catch (e) {
            console.warn('Aviso no logout:', e.message);
        }
        try {
            await client.destroy();
        } catch (e) {
            console.warn('Aviso no destroy:', e.message);
        }

        const authPath = path.join(__dirname, '.wwebjs_auth');
        const cachePath = path.join(__dirname, '.wwebjs_cache');
        if (fs.existsSync(authPath)) {
            try {
                fs.rmSync(authPath, { recursive: true, force: true });
                console.log('🧹 Pasta de sessão .wwebjs_auth removida.');
            } catch (e) {
                console.warn('Aviso ao remover pasta auth:', e.message);
            }
        }
        if (fs.existsSync(cachePath)) {
            try {
                fs.rmSync(cachePath, { recursive: true, force: true });
                console.log('🧹 Pasta de cache .wwebjs_cache removida.');
            } catch (e) {
                console.warn('Aviso ao remover pasta cache:', e.message);
            }
        }

        res.json({ success: true, message: 'WhatsApp desconectado com sucesso. Gerando novo QR Code...' });

        setTimeout(async () => {
            try {
                console.log('🔄 Reinicializando cliente do WhatsApp para gerar novo QR Code...');
                await client.initialize();
            } catch (e) {
                console.error('Erro ao re-inicializar cliente:', e);
            }
        }, 1500);
    } catch (err) {
        console.error('Erro no logout API:', err);
        res.status(500).json({ error: 'Falha ao desconectar.' });
    }
});

// =============================================
// STATE MANAGEMENT
// =============================================

// Guard: chats currently being processed (AI call in-flight)
const processingChats = new Set();

// CODE-007: Debounce — accumulate messages for 8 seconds before processing
const debounceTimers = new Map();   // chatId -> timeoutId
const pendingMessages = new Map();  // chatId -> { messages: string[], msg: Message, chat: Chat, contact: Contact }

// CODE-006: Follow-up timers — cancel when client responds
const pendingFollowUps = new Map(); // chatId -> { timers: [timeoutId, ...], stage: string }

// CODE-009: Reservation mode (out of hours — don't calculate freight)
const reservationMode = new Set();  // chatId

// Silêncio pós-comprovante (bloqueia respostas da IA após pedido finalizado)
const silentChats = new Set();       // senderNumber
const autoResetTimers = new Map();   // senderNumber -> timeoutId (4h auto-reset)

// =============================================
// EMOJI REGEX (reused in multiple places)
// =============================================
const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;

// =============================================
// HELPER: Get São Paulo time (UTC-3)
// =============================================
function getSaoPauloTime() {
    const now = new Date();
    const spTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return {
        hours: spTime.getHours(),
        minutes: spTime.getMinutes(),
        totalMinutes: spTime.getHours() * 60 + spTime.getMinutes()
    };
}

// =============================================
// CODE-008: Out-of-hours detection (13:30 até 23:00)
// =============================================
function isOutOfHours() {
    const { totalMinutes } = getSaoPauloTime();
    const startMinutes = 13 * 60 + 30; // 13:30 = 810 min
    const endMinutes = 23 * 60;        // 23:00 = 1380 min
    return totalMinutes < startMinutes || totalMinutes >= endMinutes;
}

// =============================================
// SPAM DETECTION
// =============================================
function isSpamMessage(text) {
    const spamPatterns = [
        /https?:\/\/\S*(promo|oferta|desconto|gratis|ganhe|sorteio|cupom)/i,
        /mcdonalds|outback|burger\s*king|ifood\.com/i,
        /mentoria|curso\s*gratu[ií]to|ganhe\s*dinheiro|renda\s*extra/i,
        /vagas?\s*(de\s*emprego|dispon[ií]veis?)/i,
        /cl[ií]nica|procedimento\s*est[eé]tico/i,
        /divulga[çc][ãa]o|panfleto|propaganda/i,
    ];
    return spamPatterns.some(pattern => pattern.test(text));
}

// =============================================
// SEND SEQUENTIAL MESSAGES (Humanized Realistic Typing Simulation)
// =============================================
async function sendSequentialMessages(chat, msg, messagesArray, chatId, isFirstMessage) {
    try {
        const targetChatId = msg && (msg.from || (msg.id && msg.id.remote));

        for (let i = 0; i < messagesArray.length; i++) {
            const currentMsg = messagesArray[i];
            if (!currentMsg) continue;

            // 1. Pausa inicial antes de começar a digitar (Tempo de leitura humana)
            let readPauseMs = i === 0 ? (isFirstMessage ? 2500 : 1500) : 1800;
            await new Promise(resolve => setTimeout(resolve, readPauseMs));

            // 2. Tempo de "Digitando..." proporcional ao tamanho da frase (50ms por caractere, mín 3.0s, máx 6.5s)
            const charCount = currentMsg.length;
            const typingDurationMs = Math.min(Math.max(charCount * 50, 3000), 6500);

            // Dispara indicador "digitando..." via WhatsApp Web diretamente
            if (client && targetChatId) {
                try {
                    // Tenta via chat nativo ou via evaluate direto no WhatsApp Web
                    if (chat && typeof chat.sendStateTyping === 'function') {
                        await chat.sendStateTyping();
                    } else {
                        await client.pupPage.evaluate(async (jid) => {
                            if (window.WWebJS && window.WWebJS.sendPresenceAvailable) {
                                window.WWebJS.sendPresenceAvailable();
                            }
                            if (window.Store && window.Store.Chat) {
                                const c = await window.Store.Chat.get(jid) || window.Store.Chat.find(jid);
                                if (c && c.markComposing) {
                                    c.markComposing();
                                }
                            }
                        }, targetChatId);
                    }
                } catch (tErr) {
                    // Fallback se getChat falhar
                    try {
                        const resolvedChat = await client.getChatById(targetChatId);
                        if (resolvedChat) await resolvedChat.sendStateTyping();
                    } catch (e2) {}
                }
            }

            // Aguarda o tempo realista enquanto a barra mostra "digitando..."
            await new Promise(resolve => setTimeout(resolve, typingDurationMs));

            // 3. Envia a mensagem
            try {
                aiSentMessages.add(currentMsg.trim().toLowerCase());
                
                if (client && targetChatId) {
                    await client.sendMessage(targetChatId, currentMsg);
                } else if (msg && typeof msg.reply === 'function') {
                    await msg.reply(currentMsg);
                }
            } catch (sendErr) {
                console.warn('⚠️ Falha no sendMessage:', sendErr.message);
                if (msg && typeof msg.reply === 'function') {
                    await msg.reply(currentMsg);
                }
            }

            // 4. Limpa o estado de digitação
            if (client && targetChatId) {
                try {
                    if (chat && typeof chat.clearState === 'function') {
                        await chat.clearState();
                    } else {
                        await client.pupPage.evaluate(async (jid) => {
                            if (window.Store && window.Store.Chat) {
                                const c = await window.Store.Chat.get(jid) || window.Store.Chat.find(jid);
                                if (c && c.markPaused) {
                                    c.markPaused();
                                }
                            }
                        }, targetChatId);
                    }
                } catch (cErr) {}
            }
        }
    } catch (err) {
        console.error('❌ Erro no envio sequencial de mensagens:', err);
    } finally {
        processingChats.delete(chatId);
    }
}

// =============================================
// FOLLOW-UP SYSTEM (CODE-006)
// =============================================

function cancelFollowUps(chatId) {
    const existing = pendingFollowUps.get(chatId);
    if (existing) {
        for (const timerId of existing.timers) {
            clearTimeout(timerId);
        }
        pendingFollowUps.delete(chatId);
        console.log(`🔕 [Follow-up] Cancelados para ${chatId}`);
    }
}

function scheduleFollowUp(chatId, stage, delayMs, messagesFn) {
    if (!pendingFollowUps.has(chatId)) {
        pendingFollowUps.set(chatId, { timers: [], stage });
    }
    const entry = pendingFollowUps.get(chatId);
    entry.stage = stage;

    const timerId = setTimeout(async () => {
        try {
            // Check if follow-up was cancelled (client responded)
            const current = pendingFollowUps.get(chatId);
            if (!current || !current.timers.includes(timerId)) return;

            const formattedNumber = `${chatId}@c.us`;
            const chat = await client.getChatById(formattedNumber);
            const messages = messagesFn();

            for (const text of messages) {
                await chat.sendStateTyping();
                await new Promise(resolve => setTimeout(resolve, 5000));
                await client.sendMessage(formattedNumber, text);
                await chat.clearState();
            }

            console.log(`📤 [Follow-up] ${stage} enviado para ${chatId}`);

            // Remove this specific timer from the list
            const idx = current.timers.indexOf(timerId);
            if (idx > -1) current.timers.splice(idx, 1);
        } catch (err) {
            console.error(`❌ [Follow-up] Erro ao enviar ${stage} para ${chatId}:`, err);
        }
    }, delayMs);

    entry.timers.push(timerId);
    console.log(`⏰ [Follow-up] ${stage} agendado para ${chatId} em ${delayMs / 1000 / 60}min`);
}

// Schedule post-table follow-up (30 min)
function scheduleTableFollowUp(chatId) {
    cancelFollowUps(chatId);
    scheduleFollowUp(chatId, 'pos-tabela', 30 * 60 * 1000, () => [
        'conseguiu acessar ai amg?',
        'qualquer coisa estou á disposição'
    ]);
}

// Schedule payment follow-up (30 min + 1h)
function schedulePaymentFollowUp(chatId) {
    cancelFollowUps(chatId);

    // 1st follow-up: 30 minutes
    scheduleFollowUp(chatId, 'pagamento-1', 30 * 60 * 1000, () => [
        'opa, deu certo com o pagamento ou precisa de ajuda com algo amg?',
        'estou aqui para qualquer dúvida'
    ]);

    // 2nd follow-up: 1 hour (30 more minutes after the first)
    scheduleFollowUp(chatId, 'pagamento-2', 60 * 60 * 1000, () => [
        'vi que não finalizou o pagamento, vou retirar o seu pedido do sistema',
        'porém se quiser voltar e concluir o pagamento estaremos aqui 100% disponíveis para você, muito obrigado! 😁'
    ]);
}

// Schedule "oi" without follow-up (1 hour)
function scheduleOiFollowUp(chatId) {
    cancelFollowUps(chatId);
    scheduleFollowUp(chatId, 'oi-sem-resposta', 60 * 60 * 1000, () => [
        'opa, tudo bem? ainda podemos te ajudar?'
    ]);
}

// =============================================
// PARSE CART FROM DIGITAL MENU (Armazena em memória sem criar pedido no Kanban)
// =============================================
const latestCartItems = {};

// Função auxiliar para encontrar produto no Supabase com tolerância a variações de sabor (ex: Menthol Ice -> Menta)
async function findMatchingProduct(productName, flavor) {
    try {
        const { data: allProducts } = await supabase
            .from('smoking_products')
            .select('id, price, brand, name, flavor, stock');

        if (!allProducts || allProducts.length === 0) return null;

        const nameLower = (productName || '').toLowerCase().trim();
        const flavorLower = (flavor || '').toLowerCase().trim();

        // 1. Busca exata
        let match = allProducts.find(p => 
            (p.name || '').toLowerCase().includes(nameLower) && 
            (p.flavor || '').toLowerCase() === flavorLower
        );
        if (match) return match;

        // 2. Busca flexível de sabores (menthol/menta, watermelon/melancia)
        let searchFlavor = flavorLower;
        if (/menth|menta|mint/i.test(flavorLower)) searchFlavor = 'menta';
        if (/water|melan/i.test(flavorLower)) searchFlavor = 'melan';

        match = allProducts.find(p => 
            (p.name || '').toLowerCase().includes(nameLower) && 
            (p.flavor || '').toLowerCase().includes(searchFlavor)
        );
        if (match) return match;

        // 3. Fallback: match por modelo
        match = allProducts.find(p => (p.name || '').toLowerCase().includes(nameLower));
        return match || null;
    } catch (e) {
        return null;
    }
}

async function parseAndSaveOrder(senderNumber, contactName, messageText) {
    if (!messageText.startsWith('[PEDIDO-SMOKING]')) return null;
    
    try {
        const mainParts = messageText.replace('[PEDIDO-SMOKING]', '').trim().split('|');
        if (mainParts.length < 2) return null;
        
        const itemsStr = mainParts[0].trim();
        const itemsList = itemsStr.split(',').map(item => item.trim());
        const orderItems = [];

        for (const itemText of itemsList) {
            const match = itemText.match(/^(\d+)x\s+(.+?)\s*\((.+?)\)$/);
            if (match) {
                const quantity = parseInt(match[1]);
                const productName = match[2];
                const flavor = match[3];

                // Buscar produto com correspondência flexível
                const product = await findMatchingProduct(productName, flavor);

                orderItems.push({
                    product_id: product ? product.id : null,
                    name: product ? product.name : productName,
                    flavor: product ? product.flavor : flavor,
                    quantity: quantity,
                    price: product ? parseFloat(product.price) : 90.00
                });
            }
        }

        if (orderItems.length > 0) {
            latestCartItems[senderNumber] = orderItems;
            console.log(`🛒 [Cardápio Importado] ${orderItems.length} item(ns) salvos em memória temporária para ${senderNumber}.`);
            return true;
        }
        return null;
    } catch (err) {
        console.error('❌ Erro no processamento do carrinho:', err);
        return null;
    }
}

// =============================================
// GET PRIMARY COMPANY ID FROM SUPABASE
// =============================================
async function getPrimaryCompanyId() {
    try {
        const { data } = await supabase.from('companies').select('id').limit(1).maybeSingle();
        if (data && data.id) return data.id;
    } catch (e) {}
    return null;
}

// =============================================
// GET REAL STORE PIX KEY FROM SUPABASE / ENV
// =============================================
async function getStorePixKey() {
    try {
        const { data: scData } = await supabase.from('store_config').select('pix_key').limit(1).maybeSingle();
        if (scData && scData.pix_key && String(scData.pix_key).trim()) {
            return String(scData.pix_key).trim();
        }

        const { data: spData } = await supabase.from('smoking_products').select('flavor').eq('brand', '__STORE_CONFIG__').limit(1).maybeSingle();
        if (spData && spData.flavor) {
            try {
                const parsed = JSON.parse(spData.flavor);
                if (parsed && parsed.pix_key && String(parsed.pix_key).trim()) {
                    return String(parsed.pix_key).trim();
                }
            } catch (e) {}
        }
    } catch (err) {
        console.warn('⚠️ Erro ao carregar chave Pix do banco:', err);
    }
    return process.env.PIX_KEY || '11999999999 (Pix Loja)';
}

// =============================================
// HELPER: EXTRACT REAL ORDER ITEMS FROM CHAT CONVERSATION HISTORY
// =============================================
async function extractOrderItemsFromHistory(senderNumber) {
    try {
        const history = conversationHistory[senderNumber] || [];
        const fullText = history.map(h => h.content || '').join(' ').toLowerCase();

        const { data: products } = await supabase
            .from('smoking_products')
            .select('id, brand, name, flavor, price')
            .neq('brand', '__STORE_CONFIG__');

        if (!products || products.length === 0) return null;

        let matchedProduct = null;
        for (const p of products) {
            const nameStr = (p.name || '').toLowerCase();
            const flavorStr = (p.flavor || '').toLowerCase();

            if (nameStr && fullText.includes(nameStr)) {
                if (flavorStr && flavorStr !== 'padrão' && flavorStr !== 'padrao' && fullText.includes(flavorStr)) {
                    matchedProduct = p;
                    break;
                }
                if (!matchedProduct) matchedProduct = p;
            }
        }

        if (matchedProduct) {
            return [{
                product_id: matchedProduct.id,
                name: `${matchedProduct.brand} ${matchedProduct.name}`.trim(),
                flavor: matchedProduct.flavor || 'Sabor Selecionado',
                quantity: 1,
                price: parseFloat(matchedProduct.price) || 89.90
            }];
        }
    } catch (err) {
        console.warn('⚠️ Falha ao extrair produto do histórico da IA:', err.message);
    }
    return null;
}

// =============================================
// PROCESS COMPROVANTE & MOVE ORDER TO KANBAN (SEPARAÇÃO)
// =============================================
async function handleReceiptReceived(senderNumber, contactName, messageText, hasMedia) {
    try {
        const isReceiptText = /comprovante|paguei|fiz o pix|mandei o pix|transferi|depositei|pagamento feito|print/i.test(messageText || '');
        if (!hasMedia && !isReceiptText) return null;

        console.log(`🧾 [Comprovante] Recebido de ${senderNumber} (${contactName}). Atualizando/Gravando pedido para o Kanban...`);

        // 1. Buscar último pedido do cliente que ainda não foi concluído
        const { data: existingOrders } = await supabase
            .from('smoking_orders')
            .select('*')
            .eq('client_phone', senderNumber)
            .order('created_at', { ascending: false })
            .limit(1);

        if (existingOrders && existingOrders.length > 0) {
            const existingOrder = existingOrders[0];
            // Anexa a tag de comprovante mantendo o pedido na aba AGUARDANDO_PAGAMENTO para conferência manual do dono
            const { data: updated, error: updateErr } = await supabase
                .from('smoking_orders')
                .update({
                    payment_status: 'PENDENTE',
                    delivery_status: 'AGUARDANDO_PAGAMENTO',
                    receipt_url: 'COMPROVANTE_PIX_ENVIADO'
                })
                .eq('id', existingOrder.id)
                .select()
                .single();

            if (!updateErr) {
                console.log(`✅ Comprovante anexado ao pedido #${existingOrder.id} na aba AGUARDANDO_PAGAMENTO!`);
                return updated;
            }
        }

        // 3. Se não existia pedido gravado ainda, tenta sincronizar os dados reais do cliente
        return await syncWhatsAppOrderToKanbanAndDeductStock(senderNumber, contactName, messageText);
    } catch (err) {
        console.error('❌ Erro no handleReceiptReceived:', err);
        return null;
    }
}

// =============================================
// AUTO SYNC WHATSAPP ORDER TO KANBAN & DEDUCT STOCK
// =============================================
const latestQuotes = {};
const latestHouseNumbers = {};
const latestContactNames = {};
const latestFormattedPhones = {};

async function syncWhatsAppOrderToKanbanAndDeductStock(senderNumber, contactName, aiResponse) {
    try {
        const history = conversationHistory[senderNumber] || [];
        const fullHistoryText = history.map(h => typeof h.content === 'string' ? h.content : '').join(' ');

        // 1. Extrair nome real do cliente do histórico de mensagens ou perfil
        let clientName = null;
        for (let i = 0; i < history.length; i++) {
            const msg = history[i];
            if (msg.role === 'user' && typeof msg.content === 'string') {
                const nameMatch = msg.content.match(/(?:meu nome é|meu nome e|me chamo|sou o|sou a|aqui é o|aqui é a)\s+([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÓÔÕÚÇÑ\s]{2,30})/i);
                if (nameMatch) {
                    clientName = nameMatch[1].trim();
                    break;
                }
                const prevMsg = history[i - 1];
                if (prevMsg && prevMsg.role === 'assistant' && typeof prevMsg.content === 'string' && prevMsg.content.toLowerCase().includes('qual o seu nome')) {
                    const cleanResp = msg.content.replace(/[^\w\sÁ-ÿ]/gi, '').trim();
                    if (cleanResp.length >= 2 && cleanResp.length <= 30 && !/\d/.test(cleanResp)) {
                        clientName = cleanResp;
                        break;
                    }
                }
            }
        }

        if (!clientName) {
            let pName = latestContactNames[senderNumber] || (contactName && contactName !== 'Cliente WhatsApp' ? contactName : '');
            if (/^[\d\s+\-()]+$/.test(pName.trim())) {
                pName = '';
            }
            clientName = pName || 'Cliente WhatsApp';
        }

        // Determina telefone real formatado
        const displayPhone = latestFormattedPhones[senderNumber] || senderNumber;

        // 2. Determinar itens do pedido (do cardápio importado ou da conversa)
        let orderItems = latestCartItems[senderNumber] || [];

        if (orderItems.length === 0) {
            const { data: allProducts } = await supabase.from('smoking_products').select('*');
            if (allProducts && allProducts.length > 0) {
                for (const p of allProducts) {
                    const flavorLower = (p.flavor || '').toLowerCase();
                    if (flavorLower && fullHistoryText.toLowerCase().includes(flavorLower)) {
                        if (!orderItems.some(i => i.product_id === p.id)) {
                            orderItems.push({
                                product_id: p.id,
                                name: p.name || 'Pod',
                                flavor: p.flavor,
                                quantity: 1,
                                price: parseFloat(p.price || 90)
                            });
                        }
                    }
                }
            }
        }

        // VALIDAÇÃO 1: Deve conter pod e sabor real (não genérico)
        if (orderItems.length === 0 || orderItems.every(i => !i.flavor || i.flavor === 'Atendimento WhatsApp')) {
            console.log(`⚠️ [Kanban Gate] Sync cancelado: Nenhum produto/sabor identificado para ${senderNumber}.`);
            return null;
        }

        // Tenta vincular cada item do carrinho ao produto real do Supabase
        for (const item of orderItems) {
            if (!item.product_id) {
                const matchedP = await findMatchingProduct(item.name, item.flavor);
                if (matchedP) {
                    item.product_id = matchedP.id;
                    item.name = matchedP.name;
                    item.flavor = matchedP.flavor;
                    item.price = parseFloat(matchedP.price || item.price);
                }
            }
        }

        // 3. Extrair cotação de frete e número do endereço
        const storedQuote = latestQuotes[senderNumber];
        const storedNumber = latestHouseNumbers[senderNumber];

        // VALIDAÇÃO 2: Deve ter frete real e cotação de endereço
        if (!storedQuote || !storedQuote.address || typeof storedQuote.fee !== 'number' || storedQuote.fee <= 0) {
            console.log(`⚠️ [Kanban Gate] Sync cancelado: Cotação de frete indisponível para ${senderNumber}.`);
            return null;
        }

        const shippingFee = storedQuote.fee;
        const baseAddr = storedQuote.address || '';
        const cepStr = storedQuote.cep ? `, CEP: ${storedQuote.cep}` : '';
        const numStr = storedNumber ? `, Nº ${storedNumber}` : '';
        const shippingAddress = `${baseAddr}${numStr}${cepStr}`;

        // VALIDAÇÃO 3: Endereço deve ter rua/bairro e número (não pode ser "Aguardando CEP" ou incompleto)
        if (shippingAddress.includes('Aguardando CEP') || shippingAddress.length < 10) {
            console.log(`⚠️ [Kanban Gate] Sync cancelado: Endereço incompleto (${shippingAddress}) para ${senderNumber}.`);
            return null;
        }

        const itemsTotal = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        // 4. Grava/Atualiza Cliente em smoking_clients
        const companyId = await getPrimaryCompanyId();
        const clientPayload = {
            phone: displayPhone,
            name: clientName,
            address: shippingAddress,
            created_at: new Date().toISOString()
        };
        if (companyId) clientPayload.company_id = companyId;

        await supabase
            .from('smoking_clients')
            .upsert(clientPayload, { onConflict: 'phone' });

        // 5. Se houver um pedido na aba "AGUARDANDO_PAGAMENTO", atualiza os dados dele.
        // Caso o pedido anterior já esteja em "PREPARANDO", "EM_ROTA" ou "ENTREGUE", cria um NOVO pedido separado!

        const { data: existingOrders } = await supabase
            .from('smoking_orders')
            .select('id')
            .or(`client_phone.eq.${senderNumber},client_phone.eq.${displayPhone}`)
            .eq('delivery_status', 'AGUARDANDO_PAGAMENTO')
            .order('created_at', { ascending: false })
            .limit(1);

        let orderId = null;
        if (existingOrders && existingOrders.length > 0) {
            orderId = existingOrders[0].id;
            const { error: updateErr } = await supabase
                .from('smoking_orders')
                .update({
                    client_name: clientName,
                    client_phone: displayPhone,
                    shipping_address: shippingAddress,
                    items: orderItems,
                    total_amount: itemsTotal + shippingFee,
                    shipping_fee: shippingFee,
                    payment_status: 'PENDENTE',
                    delivery_status: 'AGUARDANDO_PAGAMENTO',
                    order_source: 'WHATSAPP',
                    payment_method: 'PIX'
                })
                .eq('id', orderId);

            if (updateErr) {
                console.error(`❌ Erro ao atualizar pedido no Supabase:`, updateErr.message);
            }
        } else {
            const { data: newOrder, error: insertErr } = await supabase
                .from('smoking_orders')
                .insert({
                    company_id: companyId,
                    client_phone: displayPhone,
                    client_name: clientName,
                    shipping_address: shippingAddress,
                    items: orderItems,
                    total_amount: itemsTotal + shippingFee,
                    shipping_fee: shippingFee,
                    payment_status: 'PENDENTE',
                    delivery_status: 'AGUARDANDO_PAGAMENTO',
                    order_source: 'WHATSAPP',
                    payment_method: 'PIX'
                })
                .select()
                .single();

            if (insertErr) {
                console.error(`❌ Erro ao inserir pedido no Supabase:`, insertErr.message);
            }
            if (newOrder) orderId = newOrder.id;
        }

        console.log(`🛒 [Kanban WhatsApp] Pedido #${orderId} registrado na aba "AGUARDANDO_PAGAMENTO"! Cliente: ${clientName} | Frete: R$ ${shippingFee.toFixed(2)} | Endereço: ${shippingAddress}`);

        // 6. A baixa de estoque é realizada 100% via Trigger SQL (trg_stock_on_order_insert) no Supabase ao inserir em smoking_orders.
        // O loop manual em JS foi desativado para evitar baixa dupla (conflito histórico corrigido).
        /*
        for (const item of orderItems) {
            if (item.product_id) {
                const { data: p } = await supabase
                    .from('smoking_products')
                    .select('id, stock, name, flavor')
                    .eq('id', item.product_id)
                    .single();

                if (p) {
                    const currentStock = typeof p.stock === 'number' ? p.stock : parseInt(String(p.stock || '0'), 10);
                    const newStock = Math.max(0, currentStock - (item.quantity || 1));
                    await supabase
                        .from('smoking_products')
                        .update({ stock: newStock })
                        .eq('id', p.id);
                    console.log(`📉 [Estoque Dedução] "${p.name} - ${p.flavor}": ${currentStock} -> ${newStock}`);
                }
            }
        }
        */

        return orderId;
    } catch (err) {
        console.error('❌ Erro no syncWhatsAppOrderToKanbanAndDeductStock:', err);
        return null;
    }
}

// =============================================
// DETECT FOLLOW-UP TRIGGERS IN AI RESPONSE
// =============================================
function detectFollowUpTriggers(chatId, aiResponse) {
    const lower = aiResponse.toLowerCase();
    
    // Detect table/cardápio sent
    if (lower.includes('smoking-pods-catalogo.vercel.app')) {
        scheduleTableFollowUp(chatId);
    }
    
    // Detect Pix key sent (payment flow started) -> apenas agenda follow-ups de pagamento
    if (lower.includes('chave pix') || lower.includes('chave pix :') || lower.includes('assim que fizer o pagamento')) {
        schedulePaymentFollowUp(chatId);
    }

    // =============================================
    // GATILHO DO KANBAN: Só envia para o painel quando a Eloísa
    // pergunta a forma de pagamento — momento em que ela JÁ tem:
    // marca/modelo/sabor + nome + endereço completo com CEP e número + frete.
    // =============================================
    const isPaymentMethodQuestion = 
        lower.includes('forma de pagamento') ||
        lower.includes('qual seria a forma') ||
        lower.includes('como vc prefere pagar') ||
        lower.includes('qual a forma de pagamento');

    if (isPaymentMethodQuestion) {
        console.log(`✅ [Kanban Gate] Pergunta de forma de pagamento detectada para ${chatId}. Processando envio ao Kanban com dados críticos...`);
        syncWhatsAppOrderToKanbanAndDeductStock(chatId, 'Cliente WhatsApp', aiResponse);
    }
}

// =============================================
// MESSAGE HANDLER (Chatbot IA Desativado - Atendimento 100% Humano)
// =============================================
client.on('message_create', async msg => {
    // Avoid status broadcasts
    if (msg.from === 'status@broadcast') return;

    // Detect and catalog WhatsApp groups for the Marketing module
    if (msg.from && msg.from.endsWith('@g.us')) {
        try {
            const grpId = msg.from;
            if (!detectedGroups[grpId]) {
                detectedGroups[grpId] = {
                    id: grpId,
                    name: 'Grupo VIP WhatsApp',
                    unreadCount: 0,
                    participantsCount: 0
                };
                client.getChatById(grpId).then(c => {
                    if (c && c.name) detectedGroups[grpId].name = c.name;
                }).catch(() => {});
            }
        } catch (e) {}
        return;
    }

    // 🛑 CHATBOT ELOISA IA DESATIVADO:
    // As mensagens recebidas no WhatsApp não acionam IA nem respostas automáticas.
    // O atendimento é realizado 100% manualmente pelo operador humano.
});

// =============================================
// CORE MESSAGE PROCESSING (after debounce)
// =============================================
async function processMessage(msg, senderNumber, chatId, messageText, accumulatedHasMedia) {
    // Guard: prevent concurrent processing for same chat
    if (processingChats.has(chatId)) {
        console.log(`⚡️ Ignorando mensagem concorrente de ${senderNumber}`);
        return;
    }
    processingChats.add(chatId);

    try {
        let chat = null;
        let contact = null;
        try {
            chat = await msg.getChat();
        } catch (e) {
            console.warn('⚠️ msg.getChat indisponível (usando fallback seguro):', e.message);
        }
        try {
            contact = await msg.getContact();
        } catch (e) {
            console.warn('⚠️ msg.getContact indisponível:', e.message);
        }
        
        // --- SILÊNCIO PÓS-COMPROVANTE ---
        // Se o cliente já enviou o comprovante e o pedido foi finalizado, a IA silencia para que a equipe atenda se necessário
        if (silentChats.has(senderNumber)) {
            console.log(`🔕 [Silêncio Pós-Comprovante] Mensagem de ${senderNumber} ignorada pela IA pois o pedido já foi concluído.`);
            return;
        }

        // Check if this is the first message ever from this client
        const isFirstMessage = !conversationHistory[senderNumber];

        // =============================================
        // TRATAMENTO DE PERGUNTA DE HORÁRIO / ESTÃO ABERTOS
        // =============================================
        const isAskingAboutHours = /\b(est[aã]o abertos|t[aã]o abertos|abertos|t[aã]o atendendo|est[aã]o atendendo|que horas abrem|qual o hor[aá]rio|hor[aá]rio de funcionamento)\b/i.test(messageText);

        if (isAskingAboutHours) {
            if (!isOutOfHours()) {
                // Dentro do horário comercial (13:30 às 23:00)
                const openMessages = [
                    'estamos abertos sim amg!',
                    'nosso funcionamento é das 13:30 até as 23hrs, como posso te ajudar?'
                ];
                initConversation(senderNumber);
                conversationHistory[senderNumber].push(
                    { role: 'user', content: messageText },
                    { role: 'assistant', content: openMessages.join('\n') }
                );
                await sendSequentialMessages(chat, msg, openMessages, chatId, isFirstMessage);
                return;
            } else {
                // Fora do horário comercial
                reservationMode.add(chatId);
                const closedMessages = [
                    'estamos fora do horário de serviço no momento, nosso funcionamento é das 13:30 até as 23hrs',
                    'porém caso queira deixar o seu pedido reservado para o horário mais próximo de funcionamento estamos disponíveis para reserva'
                ];
                initConversation(senderNumber);
                conversationHistory[senderNumber].push(
                    { role: 'user', content: messageText },
                    { role: 'assistant', content: closedMessages.join('\n') }
                );
                await sendSequentialMessages(chat, msg, closedMessages, chatId, isFirstMessage);
                return;
            }
        }

        // =============================================
        // CODE-008: OUT-OF-HOURS DETECTION
        // =============================================
        if (isFirstMessage && isOutOfHours()) {
            reservationMode.add(chatId);

            const outOfHoursMessages = [
                'estamos fora do horário de serviço no momento, nosso funcionamento é das 13:30 até as 23hrs',
                'porém caso queira deixar o seu pedido reservado para o horário mais próximo de funcionamento estamos disponíveis para reserva'
            ];

            // Initialize conversation history so next message won't be "first"
            initConversation(senderNumber);
            conversationHistory[senderNumber].push(
                { role: 'user', content: messageText },
                { role: 'assistant', content: outOfHoursMessages.join('\n') }
            );

            await sendSequentialMessages(chat, msg, outOfHoursMessages, chatId, true);
            return;
        }

        // --- DETECÇÃO DE NOVO PEDIDO DO CARDÁPIO ---
        const pushName = (contact && contact.pushname) ? contact.pushname : 'Cliente';
        if (messageText.startsWith('[PEDIDO-SMOKING]')) {
            const orderId = await parseAndSaveOrder(senderNumber, pushName, messageText);
            if (orderId) {
                initConversation(senderNumber);
                conversationHistory[senderNumber].push({
                    role: "system",
                    content: `[SISTEMA: O cliente enviou itens para o carrinho (ID ${orderId}). Confirme os itens com o mesmo estilo descontraído. ATENÇÃO: Se você JÁ anotou o CEP/Endereço deste cliente, NÃO repita a pergunta de CEP (P30) e NÃO pergunte se é no mesmo endereço. Assuma que é o mesmo. Se ainda não tem o endereço, peça o CEP normalmente.]`
                });
            }
        }

        // --- DETECÇÃO E GRAVAÇÃO DE COMPROVANTE NO KANBAN ---
        const receiptOrder = await handleReceiptReceived(senderNumber, pushName, messageText, accumulatedHasMedia || msg.hasMedia);
        if (receiptOrder) {
            const receiptReplyMessages = [
                'perfeito, recebi seu comprovante!',
                'seu pedido já foi enviado pro nosso painel de separação, o gerente vai conferir o pix e já liberamos o envio amg'
            ];

            initConversation(senderNumber);
            conversationHistory[senderNumber].push(
                { role: 'user', content: messageText },
                { role: 'assistant', content: receiptReplyMessages.join('\n') }
            );

            await sendSequentialMessages(chat, msg, receiptReplyMessages, chatId, true);

            // Marca para a IA ficar em silêncio com este cliente após a mensagem de confirmação
            silentChats.add(senderNumber);

            // Agenda o reset automático de 4 horas para esta conversa
            if (autoResetTimers.has(senderNumber)) {
                clearTimeout(autoResetTimers.get(senderNumber));
            }
            const timerId = setTimeout(() => {
                delete conversationHistory[senderNumber];
                silentChats.delete(senderNumber);
                autoResetTimers.delete(senderNumber);
                console.log(`⏱️ [Auto-Reset 4h] Histórico da conversa de ${senderNumber} resetado automaticamente após 4 horas.`);
            }, 4 * 60 * 60 * 1000); // 4 horas em ms
            autoResetTimers.set(senderNumber, timerId);

            return; // Encerra atendimento da IA para esta conversa
        }

        // --- DETECÇÃO CONTEXTUAL DE CEP OU ENDEREÇO ---
        let needsShippingCalculation = false;
        let addressToCalculate = messageText;

        // CODE-009: Skip freight calculation if in reservation mode
        if (reservationMode.has(chatId)) {
            needsShippingCalculation = false;
            // Inject reservation-mode freight message instead
            const cepMatch = messageText.match(/\b\d{5}-?\d{3}\b/);
            const history = conversationHistory[senderNumber];
            let clientSentAddress = !!cepMatch;
            
            if (!clientSentAddress && history && history.length > 0) {
                const lastAssistantMsg = history[history.length - 1];
                if (lastAssistantMsg.role === 'assistant') {
                    const lastText = lastAssistantMsg.content.toLowerCase();
                    const askedForAddress = lastText.includes('preciso do seu endereço') || 
                                            lastText.includes('enviar o cep ao invés') || 
                                            lastText.includes('me passa o endereço completo') || 
                                            lastText.includes('qual seria o número') ||
                                            lastText.includes('qual seria o bairro');
                    const isCardapioOrder = messageText.includes('[PEDIDO-SMOKING]');
                    const isTooShort = messageText.length < 5;
                    if (askedForAddress && !isCardapioOrder && !isTooShort) {
                        clientSentAddress = true;
                    }
                }
            }

            if (clientSentAddress) {
                initConversation(senderNumber);
                conversationHistory[senderNumber].push({
                    role: "system",
                    content: `[SISTEMA: O cliente enviou um endereço/CEP, mas estamos fora do horário de funcionamento (modo reserva). NÃO calcule o frete. Informe: "infelizmente não posso calcular seu frete hoje, somente no horário da entrega, pois por conta do horário pode variar os valores". Continue o fluxo normalmente sem frete.]`
                });
            }
        } else {
            // Normal hours — detect address/CEP strictly (prevent treating questions like 'qual o valor dele?' as addresses)
            const cepMatch = messageText.match(/\b\d{5}-?\d{3}\b/);
            const containsStreetKeywords = /\b(rua|r\.|av\.|avenida|alameda|pra[çc]a|travessa|estrada|rodovia|bairro)\b/i.test(messageText);
            const isQuestionOrInquiry = /\b(qual|quanto|quantos|tem|quais|como|por quanto|desconto|pre[çc]o|valor)\b/i.test(messageText) || messageText.includes('?');

            if (cepMatch) {
                needsShippingCalculation = true;
                addressToCalculate = cepMatch[0];
            } else if (containsStreetKeywords && !isQuestionOrInquiry) {
                needsShippingCalculation = true;
                addressToCalculate = messageText;
            } else {
                // Se já temos a cotação armazenada e a mensagem contém números/complemento, guarda o número da casa
                if (latestQuotes[senderNumber] && !isQuestionOrInquiry && /\d+/.test(messageText)) {
                    latestHouseNumbers[senderNumber] = messageText;
                }
                needsShippingCalculation = false;
            }
        }

        // CODE-004: Fixed shipping system message — no spontaneous free shipping mention
        if (needsShippingCalculation) {
            try {
                const quote = await calculateShippingQuote(addressToCalculate);
                latestQuotes[senderNumber] = quote;
                
                initConversation(senderNumber);
                conversationHistory[senderNumber].push({
                    role: "system",
                    content: `[SISTEMA: O CEP/Endereço do cliente foi localizado como "${quote.address}". O frete via Uber Direct é de R$ ${quote.fee.toFixed(2).replace('.', ',')} (${quote.distanceKm} km).` +
                        `\n\nINSTRUÇÕES OBRIGATÓRIAS DE ENDEREÇO E FRETE:` +
                        `\n1. SE O CLIENTE ENVIOU O CEP/RUA AGORA:` +
                        `   - Responda apenas confirmando a rua/bairro/cidade e peça o número: "ahh sim, localizei aqui amg! o seu endereço é esse né: ${quote.address}?" [QUEBRA] "qual o número do seu endereço amg? tem algum complemento?"` +
                        `   - É PROIBIDO INFORMAR O FRETE OU O TOTAL NESTA MENSAGEM! PARE A RESPOSTA E ESPERE O CLIENTE MANDAR O NÚMERO!` +
                        `\n2. QUANDO O CLIENTE RESPONDER O NÚMERO E COMPLEMENTO (ex: "é 300 sem complemento", "156 C"):` +
                        `   - Responda informando SOMENTE O FRETE e pergunte a forma de pagamento: "tá bom amg, o valor do frete ficou ${quote.fee.toFixed(2).replace('.', ',')}. qual seria a forma de pagamento?"` +
                        `   - É PROIBIDO INFORMAR O VALOR TOTAL DO PEDIDO NESTE MOMENTO! PERGUNTE APENAS A FORMA DE PAGAMENTO!` +
                        `\n3. QUANDO O CLIENTE RESPONDER A FORMA DE PAGAMENTO (ex: "pix", "no pix"):` +
                        `   - PROIBIDO DIGITAR "msg1:", "msg2:" OU "msg3:" NA SUA RESPOSTA!` +
                        `   perfeito amg, então o valor total ficou [total_com_frete]!` +
                        `   [QUEBRA]` +
                        `   nossa chave pix é: [CHAVE_PIX_DA_LOJA]` +
                        `   [QUEBRA]` +
                        `   assim que fizer o pagamento me manda o comprovante aqui tá?`
                });
                console.log(`🚗 Cotação de frete injetada para ${senderNumber}: R$ ${quote.fee.toFixed(2)}`);
            } catch (err) {
                console.error('❌ Falha ao injetar cotação de frete:', err);
            }
        }

        // =============================================
        // Get AI response (processed dynamically by OpenAI using the prompt)
        // =============================================
        let aiResponse = await getAiResponse(senderNumber, messageText);
        let isHardcodedResponse = false;

        // =============================================
        // CODE-003: Emoji removal — ONLY on AI-generated responses
        // =============================================
        if (aiResponse && !isHardcodedResponse) {
            aiResponse = aiResponse.replace(emojiRegex, '').trim();
            if (aiResponse === '[IGNORAR]') {
                aiResponse = null; // Do not send anything
            }
        }

        // =============================================
        // CODE-004: O Filtro Assassino (Arranca frases de call center)
        // =============================================
        if (aiResponse && !isHardcodedResponse && !isFirstMessage && !/^(olá tudo bem|opa, que bom ver)/i.test(aiResponse)) {
            // Regex agressiva para pegar qualquer variação de "posso ajudar?", "alguma dúvida?", "se precisar de algo" no final da frase
            const callCenterRegex = /(?:[.,!?;]\s*)?(?:e\s+|mas\s+|por[ée]m\s+)?(?:voc[êe]\s+)?(?:precisa|quer|posso|tem|alguma|mais|em que|se precisar).*(?:ajuda|ajudar|d[úu]vida|auxiliar|algo|mais alguma coisa|avisar).*?\??$/gi;
            
            aiResponse = aiResponse.replace(callCenterRegex, '');
            
            aiResponse = aiResponse.trim();
            // Preserva pontuação legítima de interrogação da tabela digital
            if (aiResponse.toLowerCase().includes('posso enviar nossa tabela digital')) {
                if (!aiResponse.endsWith('?')) {
                    aiResponse = aiResponse.replace(/[,.!;]+$/, '') + '?';
                }
            } else {
                aiResponse = aiResponse.replace(/[,.!?;]+$/, ''); // Limpeza de pontuacao solta no final
            }

            if (aiResponse.length === 0) {
                aiResponse = null;
            }
        }

        // =============================================
        // INTEGRAÇÃO DE PAGAMENTOS: Pix e Mercado Pago
        // =============================================
        if (aiResponse) {
            const realPixKey = await getStorePixKey();
            aiResponse = aiResponse
                .replaceAll('[chave_pix_real]', realPixKey)
                .replaceAll('[CHAVE PIX CNPJ / ALEATÓRIA DA LOJA]', realPixKey)
                .replaceAll('[CHAVE PIX CNPJ/ALEATÓRIA DA LOJA]', realPixKey)
                .replaceAll('[CHAVE PIX]', realPixKey)
                .replaceAll('[chave_pix]', realPixKey);

            if (aiResponse.includes('[link_do_checkout]')) {
                // Tenta extrair o valor total da mensagem gerada pela IA (ex: total de R$ 110,50)
                const match = aiResponse.match(/total de R\$?\s*(\d+[,.]\d+)/i);
                let rawTotal = 0;
                
                if (match) {
                    rawTotal = parseFloat(match[1].replace(',', '.'));
                } else {
                    console.warn(`⚠️ Não foi possível extrair o total da msg para o MP: ${aiResponse}`);
                    rawTotal = 0.00;
                }

                // Gera o link caso o total seja válido
                if (rawTotal > 0) {
                    const { generatePaymentLink } = require('./paymentService');
                    const checkoutUrl = await generatePaymentLink(rawTotal, `WP_${senderNumber}`);
                    aiResponse = aiResponse.replace('[link_do_checkout]', checkoutUrl);
                } else {
                    aiResponse = aiResponse.replace('[link_do_checkout]', '(Erro: Valor do pedido não encontrado para gerar o link)');
                }
            }
        }

        // Send response to WhatsApp
        if (aiResponse) {
            // Split response on [QUEBRA] or newlines
            const messagesArray = aiResponse
                .split(/(?:\[QUEBRA\]|\n+)/i)
                .map(line => line.trim())
                .filter(line => line.length > 0);

            if (messagesArray.length > 0) {
                // Detect follow-up triggers before sending
                detectFollowUpTriggers(chatId, aiResponse);

                await sendSequentialMessages(chat, msg, messagesArray, chatId, isFirstMessage);
            } else {
                processingChats.delete(chatId);
            }
        } else {
            processingChats.delete(chatId);
        }
    } catch (err) {
        console.error('❌ Erro no handler de mensagem:', err);
        processingChats.delete(chatId);
    }
}

// =============================================
// CODE-005: WEBHOOK — Fixed dispatch message per script P41/P42
// =============================================
app.post('/api/webhook/dispatch', async (req, res) => {
    try {
        const { orderId, clientPhone, deliveryType, trackingLink } = req.body;
        
        if (!clientPhone) {
            return res.status(400).json({ error: 'Telefone do cliente é obrigatório.' });
        }

        const formattedNumber = `${clientPhone.replace(/\D/g, '')}@c.us`;
        
        // Script P41/P42: exact messages from the script
        const msg1 = 'seu pedido já saiu para entrega!';
        const msg2 = trackingLink || '[link de rastreio será enviado em breve]';

        // Send both messages sequentially with typing simulation
        const chat = await client.getChatById(formattedNumber);

        await chat.sendStateTyping();
        await new Promise(resolve => setTimeout(resolve, 5000));
        await client.sendMessage(formattedNumber, msg1);
        await chat.clearState();

        await new Promise(resolve => setTimeout(resolve, 4000));

        await chat.sendStateTyping();
        await new Promise(resolve => setTimeout(resolve, 5000));
        await client.sendMessage(formattedNumber, msg2);
        await chat.clearState();

        console.log(`🚀 [Webhook] Mensagem de despacho enviada para ${formattedNumber}`);
        res.json({ success: true, message: 'Mensagem de despacho enviada pelo WhatsApp.' });
    } catch (error) {
        console.error('❌ Erro no webhook de despacho:', error);
        res.status(500).json({ error: 'Falha ao enviar mensagem.' });
    }
});

// =============================================
// MARKETING: LISTAR CONTATOS DA AGENDA E GRUPOS DO WHATSAPP
// =============================================
app.get('/api/marketing/whatsapp-data', async (req, res) => {
    try {
        if (!isWhatsAppReady || !client) {
            return res.status(503).json({ 
                error: 'WhatsApp não está conectado.',
                isReady: false,
                contacts: [],
                groups: []
            });
        }

        console.log('🔄 [Marketing] Buscando contatos e grupos reais da agenda do WhatsApp...');
        
        // 1. Puxa todos os contatos salvos no chip
        let rawContacts = [];
        try {
            rawContacts = await client.getContacts();
        } catch (e) {
            console.warn('Aviso ao buscar contatos:', e.message);
        }

        const seenPhones = new Set();
        const contacts = rawContacts
            .filter(c => {
                if (!c || !c.id || !c.id.user || c.isGroup || c.isEnterprise) return false;
                if (!c.name && !c.isMyContact) return false;
                if (c.id.user.length < 8) return false;
                const phone = c.id.user;
                if (seenPhones.has(phone)) return false;
                seenPhones.add(phone);
                return true;
            })
            .map(c => {
                const phone = c.id.user || '';
                const name = c.name || c.pushname || c.shortName || `Contato ${phone.slice(-4)}`;
                return {
                    id: c.id._serialized || `${phone}@c.us`,
                    phone,
                    name,
                    isSaved: !!c.name,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        // 2. Extração 100% NATIVA e REAL dos grupos a partir dos contatos do WhatsApp (onde isGroup === true)
        const seenGroups = new Set();
        const groups = rawContacts
            .filter(c => {
                if (!c || !c.id) return false;
                const isGroupJid = c.isGroup || c.id.server === 'g.us' || String(c.id._serialized || '').endsWith('@g.us');
                return isGroupJid;
            })
            .map(c => {
                const idStr = c.id._serialized || `${c.id.user}@g.us`;
                const groupName = c.name || c.formattedTitle || c.subject || c.pushname || 'Grupo WhatsApp';
                return {
                    id: idStr,
                    name: groupName,
                    unreadCount: 0,
                    participantsCount: 0
                };
            })
            .filter(g => {
                if (seenGroups.has(g.id) || !g.name || g.name === 'Grupo WhatsApp') return false;
                seenGroups.add(g.id);
                return true;
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        // Se ainda vazio, inclui grupos detectados por mensagens recebidas recentemente
        if (typeof detectedGroups !== 'undefined') {
            Object.values(detectedGroups).forEach(dg => {
                if (!groups.some(g => g.id === dg.id)) {
                    groups.push(dg);
                }
            });
        }

        console.log(`✅ [Marketing] Encontrados ${contacts.length} contatos e ${groups.length} grupos no WhatsApp.`);

        return res.json({
            isReady: true,
            contactsCount: contacts.length,
            groupsCount: groups.length,
            contacts,
            groups
        });
    } catch (err) {
        console.error('❌ Erro ao buscar dados do WhatsApp para marketing:', err);
        return res.status(500).json({ error: 'Erro ao buscar dados do WhatsApp.', details: err.message });
    }
});

// =============================================
// SEGURANÇA E CONTROLE DA IA ELOISA (ADMIN API)
// =============================================

// Status geral do Bot (Master Switch, Silenciados e Blacklist)
app.get('/api/chatbot/security-status', (req, res) => {
    const silencedList = [];
    const now = Date.now();
    for (const [phone, expiry] of silencedChatsMap.entries()) {
        if (now < expiry) {
            silencedList.push({
                phone,
                remainingMinutes: Math.ceil((expiry - now) / 60000),
                expiresAt: new Date(expiry).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            });
        } else {
            silencedChatsMap.delete(phone);
        }
    }

    // Exibe apenas a versão canônica (com 55) dos números no painel para não duplicar visualmente
    const displayBlacklist = Array.from(blacklistPhonesSet)
        .filter(p => p.startsWith('55') || !blacklistPhonesSet.has(`55${p}`));

    return res.json({
        isEloisaAiActive,
        isWhatsAppReady,
        silencedChats: silencedList,
        blacklist: displayBlacklist
    });
});

// Master Switch: Liga / Desliga Atendimento Automático Geral
app.post('/api/chatbot/toggle-master', (req, res) => {
    const { active } = req.body;
    if (typeof active === 'boolean') {
        isEloisaAiActive = active;
    } else {
        isEloisaAiActive = !isEloisaAiActive;
    }
    console.log(`🛡️ [Master Switch] Eloisa IA agora está: ${isEloisaAiActive ? '🟢 ATIVA' : '🔴 PAUSADA'}`);
    return res.json({ success: true, isEloisaAiActive });
});

// Forçar Silenciamento Manual ou Des-silenciamento de um Chat (Padrão 4 Horas)
app.post('/api/chatbot/silence-chat', (req, res) => {
    const { phone, durationHours = 4, action = 'silence' } = req.body;
    if (!phone) return res.status(400).json({ error: 'Telefone obrigatório.' });
    
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (action === 'resume') {
        silencedChatsMap.delete(cleanPhone);
        silencedChatsMap.delete(phone);
        console.log(`▶️ [Human Takeover] Atendimento da Eloisa retomado manualmente para ${cleanPhone}`);
        return res.json({ success: true, message: 'Chat reativado para a IA.' });
    } else {
        const expiry = Date.now() + (durationHours * 60 * 60 * 1000);
        silencedChatsMap.set(cleanPhone, expiry);
        console.log(`🤫 [Human Takeover] Chat ${cleanPhone} silenciado manualmente por ${durationHours}h.`);
        return res.json({ success: true, message: `Chat silenciado por ${durationHours}h.` });
    }
});

// Adicionar / Remover Número da Blacklist
app.post('/api/chatbot/blacklist', (req, res) => {
    const { phone, action = 'add' } = req.body;
    if (!phone) return res.status(400).json({ error: 'Telefone obrigatório.' });
    
    const rawClean = String(phone).replace(/\D/g, '');
    const canonicalPhone = rawClean.startsWith('55') ? rawClean : `55${rawClean}`;
    const shortPhone = canonicalPhone.startsWith('55') ? canonicalPhone.slice(2) : canonicalPhone;

    if (action === 'remove') {
        blacklistPhonesSet.delete(canonicalPhone);
        blacklistPhonesSet.delete(shortPhone);
        blacklistPhonesSet.delete(phone);
        saveBlacklistToDisk();
        console.log(`🟢 [Blacklist] ${canonicalPhone} removido da lista de contatos ignorados.`);
    } else {
        blacklistPhonesSet.add(canonicalPhone);
        blacklistPhonesSet.add(shortPhone);
        blacklistPhonesSet.add(phone);
        saveBlacklistToDisk();
        console.log(`🚫 [Blacklist] ${canonicalPhone} adicionado à lista de contatos ignorados.`);
    }

    const displayBlacklist = Array.from(blacklistPhonesSet)
        .filter(p => p.startsWith('55') || !blacklistPhonesSet.has(`55${p}`));

    return res.json({ success: true, blacklist: displayBlacklist });
});
app.post('/api/marketing/send-direct', async (req, res) => {
    try {
        const { phone, name, text, campaignId } = req.body;
        
        if (!phone || !text) {
            return res.status(400).json({ error: 'Telefone e texto da mensagem são obrigatórios.' });
        }

        const config = loadMarketingConfig();
        const rawPhone = String(phone).replace(/\D/g, '');
        const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;

        // 🛡️ TRAVA RÍGIDA ANTI-DUPLICAÇÃO: Checa se o contato já foi enviado
        if (campaignId && isPhoneAlreadySent(campaignId, cleanPhone, config)) {
            console.warn(`🛑 [Marketing Blindagem] Disparo IGNORADO para ${cleanPhone} (${name || 'Cliente'}). Este contato já recebeu a campanha "${campaignId}".`);
            return res.json({ 
                success: true, 
                skipped: true, 
                reason: 'Contato já recebeu esta campanha anteriormente. Disparo bloqueado por proteção de segurança anti-ban.' 
            });
        }

        if (!isWhatsAppReady || !client) {
            return res.status(503).json({ error: 'WhatsApp não está conectado no momento.' });
        }

        let formattedNumber = '';
        if (String(phone).includes('chat.whatsapp.com/')) {
            try {
                const inviteCode = String(phone).split('chat.whatsapp.com/')[1].trim().split('?')[0];
                const groupChat = await client.acceptInvite(inviteCode);
                formattedNumber = groupChat || `${inviteCode}@g.us`;
            } catch (invErr) {
                console.warn('⚠️ Não foi possível resolver convite de grupo:', invErr.message);
                formattedNumber = phone;
            }
        } else if (String(phone).includes('@g.us') || String(phone).includes('@c.us')) {
            formattedNumber = String(phone);
        } else {
            formattedNumber = `${cleanPhone}@c.us`;
        }

        console.log(`📢 [Marketing] Enviando mensagem personalizada para ${formattedNumber} (${name || 'Cliente'})...`);

        // 🛡️ Simulação humana garantida: Digitando... entre 12 e 18 segundos OBRIGATÓRIOS
        const typingDurationMs = Math.floor(Math.random() * 6000) + 12000;
        try {
            const chat = await client.getChatById(formattedNumber);
            if (chat) {
                await chat.sendStateTyping();
            }
        } catch (chatErr) {}

        // Delay obrigatório inegociável
        await new Promise(resolve => setTimeout(resolve, typingDurationMs));

        await client.sendMessage(formattedNumber, text);

        try {
            const chat = await client.getChatById(formattedNumber);
            if (chat) await chat.clearState();
        } catch (chatErr) {}

        // 🛡️ Grava imediatamente no JSON para que nunca mais se repita
        if (campaignId && cleanPhone) {
            markPhoneAsSent(campaignId, cleanPhone, config);
            saveMarketingConfig(config);
        }

        console.log(`✅ [Marketing] Mensagem entregue com sucesso para ${formattedNumber}`);
        return res.json({ success: true, message: 'Mensagem de marketing enviada com sucesso!' });
    } catch (error) {
        console.error('❌ Erro no envio de marketing:', error);
        return res.status(500).json({ error: error.message || 'Falha ao enviar mensagem de marketing.' });
    }
});

// ============================================================
// ENDPOINT: ZERAR HISTÓRICO DE CONVERSAS DA IA / WHATSAPP
// ============================================================
app.post('/api/chat/reset-history', (req, res) => {
    try {
        console.log('🧹 [API] Comando recebido: Zerar histórico de conversas da IA...');
        
        // 1. Limpa todas as conversas gravadas em memória no ai_agent
        Object.keys(conversationHistory).forEach(phone => {
            delete conversationHistory[phone];
        });

        // 2. Cancela e limpa todos os timers e pendências ativas no servidor
        processingChats.clear();
        debounceTimers.forEach(timer => clearTimeout(timer));
        debounceTimers.clear();
        pendingMessages.clear();
        
        pendingFollowUps.forEach(followUp => {
            if (followUp && followUp.timers) {
                followUp.timers.forEach(t => clearTimeout(t));
            }
        });
        pendingFollowUps.clear();
        reservationMode.clear();
        aiSentMessages.clear();
        silentChats.clear();
        autoResetTimers.forEach(t => clearTimeout(t));
        autoResetTimers.clear();

        console.log('✅ Histórico de conversas do WhatsApp e memórias ativas zerados com sucesso!');
        res.json({ success: true, message: 'Histórico de conversas da IA zerado com sucesso!' });
    } catch (err) {
        console.error('❌ Erro ao zerar histórico da IA:', err);
        res.status(500).json({ error: 'Falha ao zerar histórico da IA.' });
    }
});
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

        console.log(`✅ [CRM API] Metadados de CRM atualizados para ${formattedPhone}`);
        return res.json({ success: true, data });
    } catch (err) {
        console.error('❌ Erro no update do CRM:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ============================================================
// MARKETING AUTOMATION: PERSISTÊNCIA DE CAMPANHAS + SCHEDULER
// ============================================================

const MARKETING_CONFIG_PATH = path.join(__dirname, 'data', 'marketing_config.json');

// Helper: Carrega configuração de marketing do arquivo JSON
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

// Helper: Salva configuração de marketing no arquivo JSON
function saveMarketingConfig(config) {
    try {
        config.lastUpdated = new Date().toISOString();
        if (!config.sentHistory) config.sentHistory = { globalSent: [] };
        fs.writeFileSync(MARKETING_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
        console.error('❌ [Marketing] Erro ao salvar config:', err.message);
    }
}

// Helper: Normaliza número de telefone para formato canônico com DDI 55
function normalizeMarketingPhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('55') ? digits : `55${digits}`;
}

// Helper: Verifica se o telefone já recebeu a campanha (ou já foi contatado globalmente)
function isPhoneAlreadySent(campId, phone, config) {
    if (!phone) return false;
    const clean = normalizeMarketingPhone(phone);
    if (!clean) return false;
    
    if (!config.sentHistory) config.sentHistory = { globalSent: [] };
    const campHistory = config.sentHistory[campId] || [];
    const globalHistory = config.sentHistory.globalSent || [];
    
    return campHistory.includes(clean) || globalHistory.includes(clean);
}

// Helper: Registra telefone como enviado com persistência imediata
function markPhoneAsSent(campId, phone, config) {
    if (!phone) return;
    const clean = normalizeMarketingPhone(phone);
    if (!clean) return;
    
    if (!config.sentHistory) config.sentHistory = { globalSent: [] };
    if (campId) {
        if (!config.sentHistory[campId]) config.sentHistory[campId] = [];
        if (!config.sentHistory[campId].includes(clean)) {
            config.sentHistory[campId].push(clean);
        }
    }
    if (!config.sentHistory.globalSent.includes(clean)) {
        config.sentHistory.globalSent.push(clean);
    }
}

// Helper: Varredura profunda no histórico real do WhatsApp para blindar contatos já abordados
async function scanWhatsAppHistoryAndSync(config) {
    if (!client || !isWhatsAppReady || !client.pupPage) {
        console.warn('⚠️ [Scan History] WhatsApp não está conectado para realizar a varredura.');
        return { success: false, error: 'WhatsApp não conectado' };
    }

    try {
        console.log('🔍 [Scan History] Iniciando varredura real nos 319+ chats do WhatsApp...');
        if (!config.sentHistory) config.sentHistory = { globalSent: [] };
        if (!config.sentHistory.globalSent) config.sentHistory.globalSent = [];

        // 1. Puxa todos os chats ativos diretamente de WAWebCollections
        const rawChats = await client.pupPage.evaluate(() => {
            const results = [];
            try {
                const collections = window.require('WAWebCollections');
                const ChatCollection = collections ? collections.Chat : null;
                if (!ChatCollection) return [];
                const models = ChatCollection.models || (ChatCollection._models ? ChatCollection._models : []);
                for (const c of models) {
                    try {
                        if (!c || !c.id) continue;
                        const idStr = c.id._serialized || '';
                        const isGroup = c.isGroup || (c.id.server === 'g.us') || idStr.endsWith('@g.us');
                        if (isGroup) continue;

                        const name = c.name || c.formattedTitle || c.pushname || '';
                        const user = c.id.user || '';
                        results.push({ name: String(name), user: String(user) });
                    } catch (e) {}
                }
            } catch (err) {}
            return results;
        });

        // 2. Puxa contatos salvos na agenda do WhatsApp
        let rawContacts = [];
        try {
            rawContacts = await client.getContacts();
        } catch (e) {}

        const contactsByName = new Map();
        rawContacts.forEach(c => {
            if (c && c.name && c.id && c.id.user) {
                contactsByName.set(c.name.toLowerCase().trim(), c.id.user);
            }
        });

        let identifiedCount = 0;
        const allDetectedPhones = new Set();

        for (const chat of rawChats) {
            const chatName = chat.name.toLowerCase().trim();
            // Telefone pelo nome na agenda
            if (contactsByName.has(chatName)) {
                const phone = contactsByName.get(chatName);
                const clean = normalizeMarketingPhone(phone);
                if (clean) allDetectedPhones.add(clean);
            }
            // Telefone direto do ID
            const directDigits = chat.user.replace(/\D/g, '');
            if (directDigits.length >= 8 && directDigits.length <= 15) {
                const clean = normalizeMarketingPhone(directDigits);
                if (clean) allDetectedPhones.add(clean);
            }
            // Telefone no próprio nome
            const nameDigits = chat.name.replace(/\D/g, '');
            if (nameDigits.length >= 8 && nameDigits.length <= 15) {
                const clean = normalizeMarketingPhone(nameDigits);
                if (clean) allDetectedPhones.add(clean);
            }
        }

        // Adiciona todos os identificados ao globalSent
        for (const phone of allDetectedPhones) {
            if (!config.sentHistory.globalSent.includes(phone)) {
                config.sentHistory.globalSent.push(phone);
                identifiedCount++;
            }
        }

        saveMarketingConfig(config);
        console.log(`✅ [Scan History] Varredura concluída! ${allDetectedPhones.size} chats reais identificados. ${identifiedCount} novos cadastrados no globalSent. Total blindados: ${config.sentHistory.globalSent.length}`);
        return { success: true, identifiedCount, totalTracked: config.sentHistory.globalSent.length };
    } catch (err) {
        console.error('❌ [Scan History] Erro ao varrer histórico:', err.message);
        return { success: false, error: err.message };
    }
}

// GET /api/marketing/test-chats-scan — Puxa lista real de todos os chats abertos no WhatsApp de forma 100% segura
app.get('/api/marketing/test-chats-scan', async (req, res) => {
    try {
        if (!isWhatsAppReady || !client || !client.pupPage) {
            return res.status(503).json({ error: 'WhatsApp não está pronto.' });
        }
        console.log('🔍 [API] Inspecionando chats reais no WhatsApp Web via WAWebCollections...');
        
        const extractedChats = await client.pupPage.evaluate(() => {
            const results = [];
            try {
                let ChatCollection = null;
                try {
                    const collections = window.require('WAWebCollections');
                    ChatCollection = collections.Chat;
                } catch (e) {}

                if (!ChatCollection) {
                    return { error: 'WAWebCollections.Chat não encontrado' };
                }
                
                const models = ChatCollection.models || (ChatCollection._models ? ChatCollection._models : []);
                
                for (const c of models) {
                    try {
                        if (!c || !c.id) continue;
                        const idStr = c.id._serialized || (c.id.user ? `${c.id.user}@c.us` : '');
                        const isGroup = c.isGroup || (c.id.server === 'g.us') || (idStr.endsWith('@g.us'));
                        if (isGroup) continue; // Pula grupos

                        const userPhone = (c.id.user || '').replace(/\D/g, '');
                        if (!userPhone) continue;

                        const name = c.name || c.formattedTitle || c.pushname || userPhone;
                        const unreadCount = c.unreadCount || 0;
                        const t = c.t || 0; // Timestamp da última mensagem
                        
                        let lastMsgText = '';
                        let lastMsgFromMe = false;
                        
                        if (c.msgs && c.msgs.models && c.msgs.models.length > 0) {
                            const lastM = c.msgs.models[c.msgs.models.length - 1];
                            if (lastM) {
                                lastMsgText = String(lastM.body || lastM.__x_body || '').slice(0, 100);
                                lastMsgFromMe = !!(lastM.isSentByMe || lastM.__x_isSentByMe || (lastM.id && lastM.id.fromMe));
                            }
                        }

                        results.push({
                            id: idStr,
                            phone: userPhone.startsWith('55') ? userPhone : `55${userPhone}`,
                            name: String(name),
                            unreadCount,
                            timestamp: t,
                            lastMsgText,
                            lastMsgFromMe
                        });
                    } catch (chatInnerErr) {}
                }
            } catch (err) {
                return { error: err.message || String(err) };
            }
            return results;
        });

        if (extractedChats && extractedChats.error) {
            return res.status(500).json({ error: extractedChats.error });
        }

        const chatList = Array.isArray(extractedChats) ? extractedChats : [];
        console.log(`📊 [API] Mapeados ${chatList.length} chats individuais ativos no WhatsApp.`);

        return res.json({
            success: true,
            totalFound: chatList.length,
            chats: chatList
        });
    } catch (err) {
        console.error('❌ Erro no test-chats-scan:', err);
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/marketing/sent-history — Retorna histórico de disparos blindados
app.get('/api/marketing/sent-history', (req, res) => {
    try {
        const config = loadMarketingConfig();
        return res.json({ success: true, sentHistory: config.sentHistory || { globalSent: [] } });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/marketing/scan-chats — Executa varredura profunda sob demanda
app.post('/api/marketing/scan-chats', async (req, res) => {
    try {
        const config = loadMarketingConfig();
        const result = await scanWhatsAppHistoryAndSync(config);
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/marketing/lists-diagnostic — Diagnóstico em tempo real de contatos e duplicatas
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

// POST /api/marketing/clean-and-deduplicate-lists — Higienização e Desduplicação Automática em 1 Clique
app.post('/api/marketing/clean-and-deduplicate-lists', async (req, res) => {
    try {
        const config = loadMarketingConfig();
        
        // 1. Executa varredura profunda no WhatsApp real (WAWebCollections.Chat)
        let activeChatNames = new Set();
        if (isWhatsAppReady && client && client.pupPage) {
            try {
                await scanWhatsAppHistoryAndSync(config);
                const rawChats = await client.pupPage.evaluate(() => {
                    const results = [];
                    try {
                        const collections = window.require('WAWebCollections');
                        const ChatCollection = collections ? collections.Chat : null;
                        if (!ChatCollection) return [];
                        const models = ChatCollection.models || (ChatCollection._models ? ChatCollection._models : []);
                        for (const c of models) {
                            try {
                                if (!c || !c.id) continue;
                                const idStr = c.id._serialized || '';
                                const isGroup = c.isGroup || (c.id.server === 'g.us') || idStr.endsWith('@g.us');
                                if (isGroup) continue;
                                const name = c.name || c.formattedTitle || c.pushname || '';
                                results.push(String(name).toLowerCase().trim());
                            } catch (e) {}
                        }
                    } catch (err) {}
                    return results;
                });
                activeChatNames = new Set(rawChats);
            } catch (e) {}
        }

        const lists = config.lists || [];
        const globalSent = config.sentHistory?.globalSent || [];

        let totalOriginal = 0;
        const seenPhonesGlobal = new Set();
        const uniqueContacts = [];
        const virginContacts = [];
        const alreadySentContacts = [];

        // Coleta todos os contatos e remove 100% das duplicatas
        lists.forEach(l => {
            (l.contacts || []).forEach(c => {
                totalOriginal++;
                const clean = normalizeMarketingPhone(c.cleanPhone || c.phone);
                const nameLower = (c.name || '').toLowerCase().trim();

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

                    const isAlreadySent = globalSent.includes(clean) || (nameLower && activeChatNames.has(nameLower));

                    if (isAlreadySent) {
                        alreadySentContacts.push(contactObj);
                    } else {
                        virginContacts.push(contactObj);
                    }
                }
            });
        });

        // 2. Limpa as listas existentes para que NENHUM contato apareça em mais de 1 lista
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

        // 3. Cria a lista oficial consolidada "BASE VIRGEM — PRONTA PARA DISPARO"
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

        // 4. Se houver contatos já enviados, cria/atualiza a lista de "BASE JÁ ABORDADA / BLINDADA"
        if (alreadySentContacts.length > 0) {
            const sentListId = 'list_base_blindada_enviados';
            const existingSentIdx = sanitizedLists.findIndex(l => l.id === sentListId);
            const sentListObj = {
                id: sentListId,
                name: '🛡️ BASE BLINDADA (Já Contactados)',
                description: 'Contatos que já possuem conversas no WhatsApp — protegidos contra novos disparos',
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

        // 5. Ajusta campanhas ativas para apontar de forma segura para a BASE VIRGEM
        (config.campaigns || []).forEach(c => {
            if (c.targetType === 'lists') {
                if (c.name && c.name.toLowerCase().includes('reativação')) {
                    c.selectedListIds = [virginListId];
                    c.totalRecipients = virginContacts.length;
                }
            }
        });

        saveMarketingConfig(config);

        console.log(`✨ [Clean Lists] Higienização Concluída! Total Original: ${totalOriginal}, Únicos: ${uniqueContacts.length}, Duplicatas Eliminadas: ${totalOriginal - uniqueContacts.length}, Virgens: ${virginContacts.length}, Já Enviados: ${alreadySentContacts.length}`);

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
        console.error('❌ [Clean Lists] Erro:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/marketing/campaigns — Retorna campanhas salvas
app.get('/api/marketing/campaigns', (req, res) => {
    try {
        const config = loadMarketingConfig();
        return res.json({ success: true, campaigns: config.campaigns });
    } catch (err) {
        console.error('❌ [Marketing] Erro ao ler campanhas:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/marketing/campaigns — Salva/atualiza campanhas
app.post('/api/marketing/campaigns', (req, res) => {
    try {
        const { campaigns: newCampaigns } = req.body;
        if (!Array.isArray(newCampaigns)) {
            return res.status(400).json({ error: 'O campo "campaigns" deve ser um array.' });
        }
        const config = loadMarketingConfig();
        config.campaigns = newCampaigns;
        saveMarketingConfig(config);
        console.log(`✅ [Marketing] ${newCampaigns.length} campanha(s) salvas no backend.`);
        return res.json({ success: true, saved: newCampaigns.length });
    } catch (err) {
        console.error('❌ [Marketing] Erro ao salvar campanhas:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/marketing/lists — Retorna listas salvas
app.get('/api/marketing/lists', (req, res) => {
    try {
        const config = loadMarketingConfig();
        return res.json({ success: true, lists: config.lists || [] });
    } catch (err) {
        console.error('❌ [Marketing] Erro ao ler listas:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/marketing/lists — Salva/atualiza listas
app.post('/api/marketing/lists', (req, res) => {
    try {
        const { lists: newLists } = req.body;
        if (!Array.isArray(newLists)) {
            return res.status(400).json({ error: 'O campo "lists" deve ser um array.' });
        }
        const config = loadMarketingConfig();
        config.lists = newLists;
        saveMarketingConfig(config);
        console.log(`✅ [Marketing] ${newLists.length} lista(s) de transmissão salvas no backend.`);
        return res.json({ success: true, saved: newLists.length });
    } catch (err) {
        console.error('❌ [Marketing] Erro ao salvar listas:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/marketing/test-dispatch — Disparo de teste imediato (sem afetar scheduler)
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

        if (!isWhatsAppReady || !client) {
            return res.status(503).json({ error: 'WhatsApp não está conectado.' });
        }

        if (camp.targetType !== 'group' || !camp.targetGroupId) {
            return res.status(400).json({ error: 'Teste imediato só disponível para campanhas de grupo.' });
        }

        const formattedMsg = camp.message
            .replace(/\[Nome\]/gi, 'Pessoal')
            .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, 'https://smoking-pods-catalogo.vercel.app')
            .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, '');

        // Resolve o ID do grupo
        let groupChatId = camp.targetGroupId;
        if (String(groupChatId).includes('chat.whatsapp.com/')) {
            try {
                const inviteCode = String(groupChatId).split('chat.whatsapp.com/')[1].trim().split('?')[0];
                const resolved = await client.acceptInvite(inviteCode);
                groupChatId = resolved || `${inviteCode}@g.us`;
            } catch (invErr) {
                console.warn('⚠️ [Test] Não resolveu convite:', invErr.message);
            }
        }

        console.log(`🧪 [Marketing Test] Disparando teste da campanha "${camp.name}" para ${groupChatId}...`);

        try {
            const chat = await client.getChatById(groupChatId);
            if (chat) {
                await chat.sendStateTyping();
                await new Promise(resolve => setTimeout(resolve, 2500));
                await client.sendMessage(groupChatId, formattedMsg);
                await chat.clearState();
            } else {
                await client.sendMessage(groupChatId, formattedMsg);
            }
        } catch (chatErr) {
            await client.sendMessage(groupChatId, formattedMsg);
        }

        console.log(`✅ [Marketing Test] Teste disparado com sucesso para "${camp.name}".`);
        return res.json({ success: true, message: `Teste disparado com sucesso para "${camp.name}"!` });
    } catch (err) {
        console.error('❌ [Marketing Test] Erro:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// ============================================================
// MOTOR SCHEDULER DE MARKETING (setInterval 60s)
// ============================================================

// Mapa de dias da semana PT-BR → JavaScript getDay() (0=Domingo)
const WEEKDAY_MAP = {
    'DOMINGO': 0,
    'SEGUNDA': 1,
    'TERCA': 2,
    'TERÇA': 2,
    'QUARTA': 3,
    'QUINTA': 4,
    'SEXTA': 5,
    'SABADO': 6,
    'SÁBADO': 6,
};

// Helper: Gera chave de idempotência semanal para evitar duplicação
function getIdempotencyKey(campId, date) {
    const year = date.getFullYear();
    // ISO week number
    const janFirst = new Date(year, 0, 1);
    const dayOfYear = Math.ceil((date - janFirst) / 86400000);
    const weekNum = Math.ceil((dayOfYear + janFirst.getDay()) / 7);
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).toUpperCase();
    return `${campId}_${year}_W${String(weekNum).padStart(2, '0')}_${weekday}`;
}

// Limpa chaves de idempotência antigas (mais de 14 dias)
function cleanOldIdempotencyKeys(config) {
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    if (config.idempotencyKeys && config.idempotencyKeys.length > 0) {
        const before = config.idempotencyKeys.length;
        config.idempotencyKeys = config.idempotencyKeys.filter(entry => {
            const ts = new Date(entry.timestamp).getTime();
            return ts > twoWeeksAgo;
        });
        if (config.idempotencyKeys.length < before) {
            console.log(`🧹 [Scheduler] Limpou ${before - config.idempotencyKeys.length} chave(s) de idempotência antigas.`);
        }
    }
}

// Set para controlar quais campanhas 1 a 1 estão rodando em background
const runningListCampaigns = new Set();

// Função principal do scheduler que verifica e dispara campanhas
async function marketingSchedulerTick() {
    try {
        if (!isWhatsAppReady || !client) {
            return; // WhatsApp não conectado, pula silenciosamente
        }

        const config = loadMarketingConfig();
        if (!config.campaigns || config.campaigns.length === 0) return;

        // Data/hora atual no timezone de São Paulo
        const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const currentWeekday = nowSP.getDay(); // 0-6
        const currentHour = nowSP.getHours();
        const currentMinute = nowSP.getMinutes();
        const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        const todayStr = nowSP.toISOString().split('T')[0];

        // Limpa chaves antigas periodicamente
        cleanOldIdempotencyKeys(config);

        const activeCampaigns = config.campaigns.filter(c => 
            c.status === 'active' && 
            c.scheduledTime
        );

        if (activeCampaigns.length === 0) return;

        for (const camp of activeCampaigns) {
            // 1. Verifica horário HH:MM exato
            if (camp.scheduledTime !== currentTimeStr) continue;

            // 2. Verifica Data de Início (startDate)
            if (camp.startDate) {
                const [sy, sm, sd] = camp.startDate.split('-').map(Number);
                const startMidnight = new Date(sy, sm - 1, sd, 0, 0, 0);
                const nowMidnight = new Date(nowSP.getFullYear(), nowSP.getMonth(), nowSP.getDate(), 0, 0, 0);
                if (nowMidnight < startMidnight) continue; // Data de início ainda não chegou
            }

            const freq = Number(camp.frequencyDays) || 0;

            // 3. Verifica Frequência
            if (freq === 7) {
                // Semanal com dia da semana fixo
                if (!camp.scheduledWeekday) continue;
                const expectedWeekday = WEEKDAY_MAP[camp.scheduledWeekday.toUpperCase()];
                if (expectedWeekday === undefined || expectedWeekday !== currentWeekday) continue;
            } else if (freq > 0) {
                // Intervalo em dias (ex: 14, 21, 30 dias a partir do último envio)
                if (camp.lastRunDate) {
                    const [d, m, y] = camp.lastRunDate.split('/').map(Number);
                    const lastDate = new Date(y, m - 1, d, 0, 0, 0);
                    const diffDays = Math.floor((nowSP.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays < freq) continue; // Ainda não se passaram os N dias necessários
                }
            }

            // 4. Verifica Idempotência
            const idempKey = `${camp.id}_${todayStr}_${currentTimeStr}`;
            const alreadyFired = (config.idempotencyKeys || []).some(entry => entry.key === idempKey);
            if (alreadyFired) continue;

            // ============================================================
            // CASO A: DISPARO PARA GRUPO VIP (1 Mensagem)
            // ============================================================
            if (camp.targetType === 'group' && camp.targetGroupId) {
                console.log(`\n🚀 [Scheduler Grupo] Disparando campanha: "${camp.name}" (${camp.scheduledWeekday || 'Recorrente'} às ${camp.scheduledTime})`);

                try {
                    const formattedMsg = camp.message
                        .replace(/\[Nome\]/gi, 'Pessoal')
                        .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, 'https://smoking-pods-catalogo.vercel.app')
                        .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, '');

                    let groupChatId = camp.targetGroupId;
                    if (String(groupChatId).includes('chat.whatsapp.com/')) {
                        try {
                            const inviteCode = String(groupChatId).split('chat.whatsapp.com/')[1].trim().split('?')[0];
                            const resolved = await client.acceptInvite(inviteCode);
                            groupChatId = resolved || `${inviteCode}@g.us`;
                        } catch (invErr) {
                            console.warn('⚠️ [Scheduler] Não resolveu convite:', invErr.message);
                        }
                    }

                    try {
                        const chat = await client.getChatById(groupChatId);
                        if (chat) {
                            await chat.sendStateTyping();
                            await new Promise(resolve => setTimeout(resolve, 2500));
                            await client.sendMessage(groupChatId, formattedMsg);
                            await chat.clearState();
                        } else {
                            await client.sendMessage(groupChatId, formattedMsg);
                        }
                    } catch (chatErr) {
                        await client.sendMessage(groupChatId, formattedMsg);
                    }

                    if (!config.idempotencyKeys) config.idempotencyKeys = [];
                    config.idempotencyKeys.push({ key: idempKey, timestamp: new Date().toISOString(), campaignName: camp.name });

                    const campIndex = config.campaigns.findIndex(c => c.id === camp.id);
                    if (campIndex !== -1) {
                        config.campaigns[campIndex].lastRunDate = nowSP.toLocaleDateString('pt-BR');
                    }

                    saveMarketingConfig(config);
                    console.log(`✅ [Scheduler Grupo] Campanha "${camp.name}" disparada com sucesso!`);
                } catch (dispatchErr) {
                    console.error(`❌ [Scheduler Grupo] Erro ao disparar "${camp.name}":`, dispatchErr.message);
                }
            }

            // ============================================================
            // CASO B: DISPARO PARA LISTAS DE TRANSMISSÃO (1 a 1 Autônomo)
            // ============================================================
            if (camp.targetType === 'lists' && !runningListCampaigns.has(camp.id)) {
                if (!config.idempotencyKeys) config.idempotencyKeys = [];
                config.idempotencyKeys.push({ key: idempKey, timestamp: new Date().toISOString(), campaignName: camp.name });
                saveMarketingConfig(config);

                runningListCampaigns.add(camp.id);

                // Disparo em background com cadência Anti-Ban
                (async () => {
                    try {
                        console.log(`\n🚀 [Scheduler 1-a-1] Iniciando esteira autônoma da campanha: "${camp.name}"`);
                        const lists = config.lists || [];
                        const targetLists = lists.filter(l => (camp.selectedListIds || []).includes(l.id));
                        const contactMap = new Map();
                        targetLists.forEach(l => (l.contacts || []).forEach(c => contactMap.set(c.id || c.phone, c)));
                        const targetContacts = Array.from(contactMap.values());

                        if (targetContacts.length === 0) {
                            console.warn(`⚠️ [Scheduler 1-a-1] Nenhum contato encontrado para a campanha "${camp.name}".`);
                            return;
                        }

                        const effectiveBatchSize = (camp.batchSize && camp.batchSize <= 5) ? camp.batchSize : 5;
                        const effectiveBatchInterval = (camp.batchIntervalMinutes && camp.batchIntervalMinutes >= 35) ? camp.batchIntervalMinutes : 35;
                        let batchCounter = 0;

                        for (let i = 0; i < targetContacts.length; i++) {
                            // Verifica se a campanha foi pausada no painel
                            const currentConfig = loadMarketingConfig();
                            const currentCamp = (currentConfig.campaigns || []).find(c => c.id === camp.id);
                            if (!currentCamp || currentCamp.status !== 'active') {
                                console.log(`🛑 [Scheduler 1-a-1] Campanha "${camp.name}" foi pausada durante a execução.`);
                                break;
                            }

                            const contact = targetContacts[i];
                            const rawPhone = contact.cleanPhone || contact.phone;
                            const cleanPhone = normalizeMarketingPhone(rawPhone);

                            // 🛡️ TRAVA RÍGIDA ANTI-DUPLICAÇÃO NO SCHEDULER
                            if (isPhoneAlreadySent(camp.id, cleanPhone, currentConfig)) {
                                console.log(`⏩ [Scheduler 1-a-1] Pulando ${cleanPhone} (${contact.name || 'Cliente'}) - Contato já foi enviado anteriormente.`);
                                continue;
                            }

                            // Rotação sequencial exata das variações
                            let chosenText = camp.message;
                            if (camp.useVariations && camp.variations && camp.variations.length > 0) {
                                const allTexts = [camp.message, ...camp.variations.filter(v => v && v.trim().length > 0)];
                                chosenText = allTexts[batchCounter % allTexts.length];
                            }

                            const formattedMsg = chosenText
                                .replace(/\[Nome\]/gi, contact.name || 'Cliente')
                                .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, 'https://smoking-pods-catalogo.vercel.app')
                                .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, '');

                            const formattedNumber = `${cleanPhone}@c.us`;

                            console.log(`📢 [Scheduler 1-a-1] Enviando (${i + 1}/${targetContacts.length}) para ${formattedNumber}...`);

                            try {
                                const chat = await client.getChatById(formattedNumber);
                                if (chat) {
                                    await chat.sendStateTyping();
                                    const typingMs = Math.floor(Math.random() * 5000) + 10000;
                                    await new Promise(r => setTimeout(r, typingMs));
                                    await client.sendMessage(formattedNumber, formattedMsg);
                                    await chat.clearState();
                                } else {
                                    await client.sendMessage(formattedNumber, formattedMsg);
                                }
                            } catch (sendErr) {
                                await client.sendMessage(formattedNumber, formattedMsg).catch(() => {});
                            }

                            // 🛡️ Grava imediatamente no JSON para que nunca mais se repita
                            markPhoneAsSent(camp.id, cleanPhone, currentConfig);
                            saveMarketingConfig(currentConfig);

                            batchCounter++;

                            // Delay individual (10 a 20 segundos)
                            const randomDelay = Math.floor(Math.random() * 10000) + 10000;
                            await new Promise(r => setTimeout(r, randomDelay));

                            // Pausa de 35 minutos ao bater o lote de 5 contatos
                            if (batchCounter >= effectiveBatchSize && (i + 1) < targetContacts.length) {
                                batchCounter = 0;
                                console.log(`⏸️ [Scheduler 1-a-1] Lote de ${effectiveBatchSize} concluído! Pausa anti-ban de ${effectiveBatchInterval} min...`);
                                await new Promise(r => setTimeout(r, effectiveBatchInterval * 60 * 1000));
                            }
                        }

                        // Atualiza lastRunDate
                        const finalConfig = loadMarketingConfig();
                        const cIdx = (finalConfig.campaigns || []).findIndex(c => c.id === camp.id);
                        if (cIdx !== -1) {
                            finalConfig.campaigns[cIdx].lastRunDate = nowSP.toLocaleDateString('pt-BR');
                            saveMarketingConfig(finalConfig);
                        }

                        console.log(`✅ [Scheduler 1-a-1] Campanha "${camp.name}" finalizada com sucesso!`);
                    } catch (err) {
                        console.error(`❌ [Scheduler 1-a-1] Erro na esteira de "${camp.name}":`, err.message);
                    } finally {
                        runningListCampaigns.delete(camp.id);
                    }
                })();
            }
        }
    } catch (err) {
        console.error('❌ [Scheduler] Erro geral no tick:', err.message);
    }
}

// Inicia o scheduler (a cada 60 segundos)
const SCHEDULER_INTERVAL_MS = 60 * 1000; // 60 segundos
setInterval(marketingSchedulerTick, SCHEDULER_INTERVAL_MS);
console.log('🕐 [Marketing Scheduler] Motor de agendamento iniciado (verificação a cada 60 segundos, TZ: America/Sao_Paulo).');

// ============================================================

app.listen(port, () => {
    console.log(`🚀 Servidor backend rodando na porta ${port}`);
    console.log(`⏳ Iniciando o motor do WhatsApp... aguarde o QR Code.`);
    try {
        client.initialize().catch(err => {
            console.error('⚠️ Erro na inicialização do cliente WhatsApp:', err.message);
        });
    } catch (e) {
        console.error('⚠️ Erro ao disparar client.initialize():', e.message);
    }
});

process.on('uncaughtException', (err) => {
    console.error('⚠️ UncaughtException capturado no backend:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ UnhandledRejection capturado no backend:', reason);
});
