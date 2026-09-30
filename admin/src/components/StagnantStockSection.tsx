import React, { useState, useMemo, useEffect } from "react";
import {
  PackageSearch, Tag, Sparkles, Search, Clock, Box, DollarSign,
  AlertCircle, ChevronRight, CheckCircle2, Crown
} from "lucide-react";
import { fetchProductPromotionsMap, updateProductPromotion, type PromoData } from "../lib/productPromotions";
import { LiquidationOfferModal } from "./LiquidationOfferModal";
import { VipGroupOfferModal } from "./VipGroupOfferModal";

const STAGNANT_MIN_DAYS = 7; // Regra mínima obrigatória: 7 dias

const INITIAL_DEMO_ITEMS = [
  {
    id: "demo-1",
    brand: "Ignite",
    name: "V150 15.000 Puffs",
    flavor: "Menta Ice",
    stock: 8,
    costPrice: 60,
    sellPrice: 110,
    stagnantCapital: 480,
    entryTimestamp: Date.now() - 38 * 24 * 60 * 60 * 1000,
    formattedEntryDate: "38 dias atrás",
    daysSinceCreation: 38,
    latestSaleTimestamp: null,
    diasParado: 38,
    nuncaVendido: true,
    totalSold: 0,
    isPromotional: false,
    promoData: null,
    isDemo: true,
  },
  {
    id: "demo-2",
    brand: "Elfbar",
    name: "BC10000 Puffs",
    flavor: "Watermelon Ice",
    stock: 5,
    costPrice: 55,
    sellPrice: 95,
    stagnantCapital: 275,
    entryTimestamp: Date.now() - 24 * 24 * 60 * 60 * 1000,
    formattedEntryDate: "24 dias atrás",
    daysSinceCreation: 24,
    latestSaleTimestamp: null,
    diasParado: 24,
    nuncaVendido: true,
    totalSold: 0,
    isPromotional: true,
    promoData: { isPromotional: true, promoPrice: 80.75, discountPct: 15 },
    isDemo: true,
  },
  {
    id: "demo-3",
    brand: "Oxbar",
    name: "G8000 Puffs",
    flavor: "Strawberry Kiwi",
    stock: 4,
    costPrice: 50,
    sellPrice: 90,
    stagnantCapital: 200,
    entryTimestamp: Date.now() - 15 * 24 * 60 * 60 * 1000,
    formattedEntryDate: "15 dias atrás",
    daysSinceCreation: 15,
    latestSaleTimestamp: null,
    diasParado: 15,
    nuncaVendido: false,
    totalSold: 2,
    isPromotional: false,
    promoData: null,
    isDemo: true,
  },
];

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
  const [selectedVipProduct, setSelectedVipProduct] = useState<any | null>(null);
  const [isDemoActive, setIsDemoActive] = useState(true);
  const [demoItems, setDemoItems] = useState(INITIAL_DEMO_ITEMS);

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

    // Filtra apenas produtos com estoque > 0
    const activeProducts = (products || []).filter((p: any) => {
      const stock = parseInt(p.stock) || 0;
      return stock > 0;
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

  // Fila Efetiva (se a fila real estiver vazia e demo estiver ativo, usa os dados simulados)
  const isSimulated = stagnantQueue.length === 0 && isDemoActive;

  const effectiveQueue = useMemo(() => {
    if (stagnantQueue.length > 0) return stagnantQueue;
    if (isDemoActive) return demoItems;
    return [];
  }, [stagnantQueue, isDemoActive, demoItems]);

  // Filtro por busca (Marca, Modelo ou Sabor)
  const filteredQueue = useMemo(() => {
    if (!searchQuery.trim()) return effectiveQueue;
    const q = searchQuery.toLowerCase().trim();
    return effectiveQueue.filter((item) => {
      const b = (item.brand || "").toLowerCase();
      const n = (item.name || "").toLowerCase();
      const f = (item.flavor || "").toLowerCase();
      return b.includes(q) || n.includes(q) || f.includes(q);
    });
  }, [effectiveQueue, searchQuery]);

  // Totais do cabeçalho
  const totalStagnantProducts = effectiveQueue.length;
  const totalStagnantUnits = effectiveQueue.reduce((sum, item) => sum + item.stock, 0);
  const totalStagnantCapital = effectiveQueue.reduce((sum, item) => sum + item.stagnantCapital, 0);

  // Lista de TODAS as promoções ativas (independente de estar parado ou não)
  const activePromotions = useMemo(() => {
    const promoIds = Object.keys(promotionsMap);
    if (promoIds.length === 0) return [];

    return promoIds.map(pid => {
      const promo = promotionsMap[pid];
      const product = (products || []).find((p: any) => p.id === pid);
      if (!product) return null;

      const stock = parseInt(product.stock) || 0;
      const sellPrice = parseFloat(product.price) || 0;
      const isInStagnantQueue = effectiveQueue.some((item: any) => item.id === pid);

      return {
        ...product,
        stock,
        sellPrice,
        isPromotional: true,
        promoData: promo,
        isInStagnantQueue,
      };
    }).filter(Boolean);
  }, [promotionsMap, products, effectiveQueue]);

  // Alternar Promoção Direta
  const handleTogglePromotion = async (product: any) => {
    if (product.isDemo) {
      setDemoItems((prev) =>
        prev.map((it) => {
          if (it.id === product.id) {
            const newStatus = !it.isPromotional;
            return {
              ...it,
              isPromotional: newStatus,
              promoData: newStatus
                ? { isPromotional: true, promoPrice: Number((it.sellPrice * 0.85).toFixed(2)), discountPct: 15 }
                : null,
            };
          }
          return it;
        })
      );
      return;
    }

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
            <div className="size-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Clock className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                📦 Produtos Parados
                {isSimulated && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/10 text-white/90 border border-white/20">
                    EXEMPLO DEMO
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fila de produtos com 7 dias ou mais sem giro no estoque (ordenados pelo maior tempo parado)
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores Resumidos */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-center min-w-[110px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Produtos na Fila
            </span>
            <span className="text-lg font-extrabold text-white">
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

      {/* Banner de Demonstração para Contas Novas */}
      {stagnantQueue.length === 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-white">Radar de Produtos Parados</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {isDemoActive ? "MODO DEMONSTRAÇÃO ATIVO" : "SIMULAÇÃO OCULTA"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isDemoActive
                  ? "Sua loja ainda não possui produtos sem giro há mais de 7 dias. Exibindo dados simulados para demonstrar o cálculo de capital parado e queima de estoque."
                  : "Modo demonstração desligado. Nenhum produto com mais de 7 dias parado detectado no momento."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDemoActive(!isDemoActive)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer shrink-0"
          >
            {isDemoActive ? "Ocultar Simulação" : "💡 Ver Exemplo de Demonstração"}
          </button>
        </div>
      )}

      {/* ━━━ BARRA DE PESQUISA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#141414] border border-white/10 rounded-2xl p-3.5">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por marca, modelo ou sabor..."
            className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </div>
        <div className="text-xs font-medium text-muted-foreground shrink-0 text-right sm:pr-2">
          Mostrando <strong className="text-white">{filteredQueue.length}</strong> de {totalStagnantProducts} produtos
        </div>
      </div>

      {/* ━━━ OFERTAS EM ANDAMENTO (TODAS AS PROMOÇÕES ATIVAS) ━━━━━━━━━━━ */}
      {activePromotions.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-b border-white/10">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white">
                Ofertas em Andamento
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {activePromotions.length} {activePromotions.length === 1 ? 'ativa' : 'ativas'}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Gerencie todas as promoções ativas do seu catálogo
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {activePromotions.map((item: any) => (
              <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="size-9 rounded-lg object-contain bg-black/60 p-0.5 border border-white/10 shrink-0" />
                  ) : (
                    <div className="size-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-muted-foreground font-bold text-[10px]">
                      {item.brand?.substring(0, 2) || "POD"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                      <span className="truncate">{item.brand} {item.name}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/90 font-medium text-[11px] shrink-0">
                        {item.flavor}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">
                        Estoque: <strong className="text-white">{item.stock} un.</strong>
                      </span>
                      <span className="text-[10px] text-muted-foreground line-through">
                        R$ {item.sellPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400">
                        R$ {(item.promoData?.promoPrice || 0).toFixed(2)}
                        {item.promoData?.discountPct ? ` (-${item.promoData.discountPct}%)` : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-12 sm:pl-0">
                  <button
                    type="button"
                    onClick={() => setSelectedOfferProduct(item)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/15 transition-colors cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePromotion(item)}
                    className="px-3 py-1.5 rounded-xl font-semibold text-xs border bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 transition-colors cursor-pointer"
                    title="Encerrar promoção e voltar ao preço normal"
                  >
                    Encerrar Oferta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ━━━ TABELA PRINCIPAL DE PRODUTOS PARADOS (ORDEM DECRESCENTE) ━━━ */}
      
      {/* DESKTOP: Tabela */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10 bg-[#141414] custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse min-w-[860px]">
          <thead>
            <tr className="bg-[#181818] border-b border-white/10 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
              <th className="p-3 pl-4 min-w-[220px]">Produto</th>
              <th className="p-3 min-w-[190px]">Sabor</th>
              <th className="p-3 text-center min-w-[120px]">Dias Parado</th>
              <th className="p-3 text-center min-w-[80px]">Estoque</th>
              <th className="p-3 text-right min-w-[90px]">Preço</th>
              <th className="p-3 text-right min-w-[85px]">Custo</th>
              <th className="p-3 pr-4 text-center min-w-[150px]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-[#111111]">
            {filteredQueue.map((item, idx) => (
              <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-3 pl-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-muted-foreground w-4 text-right shrink-0">#{idx + 1}</span>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="size-8 rounded-lg object-contain bg-black/60 p-0.5 border border-white/10 shrink-0" />
                    ) : (
                      <div className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-muted-foreground font-bold text-[10px]">
                        {item.brand?.substring(0, 2) || "POD"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                        <span className="truncate">{item.brand} {item.name}</span>
                        {item.isDemo && (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white/90 border border-white/20 shrink-0">DEMO</span>
                        )}
                        {item.isPromotional && (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">PROMO</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{item.puffs ? `${item.puffs} puffs` : "Pod"}</span>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white font-medium text-xs whitespace-nowrap inline-flex items-center">
                    {item.flavor}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90 font-bold text-xs whitespace-nowrap inline-flex items-center justify-center">
                    {item.diasParado} {item.diasParado === 1 ? "dia" : "dias"}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <span className="font-bold text-white">{item.stock} un.</span>
                </td>
                <td className="p-3 text-right font-bold">
                  {item.isPromotional && item.promoData?.promoPrice && item.promoData.promoPrice < item.sellPrice ? (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground line-through font-normal">R$ {item.sellPrice.toFixed(2)}</span>
                      <span className="text-emerald-400 text-xs font-bold">R$ {item.promoData.promoPrice.toFixed(2)}</span>
                    </div>
                  ) : (
                    <span className="text-white text-xs">R$ {item.sellPrice.toFixed(2)}</span>
                  )}
                </td>
                <td className="p-3 text-right text-muted-foreground text-xs">
                  {item.costPrice > 0 ? `R$ ${item.costPrice.toFixed(2)}` : "—"}
                </td>
                <td className="p-3 pr-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedOfferProduct(item)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer active:scale-95 flex items-center gap-1 ${
                        item.isPromotional
                          ? "bg-white/10 hover:bg-white/15 text-white border border-white/15"
                          : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm shadow-emerald-500/20"
                      }`}
                    >
                      <Tag className={`size-3 ${item.isPromotional ? "text-white" : "text-black"}`} />
                      <span>{item.isPromotional ? "Editar" : "Oferta"}</span>
                    </button>
                    {item.isPromotional && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedVipProduct(item)}
                          className="px-2 py-1 rounded-lg font-bold text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                          title="Divulgar oferta no Grupo VIP"
                        >
                          <Crown className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePromotion(item)}
                          className="px-2 py-1 rounded-lg font-semibold text-[11px] border bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 transition-colors cursor-pointer"
                          title="Encerrar promoção"
                        >
                          ✕
                        </button>
                      </>
                    )}
                    {!item.isPromotional && (
                      <button
                        type="button"
                        onClick={() => handleTogglePromotion(item)}
                        className="px-2 py-1 rounded-lg font-semibold text-[11px] border bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border-white/10 transition-colors cursor-pointer"
                        title="Ativar promoção rápida (-15%)"
                      >
                        +Promo
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredQueue.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted-foreground space-y-2">
                  <PackageSearch className="size-7 mx-auto text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-white">Nenhum produto parado há 7 dias ou mais.</p>
                  <p className="text-xs text-muted-foreground">Todos os produtos estão com giro ativo.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE: Cards empilhados */}
      <div className="md:hidden space-y-3">
        {filteredQueue.length === 0 && (
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-8 text-center space-y-2">
            <PackageSearch className="size-7 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-semibold text-white">Nenhum produto parado.</p>
          </div>
        )}
        {filteredQueue.map((item, idx) => (
          <div key={item.id} className="bg-[#141414] border border-white/10 rounded-xl p-4 space-y-3">
            {/* Linha 1: Produto */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-muted-foreground shrink-0">#{idx + 1}</span>
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="size-10 rounded-lg object-contain bg-black/60 p-0.5 border border-white/10 shrink-0" />
              ) : (
                <div className="size-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-muted-foreground font-bold text-[10px]">
                  {item.brand?.substring(0, 2) || "POD"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-white text-sm truncate">{item.brand} {item.name}</div>
                <div className="text-xs text-white/90 font-medium mt-0.5">{item.flavor}</div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90 font-bold text-xs shrink-0 whitespace-nowrap">
                {item.diasParado} {item.diasParado === 1 ? "dia" : "dias"}
              </span>
            </div>
            {/* Linha 2: Métricas */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-black/30 rounded-lg px-2 py-1.5">
                <span className="text-[9px] text-muted-foreground uppercase block">Estoque</span>
                <span className="text-xs font-bold text-white">{item.stock} un.</span>
              </div>
              <div className="bg-black/30 rounded-lg px-2 py-1.5">
                <span className="text-[9px] text-muted-foreground uppercase block">Preço</span>
                {item.isPromotional && item.promoData?.promoPrice ? (
                  <span className="text-xs font-bold text-emerald-400">R$ {item.promoData.promoPrice.toFixed(2)}</span>
                ) : (
                  <span className="text-xs font-bold text-white">R$ {item.sellPrice.toFixed(2)}</span>
                )}
              </div>
              <div className="bg-black/30 rounded-lg px-2 py-1.5">
                <span className="text-[9px] text-muted-foreground uppercase block">Custo</span>
                <span className="text-xs font-bold text-muted-foreground">{item.costPrice > 0 ? `R$ ${item.costPrice.toFixed(2)}` : "—"}</span>
              </div>
            </div>
            {/* Linha 3: Badges + Ações */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {item.isDemo && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white/90 border border-white/20">DEMO</span>
                )}
                {item.isPromotional && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">EM PROMOÇÃO</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedOfferProduct(item)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1 ${
                    item.isPromotional
                      ? "bg-white/10 hover:bg-white/15 text-white border border-white/15"
                      : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm shadow-emerald-500/20"
                  }`}
                >
                  <Tag className={`size-3 ${item.isPromotional ? "text-white" : "text-black"}`} />
                  <span>{item.isPromotional ? "Editar" : "Oferta"}</span>
                </button>
                {item.isPromotional && (
                  <button
                    type="button"
                    onClick={() => handleTogglePromotion(item)}
                    className="px-2.5 py-1.5 rounded-lg font-semibold text-xs border bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 transition-colors cursor-pointer"
                  >
                    Encerrar
                  </button>
                )}
                {!item.isPromotional && (
                  <button
                    type="button"
                    onClick={() => handleTogglePromotion(item)}
                    className="px-2.5 py-1.5 rounded-lg font-semibold text-xs border bg-white/5 hover:bg-white/10 text-muted-foreground border-white/10 transition-colors cursor-pointer"
                  >
                    +Promo
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
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

      {/* Modal Dedicado de Divulgação para o Grupo VIP */}
      {selectedVipProduct && (
        <VipGroupOfferModal
          isOpen={Boolean(selectedVipProduct)}
          onClose={() => setSelectedVipProduct(null)}
          product={selectedVipProduct}
          promoPrice={selectedVipProduct.promoData?.promoPrice || selectedVipProduct.sellPrice * 0.85}
          discountPct={selectedVipProduct.promoData?.discountPct || 15}
          companyId={companyId}
        />
      )}

    </div>
  );
};
