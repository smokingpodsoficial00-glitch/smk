/**
 * Calculadora de Frete Real — Simulador OSRM
 * Replica a mesma lógica do backend/uberService.js para uso no emulador do Admin
 */

// Fallback de coordenadas de origem (São Bernardo do Campo)
const DEFAULT_ORIGIN_LAT = -23.7168022;
const DEFAULT_ORIGIN_LON = -46.5691653;

// Configuração padrão de frete (fallback)
const DEFAULT_CONFIG = {
  base_fare: 8.50,
  included_km: 3.0,
  extra_km_fee: 1.40,
};

export interface ShippingQuote {
  fee: number;
  distanceKm: number;
  address: string;
}

/**
 * Busca dados completos do CEP usando a API AwesomeAPI (retorna lat/lon e endereço)
 */
async function getAddressFromCep(cep: string) {
  const cleanedCep = cep.replace(/\D/g, '');
  try {
    const res = await fetch(`https://cep.awesomeapi.com.br/json/${cleanedCep}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.lat && data.lng) {
        return data;
      }
    }
  } catch (e) {
    console.warn(`⚠️ Erro ao buscar CEP ${cleanedCep} na AwesomeAPI:`, e);
  }
  return null;
}

/**
 * Obtém a distância real em KM via OSRM (Open Source Routing Machine)
 */
async function getDistanceOSRM(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        return data.routes[0].distance / 1000; // Metros para KM
      }
    }
  } catch (e) {
    console.warn("⚠️ OSRM Error:", e);
  }
  return null;
}

/**
 * Puxa configurações dinâmicas de frete e coordenadas da loja no Supabase
 */
async function getDynamicShippingConfig() {
  let config = {
    base_fare: DEFAULT_CONFIG.base_fare,
    included_km: DEFAULT_CONFIG.included_km,
    extra_km_fee: DEFAULT_CONFIG.extra_km_fee,
    originLat: DEFAULT_ORIGIN_LAT,
    originLon: DEFAULT_ORIGIN_LON,
  };

  try {
    const { supabase } = await import("@/lib/supabase");
    // 1. Tentar ler da store_config
    const { data: storeData } = await supabase
      .from('store_config')
      .select('*')
      .limit(1)
      .single();

    if (storeData) {
      if (storeData.base_fare) config.base_fare = parseFloat(storeData.base_fare);
      if (storeData.included_km) config.included_km = parseFloat(storeData.included_km);
      if (storeData.extra_km_fee) config.extra_km_fee = parseFloat(storeData.extra_km_fee);

      // Se a loja cadastrou um CEP de origem, geocodifica ele
      const originCep = storeData.origin_cep || (storeData.address ? storeData.address.match(/\b\d{5}-?\d{3}\b/)?.[0] : null);
      if (originCep) {
        const originGeo = await getAddressFromCep(originCep);
        if (originGeo && originGeo.lat && originGeo.lng) {
          config.originLat = parseFloat(originGeo.lat);
          config.originLon = parseFloat(originGeo.lng);
        }
      }
    }

    // 2. Tentar ler da shipping_config como fallback adicional
    const { data: shipData } = await supabase
      .from('shipping_config')
      .select('*')
      .limit(1)
      .single();

    if (shipData) {
      if (shipData.base_fare) config.base_fare = parseFloat(shipData.base_fare);
      if (shipData.included_km) config.included_km = parseFloat(shipData.included_km);
      if (shipData.extra_km_fee) config.extra_km_fee = parseFloat(shipData.extra_km_fee);
    }
  } catch (e) {
    console.log("ℹ️ Usando parâmetros padrão de frete.");
  }
  return config;
}

/**
 * Calcula o frete real baseado no CEP do cliente
 * Usa a mesma lógica do backend/uberService.js (Plano B: OSRM)
 */
export async function calculateShippingQuote(rawCep: string): Promise<ShippingQuote> {
  const cleanCep = rawCep.replace(/\D/g, '');
  let addressName = rawCep;
  let distanceKm = 3.0; // Fallback seguro

  // 1. Obtém parâmetros de preço e coordenadas de origem da loja
  const config = await getDynamicShippingConfig();

  // 2. Busca dados do CEP do cliente (coordenadas + endereço)
  if (cleanCep.length === 8) {
    const cepData = await getAddressFromCep(cleanCep);
    if (cepData) {
      addressName = `${cepData.address || ''}, ${cepData.district || ''}, ${cepData.city || ''} - ${cepData.state || ''}`;

      // 3. Calcula distância real via OSRM entre origem da loja e cliente
      const lat = parseFloat(cepData.lat);
      const lon = parseFloat(cepData.lng);
      if (!isNaN(lat) && !isNaN(lon)) {
        const osrmDist = await getDistanceOSRM(config.originLat, config.originLon, lat, lon);
        if (osrmDist !== null) {
          distanceKm = osrmDist;
        }
      }
    }
  }

  // 4. Calcula a tarifa
  let fee = 0;
  let multiplier = 1.0;

  if (distanceKm <= config.included_km) {
    // Até o limite de KM incluso (3km), a taxa é SEMPRE o valor base fixo (ex: R$ 8,50)
    fee = config.base_fare;
  } else {
    // Acima do KM incluso, aplica taxa extra por KM e multiplicadores dinâmicos de trânsito
    const extraKm = distanceKm - config.included_km;
    fee = config.base_fare + (extraKm * config.extra_km_fee);

    const now = new Date();
    const spTimeStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).format(now);

    const [hour, min] = spTimeStr.split(':').map(Number);
    const timeInMinutes = (hour * 60) + min;

    if (timeInMinutes >= (11 * 60 + 30) && timeInMinutes <= (13 * 60 + 30)) {
      multiplier = 1.15;
    } else if (timeInMinutes >= (17 * 60) && timeInMinutes <= (19 * 60 + 30)) {
      multiplier = 1.25;
    }

    fee = fee * multiplier;
  }

  // Garante um valor mínimo de frete
  if (fee < config.base_fare) fee = config.base_fare;

  console.log(`🤖 [Emulador OSRM] CEP: "${cleanCep}" | Distância: ${distanceKm.toFixed(1)} km | Multiplicador: ${multiplier}x | Frete: R$ ${fee.toFixed(2)}`);

  return {
    fee: parseFloat(fee.toFixed(2)),
    distanceKm: parseFloat(distanceKm.toFixed(1)),
    address: addressName,
  };
}
