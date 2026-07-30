require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, MessageTypes } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getAiResponse, conversationHistory, initConversation } = require('./ai_agent');
const { calculateShippingQuote } = require('./uberService');
const { supabase } = require('./supabase');
const { transcribeAudio } = require('./audioService');
const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3006;

// Inicializa o cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    puppeteer: { 
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-extensions',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        ignoreDefaultArgs: ['--enable-automation']
    }
});

const path = require('path');
const fs = require('fs');

let latestQr = null;
let isWhatsAppReady = false;

client.on('qr', (qr) => {
    latestQr = qr;
    isWhatsAppReady = false;
    console.log('----------------------------------------------------');
    console.log('🤖 Escaneie o QR Code abaixo com o seu WhatsApp:');
    console.log('----------------------------------------------------');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    latestQr = null;
    isWhatsAppReady = true;
    console.log('✅ Inteligência Artificial conectada ao WhatsApp com sucesso!');
});

app.get('/api/qr', (req, res) => {
    res.json({
        qr: latestQr,
        isReady: isWhatsAppReady,
        qrImageUrl: latestQr ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQr)}` : null
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

        res.json({ success: true, message: 'WhatsApp desconectado com sucesso. O backend irá gerar um novo QR Code ao reiniciar.' });

        setTimeout(() => {
            process.exit(0);
        }, 1000);
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

// =============================================
// EMOJI REGEX (reused in multiple places)
// =============================================
const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;

// =============================================
// HELPER: Get São Paulo time (UTC-3)
// =============================================
function getSaoPauloHour() {
    const now = new Date();
    // Use Intl to get São Paulo hour reliably
    const spTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return spTime.getHours();
}

// =============================================
// CODE-008: Out-of-hours detection
// =============================================
function isOutOfHours() {
    const hour = getSaoPauloHour();
    return hour < 11 || hour >= 23;
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
// SEND SEQUENTIAL MESSAGES (with fixed timing per script)
// =============================================
// Timing rules:
//   - First message of first conversation: 20000ms delay before typing
//   - Subsequent messages after first response: 4000ms delay before typing
//   - Typing indicator: always 5000ms
//   - Between consecutive messages: 4000ms (includes the typing time)
async function sendSequentialMessages(chat, msg, messagesArray, chatId, isFirstMessage) {
    try {
        for (let i = 0; i < messagesArray.length; i++) {
            const currentMsg = messagesArray[i];

            // --- Pre-typing delay ---
            if (i === 0) {
                if (isFirstMessage) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // --- Typing indicator: safe fallback ---
            if (chat && typeof chat.sendStateTyping === 'function') {
                try {
                    await chat.sendStateTyping();
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (e) {}
            }

            // --- Send message directly via msg.reply or client ---
            try {
                if (msg && typeof msg.reply === 'function') {
                    await msg.reply(currentMsg);
                } else if (client) {
                    await client.sendMessage(msg.from, currentMsg);
                }
            } catch (sendErr) {
                console.warn('⚠️ Falha no msg.reply, enviando por client.sendMessage:', sendErr.message);
                if (client) {
                    await client.sendMessage(msg.from, currentMsg);
                }
            }

            if (chat && typeof chat.clearState === 'function') {
                try { await chat.clearState(); } catch (e) {}
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
// PARSE AND SAVE ORDER (unchanged)
// =============================================
async function parseAndSaveOrder(senderNumber, contactName, messageText) {
    if (!messageText.startsWith('[PEDIDO-SMOKING]')) return null;
    
    try {
        const mainParts = messageText.replace('[PEDIDO-SMOKING]', '').trim().split('|');
        if (mainParts.length < 2) return null;
        
        const itemsStr = mainParts[0].trim();
        const totalStr = mainParts[1].replace('Total:', '').trim();
        const numericTotal = parseFloat(totalStr.replace(/[^\d,.-]/g, '').replace(',', '.'));

        // Salva cliente
        await supabase
            .from('smoking_clients')
            .upsert({ phone: senderNumber, name: contactName }, { onConflict: 'phone' });

        const itemsList = itemsStr.split(',').map(item => item.trim());
        const orderItems = [];

        for (const itemText of itemsList) {
            const match = itemText.match(/^(\d+)x\s+(.+?)\s*\((.+?)\)$/);
            if (match) {
                const quantity = parseInt(match[1]);
                const productName = match[2];
                const flavor = match[3];

                // Buscar ID do produto no Supabase
                const { data: product } = await supabase
                    .from('smoking_products')
                    .select('id, price, brand')
                    .eq('name', productName)
                    .eq('flavor', flavor)
                    .limit(1)
                    .maybeSingle();

                orderItems.push({
                    product_id: product ? product.id : null,
                    name: productName,
                    flavor: flavor,
                    quantity: quantity,
                    price: product ? parseFloat(product.price) : 90.00
                });
            }
        }

        // Buscar ID da empresa principal
        const companyId = await getPrimaryCompanyId();

        // Criar pedido no Supabase
        const { data: newOrder, error: orderError } = await supabase
            .from('smoking_orders')
            .insert({
                company_id: companyId,
                client_phone: senderNumber,
                client_name: contactName,
                items: orderItems,
                total_amount: numericTotal,
                shipping_fee: 0.00,
                shipping_address: 'Aguardando CEP',
                payment_status: 'PENDENTE',
                delivery_status: 'AGUARDANDO_PAGAMENTO',
                payment_method: 'PIX'
            })
            .select()
            .single();

        if (orderError) {
            console.error('❌ Erro ao criar pedido no Supabase:', orderError.message);
            return null;
        }

        console.log(`✅ Pedido #${newOrder.id} gravado com sucesso no Supabase para ${senderNumber}!`);
        return newOrder.id;
    } catch (err) {
        console.error('❌ Erro no processamento e gravação de pedido:', err);
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
// PROCESS COMPROVANTE & MOVE ORDER TO KANBAN (SEPARAÇÃO)
// =============================================
async function handleReceiptReceived(senderNumber, contactName, messageText, hasMedia) {
    try {
        const isReceiptText = /comprovante|paguei|fiz o pix|mandei o pix|transferi|depositei|pagamento feito|print/i.test(messageText || '');
        if (!hasMedia && !isReceiptText) return null;

        console.log(`🧾 [Comprovante] Recebido de ${senderNumber} (${contactName}). Atualizando/Gravando pedido para o Kanban...`);

        // 1. Salva/Atualiza Cliente
        await supabase
            .from('smoking_clients')
            .upsert({ phone: senderNumber, name: contactName }, { onConflict: 'phone' });

        // 2. Buscar último pedido do cliente que ainda não foi concluído
        const { data: existingOrders } = await supabase
            .from('smoking_orders')
            .select('*')
            .eq('client_phone', senderNumber)
            .order('created_at', { ascending: false })
            .limit(1);

        if (existingOrders && existingOrders.length > 0) {
            const existingOrder = existingOrders[0];
            // Se o pedido existia, atualiza para Aguardando Confirmação do Pix & Separação
            const { data: updated, error: updateErr } = await supabase
                .from('smoking_orders')
                .update({
                    payment_status: 'AGUARDANDO_CONFIRMACAO',
                    delivery_status: 'PREPARANDO',
                    receipt_url: 'COMPROVANTE_PIX_ENVIADO'
                })
                .eq('id', existingOrder.id)
                .select()
                .single();

            if (!updateErr) {
                console.log(`✅ Pedido #${existingOrder.id} atualizado para AGUARDANDO_CONFIRMACAO / PREPARANDO no Kanban!`);
                return updated;
            }
        }

        const companyId = await getPrimaryCompanyId();

        // 3. Se não existia pedido gravado ainda, cria o pedido direto no Kanban!
        const { data: newOrder, error: insertErr } = await supabase
            .from('smoking_orders')
            .insert({
                company_id: companyId,
                client_phone: senderNumber,
                client_name: contactName,
                items: [{ name: 'Pod (WhatsApp)', flavor: 'Pedido por Chat', quantity: 1, price: 89.90 }],
                total_amount: 89.90,
                shipping_fee: 10.00,
                shipping_address: 'Endereço enviado pelo WhatsApp',
                payment_status: 'AGUARDANDO_CONFIRMACAO',
                delivery_status: 'PREPARANDO',
                payment_method: 'PIX',
                receipt_url: 'COMPROVANTE_PIX_ENVIADO'
            })
            .select()
            .single();

        if (insertErr) {
            console.error('❌ Erro ao registrar pedido de comprovante no Supabase:', insertErr);
            return null;
        }

        console.log(`✅ Novo Pedido #${newOrder.id} gravado no Supabase em Separação para ${senderNumber}!`);
        return newOrder;
    } catch (err) {
        console.error('❌ Erro no handleReceiptReceived:', err);
        return null;
    }
}

// =============================================
// DETECT FOLLOW-UP TRIGGERS IN AI RESPONSE
// =============================================
function detectFollowUpTriggers(chatId, aiResponse) {
    const lower = aiResponse.toLowerCase();
    
    // Detect table/cardápio sent
    if (lower.includes('smokingproject01.vercel.app')) {
        scheduleTableFollowUp(chatId);
    }
    
    // Detect Pix key sent (payment flow started)
    if (lower.includes('chave pix') || lower.includes('chave pix :')) {
        schedulePaymentFollowUp(chatId);
    }
}

// =============================================
// MAIN MESSAGE HANDLER
// =============================================
client.on('message', async msg => {
    // Avoid responding to self or status broadcasts
    if (msg.from === 'status@broadcast' || msg.fromMe) return;

    // Ignore groups completely
    if (msg.from.endsWith('@g.us')) {
        console.log(`👥 Ignorando mensagem de grupo: ${msg.from}`);
        return;
    }

    // Ignore old messages (WhatsApp Web sync backlog)
    const now = Math.floor(Date.now() / 1000);
    if (now - msg.timestamp > 60) {
        console.log(`⏳ Ignorando mensagem antiga de ${msg.from} (enviada há ${now - msg.timestamp}s)`);
        return;
    }

    // --- MESSAGE TYPE FILTERS ---
    
    // P53: Stickers — IGNORE completely
    if (msg.type === 'sticker' || msg.type === MessageTypes.STICKER) {
        console.log(`🎭 Ignorando sticker de ${msg.from}`);
        return;
    }

    const senderNumber = msg.from.split('@')[0];
    let messageText = msg.body || '';
    const chatId = `${senderNumber}`;

    // --- AUDIO TRANSCRIPTION ---
    if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
        try {
            console.log(`🎙️ Áudio recebido de ${senderNumber}, baixando e transcrevendo...`);
            const media = await msg.downloadMedia();
            if (media && media.data) {
                const transcribedText = await transcribeAudio(media.data, media.mimetype);
                if (transcribedText) {
                    messageText = `[ÁUDIO TRANSCRITO]: ${transcribedText}`;
                    console.log(`✅ Áudio transcrito: ${transcribedText}`);
                } else {
                    // P51 fallback
                    const chat = await msg.getChat();
                    await chat.sendStateTyping();
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    await msg.reply('eu infelizmente não consigo ouvir áudios amg, consegue me enviar por escrito oque mandou?');
                    await chat.clearState();
                    return;
                }
            }
        } catch (err) {
            console.error(`❌ Erro no processamento de áudio de ${senderNumber}:`, err);
            try {
                const chat = await msg.getChat();
                await chat.sendStateTyping();
                await new Promise(resolve => setTimeout(resolve, 5000));
                await msg.reply('eu infelizmente não consigo ouvir áudios amg, consegue me enviar por escrito oque mandou?');
                await chat.clearState();
            } catch (fallbackErr) {
                console.error(`❌ Falha ao tentar responder o erro de áudio para ${senderNumber}:`, fallbackErr);
            }
            return;
        }
    }
    // --- PERSONAL CONTACT FILTER ---
    try {
        const contact = await msg.getContact();
        const contactName = (contact.name || contact.pushname || '').toLowerCase();

        const personalContacts = [
            'leo pinheiro',
            'ruan',
            'rafael',
            'olguinha',
            'gata',
            'palominha'
        ];

        const isPersonal = personalContacts.some(name => contactName.includes(name));

        if (isPersonal) {
            console.log(`👤 [Filtro Pessoal] Ignorando contato: ${contact.name || contact.pushname} (${senderNumber})`);
            return;
        }

        console.log(`📩 Mensagem recebida de ${senderNumber}: ${messageText}`);
    } catch (err) {
        console.error('⚠️ Erro ao checar contato pessoal:', err);
    }

    // --- SPAM DETECTION ---
    if (messageText && isSpamMessage(messageText)) {
        console.log(`🚫 [Spam] Ignorando mensagem de ${senderNumber}: ${messageText.substring(0, 50)}...`);
        return;
    }

    // P34: Location messages — ask for written address
    if (msg.type === 'location' || msg.type === MessageTypes.LOCATION) {
        console.log(`📍 Localização recebida de ${senderNumber}, pedindo endereço escrito`);
        try {
            const chat = await msg.getChat();
            await chat.sendStateTyping();
            await new Promise(resolve => setTimeout(resolve, 5000));
            await msg.reply('poderia me enviar por escrito?');
            await chat.clearState();
            await new Promise(resolve => setTimeout(resolve, 4000));
            await chat.sendStateTyping();
            await new Promise(resolve => setTimeout(resolve, 5000));
            await msg.reply('para evitar erros na hora do motoboy levar o seu pedido');
            await chat.clearState();
        } catch (err) {
            console.error('❌ Erro ao responder localização:', err);
        }
        return;
    }

    // --- Cancel any pending follow-ups (client responded) ---
    cancelFollowUps(chatId);

    // =============================================
    // CODE-007: DEBOUNCE SYSTEM (8 seconds)
    // =============================================
    // Accumulate messages. After 8s of silence, process them all as one.
    
    // If there's an existing debounce timer, clear it and accumulate
    if (debounceTimers.has(chatId)) {
        clearTimeout(debounceTimers.get(chatId));
    }

    // Store/accumulate message data
    if (!pendingMessages.has(chatId)) {
        pendingMessages.set(chatId, { messages: [], msg: msg });
    }
    const pending = pendingMessages.get(chatId);
    if (messageText) {
        pending.messages.push(messageText);
    }
    // Always keep the latest msg reference (for reply)
    pending.msg = msg;

    // Set debounce timer for 8 seconds
    const timerId = setTimeout(async () => {
        debounceTimers.delete(chatId);
        
        // Grab and clear pending messages
        const data = pendingMessages.get(chatId);
        pendingMessages.delete(chatId);
        
        if (!data || data.messages.length === 0) return;

        // Combine all accumulated messages into one
        const combinedMessage = data.messages.join('\n');
        const latestMsg = data.msg;

        // Process the combined message
        await processMessage(latestMsg, senderNumber, chatId, combinedMessage);
    }, 8000);

    debounceTimers.set(chatId, timerId);
});

// =============================================
// CORE MESSAGE PROCESSING (after debounce)
// =============================================
async function processMessage(msg, senderNumber, chatId, messageText) {
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
            console.warn('⚠️ msg.getContact indisponível (usando fallback seguro):', e.message);
        }
        
        // Check if this is the first message ever from this client
        const isFirstMessage = !conversationHistory[senderNumber];

        // =============================================
        // CODE-008: OUT-OF-HOURS DETECTION
        // =============================================
        if (isFirstMessage && isOutOfHours()) {
            reservationMode.add(chatId);

            const outOfHoursMessages = [
                'Estamos fora do horário de serviço, nosso funcionamento é das 11hrs até as 23hrs',
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
        await handleReceiptReceived(senderNumber, pushName, messageText, msg.hasMedia);

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
            // Normal hours — detect address/CEP
            const cepMatch = messageText.match(/\b\d{5}-?\d{3}\b/);
            
            if (cepMatch) {
                needsShippingCalculation = true;
                addressToCalculate = cepMatch[0];
            } else {
                const history = conversationHistory[senderNumber];
                if (history && history.length > 0) {
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
                            needsShippingCalculation = true;
                        }
                    }
                }
            }
        }

        // CODE-004: Fixed shipping system message — no spontaneous free shipping mention
        if (needsShippingCalculation) {
            try {
                const quote = await calculateShippingQuote(addressToCalculate);
                
                initConversation(senderNumber);
                conversationHistory[senderNumber].push({
                    role: "system",
                    content: `[SISTEMA: O frete via Uber Direct para o endereço "${quote.address}" foi calculado com sucesso. Valor do frete: R$ ${quote.fee.toFixed(2)}. Distância: ${quote.distanceKm} km. Informe o valor do frete ao cliente e pergunte se deseja prosseguir. Ofereça a chave Pix aleatória para concluir.]`
                });
                console.log(`🚗 Cotação de frete injetada para ${senderNumber}: R$ ${quote.fee.toFixed(2)}`);
            } catch (err) {
                console.error('❌ Falha ao injetar cotação de frete:', err);
            }
        }

        // =============================================
        // CODE-001 + CODE-002: Get AI response (single call, fixed greeting)
        // =============================================
        let aiResponse = null;
        let isHardcodedResponse = false;

        if (isFirstMessage) {
            // First message from a new client: use exact script greeting
            aiResponse = 'Olá tudo bem, como posso te ajudar?';
            isHardcodedResponse = true;

            // Initialize conversation history with this exchange
            initConversation(senderNumber);
            conversationHistory[senderNumber].push(
                { role: 'user', content: messageText },
                { role: 'assistant', content: aiResponse }
            );

            // Schedule "oi" follow-up (1 hour) in case client goes silent
            scheduleOiFollowUp(chatId);
        } else {
            // Subsequent messages: call AI once
            aiResponse = await getAiResponse(senderNumber, messageText, senderNumber);
        }

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
            aiResponse = aiResponse.replace(/[,.!?;]+$/, ''); // Limpeza de pontuacao solta no final

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

app.listen(port, () => {
    console.log(`🚀 Servidor backend rodando na porta ${port}`);
    console.log(`⏳ Iniciando o motor do WhatsApp... aguarde o QR Code.`);
    client.initialize();
});
