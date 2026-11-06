import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  PackagePlus,
  Boxes,
  ArrowRightLeft,
  Sparkles,
  CheckCircle2,
  Calendar,
  DollarSign,
  Percent,
  BarChart3,
  Layers,
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import {
  type StockRepurchase,
  type EnrichedStockRepurchase,
  enrichStockRepurchasesList,
} from "@/lib/stockRepurchases";

interface RepurchaseComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  repurchases: StockRepurchase[];
  products: any[];
  initialSelectedId?: string | null;
  onOpenRegisterStockModal: () => void;
}

export function RepurchaseComparisonModal({
  isOpen,
  onClose,
  repurchases,
  products,
  initialSelectedId,
  onOpenRegisterStockModal,
}: RepurchaseComparisonModalProps) {
  const enrichedList = useMemo(
    () => enrichStockRepurchasesList(repurchases, products),
    [repurchases, products]
  );

  const [selectedCurrentId, setSelectedCurrentId] = useState<string>("");
  const [selectedPreviousId, setSelectedPreviousId] = useState<string>("");

  // Inicializar seleção padrão: Última Recompra (índice 0) vs Penúltima Recompra (índice 1)
  useEffect(() => {
    if (!isOpen) return;
    if (enrichedList.length === 0) {
      setSelectedCurrentId("");
      setSelectedPreviousId("");
      return;
    }

    const startCurr =
      initialSelectedId && enrichedList.some((r) => r.id === initialSelectedId)
        ? initialSelectedId
        : enrichedList[0].id;

    setSelectedCurrentId(startCurr);

    const currIdx = enrichedList.findIndex((r) => r.id === startCurr);
    if (currIdx >= 0 && currIdx + 1 < enrichedList.length) {
      setSelectedPreviousId(enrichedList[currIdx + 1].id);
    } else if (enrichedList.length > 1) {
      const fallbackPrev = enrichedList.find((r) => r.id !== startCurr);
      setSelectedPreviousId(fallbackPrev ? fallbackPrev.id : "");
    } else {
      setSelectedPreviousId("");
    }
  }, [isOpen, enrichedList, initialSelectedId]);

  // Quando o usuário troca a Recompra Atual no seletor, sugerir automaticamente a imediatamente anterior a ela
  const handleSelectCurrent = (newCurrId: string) => {
    setSelectedCurrentId(newCurrId);
    const idx = enrichedList.findIndex((r) => r.id === newCurrId);
    if (idx >= 0 && idx + 1 < enrichedList.length) {
      setSelectedPreviousId(enrichedList[idx + 1].id);
    }
  };

  const currentRep: EnrichedStockRepurchase | null = useMemo(
    () => enrichedList.find((r) => r.id === selectedCurrentId) || enrichedList[0] || null,
    [enrichedList, selectedCurrentId]
  );

  const previousRep: EnrichedStockRepurchase | null = useMemo(
    () => enrichedList.find((r) => r.id === selectedPreviousId) || null,
    [enrichedList, selectedPreviousId]
  );

  // Cálculos do Comparativo Direto (currentRep vs previousRep)
  const directComparison = useMemo(() => {
    if (!currentRep || !previousRep) return null;

    const costDiff = currentRep.total_repurchase_amount - previousRep.total_repurchase_amount;
    const costPct =
      previousRep.total_repurchase_amount > 0
        ? (costDiff / previousRep.total_repurchase_amount) * 100
        : 0;

    const unitsDiff = currentRep.units - previousRep.units;
    const unitsPct = previousRep.units > 0 ? (unitsDiff / previousRep.units) * 100 : 0;

    const revDiff = currentRep.projectedRevenue - previousRep.projectedRevenue;
    const revPct =
      previousRep.projectedRevenue > 0 ? (revDiff / previousRep.projectedRevenue) * 100 : 0;

    const profitDiff = currentRep.projectedProfit - previousRep.projectedProfit;
    const profitPct =
      previousRep.projectedProfit > 0 ? (profitDiff / previousRep.projectedProfit) * 100 : 0;

    const markupDiff = currentRep.markupPct - previousRep.markupPct;
    const unitCostDiff = currentRep.avgUnitCost - previousRep.avgUnitCost;

    return {
      costDiff,
      costPct,
      unitsDiff,
      unitsPct,
      revDiff,
      revPct,
      profitDiff,
      profitPct,
      markupDiff,
      unitCostDiff,
    };
  }, [currentRep, previousRep]);

  // Totais Acumulados de todas as recompras
  const globalTotals = useMemo(() => {
    const totalInvested = enrichedList.reduce((acc, r) => acc + r.total_repurchase_amount, 0);
    const totalUnits = enrichedList.reduce((acc, r) => acc + r.units, 0);
    const totalRevenue = enrichedList.reduce((acc, r) => acc + r.projectedRevenue, 0);
    const totalProfit = enrichedList.reduce((acc, r) => acc + r.projectedProfit, 0);
    const avgMarkup = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalInvested,
      totalUnits,
      totalRevenue,
      totalProfit,
      avgMarkup,
      avgMargin,
    };
  }, [enrichedList]);

  if (!isOpen) return null;

  const formatDateBR = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0b0e] border border-white/15 rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ━━━ CABEÇALHO DO MODAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="px-5 sm:px-7 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ArrowRightLeft className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Inteligência de Recompras
                </span>
                <span className="text-[10px] text-white/40">
                  {enrichedList.length} {enrichedList.length === 1 ? "registro" : "registros"}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                Registro & Comparativo de Recompras (Lucros e Crescimento)
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRegisterStockModal();
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <PackagePlus className="size-4 stroke-[2.5]" />
              <span>Registrar Compra de Mercadorias (Estoque)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="size-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* ━━━ CORPO SCROLLÁVEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 space-y-6">
          {/* 1. RESUMO ACUMULADO DE TODAS AS RECOMPRAS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-[#121216] border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                <DollarSign className="size-3.5 text-white/50" /> Total Investido ({enrichedList.length} recompras)
              </span>
              <div className="text-lg sm:text-xl font-black text-white font-mono">
                {formatBRL(globalTotals.totalInvested)}
              </div>
              <span className="text-[10px] text-white/40 block">
                {globalTotals.totalUnits} unidades adquiridas no total
              </span>
            </div>

            <div className="bg-[#121216] border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                <BarChart3 className="size-3.5 text-blue-400" /> Retorno Bruto Esperado
              </span>
              <div className="text-lg sm:text-xl font-black text-blue-300 font-mono">
                {formatBRL(globalTotals.totalRevenue)}
              </div>
              <span className="text-[10px] text-white/40 block">
                Valor de venda total das mercadorias compradas
              </span>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-emerald-400" /> Lucro Total das Recompras
              </span>
              <div className="text-lg sm:text-xl font-black text-emerald-300 font-mono">
                +{formatBRL(globalTotals.totalProfit)}
              </div>
              <span className="text-[10px] text-emerald-400/80 font-semibold block">
                Lucro líquido gerado em cima das compras
              </span>
            </div>

            <div className="bg-[#121216] border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Percent className="size-3.5 text-amber-400" /> Taxa Média sobre Custo (ROI)
              </span>
              <div className="text-lg sm:text-xl font-black text-amber-300 font-mono">
                +{globalTotals.avgMarkup.toFixed(1)}%
              </div>
              <span className="text-[10px] text-white/40 block">
                Margem sobre venda: {globalTotals.avgMargin.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* 2. COMPARADOR LADO A LADO: RECOMPRA ATUAL VS RECOMPRA PASSADA */}
          {enrichedList.length > 0 && currentRep && (
            <div className="bg-[#121216] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    <Sparkles className="size-4 text-emerald-400" />
                    <span>Comparativo Direto: Recompra Atual vs Recompra Passada</span>
                  </h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    Compare quanto foi investido, quantas unidades entraram, a nossa taxa em cima e o crescimento de lucro entre uma recompra e outra.
                  </p>
                </div>

                {/* Seletores das 2 Recompras */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 shrink-0">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                      Recompra Selecionada (Base):
                    </label>
                    <select
                      value={selectedCurrentId}
                      onChange={(e) => handleSelectCurrent(e.target.value)}
                      className="w-full bg-black/80 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                    >
                      {enrichedList.map((r, idx) => (
                        <option key={r.id} value={r.id}>
                          #{enrichedList.length - idx} • {formatDateBR(r.purchase_date)} — {formatBRL(r.total_repurchase_amount)} ({r.units} un)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block mb-1">
                      Comparar com Recompra Passada:
                    </label>
                    <select
                      value={selectedPreviousId}
                      onChange={(e) => setSelectedPreviousId(e.target.value)}
                      className="w-full bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="">Sem comparação</option>
                      {enrichedList
                        .filter((r) => r.id !== currentRep.id)
                        .map((r) => {
                          const origIdx = enrichedList.findIndex((x) => x.id === r.id);
                          return (
                            <option key={r.id} value={r.id}>
                              #{enrichedList.length - origIdx} • {formatDateBR(r.purchase_date)} — {formatBRL(r.total_repurchase_amount)} ({r.units} un)
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>
              </div>

              {/* 4 Cards Comparativos da Remessa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card A: Custo Desembolsado */}
                <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                      1. Valor Gasto na Compra
                    </span>
                    <span className="text-[10px] font-mono text-white/40">
                      {formatDateBR(currentRep.purchase_date)}
                    </span>
                  </div>

                  <div>
                    <div className="text-xl font-black text-white font-mono">
                      {formatBRL(currentRep.total_repurchase_amount)}
                    </div>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      Produtos: {formatBRL(currentRep.stock_purchase_amount)}
                      {currentRep.freight_amount > 0 ? ` + Frete: ${formatBRL(currentRep.freight_amount)}` : ""}
                    </p>
                  </div>

                  {previousRep && directComparison && (
                    <div className="pt-2 border-t border-white/10 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-white/50">
                        <span>Recompra passada ({formatDateBR(previousRep.purchase_date)}):</span>
                        <span className="font-mono font-bold text-white/80">
                          {formatBRL(previousRep.total_repurchase_amount)}
                        </span>
                      </div>
                      <div
                        className={`font-bold flex items-center gap-1 ${
                          directComparison.costDiff >= 0 ? "text-amber-300" : "text-emerald-400"
                        }`}
                      >
                        {directComparison.costDiff >= 0 ? (
                          <TrendingUp className="size-3.5" />
                        ) : (
                          <TrendingDown className="size-3.5" />
                        )}
                        <span>
                          {directComparison.costDiff >= 0 ? "+" : ""}
                          {formatBRL(directComparison.costDiff)} ({directComparison.costPct >= 0 ? "+" : ""}
                          {directComparison.costPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card B: Volume de Mercadorias & Custo Médio Unitário */}
                <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                      2. Mercadorias & Custo Médio
                    </span>
                    <Boxes className="size-3.5 text-white/40" />
                  </div>

                  <div>
                    <div className="text-xl font-black text-white font-mono">
                      {currentRep.units} un
                    </div>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      Custo médio:{" "}
                      <strong className="text-white">{formatBRL(currentRep.avgUnitCost)}/un</strong>
                    </p>
                  </div>

                  {previousRep && directComparison && (
                    <div className="pt-2 border-t border-white/10 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-white/50">
                        <span>Passada ({previousRep.units} un):</span>
                        <span className="font-mono font-bold text-white/80">
                          {formatBRL(previousRep.avgUnitCost)}/un
                        </span>
                      </div>
                      <div
                        className={`font-bold flex items-center gap-1 ${
                          directComparison.unitsDiff >= 0 ? "text-emerald-400" : "text-amber-300"
                        }`}
                      >
                        <span>
                          Volume: {directComparison.unitsDiff >= 0 ? "+" : ""}
                          {directComparison.unitsDiff} un ({directComparison.unitsPct >= 0 ? "+" : ""}
                          {directComparison.unitsPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card C: Faturamento Esperado da Remessa */}
                <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                      3. Faturamento desta Compra
                    </span>
                    {currentRep.isEstimated && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                        Estimado
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="text-xl font-black text-blue-300 font-mono">
                      {formatBRL(currentRep.projectedRevenue)}
                    </div>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      Venda média:{" "}
                      <strong className="text-white">{formatBRL(currentRep.avgUnitSell)}/un</strong>
                    </p>
                  </div>

                  {previousRep && directComparison && (
                    <div className="pt-2 border-t border-white/10 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-white/50">
                        <span>Faturamento passada:</span>
                        <span className="font-mono font-bold text-white/80">
                          {formatBRL(previousRep.projectedRevenue)}
                        </span>
                      </div>
                      <div
                        className={`font-bold flex items-center gap-1 ${
                          directComparison.revDiff >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {directComparison.revDiff >= 0 ? (
                          <TrendingUp className="size-3.5" />
                        ) : (
                          <TrendingDown className="size-3.5" />
                        )}
                        <span>
                          {directComparison.revDiff >= 0 ? "+" : ""}
                          {formatBRL(directComparison.revDiff)} ({directComparison.revPct >= 0 ? "+" : ""}
                          {directComparison.revPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card D: LUCRO E TAXA EM CIMA DESTA MERCADORIA */}
                <div className="bg-gradient-to-b from-emerald-500/15 to-black/60 border-2 border-emerald-500/40 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                      4. Lucro & Taxa desta Compra
                    </span>
                    <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      +{currentRep.markupPct.toFixed(1)}% ROI
                    </span>
                  </div>

                  <div>
                    <div className="text-xl font-black text-emerald-300 font-mono">
                      +{formatBRL(currentRep.projectedProfit)}
                    </div>
                    <p className="text-[11px] text-emerald-400/80 font-medium mt-0.5">
                      Lucro por pod: +{formatBRL(currentRep.avgUnitProfit)} • Margem: {currentRep.marginPct.toFixed(1)}%
                    </p>
                  </div>

                  {previousRep && directComparison && (
                    <div className="pt-2 border-t border-emerald-500/20 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-white/60">
                        <span>Lucro passada (+{previousRep.markupPct.toFixed(0)}%):</span>
                        <span className="font-mono font-bold text-white">
                          +{formatBRL(previousRep.projectedProfit)}
                        </span>
                      </div>
                      <div
                        className={`font-extrabold flex items-center gap-1 ${
                          directComparison.profitDiff >= 0 ? "text-emerald-300" : "text-red-400"
                        }`}
                      >
                        {directComparison.profitDiff >= 0 ? (
                          <TrendingUp className="size-3.5" />
                        ) : (
                          <TrendingDown className="size-3.5" />
                        )}
                        <span>
                          Crescimento: {directComparison.profitDiff >= 0 ? "+" : ""}
                          {formatBRL(directComparison.profitDiff)} ({directComparison.profitPct >= 0 ? "+" : ""}
                          {directComparison.profitPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Balão Resumo de Diagnóstico da Recompra */}
              {previousRep && directComparison && (
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start gap-3 text-xs text-white/80 leading-relaxed">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Resumo da Comparação:</strong> Na recompra de{" "}
                    <strong className="text-emerald-300">{formatDateBR(currentRep.purchase_date)}</strong>, foram investidos{" "}
                    <strong className="text-white">{formatBRL(currentRep.total_repurchase_amount)}</strong> para{" "}
                    <strong className="text-white">{currentRep.units} unidades</strong>, projetando um lucro líquido de{" "}
                    <strong className="text-emerald-400">+{formatBRL(currentRep.projectedProfit)}</strong> (nossa taxa em cima do custo é de{" "}
                    <strong className="text-amber-300">+{currentRep.markupPct.toFixed(1)}%</strong>). Em comparação com a recompra de{" "}
                    <strong className="text-purple-300">{formatDateBR(previousRep.purchase_date)}</strong>, o lucro desta remessa{" "}
                    {directComparison.profitDiff >= 0 ? (
                      <span className="text-emerald-400 font-bold">
                        cresceu +{formatBRL(directComparison.profitDiff)} (+{directComparison.profitPct.toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-amber-300 font-bold">
                        variou {formatBRL(directComparison.profitDiff)} ({directComparison.profitPct.toFixed(1)}%)
                      </span>
                    )}
                    {directComparison.unitCostDiff !== 0 && (
                      <span>
                        {" "}
                        e o custo médio por unidade ficou{" "}
                        <strong>
                          {directComparison.unitCostDiff > 0
                            ? `+${formatBRL(directComparison.unitCostDiff)} mais caro`
                            : `-${formatBRL(Math.abs(directComparison.unitCostDiff))} mais barato`}
                        </strong>
                        .
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de Mercadorias Detalhadas Desta Recompra (quando disponível via Registrar Estoque) */}
              {currentRep.items && currentRep.items.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-emerald-400" />
                    <span>
                      Mercadorias Registradas nesta Compra ({currentRep.items.length}{" "}
                      {currentRep.items.length === 1 ? "item" : "itens"})
                    </span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {currentRep.items.map((item, idx) => {
                      const itemCostTotal = item.qty * item.unitCost;
                      const itemProfitTotal = item.qty * (item.unitSell - item.unitCost);
                      const itemMarkup =
                        item.unitCost > 0 ? ((item.unitSell - item.unitCost) / item.unitCost) * 100 : 0;
                      const prevDiff =
                        item.previousCost !== null && item.previousCost !== undefined
                          ? item.unitCost - item.previousCost
                          : null;

                      return (
                        <div
                          key={`${item.brand}-${item.model}-${item.flavor}-${idx}`}
                          className="p-3 rounded-xl bg-black/60 border border-white/10 flex flex-col justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-white truncate">
                                {item.brand} {item.model}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px] shrink-0">
                                {item.qty} un
                              </span>
                            </div>
                            <span className="text-[11px] text-white/60 block mt-0.5 truncate">
                              Sabor: <strong className="text-white/90">{item.flavor}</strong>
                            </span>
                          </div>

                          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                            <div>
                              <span className="text-white/50 block">
                                Custo: <strong className="text-white">{formatBRL(item.unitCost)}</strong>
                                {prevDiff !== null && prevDiff !== 0 && (
                                  <span
                                    className={`ml-1 font-bold ${
                                      prevDiff > 0 ? "text-amber-400" : "text-emerald-400"
                                    }`}
                                  >
                                    ({prevDiff > 0 ? `+${formatBRL(prevDiff)}` : formatBRL(prevDiff)})
                                  </span>
                                )}
                              </span>
                              <span className="text-white/50 block">
                                Venda: <strong className="text-white">{formatBRL(item.unitSell)}</strong>
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-emerald-400 font-mono font-bold block">
                                Lucro: +{formatBRL(itemProfitTotal)}
                              </span>
                              <span className="text-[10px] text-amber-300 font-mono">
                                Taxa: +{itemMarkup.toFixed(0)}% ({formatBRL(itemCostTotal)} pago)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. TABELA DE HISTÓRICO & EVOLUÇÃO RECOMPRA A RECOMPRA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-white/90 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="size-4 text-emerald-400" />
                <span>Evolução Histórica Recompra a Recompra</span>
              </h3>
              <span className="text-[11px] text-white/40">
                Clique em qualquer linha para selecioná-la no comparador acima
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#121216]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-white/60 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3.5">#</th>
                    <th className="py-3 px-3.5">Data</th>
                    <th className="py-3 px-3.5 text-center">Unidades</th>
                    <th className="py-3 px-3.5 text-right">Custo Pago (+Frete)</th>
                    <th className="py-3 px-3.5 text-right">Venda Projetada</th>
                    <th className="py-3 px-3.5 text-right">Lucro da Compra</th>
                    <th className="py-3 px-3.5 text-center">Nossa Taxa (ROI)</th>
                    <th className="py-3 px-3.5 text-right">Crescimento vs Anterior</th>
                    <th className="py-3 px-3.5">Observação / Lote</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {enrichedList.map((rep, idx) => {
                    const orderNum = enrichedList.length - idx;
                    const isSelected = rep.id === currentRep?.id;
                    const isCompared = rep.id === previousRep?.id;

                    return (
                      <tr
                        key={rep.id}
                        onClick={() => handleSelectCurrent(rep.id)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-emerald-500/15 hover:bg-emerald-500/20"
                            : isCompared
                            ? "bg-purple-500/10 hover:bg-purple-500/15"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <td className="py-3 px-3.5 font-mono font-bold text-white/60">
                          #{orderNum}
                        </td>
                        <td className="py-3 px-3.5 font-mono font-bold text-white whitespace-nowrap">
                          {formatDateBR(rep.purchase_date)}
                          {isSelected && (
                            <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-black font-extrabold uppercase">
                              Selecionada
                            </span>
                          )}
                          {isCompared && (
                            <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-purple-400 text-black font-extrabold uppercase">
                              Comparada
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono font-bold text-white/90">
                          {rep.units} un
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-white">
                          {formatBRL(rep.total_repurchase_amount)}
                          {rep.freight_amount > 0 && (
                            <span className="block text-[10px] text-white/40 font-normal">
                              (Frete: {formatBRL(rep.freight_amount)})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-blue-300 font-bold">
                          {formatBRL(rep.projectedRevenue)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-extrabold text-emerald-400">
                          +{formatBRL(rep.projectedProfit)}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-[11px]">
                            +{rep.markupPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                          {rep.profitGrowthPct != null && rep.profitGrowthDiff != null ? (
                            <span
                              className={
                                rep.profitGrowthDiff >= 0 ? "text-emerald-400" : "text-amber-400"
                              }
                            >
                              {rep.profitGrowthDiff >= 0 ? "▲ +" : "▼ "}
                              {rep.profitGrowthPct.toFixed(1)}% ({rep.profitGrowthDiff >= 0 ? "+" : ""}
                              {formatBRL(rep.profitGrowthDiff)})
                            </span>
                          ) : (
                            <span className="text-white/30 text-[10px]">1ª Recompra</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-white/60 max-w-[200px] truncate">
                          {rep.notes || <span className="text-white/20 italic">Sem observações</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ━━━ RODAPÉ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
          <span className="text-[11px] text-white/40">
            💡 Todas as entradas feitas em &ldquo;Registrar Estoque&rdquo; alimentam este comparativo automaticamente.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
