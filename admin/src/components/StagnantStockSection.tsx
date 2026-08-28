import React, { useState, useMemo, useEffect } from "react";
import {
  PackageSearch, AlertTriangle, TrendingDown, TrendingUp, DollarSign,
  Package, Search, Filter, Tag, Sparkles, Flame, CheckCircle2, ChevronRight, BarChart3
} from "lucide-react";
import { fetchProductPromotionsMap, updateProductPromotion, type PromoData } from "../lib/productPromotions";
import { LiquidationOfferModal } from "./LiquidationOfferModal";

export const TURNOVER_THRESHOLDS = {
  NORMAL_MAX_DAYS: 9,      // 🟢 Giro Normal: < 10 dias sem venda
  LOW_MAX_DAYS: 20,       // 🟡 Baixo Giro: 10 a 20 dias sem venda
  STAGNANT_MAX_DAYS: 35,  // 🟠 Produto Parado: 21 a 35 dias sem venda
  // 🔴 Produto Crítico: > 35 dias sem venda OU Nunca Vendido
};

export type TurnoverStatus = "NORMAL" | "BAIXO_GIRO" | "PARADO" | "CRITICO";

export function getProductTurnoverStatus(daysWithoutSale: number | null): TurnoverStatus {
  if (daysWithoutSale === null) return "CRITICO"; // Nunca vendido
  if (daysWithoutSale < 10) return "NORMAL";
  if (daysWithoutSale <= 20) return "BAIXO_GIRO";
  if (daysWithoutSale <= 35) return "PARADO";
  return "CRITICO";
}

interface StagnantStockSectionProps {
  products: any[];
  orders: any[];
  companyId?: string;
  onStockUpdated?: () => void;
}

export const StagnantStockSection: React.FC<StagnantStockSectionProps> = ({
  products,
  orders,
  companyId,
  onStockUpdated,
}) => {
  const [filterTab, setFilterTab] = useState<"TODOS" | "NORMAL" | "BAIXO_GIRO" | "PARADO" | "CRITICO">("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [promotionsMap, setPromotionsMap] = useState<Record<string, PromoData>>({});
  const [selectedOfferProduct, setSelectedOfferProduct] = useState<any | null>(null);

  // Carregar mapa de promoções do Supabase DB
  const loadPromotions = async () => {
    const map = await fetchProductPromotionsMap(companyId);
    setPromotionsMap(map);
  };

  useEffect(() => {
    loadPromotions();
  }, [companyId]);

  // Processamento e cruzamento de dados de Estoque com Histórico de Vendas
  const stagnantItems = useMemo(() => {
    const now = new Date().getTime();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Filtra ordens válidas (não canceladas e não de sistema)
    const validOrders = (orders || []).filter((ord: any) => {
      const phone = (ord.client_phone || "").trim();
      const name = (ord.client_name || "").trim().toLowerCase();
      const status = (ord.delivery_status || "").toUpperCase();
      return (
        status !== "CANCELADO" &&
        !phone.startsWith("__SYSTEM_") &&
        !name.includes("system config") &&
        !name.includes("system_config")
      );
    });

    // Filtra produtos com estoque > 0 e desconsidera variações zeradas "Padrão"
    const activeProducts = (products || []).filter((p: any) => {
      const stock = parseInt(p.stock) || 0;
      const flavorName = (p.flavor || "").trim().toLowerCase();
      const isPadrao = flavorName === "padrão" || flavorName === "padrao" || flavorName === "";
      return stock > 0 && !isPadrao;
    });

    return activeProducts.map((p: any) => {
      const pId = p.id;
      const pBrandNorm = (p.brand || "").trim().toLowerCase();
      const pNameNorm = (p.name || "").trim().toLowerCase();
      const pFlavorNorm = (p.flavor || "").trim().toLowerCase();

      let qtySold7d = 0;
      let qtySoldPrev7d = 0;
      let qtySold30d = 0;
      let latestSaleTimestamp: number | null = null;

      // Buscar no histórico de ordens por este produto/variação idêntica
      validOrders.forEach((ord: any) => {
        const ordTime = new Date(ord.created_at).getTime();
        const items = Array.isArray(ord.items) ? ord.items : [];

        items.forEach((it: any) => {
          const itId = it.product_id || it.id;
          const itBrandNorm = (it.brand || "").trim().toLowerCase();
          const itNameNorm = (it.name || "").trim().toLowerCase();
          const itFlavorNorm = (it.flavor || "").trim().toLowerCase();

          const isMatch =
            (itId && itId === pId) ||
            (itBrandNorm === pBrandNorm && itNameNorm === pNameNorm && itFlavorNorm === pFlavorNorm);

          if (isMatch) {
            const qty = parseInt(it.quantity) || 1;
            if (latestSaleTimestamp === null || ordTime > latestSaleTimestamp) {
              latestSaleTimestamp = ordTime;
            }

            if (ordTime >= sevenDaysAgo) {
              qtySold7d += qty;
            } else if (ordTime >= fourteenDaysAgo) {
              qtySoldPrev7d += qty;
            }

            if (ordTime >= thirtyDaysAgo) {
              qtySold30d += qty;
            }
          }
        });
      });

      const daysWithoutSale = latestSaleTimestamp
        ? Math.floor((now - latestSaleTimestamp) / (1000 * 60 * 60 * 24))
        : null;

      const status = getProductTurnoverStatus(daysWithoutSale);
      const stock = parseInt(p.stock) || 0;
      const costPrice = parseFloat(p.cost_price) || 0;
      const sellPrice = parseFloat(p.price) || 0;
      const stagnantValue = stock * costPrice;

      // Queda relevante no giro recente (se vendeu menos nos últimos 7d do que nos 7d anteriores)
      const isTrendDropping = qtySoldPrev7d > 0 && qtySold7d < qtySoldPrev7d;
      const dropPct = isTrendDropping
        ? Math.round(((qtySoldPrev7d - qtySold7d) / qtySoldPrev7d) * 100)
        : 0;

      const promoInfo = promotionsMap[p.id];
      const isPromotional = promoInfo ? promoInfo.isPromotional : false;

      return {
        ...p,
        stock,
        costPrice,
        sellPrice,
        stagnantValue,
        qtySold7d,
        qtySold30d,
        latestSaleTimestamp,
        daysWithoutSale,
        status,
        isTrendDropping,
        dropPct,
        isPromotional,
        promoData: promoInfo,
      };
    });
  }, [products, orders, promotionsMap]);

  // Ordenação padrão: Maior tempo sem vender primeiro (ou nunca vendidos)
  const sortedStagnantItems = useMemo(() => {
    return [...stagnantItems].sort((a, b) => {
      if (a.daysWithoutSale === null && b.daysWithoutSale === null) {
        return b.stagnantValue - a.stagnantValue;
      }
      if (a.daysWithoutSale === null) return -1;
      if (b.daysWithoutSale === null) return 1;
      return b.daysWithoutSale - a.daysWithoutSale;
    });
  }, [stagnantItems]);

  // Filtros aplicados por busca e por status de giro
  const filteredItems = useMemo(() => {
    return sortedStagnantItems.filter((item) => {
      if (filterTab !== "TODOS" && item.status !== filterTab) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const b = (item.brand || "").toLowerCase();
        const n = (item.name || "").toLowerCase();
        const f = (item.flavor || "").toLowerCase();
        return b.includes(q) || n.includes(q) || f.includes(q);
      }
      return true;
    });
  }, [sortedStagnantItems, filterTab, searchQuery]);

  // Cálculo dos 4 Cards de Resumo no Topo
  const summaryMetrics = useMemo(() => {
    const stagnantAndCritical = stagnantItems.filter((i) => i.status === "PARADO" || i.status === "CRITICO");
    const countParados = stagnantAndCritical.length;
    const capitalParado = stagnantAndCritical.reduce((sum, i) => sum + i.stagnantValue, 0);
    const totalUnitsParadas = stagnantAndCritical.reduce((sum, i) => sum + i.stock, 0);

    let maxProduct = null;
    if (stagnantAndCritical.length > 0) {
      maxProduct = [...stagnantAndCritical].sort((a, b) => b.stagnantValue - a.stagnantValue)[0];
    } else if (stagnantItems.length > 0) {
      maxProduct = [...stagnantItems].sort((a, b) => b.stagnantValue - a.stagnantValue)[0];
    }

    const criticalItems = stagnantItems.filter((i) => i.status === "CRITICO");
    const criticalCapital = criticalItems.reduce((sum, i) => sum + i.stagnantValue, 0);

    return {
      countParados,
      capitalParado,
      totalUnitsParadas,
      maxProduct,
      criticalCount: criticalItems.length,
      criticalCapital,
    };
  }, [stagnantItems]);

  // Top 10 Produtos com maior Capital Parado
  const top10StagnantCapital = useMemo(() => {
    return [...stagnantItems]
      .sort((a, b) => b.stagnantValue - a.stagnantValue)
      .slice(0, 10);
  }, [stagnantItems]);

  // Alternar Promoção Direta
  const handleTogglePromotion = async (product: any) => {
    const newStatus = !product.isPromotional;
    const defaultPromoPrice = (product.sellPrice * 0.85).toFixed(2);

    await updateProductPromotion({
      productId: product.id,
      isPromotional: newStatus,
      promoPrice: newStatus ? parseFloat(defaultPromoPrice) : 0,
      discountPct: newStatus ? 15 : 0,
      companyId,
    });

    await loadPromotions();
    if (onStockUpdated) onStockUpdated();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ━━━ BANNER DE ALERTA CRÍTICO SE EXISTIREM PRODUTOS CRÍTICOS ━━━━━━━━ */}
      {summaryMetrics.criticalCount > 0 && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-red-500/5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 text-red-400">
              <AlertTriangle className="size-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                ATENÇÃO: PRODUTOS EM ESTÁGIO CRÍTICO
              </h4>
              <p className="text-xs text-white mt-0.5 font-medium">
                Existem <strong className="text-red-400">{summaryMetrics.criticalCount} produtos</strong> há mais de 35 dias sem venda ou nunca vendidos. Capital parado em risco: <strong className="text-red-400">R$ {summaryMetrics.criticalCapital.toFixed(2)}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilterTab("CRITICO")}
            className="px-3.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 text-black text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 shadow-md shadow-red-500/20"
          >
            Ver Produtos Críticos
          </button>
        </div>
      )}

      {/* ━━━ 4 CARDS DE RESUMO FINANCEIRO DE ESTOQUE PARADO ━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            PRODUTOS PARADOS
          </span>
          <div className="text-2xl font-extrabold text-amber-400">
            {summaryMetrics.countParados} <span className="text-xs font-normal text-muted-foreground">modelos/sabores</span>
          </div>
          <span className="text-[10px] text-muted-foreground block">Classificados em Parado ou Crítico</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            CAPITAL PARADO (PARADO/CRÍTICO)
          </span>
          <div className="text-2xl font-extrabold text-red-400">
            R$ {summaryMetrics.capitalParado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground block">Somatório (Estoque × Custo)</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            ITENS EM ESTOQUE PARADO
          </span>
          <div className="text-2xl font-extrabold text-white">
            {summaryMetrics.totalUnitsParadas} <span className="text-xs font-normal text-muted-foreground">unidades</span>
          </div>
          <span className="text-[10px] text-muted-foreground block">Peças físicas sem giro</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            MAIOR PRODUTO ENCALHADO
          </span>
          {summaryMetrics.maxProduct ? (
            <div>
              <div className="text-sm font-bold text-white truncate">
                {summaryMetrics.maxProduct.brand} {summaryMetrics.maxProduct.name}
              </div>
              <div className="text-xs font-semibold text-emerald-400">
                R$ {summaryMetrics.maxProduct.stagnantValue.toFixed(2)} ({summaryMetrics.maxProduct.stock} un.)
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Nenhum produto encalhado</div>
          )}
        </div>
      </div>

      {/* ━━━ BARRA DE NAVEGAÇÃO, FILTROS E PESQUISA DA TABELA ━━━━━━━━━━━━━ */}
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Flame className="size-4 text-amber-400" />
              Análise de Giro de Estoque & Oportunidades de Liquidação
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Identifique produtos sem giro, aplique descontos e libere caixa imobilizado
            </p>
          </div>

          {/* Campo de Busca */}
          <div className="relative min-w-[240px]">
            <Search className="size-3.5 absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por marca, modelo ou sabor..."
              className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-amber-400 transition-all"
            />
          </div>
        </div>

        {/* Filtros Rápidos por Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {(["TODOS", "NORMAL", "BAIXO_GIRO", "PARADO", "CRITICO"] as const).map((tab) => {
            const labelMap = {
              TODOS: "Todos os Produtos",
              NORMAL: "🟢 Giro Normal (<10d)",
              BAIXO_GIRO: "🟡 Baixo Giro (10-20d)",
              PARADO: "🟠 Produto Parado (21-35d)",
              CRITICO: "🔴 Produto Crítico (>35d)",
            };

            const isSelected = filterTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20 font-bold"
                    : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border-white/10"
                }`}
              >
                {labelMap[tab]}
              </button>
            );
          })}
        </div>

        {/* ━━━ TABELA PRINCIPAL ESCURA ERP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="overflow-x-auto rounded-xl border border-white/10 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#181818] border-b border-white/10 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <th className="p-3">Produto</th>
                <th className="p-3">Sabor</th>
                <th className="p-3 text-center">Estoque</th>
                <th className="p-3">Última Venda</th>
                <th className="p-3 text-center">Dias Sem Venda</th>
                <th className="p-3 text-center">Giro (30d)</th>
                <th className="p-3 text-right">Valor Parado</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#111111]">
              {filteredItems.map((item) => {
                const statusBadgeMap = {
                  NORMAL: { label: "🟢 Giro Normal", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
                  BAIXO_GIRO: { label: "🟡 Baixo Giro", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
                  PARADO: { label: "🟠 Parado", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
                  CRITICO: { label: "🔴 Crítico", cls: "bg-red-500/10 text-red-400 border-red-500/20 font-bold animate-pulse" },
                };

                const badge = statusBadgeMap[item.status as TurnoverStatus];

                return (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    
                    {/* Produto / Foto / Marca + Modelo */}
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="size-9 rounded-lg object-contain bg-black/60 p-0.5 border border-white/10 shrink-0" />
                        ) : (
                          <div className="size-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-muted-foreground font-bold text-[10px]">
                            {item.brand?.substring(0, 2) || "POD"}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{item.brand} {item.name}</span>
                            {item.isPromotional && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-in fade-in">
                                EM PROMOÇÃO
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{item.puffs ? `${item.puffs} puffs` : "Pod Disposable"}</span>
                        </div>
                      </div>
                    </td>

                    {/* Sabor */}
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-medium text-xs">
                        {item.flavor}
                      </span>
                    </td>

                    {/* Estoque Atual */}
                    <td className="p-3 text-center">
                      <span className="font-bold text-white bg-black/50 border border-white/10 px-2 py-0.5 rounded">
                        {item.stock} un.
                      </span>
                    </td>

                    {/* Data da Última Venda */}
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {item.latestSaleTimestamp ? (
                        new Date(item.latestSaleTimestamp).toLocaleDateString("pt-BR")
                      ) : (
                        <span className="text-red-400 font-semibold italic">Nunca vendido</span>
                      )}
                    </td>

                    {/* Dias Sem Vender */}
                    <td className="p-3 text-center">
                      {item.daysWithoutSale !== null ? (
                        <span className={`font-bold ${item.daysWithoutSale > 35 ? "text-red-400" : item.daysWithoutSale > 20 ? "text-orange-400" : "text-white"}`}>
                          {item.daysWithoutSale} dias
                        </span>
                      ) : (
                        <span className="text-red-400 font-bold">∞</span>
                      )}
                    </td>

                    {/* Giro (Vendas nos últimos 30d) + Tendência */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-emerald-400">{item.qtySold30d} un.</span>
                        {item.isTrendDropping && (
                          <span className="text-[9px] font-semibold text-amber-400 flex items-center gap-0.5 mt-0.5 bg-amber-500/10 px-1 rounded border border-amber-500/20" title={`Queda de ${item.dropPct}% comparado aos 7 dias anteriores`}>
                            <TrendingDown className="size-2.5" /> Giro em queda ({item.dropPct}%)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Valor Parado (Estoque * Custo) */}
                    <td className="p-3 text-right">
                      <span className="font-bold text-white">
                        R$ {item.stagnantValue.toFixed(2)}
                      </span>
                    </td>

                    {/* Status de Giro */}
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>

                    {/* Ações: Criar Oferta & Toggle Promoção */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedOfferProduct(item)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] transition-all cursor-pointer active:scale-95 flex items-center gap-1 shadow-md shadow-amber-500/10"
                        >
                          <Tag className="size-3 text-black" />
                          <span>Criar Oferta</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTogglePromotion(item)}
                          className={`px-2 py-1 rounded-lg font-semibold text-[11px] border transition-colors cursor-pointer ${
                            item.isPromotional
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-white/5 hover:bg-white/10 text-muted-foreground border-white/10"
                          }`}
                          title="Alternar selo EM PROMOÇÃO no produto"
                        >
                          {item.isPromotional ? "Promo Ativa" : "+ Promo"}
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground space-y-2">
                    <PackageSearch className="size-6 mx-auto text-muted-foreground/40" />
                    <p className="text-xs">Nenhum produto encontrado nesta categoria de giro.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ━━━ GRÁFICO DE BARRAS HORIZONTAIS: TOP 10 CAPITAL PARADO ━━━━━━━━━━ */}
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Top 10 Produtos com Maior Capital Parado (R$)
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground">Ordenado por Estoque × Custo Unitário</span>
        </div>

        <div className="space-y-3">
          {top10StagnantCapital.map((prod, idx) => {
            const maxVal = top10StagnantCapital[0]?.stagnantValue || 1;
            const pctWidth = Math.max(5, Math.round((prod.stagnantValue / maxVal) * 100));

            return (
              <div key={prod.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground font-bold w-4 text-right">#{idx + 1}</span>
                    <span className="font-bold text-white truncate">{prod.brand} {prod.name} ({prod.flavor})</span>
                    <span className="text-[10px] text-muted-foreground">({prod.stock} un.)</span>
                  </div>
                  <span className="font-bold text-amber-400 shrink-0">R$ {prod.stagnantValue.toFixed(2)}</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${pctWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Criar Oferta de Queima de Estoque */}
      {selectedOfferProduct && (
        <LiquidationOfferModal
          isOpen={Boolean(selectedOfferProduct)}
          onClose={() => setSelectedOfferProduct(null)}
          product={selectedOfferProduct}
          companyId={companyId}
          onOfferSaved={() => {
            loadPromotions();
            if (onStockUpdated) onStockUpdated();
          }}
        />
      )}

    </div>
  );
};
