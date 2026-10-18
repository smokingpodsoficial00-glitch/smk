import React, { useState, useMemo } from 'react';
import { X, Calculator, TrendingUp, DollarSign, Calendar, AlertCircle, Info, Sparkles, ArrowUpRight } from 'lucide-react';
import { formatBRL } from '@/lib/cart';
import {
  calculateInvestmentProjection,
  type MonthlyProjectionRow
} from '@/lib/investmentSimulator';

interface InvestmentSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InvestmentSimulatorModal({
  isOpen,
  onClose
}: InvestmentSimulatorModalProps) {
  // Estados de entrada
  const [initialAmountInput, setInitialAmountInput] = useState<string>('1000');
  const [monthlyRateInput, setMonthlyRateInput] = useState<string>('2.0');
  const [periodMonths, setPeriodMonths] = useState<number>(6);

  if (!isOpen) return null;

  // Sanitização de entradas
  const parsedAmount = parseFloat(initialAmountInput.replace(',', '.'));
  const parsedRate = parseFloat(monthlyRateInput.replace(',', '.'));

  // Execução do cálculo puro
  const simulation = calculateInvestmentProjection({
    initialInvestment: parsedAmount,
    monthlyRatePct: parsedRate,
    periodMonths
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0e0e10] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141416]">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Calculator className="size-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Simulador de Aportes & Prévia de Investimento
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                  Até 6 Meses
                </span>
              </h2>
              <p className="text-[11px] text-white/50">
                Projeção matemática estimada de evolução patrimonial com base em juros compostos
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
          {/* Card de Configuração e Entradas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#141416] p-4 rounded-2xl border border-white/10">
            {/* 1. Valor Inicial */}
            <div>
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                Valor do Aporte Inicial (R$)
              </label>
              <div className="relative">
                <DollarSign className="size-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={initialAmountInput}
                  onChange={(e) => setInitialAmountInput(e.target.value)}
                  placeholder="Ex: 1000,00"
                  className="w-full bg-[#1c1c1f] border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
            </div>

            {/* 2. Taxa Mensal Estimada */}
            <div>
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                Taxa Estimada (% ao mês)
              </label>
              <div className="relative">
                <TrendingUp className="size-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={monthlyRateInput}
                  onChange={(e) => setMonthlyRateInput(e.target.value)}
                  placeholder="Ex: 2.0"
                  className="w-full bg-[#1c1c1f] border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-all"
                />
              </div>
            </div>

            {/* 3. Seletor de Prazo (1 a 6 meses) */}
            <div>
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                Prazo da Simulação
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
          </div>

          {/* Feedback de Validação se houver erro */}
          {!simulation.isValid && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="size-4 shrink-0 text-rose-400" />
              <span>{simulation.errorMessage || 'Parâmetros informados são inválidos.'}</span>
            </div>
          )}

          {/* Resumo Consolidado da Simulação */}
          {simulation.isValid && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#141416] border border-white/10 p-3.5 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Capital Inicial</span>
                <div className="text-base sm:text-lg font-extrabold text-white font-mono">
                  {formatBRL(simulation.initialInvestment)}
                </div>
                <span className="text-[9px] text-white/40 block">Aporte aportado</span>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 p-3.5 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-purple-300 uppercase font-bold tracking-wider">Rendimento Total Estimado</span>
                <div className="text-base sm:text-lg font-extrabold text-purple-200 font-mono">
                  +{formatBRL(simulation.totalYield)}
                </div>
                <span className="text-[9px] text-purple-300/70 block font-mono">
                  Crescimento de +{simulation.effectiveTotalGrowthPct.toFixed(2)}%
                </span>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Saldo Final Projetado ({simulation.periodMonths}º mês)</span>
                <div className="text-base sm:text-lg font-extrabold text-emerald-300 font-mono">
                  {formatBRL(simulation.finalAmount)}
                </div>
                <span className="text-[9px] text-emerald-400/80 block">Capital + Rendimentos</span>
              </div>
            </div>
          )}

          {/* Tabela de Evolução Mensal (Mês a Mês) */}
          {simulation.isValid && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="size-3.5 text-emerald-400" />
                  <span>Evolução Mensal Estimada (Juros Compostos)</span>
                </h3>
                <span className="text-[10px] text-white/40 font-mono">
                  Taxa: {simulation.monthlyRatePct.toFixed(2)}% a.m.
                </span>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden bg-[#141416]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-[10px] uppercase font-bold bg-[#18181b]">
                      <th className="py-2.5 px-3">Mês</th>
                      <th className="py-2.5 px-3 text-right">Saldo Inicial</th>
                      <th className="py-2.5 px-3 text-right">Rendimento do Mês</th>
                      <th className="py-2.5 px-3 text-right">Rendimento Acumulado</th>
                      <th className="py-2.5 px-3 text-right">Saldo Final Projetado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {simulation.projections.map((row) => (
                      <tr
                        key={row.month}
                        className={`transition-all ${
                          row.month === simulation.periodMonths ? 'bg-emerald-500/5 font-semibold' : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-white flex items-center gap-2">
                          <span className="size-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                            {row.month}º
                          </span>
                          <span>Mês {row.month}</span>
                          {row.month === simulation.periodMonths && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded border border-emerald-500/30">
                              Final
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-white/70">
                          {formatBRL(row.initialBalance)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-purple-300">
                          +{formatBRL(row.monthYield)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                          +{formatBRL(row.accumulatedYield)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-white font-bold">
                          {formatBRL(row.finalBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Gráfico Visual de Barras Proporcionais */}
          {simulation.isValid && simulation.projections.length > 0 && (
            <div className="p-4 bg-[#141416] border border-white/10 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-white/70 font-semibold">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="size-3.5 text-emerald-400" />
                  Curva de Crescimento do Capital
                </span>
                <span className="text-[10px] text-white/40">Base 100% = {formatBRL(simulation.finalAmount)}</span>
              </div>
              <div className="grid grid-cols-6 gap-2 items-end h-24 pt-2 border-b border-white/10 pb-1">
                {simulation.projections.map((row) => {
                  const maxAmt = simulation.finalAmount || 1;
                  const pct = Math.max(10, Math.min(100, (row.finalBalance / maxAmt) * 100));
                  return (
                    <div key={row.month} className="flex flex-col items-center justify-end h-full gap-1 group">
                      <span className="text-[8px] font-mono text-white/50 opacity-0 group-hover:opacity-100 transition-all truncate">
                        {formatBRL(row.finalBalance)}
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
              <span>Aviso de Transparência & Estimativa Matemática</span>
            </div>
            <p className="leading-relaxed text-white/70">
              Esta simulação é puramente ilustrativa e calculada através de juros compostos com base na taxa mensal informada pelo usuário. Os valores projetados constituem uma estimativa matemática e <strong>não representam garantia, promessa de rentabilidade futura ou obrigação contratual</strong>. Nenhuma transação é gravada no banco de dados.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#141416]">
          <span className="text-[11px] text-white/40">
            Fórmula: Saldo final = Saldo inicial × (1 + taxa mensal)
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
