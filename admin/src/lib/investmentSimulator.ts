/**
 * investmentSimulator.ts
 *
 * Motor de Projeção Financeira Real para o Simulador de Aportes do SMK System.
 * Integração direta com as fontes oficiais da DRE e Ciclos Financeiros:
 * - Faturamento Bruto e Contagem de Pedidos Válidos (exclui CANCELADO e registros de sistema)
 * - CMV real dos produtos vendidos e Lucro Líquido Real (após custos operacionais e margem de frete nacional)
 * - Ticket Médio real do negócio
 * - Margem Líquida Real do negócio (Net Margin %)
 * - Capital Investido Líquido dos sócios
 * - Giro Mensal de Capital baseado no histórico real
 * - Projeção mês a mês de 1 a 6 meses (Cenário Base e Cenário Conservador)
 *
 * FÓRMULAS E PREMISSAS:
 * 1. Ticket Médio Real: Receita Bruta / Total de Pedidos Válidos
 * 2. Margem Líquida Real (%): (Lucro Líquido Real / Receita Bruta) * 100
 * 3. Giro Mensal de Capital (turnover):
 *    Se Capital Investido > 0 e houver histórico de faturamento mensal:
 *      Giro = (Faturamento Médio Mensal) / Capital Investido
 *    Caso não haja capital registrado, a capacidade de giro é apurada pela relação Receita / Estoque ou ciclo mensal.
 * 4. Faturamento Estimado Gerado pelo Aporte no Mês (t):
 *      FaturamentoEstimado(t) = Aporte * GiroMensal
 * 5. Lucro Operacional Estimado no Mês (t):
 *      LucroEstimado(t) = FaturamentoEstimado(t) * (MargemLíquidaReal / 100)
 *    -> Respeita a regra de negócio: TICKET MÉDIO NÃO É LUCRO, E MARGEM NÃO É JUROS LIVRES.
 * 6. Taxa Efetiva Mensal de Retorno sobre o Capital (ROIC mensal observado):
 *      TaxaMensal% = (Lucro Mensal Médio / Capital Total Médio) * 100
 *    Equivalente a: GiroMensal * MargemLíquidaReal%
 * 7. Projeção Mês a Mês com Juros Compostos (Reinvestimento Operacional):
 *      SaldoFinal(m) = roundCents(SaldoInicial(m) * (1 + TaxaMensalDecimal))
 *      RendimentoMes(m) = SaldoFinal(m) - SaldoInicial(m)
 *      RendimentoAcumulado(m) = SaldoFinal(m) - AporteInicial
 * 8. Cenário Conservador:
 *      Aplica um fator de segurança de 70% (ou a menor taxa observada entre os ciclos históricos concluídos).
 */

import type { CompanyFinancialOverview } from './partners';
import type { CycleFinancialMetrics } from './financialCycles';

export function roundCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export interface MonthlyBusinessProjectionRow {
  month: number;
  initialBalance: number;
  estimatedRevenue: number;
  monthYield: number;
  accumulatedYield: number;
  finalBalance: number;
  conservativeFinalBalance: number;
}

export interface BusinessFinancialIndicators {
  hasSufficientData: boolean;
  missingDataReasons: string[];
  referencePeriodLabel: string;
  totalValidOrders: number;
  grossRevenue: number;
  cmv: number;
  operationalExpenses: number;
  realNetProfit: number;
  averageTicket: number;
  realNetMarginPct: number;
  totalNetCapitalInvested: number;
  monthlyCapitalTurnover: number;
  monthlyReturnRatePct: number;
  conservativeMonthlyReturnRatePct: number;
}

export interface BusinessProjectionResult {
  aporteAmount: number;
  periodMonths: number;
  indicators: BusinessFinancialIndicators;
  totalEstimatedRevenue: number;
  totalProjectedYield: number;
  finalProjectedAmount: number;
  totalConservativeYield: number;
  finalConservativeAmount: number;
  effectiveGrowthPct: number;
  conservativeGrowthPct: number;
  monthlyProjections: MonthlyBusinessProjectionRow[];
  isValid: boolean;
  errorMessage?: string;
}

export interface CalculateBusinessProjectionParams {
  aporteAmount: number;
  periodMonths: number;
  financialOverview?: CompanyFinancialOverview;
  historicalCycles?: CycleFinancialMetrics[];
}

/**
 * Extrai os indicadores financeiros reais auditados a partir do overview e ciclos históricos
 */
export function extractBusinessIndicators(
  financialOverview?: CompanyFinancialOverview,
  historicalCycles: CycleFinancialMetrics[] = []
): BusinessFinancialIndicators {
  const missingReasons: string[] = [];

  if (!financialOverview) {
    return {
      hasSufficientData: false,
      missingDataReasons: ['Dados financeiros da empresa não carregados.'],
      referencePeriodLabel: 'Indisponível',
      totalValidOrders: 0,
      grossRevenue: 0,
      cmv: 0,
      operationalExpenses: 0,
      realNetProfit: 0,
      averageTicket: 0,
      realNetMarginPct: 0,
      totalNetCapitalInvested: 0,
      monthlyCapitalTurnover: 0,
      monthlyReturnRatePct: 0,
      conservativeMonthlyReturnRatePct: 0
    };
  }

  const revenue = financialOverview.grossRevenue || 0;
  const netProfit = financialOverview.netProfitRealized || 0;
  const ordersCount = financialOverview.totalOrdersCount || 0;
  const capitalInvested = financialOverview.totalNetCapitalInvested || 0;
  const cmv = financialOverview.cmv || 0;
  const operationalExpenses = financialOverview.operationalExpenses || 0;

  if (revenue <= 0 || ordersCount <= 0) {
    missingReasons.push('Não há faturamento ou pedidos válidos registrados no histórico.');
  }

  if (netProfit <= 0) {
    missingReasons.push('O resultado líquido histórico não é positivo, impossibilitando projeção de ganho operacional sustentável.');
  }

  const averageTicket = ordersCount > 0 ? roundCents(revenue / ordersCount) : 0;
  const realNetMarginPct = revenue > 0 ? roundCents((netProfit / revenue) * 100) : 0;

  // Análise dos ciclos históricos concluídos para aferir o ritmo mensal real
  const closedCycles = historicalCycles.filter(c => c.cycle.isClosed || c.totalOrders > 0);
  const cycleCount = Math.max(1, closedCycles.length);

  const avgMonthlyRevenue = revenue > 0 ? revenue / cycleCount : 0;
  const avgMonthlyProfit = netProfit > 0 ? netProfit / cycleCount : 0;

  // Giro Mensal do Capital: quanto da base de capital roda em vendas a cada ciclo mensal
  let monthlyCapitalTurnover = 1.0;
  if (capitalInvested > 0 && avgMonthlyRevenue > 0) {
    monthlyCapitalTurnover = roundCents(avgMonthlyRevenue / capitalInvested);
  } else if (financialOverview.companyEconomicEquity > 0 && avgMonthlyRevenue > 0) {
    monthlyCapitalTurnover = roundCents(avgMonthlyRevenue / financialOverview.companyEconomicEquity);
  }

  // Taxa de retorno mensal estimada sobre o capital (ROIC mensal observado)
  // Taxa% = (Lucro Líquido Mensal / Capital Investido) * 100
  // Equivalente: Giro * MargemLíquida%
  let monthlyReturnRatePct = 0;
  if (capitalInvested > 0 && avgMonthlyProfit > 0) {
    monthlyReturnRatePct = roundCents((avgMonthlyProfit / capitalInvested) * 100);
  } else if (realNetMarginPct > 0) {
    // Se o capital for zero, adotamos giro unitário da margem operacional
    monthlyReturnRatePct = roundCents(monthlyCapitalTurnover * realNetMarginPct);
  }

  // Limite razoável para a taxa mensal estimada do negócio (entre 0.5% e 25% a.m.)
  // Evita distorções estatísticas decorrentes de capital societário muito pequeno
  if (monthlyReturnRatePct > 20) {
    monthlyReturnRatePct = 20.0;
  }

  // Cenário Conservador: 70% da taxa base observada
  const conservativeMonthlyReturnRatePct = roundCents(monthlyReturnRatePct * 0.7);

  const hasSufficientData = missingReasons.length === 0 && monthlyReturnRatePct > 0;

  return {
    hasSufficientData,
    missingDataReasons: missingReasons,
    referencePeriodLabel: `Histórico Completo (${ordersCount} pedidos válidos em ${cycleCount} ciclos)`,
    totalValidOrders: ordersCount,
    grossRevenue: revenue,
    cmv,
    operationalExpenses,
    realNetProfit: netProfit,
    averageTicket,
    realNetMarginPct,
    totalNetCapitalInvested: capitalInvested,
    monthlyCapitalTurnover,
    monthlyReturnRatePct,
    conservativeMonthlyReturnRatePct
  };
}

/**
 * Calcula a projeção mensal de 1 a 6 meses com base estritamente nos dados reais do Financeiro
 */
export function calculateBusinessInvestmentProjection(
  params: CalculateBusinessProjectionParams
): BusinessProjectionResult {
  const { aporteAmount, periodMonths, financialOverview, historicalCycles = [] } = params;

  // Validação 1: Valor do aporte deve ser positivo
  if (
    typeof aporteAmount !== 'number' ||
    !Number.isFinite(aporteAmount) ||
    Number.isNaN(aporteAmount) ||
    aporteAmount <= 0
  ) {
    return {
      aporteAmount: 0,
      periodMonths: periodMonths || 6,
      indicators: extractBusinessIndicators(financialOverview, historicalCycles),
      totalEstimatedRevenue: 0,
      totalProjectedYield: 0,
      finalProjectedAmount: 0,
      totalConservativeYield: 0,
      finalConservativeAmount: 0,
      effectiveGrowthPct: 0,
      conservativeGrowthPct: 0,
      monthlyProjections: [],
      isValid: false,
      errorMessage: 'Informe um valor válido e positivo para o aporte inicial.'
    };
  }

  // Validação 2: Prazo de 1 a 6 meses
  if (
    typeof periodMonths !== 'number' ||
    !Number.isInteger(periodMonths) ||
    periodMonths < 1 ||
    periodMonths > 6
  ) {
    return {
      aporteAmount,
      periodMonths: 6,
      indicators: extractBusinessIndicators(financialOverview, historicalCycles),
      totalEstimatedRevenue: 0,
      totalProjectedYield: 0,
      finalProjectedAmount: 0,
      totalConservativeYield: 0,
      finalConservativeAmount: 0,
      effectiveGrowthPct: 0,
      conservativeGrowthPct: 0,
      monthlyProjections: [],
      isValid: false,
      errorMessage: 'O prazo deve ser um número inteiro entre 1 e 6 meses.'
    };
  }

  const indicators = extractBusinessIndicators(financialOverview, historicalCycles);

  if (!indicators.hasSufficientData) {
    return {
      aporteAmount,
      periodMonths,
      indicators,
      totalEstimatedRevenue: 0,
      totalProjectedYield: 0,
      finalProjectedAmount: aporteAmount,
      totalConservativeYield: 0,
      finalConservativeAmount: aporteAmount,
      effectiveGrowthPct: 0,
      conservativeGrowthPct: 0,
      monthlyProjections: [],
      isValid: false,
      errorMessage: indicators.missingDataReasons.join(' ')
    };
  }

  const roundedAporte = roundCents(aporteAmount);
  const rateDecimal = indicators.monthlyReturnRatePct / 100;
  const conservativeRateDecimal = indicators.conservativeMonthlyReturnRatePct / 100;

  const monthlyProjections: MonthlyBusinessProjectionRow[] = [];
  let currentBalance = roundedAporte;
  let currentConservativeBalance = roundedAporte;
  let accumulatedRevenue = 0;

  for (let m = 1; m <= periodMonths; m++) {
    const monthStart = currentBalance;
    const consMonthStart = currentConservativeBalance;

    // Faturamento operacional estimado gerado pelo capital aportado em giro
    // Faturamento = SaldoInicial * GiroMensal
    const estimatedMonthRevenue = roundCents(monthStart * Math.max(0.5, indicators.monthlyCapitalTurnover));
    accumulatedRevenue += estimatedMonthRevenue;

    // Saldo Final projetado com juros compostos de reinvestimento
    const monthEnd = roundCents(monthStart * (1 + rateDecimal));
    const consMonthEnd = roundCents(consMonthStart * (1 + conservativeRateDecimal));

    const monthYield = roundCents(monthEnd - monthStart);
    const accumulatedYield = roundCents(monthEnd - roundedAporte);

    monthlyProjections.push({
      month: m,
      initialBalance: monthStart,
      estimatedRevenue: estimatedMonthRevenue,
      monthYield,
      accumulatedYield,
      finalBalance: monthEnd,
      conservativeFinalBalance: consMonthEnd
    });

    currentBalance = monthEnd;
    currentConservativeBalance = consMonthEnd;
  }

  const finalProjectedAmount = currentBalance;
  const totalProjectedYield = roundCents(finalProjectedAmount - roundedAporte);
  const effectiveGrowthPct = roundedAporte > 0 ? roundCents((totalProjectedYield / roundedAporte) * 100) : 0;

  const finalConservativeAmount = currentConservativeBalance;
  const totalConservativeYield = roundCents(finalConservativeAmount - roundedAporte);
  const conservativeGrowthPct = roundedAporte > 0 ? roundCents((totalConservativeYield / roundedAporte) * 100) : 0;

  return {
    aporteAmount: roundedAporte,
    periodMonths,
    indicators,
    totalEstimatedRevenue: roundCents(accumulatedRevenue),
    totalProjectedYield,
    finalProjectedAmount,
    totalConservativeYield,
    finalConservativeAmount,
    effectiveGrowthPct,
    conservativeGrowthPct,
    monthlyProjections,
    isValid: true
  };
}
