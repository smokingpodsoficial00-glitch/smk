import React, { useState, useMemo, useEffect } from "react";
import {
  PackageSearch, Tag, Sparkles, Search, Clock, Box, DollarSign,
  AlertCircle, ChevronRight, CheckCircle2
} from "lucide-react";
import { fetchProductPromotionsMap, updateProductPromotion, type PromoData } from "../lib/productPromotions";
import { LiquidationOfferModal } from "./LiquidationOfferModal";

const STAGNANT_MIN_DAYS = 7; // Regra mínima obrigatória: 7 dias

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

  // Fila de Produtos Parados (>= 7 dias e estoque > 0)
  const stagnantQueue = useMemo(() => {
    const now = new Date().getTime();

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

    // Filtra apenas produtos com estoque > 0 e desconsidera variações vazias/padrão
    const activeProducts = (products || []).filter((p: any) => {
      const stock = parseInt(p.stock) || 0;
      const flavorName = (p.flavor || "").trim().toLowerCase();
      const isPadrao = flavorName === "padrão" || flavorName === "padrao" || flavorName === "";
      return stock > 0 && !isPadrao;
    });

    const stagnantList: any[] = [];

    activeProducts.forEach((p: any) => {
      const pId = p.id;
      const pBrandNorm = (p.brand || "").trim().toLowerCase();
      const pNameNorm = (p.name || "").trim().toLowerCase();
      const pFlavorNorm = (p.flavor || "").trim().toLowerCase();

      // Data de entrada real no catálogo/estoque
      const entryTimestamp = p.created_at ? new Date(p.created_at).getTime() : now;
      const daysSinceCreation = Math.max(0, Math.floor((now - entryTimestamp) / (1000 * 60 * 60 * 24)));

      // REGRA OBRIGATÓRIA: Produto novo com menos de 7 dias NÃO aparece
      if (daysSinceCreation < STAGNANT_MIN_DAYS) {
        return;
      }

      // Buscar última saída/venda deste sabor específico
      let latestSaleTimestamp: number | null = null;
      let totalSold = 0;

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
            totalSold += qty;
            if (latestSaleTimestamp === null || ordTime > latestSaleTimestamp) {
              latestSaleTimestamp = ordTime;
            }
          }
        });
      });

      // Cálculo de Dias Parado:
      // Se nunca vendeu: dias desde a entrada no catálogo
      // Se já teve venda: dias desde a última venda registrada
      let diasParado = 0;
      let nuncaVendido = false;

      if (latestSaleTimestamp === null) {
        diasParado = daysSinceCreation;
        nuncaVendido = true;
      } else {
        diasParado = Math.max(0, Math.floor((now - latestSaleTimestamp) / (1000 * 60 * 60 * 24)));
      }

      // Se o produto vendeu recentemente (< 7 dias), ele está girando normalmente e NÃO entra na fila de parados
      if (diasParado < STAGNANT_MIN_DAYS) {
        return;
      }

      const stock = parseInt(p.stock) || 0;
      const costPrice = parseFloat(p.cost_price) || 0;
      const sellPrice = parseFloat(p.price) || 0;
      const stagnantCapital = stock * costPrice;

      const promoInfo = promotionsMap[p.id];
      const isPromotional = promoInfo ? promoInfo.isPromotional : false;

      const formattedEntryDate = p.created_at
        ? new Date(p.created_at).toLocaleDateString("pt-BR")
        : "—";

      stagnantList.push({
        ...p,
        stock,
        costPrice,
        sellPrice,
        stagnantCapital,
        entryTimestamp,
        formattedEntryDate,
        daysSinceCreation,
        latestSaleTimestamp,
        diasParado,
        nuncaVendido,
        totalSold,
        isPromotional,
        promoData: promoInfo,
      });
    });

    // Ordenação estrita: MAIS TEMPO PARADO → MENOS TEMPO PARADO
    return stagnantList.sort((a, b) => {
      if (b.diasParado !== a.diasParado) {
        return b.diasParado - a.diasParado;
      }
      return a.entryTimestamp - b.entryTimestamp;
    });
  }, [products, orders, promotionsMap]);

  // Filtro por busca (Marca, Modelo ou Sabor)
  const filteredQueue = useMemo(() => {
    if (!searchQuery.trim()) return stagnantQueue;
    const q = searchQuery.toLowerCase().trim();
    return stagnantQueue.filter((item) => {
      const b = (item.brand || "").toLowerCase();
      const n = (item.name || "").toLowerCase();
      const f = (item.flavor || "").toLowerCase();
      return b.includes(q) || n.includes(q) || f.includes(q);
    });
  }, [stagnantQueue, searchQuery]);

  // Totais do cabeçalho
  const totalStagnantProducts = stagnantQueue.length;
  const totalStagnantUnits = stagnantQueue.reduce((sum, item) => sum + item.stock, 0);
  const totalStagnantCapital = stagnantQueue.reduce((sum, item) => sum + item.stagnantCapital, 0);

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
    <div className="space-y-5 animate-in fade-in duration-200">

      {/* ━━━ CABEÇALHO OBJETIVO & CONTADORES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                📦 Produtos Parados
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fila de produtos com 7 dias ou mais sem giro no estoque (ordenados pelo maior tempo parado)
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores Resumidos */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-center min-w-[110px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Produtos na Fila
            </span>
            <span className="text-lg font-extrabold text-amber-400">
              {totalStagnantProducts} <span className="text-xs font-normal text-muted-foreground">sabores</span>
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-center min-w-[110px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Itens em Estoque
            </span>
            <span className="text-lg font-extrabold text-white">
              {totalStagnantUnits} <span className="text-xs font-normal text-muted-foreground">un.</span>
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-center min-w-[110px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Capital Parado
            </span>
            <span className="text-lg font-extrabold text-emerald-400">
              R$ {totalStagnantCapital.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* ━━━ BARRA DE PESQUISA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex items-center justify-between gap-3 bg-[#141414] border border-white/10 rounded-2xl p-3.5">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por marca, modelo ou sabor na fila de parados..."
            className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-amber-400 transition-all"
          />
        </div>
        <div className="text-xs font-medium text-muted-foreground shrink-0 pr-2">
          Mostrando <strong className="text-white">{filteredQueue.length}</strong> de {totalStagnantProducts} produtos
        </div>
      </div>

      {/* ━━━ TABELA PRINCIPAL DE PRODUTOS PARADOS (ORDEM DECRESCENTE) ━━━ */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#141414] custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#181818] border-b border-white/10 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
              <th className="p-3.5">Produto</th>
              <th className="p-3.5">Sabor</th>
              <th className="p-3.5">Entrada no Catálogo</th>
              <th className="p-3.5 text-center">Dias Parado</th>
              <th className="p-3.5 text-center">Estoque</th>
              <th className="p-3.5 text-right">Preço de Venda</th>
              <th className="p-3.5 text-right">Custo Unitário</th>
              <th className="p-3.5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-[#111111]">
            {filteredQueue.map((item, idx) => (
              <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                
                {/* Produto (Imagem + Marca + Modelo) */}
                <td className="p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-bold text-muted-foreground w-4 text-right">#{idx + 1}</span>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="size-9 rounded-lg object-contain bg-black/60 p-0.5 border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="size-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-muted-foreground font-bold text-[10px]">
                        {item.brand?.substring(0, 2) || "POD"}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                        <span>{item.brand} {item.name}</span>
                        {item.isPromotional && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-in fade-in">
                            EM PROMOÇÃO {item.promoData?.discountPct ? `(-${item.promoData.discountPct}%)` : ""}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {item.puffs ? `${item.puffs} puffs` : "Pod"}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Sabor */}
                <td className="p-3.5">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-medium text-xs">
                    {item.flavor}
                  </span>
                </td>

                {/* Data de Entrada no Catálogo */}
                <td className="p-3.5 text-muted-foreground text-[11px]">
                  {item.formattedEntryDate}
                </td>

                {/* Dias Parado (Destaque Principal) */}
                <td className="p-3.5 text-center">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs">
                    {item.diasParado} {item.diasParado === 1 ? "dia" : "dias"} parado
                  </span>
                </td>

                {/* Estoque Atual */}
                <td className="p-3.5 text-center">
                  <span className="font-bold text-white bg-black/50 border border-white/10 px-2 py-0.5 rounded">
                    {item.stock} un.
                  </span>
                </td>

                {/* Preço de Venda (Mostra Preço Normal e Preço Promocional se ativo) */}
                <td className="p-3.5 text-right font-bold">
                  {item.isPromotional && item.promoData?.promoPrice && item.promoData.promoPrice < item.sellPrice ? (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground line-through font-normal">
                        R$ {item.sellPrice.toFixed(2)}
                      </span>
                      <span className="text-emerald-400 text-xs font-bold">
                        R$ {item.promoData.promoPrice.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-white text-xs">
                      R$ {item.sellPrice.toFixed(2)}
                    </span>
                  )}
                </td>

                {/* Custo Unitário */}
                <td className="p-3.5 text-right text-muted-foreground text-xs">
                  {item.costPrice > 0 ? `R$ ${item.costPrice.toFixed(2)}` : "—"}
                </td>

                {/* Ações (Criar Oferta & Encerrar Promoção) */}
                <td className="p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedOfferProduct(item)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 shadow-md shadow-amber-500/10"
                    >
                      <Tag className="size-3.5 text-black" />
                      <span>{item.isPromotional ? "Editar Oferta" : "Criar Oferta"}</span>
                    </button>

                    {item.isPromotional ? (
                      <button
                        type="button"
                        onClick={() => handleTogglePromotion(item)}
                        className="px-2.5 py-1.5 rounded-xl font-semibold text-xs border bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 transition-colors cursor-pointer"
                        title="Encerrar promoção e voltar ao preço normal"
                      >
                        Encerrar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTogglePromotion(item)}
                        className="px-2.5 py-1.5 rounded-xl font-semibold text-xs border bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border-white/10 transition-colors cursor-pointer"
                        title="Ativar promoção rápida (-15%)"
                      >
                        + Promo
                      </button>
                    )}
                  </div>
                </td>

              </tr>
            ))}

            {filteredQueue.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground space-y-2">
                  <PackageSearch className="size-8 mx-auto text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-white">Nenhum produto parado há 7 dias ou mais.</p>
                  <p className="text-xs text-muted-foreground">
                    Todos os produtos em estoque estão com giro ativo ou entraram recentemente no catálogo.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
