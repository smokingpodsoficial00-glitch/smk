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
  Target,
  Percent,
  BarChart3,
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
        const shippingFee = parseFloat(order.shipping_fee || 0);
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

          // Faturamento Bruto Real calcula estritamente a receita dos pods (sem o frete)
          revenueSum += itemTotalRevenue;
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

      // Lucro Líquido Real = Faturamento dos Pods (Sem Frete) - Custo CMV
      const net = revenueSum - cmvSum;
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
  
  // Patrimônio Real Total da Loja = Caixa em Conta + Valor de Venda do Estoque (Custo dos Pods + Lucro Potencial)
  const totalCompanyEquity = (grossRevenue || 0) + (stockAssetRetail || 0);
  const stockAssetProfit = (stockAssetRetail || 0) - (stockAssetCost || 0);

  // Métricas de Eficiência Comercial & Ticket Médio
  const averageTicket = totalOrders > 0 ? grossRevenue / totalOrders : 0;
  const averageNetProfitPerOrder = totalOrders > 0 ? realNetProfitPostMarketing / totalOrders : 0;
  const averageNetMarginPercent = grossRevenue > 0 ? (realNetProfitPostMarketing / grossRevenue) * 100 : 0;
  const averagePricePerPod = totalPodsSold > 0 ? grossRevenue / totalPodsSold : 0;

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
        {/* 1. Faturamento Bruto Real (Sem o Frete) */}
        <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-lg hover:border-white/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
              Faturamento Bruto Real (Sem o Frete)
            </span>
            <div className="size-9 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center text-white">
              <DollarSign className="size-5" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {formatBRL(grossRevenue)}
            </div>
            <p className="text-xs font-medium text-white/60 mt-1 flex items-center gap-1.5">
              <ShoppingBag className="size-3.5 text-white/60" />
              <span>{totalOrders} pedidos ({totalPodsSold} pods vendidos)</span>
            </p>
          </div>

          {/* Marcas vendidas */}
          {brandSales.length > 0 && (
            <div className="pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
              {brandSales.map((b) => (
                <span
                  key={b.brand}
                  className="text-[10px] font-semibold bg-white/5 border border-white/10 text-white/80 px-2 py-0.5 rounded-full"
                >
                  {b.brand}: {b.count} un
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 2. Custo de Reposição (CMV) */}
        <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-lg hover:border-white/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
              Custo Reposição (CMV)
            </span>
            <div className="size-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <TrendingDown className="size-5" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-red-400">
              {formatBRL(cmv)}
            </div>
            <p className="text-xs font-medium text-white/50 mt-1">
              {grossRevenue > 0 ? ((cmv / grossRevenue) * 100).toFixed(1) : 0}% do faturamento em reposição
            </p>
          </div>

          <div className="pt-2 border-t border-white/10 text-[10px] text-white/40">
            Custo pago ao fornecedor pelos {totalPodsSold} pods vendidos
          </div>
        </div>

        {/* 3. Logística & Frete */}
        <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-lg hover:border-white/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
              Frete Total (Logística)
            </span>
            <div className="size-9 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center text-white/80">
              <Truck className="size-5" />
            </div>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {formatBRL(logisticsFee)}
            </div>
            <p className="text-xs font-medium text-white/50 mt-1">
              Total registrado nas entregas efetuadas
            </p>
          </div>

          <div className="pt-2 border-t border-white/10 text-[10px] text-white/40">
            Fretes cobrados/gastos na expedição dos pedidos
          </div>
        </div>

        {/* 4. Lucro Líquido Real */}
        <div className="bg-[#0e0e10] border border-emerald-500/40 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl bg-gradient-to-b from-emerald-500/5 to-transparent hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider">
              Lucro Líquido Real
            </span>
            <div className="size-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
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

          <div className="pt-2 border-t border-white/10 text-[10px] text-white/40 font-medium">
            Fat. Pods (R$ {(grossRevenue || 0).toFixed(2)}) - CMV (R$ {(cmv || 0).toFixed(2)})
          </div>
        </div>
      </div>

      {/* ━━━ BLOCO DEDICADO: 🎯 EFICIÊNCIA COMERCIAL, TICKET MÉDIO & MARGENS MÉDIAS ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl hover:border-white/25 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="size-5 text-white" />
              <span>Eficiência Comercial, Ticket Médio & Margens Médias por Venda</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Análise dinâmica de valor médio por carrinho, lucro limpo gerado por pedido e margem média líquida real.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white bg-white/10 px-3 py-1 rounded-xl border border-white/15">
              ⚡ Métricas por Pedido
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Ticket Médio por Pedido */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <ReceiptText className="size-4 text-white/70" /> Ticket Médio por Pedido
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {formatBRL(averageTicket)}
            </div>
            <p className="text-xs text-white/50">
              Valor médio gasto por cliente a cada compra realizada.
            </p>
            <div className="pt-2 border-t border-white/10 text-[10px] text-white/40 font-medium">
              Faturamento Bruto ({formatBRL(grossRevenue)}) ÷ {totalOrders} pedidos
            </div>
          </div>

          {/* Card 2: Margem Média Líquida (%) */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Percent className="size-4 text-emerald-400" /> Margem Média Líquida
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {averageNetMarginPercent.toFixed(1)}%
            </div>
            <p className="text-xs text-white/50">
              Porcentagem líquida que sobra limpa no bolso de cada venda.
            </p>
            <div className="pt-2 border-t border-white/10 text-[10px] text-emerald-400/70 font-medium">
              Lucro Líquido Real ÷ Faturamento Bruto
            </div>
          </div>

          {/* Card 3: Lucro Médio Líquido por Pedido */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <TrendingUp className="size-4 text-emerald-400" /> Lucro Líquido por Pedido
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300">
              {formatBRL(averageNetProfitPerOrder)}
            </div>
            <p className="text-xs text-white/50">
              Ganho líquido médio embolsado a cada checkout finalizado.
            </p>
            <div className="pt-2 border-t border-white/10 text-[10px] text-emerald-400/70 font-medium">
              Lucro Líquido ({formatBRL(realNetProfitPostMarketing)}) ÷ {totalOrders} pedidos
            </div>
          </div>

          {/* Card 4: Ticket Médio por Pod Vendido */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Box className="size-4 text-white/70" /> Preço Médio por Pod
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {formatBRL(averagePricePerPod)}
            </div>
            <p className="text-xs text-white/50">
              Preço médio de venda praticado por unidade entregue.
            </p>
            <div className="pt-2 border-t border-white/10 text-[10px] text-white/40 font-medium">
              Faturamento ({formatBRL(grossRevenue)}) ÷ {totalPodsSold} pods
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ BLOCO 2: GESTÃO UNIFICADA DE TESOURARIA, FLUXO DE CAIXA & ESTOQUE ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl hover:border-white/25 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Wallet className="size-5 text-white" />
              <span>Gestão de Tesouraria, Fluxo de Caixa & Patrimônio em Estoque</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Visão unificada 360° do caixa bancário, investimentos em tráfego e mercadorias na prateleira.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white bg-white/10 px-3 py-1 rounded-xl border border-white/15">
              ⚡ Tesouraria & Patrimônio
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Saldo Bruto em Conta */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <PiggyBank className="size-4 text-white" /> Saldo Bruto em Conta (PIX/Caixa)
            </span>
            <div className="text-2xl font-extrabold text-white">
              {formatBRL(grossRevenue)}
            </div>
            <p className="text-xs text-white/50">
              Dinheiro bruto total em conta para giro e recompra de estoque.
            </p>
          </div>

          {/* Card 2: Investimento em Marketing (Editável) */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 relative hover:border-white/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Megaphone className="size-4 text-white/70" /> Anúncios / Marketing (Meta Ads)
              </span>
              <button
                type="button"
                onClick={() => setIsEditingMarketing(!isEditingMarketing)}
                className="text-[10px] text-white/80 hover:text-white hover:underline font-bold"
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
                  className="w-full bg-black/60 border border-white/30 rounded-xl px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-white/50"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingMarketing(false)}
                  className="p-1.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors"
                >
                  <Check className="size-3.5" />
                </button>
              </div>
            ) : (
              <div className="text-2xl font-extrabold text-white">
                {formatBRL(numericMarketingSpent)}
              </div>
            )}

            <p className="text-xs text-white/50">
              Total investido em anúncios Meta/Insta e tráfego pago.
            </p>
          </div>

          {/* Card 3: Custo dos Pods na Prateleira */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <Box className="size-4 text-white/70" /> Custo dos Pods na Prateleira
            </span>
            <div className="text-2xl font-extrabold text-white">
              {formatBRL(stockAssetCost)}
            </div>
            <p className="text-xs text-white/50">
              Capital imobilizado nos {stockAssetUnits} pods parados no armazém.
            </p>
          </div>

          {/* Card 4: Valor Potencial de Venda */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <DollarSign className="size-4 text-white/70" /> Valor de Venda do Estoque
            </span>
            <div className="text-2xl font-extrabold text-white">
              {formatBRL(stockAssetRetail)}
            </div>
            <p className="text-xs text-white/50">
              Faturamento bruto total se os {stockAssetUnits} pods forem vendidos.
            </p>
          </div>

          {/* Card 5: Lucro Potencial do Estoque */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <TrendingUp className="size-4 text-emerald-400" /> Lucro Potencial do Estoque
            </span>
            <div className="text-2xl font-extrabold text-emerald-400">
              {formatBRL(stockAssetProfit)}
            </div>
            <p className="text-xs text-white/50">
              Lucro bruto futuro ao zerar os {stockAssetUnits} pods parados.
            </p>
          </div>

          {/* Card 6: Patrimônio Total da Empresa */}
          <div className="bg-gradient-to-br from-white/10 to-emerald-500/10 border border-white/30 rounded-2xl p-5 space-y-2 hover:border-white/50 transition-all">
            <span className="text-[11px] text-white uppercase font-extrabold tracking-wider block flex items-center gap-1.5">
              <Landmark className="size-4 text-white" /> Patrimônio Total da Loja
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {formatBRL(totalCompanyEquity)}
            </div>
            <p className="text-xs text-white/70 font-medium">
              Caixa em Conta ({formatBRL(grossRevenue)}) + Venda Total do Estoque ({formatBRL(stockAssetRetail)})
            </p>
          </div>
        </div>
      </div>

      {/* ━━━ BLOCO 3: 🏆 CAMPEÕES DE VENDA & ANÁLISE DE LUCRO POR POD (SEÇÃO ESTRATÉGICA) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl hover:border-white/25 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Trophy className="size-5 text-white" />
              <span>Campeões de Venda & Lucro por Produto (Direcionador Estratégico)</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Descubra exatamente quais modelos geram maior lucro líquido para direcionar seus investimentos de tráfego.
            </p>
          </div>
          <span className="text-xs font-bold bg-white/10 text-white px-3 py-1 rounded-xl border border-white/15 self-start sm:self-auto">
            🔥 Estratégia de Crescimento
          </span>
        </div>

        {modelProfits.length === 0 ? (
          <p className="text-xs text-white/40 py-6 text-center italic">
            Nenhuma venda registrada ainda para calcular o ranking estratégico.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modelProfits.map((item, idx) => (
              <div
                key={item.modelKey}
                className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-3 hover:border-white/30 transition-all relative"
              >
                {/* Badge de Posição */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
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
                  <p className="text-xs text-white/50">
                    {item.unitsSold} {item.unitsSold === 1 ? "unidade vendida" : "unidades vendidas"}
                  </p>
                </div>

                {/* Métricas de Lucro */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-[10px] text-white/50 font-medium block">Receita Gerada</span>
                    <span className="font-bold text-white">{formatBRL(item.revenue)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-400 font-medium block">Lucro Gerado</span>
                    <span className="font-extrabold text-emerald-400">{formatBRL(item.profit)}</span>
                  </div>
                </div>

                {/* Recomendação Estratégica */}
                <div className="pt-2 border-t border-white/10 text-[10px] text-white/70 font-semibold flex items-center gap-1">
                  <Flame className="size-3.5 text-emerald-400 shrink-0" />
                  <span>
                    {item.marginPct > 20 ? "Alta Margem - Escalar Tráfego Pago" : "Produto Relevante no Volume"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ━━━ BLOCO 4: DEMONSTRATIVO DE RESULTADO (DRE EXECUTIVO EM TABELA LIMPA) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl hover:border-white/25 transition-all">
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
              {/* Line 1: Faturamento Bruto (Sem Frete) */}
              <tr className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                  <div className="size-2 rounded-full bg-emerald-400" />
                  <span>🟢 Faturamento Bruto Real (Sem o Frete)</span>
                </td>
                <td className="py-3.5 px-4 text-right font-extrabold text-emerald-400 text-sm">
                  {formatBRL(grossRevenue)}
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-emerald-400">100.0%</td>
                <td className="py-3.5 px-4 text-muted-foreground">Total das vendas de produtos nos {totalOrders} pedidos (sem frete)</td>
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

              {/* Line 3: Marketing */}
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

              {/* Line 4: Frete / Logística (Informativo) */}
              <tr className="hover:bg-white/5 transition-colors text-white/70">
                <td className="py-3 px-4 font-medium flex items-center gap-2">
                  <div className="size-2 rounded-full bg-blue-400/60" />
                  <span>🚚 (Informativo) Total de Fretes Cobrados</span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-white/80">
                  {formatBRL(logisticsFee)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-white/50">—</td>
                <td className="py-3 px-4 text-muted-foreground">Fretes cobrados e diluídos nas entregas</td>
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
