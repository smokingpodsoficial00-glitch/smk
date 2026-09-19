const { MercadoPagoConfig, Preference } = require('mercadopago');

// Inicializar cliente do Mercado Pago
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN || '' 
});

/**
 * Gera um link de pagamento (Preference) dinâmico
 * @param {number} rawTotal - O valor total do pedido sem a taxa
 * @param {string} orderId - Opcional identificador do pedido (para rastreio)
 */
async function generatePaymentLink(rawTotal, orderId = "PEDIDO_WHATSAPP") {
    try {
        if (!process.env.MP_ACCESS_TOKEN) {
            console.error("⚠️ MP_ACCESS_TOKEN não está definido no .env");
            return "https://link-de-pagamento-indisponivel.com";
        }

        // Puxa a porcentagem da taxa definida no .env (Padrão 5%)
        const feePercentage = parseFloat(process.env.MP_FEE_PERCENTAGE) || 5.0;
        
        // Calcula o novo valor com a taxa embutida
        // Exemplo: se rawTotal = 100 e taxa = 5%, final = 100 * 1.05 = 105.00
        const multiplier = 1 + (feePercentage / 100);
        let totalWithFee = parseFloat((rawTotal * multiplier).toFixed(2));

        const preference = new Preference(client);

        const body = {
            items: [
                {
                    id: orderId,
                    title: `Smoking Pods - Pedido c/ Taxa (Cartão)`,
                    quantity: 1,
                    currency_id: 'BRL',
                    unit_price: totalWithFee
                }
            ],
            // Links para onde o cliente será redirecionado após o pagamento
            back_urls: {
                success: "https://smoking-pods-catalogo.vercel.app/",
                failure: "https://smoking-pods-catalogo.vercel.app/",
                pending: "https://smoking-pods-catalogo.vercel.app/"
            },
            auto_return: "approved",
            payment_methods: {
                excluded_payment_types: [
                    { id: "ticket" } // Exclui boleto para pagamento ser aprovado na hora
                ]
            }
        };

        const response = await preference.create({ body });

        console.log(`✅ Link Mercado Pago gerado com sucesso. Valor original: R$${rawTotal} -> C/ Taxa: R$${totalWithFee}`);
        return response.init_point; // URL final de pagamento
        
    } catch (error) {
        console.error("❌ Erro ao gerar link do Mercado Pago:", error.message || error);
        return "https://link-de-pagamento-erro.com";
    }
}

module.exports = {
    generatePaymentLink
};
