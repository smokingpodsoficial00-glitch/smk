/**
 * Calculadora de Frete Real — Simulador OSRM
 * Replica a mesma lógica do backend/uberService.js para uso no emulador do Admin
 */

// Coordenadas de origem do estoque (São Bernardo do Campo)
const ORIGIN_LAT = -23.7168022;
const ORIGIN_LON = -46.5691653;

// Configuração padrão de frete (fallback caso não tenha no Supabase)
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
async function getDistanceOSRM(destLat: number, destLon: number): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${ORIGIN_LON},${ORIGIN_LAT};${destLon},${destLat}?overview=false`;
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
 * Puxa configurações dinâmicas de preço do Supabase (com fallback hardcoded)
 */
async function getDynamicShippingConfig() {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data, error } = await supabase
      .from('shipping_config')
      .select('*')
      .limit(1)
      .single();

    if (!error && data) {
      return {
        base_fare: parseFloat(data.base_fare) || DEFAULT_CONFIG.base_fare,
        included_km: parseFloat(data.included_km) || DEFAULT_CONFIG.included_km,
        extra_km_fee: parseFloat(data.extra_km_fee) || DEFAULT_CONFIG.extra_km_fee,
      };
    }
  } catch {
    console.log("ℹ️ Usando configuração padrão de frete (shipping_config não encontrada).");
  }
  return DEFAULT_CONFIG;
}

/**
 * Calcula o frete real baseado no CEP do cliente
 * Usa a mesma lógica do backend/uberService.js (Plano B: OSRM)
 */
export async function calculateShippingQuote(rawCep: string): Promise<ShippingQuote> {
  const cleanCep = rawCep.replace(/\D/g, '');
  let addressName = rawCep;
  let distanceKm = 3.0; // Fallback seguro

  // 1. Busca dados do CEP (coordenadas + endereço)
  if (cleanCep.length === 8) {
    const cepData = await getAddressFromCep(cleanCep);
    if (cepData) {
      addressName = `${cepData.address || ''}, ${cepData.district || ''}, ${cepData.city || ''} - ${cepData.state || ''}`;

      // 2. Calcula distância real via OSRM
      const lat = parseFloat(cepData.lat);
      const lon = parseFloat(cepData.lng);
      if (!isNaN(lat) && !isNaN(lon)) {
        const osrmDist = await getDistanceOSRM(lat, lon);
        if (osrmDist !== null) {
          distanceKm = osrmDist;
        }
      }
    }
  }

  // 3. Obtém parâmetros de preço (Supabase ou fallback)
  const config = await getDynamicShippingConfig();

  // 4. Calcula a tarifa
  let fee = 0;
  if (distanceKm <= config.included_km) {
    fee = config.base_fare;
  } else {
    const extraKm = distanceKm - config.included_km;
    fee = config.base_fare + (extraKm * config.extra_km_fee);
  }

  // 5. Multiplicador dinâmico baseado no horário (São Paulo)
  const now = new Date();
  const spTimeStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).format(now);

  const [hour, min] = spTimeStr.split(':').map(Number);
  const timeInMinutes = (hour * 60) + min;

  let multiplier = 1.0;
  // Almoço (11:30 às 13:30): +15%
  if (timeInMinutes >= (11 * 60 + 30) && timeInMinutes <= (13 * 60 + 30)) {
    multiplier = 1.15;
  }
  // Pico da Tarde/Noite (17:00 às 19:30): +25%
  else if (timeInMinutes >= (17 * 60) && timeInMinutes <= (19 * 60 + 30)) {
    multiplier = 1.25;
  }

  fee = fee * multiplier;

  // Garante um valor mínimo de frete
  if (fee < config.base_fare) fee = config.base_fare;

  console.log(`🤖 [Emulador OSRM] CEP: "${cleanCep}" | Distância: ${distanceKm.toFixed(1)} km | Multiplicador: ${multiplier}x | Frete: R$ ${fee.toFixed(2)}`);

  return {
    fee: parseFloat(fee.toFixed(2)),
    distanceKm: parseFloat(distanceKm.toFixed(1)),
    address: addressName,
  };
}
