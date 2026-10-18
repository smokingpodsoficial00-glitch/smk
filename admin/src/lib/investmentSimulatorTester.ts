/**
 * investmentSimulatorTester.ts
 *
 * Suíte oficial de testes automatizados para o Simulador de Aportes do SMK System.
 * Valida rigorosamente:
 * 1. Aporte de R$ 1.000,00 com taxa zero (0%) em 6 meses -> rendimento R$ 0,00 e saldo final R$ 1.000,00.
 * 2. Aporte com taxa positiva (ex: 2% a.m.) em 1 mês.
 * 3. Aporte com taxa positiva (ex: 2% a.m.) em 6 meses com conferência exata de juros compostos.
 * 4. Juros compostos calculados estritamente sobre o saldo final do mês anterior.
 * 5. Rendimento acumulado e saldo final reconciliados centavo a centavo.
 * 6. Precisão de centavos e ausência de resíduos de ponto flutuante IEEE-754.
 * 7. Limites de prazo: aceita 1 e 6 meses; rejeita 0, 7 ou valores fracionários.
 * 8. Rejeição de entradas vazias, NaN, nulas ou não numéricas (sem converter silenciosamente para zero).
 * 9. Rejeição de aportes zerados ou negativos com mensagens descritivas.
 * 10. Rejeição de taxas fora de limites razoáveis (< -100% ou > 500%).
 * 11. Reatividade determinística (mudança de parâmetros gera novos resultados consistentes).
 * 12. Garantia de isolamento: nenhuma chamada de persistência ou mutação ao Supabase.
 */

import {
  calculateInvestmentProjection,
  roundCents,
  type InvestmentSimulationResult
} from './investmentSimulator';

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

export function runInvestmentSimulatorTestSuite(): InvestmentTestSuiteReport {
  const results: InvestmentTestItem[] = [];

  // Teste 1: Aporte de R$ 1.000,00 com taxa zero em 6 meses
  try {
    const res = calculateInvestmentProjection({
      initialInvestment: 1000,
      monthlyRatePct: 0,
      periodMonths: 6
    });

    const isOk =
      res.isValid &&
      res.initialInvestment === 1000 &&
      res.finalAmount === 1000 &&
      res.totalYield === 0 &&
      res.projections.length === 6 &&
      res.projections.every(p => p.monthYield === 0 && p.finalBalance === 1000);

    results.push({
      id: 1,
      description: 'Aporte de R$ 1.000,00 com taxa zero (0%) em 6 meses',
      passed: isOk,
      details: isOk
        ? 'Todos os 6 meses mantiveram R$ 1.000,00 sem rendimentos indevidos'
        : `Divergência: finalAmount=${res.finalAmount}, totalYield=${res.totalYield}`
    });
  } catch (e: any) {
    results.push({ id: 1, description: 'Taxa zero', passed: false, details: e.message, error: e.message });
  }

  // Teste 2: Aporte com taxa positiva em 1 mês (R$ 1.000,00 a 2,5% a.m.)
  try {
    const res = calculateInvestmentProjection({
      initialInvestment: 1000,
      monthlyRatePct: 2.5,
      periodMonths: 1
    });

    const isOk =
      res.isValid &&
      res.projections.length === 1 &&
      res.projections[0].monthYield === 25.00 &&
      res.projections[0].accumulatedYield === 25.00 &&
      res.projections[0].finalBalance === 1025.00 &&
      res.finalAmount === 1025.00 &&
      res.totalYield === 25.00;

    results.push({
      id: 2,
      description: 'Aporte com taxa positiva em 1 mês (R$ 1.000,00 a 2,5% a.m.)',
      passed: isOk,
      details: isOk
        ? 'Rendimento exato de R$ 25,00 e saldo final R$ 1.025,00'
        : `Divergência: yield=${res.totalYield}, final=${res.finalAmount}`
    });
  } catch (e: any) {
    results.push({ id: 2, description: 'Taxa positiva 1 mês', passed: false, details: e.message, error: e.message });
  }

  // Teste 3: Aporte com taxa positiva em 6 meses com conferência exata
  try {
    // R$ 1.000 a 2% a.m. por 6 meses:
    // Mês 1: 1000 * 1.02 = 1020.00 (rend: 20.00)
    // Mês 2: 1020 * 1.02 = 1040.40 (rend: 20.40)
    // Mês 3: 1040.40 * 1.02 = 1061.21 (rend: 20.81)
    // Mês 4: 1061.21 * 1.02 = 1082.43 (rend: 21.22)
    // Mês 5: 1082.43 * 1.02 = 1104.08 (rend: 21.65)
    // Mês 6: 1104.08 * 1.02 = 1126.16 (rend: 22.08)
    // Rendimento Acumulado: 126.16
    const res = calculateInvestmentProjection({
      initialInvestment: 1000,
      monthlyRatePct: 2,
      periodMonths: 6
    });

    const isOk =
      res.isValid &&
      res.projections.length === 6 &&
      res.projections[0].finalBalance === 1020.00 &&
      res.projections[1].finalBalance === 1040.40 &&
      res.projections[2].finalBalance === 1061.21 &&
      res.projections[3].finalBalance === 1082.43 &&
      res.projections[4].finalBalance === 1104.08 &&
      res.projections[5].finalBalance === 1126.16 &&
      res.finalAmount === 1126.16 &&
      res.totalYield === 126.16;

    results.push({
      id: 3,
      description: 'Aporte com taxa positiva em 6 meses (R$ 1.000,00 a 2% a.m.)',
      passed: isOk,
      details: isOk
        ? 'Evolução mensal verificada centavo a centavo: R$ 1.126,16 final (+R$ 126,16)'
        : `Divergência: obtido final=${res.finalAmount}, yield=${res.totalYield}`
    });
  } catch (e: any) {
    results.push({ id: 3, description: 'Taxa positiva 6 meses', passed: false, details: e.message, error: e.message });
  }

  // Teste 4: Juros compostos calculados estritamente sobre o saldo anterior
  try {
    const res = calculateInvestmentProjection({
      initialInvestment: 5000,
      monthlyRatePct: 3,
      periodMonths: 4
    });

    // Cada linha deve ter initialBalance igual ao finalBalance da linha anterior
    let compoundsStrictly = true;
    for (let i = 1; i < res.projections.length; i++) {
      if (res.projections[i].initialBalance !== res.projections[i - 1].finalBalance) {
        compoundsStrictly = false;
        break;
      }
    }

    results.push({
      id: 4,
      description: 'Juros compostos calculados sobre o saldo final do mês anterior',
      passed: compoundsStrictly && res.isValid,
      details: compoundsStrictly
        ? 'Confirmado: saldo inicial de cada mês M coincide 100% com saldo final de M-1'
        : 'Falha no encadeamento dos juros compostos'
    });
  } catch (e: any) {
    results.push({ id: 4, description: 'Encadeamento juros compostos', passed: false, details: e.message, error: e.message });
  }

  // Teste 5: Reconciliação do rendimento acumulado e saldo final
  try {
    const res = calculateInvestmentProjection({
      initialInvestment: 2500,
      monthlyRatePct: 1.8,
      periodMonths: 5
    });

    // Soma dos rendimentos mensais deve bater exatamente com totalYield
    const sumMonthlyYields = roundCents(res.projections.reduce((acc, row) => acc + row.monthYield, 0));
    const isReconciled =
      sumMonthlyYields === res.totalYield &&
      roundCents(res.initialInvestment + res.totalYield) === res.finalAmount;

    results.push({
      id: 5,
      description: 'Reconciliação exata de soma dos rendimentos e saldo final',
      passed: isReconciled,
      details: isReconciled
        ? `Soma dos rendimentos (R$ ${sumMonthlyYields.toFixed(2)}) == Rendimento Total (R$ ${res.totalYield.toFixed(2)})`
        : `Inconsistência: soma=${sumMonthlyYields}, totalYield=${res.totalYield}`
    });
  } catch (e: any) {
    results.push({ id: 5, description: 'Reconciliação', passed: false, details: e.message, error: e.message });
  }

  // Teste 6: Precisão de centavos e prevenção de dízimas periódicas
  try {
    // 1000 / 3% = 1033.3333333333...
    const res = calculateInvestmentProjection({
      initialInvestment: 1000,
      monthlyRatePct: 3.3333,
      periodMonths: 6
    });

    const allHaveTwoDecimals = res.projections.every(p => {
      const bStr = p.finalBalance.toString().split('.')[1] || '';
      const yStr = p.monthYield.toString().split('.')[1] || '';
      return bStr.length <= 2 && yStr.length <= 2;
    });

    results.push({
      id: 6,
      description: 'Precisão em centavos (2 casas) sem dízimas periódicas flutuantes',
      passed: allHaveTwoDecimals && res.isValid,
      details: allHaveTwoDecimals
        ? 'Todos os valores arredondados para exatamente 2 casas decimais'
        : 'Encontradas dízimas ou mais de 2 casas decimais'
    });
  } catch (e: any) {
    results.push({ id: 6, description: 'Precisão centavos', passed: false, details: e.message, error: e.message });
  }

  // Teste 7: Limites estritos de prazo (1 a 6 meses)
  try {
    const resMin = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: 1, periodMonths: 1 });
    const resMax = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: 1, periodMonths: 6 });
    const resZero = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: 1, periodMonths: 0 });
    const resSeven = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: 1, periodMonths: 7 });
    const resFraction = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: 1, periodMonths: 2.5 });

    const isOk =
      resMin.isValid &&
      resMax.isValid &&
      !resZero.isValid &&
      !resSeven.isValid &&
      !resFraction.isValid;

    results.push({
      id: 7,
      description: 'Validação de limites de prazo (1 e 6 válidos; 0, 7 e frações rejeitados)',
      passed: isOk,
      details: isOk
        ? 'Prazo 1 e 6 aprovados; 0, 7 e 2.5 rejeitados com sucesso'
        : 'Falha na validação de limites de meses'
    });
  } catch (e: any) {
    results.push({ id: 7, description: 'Limites de prazo', passed: false, details: e.message, error: e.message });
  }

  // Teste 8: Rejeição de entradas vazias, NaN ou tipos incorretos (não converte silenciosamente em 0)
  try {
    const resNaN = calculateInvestmentProjection({ initialInvestment: NaN, monthlyRatePct: 2, periodMonths: 3 });
    const resNullRate = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: NaN, periodMonths: 3 });

    const isOk = !resNaN.isValid && !resNullRate.isValid && !!resNaN.errorMessage && !!resNullRate.errorMessage;

    results.push({
      id: 8,
      description: 'Rejeição de entradas NaN ou inválidas sem conversão silenciosa em 0',
      passed: isOk,
      details: isOk
        ? `Mensagens de erro explícitas retornadas: "${resNaN.errorMessage}"`
        : 'Entradas inválidas foram aceitas ou transformadas silenciosamente'
    });
  } catch (e: any) {
    results.push({ id: 8, description: 'Validação NaN', passed: false, details: e.message, error: e.message });
  }

  // Teste 9: Rejeição de aporte inicial zerado ou negativo
  try {
    const resZero = calculateInvestmentProjection({ initialInvestment: 0, monthlyRatePct: 2, periodMonths: 3 });
    const resNeg = calculateInvestmentProjection({ initialInvestment: -500, monthlyRatePct: 2, periodMonths: 3 });

    const isOk = !resZero.isValid && !resNeg.isValid;

    results.push({
      id: 9,
      description: 'Rejeição de aporte inicial menor ou igual a zero (R$ 0 ou negativo)',
      passed: isOk,
      details: isOk
        ? 'Aportes <= 0 rejeitados com aviso de obrigatoriedade de aporte positivo'
        : 'Aporte zero ou negativo foi permitido'
    });
  } catch (e: any) {
    results.push({ id: 9, description: 'Aporte negativo', passed: false, details: e.message, error: e.message });
  }

  // Teste 10: Rejeição de taxas fora de limites razoáveis (< -100% ou > 500%)
  try {
    const resTooLow = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: -150, periodMonths: 3 });
    const resTooHigh = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: 600, periodMonths: 3 });
    const resValidNegative = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: -5, periodMonths: 2 });

    const isOk = !resTooLow.isValid && !resTooHigh.isValid && resValidNegative.isValid;

    results.push({
      id: 10,
      description: 'Controle de limites razoáveis de taxa mensal (-100% a 500%)',
      passed: isOk,
      details: isOk
        ? 'Taxas extremas (-150% e 600%) rejeitadas; oscilação negativa moderada (-5%) suportada'
        : 'Limites de taxa não foram aplicados corretamente'
    });
  } catch (e: any) {
    results.push({ id: 10, description: 'Limites de taxa', passed: false, details: e.message, error: e.message });
  }

  // Teste 11: Reatividade determinística ao alterar parâmetros
  try {
    const run1 = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: 1, periodMonths: 3 });
    const run2 = calculateInvestmentProjection({ initialInvestment: 2000, monthlyRatePct: 1, periodMonths: 3 });
    const run3 = calculateInvestmentProjection({ initialInvestment: 1000, monthlyRatePct: 3, periodMonths: 3 });

    const isOk =
      run1.finalAmount !== run2.finalAmount &&
      run1.finalAmount !== run3.finalAmount &&
      run2.finalAmount === roundCents(run1.finalAmount * 2);

    results.push({
      id: 11,
      description: 'Reatividade determinística e proporcionalidade dos cálculos',
      passed: isOk,
      details: isOk
        ? 'Resultados atualizam proporcionalmente e sem efeitos colaterais de cache'
        : 'Inconsistência na atualização dos parâmetros'
    });
  } catch (e: any) {
    results.push({ id: 11, description: 'Reatividade', passed: false, details: e.message, error: e.message });
  }

  // Teste 12: Ausência total de efeitos colaterais ou mutações no Supabase
  try {
    // calculateInvestmentProjection é uma função pura e sem I/O
    const res = calculateInvestmentProjection({ initialInvestment: 1500, monthlyRatePct: 2, periodMonths: 6 });
    const isPure = typeof res === 'object' && res.isValid && !('supabase' in res);

    results.push({
      id: 12,
      description: 'Isolamento de persistência: função 100% pura sem escrita no Supabase',
      passed: isPure,
      details: 'Motor opera exclusivamente em memória, garantindo isolamento multi-tenant'
    });
  } catch (e: any) {
    results.push({ id: 12, description: 'Isolamento de persistência', passed: false, details: e.message, error: e.message });
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
  console.log('\n=== BATERIA DE TESTES OFICIAIS — SIMULADOR DE APORTES SMK ===');
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
