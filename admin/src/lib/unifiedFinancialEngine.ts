/**
 * MOTOR FINANCEIRO UNIFICADO SMK (Inteligência Financeira Centralizada)
 * 
 * Fonte Única da Verdade para:
 * - Financeiro Desktop (FinanceDashboard.tsx)
 * - Financeiro Mobile (MobileFinanceView.tsx)
 * - Sócios & Equity (PartnersDashboard.tsx)
 * - DRE, Caixa Real, Patrimônio, Estoque, Pró-Labore e Reinvestimentos
 *
 * Fuso Horário Obrigatório: America/Sao_Paulo (UTC-3)
 * Regra de Ciclo: Inicia no dia 14 às 00:00:00 e encerra no dia 13 às 23:59:59.999 do mês seguinte.
 */

import {
  type CycleDefinition,
  type CycleFinancialMetrics,
  type ConsolidatedPeriod,
  type AllTimeFinancialMetrics,
  getCycleForDate,
  getCurrentCycle,
  getCycleDef,
  getSaoPauloDateParts,
  MONTH_NAMES
} from "./financialCycles";
import { isOrderNational, extractNationalInfo } from "./nationalSales";
import { isOrderFiadoPending } from "./fiadoSales";
import {
  type Partner,
  type PartnerTransaction,
  type PartnerTransactionType,
  TRANSACTION_TYPE_CONFIG
} from "./partners";
import {
  type PayrollConfig,
  type PartnerPayrollItem,
  type PayrollOverview,
  filterRealHumanPartners,
  normalizePayrollConfig,
  getRuleForCycle,
  distributeAmountInCents
} from "./partnerPayroll";

// ─── INTERFACES UNIFICADAS DO PATRIMÔNIO & ESTOQUE ────────────────────────────

export interface MissingCostProduct {
  id: string;
  brand: string;
  name: string;
  flavor: string;
  stock: number;
  price: number;
}

export interface StockValuationOverview {
  totalUnitsInStock: number;
  stockAssetCost: number; // Avaliação pelo custo real de aquisição
  stockAssetRetail: number; // Avaliação pelo preço de venda (potencial comercial)
  commercialPotentialMargin: number; // Potencial comercial bruto = Retail - Cost
  commercialPotentialMarginPct: number;
  hasIncompleteCostEvaluation: boolean; // Flag se algum produto com stock > 0 não tem custo
  missingCostProducts: MissingCostProduct[];
  missingCostStockUnits: number;
}

// ─── INTERFACES DO CAIXA REAL & FLUXO DE CAIXA ────────────────────────────────

export interface RealCashInflowItem {
  id: string;
  date: string;
  type: 'VENDA' | 'RECEBIMENTO_FIADO' | 'APORTE_DINHEIRO' | 'OUTRA_ENTRADA';
  description: string;
  amount: number;
}

export interface RealCashOutflowItem {
  id: string;
  date: string;
  type: 'COMPRA_ESTOQUE' | 'FRETE_ESTOQUE' | 'DESPESA_OPERACIONAL' | 'RETIRADA_CAPITAL' | 'PRO_LABORE' | 'DISTRIBUICAO_LUCRO' | 'OUTRA_SAIDA';
  description: string;
  amount: number;
}

export interface RealCashOverview {
  realCash: number; // Saldo de caixa real (pode ser negativo em caso de déficit)
  isNegative: boolean;
  totalInflows: number;
  totalOutflows: number;
  inflowsCount: number;
  outflowsCount: number;
  recentInflows: RealCashInflowItem[];
  recentOutflows: RealCashOutflowItem[];
  cleanSlateActive: boolean;
  breakdown: {
    paidOrdersRevenue: number;
    cashCapitalAportes: number;
    stockRepurchasesPaid: number;
    stockFreightPaid: number;
    operationalExpensesPaid: number;
    capitalWithdrawalsPaid: number;
    proLaborePaid: number;
    profitDistributionPaid: number;
  };
}

// ─── INTERFACES DO PATRIMÔNIO OPERACIONAL ──────────────────────────────────────

export interface OperationalEquityOverview {
  realCash: number;
  stockAssetCost: number;
  accountsReceivable: number; // Fiados pendentes válidos
  operationalEquityAtCost: number; // Caixa Real + Estoque a Custo + Contas a Receber
  totalCompanyEquityAtRetail: number; // Caixa Real + Estoque a Venda + Contas a Receber
  commercialPotential: number; // Potencial comercial do estoque
  hasIncompleteValuation: boolean;
}

// ─── INTERFACES DA PARTICIPAÇÃO DOS SÓCIOS (CAP TABLE OFICIAL) ────────────────

export interface PartnerEquityShare {
  partner: Partner;
  grossCapitalContributed: number; // Soma de todos os APORTEs (dinheiro + mercadoria)
  cashCapitalContributed: number; // Aportes em dinheiro
  stockCapitalContributed: number; // Aportes em mercadoria
  capitalWithdrawn: number; // Soma de todas as RETIRADA_CAPITAL
  netCapitalInvested: number; // Aportes acumulados - Retiradas acumuladas
  equityPercentage: number; // (netCapital / totalNetCapital) * 100
  isEquityCalculable: boolean; // Se o capital líquido total for <= 0, não é calculável
  statusText: string;
  // Fatias patrimoniais proporcionais à participação (quando calculável)
  shareOfRealCash: number;
  shareOfStockAtCost: number;
  shareOfStockAtRetail: number;
  shareOfAccountsReceivable: number;
  shareOfOperationalEquity: number;
  // Histórico de remuneração / pró-labore
  proLaboreReceived: number;
  dividendsReceived: number;
}

export interface CapTableOverview {
  totalGrossContributed: number;
  totalCashContributed: number;
  totalStockContributed: number;
  totalWithdrawn: number;
  totalNetCapitalInvested: number;
  isCapTableCalculable: boolean; // Falso se totalNetCapitalInvested <= 0
  uncalculableReason?: string;
  partnerShares: PartnerEquityShare[];
  hasDefinedCapital: boolean;
}

// ─── INTERFACE MESTRE CENTRALIZADA DO SISTEMA ─────────────────────────────────

export interface UnifiedFinancialOverview {
  companyId: string;
  calculatedAt: string;

  // 1. DRE & Operação do Ciclo Atual
  currentCycle: CycleDefinition;
  grossRevenue: number; // Faturamento de produtos + margem do frete nacional
  cmv: number; // Custo de Mercadorias Vendidas oficial
  logisticsFee: number; // Frete repassado aos motoboys locais
  companyExpenses: number; // Despesas operacionais da empresa
  netProfit: number; // Lucro Líquido Real = Receita - CMV + Margem Frete Nac - Despesas
  profitMargin: number; // Margem líquida percentual
  totalOrders: number;
  totalPodsSold: number;
  averageTicket: number;
  averagePricePerPod: number;
  averageNetProfitPerOrder: number;

  // 2. Caixa Real Oficial
  cash: RealCashOverview;

  // 3. Estoque Físico e Patrimônio
  stock: StockValuationOverview;
  equity: OperationalEquityOverview;

  // 4. Sócios & Composição Societária (Cap Table por Capital Líquido)
  capTable: CapTableOverview;

  // 5. Folha Salarial & Reinvestimentos
  payroll: PayrollOverview;

  // 6. Contas a Receber (Fiados Pendentes)
  accountsReceivable: number;
  pendingFiadoOrdersCount: number;

  // 7. Histórico de Ciclos (Long-Term)
  monthlyCycles: CycleFinancialMetrics[];
  quarterlyPeriods: ConsolidatedPeriod[];
  semiannualPeriods: ConsolidatedPeriod[];
  annualPeriods: ConsolidatedPeriod[];
  allTimeMetrics: AllTimeFinancialMetrics;
  brandSales: Array<{ brand: string; count: number; revenue: number }>;
}

// ─── FUNÇÕES DE CÁLCULO E MOTOR OFICIAL ───────────────────────────────────────

/**
 * Filtra pedidos válidos da empresa (exclui cancelados e registros técnicos de metastore)
 * Mantém pedidos com fiado pendente acessíveis para contas a receber
 */
export function extractOrdersContext(orders: any[] = []): {
  validOrders: any[];
  paidOrders: any[];
  pendingFiadoOrders: any[];
  totalFiadoPending: number;
} {
  const validOrders = (orders || []).filter((o) => {
    if (!o) return false;
    const isCancelled = o.delivery_status === "CANCELADO" || o.status === "CANCELADO";
    const isShadow =
      o.client_phone === "__SYSTEM_SMK_BEST_SELLERS__" ||
      (typeof o.client_phone === "string" && o.client_phone.startsWith("__SYSTEM_")) ||
      (typeof o.client_name === "string" && o.client_name.toLowerCase().includes("system config"));
    return !isCancelled && !isShadow;
  });

  const paidOrders: any[] = [];
  const pendingFiadoOrders: any[] = [];
  let totalFiadoPending = 0;

  for (const o of validOrders) {
    if (isOrderFiadoPending(o)) {
      pendingFiadoOrders.push(o);
      totalFiadoPending += Number(parseFloat(o.total_amount || 0).toFixed(2)) || 0;
    } else {
      paidOrders.push(o);
    }
  }

  return {
    validOrders,
    paidOrders,
    pendingFiadoOrders,
    totalFiadoPending: Number(totalFiadoPending.toFixed(2)),
  };
}

/**
 * Avaliação Única do Estoque Físico da Prateleira
 * Regra: Usa estritamente o custo real cadastrado.
 * Se faltar custo, registra em missingCostProducts sem aplicar fallbacks artificiais.
 */
export function calculateStockValuation(
  products: any[] = [],
  persistedCosts: Record<string, number> = {}
): StockValuationOverview {
  let totalUnitsInStock = 0;
  let totalCostSum = 0;
  let totalRetailSum = 0;
  const missingCostProducts: MissingCostProduct[] = [];
  let missingCostStockUnits = 0;

  for (const p of products || []) {
    const stock = Number(p.stock) || 0;
    const price = Number(p.price) || 0;
    const isActive = p.is_active !== false;
    const isConfig = p.brand === "__STORE_CONFIG__" || (p.flavor || "").toLowerCase() === "padrão";

    if (stock > 0 && isActive && !isConfig) {
      totalUnitsInStock += stock;
      totalRetailSum += stock * price;

      let unitCost: number | null = null;
      if (Number(p.cost_price) > 0) {
        unitCost = Number(p.cost_price);
      } else if (p.id && Number(persistedCosts[p.id]) > 0) {
        unitCost = Number(persistedCosts[p.id]);
      } else {
        const brand = (p.brand || "").trim().toLowerCase();
        const model = (p.name || "").trim().toLowerCase();
        const key = `${brand}__${model}`;
        if (Number(persistedCosts[key]) > 0) {
          unitCost = Number(persistedCosts[key]);
        }
      }

      if (unitCost !== null && unitCost > 0) {
        totalCostSum += stock * unitCost;
      } else {
        missingCostStockUnits += stock;
        missingCostProducts.push({
          id: p.id,
          brand: p.brand || "SEM MARCA",
          name: p.name || "PRODUTO",
          flavor: p.flavor || "PADRÃO",
          stock,
          price,
        });
      }
    }
  }

  const roundedCost = Number(totalCostSum.toFixed(2));
  const roundedRetail = Number(totalRetailSum.toFixed(2));
  const commercialPotential = Number((roundedRetail - roundedCost).toFixed(2));
  const commercialPotentialMarginPct =
    roundedRetail > 0 ? parseFloat(((commercialPotential / roundedRetail) * 100).toFixed(1)) : 0;

  return {
    totalUnitsInStock,
    stockAssetCost: roundedCost,
    stockAssetRetail: roundedRetail,
    commercialPotentialMargin: commercialPotential,
    commercialPotentialMarginPct,
    hasIncompleteCostEvaluation: missingCostProducts.length > 0,
    missingCostProducts,
    missingCostStockUnits,
  };
}

/**
 * Cálculo Oficial do Caixa Real (Dinheiro Efetivamente Disponível)
 * Regras Obrigatórias:
 * 1. Não esconde saldo negativo com Math.max(0) (déficits aparecem claramente).
 * 2. Venda a prazo / fiado não entra no caixa antes de ser paga.
 * 3. Aporte em dinheiro entra no caixa; aporte em mercadoria entra no estoque, não no caixa.
 * 4. Proteção estrita contra contagem dupla entre smoking_stock_repurchases e COMPRA_ESTOQUE.
 * 5. Despesas pagas pessoalmente pelo sócio não reduzem o caixa da empresa.
 */
export function calculateRealCashOverview(params: {
  orders: any[];
  repurchases: any[];
  partnerTransactions: any[];
  cleanSlateTimestamp?: number;
}): RealCashOverview {
  const { orders = [], repurchases = [], partnerTransactions = [], cleanSlateTimestamp = 0 } = params;

  let paidOrdersRevenue = 0;
  let cashCapitalAportes = 0;
  let stockRepurchasesPaid = 0;
  let stockFreightPaid = 0;
  let operationalExpensesPaid = 0;
  let capitalWithdrawalsPaid = 0;
  let proLaborePaid = 0;
  let profitDistributionPaid = 0;

  const recentInflows: RealCashInflowItem[] = [];
  const recentOutflows: RealCashOutflowItem[] = [];

  // 1. Entradas: Vendas Efetivamente Recebidas (exclui pedidos cancelados e fiados pendentes)
  for (const o of orders) {
    if (!o) continue;
    const isCancelled = o.delivery_status === "CANCELADO" || o.status === "CANCELADO";
    const isPendingFiado = isOrderFiadoPending(o);
    if (isCancelled || isPendingFiado) continue;

    const rawDate = o.created_at || o.date;
    const orderTime = rawDate ? new Date(rawDate).getTime() : 0;
    if (cleanSlateTimestamp > 0 && orderTime < cleanSlateTimestamp) continue;

    // Receita de produtos retida na empresa (frete local de motoboy é repassado ao entregador)
    const shippingFee = parseFloat(o.shipping_fee || 0);
    const isNational = isOrderNational(o);
    let nationalShippingProfit = 0;
    let motoboyShippingFee = 0;
    if (isNational) {
      const info = extractNationalInfo(o);
      const shipCharged = info.shippingFeeCharged || shippingFee;
      const shipCost = info.shippingCostReal || 0;
      nationalShippingProfit = Math.max(0, shipCharged - shipCost);
    } else {
      motoboyShippingFee = shippingFee;
    }

    let prodRevenue = 0;
    const items = Array.isArray(o.items) ? o.items : [];
    if (items.length > 0) {
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const itemPrice = Number(item.price || item.unit_price) || 0;
        prodRevenue += qty * itemPrice;
      }
    } else {
      const totalAmt = Number(parseFloat(o.total_amount || 0).toFixed(2)) || 0;
      prodRevenue = Math.max(0, totalAmt - motoboyShippingFee);
    }

    const orderCashRetained = Number((prodRevenue + nationalShippingProfit).toFixed(2));
    if (orderCashRetained > 0) {
      paidOrdersRevenue += orderCashRetained;
      recentInflows.push({
        id: o.id || `order_${recentInflows.length}`,
        date: rawDate ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        type: 'VENDA',
        description: `Venda ${o.client_name ? `- ${o.client_name}` : ''}`.trim(),
        amount: orderCashRetained,
      });
    }
  }

  // 2. Saídas: Recompras de Estoque pagas pelo caixa
  const seenRepurchaseSignatures = new Set<string>();
  for (const r of repurchases) {
    if (!r) continue;
    const rawDate = r.purchase_date || r.created_at;
    const repTime = rawDate ? new Date(rawDate).getTime() : 0;
    if (cleanSlateTimestamp > 0 && repTime < cleanSlateTimestamp) continue;

    const prodAmt = Number(parseFloat(r.stock_purchase_amount || 0).toFixed(2)) || 0;
    const freightAmt = Number(parseFloat(r.freight_amount || 0).toFixed(2)) || 0;
    const totalRep = Number((prodAmt + freightAmt).toFixed(2));

    if (totalRep > 0) {
      stockRepurchasesPaid += prodAmt;
      stockFreightPaid += freightAmt;

      // Registro de assinatura para prevenir duplicação com partnerTransactions
      const sig = `${(rawDate || '').slice(0, 10)}_${prodAmt.toFixed(2)}`;
      seenRepurchaseSignatures.add(sig);

      recentOutflows.push({
        id: r.id || `rep_${recentOutflows.length}`,
        date: rawDate ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        type: 'COMPRA_ESTOQUE',
        description: `Reposição de Estoque ${r.notes ? `(${r.notes})` : ''}`.trim(),
        amount: totalRep,
      });
    }
  }

  // 3. Movimentações dos Sócios e da Empresa
  for (const tx of partnerTransactions) {
    if (!tx) continue;
    const rawDate = tx.date || tx.created_at;
    const txTime = rawDate ? new Date(rawDate).getTime() : 0;
    if (cleanSlateTimestamp > 0 && txTime < cleanSlateTimestamp) continue;

    const amt = Number(parseFloat(tx.amount || 0).toFixed(2)) || 0;
    if (amt <= 0) continue;

    const destCategory = (tx.destination_category || '').toUpperCase();
    const isPersonalExpense = destCategory === 'PAGO_PELO_SOCIO';

    // Aportes: Somente aporte em dinheiro afeta o caixa
    if (tx.type === 'APORTE') {
      const isStockContribution = destCategory === 'ESTOQUE' || destCategory === 'MERCADORIA';
      if (!isStockContribution) {
        cashCapitalAportes += amt;
        recentInflows.push({
          id: tx.id || `tx_${recentInflows.length}`,
          date: (rawDate || '').slice(0, 10),
          type: 'APORTE_DINHEIRO',
          description: tx.description || 'Aporte de capital em dinheiro',
          amount: amt,
        });
      }
    }

    // Saídas de Caixa
    if (tx.type === 'RETIRADA_CAPITAL') {
      capitalWithdrawalsPaid += amt;
      recentOutflows.push({
        id: tx.id || `tx_${recentOutflows.length}`,
        date: (rawDate || '').slice(0, 10),
        type: 'RETIRADA_CAPITAL',
        description: tx.description || 'Retirada de capital do sócio',
        amount: amt,
      });
    }

    if (tx.type === 'PRO_LABORE') {
      proLaborePaid += amt;
      recentOutflows.push({
        id: tx.id || `tx_${recentOutflows.length}`,
        date: (rawDate || '').slice(0, 10),
        type: 'PRO_LABORE',
        description: tx.description || 'Pagamento de pró-labore',
        amount: amt,
      });
    }

    if (tx.type === 'DISTRIBUICAO_LUCRO') {
      profitDistributionPaid += amt;
      recentOutflows.push({
        id: tx.id || `tx_${recentOutflows.length}`,
        date: (rawDate || '').slice(0, 10),
        type: 'DISTRIBUICAO_LUCRO',
        description: tx.description || 'Distribuição de lucros aos sócios',
        amount: amt,
      });
    }

    if (tx.type === 'DESPESA_OPERACIONAL') {
      // Se paga pelo sócio pessoalmente, não sai do caixa da empresa
      if (!isPersonalExpense) {
        operationalExpensesPaid += amt;
        recentOutflows.push({
          id: tx.id || `tx_${recentOutflows.length}`,
          date: (rawDate || '').slice(0, 10),
          type: 'DESPESA_OPERACIONAL',
          description: tx.description || 'Despesa operacional da empresa',
          amount: amt,
        });
      }
    }

    if (tx.type === 'COMPRA_ESTOQUE') {
      // Proteção estrita contra contagem dupla: verificar se já está em smoking_stock_repurchases
      const sig = `${(rawDate || '').slice(0, 10)}_${amt.toFixed(2)}`;
      if (!seenRepurchaseSignatures.has(sig)) {
        stockRepurchasesPaid += amt;
        recentOutflows.push({
          id: tx.id || `tx_${recentOutflows.length}`,
          date: (rawDate || '').slice(0, 10),
          type: 'COMPRA_ESTOQUE',
          description: tx.description || 'Compra de estoque avulsa',
          amount: amt,
        });
      }
    }
  }

  const totalInflows = Number((paidOrdersRevenue + cashCapitalAportes).toFixed(2));
  const totalOutflows = Number(
    (
      stockRepurchasesPaid +
      stockFreightPaid +
      operationalExpensesPaid +
      capitalWithdrawalsPaid +
      proLaborePaid +
      profitDistributionPaid
    ).toFixed(2)
  );

  // SALDO REAL: NÃO ESCONDER NÚMEROS NEGATIVOS COM Math.max(0)
  const realCash = Number((totalInflows - totalOutflows).toFixed(2));

  return {
    realCash,
    isNegative: realCash < 0,
    totalInflows,
    totalOutflows,
    inflowsCount: recentInflows.length,
    outflowsCount: recentOutflows.length,
    recentInflows: recentInflows.sort((a, b) => b.date.localeCompare(a.date)),
    recentOutflows: recentOutflows.sort((a, b) => b.date.localeCompare(a.date)),
    cleanSlateActive: cleanSlateTimestamp > 0,
    breakdown: {
      paidOrdersRevenue: Number(paidOrdersRevenue.toFixed(2)),
      cashCapitalAportes: Number(cashCapitalAportes.toFixed(2)),
      stockRepurchasesPaid: Number(stockRepurchasesPaid.toFixed(2)),
      stockFreightPaid: Number(stockFreightPaid.toFixed(2)),
      operationalExpensesPaid: Number(operationalExpensesPaid.toFixed(2)),
      capitalWithdrawalsPaid: Number(capitalWithdrawalsPaid.toFixed(2)),
      proLaborePaid: Number(proLaborePaid.toFixed(2)),
      profitDistributionPaid: Number(profitDistributionPaid.toFixed(2)),
    },
  };
}

/**
 * Nova Regra Oficial de Participação Societária (Cap Table por Capital Líquido)
 *
 * Capital líquido = aportes acumulados - retiradas de capital acumuladas
 * Participação = capital líquido individual / capital líquido total * 100
 *
 * Regras:
 * - Aporte de capital aumenta o capital investido.
 * - Retirada de capital reduz o capital investido.
 * - Pró-labore, distribuição de lucro e despesas operacionais NÃO alteram capital nem equity.
 * - Se capital total <= 0: indicar "Não calculável" (isEquityCalculable = false), sem inventar 50/50.
 * - Diferencia aporte em dinheiro de aporte em mercadoria.
 */
export function calculateCapTable(params: {
  partners: Partner[];
  transactions: PartnerTransaction[];
  operationalEquityAtCost: number;
  stockAssetCost: number;
  stockAssetRetail: number;
  realCash: number;
  accountsReceivable: number;
}): CapTableOverview {
  const {
    partners = [],
    transactions = [],
    operationalEquityAtCost,
    stockAssetCost,
    stockAssetRetail,
    realCash,
    accountsReceivable,
  } = params;

  const realPartners = filterRealHumanPartners(partners);

  // Mapear histórico por sócio
  const partnerDataMap = new Map<
    string,
    {
      grossContributed: number;
      cashContributed: number;
      stockContributed: number;
      withdrawn: number;
      proLabore: number;
      dividends: number;
    }
  >();

  for (const p of realPartners) {
    partnerDataMap.set(p.id, {
      grossContributed: 0,
      cashContributed: 0,
      stockContributed: 0,
      withdrawn: 0,
      proLabore: 0,
      dividends: 0,
    });
  }

  for (const tx of transactions || []) {
    if (!tx || !tx.partner_id) continue;
    const data = partnerDataMap.get(tx.partner_id);
    if (!data) continue;

    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;

    const destCat = (tx.destination_category || '').toUpperCase();
    const isStock = destCat === 'ESTOQUE' || destCat === 'MERCADORIA';

    if (tx.type === 'APORTE') {
      data.grossContributed += amt;
      if (isStock) {
        data.stockContributed += amt;
      } else {
        data.cashContributed += amt;
      }
    } else if (tx.type === 'RETIRADA_CAPITAL') {
      data.withdrawn += amt;
    } else if (tx.type === 'PRO_LABORE') {
      data.proLabore += amt;
    } else if (tx.type === 'DISTRIBUICAO_LUCRO') {
      data.dividends += amt;
    }
  }

  let totalGrossContributed = 0;
  let totalCashContributed = 0;
  let totalStockContributed = 0;
  let totalWithdrawn = 0;
  let totalNetCapitalInvested = 0;

  const rawShares = realPartners.map((partner) => {
    const d = partnerDataMap.get(partner.id)!;
    const net = Number((d.grossContributed - d.withdrawn).toFixed(2));

    totalGrossContributed += d.grossContributed;
    totalCashContributed += d.cashContributed;
    totalStockContributed += d.stockContributed;
    totalWithdrawn += d.withdrawn;
    totalNetCapitalInvested += net;

    return {
      partner,
      grossContributed: Number(d.grossContributed.toFixed(2)),
      cashContributed: Number(d.cashContributed.toFixed(2)),
      stockContributed: Number(d.stockContributed.toFixed(2)),
      withdrawn: Number(d.withdrawn.toFixed(2)),
      netCapital: net,
      proLabore: Number(d.proLabore.toFixed(2)),
      dividends: Number(d.dividends.toFixed(2)),
    };
  });

  totalNetCapitalInvested = Number(totalNetCapitalInvested.toFixed(2));
  const isCapTableCalculable = totalNetCapitalInvested > 0;
  const uncalculableReason = !isCapTableCalculable
    ? totalNetCapitalInvested === 0
      ? "Capital líquido total igual a R$ 0,00. Aporte de capital necessário para apurar fatias societárias."
      : "Capital líquido total negativo (retiradas superaram os aportes acumulados)."
    : undefined;

  let allocatedPct = 0;
  const partnerShares: PartnerEquityShare[] = rawShares.map((item, index) => {
    let equityPct = 0;
    let statusText = "0,00%";

    if (isCapTableCalculable && item.netCapital > 0) {
      if (index === rawShares.length - 1) {
        // Reconciliação exata no último sócio para fechar 100,00%
        equityPct = Number((100 - allocatedPct).toFixed(2));
      } else {
        equityPct = Number(((item.netCapital / totalNetCapitalInvested) * 100).toFixed(2));
        allocatedPct += equityPct;
      }
      statusText = `${equityPct.toFixed(2)}%`;
    } else if (!isCapTableCalculable) {
      equityPct = 0;
      statusText = "Não calculável";
    } else {
      equityPct = 0;
      statusText = "0,00% (Sem capital líquido)";
    }

    const shareFactor = isCapTableCalculable ? equityPct / 100 : 0;

    return {
      partner: item.partner,
      grossCapitalContributed: item.grossContributed,
      cashCapitalContributed: item.cashContributed,
      stockCapitalContributed: item.stockContributed,
      capitalWithdrawn: item.withdrawn,
      netCapitalInvested: item.netCapital,
      equityPercentage: equityPct,
      isEquityCalculable: isCapTableCalculable && item.netCapital >= 0,
      statusText,
      shareOfRealCash: Number((realCash * shareFactor).toFixed(2)),
      shareOfStockAtCost: Number((stockAssetCost * shareFactor).toFixed(2)),
      shareOfStockAtRetail: Number((stockAssetRetail * shareFactor).toFixed(2)),
      shareOfAccountsReceivable: Number((accountsReceivable * shareFactor).toFixed(2)),
      shareOfOperationalEquity: Number((operationalEquityAtCost * shareFactor).toFixed(2)),
      proLaboreReceived: item.proLabore,
      dividendsReceived: item.dividends,
    };
  });

  return {
    totalGrossContributed: Number(totalGrossContributed.toFixed(2)),
    totalCashContributed: Number(totalCashContributed.toFixed(2)),
    totalStockContributed: Number(totalStockContributed.toFixed(2)),
    totalWithdrawn: Number(totalWithdrawn.toFixed(2)),
    totalNetCapitalInvested,
    isCapTableCalculable,
    uncalculableReason,
    partnerShares,
    hasDefinedCapital: isCapTableCalculable,
  };
}

/**
 * Motor Dinâmico de Pró-Labore & Reinvestimentos
 * Preserva integralmente:
 * - Percentuais congelados por ciclo (14 a 13)
 * - Distribuição sobre resultado líquido real (positivo ou negativo)
 * - Carregamento de saldos negativos e compensação por lucros futuros
 * - Separação clara entre valor gerado, acumulado, já retirado e disponível para saque
 */
export function calculateUnifiedPayrollOverview(params: {
  config: PayrollConfig;
  partners: Partner[];
  transactions: PartnerTransaction[];
  cycleNetProfit: number;
  allTimeNetProfit: number;
  currentCycleId: string;
  historicalCycleMetrics?: Array<{ cycleId: string; netProfit: number }>;
  realCashAvailable: number;
}): PayrollOverview {
  const {
    config,
    partners,
    transactions,
    cycleNetProfit,
    allTimeNetProfit,
    currentCycleId,
    historicalCycleMetrics = [],
    realCashAvailable = 0,
  } = params;

  const realPartners = filterRealHumanPartners(partners);
  const normalized = normalizePayrollConfig(config, realPartners);
  const periodMode = normalized.periodMode;

  // Percentuais vigentes do ciclo atual
  const activeCycleRule = getRuleForCycle(currentCycleId, normalized, realPartners);
  const activeReinvestmentPct = periodMode === "CYCLE" ? activeCycleRule.reinvestmentPct : normalized.reinvestmentPct;
  const activePartnerPcts = periodMode === "CYCLE" ? activeCycleRule.partnerPcts : normalized.partnerPcts;

  const baseNetProfit = periodMode === "CYCLE" ? cycleNetProfit : allTimeNetProfit;

  // 1. Processar Histórico de Ciclos para apurar saldo acumulado e carregar compensações
  const partnerCarryOverMap = new Map<string, number>();
  let totalReinvestmentAccumulated = 0;

  for (const p of realPartners) {
    partnerCarryOverMap.set(p.id, 0);
  }

  // Se tivermos lista de ciclos históricos, processar cronologicamente
  if (historicalCycleMetrics.length > 0) {
    // Ordenar cronologicamente (mais antigo primeiro)
    const chronologicalCycles = [...historicalCycleMetrics].sort((a, b) => a.cycleId.localeCompare(b.cycleId));

    for (const hCycle of chronologicalCycles) {
      const hRule = getRuleForCycle(hCycle.cycleId, normalized, realPartners);
      const hProfit = hCycle.netProfit || 0;

      // Reinvestimento da loja
      const hReinvestment = (hProfit * hRule.reinvestmentPct) / 100;
      totalReinvestmentAccumulated += hReinvestment;

      // Sócios
      for (const p of realPartners) {
        const pct = hRule.partnerPcts[p.id] ?? 0;
        const generated = (hProfit * pct) / 100;
        const currentAccum = partnerCarryOverMap.get(p.id) || 0;
        partnerCarryOverMap.set(p.id, currentAccum + generated);
      }
    }
  }

  // 2. Apurar saques já realizados (PRO_LABORE) por sócio
  const partnerPaidMap = new Map<string, number>();
  const partnerCyclePaidMap = new Map<string, number>();

  for (const p of realPartners) {
    partnerPaidMap.set(p.id, 0);
    partnerCyclePaidMap.set(p.id, 0);
  }

  for (const tx of transactions || []) {
    if (!tx || !tx.partner_id) continue;
    if (tx.type === 'PRO_LABORE' || tx.type === 'DISTRIBUICAO_LUCRO') {
      const amt = Number(tx.amount) || 0;
      const prevAll = partnerPaidMap.get(tx.partner_id) || 0;
      partnerPaidMap.set(tx.partner_id, prevAll + amt);

      const txDate = tx.date || tx.created_at;
      if (txDate) {
        const c = getCycleForDate(txDate);
        if (c.id === currentCycleId) {
          const prevCycle = partnerCyclePaidMap.get(tx.partner_id) || 0;
          partnerCyclePaidMap.set(tx.partner_id, prevCycle + amt);
        }
      }
    }
  }

  // 3. Montar itens da folha por sócio
  let totalPartnersGenerated = 0;
  let totalPartnersPaid = 0;
  let totalPartnersAvailable = 0;

  const partnerItems: PartnerPayrollItem[] = realPartners.map((partner) => {
    const salaryPct = Number(activePartnerPcts[partner.id] ?? 0);
    const grossSalaryGenerated = Number(((baseNetProfit * salaryPct) / 100).toFixed(2));
    const salaryPaidAllTime = Number((partnerPaidMap.get(partner.id) || 0).toFixed(2));
    const salaryPaidInPeriod = Number((partnerCyclePaidMap.get(partner.id) || 0).toFixed(2));

    // Saldo acumulado histórico total de remuneração gerada
    const historicalAccumulatedGenerated = historicalCycleMetrics.length > 0
      ? Number((partnerCarryOverMap.get(partner.id) || 0).toFixed(2))
      : grossSalaryGenerated;

    // Saldo líquido devedor/credor acumulado
    const netBalance = Number((historicalAccumulatedGenerated - salaryPaidAllTime).toFixed(2));

    // Saldo disponível para saque no modo selecionado:
    // No modo CICLO: limitado ao lucro líquido gerado no ciclo menos o que já foi sacado no ciclo
    // No modo ACUMULADO: saldo líquido histórico total
    const cycleAvailable = Math.max(0, Number((grossSalaryGenerated - salaryPaidInPeriod).toFixed(2)));
    const allTimeAvailable = Math.max(0, netBalance);
    const availableToReceive = periodMode === "CYCLE" ? cycleAvailable : allTimeAvailable;

    totalPartnersGenerated += grossSalaryGenerated;
    totalPartnersPaid += salaryPaidInPeriod;
    totalPartnersAvailable += availableToReceive;

    return {
      partner,
      salaryPct,
      grossSalaryGenerated,
      salaryPaidInPeriod,
      availableToReceive,
      totalSalaryPaidAllTime: salaryPaidAllTime,
      carriedOverPendingSalary: netBalance,
    };
  });

  const reinvestmentAmount = Number(((baseNetProfit * activeReinvestmentPct) / 100).toFixed(2));
  const totalPartnersPct = Number(
    realPartners.reduce((s, p) => s + Number(activePartnerPcts[p.id] ?? 0), 0).toFixed(2)
  );

  return {
    periodMode,
    baseNetProfit: Number(baseNetProfit.toFixed(2)),
    reinvestmentPct: activeReinvestmentPct,
    reinvestmentAmount,
    totalReinvestmentAccumulated: Number(totalReinvestmentAccumulated.toFixed(2)),
    totalPartnersPct,
    totalPartnersGenerated: Number(totalPartnersGenerated.toFixed(2)),
    totalPartnersPaid: Number(totalPartnersPaid.toFixed(2)),
    totalPartnersAvailable: Number(totalPartnersAvailable.toFixed(2)),
    partnerItems,
  };
}

/**
 * FUNÇÃO MESTRE CENTRAL: Executa todos os cálculos integrados e retorna a visão consolidada
 */
export function calculateUnifiedFinancials(params: {
  companyId: string;
  orders: any[];
  products: any[];
  repurchases: any[];
  partners: Partner[];
  partnerTransactions: PartnerTransaction[];
  payrollConfig: PayrollConfig;
  persistedCosts?: Record<string, number>;
  cleanSlateTimestamp?: number;
}): UnifiedFinancialOverview {
  const {
    companyId,
    orders = [],
    products = [],
    repurchases = [],
    partners = [],
    partnerTransactions = [],
    payrollConfig,
    persistedCosts = {},
    cleanSlateTimestamp = 0,
  } = params;

  // 1. Contexto de Pedidos e Fiados
  const { validOrders, paidOrders, pendingFiadoOrders, totalFiadoPending } = extractOrdersContext(orders);

  // 2. Avaliação de Estoque Físico
  const stock = calculateStockValuation(products, persistedCosts);

  // 3. Caixa Real Oficial
  const cash = calculateRealCashOverview({
    orders: validOrders,
    repurchases,
    partnerTransactions,
    cleanSlateTimestamp,
  });

  // 4. Patrimônio Operacional Integrado
  const operationalEquityAtCost = Number(
    (cash.realCash + stock.stockAssetCost + totalFiadoPending).toFixed(2)
  );
  const totalCompanyEquityAtRetail = Number(
    (cash.realCash + stock.stockAssetRetail + totalFiadoPending).toFixed(2)
  );

  const equity: OperationalEquityOverview = {
    realCash: cash.realCash,
    stockAssetCost: stock.stockAssetCost,
    accountsReceivable: totalFiadoPending,
    operationalEquityAtCost,
    totalCompanyEquityAtRetail,
    commercialPotential: stock.commercialPotentialMargin,
    hasIncompleteValuation: stock.hasIncompleteCostEvaluation,
  };

  // 5. Cap Table Oficial dos Sócios por Capital Líquido
  const capTable = calculateCapTable({
    partners,
    transactions: partnerTransactions,
    operationalEquityAtCost,
    stockAssetCost: stock.stockAssetCost,
    stockAssetRetail: stock.stockAssetRetail,
    realCash: cash.realCash,
    accountsReceivable: totalFiadoPending,
  });

  // 6. DRE e Métricas do Ciclo Atual
  const curCycle = getCurrentCycle();

  // Filtrar pedidos deste ciclo
  const cycleOrders = validOrders.filter((o) => {
    if (!o.created_at) return false;
    const c = getCycleForDate(o.created_at);
    return c.id === curCycle.id;
  });

  let revenueSum = 0;
  let cmvSum = 0;
  let logisticsFee = 0;
  let podsSoldSum = 0;
  let nationalShippingMargin = 0;

  for (const order of cycleOrders) {
    const shippingFee = parseFloat(order.shipping_fee || 0);
    if (!isOrderNational(order)) {
      logisticsFee += shippingFee;
    } else {
      const info = extractNationalInfo(order);
      const shipCharged = info.shippingFeeCharged || shippingFee;
      const shipCost = info.shippingCostReal || 0;
      nationalShippingMargin += shipCharged - shipCost;
    }

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
      const orderRevenue = Math.max(0, (parseFloat(order.total_amount || 0) || 0) - shippingFee);
      revenueSum += orderRevenue;
      podsSoldSum += 1;
    } else {
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const itemPrice = Number(item.price || item.unit_price) || 0;

        let itemCost = Number(item.cost_price || item.costPrice) || 0;
        if (!itemCost && item.product_id && persistedCosts[item.product_id]) {
          itemCost = persistedCosts[item.product_id];
        }
        if (!itemCost) {
          const brand = (item.brand || "").trim().toLowerCase();
          const model = (item.name || "").trim().toLowerCase();
          const key = `${brand}__${model}`;
          if (persistedCosts[key]) itemCost = persistedCosts[key];
        }
        // Se ainda não tiver custo, não usa R$ 65 fixo artificial!
        if (!itemCost) itemCost = 0;

        revenueSum += qty * itemPrice;
        cmvSum += qty * itemCost;
        podsSoldSum += qty;
      }
    }
  }

  // Despesas operacionais do ciclo
  let companyExpenses = 0;
  for (const tx of partnerTransactions) {
    const rawDate = tx.date || tx.created_at;
    if (rawDate && tx.type === "DESPESA_OPERACIONAL") {
      const c = getCycleForDate(rawDate);
      if (c.id === curCycle.id) {
        companyExpenses += Number(tx.amount) || 0;
      }
    }
  }

  const grossRevenue = Number(revenueSum.toFixed(2));
  const cmv = Number(cmvSum.toFixed(2));
  companyExpenses = Number(companyExpenses.toFixed(2));
  logisticsFee = Number(logisticsFee.toFixed(2));
  const netProfit = Number((grossRevenue - cmv + nationalShippingMargin - companyExpenses).toFixed(2));
  const profitMargin = grossRevenue > 0 ? parseFloat(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;
  const totalOrdersCount = cycleOrders.length;
  const averageTicket = totalOrdersCount > 0 ? Number((grossRevenue / totalOrdersCount).toFixed(2)) : 0;
  const averagePricePerPod = podsSoldSum > 0 ? Number((grossRevenue / podsSoldSum).toFixed(2)) : 0;
  const averageNetProfitPerOrder = totalOrdersCount > 0 ? Number((netProfit / totalOrdersCount).toFixed(2)) : 0;

  // 7. Vendas por Marca no Ciclo
  const brandSalesMap: Record<string, { count: number; revenue: number }> = {};
  for (const o of cycleOrders) {
    const items = Array.isArray(o.items) ? o.items : [];
    for (const item of items) {
      const qty = Number(item.quantity) || 1;
      const b = (item.brand || "OUTROS").toUpperCase();
      const p = Number(item.price || item.unit_price) || 0;
      if (!brandSalesMap[b]) brandSalesMap[b] = { count: 0, revenue: 0 };
      brandSalesMap[b].count += qty;
      brandSalesMap[b].revenue += qty * p;
    }
  }
  const brandSales = Object.entries(brandSalesMap).map(([brand, data]) => ({
    brand,
    count: data.count,
    revenue: Number(data.revenue.toFixed(2)),
  }));

  // 8. Histórico Completo de Ciclos (Long-Term)
  const monthlyCycles = generateUnifiedMonthlyCycles({
    orders: validOrders,
    repurchases,
    partnerTransactions,
    partners,
    persistedCosts,
  });

  const historicalCycleSummary = monthlyCycles.map((m) => ({
    cycleId: m.cycle.id,
    netProfit: m.netProfit,
  }));

  // 9. Folha Salarial & Reinvestimentos
  const payroll = calculateUnifiedPayrollOverview({
    config: payrollConfig,
    partners,
    transactions: partnerTransactions,
    cycleNetProfit: netProfit,
    allTimeNetProfit: monthlyCycles.reduce((s, c) => s + c.netProfit, 0),
    currentCycleId: curCycle.id,
    historicalCycleMetrics: historicalCycleSummary,
    realCashAvailable: cash.realCash,
  });

  // 10. Agregações Long-Term (Trimestre, Semestre, Ano)
  const quarterlyPeriods = generateUnifiedQuarters(monthlyCycles);
  const semiannualPeriods = generateUnifiedSemesters(monthlyCycles);
  const annualPeriods = generateUnifiedYears(monthlyCycles);

  // All-time acumulado
  const allTimeMetrics: AllTimeFinancialMetrics = {
    grossRevenue: Number(monthlyCycles.reduce((s, c) => s + c.grossRevenue, 0).toFixed(2)),
    cmv: Number(monthlyCycles.reduce((s, c) => s + c.cmv, 0).toFixed(2)),
    companyExpenses: Number(monthlyCycles.reduce((s, c) => s + (c.companyExpenses || 0), 0).toFixed(2)),
    logisticsFee: Number(monthlyCycles.reduce((s, c) => s + c.logisticsFee, 0).toFixed(2)),
    netProfit: Number(monthlyCycles.reduce((s, c) => s + c.netProfit, 0).toFixed(2)),
    profitMargin:
      monthlyCycles.reduce((s, c) => s + c.grossRevenue, 0) > 0
        ? parseFloat(
            (
              (monthlyCycles.reduce((s, c) => s + c.netProfit, 0) /
                monthlyCycles.reduce((s, c) => s + c.grossRevenue, 0)) *
              100
            ).toFixed(1)
          )
        : 0,
    totalOrders: monthlyCycles.reduce((s, c) => s + c.totalOrders, 0),
    totalPodsSold: monthlyCycles.reduce((s, c) => s + c.totalPodsSold, 0),
    averageTicket:
      monthlyCycles.reduce((s, c) => s + c.totalOrders, 0) > 0
        ? Number(
            (
              monthlyCycles.reduce((s, c) => s + c.grossRevenue, 0) /
              monthlyCycles.reduce((s, c) => s + c.totalOrders, 0)
            ).toFixed(2)
          )
        : 0,
    averagePricePerPod:
      monthlyCycles.reduce((s, c) => s + c.totalPodsSold, 0) > 0
        ? Number(
            (
              monthlyCycles.reduce((s, c) => s + c.grossRevenue, 0) /
              monthlyCycles.reduce((s, c) => s + c.totalPodsSold, 0)
            ).toFixed(2)
          )
        : 0,
    averageNetProfitPerOrder:
      monthlyCycles.reduce((s, c) => s + c.totalOrders, 0) > 0
        ? Number(
            (
              monthlyCycles.reduce((s, c) => s + c.netProfit, 0) /
              monthlyCycles.reduce((s, c) => s + c.totalOrders, 0)
            ).toFixed(2)
          )
        : 0,
    stockPurchases: Number(monthlyCycles.reduce((s, c) => s + c.stockPurchases, 0).toFixed(2)),
    freightRepurchases: Number(monthlyCycles.reduce((s, c) => s + c.freightRepurchases, 0).toFixed(2)),
    totalInvestedRepurchases: Number(
      monthlyCycles.reduce((s, c) => s + c.totalInvestedRepurchases, 0).toFixed(2)
    ),
    realCash: cash.realCash,
  };

  return {
    companyId,
    calculatedAt: new Date().toISOString(),
    currentCycle: curCycle,
    grossRevenue,
    cmv,
    companyExpenses,
    logisticsFee,
    netProfit,
    profitMargin,
    totalOrders: totalOrdersCount,
    totalPodsSold: podsSoldSum,
    averageTicket,
    averagePricePerPod,
    averageNetProfitPerOrder,
    cash,
    stock,
    equity,
    capTable,
    payroll,
    accountsReceivable: totalFiadoPending,
    pendingFiadoOrdersCount: pendingFiadoOrders.length,
    monthlyCycles,
    quarterlyPeriods,
    semiannualPeriods,
    annualPeriods,
    allTimeMetrics,
    brandSales,
  };
}

// ─── HELPERS DE AGREGAÇÃO HISTÓRICA LIMPA ─────────────────────────────────────

function generateUnifiedMonthlyCycles(params: {
  orders: any[];
  repurchases: any[];
  partnerTransactions: any[];
  partners: Partner[];
  persistedCosts: Record<string, number>;
}): CycleFinancialMetrics[] {
  const { orders, repurchases, partnerTransactions, partners, persistedCosts } = params;
  const currentCycle = getCurrentCycle();

  const cycleMap = new Map<string, CycleDefinition>();
  const startMonth = 2; // Fevereiro
  const currentYear = currentCycle.year;
  const currentMonth = currentCycle.month;

  for (let m = startMonth; m <= currentMonth; m++) {
    const def = getCycleDef(currentYear, m);
    cycleMap.set(def.id, def);
  }

  for (const o of orders || []) {
    if (o.created_at) {
      const def = getCycleForDate(o.created_at);
      if (!cycleMap.has(def.id)) cycleMap.set(def.id, def);
    }
  }

  for (const r of repurchases || []) {
    const d = r.purchase_date || r.created_at;
    if (d) {
      const def = getCycleForDate(d);
      if (!cycleMap.has(def.id)) cycleMap.set(def.id, def);
    }
  }

  for (const tx of partnerTransactions || []) {
    const d = tx.date || tx.created_at;
    if (d) {
      const def = getCycleForDate(d);
      if (!cycleMap.has(def.id)) cycleMap.set(def.id, def);
    }
  }

  const sorted = Array.from(cycleMap.values()).sort((a, b) => b.id.localeCompare(a.id));

  return sorted.map((cycle) => {
    const cycleOrders = orders.filter((o) => o.created_at && getCycleForDate(o.created_at).id === cycle.id);
    const cycleReps = repurchases.filter((r) => {
      const d = r.purchase_date || r.created_at;
      return d && getCycleForDate(d).id === cycle.id;
    });
    const cycleTxs = partnerTransactions.filter((tx) => {
      const d = tx.date || tx.created_at;
      return d && getCycleForDate(d).id === cycle.id;
    });

    let rev = 0;
    let cmv = 0;
    let pods = 0;
    let logistics = 0;
    let natMargin = 0;

    for (const o of cycleOrders) {
      const shippingFee = parseFloat(o.shipping_fee || 0);
      if (!isOrderNational(o)) {
        logistics += shippingFee;
      } else {
        const info = extractNationalInfo(o);
        natMargin += (info.shippingFeeCharged || shippingFee) - (info.shippingCostReal || 0);
      }

      const items = Array.isArray(o.items) ? o.items : [];
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const p = Number(item.price || item.unit_price) || 0;
        let c = Number(item.cost_price || item.costPrice) || 0;
        if (!c && item.product_id && persistedCosts[item.product_id]) c = persistedCosts[item.product_id];
        if (!c) {
          const brand = (item.brand || "").trim().toLowerCase();
          const model = (item.name || "").trim().toLowerCase();
          const key = `${brand}__${model}`;
          if (persistedCosts[key]) c = persistedCosts[key];
        }
        if (!c) c = 0;

        rev += qty * p;
        cmv += qty * c;
        pods += qty;
      }
    }

    let expenses = 0;
    for (const tx of cycleTxs) {
      if (tx.type === "DESPESA_OPERACIONAL") expenses += Number(tx.amount) || 0;
    }

    const net = Number((rev - cmv + natMargin - expenses).toFixed(2));
    const margin = rev > 0 ? parseFloat(((net / rev) * 100).toFixed(1)) : 0;
    const stockPurchases = Number(
      cycleReps.reduce((s, r) => s + (Number(r.stock_purchase_amount) || 0), 0).toFixed(2)
    );
    const freightRepurchases = Number(
      cycleReps.reduce((s, r) => s + (Number(r.freight_amount) || 0), 0).toFixed(2)
    );
    const totalOrders = cycleOrders.length;

    return {
      cycle,
      grossRevenue: Number(rev.toFixed(2)),
      cmv: Number(cmv.toFixed(2)),
      companyExpenses: Number(expenses.toFixed(2)),
      logisticsFee: Number(logistics.toFixed(2)),
      netProfit: net,
      profitMargin: margin,
      totalOrders,
      totalPodsSold: pods,
      stockPurchases,
      freightRepurchases,
      totalInvestedRepurchases: Number((stockPurchases + freightRepurchases).toFixed(2)),
      realCash: 0, // Saldo pontual mantido no módulo de caixa
      averageTicket: totalOrders > 0 ? Number((rev / totalOrders).toFixed(2)) : 0,
      averagePricePerPod: pods > 0 ? Number((rev / pods).toFixed(2)) : 0,
      averageNetProfitPerOrder: totalOrders > 0 ? Number((net / totalOrders).toFixed(2)) : 0,
      orders: cycleOrders,
      repurchases: cycleReps,
    };
  });
}

function aggregateUnifiedCycles(
  id: string,
  name: string,
  type: "trimestral" | "semestral" | "anual",
  cycles: CycleFinancialMetrics[]
): ConsolidatedPeriod {
  let grossRevenue = 0;
  let cmv = 0;
  let companyExpenses = 0;
  let logisticsFee = 0;
  let netProfitSum = 0;
  let totalOrders = 0;
  let totalPodsSold = 0;
  let stockPurchases = 0;
  let freightRepurchases = 0;

  for (const c of cycles) {
    grossRevenue += c.grossRevenue;
    cmv += c.cmv;
    companyExpenses += c.companyExpenses || 0;
    logisticsFee += c.logisticsFee;
    netProfitSum += c.netProfit;
    totalOrders += c.totalOrders;
    totalPodsSold += c.totalPodsSold;
    stockPurchases += c.stockPurchases;
    freightRepurchases += c.freightRepurchases;
  }

  const netProfit = Number(netProfitSum.toFixed(2));
  const profitMargin = grossRevenue > 0 ? parseFloat(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;
  const firstCycle = cycles[cycles.length - 1]?.cycle;
  const lastCycle = cycles[0]?.cycle;
  const label =
    firstCycle && lastCycle
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
    companyExpenses: Number(companyExpenses.toFixed(2)),
    logisticsFee: Number(logisticsFee.toFixed(2)),
    netProfit,
    profitMargin,
    totalOrders,
    totalPodsSold,
    stockPurchases: Number(stockPurchases.toFixed(2)),
    freightRepurchases: Number(freightRepurchases.toFixed(2)),
    totalInvestedRepurchases: Number((stockPurchases + freightRepurchases).toFixed(2)),
    realCash: 0,
    averageTicket: totalOrders > 0 ? Number((grossRevenue / totalOrders).toFixed(2)) : 0,
    averagePricePerPod: totalPodsSold > 0 ? Number((grossRevenue / totalPodsSold).toFixed(2)) : 0,
  };
}

function generateUnifiedQuarters(monthlyCycles: CycleFinancialMetrics[]): ConsolidatedPeriod[] {
  const quarters: ConsolidatedPeriod[] = [];
  const chunkSize = 3;
  for (let i = 0; i < monthlyCycles.length; i += chunkSize) {
    const chunk = monthlyCycles.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const startM = chunk[chunk.length - 1].cycle.monthName;
    const endM = chunk[0].cycle.monthName;
    const year = chunk[0].cycle.year;
    quarters.push(aggregateUnifiedCycles(`quarter_${i}`, `${endM} - ${startM} / ${year}`, "trimestral", chunk));
  }
  return quarters;
}

function generateUnifiedSemesters(monthlyCycles: CycleFinancialMetrics[]): ConsolidatedPeriod[] {
  const semesters: ConsolidatedPeriod[] = [];
  const chunkSize = 6;
  for (let i = 0; i < monthlyCycles.length; i += chunkSize) {
    const chunk = monthlyCycles.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const startM = chunk[chunk.length - 1].cycle.monthName;
    const endM = chunk[0].cycle.monthName;
    const year = chunk[0].cycle.year;
    semesters.push(aggregateUnifiedCycles(`semester_${i}`, `${endM} - ${startM} / ${year}`, "semestral", chunk));
  }
  return semesters;
}

function generateUnifiedYears(monthlyCycles: CycleFinancialMetrics[]): ConsolidatedPeriod[] {
  const yearsMap = new Map<number, CycleFinancialMetrics[]>();
  for (const c of monthlyCycles) {
    const y = c.cycle.year;
    if (!yearsMap.has(y)) yearsMap.set(y, []);
    yearsMap.get(y)!.push(c);
  }
  return Array.from(yearsMap.entries()).map(([year, cycles]) =>
    aggregateUnifiedCycles(`year_${year}`, `Ano Financeiro ${year}`, "anual", cycles)
  );
}
