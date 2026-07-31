const axios = require('axios');
const { supabase } = require('./supabase');

// Endereço de Origem Padrão do Estoque
const ORIGIN_ADDRESS = process.env.UBER_PICKUP_ADDRESS || 'Rua Alexandra Lunardi Fanani, 57 - Assunção, São Bernardo do Campo - SP, 09810-200';
const ORIGIN_LAT = -23.7168022;
const ORIGIN_LON = -46.5691653;

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
 * Geocodifica qualquer endereço ou CEP via AwesomeAPI e OpenStreetMap Nominatim
 */
async function geocodeAddress(rawInput) {
    const cleanCep = rawInput.replace(/\D/g, '');

    // 1. Se for CEP de 8 dígitos
    if (cleanCep.length === 8) {
        try {
            const resp = await axios.get(`https://cep.awesomeapi.com.br/json/${cleanCep}`, { timeout: 3500 });
            if (resp.data && resp.data.lat && resp.data.lng) {
                return {
                    lat: parseFloat(resp.data.lat),
                    lon: parseFloat(resp.data.lng),
                    address: `${resp.data.address}, ${resp.data.district}, ${resp.data.city} - ${resp.data.state}`
                };
            }
        } catch (e) {}

        // Fallback ViaCEP + Nominatim
        try {
            const viaCep = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`, { timeout: 3500 });
            if (viaCep.data && !viaCep.data.erro) {
                const fullStr = `${viaCep.data.logradouro}, ${viaCep.data.bairro}, ${viaCep.data.localidade} - ${viaCep.data.uf}, Brasil`;
                const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullStr)}&limit=1`;
                const nomResp = await axios.get(nomUrl, { headers: { 'User-Agent': 'SmokingPodsApp/1.0' }, timeout: 3500 });
                if (nomResp.data && nomResp.data.length > 0) {
                    return {
                        lat: parseFloat(nomResp.data[0].lat),
                        lon: parseFloat(nomResp.data[0].lon),
                        address: `${viaCep.data.logradouro}, ${viaCep.data.bairro}, ${viaCep.data.localidade} - ${viaCep.data.uf}`
                    };
                }
                return {
                    lat: null,
                    lon: null,
                    address: `${viaCep.data.logradouro}, ${viaCep.data.bairro}, ${viaCep.data.localidade} - ${viaCep.data.uf}`
                };
            }
        } catch (e) {}
    }

    // 2. Se for texto de endereço (ex: "Rua Alexandra Lunardi Fanani")
    try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawInput + ', São Paulo, Brasil')}&limit=1`;
        const nomResp = await axios.get(nomUrl, { headers: { 'User-Agent': 'SmokingPodsApp/1.0' }, timeout: 3500 });
        if (nomResp.data && nomResp.data.length > 0) {
            return {
                lat: parseFloat(nomResp.data[0].lat),
                lon: parseFloat(nomResp.data[0].lon),
                address: nomResp.data[0].display_name
            };
        }
    } catch (e) {}

    return { lat: null, lon: null, address: rawInput };
}

/**
 * Fórmula de Haversine para cálculo de distância em linha reta (fallback de segurança)
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Obtém a distância real de condução em KM via OSRM
 */
async function getDistanceOSRM(destLat, destLon, originLat = ORIGIN_LAT, originLon = ORIGIN_LON) {
    const url = `http://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;
    try {
        const response = await axios.get(url, { timeout: 4000 });
        if (response.data.routes && response.data.routes.length > 0) {
            return response.data.routes[0].distance / 1000;
        }
    } catch (e) {
        console.error("⚠️ Erro na rota OSRM:", e.message);
    }
    return null;
}

/**
 * Puxa configurações dinâmicas de frete da loja no Supabase
 */
async function getDynamicShippingConfig() {
    let config = {
        base_fare: 8.50,
        included_km: 3.00,
        extra_km_fee: 1.40,
        originLat: ORIGIN_LAT,
        originLon: ORIGIN_LON,
        originAddress: ORIGIN_ADDRESS
    };
    
    if (!supabase) return config;

    try {
        const { data: storeData } = await supabase
            .from('store_config')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (storeData) {
            if (storeData.base_fare) config.base_fare = parseFloat(storeData.base_fare);
            if (storeData.included_km) config.included_km = parseFloat(storeData.included_km);
            if (storeData.extra_km_fee) config.extra_km_fee = parseFloat(storeData.extra_km_fee);
            if (storeData.address) config.originAddress = storeData.address;

            const originCep = storeData.origin_cep || (storeData.address ? storeData.address.match(/\b\d{5}-?\d{3}\b/)?.[0] : null);
            if (originCep) {
                const geo = await geocodeAddress(originCep);
                if (geo && geo.lat && geo.lon) {
                    config.originLat = geo.lat;
                    config.originLon = geo.lon;
                }
            }
        }
    } catch (err) {
        console.log("ℹ️ Erro ao ler configurações de frete no Supabase. Usando padrões.");
    }
    return config;
}

/**
 * CÁLCULO DE FRETE REAL (Origem da loja -> Destino do cliente)
 */
async function calculateShippingQuote(rawAddressOrCep) {
    const config = await getDynamicShippingConfig();
    const token = await getUberToken();

    // 1. Geocodifica o endereço de destino do cliente
    const geo = await geocodeAddress(rawAddressOrCep);

    // --- PLANO A: UBER DIRECT API (Se credenciais de API estiverem configuradas) ---
    if (token) {
        try {
            const response = await axios.post('https://api.uber.com/v1/deliveries/quote', {
                pickup_address: config.originAddress,
                dropoff_address: geo.address
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const fee = response.data.fee / 100;
            console.log(`🚗 [Uber Direct API] Cotação real para "${geo.address}": R$ ${fee.toFixed(2)}`);
            return {
                fee: parseFloat(fee.toFixed(2)),
                distanceKm: response.data.distance || 0,
                address: response.data.dropoff_address || geo.address,
                isSimulated: false
            };
        } catch (error) {
            console.warn('⚠️ Erro na cotação real do Uber Direct, usando cálculo de rota da loja:', error.response?.data?.message || error.message);
        }
    }

    // --- PLANO B: CÁLCULO DE KM REAL BASEADO NAS CONFIGURAÇÕES DA LOJA ---
    let distanceKm = null;

    if (geo.lat && geo.lon && config.originLat && config.originLon) {
        distanceKm = await getDistanceOSRM(geo.lat, geo.lon, config.originLat, config.originLon);
    }

    // Fallback via Haversine se OSRM falhar (Aplica fator de curva 1.3x)
    if (distanceKm === null && geo.lat && geo.lon && config.originLat && config.originLon) {
        distanceKm = haversineDistanceKm(config.originLat, config.originLon, geo.lat, geo.lon) * 1.3;
    }

    // Se o geocoding de lat/lon falhar totalmente, estima 4.5km para calcular acima da tarifa mínima
    if (distanceKm === null || isNaN(distanceKm)) {
        distanceKm = 4.5;
    }

    // CÁLCULO DA TARIFA:
    // Até included_km (ex: 3km) = base_fare (ex: R$ 8.50)
    // Além de included_km = base_fare + (KM_extra * extra_km_fee)
    let calculatedFee = config.base_fare;
    if (distanceKm > config.included_km) {
        const extraKm = distanceKm - config.included_km;
        calculatedFee = config.base_fare + (extraKm * config.extra_km_fee);
    }

    // Multiplicador Dinâmico de Horário de Pico (Fuso SP)
    const spTimeStr = new Intl.DateTimeFormat('pt-BR', { 
        timeZone: 'America/Sao_Paulo', 
        hour: 'numeric', 
        minute: 'numeric',
        hour12: false
    }).format(new Date());
    
    const [hour, min] = spTimeStr.split(':').map(Number);
    const timeInMinutes = (hour * 60) + min;

    let multiplier = 1.0;
    if (timeInMinutes >= (11 * 60 + 30) && timeInMinutes <= (13 * 60 + 30)) {
        multiplier = 1.15; // Pico Almoço (+15%)
    } else if (timeInMinutes >= (17 * 60) && timeInMinutes <= (19 * 60 + 30)) {
        multiplier = 1.25; // Pico Tarde (+25%)
    }
    
    calculatedFee = calculatedFee * multiplier;
    if (calculatedFee < config.base_fare) calculatedFee = config.base_fare;

    console.log(`🚗 [Cálculo de Frete da Loja] Destino: "${geo.address}" | Distância: ${distanceKm.toFixed(1)} km | Tarifa Base: R$ ${config.base_fare} | KM Extra: R$ ${config.extra_km_fee}/km | Frete Calculado: R$ ${calculatedFee.toFixed(2)}`);

    return {
        fee: parseFloat(calculatedFee.toFixed(2)),
        distanceKm: parseFloat(distanceKm.toFixed(1)),
        address: geo.address,
        isSimulated: true
    };
}

module.exports = {
    calculateShippingQuote
};
