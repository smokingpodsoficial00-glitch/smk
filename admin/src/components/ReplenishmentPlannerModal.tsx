import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Sparkles,
  TrendingUp,
  Package,
  ShoppingCart,
  DollarSign,
  Copy,
  Check,
  Target,
  ArrowRight,
  ShieldCheck,
  Zap,
  Boxes,
  HelpCircle,
  Edit3,
  Save,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  Flame,
  Layers,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Plus,
  Trash2,
  Minus,
  Loader2,
  PackageCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { updateProductCost, fetchProductCostsMap } from "../lib/productCosts";
import { executeStockEntryRpc } from "../lib/stockRepurchases";
import { getCurrentCycle } from "../lib/financialCycles";
import { syncWeeklyGoalsFromOrders, saveWeeklyGoals } from "../lib/weeklyGoals";

export interface OrderItem {
  id: string;
  brand: string;
  model: string;
  qty: number;
  unitCost: number;
  unitSell: number;
  flavors: string;
  badge?: string;
}

export interface StockModelSuggestion {
  key: string;
  brand: string;
  model: string;
  costPrice: number;
  sellPrice: number;
  flavors: string[];
  totalStock: number;
}

export interface FinancialGoals {
  reorderCashGoal: number; // ex: 1000, 2000, 5000
  paraguayScaleGoal: number; // ex: 5000, 10000, 25000
  monthlyRevenueGoal: number; // ex: 7000
  quarterlyRevenueGoal: number; // ex: 25000
  annualRevenueGoal: number; // ex: 100000
}

export const DEFAULT_GOALS: FinancialGoals = {
  reorderCashGoal: 1000,
  paraguayScaleGoal: 5000,
  monthlyRevenueGoal: 7000,
  quarterlyRevenueGoal: 25000,
  annualRevenueGoal: 100000,
};

export const DEFAULT_ORDER_ITEMS: OrderItem[] = [
  { id: "1", brand: "Elfbar", model: "BC15K", qty: 3, unitCost: 48, unitSell: 64.99, badge: "Alto Giro / Menor Custo", flavors: "Blue Razz Ice (2x), Strawberry Kiwi" },
  { id: "2", brand: "Elfbar", model: "Ice King 40K", qty: 2, unitCost: 70, unitSell: 89.90, badge: "Campeão #1 de Vendas", flavors: "Green Apple Ice, Watermelon Ice" },
  { id: "3", brand: "Lost Mary", model: "Dura 35K", qty: 3, unitCost: 65, unitSell: 79.90, badge: "Excelente Retenção", flavors: "Pom. Cherry Pineapple, Grape Ice" },
  { id: "4", brand: "Oxbar", model: "50K", qty: 1, unitCost: 65, unitSell: 99.90, badge: "Maior Margem Líquida", flavors: "Pineapple Ice" },
  { id: "5", brand: "Elfbar", model: "GH23K", qty: 1, unitCost: 65, unitSell: 86.90, badge: "Desejo de Catálogo", flavors: "Grape Ice" },
  { id: "6", brand: "Ignite", model: "V500", qty: 1, unitCost: 80, unitSell: 108.90, badge: "Modelo Premium", flavors: "Strawberry Kiwi" },
  { id: "7", brand: "Ignite", model: "V55 Ultra Thin", qty: 1, unitCost: 52, unitSell: 71.90, badge: "Entrada Acessível", flavors: "Strawberry Ice" },
  { id: "8", brand: "Ignite", model: "V80 Ultra Slim", qty: 1, unitCost: 55, unitSell: 78.90, badge: "Margem & Variedade", flavors: "Passion Fruit Sour Kiwi" },
  { id: "9", brand: "Geek Bar", model: "Pulse 15K", qty: 2, unitCost: 70, unitSell: 94.90, badge: "Marca Nova / Novidade", flavors: "Sabores Sortidos / Menta" },
];

export const LOCAL_STORAGE_GOALS_KEY = "smk_financial_goals_v1";
export const LOCAL_STORAGE_ORDER_KEY = "smk_active_purchase_order_v2";

export function loadSavedGoals(): FinancialGoals {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_GOALS_KEY);
    if (saved) return { ...DEFAULT_GOALS, ...JSON.parse(saved) };
  } catch (e) {}
  return DEFAULT_GOALS;
}

export function loadSavedOrderItems(): OrderItem[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_ORDER_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return DEFAULT_ORDER_ITEMS;
}

export function extractPuffsFromModel(modelName: string): number {
  const str = modelName.toUpperCase();
  const kMatch = str.match(/(\d+)\s*K/i);
  if (kMatch) {
    return parseInt(kMatch[1]) * 1000;
  }
  const numMatch = str.match(/(\d{4,6})/);
  if (numMatch) {
    return parseInt(numMatch[1]);
  }
  return 5000;
}

export function parseFlavorsString(flavorsStr: string, totalQty: number): { flavor: string; qty: number }[] {
  const trimmed = (flavorsStr || "").trim();
  if (!trimmed) return [{ flavor: "Padrão", qty: totalQty }];

  const parts = trimmed.split(/,\s*/);
  if (parts.length <= 1) {
    return [{ flavor: trimmed, qty: totalQty }];
  }

  const result: { flavor: string; qty: number }[] = [];
  let allocated = 0;

  parts.forEach((part, index) => {
    const match = part.match(/\((\d+)\s*x\)/i) || part.match(/^(\d+)\s*x\s+/i);
    let q = 1;
    let cleanFlavor = part.replace(/\(\d+\s*x\)/gi, "").replace(/^\d+\s*x\s+/gi, "").trim();

    if (match) {
      q = parseInt(match[1]) || 1;
    } else if (index === parts.length - 1 && totalQty > allocated) {
      q = totalQty - allocated;
    }

    allocated += q;
    result.push({ flavor: cleanFlavor || "Padrão", qty: Math.max(1, q) });
  });

  return result;
}

interface ReplenishmentPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCash?: number;
  stockRetailValue?: number;
  stockCostValue?: number;
  totalPodsInStock?: number;
  companyId?: string;
  onGoalsUpdated?: (newGoals: FinancialGoals) => void;
  onStockUpdated?: () => void;
}

export const ReplenishmentPlannerModal: React.FC<ReplenishmentPlannerModalProps> = ({
  isOpen,
  onClose,
  currentCash = 513,
  stockRetailValue = 1042.89,
  stockCostValue = 783,
  totalPodsInStock = 12,
  companyId,
  onGoalsUpdated,
  onStockUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<"goals" | "order" | "contingency">("order");

  // Estado das Metas Editáveis
  const [goals, setGoals] = useState<FinancialGoals>(loadSavedGoals);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [tempGoals, setTempGoals] = useState<FinancialGoals>(goals);
  const [savedSuccessAlert, setSavedSuccessAlert] = useState(false);

  // Estado dos Itens do Pedido (100% Maleável e Editável)
  const [orderItems, setOrderItems] = useState<OrderItem[]>(loadSavedOrderItems);
  const [supplierShippingFee, setSupplierShippingFee] = useState<number>(50);
  const [copiedOrder, setCopiedOrder] = useState(false);

  // Estado de Entrada Automática de Estoque
  const [showConfirmStockEntryModal, setShowConfirmStockEntryModal] = useState(false);
  const [isProcessingStockEntry, setIsProcessingStockEntry] = useState(false);
  const [stockEntryCompleted, setStockEntryCompleted] = useState(false);
  const [operationIdempotencyKey, setOperationIdempotencyKey] = useState<string | null>(null);
  const [stockEntryResult, setStockEntryResult] = useState<{
    processedUnits: number;
    existingUpdatedCount: number;
    newProductsCreatedCount: number;
    variationsUpdatedCount: number;
    totalInvested: number;
  } | null>(null);

  // Formulário para Adicionar Novo Pod ao Pedido
  const [showAddPodForm, setShowAddPodForm] = useState(false);
  const [newPodBrand, setNewPodBrand] = useState("");
  const [newPodModel, setNewPodModel] = useState("");
  const [newPodQty, setNewPodQty] = useState("1");
  const [newPodCost, setNewPodCost] = useState("65");
  const [newPodSell, setNewPodSell] = useState("89.90");
  const [newPodFlavors, setNewPodFlavors] = useState("Sabores Sortidos");

  // Sugestões Inteligentes puxadas do Estoque em Tempo Real
  const [stockSuggestions, setStockSuggestions] = useState<StockModelSuggestion[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [selectedStockModel, setSelectedStockModel] = useState<StockModelSuggestion | null>(null);

  // Estado de Faturamento / Caixa Real da Empresa em Tempo Real (Mesma fonte do Financeiro)
  const [liveAccumulatedRevenue, setLiveAccumulatedRevenue] = useState<number | null>(null);

  // Carregar e Escutar Vendas em Tempo Real (Supabase Realtime)
  useEffect(() => {
    if (!isOpen) return;

    const targetCompanyId = companyId || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

    // 1. Buscar produtos do estoque para auto-sugestão inteligente
    const loadStockSuggestions = async () => {
      try {
        const { data: dbProducts } = await supabase
          .from("smoking_products")
          .select("id, name, brand, flavor, price, stock")
          .or(`company_id.eq.${targetCompanyId},company_id.is.null`);

        const costsMap = await fetchProductCostsMap(targetCompanyId);

        const groupMap = new Map<string, StockModelSuggestion>();
        (dbProducts || []).forEach((p: any) => {
          const brand = (p.brand || "").trim();
          const model = (p.name || "").trim();
          if (!model) return;
          const key = `${brand.toLowerCase()}-${model.toLowerCase()}`;
          const modelKeyRaw = `${brand.toLowerCase()} ${model.toLowerCase()}`;
          const cost = costsMap[p.id] || costsMap[key] || costsMap[modelKeyRaw] || 65;
          const sell = parseFloat(p.price) || 89.90;
          const stock = parseInt(p.stock) || 0;
          const flavor = (p.flavor || "").trim();

          if (!groupMap.has(key)) {
            groupMap.set(key, {
              key,
              brand,
              model,
              costPrice: cost,
              sellPrice: sell,
              flavors: flavor && flavor.toLowerCase() !== "padrão" && flavor.toLowerCase() !== "padrao" ? [flavor] : [],
              totalStock: stock
            });
          } else {
            const existing = groupMap.get(key)!;
            existing.totalStock += stock;
            if (flavor && flavor.toLowerCase() !== "padrão" && flavor.toLowerCase() !== "padrao" && !existing.flavors.includes(flavor)) {
              existing.flavors.push(flavor);
            }
          }
        });
        setStockSuggestions(Array.from(groupMap.values()));
      } catch (err) {
        console.error("Erro ao carregar sugestões do estoque:", err);
      }
    };

    loadStockSuggestions();

    const fetchRealSalesRevenue = async () => {
      try {
        const { data: rawOrders, error } = await supabase
          .from("smoking_orders")
          .select("id, total_amount, delivery_status, client_phone, client_name, items")
          .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
          .neq("delivery_status", "CANCELADO");

        if (error) {
          console.error("Erro ao buscar vendas para Metas em tempo real:", error);
          return;
        }

        // Sincronizar Meta Mensal oficial da empresa salva no Supabase
        const curCycle = getCurrentCycle();
        const syncedWeekly = syncWeeklyGoalsFromOrders(rawOrders || [], targetCompanyId, curCycle.id);
        if (syncedWeekly && syncedWeekly.monthlyTarget > 0) {
          setGoals((prev) => ({ ...prev, monthlyRevenueGoal: syncedWeekly.monthlyTarget }));
          setTempGoals((prev) => ({ ...prev, monthlyRevenueGoal: syncedWeekly.monthlyTarget }));
        }

        const validOrders = (rawOrders || []).filter(
          (o) =>
            o.client_phone !== "__SYSTEM_SMK_BEST_SELLERS__" &&
            (!o.client_phone || !o.client_phone.startsWith("__SYSTEM_")) &&
            (!o.client_name || !o.client_name.toLowerCase().includes("system config"))
        );

        let totalRev = 0;
        for (const order of validOrders) {
          totalRev += parseFloat(order.total_amount || 0);
        }

        setLiveAccumulatedRevenue(totalRev);
      } catch (e) {
        console.error("Erro ao recalcular metas em tempo real:", e);
      }
    };

    fetchRealSalesRevenue();

    // Inscrição Supabase Realtime no canal de smoking_orders para atualizar INSTANTANEAMENTE a tela de Metas
    const channelName = `metas_realtime_orders_${targetCompanyId}`;
    const subOrders = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "smoking_orders" },
        () => {
          fetchRealSalesRevenue();
          loadStockSuggestions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subOrders);
    };
  }, [isOpen, companyId]);

  useEffect(() => {
    if (isOpen) {
      const curGoals = loadSavedGoals();
      setGoals(curGoals);
      setTempGoals(curGoals);
      setOrderItems(loadSavedOrderItems());
      setIsEditingGoals(false);
      setShowAddPodForm(false);
      setSavedSuccessAlert(false);
      setShowConfirmStockEntryModal(false);
      setIsProcessingStockEntry(false);
      setStockEntryCompleted(false);
      setStockEntryResult(null);
    }
  }, [isOpen]);

  // Salvar itens do pedido no localStorage automaticamente
  const saveOrderItemsToStorage = (items: OrderItem[]) => {
    setOrderItems(items);
    try {
      localStorage.setItem(LOCAL_STORAGE_ORDER_KEY, JSON.stringify(items));
    } catch (e) {}
  };

  const handleUpdateItemQty = (id: string, delta: number) => {
    const updated = orderItems.map(item => {
      if (item.id === id) {
        const newQ = Math.max(1, item.qty + delta);
        return { ...item, qty: newQ };
      }
      return item;
    });
    saveOrderItemsToStorage(updated);
  };

  const handleUpdateItemField = (id: string, field: keyof OrderItem, val: any) => {
    const updated = orderItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: val };
      }
      return item;
    });
    saveOrderItemsToStorage(updated);
  };

  const handleRemoveItem = (id: string) => {
    const updated = orderItems.filter(item => item.id !== id);
    saveOrderItemsToStorage(updated);
  };

  const handleSelectSuggestion = (sug: StockModelSuggestion) => {
    setNewPodBrand(sug.brand);
    setNewPodModel(sug.model);
    setNewPodCost(sug.costPrice.toString());
    setNewPodSell(sug.sellPrice.toString());
    if (sug.flavors.length > 0) {
      setNewPodFlavors(sug.flavors.slice(0, 3).join(", "));
    }
    setSelectedStockModel(sug);
    setShowModelDropdown(false);
    setShowBrandDropdown(false);
  };

  const handleModelChange = (val: string) => {
    setNewPodModel(val);
    setShowModelDropdown(true);

    const norm = val.trim().toLowerCase();
    const exact = stockSuggestions.find(s => {
      const matchModel = s.model.toLowerCase() === norm;
      const matchBrand = newPodBrand ? s.brand.toLowerCase() === newPodBrand.trim().toLowerCase() : true;
      return matchModel && matchBrand;
    });

    if (exact) {
      if (!newPodBrand) setNewPodBrand(exact.brand);
      setNewPodCost(exact.costPrice.toString());
      setNewPodSell(exact.sellPrice.toString());
      setSelectedStockModel(exact);
    }
  };

  const handleBrandChange = (val: string) => {
    setNewPodBrand(val);
    setShowBrandDropdown(true);

    if (newPodModel) {
      const normModel = newPodModel.trim().toLowerCase();
      const normBrand = val.trim().toLowerCase();
      const exact = stockSuggestions.find(s => s.model.toLowerCase() === normModel && s.brand.toLowerCase() === normBrand);
      if (exact) {
        setNewPodCost(exact.costPrice.toString());
        setNewPodSell(exact.sellPrice.toString());
        setSelectedStockModel(exact);
      }
    }
  };

  const filteredModelSuggestions = useMemo(() => {
    const qModel = newPodModel.trim().toLowerCase();
    const qBrand = newPodBrand.trim().toLowerCase();
    return stockSuggestions.filter(s => {
      const brandMatch = !qBrand || s.brand.toLowerCase().includes(qBrand);
      const modelMatch = !qModel || s.model.toLowerCase().includes(qModel) || `${s.brand} ${s.model}`.toLowerCase().includes(qModel);
      return brandMatch && modelMatch;
    });
  }, [stockSuggestions, newPodModel, newPodBrand]);

  const uniqueStockBrands = useMemo(() => {
    const set = new Set<string>();
    stockSuggestions.forEach(s => set.add(s.brand));
    return Array.from(set);
  }, [stockSuggestions]);

  const handleAddPodToOrder = () => {
    if (!newPodModel.trim()) return;

    const newItem: OrderItem = {
      id: Date.now().toString(),
      brand: newPodBrand.trim() || "Pod",
      model: newPodModel.trim(),
      qty: Math.max(1, parseInt(newPodQty) || 1),
      unitCost: parseFloat(newPodCost) || 65,
      unitSell: parseFloat(newPodSell) || 89.90,
      flavors: newPodFlavors.trim() || "Sabores Sortidos",
      badge: "Novo Item Adicionado"
    };

    const updated = [...orderItems, newItem];
    saveOrderItemsToStorage(updated);

    // Reset Form
    setNewPodBrand("");
    setNewPodModel("");
    setNewPodQty("1");
    setNewPodCost("65");
    setNewPodSell("89.90");
    setNewPodFlavors("Sabores Sortidos");
    setSelectedStockModel(null);
    setShowAddPodForm(false);
    setShowModelDropdown(false);
    setShowBrandDropdown(false);
  };

  const handleResetOrderToDefault = () => {
    saveOrderItemsToStorage(DEFAULT_ORDER_ITEMS);
  };

  // Salvar Metas (e sincronizar globalmente no Supabase para todos os sócios)
  const handleSaveGoals = () => {
    setGoals(tempGoals);
    setIsEditingGoals(false);
    setSavedSuccessAlert(true);
    setTimeout(() => setSavedSuccessAlert(false), 3000);

    try {
      localStorage.setItem(LOCAL_STORAGE_GOALS_KEY, JSON.stringify(tempGoals));
    } catch (e) {}

    const targetCompanyId = companyId || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
    const curCycle = getCurrentCycle();
    const mTarget = Number(tempGoals.monthlyRevenueGoal) || 7000;
    const qTarget = Number((mTarget / 4).toFixed(2));
    saveWeeklyGoals(
      {
        monthlyTarget: mTarget,
        week1: qTarget,
        week2: qTarget,
        week3: qTarget,
        week4: qTarget,
      },
      targetCompanyId,
      curCycle.id
    ).catch(() => {});

    if (onGoalsUpdated) {
      onGoalsUpdated(tempGoals);
    }
  };

  const handleResetGoals = () => {
    setTempGoals(DEFAULT_GOALS);
    setGoals(DEFAULT_GOALS);
    setIsEditingGoals(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_GOALS_KEY);
    } catch (e) {}

    const targetCompanyId = companyId || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
    const curCycle = getCurrentCycle();
    saveWeeklyGoals(
      {
        monthlyTarget: DEFAULT_GOALS.monthlyRevenueGoal,
        week1: 1750,
        week2: 1750,
        week3: 1750,
        week4: 1750,
      },
      targetCompanyId,
      curCycle.id
    ).catch(() => {});

    if (onGoalsUpdated) {
      onGoalsUpdated(DEFAULT_GOALS);
    }
  };

  // Cálculos Financeiros Dinâmicos do Pedido
  const totalUnitsInOrder = orderItems.reduce((acc, it) => acc + it.qty, 0);
  const totalCostOfOrder = orderItems.reduce((acc, it) => acc + (it.qty * it.unitCost), 0);
  const totalSellOfOrder = orderItems.reduce((acc, it) => acc + (it.qty * it.unitSell), 0);

  const totalSpentWithShipping = totalCostOfOrder + supplierShippingFee;
  const projectedNetProfit = totalSellOfOrder - totalSpentWithShipping;
  const dilutedShippingPerPod = totalUnitsInOrder > 0 ? (supplierShippingFee / totalUnitsInOrder).toFixed(2) : "0.00";

  // Usar faturamento acumulado em tempo real se disponível, fallback para prop currentCash
  const activeCash = liveAccumulatedRevenue !== null ? liveAccumulatedRevenue : currentCash;

  // Cálculos de Metas em Tempo Real (Integrado ao Supabase Realtime)
  const activeReorderGoal = isEditingGoals ? tempGoals.reorderCashGoal : goals.reorderCashGoal;
  const activeParaguayGoal = isEditingGoals ? tempGoals.paraguayScaleGoal : goals.paraguayScaleGoal;

  const totalEquity = activeCash + stockRetailValue;
  const cashNeededForReorder = Math.max(0, activeReorderGoal - activeCash);
  const reorderProgressPct = activeReorderGoal > 0 ? Math.min(100, Math.round((activeCash / activeReorderGoal) * 100)) : 100;
  const rawReorderProgressPct = activeReorderGoal > 0 ? Math.round((activeCash / activeReorderGoal) * 100) : 100;

  const averagePodPrice = totalPodsInStock > 0 ? stockRetailValue / totalPodsInStock : 86.9;
  const podsNeededToSell = averagePodPrice > 0 ? Math.ceil(cashNeededForReorder / averagePodPrice) : 0;
  const paraguayProgressPct = activeParaguayGoal > 0 ? Math.min(100, Math.round((totalEquity / activeParaguayGoal) * 100)) : 100;

  // Gerador de Texto para WhatsApp do Fornecedor Baseado na Lista Real do Usuário
  const generatedWhatsAppMessage = useMemo(() => {
    return `*PEDIDO DE REPOSIÇÃO — SMOKING PODS*
*Origem:* São Bernardo do Campo / SP
*Lote Total:* R$ ${totalSpentWithShipping.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

*LISTA DE MODELOS E QUANTIDADES:*
${orderItems.map(item => `• ${item.qty}x ${item.brand} ${item.model} (${item.flavors})`).join("\n")}

*Total de Peças:* ${totalUnitsInOrder} unidades
*Frete Estimado:* R$ ${supplierShippingFee.toFixed(2)} (Diluído: R$ ${dilutedShippingPerPod}/pod)

Por favor, me confirme a disponibilidade destes sabores e a chave Pix para faturarmos o pedido!`;
  }, [orderItems, totalUnitsInOrder, totalSpentWithShipping, supplierShippingFee, dilutedShippingPerPod]);

  const handleCopyOrderText = () => {
    try {
      navigator.clipboard.writeText(generatedWhatsAppMessage);
      setCopiedOrder(true);
      setTimeout(() => setCopiedOrder(false), 3000);
    } catch (e) {
      console.warn("Erro ao copiar:", e);
    }
  };

  // Execução da Entrada de Estoque Automática (100% Atômica via RPC PostgreSQL)
  const handleExecuteStockEntry = async () => {
    if (isProcessingStockEntry || stockEntryCompleted || orderItems.length === 0) return;

    setIsProcessingStockEntry(true);
    setShowConfirmStockEntryModal(false);

    const targetCompanyId = companyId || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
    let idempotencyKey = operationIdempotencyKey;
    if (!idempotencyKey) {
      idempotencyKey = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
      setOperationIdempotencyKey(idempotencyKey);
    }

    try {
      // 1. Desmembrar itens e variações de sabores
      const rpcItems: Array<{
        brand: string;
        model: string;
        flavor: string;
        qty: number;
        unit_cost: number;
        unit_sell: number;
        puffs?: number;
      }> = [];

      for (const item of orderItems) {
        const itemBrand = item.brand.trim();
        const itemModel = item.model.trim();
        const itemQty = Math.max(1, item.qty);
        const itemCost = item.unitCost;
        const itemSell = item.unitSell;
        const extractedPuffs = extractPuffsFromModel(itemModel);

        const flavorBreakdown = parseFlavorsString(item.flavors, itemQty);
        for (const subItem of flavorBreakdown) {
          rpcItems.push({
            brand: itemBrand,
            model: itemModel,
            flavor: subItem.flavor,
            qty: subItem.qty,
            unit_cost: itemCost,
            unit_sell: itemSell,
            puffs: extractedPuffs
          });
        }
      }

      if (rpcItems.length === 0) {
        alert("A lista de compras não contém itens válidos para dar entrada.");
        setIsProcessingStockEntry(false);
        return;
      }

      // 2. Executar operação transacional atômica via RPC PostgreSQL
      const rpcResult = await executeStockEntryRpc({
        companyId: targetCompanyId,
        idempotencyKey,
        purchaseDate: new Date().toISOString().split("T")[0],
        stockPurchaseAmount: totalCostOfOrder,
        freightAmount: supplierShippingFee,
        notes: `Entrada via Planejador de Reposição — ${totalUnitsInOrder} pods (${orderItems.length} modelos)`,
        items: rpcItems
      });

      if (!rpcResult.success) {
        console.error("Erro ao executar entrada de estoque atômica:", rpcResult.error);
        alert(`Erro ao processar entrada de estoque: ${rpcResult.error || "Tente novamente."}`);
        setIsProcessingStockEntry(false);
        return;
      }

      // 3. Limpeza do rascunho apenas após confirmação atômica com sucesso no banco
      try {
        localStorage.removeItem(LOCAL_STORAGE_ORDER_KEY);
      } catch (e) {
        console.warn("Aviso ao limpar rascunho local:", e);
      }
      setOrderItems([]);
      setOperationIdempotencyKey(null);

      // 4. Conclusão e Resumo
      setStockEntryCompleted(true);
      setStockEntryResult({
        processedUnits: rpcResult.total_units || totalUnitsInOrder,
        existingUpdatedCount: rpcResult.updated_products || 0,
        newProductsCreatedCount: rpcResult.created_products || 0,
        variationsUpdatedCount: (rpcResult.updated_products || 0) + (rpcResult.created_products || 0),
        totalInvested: totalSpentWithShipping
      });

      if (onStockUpdated) {
        onStockUpdated();
      }
    } catch (err) {
      console.error("Erro inesperado durante entrada de estoque:", err);
      alert("Ocorreu um erro ao processar a entrada de estoque. Tente novamente.");
    } finally {
      setIsProcessingStockEntry(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#09090b] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* ─── HEADER MODAL ─── */}
        <div className="px-5 py-3.5 border-b border-white/10 bg-[#121212] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Boxes className="size-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Planejador de Estoque, Reposição & Metas
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                  {totalUnitsInOrder} Peças no Pedido
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Monte, adicione e personalize o pedido exato para envio ao fornecedor
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ─── NAVEGAÇÃO DE ABAS ─── */}
        <div className="flex flex-wrap items-center justify-between border-b border-white/10 px-5 bg-[#0d0d0d] gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("order")}
              className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "order"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-muted-foreground hover:text-white"
              }`}
            >
              <ShoppingCart className="size-3.5" />
              <span>Pedido Ativo & WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("goals")}
              className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "goals"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-muted-foreground hover:text-white"
              }`}
            >
              <Target className="size-3.5" />
              <span>Metas & Termômetro de Caixa</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("contingency")}
              className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "contingency"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-muted-foreground hover:text-white"
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>Matriz de Substitutos</span>
            </button>
          </div>

          {/* Ações de Topo para Pedido e Metas */}
          {activeTab === "order" && (
            <div className="py-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddPodForm(!showAddPodForm)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <Plus className="size-3.5 text-black" />
                <span>Adicionar Produto</span>
              </button>
            </div>
          )}

          {activeTab === "goals" && (
            <div className="py-2 flex items-center gap-2">
              {savedSuccessAlert && (
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 animate-in fade-in">
                  <CheckCircle2 className="size-3.5" /> Metas salvas!
                </span>
              )}
              {!isEditingGoals ? (
                <button
                  type="button"
                  onClick={() => setIsEditingGoals(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  <Edit3 className="size-3.5 text-black" />
                  <span>Editar Todos os Gatilhos & Metas</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleResetGoals}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/20 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="size-3" />
                    <span>Padrão</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingGoals(false)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGoals}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all cursor-pointer active:scale-95"
                  >
                    <Save className="size-3.5 text-black" />
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── CONTEÚDO PRINCIPAL (SCROLLÁVEL) ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar">

          {/* ════════════════════════════════════════════════════════════
              ABA 1: PEDIDO ATIVO & WHATSAPP (ESTRUTURA HORIZONTAL LIMPA)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === "order" && (
            <div className="space-y-4">

              {/* Formulário Retrátil Inteligente para Adicionar Novo Pod ao Pedido */}
              {showAddPodForm && (
                <div className="bg-[#141414] border border-emerald-500/30 rounded-xl p-4 space-y-3.5 animate-in slide-in-from-top-2 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-lg bg-emerald-500/20 text-emerald-400 grid place-items-center">
                        <Plus className="size-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Adicionar Modelo / Pod ao Pedido</h4>
                        <p className="text-[10px] text-muted-foreground">Sugestão automática inteligente do estoque para preenchimento rápido</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddPodForm(false)}
                      className="size-6 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white grid place-items-center cursor-pointer transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {/* Pílulas de Sugestão Rápida do Estoque */}
                  {stockSuggestions.length > 0 && (
                    <div className="space-y-1.5 pb-2.5 border-b border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
                          <Zap className="size-3" /> Sugestões Rápidas do seu Estoque:
                        </span>
                        <span className="text-[9px] text-muted-foreground">Clique para preencher Custo e Venda automaticamente</span>
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                        {stockSuggestions.slice(0, 10).map((sug) => {
                          const isSelected =
                            newPodModel.trim().toLowerCase() === sug.model.toLowerCase() &&
                            (!newPodBrand || newPodBrand.trim().toLowerCase() === sug.brand.toLowerCase());
                          return (
                            <button
                              key={sug.key}
                              type="button"
                              onClick={() => handleSelectSuggestion(sug)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95 ${
                                isSelected
                                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/30"
                                  : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:border-emerald-500/40 hover:text-white"
                              }`}
                            >
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">{sug.brand}</span>
                              <span className="font-semibold">{sug.model}</span>
                              <span className="text-[10px] text-emerald-400 font-bold ml-0.5">R$ {sug.sellPrice.toFixed(2)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Marca com Autocomplete */}
                    <div className="space-y-1 relative">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                        <span>Marca</span>
                        {selectedStockModel && (
                          <span className="text-emerald-400 text-[9px] font-normal flex items-center gap-0.5">
                            <Check className="size-2.5" /> Estoque
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Ignite, Elfbar, Lost Mary..."
                        value={newPodBrand}
                        onChange={(e) => handleBrandChange(e.target.value)}
                        onFocus={() => setShowBrandDropdown(true)}
                        onBlur={() => setTimeout(() => setShowBrandDropdown(false), 200)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                      {showBrandDropdown && uniqueStockBrands.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-[#1a1a1a] border border-white/15 rounded-lg shadow-2xl z-50 max-h-36 overflow-y-auto divide-y divide-white/5">
                          {uniqueStockBrands
                            .filter(b => !newPodBrand || b.toLowerCase().includes(newPodBrand.toLowerCase()))
                            .map(brand => (
                              <div
                                key={brand}
                                onMouseDown={() => {
                                  setNewPodBrand(brand);
                                  setShowBrandDropdown(false);
                                }}
                                className="px-3 py-1.5 text-xs text-zinc-200 hover:bg-emerald-500/20 hover:text-emerald-300 cursor-pointer flex items-center justify-between"
                              >
                                <span className="font-medium">{brand}</span>
                                <span className="text-[9px] text-muted-foreground">Marca cadastrada</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Modelo do Pod com Autocomplete Inteligente */}
                    <div className="space-y-1 relative">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                        <span>Modelo do Pod *</span>
                        {selectedStockModel && (
                          <span className="text-emerald-400 text-[9px] font-normal">
                            Preços sincronizados
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: V250, BC15K, V80..."
                        value={newPodModel}
                        onChange={(e) => handleModelChange(e.target.value)}
                        onFocus={() => setShowModelDropdown(true)}
                        onBlur={() => setTimeout(() => setShowModelDropdown(false), 250)}
                        className="w-full bg-black/50 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                      {showModelDropdown && filteredModelSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-[#181818] border border-emerald-500/50 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                          <div className="px-3 py-1.5 bg-black/70 text-[9px] text-emerald-400 uppercase font-bold sticky top-0 flex items-center justify-between backdrop-blur-sm">
                            <span>Produtos do Estoque</span>
                            <span>Venda / Custo</span>
                          </div>
                          {filteredModelSuggestions.map((sug) => (
                            <div
                              key={sug.key}
                              onMouseDown={() => handleSelectSuggestion(sug)}
                              className="px-3 py-2 hover:bg-emerald-500/15 cursor-pointer transition-colors flex items-center justify-between group"
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white group-hover:text-emerald-300">
                                    {sug.model}
                                  </span>
                                  <span className="text-[9px] uppercase px-1.5 py-0.5 bg-white/10 rounded text-zinc-300 font-semibold">
                                    {sug.brand}
                                  </span>
                                </div>
                                <span className="text-[10px] mt-0.5">
                                  {sug.totalStock > 0 ? (
                                    <span className="text-emerald-400 font-medium">● {sug.totalStock} un em estoque</span>
                                  ) : (
                                    <span className="text-zinc-500">● Sem estoque atual</span>
                                  )}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-bold text-emerald-400">R$ {sug.sellPrice.toFixed(2)}</div>
                                <div className="text-[10px] text-zinc-400">Custo: R$ {sug.costPrice.toFixed(2)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={newPodQty}
                        onChange={(e) => setNewPodQty(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                        <span>Custo Unitário (R$)</span>
                        {selectedStockModel && (
                          <span className="text-[9px] text-emerald-400 font-normal">Auto</span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPodCost}
                        onChange={(e) => setNewPodCost(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-400 focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                        <span>Sabores Escolhidos</span>
                        <span className="text-[9px] text-muted-foreground">Ex: Menthol (2x), Grape Ice (1x)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Watermelon Ice, Blue Razz..."
                        value={newPodFlavors}
                        onChange={(e) => setNewPodFlavors(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                      {/* Chips de Sabores Registrados no Estoque para esse modelo */}
                      {selectedStockModel && selectedStockModel.flavors.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          <span className="text-[9px] text-muted-foreground mr-1">Sabores no cadastro:</span>
                          {selectedStockModel.flavors.map((flv) => (
                            <button
                              key={flv}
                              type="button"
                              onClick={() => {
                                if (!newPodFlavors || newPodFlavors === "Sabores Sortidos") {
                                  setNewPodFlavors(flv);
                                } else if (!newPodFlavors.includes(flv)) {
                                  setNewPodFlavors(`${newPodFlavors}, ${flv}`);
                                }
                              }}
                              className="px-2 py-0.5 rounded text-[10px] bg-white/5 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 transition-colors cursor-pointer"
                            >
                              + {flv}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                        <span>Preço Venda Pretendido (R$)</span>
                        {selectedStockModel && (
                          <span className="text-[9px] text-emerald-400 font-normal">Auto</span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPodSell}
                        onChange={(e) => setNewPodSell(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                      {/* Margem estimada calculada em tempo real */}
                      {parseFloat(newPodSell) > 0 && parseFloat(newPodCost) > 0 && (
                        <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-0.5">
                          <span>Margem Estimada:</span>
                          <span className="font-bold text-emerald-400">
                            R$ {(parseFloat(newPodSell) - parseFloat(newPodCost)).toFixed(2)} (
                            {(
                              ((parseFloat(newPodSell) - parseFloat(newPodCost)) / parseFloat(newPodSell)) *
                              100
                            ).toFixed(0)}
                            %)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setShowAddPodForm(false)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-xs transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPodToOrder}
                      disabled={!newPodModel.trim()}
                      className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      Inserir no Pedido
                    </button>
                  </div>
                </div>
              )}

              {/* Tabela de Itens em Formato Horizontal Moderno */}
              <div className="bg-[#141414] border border-white/10 rounded-xl overflow-hidden">
                
                {/* Header da Tabela */}
                <div className="px-4 py-2.5 bg-[#1c1c1c] border-b border-white/10 hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider items-center">
                  <div className="col-span-2">Qtd</div>
                  <div className="col-span-4">Produto / Sabores</div>
                  <div className="col-span-2 text-right">Custo Unit.</div>
                  <div className="col-span-2 text-right">Custo Total</div>
                  <div className="col-span-1 text-right">Venda Est.</div>
                  <div className="col-span-1 text-center">Ações</div>
                </div>

                {/* Linhas dos Produtos */}
                <div className="divide-y divide-white/5">
                  {orderItems.map((item) => (
                    <div key={item.id} className="px-4 py-2.5 flex flex-col sm:grid sm:grid-cols-12 gap-2 items-center hover:bg-white/[0.02] transition-colors">
                      
                      {/* Qtd Stepper */}
                      <div className="col-span-2 flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start">
                        <div className="flex items-center bg-black/50 border border-white/10 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.id, -1)}
                            className="size-5 rounded bg-white/5 hover:bg-white/10 text-white grid place-items-center cursor-pointer transition-colors"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-emerald-400">
                            {item.qty}x
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.id, 1)}
                            className="size-5 rounded bg-white/5 hover:bg-white/10 text-white grid place-items-center cursor-pointer transition-colors"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                        <span className="sm:hidden text-xs font-bold text-white">
                          {item.brand} {item.model}
                        </span>
                      </div>

                      {/* Produto & Sabores */}
                      <div className="col-span-4 min-w-0 w-full">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate hidden sm:inline">
                            {item.brand} {item.model}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white/5 text-muted-foreground border border-white/10">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        
                        <input
                          type="text"
                          value={item.flavors}
                          onChange={(e) => handleUpdateItemField(item.id, "flavors", e.target.value)}
                          className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-emerald-400 text-[11px] text-muted-foreground focus:text-white px-0.5 py-0 focus:outline-none transition-colors"
                          placeholder="Sabores..."
                        />
                      </div>

                      {/* Custo Unitário */}
                      <div className="col-span-2 text-right w-full sm:w-auto flex sm:block justify-between items-center">
                        <span className="sm:hidden text-[10px] text-muted-foreground uppercase">Custo Unit:</span>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[11px] text-muted-foreground">R$</span>
                          <input
                            type="number"
                            value={item.unitCost}
                            onChange={(e) => handleUpdateItemField(item.id, "unitCost", parseFloat(e.target.value) || 0)}
                            className="w-14 bg-black/40 border border-white/10 hover:border-white/25 focus:border-emerald-400 rounded px-1.5 py-0.5 text-xs font-bold text-white text-right focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Custo Total */}
                      <div className="col-span-2 text-right w-full sm:w-auto flex sm:block justify-between items-center">
                        <span className="sm:hidden text-[10px] text-muted-foreground uppercase">Custo Total:</span>
                        <span className="text-xs font-bold text-white">
                          R$ {(item.qty * item.unitCost).toFixed(2)}
                        </span>
                      </div>

                      {/* Venda Pretendida */}
                      <div className="col-span-1 text-right w-full sm:w-auto flex sm:block justify-between items-center">
                        <span className="sm:hidden text-[10px] text-muted-foreground uppercase">Venda Est:</span>
                        <span className="text-xs font-semibold text-emerald-400">
                          R$ {item.unitSell.toFixed(2)}
                        </span>
                      </div>

                      {/* Ações */}
                      <div className="col-span-1 text-center flex justify-end sm:justify-center w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="size-6 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 grid place-items-center cursor-pointer transition-colors"
                          title="Remover item"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                    </div>
                  ))}

                  {orderItems.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground space-y-2">
                      <Package className="size-6 mx-auto text-muted-foreground/40" />
                      <p className="text-xs">Nenhum pod adicionado ao pedido.</p>
                      <button
                        type="button"
                        onClick={handleResetOrderToDefault}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold"
                      >
                        Restaurar Sugestão IA
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Resumo Financeiro Compacto & Frete Integrado */}
              <div className="bg-[#141414] border border-white/10 rounded-xl p-4 space-y-4">
                
                {/* Linha Compacta de Frete */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <DollarSign className="size-3.5 text-muted-foreground" />
                    <span className="font-semibold text-white">Frete Estimado do Fornecedor (SP):</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">R$</span>
                    <input
                      type="number"
                      value={supplierShippingFee}
                      onChange={(e) => setSupplierShippingFee(parseFloat(e.target.value) || 0)}
                      className="w-16 bg-black/50 border border-white/15 rounded px-2 py-0.5 text-xs font-bold text-white text-right focus:outline-none focus:border-emerald-400"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      (Diluído: <strong className="text-emerald-400">R$ {dilutedShippingPerPod}/pod</strong>)
                    </span>
                  </div>
                </div>

                {/* 4 Cards de Métricas Compactas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">TOTAL DE PEÇAS</span>
                    <span className="text-lg font-bold text-white">{totalUnitsInOrder} un</span>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">TOTAL INVESTIDO</span>
                    <span className="text-lg font-bold text-white">R$ {totalSpentWithShipping.toFixed(2)}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">FATURAMENTO PREVISTO</span>
                    <span className="text-lg font-bold text-white">R$ {totalSellOfOrder.toFixed(2)}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">LUCRO LÍQUIDO</span>
                    <span className="text-lg font-bold text-emerald-400">R$ {projectedNetProfit.toFixed(2)}</span>
                  </div>
                </div>

                {/* Botões de Ação para o Pedido: WhatsApp + Entrada Automática de Estoque */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyOrderText}
                    disabled={orderItems.length === 0}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {copiedOrder ? (
                      <>
                        <Check className="size-4 text-black" />
                        <span>Mensagem Copiada para a Área de Transferência</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-4 text-black" />
                        <span>Copiar Pedido Formatado para WhatsApp ({totalUnitsInOrder} Peças)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowConfirmStockEntryModal(true)}
                    disabled={orderItems.length === 0 || isProcessingStockEntry || stockEntryCompleted}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      stockEntryCompleted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50"
                    }`}
                  >
                    {isProcessingStockEntry ? (
                      <>
                        <Loader2 className="size-4 animate-spin text-white" />
                        <span>Adicionando produtos ao estoque...</span>
                      </>
                    ) : stockEntryCompleted ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-400" />
                        <span>✓ Estoque Atualizado</span>
                      </>
                    ) : (
                      <>
                        <PackageCheck className="size-4 text-white" />
                        <span>Adicionar ao Estoque</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              ABA 2: METAS & TERMÔMETRO DE CAIXA (ESTILO MINIMALISTA)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === "goals" && (
            <div className="space-y-4">

              {/* Banner de Saldo e Patrimônio Total */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#141414] border border-white/10 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    CAIXA EM MÃOS
                  </span>
                  <div className="text-xl font-bold text-emerald-400">
                    R$ {activeCash.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Disponível para compras</span>
                </div>

                <div className="bg-[#141414] border border-white/10 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    ESTOQUE EM PRATELEIRA
                  </span>
                  <div className="text-xl font-bold text-white">
                    R$ {stockRetailValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    {totalPodsInStock} pods a preço de venda
                  </span>
                </div>

                <div className="bg-[#141414] border border-white/10 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    PATRIMÔNIO LÍQUIDO TOTAL
                  </span>
                  <div className="text-xl font-bold text-white">
                    R$ {totalEquity.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Caixa + Valor dos Pods</span>
                </div>
              </div>

              {/* GATILHO #1: META DO LOTE DE COMPRA (COMPACTO) */}
              <div className="bg-[#141414] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">
                          Gatilho de Recompra: Lote Mínimo de R$ {activeReorderGoal.toLocaleString("pt-BR")}
                        </h4>
                        {!isEditingGoals && (
                          <button
                            type="button"
                            onClick={() => setIsEditingGoals(true)}
                            className="text-[10px] font-semibold text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Edit3 className="size-2.5" />
                            <span>Ajustar</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Diluição de frete de SP para ~R$ 2,94/pod
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3 self-end sm:self-center">
                    {isEditingGoals && (
                      <div className="flex items-center gap-1 bg-black/60 border border-emerald-500/40 rounded px-2 py-0.5">
                        <span className="text-xs font-bold text-emerald-400">R$</span>
                        <input
                          type="number"
                          value={tempGoals.reorderCashGoal}
                          onChange={(e) => setTempGoals({ ...tempGoals, reorderCashGoal: Number(e.target.value) || 0 })}
                          className="w-20 bg-transparent text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                    )}
                    <span className="text-xs font-bold text-emerald-400">
                      {reorderProgressPct}% Concluído
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${reorderProgressPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>R$ {activeCash.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} acumulados</span>
                    <span>Meta: R$ {activeReorderGoal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="bg-black/30 border border-white/5 rounded-lg p-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {cashNeededForReorder > 0 ? (
                      <>Faltam <strong className="text-emerald-400">R$ {cashNeededForReorder.toFixed(2)}</strong> em vendas (~{podsNeededToSell} pods) para acionar a compra.</>
                    ) : (
                      <strong className="text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="size-3.5 text-emerald-400 inline" />
                        META ATINGIDA — Saldo suficiente para o lote de R$ {activeReorderGoal.toLocaleString("pt-BR")}
                      </strong>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("order")}
                    className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20 transition-colors shrink-0 cursor-pointer"
                  >
                    Ver Pedido
                  </button>
                </div>
              </div>

              {/* GATILHO #2: TRANSIÇÃO DE ESCALA / PARAGUAI */}
              <div className="bg-[#141414] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-white shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">
                          Meta de Transição / Escala: R$ {activeParaguayGoal.toLocaleString("pt-BR")}
                        </h4>
                        {!isEditingGoals && (
                          <button
                            type="button"
                            onClick={() => setIsEditingGoals(true)}
                            className="text-[10px] font-semibold text-muted-foreground hover:text-white flex items-center gap-0.5 cursor-pointer"
                          >
                            <Edit3 className="size-2.5" />
                            <span>Ajustar</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Destrava compras diretas (+30% a +40% de margem líquida com freteiro)
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3 self-end sm:self-center">
                    {isEditingGoals && (
                      <div className="flex items-center gap-1 bg-black/60 border border-white/20 rounded px-2 py-0.5">
                        <span className="text-xs font-bold text-white">R$</span>
                        <input
                          type="number"
                          value={tempGoals.paraguayScaleGoal}
                          onChange={(e) => setTempGoals({ ...tempGoals, paraguayScaleGoal: Number(e.target.value) || 0 })}
                          className="w-20 bg-transparent text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                    )}
                    <span className="text-xs font-semibold text-white">
                      {paraguayProgressPct}% Concluído
                    </span>
                  </div>
                </div>

                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-white/40 rounded-full transition-all duration-300"
                    style={{ width: `${paraguayProgressPct}%` }}
                  />
                </div>
              </div>

              {/* PAINEL DE METAS PERIÓDICAS (MENSAL, TRIMESTRAL, ANUAL) */}
              <div className="bg-[#141414] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Metas Estratégicas Periódicas
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="border border-white/10 rounded-lg p-3 bg-black/30 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">META MENSAL</span>
                    {isEditingGoals ? (
                      <div className="flex items-center gap-1 bg-black/50 border border-white/20 rounded px-2 py-0.5">
                        <span className="text-xs font-bold text-white">R$</span>
                        <input
                          type="number"
                          value={tempGoals.monthlyRevenueGoal}
                          onChange={(e) => setTempGoals({ ...tempGoals, monthlyRevenueGoal: Number(e.target.value) || 0 })}
                          className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="text-base font-bold text-white">
                        R$ {goals.monthlyRevenueGoal.toLocaleString("pt-BR")}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground block">
                      ~{Math.round((isEditingGoals ? tempGoals.monthlyRevenueGoal : goals.monthlyRevenueGoal) / 85)} pods/mês
                    </span>
                  </div>

                  <div className="border border-white/10 rounded-lg p-3 bg-black/30 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">META TRIMESTRAL</span>
                    {isEditingGoals ? (
                      <div className="flex items-center gap-1 bg-black/50 border border-white/20 rounded px-2 py-0.5">
                        <span className="text-xs font-bold text-white">R$</span>
                        <input
                          type="number"
                          value={tempGoals.quarterlyRevenueGoal}
                          onChange={(e) => setTempGoals({ ...tempGoals, quarterlyRevenueGoal: Number(e.target.value) || 0 })}
                          className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="text-base font-bold text-white">
                        R$ {goals.quarterlyRevenueGoal.toLocaleString("pt-BR")}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground block">Escala contínua</span>
                  </div>

                  <div className="border border-white/10 rounded-lg p-3 bg-black/30 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">META ANUAL</span>
                    {isEditingGoals ? (
                      <div className="flex items-center gap-1 bg-black/50 border border-emerald-500/40 rounded px-2 py-0.5">
                        <span className="text-xs font-bold text-emerald-400">R$</span>
                        <input
                          type="number"
                          value={tempGoals.annualRevenueGoal}
                          onChange={(e) => setTempGoals({ ...tempGoals, annualRevenueGoal: Number(e.target.value) || 0 })}
                          className="w-full bg-transparent text-xs font-bold text-emerald-400 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="text-base font-bold text-emerald-400">
                        R$ {goals.annualRevenueGoal.toLocaleString("pt-BR")}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground block">Consolidação de mercado</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              ABA 3: MATRIZ DE SUBSTITUTOS DE FORNECEDOR (LIMPA)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === "contingency" && (
            <div className="space-y-4">
              <div className="bg-[#141414] border border-white/10 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Guia de Contingência: Substituição de Produtos
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Regras práticas caso faltem modelos ou sabores com o fornecedor
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-white/10 rounded-lg p-3.5 bg-black/30 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-red-400 shrink-0" />
                      <h5 className="text-xs font-bold text-white">Se faltar Elfbar BC15K</h5>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Substituir imediatamente por <strong className="text-white">Ignite V55 Ultra Thin</strong> (R$ 52), <strong className="text-white">Lost Mary OS5000</strong> ou <strong className="text-white">Elfbar BC5000</strong> para manter o ticket baixo e alto giro.
                    </p>
                  </div>

                  <div className="border border-white/10 rounded-lg p-3.5 bg-black/30 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-cyan-400 shrink-0" />
                      <h5 className="text-xs font-bold text-white">Se faltar Elfbar Ice King 40K</h5>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Substituir por <strong className="text-white">Elfbar TE30K</strong> (R$ 65), <strong className="text-white">Lost Mary 30K</strong> ou <strong className="text-white">Oxbar Magic Maze 30K</strong> para manter o apelo de alta contagem de puffs e tela.
                    </p>
                  </div>

                  <div className="border border-white/10 rounded-lg p-3.5 bg-black/30 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-amber-400 shrink-0" />
                      <h5 className="text-xs font-bold text-white">Se faltar Ignite V500 ou V80</h5>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Substituir por <strong className="text-white">Ignite V50 clássico</strong> (R$ 65) ou <strong className="text-white">Ignite V250</strong> (R$ 68), garantindo que a marca Ignite tenha sempre opções ativas no cardápio.
                    </p>
                  </div>

                  <div className="border border-white/10 rounded-lg p-3.5 bg-black/30 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
                      <h5 className="text-xs font-bold text-white">Regra de Ouro dos Sabores</h5>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Priorizar sempre a grade Ice: <em className="text-white font-medium">Watermelon Ice, Blueberry Ice, Grape Ice, Menthol/Spearmint, Strawberry Kiwi e Miami Mint</em> (Zero Encalhe).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ─── FOOTER MODAL ─── */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#0d0d0d] flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span className="text-[11px]">Diretriz Salva no Obsidian: Cérebro Smoking Pods</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white font-semibold transition-colors cursor-pointer text-xs"
          >
            Fechar
          </button>
        </div>

        {/* ─── MODAL DE CONFIRMAÇÃO DE ENTRADA NO ESTOQUE ─── */}
        {showConfirmStockEntryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#121212] border border-blue-500/30 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <PackageCheck className="size-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Adicionar produtos ao estoque?</h4>
                  <p className="text-xs text-muted-foreground">Confirmação de recebimento do pedido</p>
                </div>
              </div>

              <p className="text-xs text-silver leading-relaxed bg-black/40 border border-white/5 p-3 rounded-xl">
                Você está prestes a adicionar <strong className="text-white">{totalUnitsInOrder} unidades</strong> ao estoque. Essa operação atualizará o estoque dos produtos existentes e cadastrará automaticamente os novos produtos encontrados na lista.
              </p>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmStockEntryModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteStockEntry}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 cursor-pointer active:scale-95"
                >
                  Confirmar Entrada no Estoque
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL DE RESUMO DE CONCLUSÃO DA ENTRADA DE ESTOQUE ─── */}
        {stockEntryResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#121212] border border-emerald-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="size-6 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white uppercase tracking-wider">ENTRADA CONCLUÍDA</h4>
                    <p className="text-xs font-semibold text-emerald-400">{stockEntryResult.processedUnits} unidades processadas</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStockEntryResult(null)}
                  className="size-7 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white grid place-items-center cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-2 bg-black/50 border border-white/10 rounded-xl p-3 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-muted-foreground">Produtos existentes atualizados:</span>
                  <strong className="text-white">{stockEntryResult.existingUpdatedCount}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-muted-foreground">Produtos novos cadastrados:</span>
                  <strong className="text-emerald-400">{stockEntryResult.newProductsCreatedCount}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-muted-foreground">Variações atualizadas:</span>
                  <strong className="text-white">{stockEntryResult.variationsUpdatedCount}</strong>
                </div>
                <div className="flex justify-between py-1 pt-2 text-sm font-bold">
                  <span className="text-white">Total investido:</span>
                  <span className="text-emerald-400">R$ {stockEntryResult.totalInvested.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStockEntryResult(null)}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
