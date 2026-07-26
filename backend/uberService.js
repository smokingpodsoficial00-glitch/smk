const axios = require('axios');
const { supabase } = require('./supabase'); // Import supabase for shipping config

// Endereço de Origem do Estoque (Configurável via .env)
const ORIGIN_ADDRESS = process.env.UBER_PICKUP_ADDRESS || 'Rua Alexandra Lunardi Fanani, 57 - Assunção, São Bernardo do Campo - SP, 09810-200';
// Coordenadas exatas do estoque para o OSRM
const ORIGIN_LAT = '-23.7168022';
const ORIGIN_LON = '-46.5691653';

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Obtém o token de acesso da API do Uber Direct
 */
async function getUberToken() {
    const clientId = process.env.UBER_CLIENT_ID;
    const clientSecret = process.env.UBER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return null;
    }

    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const response = await axios.post('https://login.uber.com/oauth/v2/token', new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
            scope: 'delivery'
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        cachedToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
        return cachedToken;
    } catch (error) {
        console.error('❌ Erro ao obter token do Uber Direct:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Busca dados completos do CEP usando a API AwesomeAPI (Retorna Lat/Lon e Endereço)
 */
async function getAddressFromCep(cep) {
    const cleanedCep = cep.replace(/\D/g, '');
    try {
        const response = await axios.get(`https://cep.awesomeapi.com.br/json/${cleanedCep}`);
        if (response.data && response.data.lat && response.data.lng) {
            return response.data;
        }
    } catch (e) {
        console.error(`⚠️ Erro ao buscar CEP ${cleanedCep} na AwesomeAPI:`, e.message);
    }
    return null;
}

/**
 * Obtém a distância real em KM via OSRM (Open Source Routing Machine)
 */
async function getDistanceOSRM(destLat, destLon) {
    const url = `http://router.project-osrm.org/route/v1/driving/${ORIGIN_LON},${ORIGIN_LAT};${destLon},${destLat}?overview=false`;
    try {
        const response = await axios.get(url, { timeout: 4000 });
        if (response.data.routes && response.data.routes.length > 0) {
            return response.data.routes[0].distance / 1000; // Converte metros para KM
        }
    } catch (e) {
        console.error("⚠️ OSRM Error:", e.message);
    }
    return null; // Fallback se falhar
}

/**
 * Puxa configurações dinâmicas de preço do Supabase (com fallback hardcoded)
 */
async function getDynamicShippingConfig() {
    let config = {
        base_fare: 8.50,
        included_km: 3.00,
        extra_km_fee: 1.40
    };
    
    if (!supabase) return config;

    try {
        const { data, error } = await supabase
            .from('shipping_config')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            console.log("ℹ️ Tabela shipping_config não encontrada ou vazia no Supabase. Usando valores padrões.");
        } else if (data) {
            config.base_fare = parseFloat(data.base_fare) || 8.50;
            config.included_km = parseFloat(data.included_km) || 3.00;
            config.extra_km_fee = parseFloat(data.extra_km_fee) || 1.40;
        }
    } catch (err) {
        console.log("ℹ️ Erro ao tentar ler shipping_config no Supabase. Usando padrões.");
    }
    return config;
}

/**
 * Calcula a taxa de entrega baseado em Uber Direct ou Simulador Dinâmico OSRM
 */
async function calculateShippingQuote(rawAddressOrCep) {
    const token = await getUberToken();
    const cleanCep = rawAddressOrCep.replace(/\D/g, '');
    
    let fullUberAddress = rawAddressOrCep;
    let addressName = rawAddressOrCep;
    let cepData = null;

    // Se for um CEP, obtemos o endereço formatado e as coordenadas
    if (cleanCep.length === 8) {
        cepData = await getAddressFromCep(cleanCep);
        if (cepData) {
            addressName = `${cepData.address}, ${cepData.district}, ${cepData.city} - ${cepData.state}`;
            fullUberAddress = `${addressName}, ${cepData.cep}`;
        }
    }

    // --- PLANO A: UBER DIRECT API ---
    if (token) {
        try {
            const response = await axios.post('https://api.uber.com/v1/deliveries/quote', {
                pickup_address: ORIGIN_ADDRESS,
                dropoff_address: fullUberAddress
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const fee = response.data.fee / 100;
            console.log(`🚗 [Uber Direct API] Cotação real para "${fullUberAddress}": R$ ${fee.toFixed(2)}`);
            return {
                fee: parseFloat(fee.toFixed(2)),
                distanceKm: response.data.distance || 0,
                address: response.data.dropoff_address || addressName,
                isSimulated: false
            };
        } catch (error) {
            console.warn('⚠️ Erro na cotação real do Uber Direct, caindo para o simulador dinâmico OSRM:', error.response?.data?.message || error.message);
        }
    }

    // --- PLANO B: SIMULADOR DINÂMICO OSRM (REALISTA DA IA) ---
    let distanceKm = 3.0; // Distância padrão segura caso tudo falhe

    if (cepData && cepData.lat && cepData.lng) {
        const osrmDist = await getDistanceOSRM(cepData.lat, cepData.lng);
        if (osrmDist !== null) {
            distanceKm = osrmDist;
        }
    }

    // Obtém parâmetros do Supabase (ou fallback padrão)
    const config = await getDynamicShippingConfig();

    let simulatedFee = 0;
    
    // Regra 1: Curtas distâncias (até X km inclusos)
    if (distanceKm <= config.included_km) {
        simulatedFee = config.base_fare;
    } else {
        // Regra 2: Distâncias que extrapolam o KM base
        const extraKm = distanceKm - config.included_km;
        simulatedFee = config.base_fare + (extraKm * config.extra_km_fee);
    }

    // Multiplicador Dinâmico baseado no horário (Fuso de São Paulo)
    const spTimeStr = new Intl.DateTimeFormat('pt-BR', { 
        timeZone: 'America/Sao_Paulo', 
        hour: 'numeric', 
        minute: 'numeric',
        hour12: false
    }).format(new Date());
    
    const [hour, min] = spTimeStr.split(':').map(Number);
    const timeInMinutes = (hour * 60) + min;

    let multiplier = 1.0;
    
    // Almoço (11:30 às 13:30)
    if (timeInMinutes >= (11 * 60 + 30) && timeInMinutes <= (13 * 60 + 30)) {
        multiplier = 1.15; // +15%
    }
    // Pico da Tarde/Noite (17:00 às 19:30)
    else if (timeInMinutes >= (17 * 60) && timeInMinutes <= (19 * 60 + 30)) {
        multiplier = 1.25; // +25%
    }
    // NOTA: Multiplicador da madrugada removido conforme solicitação (vendas fechadas 00h-06h).
    
    simulatedFee = simulatedFee * multiplier;

    // Garante um valor mínimo de frete (Segurança)
    if (simulatedFee < config.base_fare) simulatedFee = config.base_fare;

    console.log(`🤖 [Simulador Dinâmico OSRM] CEP/Endereço: "${addressName}" | Distância: ${distanceKm.toFixed(1)} km | Multiplicador: ${multiplier}x | Frete: R$ ${simulatedFee.toFixed(2)}`);

    return {
        fee: parseFloat(simulatedFee.toFixed(2)),
        distanceKm: parseFloat(distanceKm.toFixed(1)),
        address: addressName,
        isSimulated: true
    };
}

module.exports = {
    calculateShippingQuote
};
