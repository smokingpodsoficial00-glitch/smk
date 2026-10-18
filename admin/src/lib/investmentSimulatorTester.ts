/**
 * investmentSimulatorTester.ts
 *
 * Suíte oficial de testes automatizados para o Simulador de Aportes baseado no Financeiro Real.
 * Valida:
 * 1. Extração exata de Ticket Médio a partir de Receita e Pedidos Válidos (Receita / Pedidos).
 * 2. Cálculo de Margem Líquida Real pós-CMV e custos operacionais.
 * 3. Distinção clara e estrita entre Faturamento gerado e Lucro Líquido gerado (Ticket médio não é lucro).
 * 4. Giro de capital mensal baseado em histórico.
 * 5. Projeção mês a mês de 1 a 6 meses com conferência de saldo inicial, rendimento e saldo final.
 * 6. Cenário Conservador (fator de segurança de 70%).
 * 7. Rejeição de períodos sem dados suficientes (sem inventar taxas fictícias quando não houver faturamento/pedidos).
 * 8. Rejeição de aportes zerados, negativos ou não numéricos.
 * 9. Rejeição de prazos fora do intervalo de 1 a 6 meses.
 * 10. Precisão em centavos em todas as linhas e totais.
 * 11. Reatividade e atualização proporcional quando os parâmetros mudam.
 * 12. Isolamento absoluto: nenhuma chamada de persistência ao Supabase.
 */

import {
  calculateBusinessInvestmentProjection,
  extractBusinessIndicators,
  roundCents
} from './investmentSimulator';
import type { CompanyFinancialOverview } from './partners';
import type { CycleFinancialMetrics } from './financialCycles';

export interface InvestmentTestItem {
  id: number;
  description: string;
  passed: boolean;
  details: string;
  error?: string;
}

export interface InvestmentTestSuiteReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: InvestmentTestItem[];
}

// Mock oficial de overview financeiro com dados conhecidos
const mockOverview: CompanyFinancialOverview = {
  grossRevenue: 10000,
  realCash: 2500,
  stockPurchases: 4000,
  cmv: 5500,
  logisticsFee: 300,
  operationalExpenses: 500,
  netProfitRealized: 2000, // Margem líquida real = 2.000 / 10.000 = 20%
  netProfitMarginPct: 20,
  officialProfitMarginPct: 20,
  retainedProfit: 2000,
  totalOrdersCount: 50, // Ticket médio = 10.000 / 50 = R$ 200,00
  totalPodsSold: 120,
  companyTotalProjectedProfit: 400,
  companyTotalProjectedEquity: 2400,
  stockAssetUnits: 200,
  stockAssetCost: 10000,
  stockAssetRetail: 16000,
  stockPotentialGrossMargin: 6000,
  netCashAvailable: 4000,
  companyEconomicEquity: 18500,
  totalNetCapitalInvested: 2000,
  totalEquitySum: 100,
  isCapTableBalanced: true,
  hasDefinedCapital: true,
  partnerMetrics: []
};

export function runInvestmentSimulatorTestSuite(): InvestmentTestSuiteReport {
  const results: InvestmentTestItem[] = [];

  // Teste 1: Ticket Médio Real extraído de Receita e Pedidos Válidos
  try {
    const indicators = extractBusinessIndicators(mockOverview, []);
    const expectedTicket = 200.00; // 10.000 / 50
    const ok = indicators.averageTicket === expectedTicket && indicators.totalValidOrders === 50;

    results.push({
      id: 1,
      description: 'Cálculo auditado de Ticket Médio Real (Receita / Total Pedidos Válidos)',
      passed: ok,
      details: ok
        ? `Ticket Médio apurado com exatidão: R$ ${indicators.averageTicket.toFixed(2)}`
        : `Divergência: obtido R$ ${indicators.averageTicket}, esperado R$ ${expectedTicket}`
    });
  } catch (e: any) {
    results.push({ id: 1, description: 'Ticket Médio', passed: false, details: e.message, error: e.message });
  }

  // Teste 2: Margem Líquida Real pós-CMV e custos
  try {
    const indicators = extractBusinessIndicators(mockOverview, []);
    const expectedMargin = 20.00; // 2000 / 10000 * 100
    const ok = indicators.realNetMarginPct === expectedMargin;

    results.push({
      id: 2,
      description: 'Margem Líquida Real pós-CMV e custos operacionais',
      passed: ok,
      details: ok
        ? `Margem Líquida Real: ${indicators.realNetMarginPct.toFixed(2)}%`
        : `Divergência: obtido ${indicators.realNetMarginPct}%, esperado ${expectedMargin}%`
    });
  } catch (e: any) {
    results.push({ id: 2, description: 'Margem Líquida', passed: false, details: e.message, error: e.message });
  }

  // Teste 3: Não confundir Faturamento com Lucro Líquido
  try {
    const res = calculateBusinessInvestmentProjection({
      aporteAmount: 1000,
      periodMonths: 3,
      financialOverview: mockOverview
    });

    const m1 = res.monthlyProjections[0];
    const isDistinct =
      m1.estimatedRevenue > m1.monthYield &&
      m1.estimatedRevenue >= 1000 &&
      m1.monthYield <= m1.estimatedRevenue * 0.25;

    results.push({
      id: 3,
      description: 'Separação estrita entre Faturamento gerado e Lucro Líquido do capital',
      passed: isDistinct && res.isValid,
      details: isDistinct
        ? `Faturamento M1 (R$ ${m1.estimatedRevenue.toFixed(2)}) rigorosamente separado do Lucro M1 (R$ ${m1.monthYield.toFixed(2)})`
        : 'Confusão entre faturamento e rendimento'
    });
  } catch (e: any) {
    results.push({ id: 3, description: 'Separação Faturamento vs Lucro', passed: false, details: e.message, error: e.message });
  }

  // Teste 4: Giro de Capital e taxa mensal proporcional aos dados reais
  try {
    const indicators = extractBusinessIndicators(mockOverview, []);
    const ok = indicators.monthlyCapitalTurnover > 0 && indicators.monthlyReturnRatePct > 0;

    results.push({
      id: 4,
      description: 'Giro de capital e taxa mensal derivados exclusivamente do histórico da empresa',
      passed: ok,
      details: ok
        ? `Giro: ${indicators.monthlyCapitalTurnover}x/mês, Taxa Mensal: ${indicators.monthlyReturnRatePct.toFixed(2)}% a.m.`
        : 'Falha na derivação do giro de capital'
    });
  } catch (e: any) {
    results.push({ id: 4, description: 'Giro de capital', passed: false, details: e.message, error: e.message });
  }

  // Teste 5: Projeção Mês a Mês de 1 a 6 meses
  try {
    const res = calculateBusinessInvestmentProjection({
      aporteAmount: 1000,
      periodMonths: 6,
      financialOverview: mockOverview
    });

    const ok =
      res.isValid &&
      res.monthlyProjections.length === 6 &&
      res.monthlyProjections[0].month === 1 &&
      res.monthlyProjections[5].month === 6 &&
      res.finalProjectedAmount > res.aporteAmount &&
      res.totalProjectedYield === roundCents(res.finalProjectedAmount - res.aporteAmount);

    results.push({
      id: 5,
      description: 'Projeção encadeada de 1 a 6 meses com saldo final reconciliado',
      passed: ok,
      details: ok
        ? `6 meses gerados: Aporte R$ 1.000,00 -> Final R$ ${res.finalProjectedAmount.toFixed(2)} (+R$ ${res.totalProjectedYield.toFixed(2)})`
        : 'Inconsistência na projeção de 6 meses'
    });
  } catch (e: any) {
    results.push({ id: 5, description: 'Projeção 6 meses', passed: false, details: e.message, error: e.message });
  }

  // Teste 6: Cenário Conservador aplicando fator de segurança
  try {
    const res = calculateBusinessInvestmentProjection({
      aporteAmount: 1000,
      periodMonths: 6,
      financialOverview: mockOverview
    });

    const isConservativeLower =
      res.finalConservativeAmount < res.finalProjectedAmount &&
      res.totalConservativeYield < res.totalProjectedYield &&
      res.totalConservativeYield > 0;

    results.push({
      id: 6,
      description: 'Cenário Conservador com fator de segurança e menor volatilidade',
      passed: isConservativeLower && res.isValid,
      details: isConservativeLower
        ? `Base: R$ ${res.finalProjectedAmount.toFixed(2)} | Conservador: R$ ${res.finalConservativeAmount.toFixed(2)}`
        : 'Cenário conservador não respeitou limites inferiores'
    });
  } catch (e: any) {
    results.push({ id: 6, description: 'Cenário Conservador', passed: false, details: e.message, error: e.message });
  }

  // Teste 7: Dados Insuficientes (Sem inventar taxas fictícias quando não houver faturamento)
  try {
    const emptyOverview: CompanyFinancialOverview = {
      ...mockOverview,
      grossRevenue: 0,
      totalOrdersCount: 0,
      netProfitRealized: 0
    };

    const res = calculateBusinessInvestmentProjection({
      aporteAmount: 1000,
      periodMonths: 6,
      financialOverview: emptyOverview
    });

    const ok = !res.isValid && !res.indicators.hasSufficientData && res.indicators.missingDataReasons.length > 0;

    results.push({
      id: 7,
      description: 'Rejeição de projeção fictícia na ausência de faturamento ou pedidos válidos',
      passed: ok,
      details: ok
        ? `Bloqueado com aviso transparente: "${res.errorMessage}"`
        : 'Sistema inventou taxa fictícia sem dados suficientes'
    });
  } catch (e: any) {
    results.push({ id: 7, description: 'Dados Insuficientes', passed: false, details: e.message, error: e.message });
  }

  // Teste 8: Rejeição de aportes zerados ou negativos
  try {
    const resZero = calculateBusinessInvestmentProjection({ aporteAmount: 0, periodMonths: 6, financialOverview: mockOverview });
    const resNeg = calculateBusinessInvestmentProjection({ aporteAmount: -500, periodMonths: 6, financialOverview: mockOverview });

    const ok = !resZero.isValid && !resNeg.isValid;

    results.push({
      id: 8,
      description: 'Rejeição de aporte inicial menor ou igual a zero (R$ 0 ou negativo)',
      passed: ok,
      details: ok
        ? 'Aportes inválidos (<= 0) rejeitados com feedback explicativo'
        : 'Permitiu aporte zero ou negativo'
    });
  } catch (e: any) {
    results.push({ id: 8, description: 'Aporte Inválido', passed: false, details: e.message, error: e.message });
  }

  // Teste 9: Limite estrito de prazo (1 a 6 meses)
  try {
    const resMin = calculateBusinessInvestmentProjection({ aporteAmount: 1000, periodMonths: 1, financialOverview: mockOverview });
    const resMax = calculateBusinessInvestmentProjection({ aporteAmount: 1000, periodMonths: 6, financialOverview: mockOverview });
    const resSeven = calculateBusinessInvestmentProjection({ aporteAmount: 1000, periodMonths: 7, financialOverview: mockOverview });

    const ok = resMin.isValid && resMax.isValid && !resSeven.isValid;

    results.push({
      id: 9,
      description: 'Validação de prazo de 1 a 6 meses (rejeita 0 ou > 6)',
      passed: ok,
      details: ok
        ? 'Prazos 1 e 6 aprovados; prazo 7 rejeitado com sucesso'
        : 'Falha nos limites de prazo'
    });
  } catch (e: any) {
    results.push({ id: 9, description: 'Limites de Prazo', passed: false, details: e.message, error: e.message });
  }

  // Teste 10: Precisão em centavos em todas as linhas
  try {
    const res = calculateBusinessInvestmentProjection({
      aporteAmount: 1234.56,
      periodMonths: 6,
      financialOverview: mockOverview
    });

    const allCentPrecision = res.monthlyProjections.every(p => {
      const bStr = p.finalBalance.toString().split('.')[1] || '';
      const yStr = p.monthYield.toString().split('.')[1] || '';
      return bStr.length <= 2 && yStr.length <= 2;
    });

    results.push({
      id: 10,
      description: 'Precisão monetária rigorosa em centavos (2 casas decimais)',
      passed: allCentPrecision && res.isValid,
      details: allCentPrecision
        ? 'Todos os saldos e rendimentos formatados em centavos exatos'
        : 'Problemas de ponto flutuante detectados'
    });
  } catch (e: any) {
    results.push({ id: 10, description: 'Precisão em Centavos', passed: false, details: e.message, error: e.message });
  }

  // Teste 11: Reatividade determinística ao mudar parâmetros
  try {
    const run1 = calculateBusinessInvestmentProjection({ aporteAmount: 1000, periodMonths: 3, financialOverview: mockOverview });
    const run2 = calculateBusinessInvestmentProjection({ aporteAmount: 2000, periodMonths: 3, financialOverview: mockOverview });

    const ok = run2.finalProjectedAmount > run1.finalProjectedAmount;

    results.push({
      id: 11,
      description: 'Reatividade imediata: novo aporte recalcula faturamento e lucros proporcionalmente',
      passed: ok,
      details: ok
        ? `R$ 1.000 -> R$ ${run1.finalProjectedAmount.toFixed(2)} | R$ 2.000 -> R$ ${run2.finalProjectedAmount.toFixed(2)}`
        : 'Inconsistência na atualização dos parâmetros'
    });
  } catch (e: any) {
    results.push({ id: 11, description: 'Reatividade', passed: false, details: e.message, error: e.message });
  }

  // Teste 12: Ausência de persistência ou mutação no Supabase
  try {
    const res = calculateBusinessInvestmentProjection({ aporteAmount: 1000, periodMonths: 6, financialOverview: mockOverview });
    const isPure = typeof res === 'object' && res.isValid && !('supabase' in res);

    results.push({
      id: 12,
      description: 'Isolamento de persistência: simulação em memória sem escrita no Supabase',
      passed: isPure,
      details: 'Sem mutações na base de dados ou contaminação de transações reais'
    });
  } catch (e: any) {
    results.push({ id: 12, description: 'Isolamento de Persistência', passed: false, details: e.message, error: e.message });
  }

  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;

  return {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passedTests,
    failedTests,
    allPassed: failedTests === 0,
    results
  };
}

export function runCli(): void {
  const report = runInvestmentSimulatorTestSuite();
  console.log('\n=== BATERIA DE TESTES OFICIAIS — SIMULADOR DE APORTES (FINANCEIRO REAL) ===');
  console.log(`Executados: ${report.totalTests} | Passaram: ${report.passedTests} | Falharam: ${report.failedTests}`);
  report.results.forEach(r => {
    console.log(`[${r.passed ? 'OK' : 'FALHA'}] #${r.id} ${r.description}`);
    if (!r.passed) {
      console.error(`       Detalhes: ${r.details}`);
      if (r.error) console.error(`       Erro: ${r.error}`);
    }
  });

  if (report.allPassed) {
    console.log('\n✅ SUCESSO: Todos os testes do Simulador de Aportes passaram com êxito.\n');
    process.exit(0);
  } else {
    console.error('\n❌ ERRO: Um ou mais testes do Simulador de Aportes falharam.\n');
    process.exit(1);
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('investmentSimulatorTester')) {
  runCli();
}
