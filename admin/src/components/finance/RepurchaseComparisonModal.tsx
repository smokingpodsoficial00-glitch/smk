import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Boxes,
  ArrowRightLeft,
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
  onOpenRegisterStockModal?: () => void;
}

export function RepurchaseComparisonModal({
  isOpen,
  onClose,
  repurchases,
  products,
  initialSelectedId,
}: RepurchaseComparisonModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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

  // Quando o usuário clica em uma recompra na tabela ou troca no seletor, seleciona ela e sugere a imediatamente anterior
  const handleSelectCurrent = (newCurrId: string, scrollToTop = false) => {
    setSelectedCurrentId(newCurrId);
    const idx = enrichedList.findIndex((r) => r.id === newCurrId);
    if (idx >= 0 && idx + 1 < enrichedList.length) {
      setSelectedPreviousId(enrichedList[idx + 1].id);
    } else {
      setSelectedPreviousId("");
    }
    if (scrollToTop && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
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
    };
  }, [currentRep, previousRep]);

  if (!isOpen) return null;

  const formatDateBR = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
  };

  const currentOrderNum = currentRep
    ? enrichedList.length - enrichedList.findIndex((r) => r.id === currentRep.id)
    : 0;
  const previousOrderNum = previousRep
    ? enrichedList.length - enrichedList.findIndex((r) => r.id === previousRep.id)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#09090b] border border-white/10 rounded-3xl w-[96vw] max-w-[1440px] h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ━━━ CABEÇALHO LIMPO E ESPAÇADO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="px-6 sm:px-10 py-5 sm:py-6 border-b border-white/10 flex items-center justify-between gap-4 bg-[#0c0c0f] shrink-0">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
              <ArrowRightLeft className="size-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Comparativo de Recompras
              </h2>
              <p className="text-xs sm:text-sm text-white/45 mt-0.5">
                Acompanhe o valor investido, o lucro e o crescimento de cada recompra de estoque
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* ━━━ CORPO PRINCIPAL BEM ESPAÇADO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-10 py-7 sm:py-8 space-y-9"
        >
          {/* 1. PAINEL SUPERIOR: RECOMPRA SELECIONADA VS RECOMPRA ANTERIOR */}
          {enrichedList.length > 0 && currentRep && (
            <div className="space-y-6">
              {/* Barra de Seleção das Recompras */}
              <div className="bg-[#101014] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                      Recompra #{currentOrderNum} • {formatDateBR(currentRep.purchase_date)}
                    </span>
                    {previousRep && (
                      <>
                        <span className="text-xs font-bold text-white/30">vs</span>
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs font-semibold">
                          Anterior #{previousOrderNum} • {formatDateBR(previousRep.purchase_date)}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-white/45 pt-0.5">
                    Selecione abaixo na lista ou troque nos seletores ao lado para comparar qualquer recompra
                  </p>
                </div>

                {/* Seletores Dropdown Amplos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:min-w-[540px]">
                  <div>
                    <label className="text-[11px] font-semibold text-white/50 block mb-1.5">
                      Recompra em Análise
                    </label>
                    <select
                      value={selectedCurrentId}
                      onChange={(e) => handleSelectCurrent(e.target.value)}
                      className="w-full bg-[#09090b] border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      {enrichedList.map((r, idx) => (
                        <option key={r.id} value={r.id}>
                          #{enrichedList.length - idx} • {formatDateBR(r.purchase_date)} — {formatBRL(r.total_repurchase_amount)} ({r.units} un)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-white/50 block mb-1.5">
                      Comparar com Anterior
                    </label>
                    <select
                      value={selectedPreviousId}
                      onChange={(e) => setSelectedPreviousId(e.target.value)}
                      className="w-full bg-[#09090b] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white/90 focus:outline-none focus:border-white/40 cursor-pointer"
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

              {/* 4 Cards Principais Bem Espaçados (Estilo do Sistema) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
                {/* CARD 1: VALOR INVESTIDO & UNIDADES */}
                <div className="bg-[#101014] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[175px]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                        Valor Investido
                      </span>
                      <div className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                        <DollarSign className="size-4" />
                      </div>
                    </div>

                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {formatBRL(currentRep.total_repurchase_amount)}
                      </div>
                      <p className="text-xs text-white/50 mt-1.5">
                        <strong className="text-white/80">{currentRep.units} unidades</strong> compradas
                        {currentRep.freight_amount > 0 ? ` • Frete: ${formatBRL(currentRep.freight_amount)}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs">
                    {previousRep && directComparison ? (
                      <>
                        <span className="text-white/45">
                          Anterior: <strong className="text-white/75">{formatBRL(previousRep.total_repurchase_amount)}</strong>
                        </span>
                        <span
                          className={`font-bold ${
                            directComparison.costDiff >= 0 ? "text-white/80" : "text-emerald-400"
                          }`}
                        >
                          {directComparison.costDiff >= 0 ? "+" : ""}
                          {formatBRL(directComparison.costDiff)}
                        </span>
                      </>
                    ) : (
                      <span className="text-white/35">Custo médio: {formatBRL(currentRep.avgUnitCost)}/un</span>
                    )}
                  </div>
                </div>

                {/* CARD 2: RETORNO EM VENDAS */}
                <div className="bg-[#101014] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[175px]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                        Venda Projetada
                      </span>
                      <div className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                        <BarChart3 className="size-4" />
                      </div>
                    </div>

                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {formatBRL(currentRep.projectedRevenue)}
                      </div>
                      <p className="text-xs text-white/50 mt-1.5">
                        Média de venda: <strong className="text-white/80">{formatBRL(currentRep.avgUnitSell)}/un</strong>
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs">
                    {previousRep && directComparison ? (
                      <>
                        <span className="text-white/45">
                          Anterior: <strong className="text-white/75">{formatBRL(previousRep.projectedRevenue)}</strong>
                        </span>
                        <span
                          className={`font-bold ${
                            directComparison.revDiff >= 0 ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {directComparison.revDiff >= 0 ? "+" : ""}
                          {formatBRL(directComparison.revDiff)}
                        </span>
                      </>
                    ) : (
                      <span className="text-white/35">Retorno bruto total da compra</span>
                    )}
                  </div>
                </div>

                {/* CARD 3: LUCRO DESTA COMPRA (DESTAQUE ESMERALDA) */}
                <div className="bg-emerald-500/[0.07] border border-emerald-500/35 rounded-2xl p-6 flex flex-col justify-between min-h-[175px]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Lucro da Compra
                      </span>
                      <div className="size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <TrendingUp className="size-4" />
                      </div>
                    </div>

                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                        +{formatBRL(currentRep.projectedProfit)}
                      </div>
                      <p className="text-xs text-emerald-400/75 mt-1.5 font-medium">
                        +{formatBRL(currentRep.avgUnitProfit)} de lucro por unidade
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-emerald-500/20 flex items-center justify-between text-xs">
                    {previousRep && directComparison ? (
                      <>
                        <span className="text-white/55">
                          Anterior: <strong className="text-white/85">+{formatBRL(previousRep.projectedProfit)}</strong>
                        </span>
                        <span
                          className={`font-extrabold flex items-center gap-1 ${
                            directComparison.profitDiff >= 0 ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {directComparison.profitDiff >= 0 ? (
                            <TrendingUp className="size-3.5" />
                          ) : (
                            <TrendingDown className="size-3.5" />
                          )}
                          {directComparison.profitPct >= 0 ? "+" : ""}
                          {directComparison.profitPct.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-emerald-400/70">Margem sobre venda: {currentRep.marginPct.toFixed(1)}%</span>
                    )}
                  </div>
                </div>

                {/* CARD 4: NOSSO ROI EM CIMA DA COMPRA */}
                <div className="bg-[#101014] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[175px]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                        Nosso ROI (Taxa)
                      </span>
                      <div className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
                        <Percent className="size-4" />
                      </div>
                    </div>

                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        +{currentRep.markupPct.toFixed(1)}%
                      </div>
                      <p className="text-xs text-white/50 mt-1.5">
                        Retorno em cima do valor investido
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs">
                    {previousRep && directComparison ? (
                      <>
                        <span className="text-white/45">
                          Anterior: <strong className="text-white/75">+{previousRep.markupPct.toFixed(1)}%</strong>
                        </span>
                        <span
                          className={`font-bold ${
                            directComparison.markupDiff >= 0 ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {directComparison.markupDiff >= 0 ? "+" : ""}
                          {directComparison.markupDiff.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-white/35">Margem líquida: {currentRep.marginPct.toFixed(1)}%</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Produtos Registrados Nesta Compra (quando cadastrada pelo Registrar Estoque) */}
              {currentRep.items && currentRep.items.length > 0 && (
                <div className="bg-[#101014] border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 flex items-center gap-2">
                      <Layers className="size-4 text-emerald-400" />
                      <span>Produtos Comprados Neste Lote ({currentRep.items.length})</span>
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentRep.items.map((item, idx) => {
                      const itemProfitTotal = item.qty * (item.unitSell - item.unitCost);
                      const itemMarkup =
                        item.unitCost > 0 ? ((item.unitSell - item.unitCost) / item.unitCost) * 100 : 0;

                      return (
                        <div
                          key={`${item.brand}-${item.model}-${item.flavor}-${idx}`}
                          className="p-4 rounded-xl bg-[#09090b] border border-white/10 flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-bold text-sm text-white block truncate">
                                {item.brand} {item.model}
                              </span>
                              <span className="text-xs text-white/50 block mt-0.5 truncate">
                                {item.flavor}
                              </span>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold text-xs shrink-0">
                              {item.qty} un
                            </span>
                          </div>

                          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                            <span className="text-white/50">
                              Custo: <strong className="text-white/90">{formatBRL(item.unitCost)}</strong> • Venda:{" "}
                              <strong className="text-white/90">{formatBRL(item.unitSell)}</strong>
                            </span>
                            <span className="text-emerald-400 font-bold">
                              +{formatBRL(itemProfitTotal)} (+{itemMarkup.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. EVOLUÇÃO DE RECOMPRAS (TABELA LIMPA E BEM ESPAÇADA) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2.5">
                <Calendar className="size-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Evolução de Recompras
                </h3>
                <span className="text-xs bg-white/10 text-white/70 px-2.5 py-0.5 rounded-full font-bold">
                  {enrichedList.length}
                </span>
              </div>
              <span className="text-xs text-white/40">
                Clique em qualquer recompra para carregar a comparação completa acima
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#101014]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-white/50 font-bold uppercase text-[11px] tracking-wider">
                    <th className="py-4 px-6">Dia da Compra</th>
                    <th className="py-4 px-6 text-center">Unidades</th>
                    <th className="py-4 px-6 text-right">Valor Investido</th>
                    <th className="py-4 px-6 text-right">Venda Projetada</th>
                    <th className="py-4 px-6 text-right">Lucro da Compra</th>
                    <th className="py-4 px-6 text-center">Nosso ROI</th>
                    <th className="py-4 px-6 text-right">Crescimento vs Anterior</th>
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
                        onClick={() => handleSelectCurrent(rep.id, true)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                            : isCompared
                            ? "bg-white/[0.04] hover:bg-white/[0.07]"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-white/40 w-7">
                              #{orderNum}
                            </span>
                            <span className="font-bold text-white">
                              {formatDateBR(rep.purchase_date)}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                                Selecionada
                              </span>
                            )}
                            {isCompared && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 border border-white/20 text-white/70 font-semibold">
                                Anterior
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-center font-bold text-white/80 whitespace-nowrap">
                          {rep.units} un
                        </td>

                        <td className="py-4 px-6 text-right font-bold text-white whitespace-nowrap">
                          {formatBRL(rep.total_repurchase_amount)}
                        </td>

                        <td className="py-4 px-6 text-right font-semibold text-white/80 whitespace-nowrap">
                          {formatBRL(rep.projectedRevenue)}
                        </td>

                        <td className="py-4 px-6 text-right font-extrabold text-emerald-400 whitespace-nowrap">
                          +{formatBRL(rep.projectedProfit)}
                        </td>

                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-bold text-xs">
                            +{rep.markupPct.toFixed(1)}%
                          </span>
                        </td>

                        <td className="py-4 px-6 text-right font-bold whitespace-nowrap">
                          {rep.profitGrowthPct != null && rep.profitGrowthDiff != null ? (
                            <span
                              className={
                                rep.profitGrowthDiff >= 0 ? "text-emerald-400" : "text-amber-400"
                              }
                            >
                              {rep.profitGrowthDiff >= 0 ? "▲ +" : "▼ "}
                              {rep.profitGrowthPct.toFixed(1)}%{" "}
                              <span className="text-xs font-normal opacity-75">
                                ({rep.profitGrowthDiff >= 0 ? "+" : ""}
                                {formatBRL(rep.profitGrowthDiff)})
                              </span>
                            </span>
                          ) : (
                            <span className="text-white/30 text-xs">1ª Recompra</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
