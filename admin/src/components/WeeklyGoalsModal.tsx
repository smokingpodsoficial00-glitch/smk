import React, { useState, useEffect } from "react";
import {
  X,
  Target,
  Sliders,
  DollarSign,
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  type WeeklyGoalsConfig,
  saveWeeklyGoals,
  DEFAULT_WEEKLY_GOALS,
} from "@/lib/weeklyGoals";
import type { CycleDefinition } from "@/lib/financialCycles";

interface WeeklyGoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoals: WeeklyGoalsConfig;
  cycle: CycleDefinition;
  companyId?: string;
  onGoalsSaved: (newGoals: WeeklyGoalsConfig) => void;
}

export const WeeklyGoalsModal: React.FC<WeeklyGoalsModalProps> = ({
  isOpen,
  onClose,
  currentGoals,
  cycle,
  companyId,
  onGoalsSaved,
}) => {
  const [mode, setMode] = useState<"monthly" | "weekly">("monthly");
  const [monthlyTotal, setMonthlyTotal] = useState<string>(
    String(currentGoals.monthlyTarget || DEFAULT_WEEKLY_GOALS.monthlyTarget)
  );

  const [w1, setW1] = useState<string>(String(currentGoals.week1 || 2000));
  const [w2, setW2] = useState<string>(String(currentGoals.week2 || 2000));
  const [w3, setW3] = useState<string>(String(currentGoals.week3 || 2000));
  const [w4, setW4] = useState<string>(String(currentGoals.week4 || 2000));

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMonthlyTotal(String(currentGoals.monthlyTarget || DEFAULT_WEEKLY_GOALS.monthlyTarget));
      setW1(String(currentGoals.week1 || 2000));
      setW2(String(currentGoals.week2 || 2000));
      setW3(String(currentGoals.week3 || 2000));
      setW4(String(currentGoals.week4 || 2000));
      setSavedSuccess(false);
    }
  }, [isOpen, currentGoals]);

  // Ao alterar a meta mensal rápida, redistribui proporcionalmente em 4 cotas iguais
  const handleMonthlyChange = (val: string) => {
    setMonthlyTotal(val);
    const parsed = parseFloat(val.replace(",", ".")) || 0;
    const quarter = Number((parsed / 4).toFixed(2));
    setW1(String(quarter));
    setW2(String(quarter));
    setW3(String(quarter));
    setW4(String(quarter));
  };

  const handleSave = () => {
    const numW1 = parseFloat(w1.replace(",", ".")) || 0;
    const numW2 = parseFloat(w2.replace(",", ".")) || 0;
    const numW3 = parseFloat(w3.replace(",", ".")) || 0;
    const numW4 = parseFloat(w4.replace(",", ".")) || 0;
    const calculatedMonthly = mode === "monthly"
      ? (parseFloat(monthlyTotal.replace(",", ".")) || (numW1 + numW2 + numW3 + numW4))
      : (numW1 + numW2 + numW3 + numW4);

    const updated: WeeklyGoalsConfig = {
      monthlyTarget: Number(calculatedMonthly.toFixed(2)),
      week1: numW1,
      week2: numW2,
      week3: numW3,
      week4: numW4,
    };

    saveWeeklyGoals(updated, companyId, cycle.id);
    onGoalsSaved(updated);
    setSavedSuccess(true);

    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  const formatBRL = (val: number) => {
    return `R$ ${val.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#111113] border border-white/15 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl my-auto text-white">
        {/* Topo do Modal */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Target className="size-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <span>Ajustar Metas Semanais</span>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Ciclo {cycle.startDateStr.slice(0, 5)} → {cycle.endDateStr.slice(0, 5)}
                </span>
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                Configure os objetivos de faturamento para cada semana do ciclo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Alternador de Modo: Meta Mensal Rápida vs Ajuste Fino por Semana */}
        <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setMode("monthly")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === "monthly"
                ? "bg-white text-black font-extrabold shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>Meta Mensal Rápida (Divide por 4)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("weekly")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === "weekly"
                ? "bg-white text-black font-extrabold shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Sliders className="size-3.5" />
            <span>Ajuste Fino por Semana</span>
          </button>
        </div>

        {/* Modo 1: Meta Mensal Global */}
        {mode === "monthly" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <label className="block text-xs font-bold text-white/80 uppercase tracking-wider">
              Meta Total do Mês / Ciclo (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-400 font-mono">
                R$
              </span>
              <input
                type="number"
                step="50"
                value={monthlyTotal}
                onChange={(e) => handleMonthlyChange(e.target.value)}
                placeholder="Ex: 8000"
                className="w-full bg-black/60 border border-emerald-500/40 rounded-xl pl-11 pr-4 py-2.5 text-base font-extrabold text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <p className="text-[11px] text-white/50">
              O sistema calcula automaticamente uma cota igual de{" "}
              <strong className="text-emerald-300 font-bold">
                {formatBRL((parseFloat(monthlyTotal.replace(",", ".")) || 0) / 4)}
              </strong>{" "}
              para cada uma das 4 semanas.
            </p>
          </div>
        )}

        {/* Modo 2: Ajuste Fino Semana a Semana */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
            {mode === "monthly" ? "Distribuição Semanal Calculada" : "Definir Meta de Cada Semana"}
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Semana 1 */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1.5 focus-within:border-emerald-500/50">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="size-3 text-emerald-400" />
                Semana 1 (14 → 20)
              </span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">
                  R$
                </span>
                <input
                  type="number"
                  step="50"
                  disabled={mode === "monthly"}
                  value={w1}
                  onChange={(e) => setW1(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-sm font-extrabold text-white focus:outline-none focus:border-emerald-400 disabled:opacity-80"
                />
              </div>
            </div>

            {/* Semana 2 */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1.5 focus-within:border-emerald-500/50">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="size-3 text-emerald-400" />
                Semana 2 (21 → 27)
              </span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">
                  R$
                </span>
                <input
                  type="number"
                  step="50"
                  disabled={mode === "monthly"}
                  value={w2}
                  onChange={(e) => setW2(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-sm font-extrabold text-white focus:outline-none focus:border-emerald-400 disabled:opacity-80"
                />
              </div>
            </div>

            {/* Semana 3 */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1.5 focus-within:border-emerald-500/50">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="size-3 text-emerald-400" />
                Semana 3 (28 → 04)
              </span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">
                  R$
                </span>
                <input
                  type="number"
                  step="50"
                  disabled={mode === "monthly"}
                  value={w3}
                  onChange={(e) => setW3(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-sm font-extrabold text-white focus:outline-none focus:border-emerald-400 disabled:opacity-80"
                />
              </div>
            </div>

            {/* Semana 4 */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1.5 focus-within:border-emerald-500/50">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="size-3 text-emerald-400" />
                Semana 4 (05 → 13)
              </span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">
                  R$
                </span>
                <input
                  type="number"
                  step="50"
                  disabled={mode === "monthly"}
                  value={w4}
                  onChange={(e) => setW4(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-sm font-extrabold text-white focus:outline-none focus:border-emerald-400 disabled:opacity-80"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé e Botões */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={savedSuccess}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 cursor-pointer disabled:opacity-80"
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="size-4" />
                <span>Metas Salvas!</span>
              </>
            ) : (
              <>
                <span>Salvar Novas Metas</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
