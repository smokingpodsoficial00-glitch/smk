require('dotenv').config();
const readline = require('readline');
const { getAiResponse } = require('./ai_agent');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const testPhone = 'CLIENTE_TESTE';
let messageCount = 0;

console.log('=============================================');
console.log('🤖 SIMULADOR DA ELOISA (MODO OFFLINE - SEM WHATSAPP)');
console.log('=============================================');
console.log('O WhatsApp está fora do ar, mas o cérebro da IA está 100% ativo!');
console.log('Digite sua mensagem abaixo para testar o script e a personalidade.');
console.log('Para sair, digite "sair" e aperte Enter.\\n');

async function ask() {
    rl.question('Você (Cliente): ', async (msg) => {
        if (msg.toLowerCase() === 'sair' || msg.toLowerCase() === 'exit') {
            console.log('Encerrando simulador...');
            rl.close();
            return;
        }

        messageCount++;

        try {
            let response = await getAiResponse(testPhone, msg);
            
            // =============================================
            // CODE-003: Emoji removal
            // =============================================
            const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;
            response = response.replace(emojiRegex, '').trim();

            // =============================================
            // CODE-004: O Filtro Assassino (Arranca frases de call center)
            // =============================================
            let isFirstMessage = (messageCount === 1);
            if (response && !isFirstMessage) {
                const callCenterRegex = /(?:[.,!?;]\s*)?(?:e\s+|mas\s+|por[ée]m\s+)?(?:voc[êe]\s+)?(?:precisa|quer|posso|tem|alguma|mais|em que|se precisar).*(?:ajuda|ajudar|d[úu]vida|auxiliar|algo|mais alguma coisa|avisar).*?\??$/gi;
                
                response = response.replace(callCenterRegex, '');
                
                response = response.trim();
                // Limpeza de pontuacao solta no final
                response = response.replace(/[,.!?;]+$/, '');
            }

            if (response === '[IGNORAR]') {
                console.log('\\n[A IA FICOU EM SILÊNCIO]\\n---------------------------------------------');
                ask();
                return;
            }

            // Simula o comportamento do WhatsApp de quebrar mensagens
            const messagesArray = response
                .split(/(?:\[QUEBRA\]|\n+)/i)
                .map(line => line.trim())
                .filter(line => line.length > 0);
            
            console.log('');
            messagesArray.forEach((m, i) => {
                console.log(`Eloisa (Mensagem ${i + 1}): ${m}`);
            });
            console.log('\\n---------------------------------------------');
            
        } catch (err) {
            console.error('Erro ao falar com a IA:', err);
        }
        
        ask();
    });
}

ask();
