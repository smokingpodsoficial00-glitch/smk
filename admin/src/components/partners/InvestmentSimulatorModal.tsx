import React, { useState } from 'react';
import {
  X, Calculator, TrendingUp, DollarSign, AlertCircle, Info, Sparkles,
  ArrowUpRight, ShieldAlert, BarChart3, Receipt, Scale, Layers
} from 'lucide-react';
import { formatBRL } from '@/lib/cart';
import {
  calculateBusinessInvestmentProjection,
  type MonthlyBusinessProjectionRow
} from '@/lib/investmentSimulator';
import type { CompanyFinancialOverview } from '@/lib/partners';
import type { CycleFinancialMetrics } from '@/lib/financialCycles';

interface InvestmentSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  financialOverview?: CompanyFinancialOverview;
  historicalCycles?: CycleFinancialMetrics[];
}

export function InvestmentSimulatorModal({
  isOpen,
  onClose,
  financialOverview,
  historicalCycles = []
}: InvestmentSimulatorModalProps) {
  const [aporteInput, setAporteInput] = useState<string>('1000');
  const [periodMonths, setPeriodMonths] = useState<number>(6);
  const [viewMode, setViewMode] = useState<'BASE' | 'CONSERVATIVE'>('BASE');

  if (!isOpen) return null;

  const parsedAporte = parseFloat(aporteInput.replace(',', '.'));

  const projection = calculateBusinessInvestmentProjection({
    aporteAmount: parsedAporte,
    periodMonths,
    financialOverview,
    historicalCycles
  });

  const { indicators } = projection;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#0e0e10] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141416]">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Calculator className="size-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Simulador de Aportes & Previsão Financeira Real
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                  Até 6 Meses · Base DRE Oficial
                </span>
              </h2>
              <p className="text-[11px] text-white/50">
                Previsão de retorno operacional derivada do Ticket Médio, Margem Líquida Real e Giro do Negócio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
            title="Fechar Simulador"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Parâmetros de Entrada e Seletor de Prazo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#141416] p-4 rounded-2xl border border-white/10">
            {/* 1. Valor do Aporte */}
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                Valor do Aporte a Simular (R$)
              </label>
              <div className="relative">
                <DollarSign className="size-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={aporteInput}
                  onChange={(e) => setAporteInput(e.target.value)}
                  placeholder="Ex: 1000,00"
                  className="w-full bg-[#1c1c1f] border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
            </div>

            {/* 2. Seletor de Prazo (1 a 6 meses) */}
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                Prazo da Previsão
              </label>
              <div className="grid grid-cols-6 gap-1 bg-[#1c1c1f] p-1 rounded-xl border border-white/10">
                {[1, 2, 3, 4, 5, 6].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPeriodMonths(m)}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      periodMonths === m
                        ? 'bg-emerald-500 text-black shadow-sm'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Seletor de Cenário */}
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                Cenário Projetado
              </label>
              <div className="grid grid-cols-2 gap-1 bg-[#1c1c1f] p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setViewMode('BASE')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    viewMode === 'BASE'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Histórico Real ({indicators.monthlyReturnRatePct.toFixed(1)}% a.m.)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('CONSERVATIVE')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    viewMode === 'CONSERVATIVE'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Conservador ({indicators.conservativeMonthlyReturnRatePct.toFixed(1)}% a.m.)
                </button>
              </div>
            </div>
          </div>

          {/* Painel de Indicadores Oficiais do Financeiro Real Utilizados */}
          <div className="p-4 bg-[#141416] border border-white/10 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                <Receipt className="size-3.5 text-emerald-400" />
                Indicadores Financeiros Oficiais do Negócio ({indicators.referencePeriodLabel})
              </span>
              <span className="text-[10px] text-white/40">Fórmulas sincronizadas com a DRE oficial</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] text-white/50 uppercase font-semibold">Ticket Médio Real</span>
                <p className="text-sm font-bold text-white font-mono">
                  {formatBRL(indicators.averageTicket)}
                </p>
                <span className="text-[9px] text-white/40 block">Receita / {indicators.totalValidOrders} pedidos</span>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] text-white/50 uppercase font-semibold">Margem Líquida Real</span>
                <p className="text-sm font-bold text-emerald-400 font-mono">
                  {indicators.realNetMarginPct.toFixed(2)}%
                </p>
                <span className="text-[9px] text-white/40 block">Após CMV, frete e custos</span>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] text-white/50 uppercase font-semibold">Capital Investido Base</span>
                <p className="text-sm font-bold text-white font-mono">
                  {formatBRL(indicators.totalNetCapitalInvested)}
                </p>
                <span className="text-[9px] text-white/40 block">Aportes líquidos de sócios</span>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] text-white/50 uppercase font-semibold">Giro Mensal de Capital</span>
                <p className="text-sm font-bold text-purple-300 font-mono">
                  {indicators.monthlyCapitalTurnover.toFixed(2)}x ao mês
                </p>
                <span className="text-[9px] text-white/40 block">Capacidade de conversão</span>
              </div>
            </div>
          </div>

          {/* Feedback caso dados sejam insuficientes */}
          {!projection.isValid && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-xs text-rose-300">
              <ShieldAlert className="size-5 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-200">Não foi possível calcular uma projeção financeira válida:</p>
                <p>{projection.errorMessage}</p>
                <p className="text-[11px] text-white/50">
                  O simulador não inventa taxas nem projeta lucros sem sustentação em vendas, pedidos válidos e margens reais apuradas.
                </p>
              </div>
            </div>
          )}

          {/* Resumo de Projeção */}
          {projection.isValid && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="bg-[#141416] border border-white/10 p-3.5 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Aporte Inicial</span>
                <div className="text-base sm:text-lg font-extrabold text-white font-mono">
                  {formatBRL(projection.aporteAmount)}
                </div>
                <span className="text-[9px] text-white/40 block">Capital aportado</span>
              </div>

              <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Faturamento Estimado</span>
                <div className="text-base sm:text-lg font-extrabold text-white/80 font-mono">
                  {formatBRL(projection.totalEstimatedRevenue)}
                </div>
                <span className="text-[9px] text-white/40 block">Vendas movimentadas</span>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 p-3.5 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-purple-300 uppercase font-bold tracking-wider">
                  Lucro Operacional Estimado
                </span>
                <div className="text-base sm:text-lg font-extrabold text-purple-200 font-mono">
                  +{formatBRL(viewMode === 'BASE' ? projection.totalProjectedYield : projection.totalConservativeYield)}
                </div>
                <span className="text-[9px] text-purple-300/70 block font-mono">
                  Crescimento: +{viewMode === 'BASE' ? projection.effectiveGrowthPct.toFixed(2) : projection.conservativeGrowthPct.toFixed(2)}%
                </span>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                  Saldo Final Estimado ({projection.periodMonths}º mês)
                </span>
                <div className="text-base sm:text-lg font-extrabold text-emerald-300 font-mono">
                  {formatBRL(viewMode === 'BASE' ? projection.finalProjectedAmount : projection.finalConservativeAmount)}
                </div>
                <span className="text-[9px] text-emerald-400/80 block">Capital + Lucro atribuível</span>
              </div>
            </div>
          )}

          {/* Tabela de Evolução Mês a Mês */}
          {projection.isValid && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="size-3.5 text-emerald-400" />
                  <span>
                    Projeção Mês a Mês ({viewMode === 'BASE' ? 'Cenário Histórico' : 'Cenário Conservador'})
                  </span>
                </h3>
                <span className="text-[10px] text-white/40 font-mono">
                  Taxa adotada: {viewMode === 'BASE' ? indicators.monthlyReturnRatePct.toFixed(2) : indicators.conservativeMonthlyReturnRatePct.toFixed(2)}% a.m.
                </span>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden bg-[#141416]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-[10px] uppercase font-bold bg-[#18181b]">
                      <th className="py-2.5 px-3">Mês</th>
                      <th className="py-2.5 px-3 text-right">Saldo Inicial</th>
                      <th className="py-2.5 px-3 text-right">Faturamento Gerado</th>
                      <th className="py-2.5 px-3 text-right">Lucro do Mês</th>
                      <th className="py-2.5 px-3 text-right">Lucro Acumulado</th>
                      <th className="py-2.5 px-3 text-right">Saldo Final Projetado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {projection.monthlyProjections.map((row) => {
                      const displayedFinal = viewMode === 'BASE' ? row.finalBalance : row.conservativeFinalBalance;
                      const displayedAccumulated = displayedFinal - projection.aporteAmount;
                      const displayedMonthYield = viewMode === 'BASE' ? row.monthYield : (displayedFinal - (row.month === 1 ? projection.aporteAmount : projection.monthlyProjections[row.month - 2].conservativeFinalBalance));

                      return (
                        <tr
                          key={row.month}
                          className={`transition-all ${
                            row.month === projection.periodMonths ? 'bg-emerald-500/5 font-semibold' : 'hover:bg-white/5'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-white flex items-center gap-2">
                            <span className="size-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                              {row.month}º
                            </span>
                            <span>Mês {row.month}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-white/70">
                            {formatBRL(row.initialBalance)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-white/50">
                            {formatBRL(row.estimatedRevenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-purple-300">
                            +{formatBRL(displayedMonthYield)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                            +{formatBRL(displayedAccumulated)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-white font-bold">
                            {formatBRL(displayedFinal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Gráfico Visual de Barras Proporcionais */}
          {projection.isValid && projection.monthlyProjections.length > 0 && (
            <div className="p-4 bg-[#141416] border border-white/10 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-white/70 font-semibold">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="size-3.5 text-emerald-400" />
                  Curva de Evolução do Saldo do Aporte (R$)
                </span>
                <span className="text-[10px] text-white/40">
                  Base Final: {formatBRL(viewMode === 'BASE' ? projection.finalProjectedAmount : projection.finalConservativeAmount)}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2 items-end h-24 pt-2 border-b border-white/10 pb-1">
                {projection.monthlyProjections.map((row) => {
                  const val = viewMode === 'BASE' ? row.finalBalance : row.conservativeFinalBalance;
                  const maxAmt = (viewMode === 'BASE' ? projection.finalProjectedAmount : projection.finalConservativeAmount) || 1;
                  const pct = Math.max(10, Math.min(100, (val / maxAmt) * 100));
                  return (
                    <div key={row.month} className="flex flex-col items-center justify-end h-full gap-1 group">
                      <span className="text-[8px] font-mono text-white/50 opacity-0 group-hover:opacity-100 transition-all truncate">
                        {formatBRL(val)}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/20 to-emerald-400 border border-emerald-500/30 transition-all group-hover:brightness-125"
                        style={{ height: `${pct}%` }}
                      />
                      <span className="text-[9px] font-bold text-white/60">M{row.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Disclaimer Financeiro Rigoroso */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200/90 space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <Info className="size-3.5 text-amber-400 shrink-0" />
              <span>Aviso de Transparência & Metodologia Operacional</span>
            </div>
            <p className="leading-relaxed text-white/70">
              Esta simulação calcula o faturamento e o lucro atribuível com base estritamente no <strong>Ticket Médio real</strong>, na <strong>Margem Líquida Real pós-CMV e despesas</strong> e no <strong>Giro de Capital histórico</strong>. Os valores representam estimativas matemáticas e <strong>não configuram garantia ou promessa de retorno</strong>. Nenhuma movimentação é gravada no banco de dados.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#141416]">
          <span className="text-[11px] text-white/40">
            Fórmula: Faturamento = Capital × Giro | Lucro = Faturamento × Margem Líquida Real
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
          >
            Fechar Simulador
          </button>
        </div>
      </div>
    </div>
  );
}
