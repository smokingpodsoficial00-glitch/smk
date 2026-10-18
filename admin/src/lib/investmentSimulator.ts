/**
 * investmentSimulator.ts
 *
 * Motor puro de cálculo para o Simulador de Aportes do SMK System.
 * Projeta a evolução de um aporte inicial ao longo de 1 a 6 meses via juros compostos.
 *
 * Saldo final do mês = saldo inicial do mês × (1 + taxa mensal).
 *
 * Tratamento rigoroso de precisão em centavos (arredondamento bancário).
 * NÃO inventa taxas fixas nem garante retorno futuro.
 */

export interface MonthlyProjectionRow {
  month: number;
  initialBalance: number;
  monthYield: number;
  accumulatedYield: number;
  finalBalance: number;
}

export interface InvestmentSimulationResult {
  initialInvestment: number;
  monthlyRatePct: number;
  periodMonths: number;
  totalYield: number;
  finalAmount: number;
  effectiveTotalGrowthPct: number;
  projections: MonthlyProjectionRow[];
  isValid: boolean;
  errorMessage?: string;
}

export interface InvestmentSimulationParams {
  initialInvestment: number;
  monthlyRatePct: number;
  periodMonths: number;
}

/**
 * Arredonda um valor numérico para centavos exatos (2 casas decimais).
 */
export function roundCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Executa a simulação financeira mês a mês (1 a 6 meses).
 * Retorna erro descritivo em caso de parâmetros inválidos ou limites excedidos.
 */
export function calculateInvestmentProjection(
  params: InvestmentSimulationParams
): InvestmentSimulationResult {
  const { initialInvestment, monthlyRatePct, periodMonths } = params;

  // Validação 1: Valor inicial deve ser numérico, finito e estritamente positivo
  if (
    typeof initialInvestment !== 'number' ||
    !Number.isFinite(initialInvestment) ||
    Number.isNaN(initialInvestment)
  ) {
    return {
      initialInvestment: 0,
      monthlyRatePct: 0,
      periodMonths: 0,
      totalYield: 0,
      finalAmount: 0,
      effectiveTotalGrowthPct: 0,
      projections: [],
      isValid: false,
      errorMessage: 'O valor do aporte deve ser um número válido.'
    };
  }

  if (initialInvestment <= 0) {
    return {
      initialInvestment,
      monthlyRatePct: monthlyRatePct ?? 0,
      periodMonths: periodMonths ?? 0,
      totalYield: 0,
      finalAmount: 0,
      effectiveTotalGrowthPct: 0,
      projections: [],
      isValid: false,
      errorMessage: 'O valor do aporte inicial deve ser maior que zero (R$ 0,00).'
    };
  }

  // Validação 2: Taxa mensal deve ser numérica, finita e estar em intervalo razoável (-100% a 500%)
  if (
    typeof monthlyRatePct !== 'number' ||
    !Number.isFinite(monthlyRatePct) ||
    Number.isNaN(monthlyRatePct)
  ) {
    return {
      initialInvestment,
      monthlyRatePct: 0,
      periodMonths: periodMonths ?? 0,
      totalYield: 0,
      finalAmount: 0,
      effectiveTotalGrowthPct: 0,
      projections: [],
      isValid: false,
      errorMessage: 'A taxa mensal estimada deve ser informada como um número válido.'
    };
  }

  if (monthlyRatePct < -100 || monthlyRatePct > 500) {
    return {
      initialInvestment,
      monthlyRatePct,
      periodMonths: periodMonths ?? 0,
      totalYield: 0,
      finalAmount: 0,
      effectiveTotalGrowthPct: 0,
      projections: [],
      isValid: false,
      errorMessage: 'A taxa mensal deve estar entre -100% e +500% ao mês.'
    };
  }

  // Validação 3: Prazo inteiro entre 1 e 6 meses
  if (
    typeof periodMonths !== 'number' ||
    !Number.isInteger(periodMonths) ||
    periodMonths < 1 ||
    periodMonths > 6
  ) {
    return {
      initialInvestment,
      monthlyRatePct,
      periodMonths,
      totalYield: 0,
      finalAmount: 0,
      effectiveTotalGrowthPct: 0,
      projections: [],
      isValid: false,
      errorMessage: 'O prazo da simulação deve ser um número inteiro entre 1 e 6 meses.'
    };
  }

  const rateDecimal = monthlyRatePct / 100;
  const projections: MonthlyProjectionRow[] = [];

  let currentBalance = roundCents(initialInvestment);
  const roundedInitial = currentBalance;

  for (let m = 1; m <= periodMonths; m++) {
    const monthStart = currentBalance;
    // Saldo final do mês = saldo inicial × (1 + taxa mensal)
    // Rendimento do mês = Saldo final - Saldo inicial
    const monthEnd = roundCents(monthStart * (1 + rateDecimal));
    const monthYield = roundCents(monthEnd - monthStart);
    const accumulatedYield = roundCents(monthEnd - roundedInitial);

    projections.push({
      month: m,
      initialBalance: monthStart,
      monthYield,
      accumulatedYield,
      finalBalance: monthEnd
    });

    currentBalance = monthEnd;
  }

  const finalAmount = currentBalance;
  const totalYield = roundCents(finalAmount - roundedInitial);
  const effectiveTotalGrowthPct = roundedInitial > 0
    ? roundCents((totalYield / roundedInitial) * 100)
    : 0;

  return {
    initialInvestment: roundedInitial,
    monthlyRatePct,
    periodMonths,
    totalYield,
    finalAmount,
    effectiveTotalGrowthPct,
    projections,
    isValid: true
  };
}
