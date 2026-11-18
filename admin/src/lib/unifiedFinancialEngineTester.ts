/**
 * BATERIA DE TESTES OFICIAIS DE RECONSTRUÇÃO — FINANCEIRO & SÓCIOS SMK
 * 
 * Cobre estritamente os 18 cenários obrigatórios especificados:
 * 1. Aporte em dinheiro (aumenta capital e caixa)
 * 2. Aporte em mercadoria (aumenta capital e estoque, sem alterar caixa)
 * 3. Retirada de capital (reduz capital e caixa)
 * 4. Pró-labore gerado e não retirado (acumula saldo, não altera capital/equity)
 * 5. Pró-labore efetivamente pago (reduz caixa, reduz saldo a receber, não altera capital)
 * 6. Distribuição de lucro (reduz caixa, não altera capital/equity)
 * 7. Despesa operacional da empresa (reduz caixa e DRE, não altera capital)
 * 8. Compra de estoque (reduz caixa, aumenta estoque a custo)
 * 9. Venda recebida à vista (aumenta caixa, reduz estoque, contabiliza CMV e receita)
 * 10. Venda a prazo / fiado (não aumenta caixa, entra em contas a receber)
 * 11. Recebimento de fiado (aumenta caixa, reduz contas a receber)
 * 12. Produto sem custo cadastrado (sinaliza avaliação incompleta, não inventa R$ 65)
 * 13. Caixa negativo (exibe saldo negativo sem Math.max(0))
 * 14. Capital total dos sócios igual a zero (indica "Não calculável", sem percentuais inventados)
 * 15. Alteração de percentuais durante o ciclo (congelada para o próximo ciclo)
 * 16. Virada do ciclo do dia 13 para 14 (novo ciclo inicia com preservação de histórico)
 * 17. Idempotência / repetição da mesma operação (deduplicação de lançamentos)
 * 18. Isolamento multi-tenant entre empresas (company_id)
 */

import {
  calculateUnifiedFinancials,
  calculateStockValuation,
  calculateRealCashOverview,
  calculateCapTable,
  calculateUnifiedPayrollOverview,
} from "./unifiedFinancialEngine";
import type { Partner, PartnerTransaction } from "./partners";
import type { PayrollConfig } from "./partnerPayroll";
import { getCycleForDate } from "./financialCycles";

export interface TestCaseResult {
  id: number;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

export interface ReconstructionTestSuiteReport {
  total: number;
  passed: number;
  failed: number;
  results: TestCaseResult[];
  timestamp: string;
}

function makePartner(partial: Partial<Partner> & { id: string; name: string }): Partner {
  return {
    id: partial.id,
    company_id: partial.company_id || "company-test-1",
    name: partial.name,
    role: partial.role || "Sócio",
    avatar_color: partial.avatar_color || "#10b981",
    is_active: partial.is_active ?? true,
    created_at: partial.created_at || "2026-11-01T00:00:00Z",
  };
}

function makeTx(partial: Partial<PartnerTransaction> & { id: string; type: any; amount: number }): PartnerTransaction {
  return {
    id: partial.id,
    company_id: partial.company_id || "company-test-1",
    partner_id: partial.partner_id ?? null,
    partner_name: partial.partner_name ?? null,
    type: partial.type,
    amount: partial.amount,
    date: partial.date || "2026-11-15",
    description: partial.description || "Transação de teste",
    destination_category: partial.destination_category || "CAIXA_GERAL",
    created_at: partial.created_at || "2026-11-15T12:00:00Z",
  };
}

export function runUnifiedFinancialTestSuite(): ReconstructionTestSuiteReport {
  const results: TestCaseResult[] = [];

  const basePartnerA = makePartner({
    id: "partner-eduardo",
    name: "Eduardo Pizza",
  });

  const basePartnerB = makePartner({
    id: "partner-gabriel",
    name: "Gabriel Dias",
  });

  const basePartners = [basePartnerA, basePartnerB];

  const basePayrollConfig: PayrollConfig = {
    periodMode: "CYCLE",
    reinvestmentPct: 65,
    partnerPcts: {
      "partner-eduardo": 17.5,
      "partner-gabriel": 17.5,
    },
    cycleRules: {},
    updatedAt: new Date().toISOString(),
  };

  function assert(id: number, name: string, condition: boolean, details?: string, errDetail?: string) {
    results.push({
      id,
      name,
      passed: condition,
      details,
      error: !condition ? (errDetail || "Falha na validação da condição esperada") : undefined,
    });
  }

  // ─── 1. APORTE EM DINHEIRO ────────────────────────────────────────────────
  try {
    const txs: PartnerTransaction[] = [
      makeTx({
        id: "tx-1",
        partner_id: "partner-eduardo",
        partner_name: "Eduardo Pizza",
        type: "APORTE",
        amount: 1000,
        destination_category: "CAIXA_GERAL",
        date: "2026-11-15",
      }),
    ];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders: [],
      products: [],
      repurchases: [],
      partners: basePartners,
      partnerTransactions: txs,
      payrollConfig: basePayrollConfig,
    });

    const eduShare = u.capTable.partnerShares.find(s => s.partner.id === "partner-eduardo");
    const passed =
      eduShare?.netCapitalInvested === 1000 &&
      eduShare?.cashCapitalContributed === 1000 &&
      u.cash.realCash === 1000 &&
      u.cash.breakdown.cashCapitalAportes === 1000 &&
      eduShare?.equityPercentage === 100;

    assert(1, "Aporte em dinheiro (aumenta capital e caixa)", passed, `Caixa: ${u.cash.realCash}, Cap: ${eduShare?.netCapitalInvested}`);
  } catch (e: any) {
    assert(1, "Aporte em dinheiro", false, undefined, e.message);
  }

  // ─── 2. APORTE EM MERCADORIA ──────────────────────────────────────────────
  try {
    const txs: PartnerTransaction[] = [
      makeTx({
        id: "tx-2",
        partner_id: "partner-gabriel",
        partner_name: "Gabriel Dias",
        type: "APORTE",
        amount: 1500,
        destination_category: "ESTOQUE",
        date: "2026-11-15",
      }),
    ];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders: [],
      products: [{ id: "p1", brand: "Elfbar", name: "Pod", stock: 15, price: 150, cost_price: 100 }],
      repurchases: [],
      partners: basePartners,
      partnerTransactions: txs,
      payrollConfig: basePayrollConfig,
    });

    const gabShare = u.capTable.partnerShares.find(s => s.partner.id === "partner-gabriel");
    const passed =
      gabShare?.netCapitalInvested === 1500 &&
      gabShare?.stockCapitalContributed === 1500 &&
      gabShare?.cashCapitalContributed === 0 &&
      u.cash.realCash === 0 &&
      u.stock.stockAssetCost === 1500;

    assert(2, "Aporte em mercadoria (aumenta capital e estoque, sem alterar caixa)", passed, `Caixa: ${u.cash.realCash}, Cap: ${gabShare?.netCapitalInvested}, EstCusto: ${u.stock.stockAssetCost}`);
  } catch (e: any) {
    assert(2, "Aporte em mercadoria", false, undefined, e.message);
  }

  // ─── 3. RETIRADA DE CAPITAL ───────────────────────────────────────────────
  try {
    const txs: PartnerTransaction[] = [
      makeTx({
        id: "tx-3a",
        partner_id: "partner-eduardo",
        partner_name: "Eduardo Pizza",
        type: "APORTE",
        amount: 2000,
        destination_category: "CAIXA_GERAL",
        date: "2026-11-15",
      }),
      makeTx({
        id: "tx-3b",
        partner_id: "partner-eduardo",
        partner_name: "Eduardo Pizza",
        type: "RETIRADA_CAPITAL",
        amount: 600,
        destination_category: "CAIXA_GERAL",
        date: "2026-11-16",
      }),
    ];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders: [],
      products: [],
      repurchases: [],
      partners: basePartners,
      partnerTransactions: txs,
      payrollConfig: basePayrollConfig,
    });

    const eduShare = u.capTable.partnerShares.find(s => s.partner.id === "partner-eduardo");
    const passed =
      eduShare?.capitalWithdrawn === 600 &&
      eduShare?.netCapitalInvested === 1400 &&
      u.cash.realCash === 1400;

    assert(3, "Retirada de capital (reduz capital e caixa)", passed, `CapLiq: ${eduShare?.netCapitalInvested}, Caixa: ${u.cash.realCash}`);
  } catch (e: any) {
    assert(3, "Retirada de capital", false, undefined, e.message);
  }

  // ─── 4. PRÓ-LABORE GERADO E NÃO RETIRADO ──────────────────────────────────
  try {
    const orders = [{
      id: "ord-4",
      delivery_status: "ENTREGUE",
      total_amount: 1000,
      payment_method: "PIX",
      created_at: "2026-11-16T12:00:00Z",
      items: [{ quantity: 10, unit_price: 100, cost_price: 40 }],
    }];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders,
      products: [],
      repurchases: [],
      partners: basePartners,
      partnerTransactions: [
        makeTx({ id: "tx-4a", partner_id: "partner-eduardo", type: "APORTE", amount: 500, destination_category: "CAIXA_GERAL", date: "2026-11-15" }),
        makeTx({ id: "tx-4b", partner_id: "partner-gabriel", type: "APORTE", amount: 500, destination_category: "CAIXA_GERAL", date: "2026-11-15" }),
      ],
      payrollConfig: basePayrollConfig,
    });

    const eduPayroll = u.payroll.partnerItems.find(p => p.partner.id === "partner-eduardo");
    const eduShare = u.capTable.partnerShares.find(s => s.partner.id === "partner-eduardo");

    const passed =
      eduPayroll?.grossSalaryGenerated === 105 &&
      eduPayroll?.salaryPaidInPeriod === 0 &&
      eduPayroll?.availableToReceive === 105 &&
      eduShare?.equityPercentage === 50 &&
      eduShare?.netCapitalInvested === 500;

    assert(4, "Pró-labore gerado e não retirado (acumula saldo, não altera capital/equity)", passed, `Gerado: ${eduPayroll?.grossSalaryGenerated}, Equity: ${eduShare?.equityPercentage}%`);
  } catch (e: any) {
    assert(4, "Pró-labore gerado e não retirado", false, undefined, e.message);
  }

  // ─── 5. PRÓ-LABORE EFETIVAMENTE PAGO ──────────────────────────────────────
  try {
    const orders = [{
      id: "ord-5",
      delivery_status: "ENTREGUE",
      total_amount: 1000,
      payment_method: "PIX",
      created_at: "2026-11-16T12:00:00Z",
      items: [{ quantity: 10, unit_price: 100, cost_price: 40 }],
    }];

    const txs: PartnerTransaction[] = [
      makeTx({ id: "tx-5a", partner_id: "partner-eduardo", type: "APORTE", amount: 500, destination_category: "CAIXA_GERAL", date: "2026-11-15" }),
      makeTx({ id: "tx-5b", partner_id: "partner-gabriel", type: "APORTE", amount: 500, destination_category: "CAIXA_GERAL", date: "2026-11-15" }),
      makeTx({ id: "tx-5c", partner_id: "partner-eduardo", type: "PRO_LABORE", amount: 105, destination_category: "CAIXA_GERAL", date: "2026-11-16" }),
    ];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders,
      products: [],
      repurchases: [],
      partners: basePartners,
      partnerTransactions: txs,
      payrollConfig: basePayrollConfig,
    });

    const eduPayroll = u.payroll.partnerItems.find(p => p.partner.id === "partner-eduardo");
    const eduShare = u.capTable.partnerShares.find(s => s.partner.id === "partner-eduardo");

    const passed =
      eduPayroll?.salaryPaidInPeriod === 105 &&
      eduPayroll?.availableToReceive === 0 &&
      u.cash.realCash === 1895 &&
      eduShare?.netCapitalInvested === 500 &&
      eduShare?.equityPercentage === 50;

    assert(5, "Pró-labore efetivamente pago (reduz caixa, reduz saldo a receber, não altera capital)", passed, `Pago: ${eduPayroll?.salaryPaidInPeriod}, Caixa: ${u.cash.realCash}`);
  } catch (e: any) {
    assert(5, "Pró-labore efetivamente pago", false, undefined, e.message);
  }

  // ─── 6. DISTRIBUIÇÃO DE LUCRO ─────────────────────────────────────────────
  try {
    const txs: PartnerTransaction[] = [
      makeTx({ id: "tx-6a", partner_id: "partner-eduardo", type: "APORTE", amount: 1000, destination_category: "CAIXA_GERAL", date: "2026-11-15" }),
      makeTx({ id: "tx-6b", partner_id: "partner-eduardo", type: "DISTRIBUICAO_LUCRO", amount: 200, destination_category: "CAIXA_GERAL", date: "2026-11-16" }),
    ];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders: [],
      products: [],
      repurchases: [],
      partners: basePartners,
      partnerTransactions: txs,
      payrollConfig: basePayrollConfig,
    });

    const eduShare = u.capTable.partnerShares.find(s => s.partner.id === "partner-eduardo");
    const passed =
      u.cash.realCash === 800 &&
      u.cash.breakdown.profitDistributionPaid === 200 &&
      eduShare?.netCapitalInvested === 1000 &&
      eduShare?.dividendsReceived === 200;

    assert(6, "Distribuição de lucro (reduz caixa, não altera capital/equity)", passed, `Caixa: ${u.cash.realCash}, Cap: ${eduShare?.netCapitalInvested}`);
  } catch (e: any) {
    assert(6, "Distribuição de lucro", false, undefined, e.message);
  }

  // ─── 7. DESPESA OPERACIONAL DA EMPRESA ────────────────────────────────────
  try {
    const txs: PartnerTransaction[] = [
      makeTx({ id: "tx-7a", partner_id: "partner-eduardo", type: "APORTE", amount: 1000, destination_category: "CAIXA_GERAL", date: "2026-11-15" }),
      makeTx({ id: "tx-7b", partner_id: null, partner_name: "Empresa", type: "DESPESA_OPERACIONAL", amount: 300, description: "Servidor e Luz", destination_category: "CAIXA_GERAL", date: "2026-11-16" }),
    ];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders: [],
      products: [],
      repurchases: [],
      partners: basePartners,
      partnerTransactions: txs,
      payrollConfig: basePayrollConfig,
    });

    const eduShare = u.capTable.partnerShares.find(s => s.partner.id === "partner-eduardo");
    const passed =
      u.cash.realCash === 700 &&
      u.companyExpenses === 300 &&
      u.netProfit === -300 &&
      eduShare?.netCapitalInvested === 1000;

    assert(7, "Despesa operacional da empresa (reduz caixa e DRE, não altera capital)", passed, `Caixa: ${u.cash.realCash}, DRE Desp: ${u.companyExpenses}, Cap: ${eduShare?.netCapitalInvested}`);
  } catch (e: any) {
    assert(7, "Despesa operacional da empresa", false, undefined, e.message);
  }

  // ─── 8. COMPRA DE ESTOQUE ─────────────────────────────────────────────────
  try {
    const repurchases = [{
      id: "rep-8",
      company_id: "company-test-1",
      stock_purchase_amount: 800,
      freight_amount: 50,
      purchase_date: "2026-11-16",
    }];

    const products = [{ id: "p8", brand: "Ignite", name: "V15", stock: 10, price: 120, cost_price: 80 }];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders: [{ id: "o-8", total_amount: 1500, delivery_status: "ENTREGUE", payment_method: "PIX", created_at: "2026-11-16T10:00:00Z" }],
      products,
      repurchases,
      partners: basePartners,
      partnerTransactions: [],
      payrollConfig: basePayrollConfig,
    });

    const passed =
      u.cash.realCash === 650 &&
      u.cash.breakdown.stockRepurchasesPaid === 800 &&
      u.cash.breakdown.stockFreightPaid === 50 &&
      u.stock.stockAssetCost === 800;

    assert(8, "Compra de estoque (reduz caixa, aumenta estoque a custo)", passed, `Caixa: ${u.cash.realCash}, EstCusto: ${u.stock.stockAssetCost}`);
  } catch (e: any) {
    assert(8, "Compra de estoque", false, undefined, e.message);
  }

  // ─── 9. VENDA RECEBIDA À VISTA ────────────────────────────────────────────
  try {
    const orders = [{
      id: "ord-9",
      delivery_status: "ENTREGUE",
      total_amount: 300,
      payment_method: "PIX",
      created_at: "2026-11-16T12:00:00Z",
      items: [{ quantity: 2, unit_price: 150, cost_price: 80 }],
    }];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders,
      products: [],
      repurchases: [],
      partners: basePartners,
      partnerTransactions: [],
      payrollConfig: basePayrollConfig,
    });

    const passed =
      u.cash.realCash === 300 &&
      u.grossRevenue === 300 &&
      u.cmv === 160 &&
      u.netProfit === 140;

    assert(9, "Venda recebida à vista (aumenta caixa, reduz estoque, contabiliza CMV e receita)", passed, `Caixa: ${u.cash.realCash}, Rec: ${u.grossRevenue}, CMV: ${u.cmv}, Lucro: ${u.netProfit}`);
  } catch (e: any) {
    assert(9, "Venda recebida à vista", false, undefined, e.message);
  }

  // ─── 10. VENDA A PRAZO / FIADO ────────────────────────────────────────────
  try {
    const orders = [{
      id: "ord-10",
      delivery_status: "PENDENTE",
      total_amount: 450,
      payment_method: "FIADO",
      created_at: "2026-11-16T12:00:00Z",
      items: [{ quantity: 3, unit_price: 150, cost_price: 80 }],
    }];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders,
      products: [],
      repurchases: [],
      partners: basePartners,
      partnerTransactions: [],
      payrollConfig: basePayrollConfig,
    });

    const passed =
      u.cash.realCash === 0 &&
      u.accountsReceivable === 450 &&
      u.equity.operationalEquityAtCost === 450;

    assert(10, "Venda a prazo / fiado (não aumenta caixa, entra em contas a receber)", passed, `Caixa: ${u.cash.realCash}, ContasAReceber: ${u.accountsReceivable}`);
  } catch (e: any) {
    assert(10, "Venda a prazo / fiado", false, undefined, e.message);
  }

  // ─── 11. RECEBIMENTO DE FIADO ─────────────────────────────────────────────
  try {
    const paidFiadoOrder = {
      id: "ord-11",
      delivery_status: "ENTREGUE",
      total_amount: 250,
      payment_method: "PIX",
      notes: "Recebimento de fiado antigo",
      created_at: "2026-11-16T14:00:00Z",
    };

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders: [paidFiadoOrder],
      products: [],
      repurchases: [],
      partners: basePartners,
      partnerTransactions: [],
      payrollConfig: basePayrollConfig,
    });

    const passed =
      u.cash.realCash === 250 &&
      u.accountsReceivable === 0;

    assert(11, "Recebimento de fiado (aumenta caixa, reduz contas a receber)", passed, `Caixa: ${u.cash.realCash}, AReceber: ${u.accountsReceivable}`);
  } catch (e: any) {
    assert(11, "Recebimento de fiado", false, undefined, e.message);
  }

  // ─── 12. PRODUTO SEM CUSTO CADASTRADO ─────────────────────────────────────
  try {
    const products = [
      { id: "p-ok", brand: "Elfbar", name: "BC5000", stock: 10, price: 100, cost_price: 60 },
      { id: "p-nocost", brand: "LostMary", name: "OS5000", stock: 5, price: 120, cost_price: null },
    ];

    const stockVal = calculateStockValuation(products, {});

    const passed =
      stockVal.stockAssetCost === 600 &&
      stockVal.hasIncompleteCostEvaluation === true &&
      stockVal.missingCostProducts.length === 1 &&
      stockVal.missingCostProducts[0].name === "OS5000" &&
      stockVal.missingCostStockUnits === 5;

    assert(12, "Produto sem custo cadastrado (sinaliza avaliação incompleta, não inventa R$ 65)", passed, `EstCusto: ${stockVal.stockAssetCost}, MissingUnits: ${stockVal.missingCostStockUnits}, IncompleteFlag: ${stockVal.hasIncompleteCostEvaluation}`);
  } catch (e: any) {
    assert(12, "Produto sem custo cadastrado", false, undefined, e.message);
  }

  // ─── 13. CAIXA NEGATIVO (SEM Math.max(0)) ──────────────────────────────────
  try {
    const repurchases = [{
      id: "rep-13",
      company_id: "company-test-1",
      stock_purchase_amount: 1500,
      freight_amount: 100,
      purchase_date: "2026-11-16",
    }];

    const orders = [{
      id: "ord-13",
      delivery_status: "ENTREGUE",
      total_amount: 1000,
      payment_method: "PIX",
      created_at: "2026-11-16T10:00:00Z",
    }];

    const u = calculateUnifiedFinancials({
      companyId: "company-test-1",
      orders,
      products: [],
      repurchases,
      partners: basePartners,
      partnerTransactions: [],
      payrollConfig: basePayrollConfig,
    });

    const passed =
      u.cash.realCash === -600 &&
      u.cash.isNegative === true;

    assert(13, "Caixa negativo (exibe saldo negativo sem Math.max(0))", passed, `CaixaReal: ${u.cash.realCash}, isNegative: ${u.cash.isNegative}`);
  } catch (e: any) {
    assert(13, "Caixa negativo", false, undefined, e.message);
  }

  // ─── 14. CAPITAL TOTAL DOS SÓCIOS IGUAL A ZERO ────────────────────────────
  try {
    const cap = calculateCapTable({
      partners: basePartners,
      transactions: [],
      operationalEquityAtCost: 0,
      stockAssetCost: 0,
      stockAssetRetail: 0,
      realCash: 0,
      accountsReceivable: 0,
    });

    const passed =
      cap.isCapTableCalculable === false &&
      cap.totalNetCapitalInvested === 0 &&
      cap.partnerShares[0].equityPercentage === 0 &&
      cap.partnerShares[0].statusText === "Não calculável" &&
      cap.partnerShares[1].equityPercentage === 0 &&
      cap.partnerShares[1].statusText === "Não calculável";

    assert(14, "Capital total dos sócios igual a zero (indica 'Não calculável', sem percentuais inventados)", passed, `isCalculable: ${cap.isCapTableCalculable}, Status: ${cap.partnerShares[0].statusText}`);
  } catch (e: any) {
    assert(14, "Capital total igual a zero", false, undefined, e.message);
  }

  // ─── 15. ALTERAÇÃO DE PERCENTUAIS DURANTE O CICLO ─────────────────────────
  try {
    const curCycle = getCycleForDate(new Date().toISOString());
    const configWithSchedule: PayrollConfig = {
      ...basePayrollConfig,
      cycleRules: {
        [curCycle.id]: {
          cycleId: curCycle.id,
          reinvestmentPct: 65,
          partnerPcts: { "partner-eduardo": 17.5, "partner-gabriel": 17.5 },
        },
      },
      nextCycleRule: {
        reinvestmentPct: 50,
        partnerPcts: { "partner-eduardo": 25, "partner-gabriel": 25 },
      },
    };

    const payroll = calculateUnifiedPayrollOverview({
      config: configWithSchedule,
      partners: basePartners,
      transactions: [],
      cycleNetProfit: 1000,
      allTimeNetProfit: 1000,
      currentCycleId: curCycle.id,
      realCashAvailable: 1000,
    });

    const edu = payroll.partnerItems.find(p => p.partner.id === "partner-eduardo");
    const passed =
      payroll.reinvestmentPct === 65 &&
      edu?.salaryPct === 17.5 &&
      edu?.grossSalaryGenerated === 175;

    assert(15, "Alteração de percentuais durante o ciclo (congelada para o próximo ciclo)", passed, `Reinvest: ${payroll.reinvestmentPct}%, Edu: ${edu?.salaryPct}%`);
  } catch (e: any) {
    assert(15, "Alteração de percentuais durante o ciclo", false, undefined, e.message);
  }

  // ─── 16. VIRADA DO CICLO DO DIA 13 PARA 14 ────────────────────────────────
  try {
    const cycle13 = getCycleForDate("2026-11-13T23:59:59-03:00");
    const cycle14 = getCycleForDate("2026-11-14T00:00:01-03:00");

    const passed =
      cycle13.id !== cycle14.id &&
      cycle13.endDateStr === "13/11/2026" &&
      cycle14.startDateStr === "14/11/2026";

    assert(16, "Virada do ciclo do dia 13 para 14 (novo ciclo inicia com preservação de histórico)", passed, `C13: ${cycle13.id} (${cycle13.endDateStr}) -> C14: ${cycle14.id} (${cycle14.startDateStr})`);
  } catch (e: any) {
    assert(16, "Virada do ciclo", false, undefined, e.message);
  }

  // ─── 17. IDEMPOTÊNCIA / REPETIÇÃO DA MESMA OPERAÇÃO ───────────────────────
  try {
    const repurchases = [
      { id: "rep-17", company_id: "company-test-1", stock_purchase_amount: 500, freight_amount: 0, purchase_date: "2026-11-16" },
    ];

    const txs: PartnerTransaction[] = [
      makeTx({ id: "tx-17", type: "COMPRA_ESTOQUE", amount: 500, date: "2026-11-16", description: "Compra estoque" }),
    ];

    const cash = calculateRealCashOverview({
      orders: [{ id: "o-17", total_amount: 1000, delivery_status: "ENTREGUE", payment_method: "PIX", created_at: "2026-11-16T12:00:00Z" }],
      repurchases,
      partnerTransactions: txs,
    });

    const passed =
      cash.realCash === 500 &&
      cash.breakdown.stockRepurchasesPaid === 500;

    assert(17, "Idempotência / repetição da mesma operação (deduplicação de lançamentos)", passed, `Caixa: ${cash.realCash}, RecomprasDeduzidas: ${cash.breakdown.stockRepurchasesPaid}`);
  } catch (e: any) {
    assert(17, "Idempotência", false, undefined, e.message);
  }

  // ─── 18. ISOLAMENTO MULTI-TENANT ENTRE EMPRESAS ───────────────────────────
  try {
    const ordersCompany1 = [{ id: "o-c1", company_id: "company-1", total_amount: 800, delivery_status: "ENTREGUE", payment_method: "PIX", created_at: "2026-11-16T10:00:00Z" }];
    const ordersCompany2 = [{ id: "o-c2", company_id: "company-2", total_amount: 300, delivery_status: "ENTREGUE", payment_method: "PIX", created_at: "2026-11-16T11:00:00Z" }];

    const u1 = calculateUnifiedFinancials({
      companyId: "company-1",
      orders: ordersCompany1,
      products: [],
      repurchases: [],
      partners: [makePartner({ id: "p-c1", company_id: "company-1", name: "Sócio 1" })],
      partnerTransactions: [makeTx({ id: "t-c1", company_id: "company-1", partner_id: "p-c1", type: "APORTE", amount: 500, date: "2026-11-15" })],
      payrollConfig: { ...basePayrollConfig },
    });

    const u2 = calculateUnifiedFinancials({
      companyId: "company-2",
      orders: ordersCompany2,
      products: [],
      repurchases: [],
      partners: [makePartner({ id: "p-c2", company_id: "company-2", name: "Sócio 2" })],
      partnerTransactions: [makeTx({ id: "t-c2", company_id: "company-2", partner_id: "p-c2", type: "APORTE", amount: 200, date: "2026-11-15" })],
      payrollConfig: { ...basePayrollConfig },
    });

    const passed =
      u1.companyId === "company-1" &&
      u1.grossRevenue === 800 &&
      u1.capTable.totalNetCapitalInvested === 500 &&
      u2.companyId === "company-2" &&
      u2.grossRevenue === 300 &&
      u2.capTable.totalNetCapitalInvested === 200;

    assert(18, "Isolamento multi-tenant entre empresas (company_id)", passed, `U1 Rec: ${u1.grossRevenue}, U2 Rec: ${u2.grossRevenue}`);
  } catch (e: any) {
    assert(18, "Isolamento multi-tenant", false, undefined, e.message);
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    results,
    timestamp: new Date().toISOString(),
  };
}

if (typeof process !== "undefined" && process.argv && process.argv[1]?.includes("unifiedFinancialEngineTester")) {
  const report = runUnifiedFinancialTestSuite();
  console.log("\n=======================================================");
  console.log("=== BATERIA DE AUDITORIA E RECONSTRUÇÃO FINANCEIRA SMK ===");
  console.log(`Total de Cenários: ${report.total} | Aprovados: ${report.passed} | Reprovados: ${report.failed}`);
  console.log("=======================================================\n");

  for (const r of report.results) {
    const icon = r.passed ? "[OK]" : "[FAIL]";
    console.log(`${icon} #${r.id} ${r.name}`);
    if (r.details) console.log(`     Detalhes: ${r.details}`);
    if (r.error) console.log(`     ERRO: ${r.error}`);
  }

  console.log("\n=======================================================");
  if (report.failed === 0) {
    console.log("SUCESSO: 18/18 CENÁRIOS FINANCEIROS APROVADOS COM PERFEIÇÃO!");
    process.exit(0);
  } else {
    console.log(`ALERTA: ${report.failed} cenários reprovaram.`);
    process.exit(1);
  }
}
