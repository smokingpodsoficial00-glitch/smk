import React, { useState, useEffect } from "react";
import { X, Percent, RefreshCw, CheckCircle2, AlertTriangle, Sparkles, Users, TrendingUp } from "lucide-react";
import { type Partner } from "@/lib/partners";
import { type PayrollConfig, filterRealHumanPartners } from "@/lib/partnerPayroll";

interface PayrollConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  partners: Partner[];
  currentConfig: PayrollConfig;
  cycleNetProfit: number;
  allTimeNetProfit: number;
  onSave: (newConfig: PayrollConfig) => Promise<void>;
}

const formatBRL = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

export const PayrollConfigModal: React.FC<PayrollConfigModalProps> = ({
  isOpen,
  onClose,
  partners,
  currentConfig,
  cycleNetProfit,
  allTimeNetProfit,
  onSave,
}) => {
  const humanPartners = filterRealHumanPartners(partners);

  const [reinvestmentPct, setReinvestmentPct] = useState<number>(50);
  const [partnerPcts, setPartnerPcts] = useState<Record<string, number>>({});
  const [periodMode, setPeriodMode] = useState<"CYCLE" | "ALL_TIME">("CYCLE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentConfig) {
      setReinvestmentPct(currentConfig.reinvestmentPct ?? 50);
      setPeriodMode(currentConfig.periodMode || "CYCLE");
      const initialMap: Record<string, number> = {};
      const remaining = Math.max(0, 100 - (currentConfig.reinvestmentPct ?? 50));
      const equalShare = humanPartners.length > 0 ? Number((remaining / humanPartners.length).toFixed(2)) : 0;

      humanPartners.forEach((p, idx) => {
        if (currentConfig.partnerPcts && typeof currentConfig.partnerPcts[p.id] === "number") {
          initialMap[p.id] = currentConfig.partnerPcts[p.id];
        } else {
          if (idx === humanPartners.length - 1) {
            const prevSum = Object.values(initialMap).reduce((a, b) => a + b, 0);
            initialMap[p.id] = Number(Math.max(0, remaining - prevSum).toFixed(2));
          } else {
            initialMap[p.id] = equalShare;
          }
        }
      });
      setPartnerPcts(initialMap);
      setError(null);
    }
  }, [isOpen, currentConfig, partners]);

  if (!isOpen) return null;

  const totalPartnersPct = humanPartners.reduce(
    (sum, p) => sum + (Number(partnerPcts[p.id]) || 0),
    0
  );
  const totalSumPct = Number((reinvestmentPct + totalPartnersPct).toFixed(2));
  const isBalanced = Math.abs(totalSumPct - 100) <= 0.1;

  const activeBaseProfit = Math.max(0, periodMode === "CYCLE" ? cycleNetProfit : allTimeNetProfit);

  const handleEqualSplitRemaining = (targetReinvestPct: number = reinvestmentPct) => {
    const cleanReinvest = Math.max(0, Math.min(100, Number(targetReinvestPct) || 0));
    setReinvestmentPct(cleanReinvest);
    const remaining = Math.max(0, 100 - cleanReinvest);
    const nextMap: Record<string, number> = {};

    if (humanPartners.length > 0) {
      const share = Number((remaining / humanPartners.length).toFixed(2));
      humanPartners.forEach((p, idx) => {
        if (idx === humanPartners.length - 1) {
          const prevSum = Object.values(nextMap).reduce((a, b) => a + b, 0);
          nextMap[p.id] = Number(Math.max(0, remaining - prevSum).toFixed(2));
        } else {
          nextMap[p.id] = share;
        }
      });
    }
    setPartnerPcts(nextMap);
    setError(null);
  };

  const handlePartnerPctChange = (partnerId: string, val: string) => {
    const num = Math.max(0, Math.min(100, parseFloat(val) || 0));
    setPartnerPcts((prev) => ({
      ...prev,
      [partnerId]: num,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      setError(`A soma total precisa fechar exatamente 100% (atual: ${totalSumPct.toFixed(1)}%).`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        reinvestmentPct: Number(reinvestmentPct.toFixed(2)),
        partnerPcts,
        periodMode,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar configuração de salários.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#111318] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#161922]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Percent size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Configurar Salários & Reinvestimento
              </h3>
              <p className="text-xs text-slate-400">
                Defina a fatia de reinvestimento da loja e o salário (%) de cada sócio sobre o lucro
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Base de Cálculo do Lucro */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Base de Cálculo dos Salários
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPeriodMode("CYCLE")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  periodMode === "CYCLE"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                    : "bg-[#161922] border-white/5 text-slate-400 hover:border-white/15"
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>Ciclo Mensal Atual (14→13)</span>
                  {periodMode === "CYCLE" && <CheckCircle2 size={14} className="text-emerald-400" />}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Lucro do Ciclo: <strong className="text-emerald-400">{formatBRL(cycleNetProfit)}</strong>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPeriodMode("ALL_TIME")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  periodMode === "ALL_TIME"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                    : "bg-[#161922] border-white/5 text-slate-400 hover:border-white/15"
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>Acumulado Geral Histórico</span>
                  {periodMode === "ALL_TIME" && <CheckCircle2 size={14} className="text-emerald-400" />}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Lucro Total: <strong className="text-emerald-400">{formatBRL(allTimeNetProfit)}</strong>
                </div>
              </button>
            </div>
          </div>

          {/* Atalhos Rápidos de Divisão */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400" />
                Atalhos Rápidos de Divisão
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { reinvest: 50, label: "50% / 50%", desc: "Início Forte" },
                { reinvest: 40, label: "40% / 60%", desc: "Crescimento" },
                { reinvest: 30, label: "30% / 70%", desc: "Maturidade" },
                { reinvest: 60, label: "60% / 40%", desc: "Aceleração" },
              ].map((preset) => (
                <button
                  key={preset.reinvest}
                  type="button"
                  onClick={() => handleEqualSplitRemaining(preset.reinvest)}
                  className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                    Math.abs(reinvestmentPct - preset.reinvest) < 0.1
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                      : "bg-[#161922] border-white/5 text-slate-400 hover:text-white hover:border-white/15"
                  }`}
                >
                  <div className="text-xs font-bold">{preset.label}</div>
                  <div className="text-[10px] opacity-75">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 1. Fatia de Reinvestimento da Loja */}
          <div className="p-4 rounded-xl bg-[#161922] border border-cyan-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Reinvestimento no Caixa / Estoque da Loja
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Fatia retida na empresa para o crescimento não parar
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-cyan-400">
                  {formatBRL(activeBaseProfit * (reinvestmentPct / 100))}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={reinvestmentPct}
                onChange={(e) => handleEqualSplitRemaining(parseFloat(e.target.value) || 0)}
                className="flex-1 accent-cyan-400 cursor-pointer"
              />
              <div className="relative w-24">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={reinvestmentPct}
                  onChange={(e) => setReinvestmentPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  className="w-full bg-[#0b0d12] border border-white/10 rounded-lg pr-7 pl-3 py-1.5 text-sm font-bold text-cyan-400 text-right focus:outline-none focus:border-cyan-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* 2. Fatia de Salário de Cada Sócio */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} className="text-purple-400" />
                Salário Individual dos Sócios (%)
              </label>
              <button
                type="button"
                onClick={() => handleEqualSplitRemaining(reinvestmentPct)}
                className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 transition-colors"
              >
                <RefreshCw size={11} />
                Dividir Restante ({Math.max(0, 100 - reinvestmentPct).toFixed(0)}%) Igualmente
              </button>
            </div>

            <div className="space-y-2.5">
              {humanPartners.map((partner) => {
                const pct = Number(partnerPcts[partner.id]) || 0;
                const previewAmount = activeBaseProfit * (pct / 100);
                return (
                  <div
                    key={partner.id}
                    className="p-3.5 rounded-xl bg-[#161922] border border-white/10 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                        style={{ backgroundColor: partner.avatar_color || "#10b981" }}
                      >
                        {partner.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-bold text-white truncate">{partner.name}</div>
                        <div className="text-[11px] text-slate-400">
                          Salário gerado:{" "}
                          <strong className="text-emerald-400">{formatBRL(previewAmount)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative w-24">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={pct}
                          onChange={(e) => handlePartnerPctChange(partner.id, e.target.value)}
                          className="w-full bg-[#0b0d12] border border-white/10 rounded-lg pr-7 pl-3 py-1.5 text-sm font-bold text-white text-right focus:outline-none focus:border-purple-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Barra de Validação 100% */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isBalanced
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-amber-500/10 border-amber-500/30 text-amber-300"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              {isBalanced ? (
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              )}
              <span>
                Reinvestimento ({reinvestmentPct.toFixed(1)}%) + Sócios ({totalPartnersPct.toFixed(1)}%)
              </span>
            </div>
            <span className="text-sm font-black">Total: {totalSumPct.toFixed(1)}%</span>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !isBalanced}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20"
            >
              {saving ? "Salvando..." : "Salvar Configuração"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
