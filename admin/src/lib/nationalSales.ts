export interface NationalSaleInfo {
  isNational: boolean;
  state: string;
  city: string;
  trackingCode?: string;
  shippingCostReal?: number;
  shippingFeeCharged?: number;
  fullAddress: string;
}

export interface NationalMetrics {
  totalRevenue: number;
  totalProfit: number;
  totalCmv: number;
  totalOrders: number;
  totalPodsSold: number;
  averageTicket: number;
  profitMargin: number;
  stateDistribution: { state: string; count: number; revenue: number }[];
  orders: any[];
}

export const BRAZILIAN_STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

/**
 * Identifica com 100% de segurança se um pedido é uma Venda Nacional (fora de SP / Correios)
 */
export function isOrderNational(order: any): boolean {
  if (!order) return false;

  // 1. Verificar propriedade dentro dos itens JSONB
  if (Array.isArray(order.items)) {
    if (order.items.some((item: any) => item && (item.is_national === true || item.isNational === true))) {
      return true;
    }
  }

  // 2. Verificar tag estruturada no endereço
  const addr = (typeof order.shipping_address === "string" ? order.shipping_address : "") || "";
  if (
    addr.includes("[ENVIO NACIONAL") ||
    addr.includes("[NACIONAL") ||
    addr.includes("[FORA DE SP") ||
    addr.includes("[CORREIOS")
  ) {
    return true;
  }

  return false;
}

/**
 * Extrai informações detalhadas de estado, cidade, rastreio e endereço de um pedido nacional
 */
export function extractNationalInfo(order: any): NationalSaleInfo {
  if (!order) {
    return {
      isNational: false,
      state: "",
      city: "",
      fullAddress: "",
    };
  }

  const isNational = isOrderNational(order);
  let state = "";
  let city = "";
  let trackingCode = "";
  let shippingCostReal = 0;
  const shippingFeeCharged = Number(order.shipping_fee) || 0;

  // 1. Tentar ler dos itens JSONB
  if (Array.isArray(order.items)) {
    for (const item of order.items) {
      if (item?.is_national || item?.isNational) {
        state = item.national_state || item.state || state;
        city = item.national_city || item.city || city;
        trackingCode = item.tracking_code || item.trackingCode || trackingCode;
        if (typeof item.shipping_cost_real === "number") {
          shippingCostReal = item.shipping_cost_real;
        }
      }
    }
  }

  const rawAddr = (typeof order.shipping_address === "string" ? order.shipping_address : "") || "";

  // 2. Extrair da string de endereço se ainda não identificou UF/cidade
  if (!state || !city) {
    const match = rawAddr.match(/\[(?:ENVIO )?NACIONAL:\s*([A-Za-z]{2})(?:\s*-\s*([^\]]+))?\]/i);
    if (match) {
      if (!state && match[1]) state = match[1].toUpperCase();
      if (!city && match[2]) city = match[2].trim();
    }
  }

  // 3. Extrair rastreio se estiver na string
  if (!trackingCode) {
    const trackMatch = rawAddr.match(/Rastreio:\s*([A-Za-z0-9]+)/i);
    if (trackMatch && trackMatch[1]) {
      trackingCode = trackMatch[1].trim();
    }
  }

  // Limpar prefixos da string de endereço para exibição amigável
  let cleanAddress = rawAddr
    .replace(/\[(?:ENVIO )?NACIONAL:[^\]]+\]\s*/gi, "")
    .replace(/\|\s*Rastreio:[^|]+$/gi, "")
    .trim();

  if (!cleanAddress) {
    cleanAddress = rawAddr;
  }

  return {
    isNational,
    state: state.toUpperCase(),
    city,
    trackingCode,
    shippingCostReal,
    shippingFeeCharged,
    fullAddress: cleanAddress,
  };
}

/**
 * Calcula métricas financeiras exclusivas de vendas nacionais
 */
export function calculateNationalMetrics(
  orders: any[],
  persistedCosts: Record<string, number> = {}
): NationalMetrics {
  const nationalOrders = (orders || []).filter((o) => isOrderNational(o));

  let totalRevenue = 0;
  let totalCmv = 0;
  let totalPodsSold = 0;
  const stateCounts: Record<string, { count: number; revenue: number }> = {};

  for (const order of nationalOrders) {
    const items = Array.isArray(order.items) ? order.items : [];
    let orderPodCount = 0;

    for (const item of items) {
      const qty = Number(item.quantity) || 1;
      const brand = (item.brand || "OUTROS").toUpperCase();
      const modelName = (item.name || "POD").toUpperCase();
      const itemPrice = Number(item.price || item.unit_price) || 0;
      const modelKey = (item.modelKey || `${brand}__${modelName}`).toLowerCase();

      let itemCost = Number(item.cost_price || item.costPrice) || 0;
      if (!itemCost && item.product_id && persistedCosts[item.product_id]) {
        itemCost = persistedCosts[item.product_id];
      }
      if (!itemCost) itemCost = 65;

      totalRevenue += qty * itemPrice;
      totalCmv += qty * itemCost;
      totalPodsSold += qty;
      orderPodCount += qty;
    }

    if (items.length === 0) {
      totalRevenue += Number(order.total_amount) || 0;
      totalCmv += (Number(order.total_amount) || 0) * 0.45;
      totalPodsSold += 1;
    }

    const info = extractNationalInfo(order);
    const uf = info.state || "OUTROS";
    if (!stateCounts[uf]) {
      stateCounts[uf] = { count: 0, revenue: 0 };
    }
    stateCounts[uf].count += 1;
    stateCounts[uf].revenue += Number(order.total_amount) || 0;
  }

  const totalProfit = Number((totalRevenue - totalCmv).toFixed(2));
  const profitMargin = totalRevenue > 0 ? parseFloat(((totalProfit / totalRevenue) * 100).toFixed(1)) : 0;
  const totalOrders = nationalOrders.length;
  const averageTicket = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

  const stateDistribution = Object.entries(stateCounts)
    .map(([state, data]) => ({
      state,
      count: data.count,
      revenue: Number(data.revenue.toFixed(2)),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalProfit,
    totalCmv: Number(totalCmv.toFixed(2)),
    totalOrders,
    totalPodsSold,
    averageTicket,
    profitMargin,
    stateDistribution,
    orders: nationalOrders,
  };
}
