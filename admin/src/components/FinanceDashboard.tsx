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
  PackagePlus,
  Boxes,
  Calendar,
  Trash2,
  Plus,
  X,
  AlertCircle,
  History,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { fetchProductCostsMap } from "../lib/productCosts";
import {
  fetchStockRepurchases,
  createStockRepurchase,
  deleteStockRepurchase,
  type StockRepurchase,
} from "../lib/stockRepurchases";

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

export default function FinanceDashboard() {
  const { user, company, companyUser, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);

  // Estados de Controle de Erro e Ciclo de Vida da Consulta
  const [financeError, setFinanceError] = useState<{
    message: string;
    code?: string;
    isAuthError?: boolean;
  } | null>(null);
  const [repurchasesError, setRepurchasesError] = useState<{
    message: string;
    code?: string;
  } | null>(null);
  const [hasLoadedSuccessfully, setHasLoadedSuccessfully] = useState(false);

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

  // Recompra de Estoque & Caixa Real State (Módulo Independente)
  const [repurchases, setRepurchases] = useState<StockRepurchase[]>([]);
  const [loadingRepurchases, setLoadingRepurchases] = useState(false);
  const [isRepurchaseModalOpen, setIsRepurchaseModalOpen] = useState(false);
  const [repurchaseToDelete, setRepurchaseToDelete] = useState<StockRepurchase | null>(null);

  // Form State para Nova Recompra
  const [stockAmountInput, setStockAmountInput] = useState("");
  const [freightAmountInput, setFreightAmountInput] = useState("");
  const [purchaseDateInput, setPurchaseDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [notesInput, setNotesInput] = useState("");
  const [isSavingRepurchase, setIsSavingRepurchase] = useState(false);
  const [repurchaseError, setRepurchaseError] = useState<string | null>(null);
  const [repurchaseSuccessMessage, setRepurchaseSuccessMessage] = useState<string | null>(null);

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

  const fetchFinanceData = async (isRetry = false) => {
    if (authLoading) return;

    if (!user || !company?.id || !companyUser) {
      setFinanceError({
        message: "Sessão não autenticada ou empresa não identificada. Por favor, realize o login novamente.",
        isAuthError: true,
      });
      setLoading(false);
      return;
    }

    const targetCompanyId = company.id;
    try {
      setLoading(true);
      setFinanceError(null);

      // Executa todas as consultas financeiras em paralelo para carregamento ultrarrápido
      const [persistedCostsRes, ordersRes, productsRes] = await Promise.all([
        fetchProductCostsMap(targetCompanyId).catch(() => ({})),
        supabase
          .from("smoking_orders")
          .select("*")
          .eq("company_id", targetCompanyId)
          .neq("delivery_status", "CANCELADO"),
        supabase
          .from("smoking_products")
          .select("*")
          .eq("company_id", targetCompanyId)
          .eq("is_active", true),
      ]);

      // Inspecionar explicitamente se smoking_orders retornou erro
      if (ordersRes.error) {
        console.error("[FinanceDashboard] Erro ao consultar smoking_orders:", ordersRes.error.message);
        const isAuth = ordersRes.error.code === "42501" ||
          ordersRes.error.message?.includes("permission denied") ||
          ordersRes.error.message?.includes("JWT") ||
          ordersRes.error.message?.includes("token");

        // Tentativa de recuperação única se for erro de permissão/token
        if (isAuth && !isRetry) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            console.log("[FinanceDashboard] Sessão Supabase confirmada. Executando retry único...");
            return fetchFinanceData(true);
          }
        }

        setFinanceError({
          message: isAuth
            ? "Não foi possível carregar os dados financeiros. Sua sessão pode ter expirado ou houve um problema de permissão no acesso aos pedidos."
            : `Erro ao carregar pedidos: ${ordersRes.error.message}`,
          code: ordersRes.error.code,
          isAuthError: isAuth,
        });
        setLoading(false);
        return; // NUNCA transforma erro em array vazio nem calcula zero!
      }

      // Inspecionar explicitamente se smoking_products retornou erro
      if (productsRes.error) {
        console.error("[FinanceDashboard] Erro ao consultar smoking_products:", productsRes.error.message);
        setFinanceError({
          message: `Erro ao carregar catálogo de produtos: ${productsRes.error.message}`,
          code: productsRes.error.code,
        });
        setLoading(false);
        return;
      }

      const persistedCosts = persistedCostsRes || {};
      const rawOrders = ordersRes.data;
      const productsData = productsRes.data;

      if (!rawOrders) {
        setFinanceError({
          message: "Resposta do banco de dados não retornou lista de pedidos válida.",
        });
        setLoading(false);
        return;
      }

      const validOrders = rawOrders.filter(
        (o) =>
          o.client_phone !== "__SYSTEM_SMK_BEST_SELLERS__" &&
          (!o.client_phone || !o.client_phone.startsWith("__SYSTEM_")) &&
          (!o.client_name || !o.client_name.toLowerCase().includes("system config"))
      );

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
      setHasLoadedSuccessfully(true);
      setFinanceError(null);
    } catch (err: any) {
      console.error("[FinanceDashboard] Erro ao calcular inteligência financeira:", err);
      setFinanceError({
        message: err?.message || "Erro inesperado ao processar os indicadores financeiros.",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRepurchasesData = async (targetCompanyId: string) => {
    try {
      setLoadingRepurchases(true);
      setRepurchasesError(null);
      const { data, error } = await supabase
        .from("smoking_stock_repurchases")
        .select("*")
        .eq("company_id", targetCompanyId)
        .order("purchase_date", { ascending: false });

      if (error) {
        console.error("[FinanceDashboard] Erro na consulta de smoking_stock_repurchases:", error.message);
        setRepurchasesError({
          message: error.message,
          code: error.code,
        });
        return;
      }

      if (Array.isArray(data)) {
        const mapped: StockRepurchase[] = data.map((row: any) => ({
          id: row.id,
          company_id: row.company_id || targetCompanyId,
          stock_purchase_amount: Number(row.stock_purchase_amount) || 0,
          freight_amount: Number(row.freight_amount) || 0,
          total_repurchase_amount: Number(row.total_repurchase_amount) || (Number(row.stock_purchase_amount) || 0) + (Number(row.freight_amount) || 0),
          purchase_date: row.purchase_date || new Date().toISOString().split("T")[0],
          notes: row.notes || "",
          created_at: row.created_at || new Date().toISOString(),
        }));
        setRepurchases(mapped);
      }
    } catch (e: any) {
      console.error("[FinanceDashboard] Exceção ao carregar recompras:", e?.message || e);
      setRepurchasesError({ message: e?.message || "Erro inesperado ao carregar recompras" });
    } finally {
      setLoadingRepurchases(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!user || !company?.id || !companyUser) {
      setFinanceError({
        message: "Sessão não autenticada ou empresa não identificada. Faça login novamente.",
        isAuthError: true,
      });
      setLoading(false);
      return;
    }

    const targetCompanyId = company.id;
    fetchFinanceData();
    loadRepurchasesData(targetCompanyId);

    const subOrders = supabase
      .channel("finance_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_orders" }, () => {
        fetchFinanceData();
        loadRepurchasesData(targetCompanyId);
      })
      .subscribe();

    const subProducts = supabase
      .channel("finance_products_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_products" }, () => fetchFinanceData())
      .subscribe();

    const subRepurchases = supabase
      .channel("finance_stock_repurchases_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_stock_repurchases" }, () => {
        loadRepurchasesData(targetCompanyId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subOrders);
      supabase.removeChannel(subProducts);
      supabase.removeChannel(subRepurchases);
    };
  }, [user, company?.id, companyUser, authLoading]);

  // ── Cálculos Recompra de Estoque & Caixa Real (Módulo Independente) ─────────────
  const totalStockPurchases = useMemo(() => {
    return repurchases.reduce((sum, r) => sum + (Number(r.stock_purchase_amount) || 0), 0);
  }, [repurchases]);

  const totalFreightRepurchases = useMemo(() => {
    return repurchases.reduce((sum, r) => sum + (Number(r.freight_amount) || 0), 0);
  }, [repurchases]);

  const totalInvestedRepurchases = useMemo(() => {
    return totalStockPurchases + totalFreightRepurchases;
  }, [totalStockPurchases, totalFreightRepurchases]);

  // CAIXA REAL = Faturamento Bruto Real (Acumulado) - Total Pago em Recompras de Estoque
  // REGRA FINANCEIRA: O FRETE NÃO ENTRA NO CÁLCULO DO CAIXA REAL
  const realCash = useMemo(() => {
    return (grossRevenue || 0) - totalStockPurchases;
  }, [grossRevenue, totalStockPurchases]);

  // Modal Handlers de Recompra
  const handleOpenRepurchaseModal = () => {
    setStockAmountInput("");
    setFreightAmountInput("");
    setPurchaseDateInput(new Date().toISOString().split("T")[0]);
    setNotesInput("");
    setRepurchaseError(null);
    setRepurchaseSuccessMessage(null);
    setIsRepurchaseModalOpen(true);
  };

  const handleSaveRepurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepurchaseError(null);

    const cleanStockStr = stockAmountInput.replace(/[^\d.,]/g, "").replace(",", ".");
    const cleanFreightStr = freightAmountInput.replace(/[^\d.,]/g, "").replace(",", ".");

    const stockAmount = parseFloat(cleanStockStr);
    const freightAmount = cleanFreightStr ? parseFloat(cleanFreightStr) : 0;

    if (isNaN(stockAmount) || stockAmount <= 0) {
      setRepurchaseError("Informe um valor válido pago no estoque (maior que zero).");
      return;
    }

    if (isNaN(freightAmount) || freightAmount < 0) {
      setRepurchaseError("O frete da reposição não pode ser negativo.");
      return;
    }

    try {
      setIsSavingRepurchase(true);
      if (!company?.id) {
        setRepurchaseError("Empresa não identificada na sessão atual.");
        return;
      }
      const targetCompanyId = company.id;

      const res = await createStockRepurchase({
        companyId: targetCompanyId,
        stock_purchase_amount: stockAmount,
        freight_amount: freightAmount,
        purchase_date: purchaseDateInput,
        notes: notesInput,
      });

      if (res.error) {
        setRepurchaseError(res.error.message || "Erro ao salvar recompra.");
        return;
      }

      await loadRepurchasesData(targetCompanyId);
      setRepurchaseSuccessMessage("Recompra registrada com sucesso!");
      setTimeout(() => {
        setIsRepurchaseModalOpen(false);
        setRepurchaseSuccessMessage(null);
      }, 500);
    } catch (err: any) {
      setRepurchaseError(err.message || "Erro inesperado ao salvar recompra.");
    } finally {
      setIsSavingRepurchase(false);
    }
  };

  const handleConfirmDeleteRepurchase = async () => {
    if (!repurchaseToDelete || !company?.id) return;
    try {
      const targetCompanyId = company.id;
      const res = await deleteStockRepurchase(repurchaseToDelete.id, targetCompanyId);
      if (res.error) {
        alert("Erro ao excluir: " + res.error.message);
        return;
      }
      await loadRepurchasesData(targetCompanyId);
      setRepurchaseToDelete(null);
    } catch (err: any) {
      alert("Erro ao excluir: " + (err.message || "Erro inesperado"));
    }
  };

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

  // Estado A: Carregando
  if (loading || authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background min-h-screen">
        <Loader2 className="size-8 text-emerald-400 animate-spin mb-2" />
        <p className="text-xs text-muted-foreground">Carregando Inteligência Financeira...</p>
      </div>
    );
  }

  // Estado D: Erro de Consulta (NUNCA exibe cards com R$ 0,00 falsos)
  if (financeError) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 space-y-6 text-white custom-scrollbar">
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 self-start sm:self-auto">
            <AlertCircle className="size-3.5" />
            <span>Falha de Comunicação</span>
          </div>
        </header>

        <div className="bg-[#0e0e10] border border-red-500/30 rounded-3xl p-8 sm:p-12 text-center space-y-6 max-w-2xl mx-auto my-12 shadow-2xl">
          <div className="size-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
            <AlertCircle className="size-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Não foi possível carregar os dados financeiros</h3>
            <p className="text-sm text-white/60 max-w-lg mx-auto leading-relaxed">
              {financeError.message || "Sua sessão pode ter expirado ou houve um problema de conexão com o banco de dados."}
            </p>
            {financeError.code && (
              <p className="text-[11px] font-mono text-white/40">Código do banco: {financeError.code}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            {financeError.isAuthError && (
              <button
                onClick={() => signOut()}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-xs sm:text-sm cursor-pointer"
              >
                Fazer Login Novamente
              </button>
            )}

            <button
              onClick={() => fetchFinanceData(false)}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl border border-white/15 transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Estado B (com dados) e Estado C (dados legítimos vazios)
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

      {/* Aviso caso consulta de recompras tenha falhado */}
      {repurchasesError && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 flex items-center gap-3">
          <AlertCircle className="size-5 shrink-0 text-amber-400" />
          <span>Aviso: Não foi possível sincronizar o histórico de recompras ({repurchasesError.message}).</span>
        </div>
      )}

      {/* Estado C: Carregado com Sucesso, porém sem nenhum pedido registrado para a empresa */}
      {hasLoadedSuccessfully && totalOrders === 0 && (
        <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-8 text-center space-y-2">
          <ShoppingBag className="size-8 text-white/30 mx-auto" />
          <h4 className="text-base font-bold text-white">Nenhum pedido registrado</h4>
          <p className="text-xs text-white/50">Não há registros de vendas concluídas para esta empresa no banco de dados.</p>
        </div>
      )}

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

      {/* ━━━ NOVO BLOCO: 📦 RECOMPRA DE ESTOQUE & CAIXA REAL (MÓDULO INDEPENDENTE) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl hover:border-white/25 transition-all">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <PackagePlus className="size-5 text-emerald-400" />
              <span>Recompra de Estoque & Caixa Real</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Controle de desembolsos para reposição de mercadorias, fretes de fornecedores e saldo real remanescente em caixa.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenRepurchaseModal}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="size-4 stroke-[3]" />
              <span>Registrar Recompra</span>
            </button>
          </div>
        </div>

        {/* 4 Cards de Indicadores de Recompra */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: CAIXA REAL (Destaque Principal) */}
          <div className="bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-black/60 border-2 border-emerald-500/50 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl shadow-emerald-950/20 hover:border-emerald-400 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="size-4 text-emerald-400" /> Caixa Real
              </span>
              <span className="text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full">
                Disponível
              </span>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300 tracking-tight">
                {formatBRL(realCash)}
              </div>
              <p className="text-xs font-semibold text-emerald-400/90 mt-1">
                Faturamento acumulado − recompras de estoque
              </p>
            </div>

            <div className="pt-2.5 border-t border-emerald-500/20 text-[10px] text-white/50 flex flex-col gap-0.5">
              <span>Fat: {formatBRL(grossRevenue)} − Estoque: {formatBRL(totalStockPurchases)}</span>
              <span className="text-emerald-400/70 font-medium">⚡ Fretes de reposição não são descontados</span>
            </div>
          </div>

          {/* Card 2: RECOMPRAS DE ESTOQUE */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-3 hover:border-white/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="size-4 text-white/70" /> Recompras de Estoque
              </span>
              <div className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70">
                <Box className="size-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {formatBRL(totalStockPurchases)}
              </div>
              <p className="text-xs font-medium text-white/50 mt-1">
                Total pago em produtos para reposição
              </p>
            </div>

            <div className="pt-2.5 border-t border-white/10 text-[10px] text-white/40">
              {repurchases.length} {repurchases.length === 1 ? 'reposição registrada' : 'reposições registradas'}
            </div>
          </div>

          {/* Card 3: TOTAL INVESTIDO EM REPOSIÇÃO */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-3 hover:border-white/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="size-4 text-amber-400" /> Total Investido Reposição
              </span>
              <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <DollarSign className="size-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-300">
                {formatBRL(totalInvestedRepurchases)}
              </div>
              <p className="text-xs font-medium text-white/50 mt-1">
                Produtos + fretes de reposição
              </p>
            </div>

            <div className="pt-2.5 border-t border-white/10 text-[10px] text-white/40">
              Estoque ({formatBRL(totalStockPurchases)}) + Frete ({formatBRL(totalFreightRepurchases)})
            </div>
          </div>

          {/* Card 4: FRETES DE REPOSIÇÃO */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-3 hover:border-white/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="size-4 text-white/70" /> Fretes de Reposição
              </span>
              <div className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70">
                <Truck className="size-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {formatBRL(totalFreightRepurchases)}
              </div>
              <p className="text-xs font-medium text-white/50 mt-1">
                Total gasto com frete dos fornecedores
              </p>
            </div>

            <div className="pt-2.5 border-t border-white/10 text-[10px] text-white/40">
              Fretes registrados nas reposições de estoque
            </div>
          </div>
        </div>

        {/* Tabela de Histórico de Recompras */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
              <History className="size-4 text-white/60" />
              <span>Histórico de Recompras de Estoque</span>
              <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                {repurchases.length}
              </span>
            </h4>
          </div>

          {repurchases.length === 0 ? (
            <div className="bg-black/20 border border-dashed border-white/10 rounded-2xl p-8 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
                <PackagePlus className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70">Nenhuma recompra de estoque registrada ainda</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Registre as reposições de produtos pagas aos fornecedores para acompanhar o Caixa Real da loja.
                </p>
              </div>
              <button
                onClick={handleOpenRepurchaseModal}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl border border-white/15 transition-all cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Registrar Primeira Recompra</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-white/60 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4 text-right">Estoque (Produtos)</th>
                    <th className="py-3 px-4 text-right">Frete Reposição</th>
                    <th className="py-3 px-4 text-right">Total Desembolsado</th>
                    <th className="py-3 px-4">Observação</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {repurchases.map((rep) => {
                    const formattedDate = rep.purchase_date
                      ? new Date(rep.purchase_date + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—";
                    return (
                      <tr key={rep.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-white/90">
                          {formattedDate}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-white text-sm">
                          {formatBRL(rep.stock_purchase_amount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-white/70">
                          {rep.freight_amount > 0 ? formatBRL(rep.freight_amount) : "R$ 0,00"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-amber-300 text-sm">
                          {formatBRL(rep.total_repurchase_amount)}
                        </td>
                        <td className="py-3.5 px-4 text-white/60 max-w-xs truncate">
                          {rep.notes || <span className="text-white/20 italic">Sem observações</span>}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setRepurchaseToDelete(rep)}
                            title="Excluir Recompra"
                            className="size-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 inline-flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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

      {/* ━━━ MODAL: REGISTRAR RECOMPRA DE ESTOQUE ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isRepurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e0e10] border border-white/20 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <PackagePlus className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Registrar Recompra</h3>
                  <p className="text-[11px] text-white/50">Lançamento de aquisição de estoque no financeiro</p>
                </div>
              </div>
              <button
                onClick={() => setIsRepurchaseModalOpen(false)}
                className="size-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {repurchaseError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{repurchaseError}</span>
              </div>
            )}

            {repurchaseSuccessMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{repurchaseSuccessMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveRepurchase} className="space-y-4">
              {/* Valor Pago no Estoque */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 flex items-center gap-1">
                  <span>Valor pago no estoque (R$)</span>
                  <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">R$</span>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="1.000,00"
                    value={stockAmountInput}
                    onChange={(e) => setStockAmountInput(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-white/40">Somente o valor das mercadorias (sem o frete)</p>
              </div>

              {/* Frete da Reposição */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80">Frete da reposição (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">R$</span>
                  <input
                    type="text"
                    placeholder="80,00"
                    value={freightAmountInput}
                    onChange={(e) => setFreightAmountInput(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-white/40">Opcional. Não é descontado do Caixa Real.</p>
              </div>

              {/* Data da Recompra */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-white/60" />
                  <span>Data da recompra</span>
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDateInput}
                  onChange={(e) => setPurchaseDateInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2.5 text-sm font-medium text-white focus:outline-none focus:border-emerald-500/50 transition-colors [color-scheme:dark]"
                />
              </div>

              {/* Observação */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80">Observação</label>
                <input
                  type="text"
                  placeholder="Ex.: Reposição fornecedor X, Lote #14"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={isSavingRepurchase}
                  onClick={() => setIsRepurchaseModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/70 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingRepurchase}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  {isSavingRepurchase ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-4 stroke-[3]" />
                      <span>Registrar Recompra</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ━━━ MODAL: CONFIRMAR EXCLUSÃO DE RECOMPRA ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {repurchaseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e0e10] border border-red-500/30 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Recompra?</h3>
                <p className="text-xs text-white/50">Esta ação irá recalcular o Caixa Real</p>
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-white/60">Data:</span>
                <span className="text-white font-bold">
                  {new Date(repurchaseToDelete.purchase_date + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Estoque:</span>
                <span className="text-white font-bold">{formatBRL(repurchaseToDelete.stock_purchase_amount)}</span>
              </div>
              {repurchaseToDelete.freight_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-white/60">Frete:</span>
                  <span className="text-white/80 font-bold">{formatBRL(repurchaseToDelete.freight_amount)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRepurchaseToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/70 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRepurchase}
                className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95 cursor-pointer"
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
