/**
 * Módulo de Gestão de Ciclos Financeiros da Smoking Pods
 * Fuso Horário Obrigatório: America/Sao_Paulo (UTC-3)
 * Regra de Ciclo: Inicia no dia 14 às 00:00:00 e encerra no dia 13 às 23:59:59.999 do mês seguinte.
 * Exemplo: 14/08/2026 -> 13/09/2026 (Ciclo de Agosto/2026).
 */

export interface CycleDefinition {
  id: string; // Ex: "2026-08"
  year: number;
  month: number;
  name: string; // Ex: "Agosto/2026"
  monthName: string; // Ex: "Agosto"
  label: string; // Ex: "14/08/2026 → 13/09/2026"
  startDateStr: string; // "14/08/2026"
  endDateStr: string; // "13/09/2026"
  isCurrent: boolean;
  isClosed: boolean;
}

export interface CycleFinancialMetrics {
  cycle: CycleDefinition;
  grossRevenue: number;
  cmv: number;
  logisticsFee: number;
  netProfit: number;
  profitMargin: number;
  totalOrders: number;
  totalPodsSold: number;
  stockPurchases: number;
  freightRepurchases: number;
  totalInvestedRepurchases: number;
  realCash: number;
  averageTicket: number;
  averagePricePerPod: number;
  averageNetProfitPerOrder: number;
  orders: any[];
  repurchases: any[];
}

export interface ConsolidatedPeriod {
  id: string;
  name: string; // Ex: "2º Trimestre/2026", "1º Semestre/2026", "Ano 2026"
  label: string; // Ex: "14/02/2026 → 13/05/2026 (3 ciclos)"
  type: "mensal" | "trimestral" | "semestral" | "anual";
  includedCycles: CycleFinancialMetrics[];
  grossRevenue: number;
  cmv: number;
  logisticsFee: number;
  netProfit: number;
  profitMargin: number;
  totalOrders: number;
  totalPodsSold: number;
  stockPurchases: number;
  freightRepurchases: number;
  totalInvestedRepurchases: number;
  realCash: number;
  averageTicket: number;
  averagePricePerPod: number;
}

export const MONTH_NAMES = [
  "",
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DEFAULT_MODEL_COSTS: Record<string, number> = {
  "elfbar__ice king": 70,
  "lost mary__dura 35k": 65,
  "elfbar__bc15k": 48,
  "oxbar__50k": 65,
  "oxbar__g30k pro": 58,
  "ignite__v50": 65,
  "ignite__v80 ultra slim": 55,
  "ignite__frozen 20k": 65,
  "ignite__v250": 68,
  "elfbar__duke": 70,
  "elfbar__te30k": 65,
};

/**
 * Converte qualquer entrada de data para ano, mês e dia no fuso horário America/Sao_Paulo
 */
export function getSaoPauloDateParts(dateInput: string | Date | number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, day] = dateInput.split("-").map(Number);
    return { year: y, month: m, day, hour: 12, minute: 0, second: 0 };
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour || "0", 10),
    minute: parseInt(map.minute || "0", 10),
    second: parseInt(map.second || "0", 10),
  };
}

/**
 * Retorna a definição de um ciclo a partir do ano e mês do início do ciclo
 */
export function getCycleDef(year: number, month: number, referenceDate?: Date): CycleDefinition {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const startDayStr = `14/${String(month).padStart(2, "0")}/${year}`;
  const endDayStr = `13/${String(nextMonth).padStart(2, "0")}/${nextYear}`;
  const cycleId = `${year}-${String(month).padStart(2, "0")}`;

  const currentCycle = referenceDate ? getCycleForDate(referenceDate) : getCurrentCycle();
  const isCurrent = cycleId === currentCycle.id;
  const isClosed = cycleId < currentCycle.id;

  return {
    id: cycleId,
    year,
    month,
    name: `${MONTH_NAMES[month]}/${year}`,
    monthName: MONTH_NAMES[month],
    label: `${startDayStr} → ${endDayStr}`,
    startDateStr: startDayStr,
    endDateStr: endDayStr,
    isCurrent,
    isClosed,
  };
}

/**
 * Identifica o ciclo financeiro correspondente a uma data específica em America/Sao_Paulo
 * Regra:
 * Se o dia for >= 14: pertence ao ciclo do mês atual
 * Se o dia for < 14: pertence ao ciclo do mês anterior
 */
export function getCycleForDate(dateInput: string | Date | number): CycleDefinition {
  const parts = getSaoPauloDateParts(dateInput);
  const cMonth = parts.day >= 14 ? parts.month : parts.month === 1 ? 12 : parts.month - 1;
  const cYear = parts.day >= 14 ? parts.year : parts.month === 1 ? parts.year - 1 : parts.year;
  return getCycleDef(cYear, cMonth);
}

/**
 * Retorna o ciclo financeiro atual vigente
 */
export function getCurrentCycle(): CycleDefinition {
  const now = new Date();
  const parts = getSaoPauloDateParts(now);
  const cMonth = parts.day >= 14 ? parts.month : parts.month === 1 ? 12 : parts.month - 1;
  const cYear = parts.day >= 14 ? parts.year : parts.month === 1 ? parts.year - 1 : parts.year;

  const nextMonth = cMonth === 12 ? 1 : cMonth + 1;
  const nextYear = cMonth === 12 ? cYear + 1 : cYear;

  return {
    id: `${cYear}-${String(cMonth).padStart(2, "0")}`,
    year: cYear,
    month: cMonth,
    name: `${MONTH_NAMES[cMonth]}/${cYear}`,
    monthName: MONTH_NAMES[cMonth],
    label: `14/${String(cMonth).padStart(2, "0")}/${cYear} → 13/${String(nextMonth).padStart(2, "0")}/${nextYear}`,
    startDateStr: `14/${String(cMonth).padStart(2, "0")}/${cYear}`,
    endDateStr: `13/${String(nextMonth).padStart(2, "0")}/${nextYear}`,
    isCurrent: true,
    isClosed: false,
  };
}

/**
 * Filtra pedidos válidos (auditados: exclui CANCELADO e shadow records)
 */
export function filterValidOrders(orders: any[]): any[] {
  return (orders || []).filter(
    (o) =>
      o.delivery_status !== "CANCELADO" &&
      o.client_phone !== "__SYSTEM_SMK_BEST_SELLERS__" &&
      (!o.client_phone || !o.client_phone.startsWith("__SYSTEM_")) &&
      (!o.client_name || !o.client_name.toLowerCase().includes("system config"))
  );
}

/**
 * Calcula as métricas financeiras auditadas para um determinado ciclo
 */
export function calculateMetricsForCycle(
  cycle: CycleDefinition,
  orders: any[],
  repurchases: any[],
  persistedCosts: Record<string, number> = {}
): CycleFinancialMetrics {
  const validOrders = filterValidOrders(orders);

  // Filtrar pedidos que pertencem a este ciclo
  const cycleOrders = validOrders.filter((o) => {
    if (!o.created_at) return false;
    const c = getCycleForDate(o.created_at);
    return c.id === cycle.id;
  });

  // Filtrar recompras que pertencem a este ciclo
  const cycleRepurchases = (repurchases || []).filter((r) => {
    const repDate = r.purchase_date || r.created_at;
    if (!repDate) return false;
    const c = getCycleForDate(repDate);
    return c.id === cycle.id;
  });

  let revenueSum = 0;
  let cmvSum = 0;
  let shippingSum = 0;
  let podsSoldSum = 0;

  for (const order of cycleOrders) {
    const shippingFee = parseFloat(order.shipping_fee || 0);
    shippingSum += shippingFee;

    const items = Array.isArray(order.items) ? order.items : [];
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
      if (!itemCost && modelKey && DEFAULT_MODEL_COSTS[modelKey]) {
        itemCost = DEFAULT_MODEL_COSTS[modelKey];
      }
      if (!itemCost) itemCost = 65;

      revenueSum += qty * itemPrice;
      cmvSum += qty * itemCost;
      podsSoldSum += qty;
    }
  }

  const netProfit = Number((revenueSum - cmvSum).toFixed(2));
  const profitMargin = revenueSum > 0 ? parseFloat(((netProfit / revenueSum) * 100).toFixed(1)) : 0;
  const totalOrders = cycleOrders.length;

  const stockPurchases = Number(cycleRepurchases.reduce((sum, r) => sum + (Number(r.stock_purchase_amount) || 0), 0).toFixed(2));
  const freightRepurchases = Number(cycleRepurchases.reduce((sum, r) => sum + (Number(r.freight_amount) || 0), 0).toFixed(2));
  const totalInvestedRepurchases = Number((stockPurchases + freightRepurchases).toFixed(2));

  // Caixa Real do ciclo: Faturamento do ciclo menos recompras do ciclo
  const realCash = Number((revenueSum - stockPurchases).toFixed(2));

  const averageTicket = totalOrders > 0 ? Number((revenueSum / totalOrders).toFixed(2)) : 0;
  const averagePricePerPod = podsSoldSum > 0 ? Number((revenueSum / podsSoldSum).toFixed(2)) : 0;
  const averageNetProfitPerOrder = totalOrders > 0 ? Number((netProfit / totalOrders).toFixed(2)) : 0;

  return {
    cycle,
    grossRevenue: Number(revenueSum.toFixed(2)),
    cmv: Number(cmvSum.toFixed(2)),
    logisticsFee: Number(shippingSum.toFixed(2)),
    netProfit,
    profitMargin,
    totalOrders,
    totalPodsSold: podsSoldSum,
    stockPurchases,
    freightRepurchases,
    totalInvestedRepurchases,
    realCash,
    averageTicket,
    averagePricePerPod,
    averageNetProfitPerOrder,
    orders: cycleOrders,
    repurchases: cycleRepurchases,
  };
}

/**
 * Gera a lista ordenada de todos os ciclos históricos mensais desde o primeiro registro até o atual
 * Garante que todos os meses do ano desde Fevereiro/2026 estejam presentes para consulta
 */
export function generateHistoricalMonthlyCycles(
  orders: any[],
  repurchases: any[],
  persistedCosts: Record<string, number> = {}
): CycleFinancialMetrics[] {
  const currentCycle = getCurrentCycle();

  // Lista base garantida dos meses de 2026 (a partir de Fevereiro/2026 até o ciclo vigente)
  const cycleMap = new Map<string, CycleDefinition>();

  // Sempre garantir no mínimo os ciclos de Fevereiro a Setembro de 2026 (ou ano atual)
  const startMonth = 2; // Fevereiro
  const currentYear = currentCycle.year;
  const currentMonth = currentCycle.month;

  for (let m = startMonth; m <= currentMonth; m++) {
    const def = getCycleDef(currentYear, m);
    cycleMap.set(def.id, def);
  }

  // Também identificar qualquer data em orders ou repurchases para não deixar nenhum ciclo de fora
  const validOrders = filterValidOrders(orders);
  for (const o of validOrders) {
    if (o.created_at) {
      const def = getCycleForDate(o.created_at);
      if (!cycleMap.has(def.id)) {
        cycleMap.set(def.id, def);
      }
    }
  }

  for (const r of repurchases || []) {
    const d = r.purchase_date || r.created_at;
    if (d) {
      const def = getCycleForDate(d);
      if (!cycleMap.has(def.id)) {
        cycleMap.set(def.id, def);
      }
    }
  }

  // Ordenar decrescente (mais recente primeiro)
  const sortedCycles = Array.from(cycleMap.values()).sort((a, b) => b.id.localeCompare(a.id));

  return sortedCycles.map((cycle) => calculateMetricsForCycle(cycle, orders, repurchases, persistedCosts));
}

/**
 * Consolida uma lista de ciclos mensais em um único período agregado
 */
export function aggregateCycles(
  id: string,
  name: string,
  type: "trimestral" | "semestral" | "anual",
  cycles: CycleFinancialMetrics[]
): ConsolidatedPeriod {
  let grossRevenue = 0;
  let cmv = 0;
  let logisticsFee = 0;
  let totalOrders = 0;
  let totalPodsSold = 0;
  let stockPurchases = 0;
  let freightRepurchases = 0;

  for (const c of cycles) {
    grossRevenue += c.grossRevenue;
    cmv += c.cmv;
    logisticsFee += c.logisticsFee;
    totalOrders += c.totalOrders;
    totalPodsSold += c.totalPodsSold;
    stockPurchases += c.stockPurchases;
    freightRepurchases += c.freightRepurchases;
  }

  const netProfit = Number((grossRevenue - cmv).toFixed(2));
  const profitMargin = grossRevenue > 0 ? parseFloat(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;
  const totalInvestedRepurchases = Number((stockPurchases + freightRepurchases).toFixed(2));
  const realCash = Number((grossRevenue - stockPurchases).toFixed(2));
  const averageTicket = totalOrders > 0 ? Number((grossRevenue / totalOrders).toFixed(2)) : 0;
  const averagePricePerPod = totalPodsSold > 0 ? Number((grossRevenue / totalPodsSold).toFixed(2)) : 0;

  const firstCycle = cycles[cycles.length - 1]?.cycle;
  const lastCycle = cycles[0]?.cycle;
  const label = firstCycle && lastCycle
    ? `${firstCycle.startDateStr} → ${lastCycle.endDateStr} (${cycles.length} ciclos)`
    : `${cycles.length} ciclos`;

  return {
    id,
    name,
    label,
    type,
    includedCycles: cycles,
    grossRevenue: Number(grossRevenue.toFixed(2)),
    cmv: Number(cmv.toFixed(2)),
    logisticsFee: Number(logisticsFee.toFixed(2)),
    netProfit,
    profitMargin,
    totalOrders,
    totalPodsSold,
    stockPurchases: Number(stockPurchases.toFixed(2)),
    freightRepurchases: Number(freightRepurchases.toFixed(2)),
    totalInvestedRepurchases,
    realCash,
    averageTicket,
    averagePricePerPod,
  };
}

/**
 * Retorna a métrica de um ciclo existente ou gera um ciclo com métricas zeradas
 */
function getOrCreateCycleMetric(
  year: number,
  month: number,
  monthlyMetricsMap: Map<string, CycleFinancialMetrics>
): CycleFinancialMetrics {
  const cycleId = `${year}-${String(month).padStart(2, "0")}`;
  if (monthlyMetricsMap.has(cycleId)) {
    return monthlyMetricsMap.get(cycleId)!;
  }
  const cycle = getCycleDef(year, month);
  return {
    cycle,
    grossRevenue: 0,
    cmv: 0,
    logisticsFee: 0,
    netProfit: 0,
    profitMargin: 0,
    totalOrders: 0,
    totalPodsSold: 0,
    stockPurchases: 0,
    freightRepurchases: 0,
    totalInvestedRepurchases: 0,
    realCash: 0,
    averageTicket: 0,
    averagePricePerPod: 0,
    averageNetProfitPerOrder: 0,
    orders: [],
    repurchases: [],
  };
}

/**
 * Gera consolidações Trimestrais (cada trimestre = exatamente 3 ciclos mensais consecutivos)
 */
export function generateHistoricalQuarters(
  monthlyMetrics: CycleFinancialMetrics[]
): ConsolidatedPeriod[] {
  const metricsMap = new Map<string, CycleFinancialMetrics>();
  monthlyMetrics.forEach((m) => metricsMap.set(m.cycle.id, m));

  const quarters: ConsolidatedPeriod[] = [];
  const quarterDefs = [
    { num: 1, name: "1º Trimestre (Fev / Mar / Abr)", months: [2, 3, 4] },
    { num: 2, name: "2º Trimestre (Mai / Jun / Jul)", months: [5, 6, 7] },
    { num: 3, name: "3º Trimestre (Ago / Set / Out)", months: [8, 9, 10] },
    { num: 4, name: "4º Trimestre (Nov / Dez / Jan)", months: [11, 12, 1] },
  ];

  const currentYear = getCurrentCycle().year;

  quarterDefs.forEach((q) => {
    // Cada trimestre consolida estritamente os seus 3 ciclos
    const included: CycleFinancialMetrics[] = q.months.map((m) => {
      const y = q.num === 4 && m === 1 ? currentYear + 1 : currentYear;
      return getOrCreateCycleMetric(y, m, metricsMap);
    });

    // Inclui o trimestre se pelo menos um dos ciclos possui histórico ou se pertence ao ano corrente
    const hasDataOrCurrent = included.some((m) => m.cycle.isCurrent || m.cycle.isClosed);
    if (hasDataOrCurrent) {
      quarters.push(
        aggregateCycles(
          `quarter-${currentYear}-Q${q.num}`,
          `${q.name} · ${currentYear}`,
          "trimestral",
          included.sort((a, b) => b.cycle.id.localeCompare(a.cycle.id))
        )
      );
    }
  });

  return quarters.reverse();
}

/**
 * Gera consolidações Semestrais (cada semestre = exatamente 6 ciclos mensais consecutivos)
 */
export function generateHistoricalSemesters(
  monthlyMetrics: CycleFinancialMetrics[]
): ConsolidatedPeriod[] {
  const metricsMap = new Map<string, CycleFinancialMetrics>();
  monthlyMetrics.forEach((m) => metricsMap.set(m.cycle.id, m));

  const semesters: ConsolidatedPeriod[] = [];
  const currentYear = getCurrentCycle().year;

  // 1º Semestre: Fevereiro a Julho (exatamente 6 ciclos)
  const s1Months = [2, 3, 4, 5, 6, 7];
  const s1Cycles: CycleFinancialMetrics[] = s1Months.map((m) =>
    getOrCreateCycleMetric(currentYear, m, metricsMap)
  );
  semesters.push(
    aggregateCycles(
      `sem-${currentYear}-S1`,
      `1º Semestre · ${currentYear} (Fev a Jul)`,
      "semestral",
      s1Cycles.sort((a, b) => b.cycle.id.localeCompare(a.cycle.id))
    )
  );

  // 2º Semestre: Agosto a Janeiro (exatamente 6 ciclos)
  const s2Months = [
    { y: currentYear, m: 8 },
    { y: currentYear, m: 9 },
    { y: currentYear, m: 10 },
    { y: currentYear, m: 11 },
    { y: currentYear, m: 12 },
    { y: currentYear + 1, m: 1 },
  ];
  const s2Cycles: CycleFinancialMetrics[] = s2Months.map((item) =>
    getOrCreateCycleMetric(item.y, item.m, metricsMap)
  );
  semesters.push(
    aggregateCycles(
      `sem-${currentYear}-S2`,
      `2º Semestre · ${currentYear} (Ago a Jan)`,
      "semestral",
      s2Cycles.sort((a, b) => b.cycle.id.localeCompare(a.cycle.id))
    )
  );

  return semesters.reverse();
}

/**
 * Gera consolidações Anuais (consolidação de exatamente 12 ciclos mensais)
 */
export function generateHistoricalYears(
  monthlyMetrics: CycleFinancialMetrics[]
): ConsolidatedPeriod[] {
  const metricsMap = new Map<string, CycleFinancialMetrics>();
  monthlyMetrics.forEach((m) => metricsMap.set(m.cycle.id, m));

  const years: ConsolidatedPeriod[] = [];
  const currentYear = getCurrentCycle().year;

  // O ano financeiro é composto por 12 ciclos mensais: Fev a Dez do ano corrente + Jan do ano seguinte
  const yearMonths = [
    { y: currentYear, m: 2 },
    { y: currentYear, m: 3 },
    { y: currentYear, m: 4 },
    { y: currentYear, m: 5 },
    { y: currentYear, m: 6 },
    { y: currentYear, m: 7 },
    { y: currentYear, m: 8 },
    { y: currentYear, m: 9 },
    { y: currentYear, m: 10 },
    { y: currentYear, m: 11 },
    { y: currentYear, m: 12 },
    { y: currentYear + 1, m: 1 },
  ];

  const yearCycles: CycleFinancialMetrics[] = yearMonths.map((item) =>
    getOrCreateCycleMetric(item.y, item.m, metricsMap)
  );

  years.push(
    aggregateCycles(
      `year-${currentYear}`,
      `Ano Financeiro · ${currentYear}`,
      "anual",
      yearCycles.sort((a, b) => b.cycle.id.localeCompare(a.cycle.id))
    )
  );

  return years;
}

export interface AllTimeFinancialMetrics {
  grossRevenue: number;
  cmv: number;
  logisticsFee: number;
  netProfit: number;
  profitMargin: number;
  totalOrders: number;
  totalPodsSold: number;
  averageTicket: number;
  averagePricePerPod: number;
  averageNetProfitPerOrder: number;
  stockPurchases: number;
  freightRepurchases: number;
  totalInvestedRepurchases: number;
  realCash: number;
}

/**
 * Calcula os indicadores acumulados históricos completos (All-Time)
 * Utilizados para Eficiência Comercial e Caixa Real (que NÃO reiniciam no dia 14)
 */
export function calculateAllTimeMetrics(
  orders: any[],
  repurchases: any[] = [],
  persistedCosts: Record<string, number> = {},
  partnerTransactions: any[] = []
): AllTimeFinancialMetrics {
  const validOrders = filterValidOrders(orders);

  let revenueSum = 0;
  let cmvSum = 0;
  let shippingSum = 0;
  let podsSoldSum = 0;

  for (const order of validOrders) {
    const shippingFee = parseFloat(order.shipping_fee || 0);
    shippingSum += shippingFee;

    const items = Array.isArray(order.items) ? order.items : [];
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
      if (!itemCost && modelKey && DEFAULT_MODEL_COSTS[modelKey]) {
        itemCost = DEFAULT_MODEL_COSTS[modelKey];
      }
      if (!itemCost) itemCost = 65;

      revenueSum += qty * itemPrice;
      cmvSum += qty * itemCost;
      podsSoldSum += qty;
    }
  }

  const netProfit = Number((revenueSum - cmvSum).toFixed(2));
  const profitMargin = revenueSum > 0 ? parseFloat(((netProfit / revenueSum) * 100).toFixed(1)) : 0;
  const totalOrders = validOrders.length;

  const stockPurchases = Number(
    (repurchases || []).reduce((sum, r) => sum + (Number(r.stock_purchase_amount) || 0), 0).toFixed(2)
  );
  const freightRepurchases = Number(
    (repurchases || []).reduce((sum, r) => sum + (Number(r.freight_amount) || 0), 0).toFixed(2)
  );
  const totalInvestedRepurchases = Number((stockPurchases + freightRepurchases).toFixed(2));

  // CAIXA REAL ATUAL (Tesouraria + Operação)
  // 1. O capital inicial investido no negócio (R$ 1.105) já foi absorvido na compra inicial de estoque
  //    (não contabilizada no repurchases). Se somarmos ele cegamente, o caixa duplica.
  //    Portanto, "Aportes" com destination_category === 'ESTOQUE' (que é o caso do aporte inicial)
  //    não entram aqui para não duplicar patrimônio artificialmente.
  //    Apenas aportes direcionados explicitamente para 'CAIXA_GERAL' somam dinheiro na conta.
  // 2. Retiradas de Capital, Distribuição de Lucro, Pró-Labore subtraem do caixa imediatamente.
  let capitalInflows = 0;
  let capitalOutflows = 0;

  for (const tx of partnerTransactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'APORTE' && (tx.destination_category === 'CAIXA' || tx.destination_category === 'CAIXA_GERAL')) {
      capitalInflows += amt;
    }
    if (['RETIRADA_CAPITAL', 'DISTRIBUICAO_LUCRO', 'PRO_LABORE', 'DESPESA_OPERACIONAL', 'COMPRA_ESTOQUE'].includes(tx.type)) {
      capitalOutflows += amt;
    }
  }

  // Caixa puramente operacional (Vendas - Compras de Reposição)
  const operationalCash = revenueSum - stockPurchases;

  // Caixa Real (Operacional + Injeções em Caixa - Retiradas)
  const realCash = Number((operationalCash + capitalInflows - capitalOutflows).toFixed(2));

  const averageTicket = totalOrders > 0 ? Number((revenueSum / totalOrders).toFixed(2)) : 0;
  const averagePricePerPod = podsSoldSum > 0 ? Number((revenueSum / podsSoldSum).toFixed(2)) : 0;
  const averageNetProfitPerOrder = totalOrders > 0 ? Number((netProfit / totalOrders).toFixed(2)) : 0;

  return {
    grossRevenue: Number(revenueSum.toFixed(2)),
    cmv: Number(cmvSum.toFixed(2)),
    logisticsFee: Number(shippingSum.toFixed(2)),
    netProfit,
    profitMargin,
    totalOrders,
    totalPodsSold: podsSoldSum,
    averageTicket,
    averagePricePerPod,
    averageNetProfitPerOrder,
    stockPurchases,
    freightRepurchases,
    totalInvestedRepurchases,
    realCash,
  };
}

/**
 * Indicador de Evolução Percentual em relação ao período anterior equivalente
 */
export interface PeriodEvolution {
  diffPercent: number | null;
  text: string;
  arrow: "↑" | "↓" | "→" | "";
  direction: "up" | "down" | "neutral" | "none";
  labelVs: string;
  hasComparison: boolean;
}

/**
 * Calcula a variação percentual entre o período atual e o anterior com proteção contra divisão por zero
 * Fórmula: ((atual - anterior) / |anterior|) * 100
 */
export function calculateMetricEvolution(
  currentValue: number,
  previousValue: number | null | undefined,
  periodLabel: string = "período anterior"
): PeriodEvolution {
  if (previousValue === null || previousValue === undefined) {
    return {
      diffPercent: null,
      text: "Sem comparação",
      arrow: "",
      direction: "none",
      labelVs: `vs. ${periodLabel}`,
      hasComparison: false,
    };
  }

  // Se o período anterior for 0
  if (previousValue === 0) {
    if (currentValue === 0) {
      return {
        diffPercent: 0,
        text: "0%",
        arrow: "→",
        direction: "neutral",
        labelVs: `vs. ${periodLabel}`,
        hasComparison: true,
      };
    }
    // Período anterior era zero e atual != 0: impossível calcular percentual matemático seguro
    return {
      diffPercent: null,
      text: "Sem comparação",
      arrow: "",
      direction: "none",
      labelVs: `vs. ${periodLabel}`,
      hasComparison: false,
    };
  }

  const diff = currentValue - previousValue;
  const pct = (diff / Math.abs(previousValue)) * 100;
  const rounded = Math.round(pct * 10) / 10;

  if (Math.abs(rounded) < 0.05) {
    return {
      diffPercent: 0,
      text: "0%",
      arrow: "→",
      direction: "neutral",
      labelVs: `vs. ${periodLabel}`,
      hasComparison: true,
    };
  }

  if (rounded > 0) {
    const formatted = `+${rounded.toFixed(1)}%`;
    return {
      diffPercent: rounded,
      text: formatted,
      arrow: "↑",
      direction: "up",
      labelVs: `vs. ${periodLabel}`,
      hasComparison: true,
    };
  } else {
    const formatted = `${rounded.toFixed(1)}%`;
    return {
      diffPercent: rounded,
      text: formatted,
      arrow: "↓",
      direction: "down",
      labelVs: `vs. ${periodLabel}`,
      hasComparison: true,
    };
  }
}

export interface GroupedPeriodEvolution {
  grossRevenue: PeriodEvolution;
  cmv: PeriodEvolution;
  logisticsFee: PeriodEvolution;
  netProfit: PeriodEvolution;
}

/**
 * Calcula a evolução de todos os 4 indicadores principais de um período
 */
export function calculatePeriodEvolutions(
  current: { grossRevenue: number; cmv: number; logisticsFee: number; netProfit: number } | null | undefined,
  previous: { grossRevenue: number; cmv: number; logisticsFee: number; netProfit: number } | null | undefined,
  periodLabel: string = "período anterior"
): GroupedPeriodEvolution {
  return {
    grossRevenue: calculateMetricEvolution(current?.grossRevenue ?? 0, previous?.grossRevenue, periodLabel),
    cmv: calculateMetricEvolution(current?.cmv ?? 0, previous?.cmv, periodLabel),
    logisticsFee: calculateMetricEvolution(current?.logisticsFee ?? 0, previous?.logisticsFee, periodLabel),
    netProfit: calculateMetricEvolution(current?.netProfit ?? 0, previous?.netProfit, periodLabel),
  };
}

