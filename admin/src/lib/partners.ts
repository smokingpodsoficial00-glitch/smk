import { supabase } from "@/lib/supabase";

export type PartnerTransactionType = 
  | 'APORTE'              // Entrada de capital novo do sócio na empresa (Altera Capital e % de Equity)
  | 'RETIRADA_CAPITAL'    // Retirada de capital investido pelo sócio (Reduz Capital e % de Equity)
  | 'DISTRIBUICAO_LUCRO'  // Dividendos pagos ao sócio (Saída de caixa)
  | 'PRO_LABORE'          // Remuneração operacional (Despesa de caixa)
  | 'COMPRA_ESTOQUE'      // Compra de pods com caixa
  | 'DESPESA_OPERACIONAL' // Despesa operacional
  | 'REINVESTIMENTO_LUCRO';

export interface Partner {
  id: string;
  company_id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  avatar_color: string;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PartnerTransaction {
  id: string;
  company_id?: string | null;
  partner_id?: string | null;
  partner_name?: string | null;
  type: PartnerTransactionType;
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  destination_category: string;
  created_at: string;
}

export interface PartnerFinancialMetrics {
  partner: Partner;
  equityPercentage: number; // Derivado: (netCapitalInvested / totalNetCapitalInvested) * 100
  grossCapitalContributed: number; // Soma de APORTE do sócio
  capitalWithdrawn: number; // Soma de RETIRADA_CAPITAL do sócio
  netCapitalInvested: number; // Aportes - Retiradas
  dividendsReceived: number;
  proLaboreReceived: number;
  
  // PROJEÇÃO AUTOMÁTICA DE LUCRO SOBRE O CAPITAL (Consumindo a Margem Oficial do Financeiro)
  officialProfitMarginPct: number; // Margem oficial consumida da Inteligência Financeira
  projectedProfit: number; // Capital Investido * (Margem Oficial / 100)
  projectedEconomicEquity: number; // Capital Investido + Lucro Projetado
  projectedROI: number; // (Lucro Projetado / Capital Investido) * 100 (equivalente à Margem %)
  
  // RESULTADO REAL HISTÓRICO & PATRIMÔNIO REAL (Consumido da Inteligência Financeira)
  partnerEconomicEquity: number; // companyEconomicEquity * (equityPercentage / 100)
  economicProfitShare: number; // netProfitRealized * (equityPercentage / 100) -> "Parcela do Lucro Realizado"
  economicGain: number; // partnerEconomicEquity - netCapitalInvested
  simplifiedROI: number; // (economicGain / netCapitalInvested) * 100
  stockCostShare: number; // stockAssetCost * (equityPercentage / 100)
  stockRetailShare: number; // stockAssetRetail * (equityPercentage / 100)
  stockPodUnitsEquivalent: number; // stockAssetUnits * (equityPercentage / 100)
}

export interface CompanyFinancialOverview {
  // 1. Dados Financeiros Oficiais (FONTE ÚNICA: DRE da Inteligência Financeira)
  grossRevenue: number; // Faturamento Bruto Real
  cmv: number; // Custo Reposição (CMV)
  logisticsFee: number; // Frete Total (Logística)
  operationalExpenses: number; // Marketing (Meta Ads) e outras despesas
  netProfitRealized: number; // Lucro Líquido Real das Vendas
  netProfitMarginPct: number; // Margem líquida calculada no DRE
  officialProfitMarginPct: number; // MARGEM OFICIAL ATIVA UTILIZADA PARA PROJEÇÕES
  retainedProfit: number;
  totalOrdersCount: number;
  totalPodsSold: number;

  // 2. Projeções Totais da Sociedade (Baseadas na Margem Oficial)
  companyTotalProjectedProfit: number; // Total de Lucro Projetado para todos os aportes
  companyTotalProjectedEquity: number; // Total de Capital + Lucro Projetado

  // 3. Estoque Oficial
  stockAssetUnits: number; // Pods no estoque ativo
  stockAssetCost: number; // Custo dos Pods na Prateleira
  stockAssetRetail: number; // Valor de Venda do Estoque
  stockPotentialGrossMargin: number; // Lucro Potencial do Estoque

  // 4. Tesouraria & Caixa
  netCashAvailable: number; // Saldo em Conta / Caixa Disponível Oficial

  // 5. Patrimônio Oficial da Loja (FONTE DE VERDADE: Caixa em Conta + Venda Total do Estoque)
  companyEconomicEquity: number;

  // 6. Estrutura Societária (Cap Table Automático)
  totalNetCapitalInvested: number;
  totalEquitySum: number;
  isCapTableBalanced: boolean;
  hasDefinedCapital: boolean;
  partnerMetrics: PartnerFinancialMetrics[];
}

export const TRANSACTION_TYPE_CONFIG: Record<PartnerTransactionType, {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isPartnerSpecific: boolean;
  cashFlowImpact: 'ENTRADA' | 'SAIDA' | 'NEUTRO';
  altersCapital: boolean;
  descriptionPlaceholder: string;
}> = {
  APORTE: {
    label: 'Aporte de Capital',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/20',
    isPartnerSpecific: true,
    cashFlowImpact: 'ENTRADA',
    altersCapital: true,
    descriptionPlaceholder: 'Ex: Aporte de capital do sócio'
  },
  RETIRADA_CAPITAL: {
    label: 'Retirada de Capital',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-400',
    badgeBorder: 'border-rose-500/20',
    isPartnerSpecific: true,
    cashFlowImpact: 'SAIDA',
    altersCapital: true,
    descriptionPlaceholder: 'Ex: Retirada de capital do sócio'
  },
  DISTRIBUICAO_LUCRO: {
    label: 'Distribuição de Lucro',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/20',
    isPartnerSpecific: true,
    cashFlowImpact: 'SAIDA',
    altersCapital: false,
    descriptionPlaceholder: 'Ex: Pagamento de dividendos'
  },
  PRO_LABORE: {
    label: 'Pró-Labore',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    badgeBorder: 'border-purple-500/20',
    isPartnerSpecific: true,
    cashFlowImpact: 'SAIDA',
    altersCapital: false,
    descriptionPlaceholder: 'Ex: Remuneração operacional'
  },
  COMPRA_ESTOQUE: {
    label: 'Compra de Estoque (Lote)',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-400',
    badgeBorder: 'border-blue-500/20',
    isPartnerSpecific: false,
    cashFlowImpact: 'SAIDA',
    altersCapital: false,
    descriptionPlaceholder: 'Ex: Pagamento de lote'
  },
  DESPESA_OPERACIONAL: {
    label: 'Despesa Operacional',
    badgeBg: 'bg-orange-500/10',
    badgeText: 'text-orange-400',
    badgeBorder: 'border-orange-500/20',
    isPartnerSpecific: false,
    cashFlowImpact: 'SAIDA',
    altersCapital: false,
    descriptionPlaceholder: 'Ex: Tráfego pago'
  },
  REINVESTIMENTO_LUCRO: {
    label: 'Reinvestimento de Lucro',
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-400',
    badgeBorder: 'border-cyan-500/20',
    isPartnerSpecific: false,
    cashFlowImpact: 'NEUTRO',
    altersCapital: false,
    descriptionPlaceholder: 'Ex: Retenção de lucro'
  }
};

const DEFAULT_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
const LOCAL_STORAGE_PARTNERS_KEY = "smk_partners_list_v4";
const LOCAL_STORAGE_TRANSACTIONS_KEY = "smk_partner_transactions_v4";

export const DEFAULT_MODEL_COSTS: Record<string, number> = {
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

// ─── Dados Reais Informados: Eduardo (R$ 500,00) | Gabriel (R$ 605,00) ──────
export const INITIAL_DEFAULT_PARTNERS: Partner[] = [
  {
    id: "p1-eduardo",
    company_id: DEFAULT_COMPANY_ID,
    name: "Eduardo",
    email: "eduardo@smokingpods.com",
    role: "Sócio",
    avatar_color: "#10b981",
    is_active: true,
    notes: null,
    created_at: new Date().toISOString()
  },
  {
    id: "p2-gabriel",
    company_id: DEFAULT_COMPANY_ID,
    name: "Gabriel",
    email: "gabriel@smokingpods.com",
    role: "Sócio",
    avatar_color: "#3b82f6",
    is_active: true,
    notes: null,
    created_at: new Date().toISOString()
  }
];

export const INITIAL_DEFAULT_TRANSACTIONS: PartnerTransaction[] = [
  {
    id: "tx-init-1",
    company_id: DEFAULT_COMPANY_ID,
    partner_id: "p1-eduardo",
    partner_name: "Eduardo",
    type: "APORTE",
    amount: 500.00,
    date: new Date().toISOString().split("T")[0],
    description: "Aporte inicial de capital",
    destination_category: "ESTOQUE",
    created_at: new Date().toISOString()
  },
  {
    id: "tx-init-2",
    company_id: DEFAULT_COMPANY_ID,
    partner_id: "p2-gabriel",
    partner_name: "Gabriel",
    type: "APORTE",
    amount: 605.00,
    date: new Date().toISOString().split("T")[0],
    description: "Aporte inicial de capital",
    destination_category: "ESTOQUE",
    created_at: new Date().toISOString()
  }
];

// ─── Funções de Persistência Local & Remota ─────────────────────────────────

export function getLocalPartners(): Partner[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PARTNERS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}

  saveLocalPartners(INITIAL_DEFAULT_PARTNERS);
  return INITIAL_DEFAULT_PARTNERS;
}

export function saveLocalPartners(partners: Partner[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PARTNERS_KEY, JSON.stringify(partners));
  } catch (e) {}
}

export function getLocalPartnerTransactions(): PartnerTransaction[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}

  saveLocalPartnerTransactions(INITIAL_DEFAULT_TRANSACTIONS);
  return INITIAL_DEFAULT_TRANSACTIONS;
}

export function saveLocalPartnerTransactions(transactions: PartnerTransaction[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(transactions));
  } catch (e) {}
}

// ─── Operações de Sócios (CRUD) ─────────────────────────────────────────────

export async function fetchPartners(companyId?: string): Promise<Partner[]> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  try {
    const { data, error } = await supabase
      .from("smoking_partners")
      .select("*")
      .or("company_id.eq." + targetCompanyId + ",company_id.is.null")
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      saveLocalPartners(data);
      return data;
    }
  } catch (e) {
    console.warn("Aviso ao buscar sócios no Supabase, usando persistência local:", e);
  }

  return getLocalPartners();
}

export async function createPartner(payload: {
  companyId?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  avatarColor?: string;
  initialInvestment?: number;
  notes?: string;
}): Promise<Partner> {
  const targetCompanyId = payload.companyId || DEFAULT_COMPANY_ID;
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `partner_${Date.now()}`;

  const newPartner: Partner = {
    id: newId,
    company_id: targetCompanyId,
    name: payload.name.trim(),
    email: payload.email?.trim() || null,
    phone: payload.phone?.trim() || null,
    role: payload.role?.trim() || 'Sócio',
    avatar_color: payload.avatarColor || '#10b981',
    is_active: true,
    notes: payload.notes?.trim() || null,
    created_at: new Date().toISOString()
  };

  const current = getLocalPartners();
  const updated = [...current, newPartner];
  saveLocalPartners(updated);

  if (payload.initialInvestment && Number(payload.initialInvestment) > 0) {
    await createPartnerTransaction({
      companyId: targetCompanyId,
      partnerId: newId,
      partnerName: newPartner.name,
      type: 'APORTE',
      amount: Number(payload.initialInvestment),
      date: new Date().toISOString().split('T')[0],
      description: 'Aporte inicial de capital',
      destinationCategory: 'ESTOQUE'
    });
  }

  try {
    await supabase.from("smoking_partners").insert({
      id: newPartner.id,
      company_id: targetCompanyId,
      name: newPartner.name,
      email: newPartner.email,
      phone: newPartner.phone,
      role: newPartner.role,
      avatar_color: newPartner.avatar_color,
      is_active: true,
      notes: newPartner.notes
    });
  } catch (e) {
    console.warn("Aviso ao inserir sócio no Supabase:", e);
  }

  return newPartner;
}

export async function updatePartner(
  partnerId: string,
  payload: Partial<Partner>
): Promise<boolean> {
  const current = getLocalPartners();
  const updated = current.map(p => p.id === partnerId ? { ...p, ...payload, updated_at: new Date().toISOString() } : p);
  saveLocalPartners(updated);

  try {
    await supabase
      .from("smoking_partners")
      .update({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        role: payload.role,
        avatar_color: payload.avatar_color,
        is_active: payload.is_active,
        notes: payload.notes,
        updated_at: new Date().toISOString()
      })
      .eq("id", partnerId);
  } catch (e) {
    console.warn("Aviso ao atualizar sócio no Supabase:", e);
  }

  return true;
}

export async function deletePartner(partnerId: string): Promise<boolean> {
  const current = getLocalPartners();
  const updated = current.filter(p => p.id !== partnerId);
  saveLocalPartners(updated);

  try {
    await supabase.from("smoking_partners").delete().eq("id", partnerId);
  } catch (e) {
    console.warn("Aviso ao excluir sócio no Supabase:", e);
  }

  return true;
}

// ─── Operações de Transações Societárias & Fluxo de Caixa ───────────────────

export async function fetchPartnerTransactions(companyId?: string): Promise<PartnerTransaction[]> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  try {
    const { data, error } = await supabase
      .from("smoking_partner_transactions")
      .select("*")
      .or("company_id.eq." + targetCompanyId + ",company_id.is.null")
      .order("date", { ascending: false });

    if (!error && data && data.length > 0) {
      saveLocalPartnerTransactions(data);
      return data;
    }
  } catch (e) {
    console.warn("Aviso ao buscar transações no Supabase, usando persistência local:", e);
  }

  return getLocalPartnerTransactions();
}

export async function createPartnerTransaction(payload: {
  companyId?: string;
  partnerId?: string | null;
  partnerName?: string | null;
  type: PartnerTransactionType;
  amount: number;
  date?: string;
  description: string;
  destinationCategory?: string;
}): Promise<PartnerTransaction> {
  const targetCompanyId = payload.companyId || DEFAULT_COMPANY_ID;
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  const newTx: PartnerTransaction = {
    id: newId,
    company_id: targetCompanyId,
    partner_id: payload.partnerId || null,
    partner_name: payload.partnerName || null,
    type: payload.type,
    amount: Math.max(0, Number(payload.amount) || 0),
    date: payload.date || new Date().toISOString().split("T")[0],
    description: payload.description.trim(),
    destination_category: payload.destinationCategory || 'ESTOQUE',
    created_at: new Date().toISOString()
  };

  const current = getLocalPartnerTransactions();
  const updated = [newTx, ...current];
  saveLocalPartnerTransactions(updated);

  try {
    await supabase.from("smoking_partner_transactions").insert({
      id: newTx.id,
      company_id: targetCompanyId,
      partner_id: newTx.partner_id,
      type: newTx.type,
      amount: newTx.amount,
      date: newTx.date,
      description: newTx.description,
      destination_category: newTx.destination_category
    });
  } catch (e) {
    console.warn("Aviso ao inserir transação no Supabase:", e);
  }

  return newTx;
}

export async function deletePartnerTransaction(transactionId: string): Promise<PartnerTransaction[]> {
  const current = getLocalPartnerTransactions();
  const updated = current.filter(t => t.id !== transactionId);
  saveLocalPartnerTransactions(updated);

  try {
    await supabase
      .from("smoking_partner_transactions")
      .delete()
      .eq("id", transactionId);
  } catch (e) {
    console.warn("Aviso ao excluir transação no Supabase:", e);
  }

  return updated;
}

// ─── Motor Financeiro Unificado (FONTE ÚNICA DE VERDADE DO FINANCEIRO) ──────

export function calculatePartnersFinancials(params: {
  partners: Partner[];
  transactions: PartnerTransaction[];
  orders: any[];
  products: any[];
  persistedCosts: Record<string, number>;
  operationalExpenses?: number;
}): CompanyFinancialOverview {
  const {
    partners,
    transactions,
    orders,
    products,
    persistedCosts,
    operationalExpenses = 0
  } = params;

  // 1. DRE OFICIAL: Processar Vendas, CMV e Frete (Idêntico ao FinanceDashboard.tsx)
  let revenueSum = 0;
  let cmvSum = 0;
  let shippingSum = 0;
  let podsSoldSum = 0;

  const validOrders = (orders || []).filter(
    (o) =>
      o.delivery_status !== 'CANCELADO' &&
      o.client_phone !== '__SYSTEM_SMK_BEST_SELLERS__' &&
      (!o.client_phone || !o.client_phone.startsWith('__SYSTEM_')) &&
      (!o.client_name || !o.client_name.toLowerCase().includes('system config'))
  );

  const pCosts = (persistedCosts || {}) as Record<string, number>;
  const dCosts = (DEFAULT_MODEL_COSTS || {}) as Record<string, number>;

  for (const order of validOrders) {
    const orderTotal = parseFloat(order.total_amount || 0);
    const shippingFee = parseFloat(order.shipping_fee || 0);
    revenueSum += orderTotal;
    shippingSum += shippingFee;

    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      const qty = Number(item.quantity) || 1;
      const brand = (item.brand || "OUTROS").toUpperCase();
      const modelName = (item.name || "POD").toUpperCase();
      const modelKey = (item.modelKey || `${brand}__${modelName}`).toLowerCase();

      let itemCost = Number(item.cost_price || item.costPrice) || 0;
      if (!itemCost && item.product_id && pCosts[item.product_id]) {
        itemCost = pCosts[item.product_id];
      }
      if (!itemCost && modelKey && dCosts[modelKey]) {
        itemCost = dCosts[modelKey];
      }
      if (!itemCost) itemCost = 65;

      cmvSum += qty * itemCost;
      podsSoldSum += qty;
    }
  }

  // Lucro Líquido Real das Vendas
  const netProfit = revenueSum - cmvSum - shippingSum;
  const realNetProfitPostMarketing = netProfit - operationalExpenses;
  const netProfitMarginPct = revenueSum > 0 ? (realNetProfitPostMarketing / revenueSum) * 100 : 0;

  // 2. ESTOQUE OFICIAL: Unidades, Custo na Prateleira e Valor de Venda (Idêntico ao FinanceDashboard.tsx)
  let totalStockCostSum = 0;
  let totalStockRetailSum = 0;
  let totalUnitsSum = 0;

  for (const p of products || []) {
    const stock = Number(p.stock) || 0;
    const price = Number(p.price) || 0;
    const flavorName = (p.flavor || "").trim().toLowerCase();
    const isPadrao = flavorName === "padrão" || flavorName === "padrao" || flavorName === "";

    if (stock > 0 && !isPadrao && p.is_active !== false) {
      const brandName = (p.brand || "").trim();
      const modelName = (p.name || "").trim();
      const groupKey = `${brandName.toLowerCase()}__${modelName.toLowerCase()}`;

      let unitCost = Number(p.cost_price) || 0;
      if (!unitCost && p.id && pCosts[p.id]) unitCost = pCosts[p.id];
      if (!unitCost && groupKey && pCosts[groupKey]) unitCost = pCosts[groupKey];
      if (!unitCost && groupKey && dCosts[groupKey]) unitCost = dCosts[groupKey];
      if (!unitCost) unitCost = 65;

      totalStockCostSum += stock * unitCost;
      totalStockRetailSum += stock * price;
      totalUnitsSum += stock;
    }
  }

  const stockAssetProfit = Math.max(0, totalStockRetailSum - totalStockCostSum);

  // 3. DETERMINAÇÃO DA MARGEM OFICIAL ATIVA DO NEGÓCIO (NUNCA FIXA / HARDCODED)
  // Se houver vendas realizadas, consome a Margem Líquida Real oficial do DRE.
  // Se não houver vendas ainda, consome a margem de catálogo do estoque ativo.
  let officialProfitMarginPct = 0;
  if (revenueSum > 0) {
    officialProfitMarginPct = (realNetProfitPostMarketing / revenueSum) * 100;
  } else if (totalStockRetailSum > 0) {
    officialProfitMarginPct = ((totalStockRetailSum - totalStockCostSum) / totalStockRetailSum) * 100;
  } else {
    officialProfitMarginPct = 21.0; // Fallback temporário apenas se base estiver 100% zerada
  }

  // 4. TESOURARIA & CAIXA OFICIAL (Idêntico ao FinanceDashboard.tsx)
  const netCashAvailable = Math.max(0, revenueSum - shippingSum - operationalExpenses);

  // 5. PATRIMÔNIO REAL TOTAL DA LOJA (FONTE DE VERDADE: FinanceDashboard.tsx linha 306)
  // totalCompanyEquity = Caixa em Conta (grossRevenue) + Venda Total do Estoque (stockAssetRetail)
  const companyEconomicEquity = revenueSum + totalStockRetailSum;

  // 6. APURAÇÃO DOS SÓCIOS: Capital Líquido -> % de Participação -> Projeção de Lucro & Patrimônio
  const activePartners = (partners || []).filter(p => p.is_active !== false);

  const partnerCapitalMap: Record<string, {
    grossContributed: number;
    withdrawn: number;
    netInvested: number;
    dividends: number;
    proLabore: number;
  }> = {};

  let totalNetCapitalInvested = 0;

  for (const partner of activePartners) {
    const partnerTx = (transactions || []).filter(t => t.partner_id === partner.id);
    let gross = 0;
    let withdr = 0;
    let div = 0;
    let pro = 0;

    for (const tx of partnerTx) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'APORTE') gross += amt;
      if (tx.type === 'RETIRADA_CAPITAL') withdr += amt;
      if (tx.type === 'DISTRIBUICAO_LUCRO') div += amt;
      if (tx.type === 'PRO_LABORE') pro += amt;
    }

    const net = Math.max(0, gross - withdr);
    partnerCapitalMap[partner.id] = {
      grossContributed: gross,
      withdrawn: withdr,
      netInvested: net,
      dividends: div,
      proLabore: pro
    };

    totalNetCapitalInvested += net;
  }

  const hasDefinedCapital = totalNetCapitalInvested > 0;
  let totalEquitySum = 0;
  let companyTotalProjectedProfit = 0;
  let companyTotalProjectedEquity = 0;

  const partnerMetrics: PartnerFinancialMetrics[] = activePartners.map(partner => {
    const cap = partnerCapitalMap[partner.id] || {
      grossContributed: 0,
      withdrawn: 0,
      netInvested: 0,
      dividends: 0,
      proLabore: 0
    };

    // % Calculada Estritamente: Capital do Sócio / Capital Total
    let equityPct = 0;
    if (hasDefinedCapital) {
      equityPct = (cap.netInvested / totalNetCapitalInvested) * 100;
    }

    totalEquitySum += equityPct;

    // CÁLCULO AUTOMÁTICO DE LUCRO PROJETADO SOBRE O APORTE / CAPITAL INVESTIDO
    // Lucro Projetado = Capital Investido * (Margem Oficial / 100)
    const projectedProfit = cap.netInvested * (officialProfitMarginPct / 100);
    const projectedEconomicEquity = cap.netInvested + projectedProfit;
    const projectedROI = cap.netInvested > 0 ? (projectedProfit / cap.netInvested) * 100 : officialProfitMarginPct;

    companyTotalProjectedProfit += projectedProfit;
    companyTotalProjectedEquity += projectedEconomicEquity;

    // Fatia Econômica Real do Patrimônio da Empresa
    const partnerEconomicEquity = companyEconomicEquity * (equityPct / 100);
    
    // Parcela Econômica do Lucro Realizado pelas Vendas
    const economicProfitShare = realNetProfitPostMarketing * (equityPct / 100);

    // Ganho Econômico Real
    const economicGain = partnerEconomicEquity - cap.netInvested;
    const simplifiedROI = cap.netInvested > 0 ? (economicGain / cap.netInvested) * 100 : 0;

    // Fatias de Estoque
    const stockCostShare = totalStockCostSum * (equityPct / 100);
    const stockRetailShare = totalStockRetailSum * (equityPct / 100);
    const stockPodUnitsEquivalent = totalUnitsSum * (equityPct / 100);

    return {
      partner,
      equityPercentage: equityPct,
      grossCapitalContributed: cap.grossContributed,
      capitalWithdrawn: cap.withdrawn,
      netCapitalInvested: cap.netInvested,
      dividendsReceived: cap.dividends,
      proLaboreReceived: cap.proLabore,
      officialProfitMarginPct,
      projectedProfit,
      projectedEconomicEquity,
      projectedROI,
      partnerEconomicEquity,
      economicProfitShare,
      economicGain,
      simplifiedROI,
      stockCostShare,
      stockRetailShare,
      stockPodUnitsEquivalent
    };
  });

  const isCapTableBalanced = hasDefinedCapital ? Math.abs(totalEquitySum - 100) < 0.01 : false;

  return {
    grossRevenue: revenueSum,
    cmv: cmvSum,
    logisticsFee: shippingSum,
    operationalExpenses,
    netProfitRealized: realNetProfitPostMarketing,
    netProfitMarginPct,
    officialProfitMarginPct,
    retainedProfit: Math.max(0, realNetProfitPostMarketing),
    totalOrdersCount: validOrders.length,
    totalPodsSold: podsSoldSum,
    companyTotalProjectedProfit,
    companyTotalProjectedEquity,
    stockAssetUnits: totalUnitsSum,
    stockAssetCost: totalStockCostSum,
    stockAssetRetail: totalStockRetailSum,
    stockPotentialGrossMargin: stockAssetProfit,
    netCashAvailable,
    companyEconomicEquity,
    totalNetCapitalInvested,
    totalEquitySum,
    isCapTableBalanced,
    hasDefinedCapital,
    partnerMetrics
  };
}

// ─── Simulador Direto de Aportes & Composição Societária ────────────────────

export interface AporteSimulationResult {
  simulatedTargetPartnerId: string;
  isNewPartner: boolean;
  newPartnerName: string;
  aporteAmount: number;
  officialMarginPct: number;
  projectedProfitOnNewAporte: number;
  totalNetCapitalBefore: number;
  totalNetCapitalAfter: number;
  companyEconomicEquityBefore: number;
  companyEconomicEquityAfter: number;
  partnersSimulated: Array<{
    partnerId: string;
    name: string;
    isTarget: boolean;
    capitalBefore: number;
    capitalAfter: number;
    equityPctBefore: number;
    equityPctAfter: number;
    projectedProfitBefore: number;
    projectedProfitAfter: number;
    projectedEquityBefore: number;
    projectedEquityAfter: number;
    economicValueBefore: number;
    economicValueAfter: number;
    stockCostBefore: number;
    stockCostAfter: number;
  }>;
}

export function simulatePartnerAporte(params: {
  targetPartnerId: string | 'NEW';
  newPartnerName?: string;
  aporteAmount: number;
  currentOverview: CompanyFinancialOverview;
  existingPartners: Partner[];
}): AporteSimulationResult {
  const { targetPartnerId, newPartnerName = 'Novo Sócio', aporteAmount, currentOverview, existingPartners } = params;

  const validAporte = Math.max(0, aporteAmount);
  const activeExisting = existingPartners.filter(p => p.is_active !== false);

  const margin = currentOverview.officialProfitMarginPct || 21.0;
  const projectedProfitOnNewAporte = validAporte * (margin / 100);

  const totalCapitalBefore = currentOverview.totalNetCapitalInvested;
  const totalCapitalAfter = totalCapitalBefore + validAporte;
  const equityBefore = currentOverview.companyEconomicEquity;
  const equityAfter = equityBefore + validAporte;
  const stockCost = currentOverview.stockAssetCost;

  const isNewPartner = targetPartnerId === 'NEW';

  const partnersSimulated = activeExisting.map(partner => {
    const existingMetric = currentOverview.partnerMetrics.find(m => m.partner.id === partner.id);
    const capBefore = existingMetric ? existingMetric.netCapitalInvested : 0;
    const isTarget = partner.id === targetPartnerId;
    const capAfter = isTarget ? capBefore + validAporte : capBefore;

    const pctBefore = totalCapitalBefore > 0 ? (capBefore / totalCapitalBefore) * 100 : 0;
    const pctAfter = totalCapitalAfter > 0 ? (capAfter / totalCapitalAfter) * 100 : 0;

    const projProfitBefore = capBefore * (margin / 100);
    const projProfitAfter = capAfter * (margin / 100);
    const projEquityBefore = capBefore + projProfitBefore;
    const projEquityAfter = capAfter + projProfitAfter;

    const valBefore = equityBefore * (pctBefore / 100);
    const valAfter = equityAfter * (pctAfter / 100);

    const sCostBefore = stockCost * (pctBefore / 100);
    const sCostAfter = stockCost * (pctAfter / 100);

    return {
      partnerId: partner.id,
      name: partner.name,
      isTarget,
      capitalBefore: capBefore,
      capitalAfter: capAfter,
      equityPctBefore: pctBefore,
      equityPctAfter: pctAfter,
      projectedProfitBefore: projProfitBefore,
      projectedProfitAfter: projProfitAfter,
      projectedEquityBefore: projEquityBefore,
      projectedEquityAfter: projEquityAfter,
      economicValueBefore: valBefore,
      economicValueAfter: valAfter,
      stockCostBefore: sCostBefore,
      stockCostAfter: sCostAfter
    };
  });

  if (isNewPartner && validAporte > 0) {
    const pctAfter = totalCapitalAfter > 0 ? (validAporte / totalCapitalAfter) * 100 : 0;
    const projProfitAfter = validAporte * (margin / 100);
    const projEquityAfter = validAporte + projProfitAfter;
    const valAfter = equityAfter * (pctAfter / 100);
    const sCostAfter = stockCost * (pctAfter / 100);

    partnersSimulated.push({
      partnerId: 'NEW_PARTNER',
      name: newPartnerName || 'Novo Sócio',
      isTarget: true,
      capitalBefore: 0,
      capitalAfter: validAporte,
      equityPctBefore: 0,
      equityPctAfter: pctAfter,
      projectedProfitBefore: 0,
      projectedProfitAfter: projProfitAfter,
      projectedEquityBefore: 0,
      projectedEquityAfter: projEquityAfter,
      economicValueBefore: 0,
      economicValueAfter: valAfter,
      stockCostBefore: 0,
      stockCostAfter: sCostAfter
    });
  }

  return {
    simulatedTargetPartnerId: targetPartnerId,
    isNewPartner,
    newPartnerName,
    aporteAmount: validAporte,
    officialMarginPct: margin,
    projectedProfitOnNewAporte,
    totalNetCapitalBefore: totalCapitalBefore,
    totalNetCapitalAfter: totalCapitalAfter,
    companyEconomicEquityBefore: equityBefore,
    companyEconomicEquityAfter: equityAfter,
    partnersSimulated
  };
}
