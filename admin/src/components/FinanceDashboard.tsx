import { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Truck,
  Box,
  Loader2,
  PieChart,
  ShoppingBag,
  Layers,
  Sparkles,
  Wallet,
  Megaphone,
  Landmark,
  PiggyBank,
  Check,
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { fetchProductCostsMap } from "../lib/productCosts";

interface OrderItem {
  id?: string;
  product_id?: string;
  name?: string;
  brand?: string;
  flavor?: string;
  quantity?: number;
  price?: number;
  costPrice?: number;
  cost_price?: number;
  modelKey?: string;
}

const DEFAULT_MODEL_COSTS: Record<string, number> = {
  "elfbar__ice king": 70,
  "lost mary__dura 35k": 65,
  "elfbar__bc15k": 48,
  "oxbar__50k": 65,
  "oxbar__g30k pro": 58,
  "ignite__v50": 65,
  "ignite__v80 ultra slim": 55,
  "ignite__frozen 20k": 65,
  "ignite__v250": 68,
  "elfbar__duke": 70,
  "elfbar__te30k": 65,
};

export function FinanceDashboard() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);

  // Financial Metrics State
  const [grossRevenue, setGrossRevenue] = useState(0);
  const [cmv, setCmv] = useState(0);
  const [logisticsFee, setLogisticsFee] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [profitMargin, setProfitMargin] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPodsSold, setTotalPodsSold] = useState(0);
  const [brandSales, setBrandSales] = useState<Array<{ brand: string; count: number; revenue: number }>>([]);

  // Stock Asset State
  const [stockAssetCost, setStockAssetCost] = useState(0);
  const [stockAssetRetail, setStockAssetRetail] = useState(0);
  const [stockAssetUnits, setStockAssetUnits] = useState(0);

  // Tesouraria & Fluxo de Caixa (Marketing & Outros Custos)
  const [marketingSpent, setMarketingSpent] = useState<string>(() => {
    return localStorage.getItem("smk_mkt_investment") || "0";
  });
  const [isEditingMarketing, setIsEditingMarketing] = useState(false);

  const saveMarketingInvestment = (val: string) => {
    setMarketingSpent(val);
    localStorage.setItem("smk_mkt_investment", val);
  };

  const fetchFinanceData = async () => {
    const targetCompanyId = company?.id || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
    try {
      setLoading(true);

      // 1. Carregar Mapa de Custos Persistidos
      const persistedCosts = await fetchProductCostsMap(targetCompanyId);

      // 2. Carregar Pedidos Reais de Clientes
      const { data: rawOrders } = await supabase
        .from("smoking_orders")
        .select("*")
        .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
        .neq("delivery_status", "CANCELADO");

      const validOrders = (rawOrders || []).filter(
        (o) =>
          o.client_phone !== "__SYSTEM_SMK_BEST_SELLERS__" &&
          (!o.client_phone || !o.client_phone.startsWith("__SYSTEM_")) &&
          (!o.client_name || !o.client_name.toLowerCase().includes("system config"))
      );

      // 3. Carregar Produtos Ativos em Estoque
      const { data: productsData } = await supabase
        .from("smoking_products")
        .select("*")
        .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
        .eq("is_active", true);

      let totalStockCostSum = 0;
      let totalStockRetailSum = 0;
      let totalUnitsSum = 0;

      if (productsData) {
        for (const p of productsData) {
          const stock = Number(p.stock) || 0;
          const price = Number(p.price) || 0;

          // Exclui linhas fantasma de "Padrão" zeradas do cálculo
          const flavorName = (p.flavor || "").trim().toLowerCase();
          const isPadrao = flavorName === "padrão" || flavorName === "padrao" || flavorName === "";

          if (stock > 0 && !isPadrao) {
            const brandName = (p.brand || "").trim();
            const modelName = (p.name || "").trim();
            const groupKey = `${brandName.toLowerCase()}__${modelName.toLowerCase()}`;

            let unitCost = Number(p.cost_price) || 0;
            if (!unitCost && persistedCosts[p.id]) unitCost = persistedCosts[p.id];
            if (!unitCost && persistedCosts[groupKey]) unitCost = persistedCosts[groupKey];
            if (!unitCost && DEFAULT_MODEL_COSTS[groupKey]) unitCost = DEFAULT_MODEL_COSTS[groupKey];
            if (!unitCost) unitCost = 65; // Custo médio padrão

            totalStockCostSum += stock * unitCost;
            totalStockRetailSum += stock * price;
            totalUnitsSum += stock;
          }
        }
      }

      setStockAssetCost(totalStockCostSum);
      setStockAssetRetail(totalStockRetailSum);
      setStockAssetUnits(totalUnitsSum);

      // 4. Processar Métricas DRE com Dados Reais
      let revenueSum = 0;
      let cmvSum = 0;
      let shippingSum = 0;
      let podsSoldSum = 0;
      const brandMap: Record<string, { count: number; revenue: number }> = {};

      for (const order of validOrders) {
        const orderTotal = parseFloat(order.total_amount || 0);
        const shippingFee = parseFloat(order.shipping_fee || 0);
        revenueSum += orderTotal;
        shippingSum += shippingFee;

        const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          const qty = Number(item.quantity) || 1;
          const brand = (item.brand || "Outros").toUpperCase();
          const itemPrice = Number(item.price || item.unit_price) || 0;
          const modelKey = (item.modelKey || `${item.brand || ""}__${item.name || ""}`).toLowerCase();

          // Custo unitário do item
          let itemCost = Number(item.cost_price || item.costPrice) || 0;
          if (!itemCost && item.product_id && persistedCosts[item.product_id]) {
            itemCost = persistedCosts[item.product_id];
          }
          if (!itemCost && modelKey && DEFAULT_MODEL_COSTS[modelKey]) {
            itemCost = DEFAULT_MODEL_COSTS[modelKey];
          }
          if (!itemCost) itemCost = 65;

          cmvSum += qty * itemCost;
          podsSoldSum += qty;

          if (!brandMap[brand]) {
            brandMap[brand] = { count: 0, revenue: 0 };
          }
          brandMap[brand].count += qty;
          brandMap[brand].revenue += qty * itemPrice;
        }
      }

      // Lucro Líquido Real = Faturamento Bruto - Custo CMV - Frete/Logística Gasta
      const net = revenueSum - cmvSum - shippingSum;
      const margin = revenueSum > 0 ? (net / revenueSum) * 100 : 0;

      setGrossRevenue(revenueSum);
      setCmv(cmvSum);
      setLogisticsFee(shippingSum);
      setNetProfit(net);
      setProfitMargin(parseFloat(margin.toFixed(1)));
      setTotalOrders(validOrders.length);
      setTotalPodsSold(podsSoldSum);

      const brandList = Object.entries(brandMap).map(([brand, data]) => ({
        brand,
        count: data.count,
        revenue: data.revenue,
      }));
      setBrandSales(brandList);
    } catch (err) {
      console.error("Erro ao calcular inteligência financeira:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();

    const subOrders = supabase
      .channel("finance_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_orders" }, fetchFinanceData)
      .subscribe();

    return () => {
      supabase.removeChannel(subOrders);
    };
  }, [company?.id]);

  // Cálculos do Fluxo de Caixa / Tesouraria
  const numericMarketingSpent = parseFloat(marketingSpent.replace(",", ".")) || 0;
  const netCashAvailable = Math.max(0, grossRevenue - logisticsFee - numericMarketingSpent);
  const realNetProfitPostMarketing = netProfit - numericMarketingSpent;
  const totalCompanyEquity = netCashAvailable + stockAssetCost;
  const stockAssetProfit = stockAssetRetail - stockAssetCost;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background min-h-screen">
        <Loader2 className="size-8 text-emerald-400 animate-spin mb-2" />
        <p className="text-xs text-muted-foreground">Carregando Inteligência Financeira...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 space-y-6 text-white custom-scrollbar">
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="size-6 text-emerald-400" />
            <span>Inteligência Financeira & Fluxo de Caixa</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            DRE em tempo real, Tesouraria, Investimentos em Marketing e Patrimônio Global da Empresa.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
          <div className="size-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Supabase Realtime Conectado</span>
        </div>
      </header>

      {/* ━━━ BLOCO 1: KPIs PRINCIPAIS DE VENDAS REALIZADAS (DRE) ━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Faturamento Bruto Real */}
        <div className="bg-[#121316] border border-emerald-500/30 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-lg hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Faturamento Bruto Real
            </span>
            <div className="size-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="size-5" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {formatBRL(grossRevenue)}
            </div>
            <p className="text-xs font-medium text-white/70 mt-1 flex items-center gap-1.5">
              <ShoppingBag className="size-3.5 text-emerald-400" />
              <span>{totalOrders} pedidos ({totalPodsSold} pods vendidos)</span>
            </p>
          </div>

          {/* Marcas vendidas */}
          {brandSales.length > 0 && (
            <div className="pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
              {brandSales.map((b) => (
                <span
                  key={b.brand}
                  className="text-[10px] font-bold bg-white/5 border border-white/10 text-emerald-300 px-2 py-0.5 rounded-full"
                >
                  {b.brand}: {b.count} un
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 2. Custo de Reposição (CMV) */}
        <div className="bg-[#121316] border border-red-500/30 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-lg hover:border-red-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Custo Reposição (CMV)
            </span>
            <div className="size-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <TrendingDown className="size-5" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-red-400">
              {formatBRL(cmv)}
            </div>
            <p className="text-xs font-medium text-red-300/80 mt-1">
              {grossRevenue > 0 ? ((cmv / grossRevenue) * 100).toFixed(1) : 0}% do faturamento em reposição
            </p>
          </div>

          <div className="pt-2 border-t border-white/10 text-[10px] text-muted-foreground">
            Custo pago ao fornecedor pelos {totalPodsSold} pods vendidos
          </div>
        </div>

        {/* 3. Logística & Frete */}
        <div className="bg-[#121316] border border-amber-500/30 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-lg hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Frete Total (Logística)
            </span>
            <div className="size-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Truck className="size-5" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
              {formatBRL(logisticsFee)}
            </div>
            <p className="text-xs font-medium text-amber-300/80 mt-1">
              Total registrado nas entregas efetuadas
            </p>
          </div>

          <div className="pt-2 border-t border-white/10 text-[10px] text-muted-foreground">
            Fretes cobrados/gastos na expedição dos pedidos
          </div>
        </div>

        {/* 4. Lucro Líquido Real */}
        <div className="bg-[#121316] border border-emerald-400/50 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl bg-gradient-to-b from-emerald-500/10 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider">
              Lucro Líquido Real
            </span>
            <div className="size-9 rounded-xl bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center text-emerald-300">
              <TrendingUp className="size-5" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-300">
              {formatBRL(netProfit)}
            </div>
            <p className="text-xs font-extrabold text-emerald-400 mt-1">
              Margem Líquida Real: {profitMargin}%
            </p>
          </div>

          <div className="pt-2 border-t border-emerald-500/20 text-[10px] text-emerald-300/80 font-medium">
            Faturamento (R$ {grossRevenue.toFixed(2)}) - CMV (R$ {cmv.toFixed(2)}) - Frete (R$ {logisticsFee.toFixed(2)})
          </div>
        </div>
      </div>

      {/* ━━━ BLOCO 2: FLUXO DE CAIXA & TESOURARIA EXECUTIVA (NOVO!) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#121316] border border-amber-500/30 rounded-3xl p-5 sm:p-6 space-y-6 shadow-2xl bg-gradient-to-r from-amber-500/5 via-transparent to-emerald-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Wallet className="size-5 text-amber-400" />
              <span>Gestão de Tesouraria & Fluxo de Caixa Real</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visão 360° do dinheiro disponível em caixa, investimento em marketing e patrimônio imobilizado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/30">
              ⚡ Caixa & Investimentos
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Dinheiro em Caixa Livre */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <PiggyBank className="size-4 text-emerald-400" /> Caixa Livre Acumulado
            </span>
            <div className="text-xl font-extrabold text-emerald-400">
              {formatBRL(netCashAvailable)}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Bruto Recebido das vendas (-) Fretes e (-) Marketing investido.
            </p>
          </div>

          {/* Card 2: Investimento em Marketing (Editável) */}
          <div className="bg-white/5 border border-amber-500/30 rounded-2xl p-4 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-amber-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Megaphone className="size-4" /> Anúncios / Marketing
              </span>
              <button
                type="button"
                onClick={() => setIsEditingMarketing(!isEditingMarketing)}
                className="text-[10px] text-amber-400 hover:underline font-bold"
              >
                {isEditingMarketing ? "Salvar" : "Editar"}
              </button>
            </div>

            {isEditingMarketing ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={marketingSpent}
                  onChange={(e) => saveMarketingInvestment(e.target.value)}
                  placeholder="Ex: 50.00"
                  className="w-full bg-black/60 border border-amber-500/50 rounded-xl px-2.5 py-1 text-xs font-bold text-amber-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingMarketing(false)}
                  className="p-1.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                >
                  <Check className="size-3.5" />
                </button>
              </div>
            ) : (
              <div className="text-xl font-extrabold text-amber-400">
                {formatBRL(numericMarketingSpent)}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Total investido em anúncios Meta/Insta e tráfego pago.
            </p>
          </div>

          {/* Card 3: Custo do Estoque Parado */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <Box className="size-4 text-silver" /> Capital no Estoque
            </span>
            <div className="text-xl font-extrabold text-white">
              {formatBRL(stockAssetCost)}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Valor pago ao fornecedor pelos {stockAssetUnits} pods parados.
            </p>
          </div>

          {/* Card 4: Patrimônio Total da Empresa */}
          <div className="bg-gradient-to-br from-emerald-500/20 to-amber-500/20 border border-emerald-400/40 rounded-2xl p-4 space-y-2">
            <span className="text-[11px] text-emerald-300 uppercase font-extrabold tracking-wider block flex items-center gap-1.5">
              <Landmark className="size-4 text-emerald-400" /> Patrimônio Total Loja
            </span>
            <div className="text-xl font-black text-emerald-300">
              {formatBRL(totalCompanyEquity)}
            </div>
            <p className="text-[10px] text-emerald-200/80 font-medium">
              Caixa Livre ({formatBRL(netCashAvailable)}) + Custo do Estoque ({formatBRL(stockAssetCost)})
            </p>
          </div>
        </div>
      </div>

      {/* ━━━ BLOCO 3: DETALHAMENTO DRE VISUAL + PATRIMÔNIO EM ESTOQUE ━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Detalhamento DRE (Real) */}
        <div className="lg:col-span-2 bg-[#121316] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="size-5 text-emerald-400" />
                <span>Detalhamento DRE de Vendas (Real)</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Decomposição visual de onde foi cada centavo faturado nas vendas.
              </p>
            </div>
            <span className="text-xs font-bold bg-white/5 px-3 py-1 rounded-xl border border-white/10">
              {totalPodsSold} pods vendidos
            </span>
          </div>

          <div className="space-y-4">
            {/* Faturamento Bruto (100%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-white">Faturamento Bruto (100%)</span>
                <span className="text-emerald-400">{formatBRL(grossRevenue)}</span>
              </div>
              <div className="h-6 w-full bg-black/60 rounded-xl overflow-hidden p-1 border border-white/10">
                <div className="h-full bg-emerald-500 rounded-lg w-full" />
              </div>
            </div>

            {/* Custo de Reposição CMV */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-silver">
                  Custo de Reposição CMV ({grossRevenue > 0 ? ((cmv / grossRevenue) * 100).toFixed(1) : 0}%)
                </span>
                <span className="text-red-400">-{formatBRL(cmv)}</span>
              </div>
              <div className="h-6 w-full bg-black/60 rounded-xl overflow-hidden p-1 border border-white/10">
                <div
                  className="h-full bg-red-500 rounded-lg transition-all"
                  style={{
                    width: `${Math.min(100, grossRevenue > 0 ? (cmv / grossRevenue) * 100 : 0)}%`,
                  }}
                />
              </div>
            </div>

            {/* Frete / Logística */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-silver">
                  Frete & Logística ({grossRevenue > 0 ? ((logisticsFee / grossRevenue) * 100).toFixed(1) : 0}%)
                </span>
                <span className="text-amber-400">-{formatBRL(logisticsFee)}</span>
              </div>
              <div className="h-6 w-full bg-black/60 rounded-xl overflow-hidden p-1 border border-white/10">
                <div
                  className="h-full bg-amber-500 rounded-lg transition-all"
                  style={{
                    width: `${Math.min(100, grossRevenue > 0 ? (logisticsFee / grossRevenue) * 100 : 0)}%`,
                  }}
                />
              </div>
            </div>

            {/* Lucro Líquido Real */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-sm font-extrabold">
                <span className="text-emerald-400">LUCRO LÍQUIDO REAL ({profitMargin}%)</span>
                <span className="text-emerald-400">{formatBRL(netProfit)}</span>
              </div>
              <div className="h-8 w-full bg-black/60 rounded-xl overflow-hidden p-1 border border-emerald-500/30">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-lg transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, profitMargin))}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card Direita: PATRIMÔNIO EM ESTOQUE (13 Pods na Prateleira) */}
        <div className="bg-[#121316] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Box className="size-5 text-amber-400" />
                <span>Patrimônio em Estoque</span>
              </h3>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {stockAssetUnits} pods na prateleira
              </span>
            </div>

            {/* Custo Total de Reposição do Estoque Actual */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider block">
                Custo dos Pods na Prateleira
              </span>
              <div className="text-xl font-bold text-white">
                {formatBRL(stockAssetCost)}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Capital total pago pelos {stockAssetUnits} pods parados no armazém.
              </p>
            </div>

            {/* Valor Potencial de Venda */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider block">
                Valor de Venda do Estoque
              </span>
              <div className="text-xl font-extrabold text-emerald-400">
                {formatBRL(stockAssetRetail)}
              </div>
              <p className="text-[10px] text-emerald-400/80">
                Faturamento bruto total se os {stockAssetUnits} pods forem vendidos.
              </p>
            </div>

            {/* Lucro Potencial Futuro */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] text-amber-400 uppercase font-bold tracking-wider block">
                Lucro Potencial do Estoque
              </span>
              <div className="text-xl font-extrabold text-amber-400">
                {formatBRL(stockAssetProfit)}
              </div>
              <p className="text-[10px] text-amber-300/80">
                Lucro bruto futuro ao zerar as {stockAssetUnits} unidades em estoque.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 text-center">
            <span className="text-[11px] text-muted-foreground font-medium">
              💡 Os números de estoque medem a prateleira. O DRE mede as vendas efetuadas.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
