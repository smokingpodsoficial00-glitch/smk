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
  Trophy,
  Flame,
  Award,
  ArrowUpRight,
  ReceiptText,
  FileSpreadsheet,
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
  unit_price?: number;
  costPrice?: number;
  cost_price?: number;
  modelKey?: string;
}

interface ModelProfitItem {
  modelKey: string;
  brand: string;
  name: string;
  unitsSold: number;
  revenue: number;
  totalCost: number;
  profit: number;
  marginPct: number;
  image_url?: string;
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
  const [modelProfits, setModelProfits] = useState<ModelProfitItem[]>([]);

  // Stock Asset State
  const [stockAssetCost, setStockAssetCost] = useState(0);
  const [stockAssetRetail, setStockAssetRetail] = useState(0);
  const [stockAssetUnits, setStockAssetUnits] = useState(0);

  // Tesouraria & Fluxo de Caixa (Marketing & Outros Custos)
  const [marketingSpent, setMarketingSpent] = useState<string>(() => {
    try {
      return localStorage.getItem("smk_mkt_investment") || "0";
    } catch (e) {
      return "0";
    }
  });
  const [isEditingMarketing, setIsEditingMarketing] = useState(false);

  const saveMarketingInvestment = (val: string) => {
    setMarketingSpent(val);
    try {
      localStorage.setItem("smk_mkt_investment", val);
    } catch (e) {}
  };

  const fetchFinanceData = async () => {
    const targetCompanyId = company?.id || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
    try {
      setLoading(true);

      // 1. Carregar Mapa de Custos Persistidos
      const persistedCosts = await fetchProductCostsMap(targetCompanyId).catch(() => ({}));

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
            const pCosts = (persistedCosts || {}) as Record<string, number>;
            const dCosts = (DEFAULT_MODEL_COSTS || {}) as Record<string, number>;
            const brandName = (p.brand || "").trim();
            const modelName = (p.name || "").trim();
            const groupKey = `${brandName.toLowerCase()}__${modelName.toLowerCase()}`;

            let unitCost = Number(p.cost_price) || 0;
            if (!unitCost && p.id && pCosts[p.id]) unitCost = pCosts[p.id];
            if (!unitCost && groupKey && pCosts[groupKey]) unitCost = pCosts[groupKey];
            if (!unitCost && groupKey && dCosts[groupKey]) unitCost = dCosts[groupKey];
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

      // 4. Processar Métricas DRE & Campeões de Venda
      let revenueSum = 0;
      let cmvSum = 0;
      let shippingSum = 0;
      let podsSoldSum = 0;
      const brandMap: Record<string, { count: number; revenue: number }> = {};
      const modelMap: Record<
        string,
        { brand: string; name: string; unitsSold: number; revenue: number; totalCost: number }
      > = {};

      const pCosts = (persistedCosts || {}) as Record<string, number>;
      const dCosts = (DEFAULT_MODEL_COSTS || {}) as Record<string, number>;

      for (const order of validOrders) {
        const orderTotal = parseFloat(order.total_amount || 0);
        const shippingFee = parseFloat(order.shipping_fee || 0);
        revenueSum += orderTotal;
        shippingSum += shippingFee;

        const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          const qty = Number(item.quantity) || 1;
          const brand = (item.brand || "OUTROS").toUpperCase();
          const modelName = (item.name || "POD").toUpperCase();
          const itemPrice = Number(item.price || item.unit_price) || 0;
          const modelKey = (item.modelKey || `${brand}__${modelName}`).toLowerCase();

          // Custo unitário do item
          let itemCost = Number(item.cost_price || item.costPrice) || 0;
          if (!itemCost && item.product_id && pCosts[item.product_id]) {
            itemCost = pCosts[item.product_id];
          }
          if (!itemCost && modelKey && dCosts[modelKey]) {
            itemCost = dCosts[modelKey];
          }
          if (!itemCost) itemCost = 65;

          const itemTotalRevenue = qty * itemPrice;
          const itemTotalCost = qty * itemCost;

          cmvSum += itemTotalCost;
          podsSoldSum += qty;

          // Marca
          if (!brandMap[brand]) {
            brandMap[brand] = { count: 0, revenue: 0 };
          }
          brandMap[brand].count += qty;
          brandMap[brand].revenue += itemTotalRevenue;

          // Modelo
          if (!modelMap[modelKey]) {
            modelMap[modelKey] = {
              brand,
              name: modelName,
              unitsSold: 0,
              revenue: 0,
              totalCost: 0,
            };
          }
          modelMap[modelKey].unitsSold += qty;
          modelMap[modelKey].revenue += itemTotalRevenue;
          modelMap[modelKey].totalCost += itemTotalCost;
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

      // Mapear Campeões de Lucro
      const modelProfitList: ModelProfitItem[] = Object.entries(modelMap).map(([modelKey, data]) => {
        const profit = data.revenue - data.totalCost;
        const marginPct = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
        return {
          modelKey,
          brand: data.brand,
          name: data.name,
          unitsSold: data.unitsSold,
          revenue: data.revenue,
          totalCost: data.totalCost,
          profit,
          marginPct: parseFloat(marginPct.toFixed(1)),
        };
      });

      modelProfitList.sort((a, b) => b.profit - a.profit);
      setModelProfits(modelProfitList);
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

  // Cálculos Seguros de Tesouraria & Fluxo de Caixa
  const numericMarketingSpent = parseFloat(String(marketingSpent || "0").replace(",", ".")) || 0;
  const netCashAvailable = Math.max(0, (grossRevenue || 0) - (logisticsFee || 0) - numericMarketingSpent);
  const realNetProfitPostMarketing = (netProfit || 0) - numericMarketingSpent;
  const totalCompanyEquity = (grossRevenue || 0) + (stockAssetCost || 0);
  const stockAssetProfit = (stockAssetRetail || 0) - (stockAssetCost || 0);

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
            <span>Inteligência Financeira & Estratégia de Vendas</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Métricas de Vendas, Tesouraria, Campeões de Lucro por Pod e DRE Executivo.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
          <div className="size-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Supabase Realtime Conectado</span>
        </div>
      </header>

      {/* ━━━ BLOCO 1: KPIs PRINCIPAIS DE VENDAS REALIZADAS ━━━━━━━━━━━━━━ */}
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
              {formatBRL(realNetProfitPostMarketing)}
            </div>
            <p className="text-xs font-extrabold text-emerald-400 mt-1">
              Margem Líquida Real: {profitMargin}%
            </p>
          </div>

          <div className="pt-2 border-t border-emerald-500/20 text-[10px] text-emerald-300/80 font-medium">
            Fat (R$ {(grossRevenue || 0).toFixed(2)}) - CMV (R$ {(cmv || 0).toFixed(2)}) - Frete (R$ {(logisticsFee || 0).toFixed(2)})
          </div>
        </div>
      </div>

      {/* ━━━ BLOCO 2: GESTÃO UNIFICADA DE TESOURARIA, FLUXO DE CAIXA & ESTOQUE ━━━━━━━━━━━━━━ */}
      <div className="bg-[#121316] border border-amber-500/30 rounded-3xl p-5 sm:p-6 space-y-6 shadow-2xl bg-gradient-to-r from-amber-500/5 via-transparent to-emerald-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Wallet className="size-5 text-amber-400" />
              <span>Gestão de Tesouraria, Fluxo de Caixa & Patrimônio em Estoque</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visão unificada 360° do caixa bancário, investimentos em tráfego e mercadorias na prateleira.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/30">
              ⚡ Tesouraria & Patrimônio
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Saldo Bruto em Conta */}
          <div className="bg-white/5 border border-emerald-500/30 rounded-2xl p-5 space-y-2">
            <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <PiggyBank className="size-4 text-emerald-400" /> Saldo Bruto em Conta (PIX/Caixa)
            </span>
            <div className="text-2xl font-extrabold text-emerald-400">
              {formatBRL(grossRevenue)}
            </div>
            <p className="text-xs text-emerald-300/80">
              Dinheiro bruto total em conta para giro e recompra de estoque.
            </p>
          </div>

          {/* Card 2: Investimento em Marketing (Editável) */}
          <div className="bg-white/5 border border-amber-500/30 rounded-2xl p-5 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-amber-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Megaphone className="size-4" /> Anúncios / Marketing (Meta Ads)
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
                  value={marketingSpent || ""}
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
              <div className="text-2xl font-extrabold text-amber-400">
                {formatBRL(numericMarketingSpent)}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Total investido em anúncios Meta/Insta e tráfego pago.
            </p>
          </div>

          {/* Card 3: Custo dos Pods na Prateleira */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
            <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <Box className="size-4 text-silver" /> Custo dos Pods na Prateleira
            </span>
            <div className="text-2xl font-extrabold text-white">
              {formatBRL(stockAssetCost)}
            </div>
            <p className="text-xs text-muted-foreground">
              Capital imobilizado nos {stockAssetUnits} pods parados no armazém.
            </p>
          </div>

          {/* Card 4: Valor Potencial de Venda */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 space-y-2">
            <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <DollarSign className="size-4 text-emerald-400" /> Valor de Venda do Estoque
            </span>
            <div className="text-2xl font-extrabold text-emerald-400">
              {formatBRL(stockAssetRetail)}
            </div>
            <p className="text-xs text-emerald-400/80">
              Faturamento bruto total se os {stockAssetUnits} pods forem vendidos.
            </p>
          </div>

          {/* Card 5: Lucro Potencial do Estoque */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-2">
            <span className="text-[11px] text-amber-400 uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <TrendingUp className="size-4 text-amber-400" /> Lucro Potencial do Estoque
            </span>
            <div className="text-2xl font-extrabold text-amber-400">
              {formatBRL(stockAssetProfit)}
            </div>
            <p className="text-xs text-amber-300/80">
              Lucro bruto futuro ao zerar os {stockAssetUnits} pods parados.
            </p>
          </div>

          {/* Card 6: Patrimônio Total da Empresa */}
          <div className="bg-gradient-to-br from-emerald-500/20 to-amber-500/20 border border-emerald-400/40 rounded-2xl p-5 space-y-2">
            <span className="text-[11px] text-emerald-300 uppercase font-extrabold tracking-wider block flex items-center gap-1.5">
              <Landmark className="size-4 text-emerald-400" /> Patrimônio Total da Loja
            </span>
            <div className="text-2xl font-black text-emerald-300">
              {formatBRL(totalCompanyEquity)}
            </div>
            <p className="text-xs text-emerald-200/80 font-medium">
              Caixa em Conta ({formatBRL(grossRevenue)}) + Custo do Estoque ({formatBRL(stockAssetCost)})
            </p>
          </div>
        </div>
      </div>

      {/* ━━━ BLOCO 3: 🏆 CAMPEÕES DE VENDA & ANÁLISE DE LUCRO POR POD (SEÇÃO ESTRATÉGICA) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#121316] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Trophy className="size-5 text-amber-400" />
              <span>Campeões de Venda & Lucro por Produto (Direcionador Estratégico)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Descubra exatamente quais modelos geram maior lucro líquido para direcionar seus investimentos de tráfego.
            </p>
          </div>
          <span className="text-xs font-bold bg-amber-500/10 text-amber-400 px-3 py-1 rounded-xl border border-amber-500/30 self-start sm:self-auto">
            🔥 Estratégia de Crescimento
          </span>
        </div>

        {modelProfits.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center italic">
            Nenhuma venda registrada ainda para calcular o ranking estratégico.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modelProfits.map((item, idx) => (
              <div
                key={item.modelKey}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 hover:border-amber-500/40 transition-all relative"
              >
                {/* Badge de Posição */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                    {idx === 0 ? "🥇 1º Lugar" : idx === 1 ? "🥈 2º Lugar" : idx === 2 ? "🥉 3º Lugar" : `#${idx + 1}`}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Margem: {item.marginPct}%
                  </span>
                </div>

                {/* Nome do Produto */}
                <div>
                  <h4 className="font-extrabold text-sm text-white">
                    {item.brand} {item.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {item.unitsSold} {item.unitsSold === 1 ? "unidade vendida" : "unidades vendidas"}
                  </p>
                </div>

                {/* Métricas de Lucro */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-[10px] text-silver font-medium block">Receita Gerada</span>
                    <span className="font-bold text-white">{formatBRL(item.revenue)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-400 font-medium block">Lucro Gerado</span>
                    <span className="font-extrabold text-emerald-400">{formatBRL(item.profit)}</span>
                  </div>
                </div>

                {/* Recomendação Estratégica */}
                <div className="pt-2 border-t border-white/10 text-[10px] text-amber-300/90 font-semibold flex items-center gap-1">
                  <Flame className="size-3.5 text-amber-400 shrink-0" />
                  <span>
                    {item.marginPct > 20 ? "🔥 Alta Margem - Escalar Tráfego Pago" : "⭐ Produto Relevante no Volume"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ━━━ BLOCO 4: DEMONSTRATIVO DE RESULTADO (DRE EXECUTIVO EM TABELA LIMPA) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#121316] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-emerald-400" />
              <span>Demonstrativo DRE Executivo de Vendas</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estrutura financeira oficial de apuração do Lucro Líquido Real.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 self-start sm:self-auto">
            {totalOrders} Pedidos Validados
          </span>
        </div>

        {/* Tabela DRE Executiva */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-muted-foreground font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Item da Demonstração (DRE)</th>
                <th className="py-3 px-4 text-right">Valor Total (R$)</th>
                <th className="py-3 px-4 text-right">% da Receita</th>
                <th className="py-3 px-4">Indicador / Descrição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 font-medium">
              {/* Line 1: Faturamento Bruto */}
              <tr className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                  <div className="size-2 rounded-full bg-emerald-400" />
                  <span>🟢 Faturamento Bruto Real</span>
                </td>
                <td className="py-3.5 px-4 text-right font-extrabold text-emerald-400 text-sm">
                  {formatBRL(grossRevenue)}
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-emerald-400">100.0%</td>
                <td className="py-3.5 px-4 text-muted-foreground">Total bruto faturado nos {totalOrders} pedidos</td>
              </tr>

              {/* Line 2: CMV */}
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-3.5 px-4 font-bold text-silver flex items-center gap-2">
                  <div className="size-2 rounded-full bg-red-400" />
                  <span>🔴 (-) Custo de Reposição (CMV)</span>
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-red-400">
                  -{formatBRL(cmv)}
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-red-400">
                  {grossRevenue > 0 ? ((cmv / grossRevenue) * 100).toFixed(1) : 0}%
                </td>
                <td className="py-3.5 px-4 text-muted-foreground">Custo de aquisição pago ao fornecedor pelos pods</td>
              </tr>

              {/* Line 3: Frete / Logística */}
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-3.5 px-4 font-bold text-silver flex items-center gap-2">
                  <div className="size-2 rounded-full bg-amber-400" />
                  <span>🟧 (-) Logística & Entregas</span>
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-amber-400">
                  -{formatBRL(logisticsFee)}
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-amber-400">
                  {grossRevenue > 0 ? ((logisticsFee / grossRevenue) * 100).toFixed(1) : 0}%
                </td>
                <td className="py-3.5 px-4 text-muted-foreground">Taxas registradas de envio aos clientes</td>
              </tr>

              {/* Line 4: Marketing */}
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-3.5 px-4 font-bold text-silver flex items-center gap-2">
                  <div className="size-2 rounded-full bg-amber-500" />
                  <span>🟡 (-) Anúncios / Marketing (Tráfego)</span>
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-amber-300">
                  -{formatBRL(numericMarketingSpent)}
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-amber-300">
                  {grossRevenue > 0 ? ((numericMarketingSpent / grossRevenue) * 100).toFixed(1) : 0}%
                </td>
                <td className="py-3.5 px-4 text-muted-foreground">Investimento em anúncios no Meta/Instagram</td>
              </tr>

              {/* Line 5: LUCRO LÍQUIDO REAL */}
              <tr className="bg-emerald-500/10 border-t-2 border-emerald-500/40 hover:bg-emerald-500/20 transition-colors">
                <td className="py-4 px-4 font-black text-emerald-300 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-400" />
                  <span>(=) LUCRO LÍQUIDO REAL EMBOLSADO</span>
                </td>
                <td className="py-4 px-4 text-right font-black text-emerald-300 text-base">
                  {formatBRL(realNetProfitPostMarketing)}
                </td>
                <td className="py-4 px-4 text-right font-black text-emerald-300 text-sm">
                  {profitMargin}%
                </td>
                <td className="py-4 px-4 font-bold text-emerald-400">
                  Lucro líquido real final após todos os custos
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
