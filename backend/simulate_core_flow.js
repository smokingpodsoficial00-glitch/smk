require('dotenv').config();
const { getAiResponse, initConversation, conversationHistory } = require('./ai_agent');

const scenarios = [
    {
        name: 'FLUXO 1: Compra direta, endereco completo, Pix',
        phone: 'CORE_01',
        messages: [
            'bom dia',
            'sim',
            'quero 1 ignite v50 de menta',
            'rua sao paulo 123, centro, sbc',
            '[SISTEMA: O frete via Uber Direct foi calculado em R$ 15,00. Siga para a regra de forma de pagamento.]',
            'vou querer no pix',
            'ta pago, enviei o comprovante ai'
        ]
    },
    {
        name: 'FLUXO 2: Sem sabor, endereco sem CEP, Cartao',
        phone: 'CORE_02',
        messages: [
            'quero comprar um pod',
            'pode me ver o ignite v50',
            'de morango',
            'rua das flores 456',
            'centro, diodema',
            '[SISTEMA: O frete via Uber Direct foi calculado em R$ 20,00. Siga para a regra de forma de pagamento.]',
            'cartao',
            'beleza'
        ]
    },
    {
        name: 'FLUXO 3: Fora de Horario',
        phone: 'CORE_03',
        messages: [
            'oii ja ta aberto?',
            'quero deixar reservado entao',
            'vou querer o v80 de uva',
            'rua amazonas 890, sbc'
        ]
    },
    {
        name: 'FLUXO 4: Pedindo recomendacao',
        phone: 'CORE_04',
        messages: [
            'boa tarde',
            'qual pod vcs recomendam?',
            'gosto de doce',
            'vou levar esse entao',
            'cep 09851705'
        ]
    }
];

async function runTests() {
    console.log('Iniciando auditoria do Feijão com Arroz (Fluxo Básico)...\\n');
    for (const scenario of scenarios) {
        console.log(`================================`);
        console.log(`CENÁRIO: ${scenario.name}`);
        console.log(`================================`);
        
        for (const msg of scenario.messages) {
            console.log(`\\n🗣️ Cliente: ${msg}`);
            let response = await getAiResponse(scenario.phone, msg);
            
            // Simula o filtro do servidor
            const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;
            response = response.replace(emojiRegex, '').trim();

            if (response && response.toLowerCase() !== 'olá tudo bem, como posso te ajudar?' && response.toLowerCase() !== 'opa, que bom ver você por aqui de novo, qual o pedido dessa vez?') {
                const callCenterRegex = /(?:[.,!?;]\s*)?(?:e\s+|mas\s+|por[ée]m\s+)?(?:voc[êe]\s+)?(?:precisa|quer|posso|tem|alguma|mais|em que|se precisar).*(?:ajuda|ajudar|d[úu]vida|auxiliar|algo|mais alguma coisa|avisar).*?\??$/gi;
                response = response.replace(callCenterRegex, '').trim();
                response = response.replace(/[,.!?;]+$/, '');
            }

            if (response === '[IGNORAR]' || response === '') {
                console.log(`🤖 Eloisa: [SILÊNCIO ABSOLUTO]`);
            } else {
                console.log(`🤖 Eloisa:\\n${response}`);
            }
        }
        console.log('\\n');
    }
}

runTests().then(() => console.log('Testes finalizados!'));
