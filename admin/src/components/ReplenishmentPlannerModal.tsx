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
  ChevronDown,
  Search,
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
  { id: "1", brand: "Elfbar", model: "BC15K", qty: 3, unitCost: 48, unitSell: 64.99, flavors: "Blue Razz Ice (2x), Strawberry Kiwi" },
  { id: "2", brand: "Elfbar", model: "Ice King 40K", qty: 2, unitCost: 70, unitSell: 89.90, flavors: "Green Apple Ice, Watermelon Ice" },
  { id: "3", brand: "Lost Mary", model: "Dura 35K", qty: 3, unitCost: 65, unitSell: 79.90, flavors: "Pom. Cherry Pineapple, Grape Ice" },
  { id: "4", brand: "Oxbar", model: "50K", qty: 1, unitCost: 65, unitSell: 99.90, flavors: "Pineapple Ice" },
  { id: "5", brand: "Elfbar", model: "GH23K", qty: 1, unitCost: 65, unitSell: 86.90, flavors: "Grape Ice" },
  { id: "6", brand: "Ignite", model: "V500", qty: 1, unitCost: 80, unitSell: 108.90, flavors: "Strawberry Kiwi" },
  { id: "7", brand: "Ignite", model: "V55 Ultra Thin", qty: 1, unitCost: 52, unitSell: 71.90, flavors: "Strawberry Ice" },
  { id: "8", brand: "Ignite", model: "V80 Ultra Slim", qty: 1, unitCost: 55, unitSell: 78.90, flavors: "Passion Fruit Sour Kiwi" },
  { id: "9", brand: "Geek Bar", model: "Pulse 15K", qty: 2, unitCost: 70, unitSell: 94.90, flavors: "Miami Mint (2x)" },
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
  if (!trimmed || trimmed.toLowerCase() === "sabores sortidos") return [];

  const parts = trimmed.split(/,\s*/);
  if (parts.length <= 1) {
    const match = trimmed.match(/\((\d+)\s*x\)/i) || trimmed.match(/^(\d+)\s*x\s+/i);
    const clean = trimmed.replace(/\(\d+\s*x\)/gi, "").replace(/^\d+\s*x\s+/gi, "").trim();
    if (!clean) return [];
    const q = match ? parseInt(match[1]) || 1 : totalQty;
    return [{ flavor: clean, qty: Math.max(1, q) }];
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
    if (cleanFlavor) {
      result.push({ flavor: cleanFlavor, qty: Math.max(1, q) });
    }
  });

  return result;
}

export function formatFlavorsList(list: { flavor: string; qty: number }[]): string {
  if (!list || list.length === 0) return "";
  const valid = list.filter(f => f.flavor && f.flavor.trim().length > 0 && f.flavor.toLowerCase() !== "sabores sortidos");
  if (valid.length === 0) return "";
  return valid
    .map(f => `${f.flavor.trim()} (${f.qty}x)`)
    .join(", ");
}

export function formatFlavorsSummary(flavorsStr: string, totalQty: number): string {
  const parsed = parseFlavorsString(flavorsStr, totalQty);
  if (parsed.length === 0) return "";
  return parsed
    .map(f => `${f.flavor} ${f.qty > 1 ? `${f.qty}x` : "1x"}`)
    .join(" • ");
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

  // Gerenciamento Interativo de Sabores por Pod
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [flavorSearchQuery, setFlavorSearchQuery] = useState("");

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
              flavors: flavor ? [flavor] : [],
              totalStock: stock
            });
          } else {
            const existing = groupMap.get(key)!;
            existing.totalStock += stock;
            if (flavor && !existing.flavors.includes(flavor)) {
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

    const newItemId = Date.now().toString();
    const newItem: OrderItem = {
      id: newItemId,
      brand: newPodBrand.trim() || "Pod",
      model: newPodModel.trim(),
      qty: Math.max(1, parseInt(newPodQty) || 1),
      unitCost: parseFloat(newPodCost) || 65,
      unitSell: parseFloat(newPodSell) || 89.90,
      flavors: "",
    };

    const updated = [...orderItems, newItem];
    saveOrderItemsToStorage(updated);

    // Reset Form
    setNewPodBrand("");
    setNewPodModel("");
    setNewPodQty("1");
    setNewPodCost("65");
    setNewPodSell("89.90");
    setSelectedStockModel(null);
    setShowAddPodForm(false);
    setShowModelDropdown(false);
    setShowBrandDropdown(false);

    // Expande os sabores do novo item para seleção imediata
    setExpandedItemId(newItemId);
  };

  // Obter sabores cadastrados no catálogo/estoque para um modelo específico
  const getCatalogFlavorsForItem = (brand: string, model: string): string[] => {
    const qBrand = (brand || "").trim().toLowerCase();
    const qModel = (model || "").trim().toLowerCase();
    const match = stockSuggestions.find(
      (s) => s.model.toLowerCase() === qModel && (!qBrand || s.brand.toLowerCase() === qBrand)
    );
    return match ? match.flavors : [];
  };

  // Adicionar sabor à lista do item
  const handleAddFlavorToItem = (itemId: string, flavorName: string) => {
    const cleanName = flavorName.trim();
    if (!cleanName) return;

    const item = orderItems.find((it) => it.id === itemId);
    if (!item) return;

    const currentList = parseFlavorsString(item.flavors, item.qty);
    const existingIndex = currentList.findIndex(
      (f) => f.flavor.toLowerCase() === cleanName.toLowerCase()
    );

    let updatedList: { flavor: string; qty: number }[];
    if (existingIndex >= 0) {
      updatedList = currentList.map((f, idx) =>
        idx === existingIndex ? { ...f, qty: f.qty + 1 } : f
      );
    } else {
      updatedList = [
        ...currentList.filter((f) => f.flavor !== "Sabores Sortidos"),
        { flavor: cleanName, qty: 1 },
      ];
    }

    const newFlavorsStr = formatFlavorsList(updatedList);
    handleUpdateItemField(itemId, "flavors", newFlavorsStr);
    setFlavorSearchQuery("");
  };

  // Alterar quantidade de um sabor (+ ou -)
  const handleUpdateFlavorQty = (itemId: string, flavorName: string, delta: number) => {
    const item = orderItems.find((it) => it.id === itemId);
    if (!item) return;

    const currentList = parseFlavorsString(item.flavors, item.qty);
    const updatedList = currentList
      .map((f) => {
        if (f.flavor.toLowerCase() === flavorName.toLowerCase()) {
          const newQ = f.qty + delta;
          return newQ > 0 ? { ...f, qty: newQ } : null;
        }
        return f;
      })
      .filter(Boolean) as { flavor: string; qty: number }[];

    const newFlavorsStr = formatFlavorsList(updatedList);
    handleUpdateItemField(itemId, "flavors", newFlavorsStr);
  };

  // Remover sabor da lista
  const handleRemoveFlavorFromItem = (itemId: string, flavorName: string) => {
    const item = orderItems.find((it) => it.id === itemId);
    if (!item) return;

    const currentList = parseFlavorsString(item.flavors, item.qty);
    const updatedList = currentList.filter(
      (f) => f.flavor.toLowerCase() !== flavorName.toLowerCase()
    );
    const newFlavorsStr = formatFlavorsList(updatedList);
    handleUpdateItemField(itemId, "flavors", newFlavorsStr);
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
${orderItems.map(item => `• ${item.qty}x ${item.brand} ${item.model} (${item.flavors || "Sabores a definir"})`).join("\n")}

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
        if (flavorBreakdown.length === 0) {
          alert(`O modelo "${itemBrand} ${itemModel}" precisa ter pelo menos um sabor especificado para dar entrada de estoque.`);
          setIsProcessingStockEntry(false);
          return;
        }
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
                  Planejador de Estoque & Reposição
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                  {totalUnitsInOrder} {totalUnitsInOrder === 1 ? "peça" : "peças"} no pedido
                </span>
              </div>
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

        {/* ─── BARRA DE TOPO DO PEDIDO ATIVO ─── */}
        <div className="flex flex-wrap items-center justify-between border-b border-white/10 px-5 bg-[#0d0d0d] gap-2">
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 border-emerald-400 text-emerald-400">
              <ShoppingCart className="size-3.5" />
              <span>Pedido Ativo & WhatsApp</span>
            </div>
          </div>

          {/* Ação de Topo para Adicionar Produto ao Pedido */}
          <div className="py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddPodForm(!showAddPodForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm shadow-emerald-500/20"
            >
              <Plus className="size-3.5 text-black" />
              <span>Adicionar Pod ao Pedido</span>
            </button>
          </div>
        </div>

        {/* ─── CONTEÚDO PRINCIPAL (SCROLLÁVEL) ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar">

          {/* ════════════════════════════════════════════════════════════
              PEDIDO ATIVO & WHATSAPP (ESTRUTURA HORIZONTAL LIMPA)
          ════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">

              {/* Formulário Retrátil Inteligente para Adicionar Novo Pod ao Pedido */}
              {showAddPodForm && (
                <div className="bg-[#141414] border border-emerald-500/30 rounded-xl p-4 space-y-3.5 animate-in slide-in-from-top-2 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-lg bg-emerald-500/20 text-emerald-400 grid place-items-center">
                        <Plus className="size-3.5" />
                      </div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Adicionar Pod ao Pedido</h4>
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
                      <span className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
                        <Zap className="size-3" /> Modelos Frequentes do Estoque:
                      </span>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
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

                    {/* Quantidade */}
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

                    {/* Custo Unitário */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                        <span>Custo Unit. (R$)</span>
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

                    {/* Preço de Venda Pretendido */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                        <span>Venda Prev. (R$)</span>
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
                    </div>
                  </div>

                  {/* Rodapé do Formulário: Margem Estimada Compacta + Botões */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/5">
                    <div className="text-[11px] text-zinc-400">
                      {parseFloat(newPodSell) > 0 && parseFloat(newPodCost) > 0 ? (
                        <span>
                          Margem estimada: <strong className="text-emerald-400 font-semibold">R$ {(parseFloat(newPodSell) - parseFloat(newPodCost)).toFixed(2)}</strong> (
                          {(
                            ((parseFloat(newPodSell) - parseFloat(newPodCost)) / parseFloat(newPodSell)) * 100
                          ).toFixed(0)}
                          %)
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 text-[10px]">
                          Informe custo e venda para calcular margem
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
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
                        className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95"
                      >
                        Inserir no Pedido
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista Principal de Produtos (Design Minimalista, Compacto e Escaneável) */}
              <div className="space-y-3">
                {orderItems.map((item) => {
                  const parsedFlavors = parseFlavorsString(item.flavors, item.qty);
                  const allocatedCount = parsedFlavors.reduce((acc, f) => acc + f.qty, 0);
                  const flavorsSummary = formatFlavorsSummary(item.flavors, item.qty);
                  const isExpanded = expandedItemId === item.id;
                  const catalogFlavors = getCatalogFlavorsForItem(item.brand, item.model);
                  const filteredCatalog = catalogFlavors.filter((cf) =>
                    !flavorSearchQuery || cf.toLowerCase().includes(flavorSearchQuery.toLowerCase())
                  );

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border transition-all ${
                        isExpanded
                          ? "bg-[#141416] border-emerald-500/40 shadow-xl shadow-black/50"
                          : "bg-[#121214] border-white/10 hover:border-white/20"
                      }`}
                    >
                      {/* Bloco Principal do Produto */}
                      <div className="p-3.5 sm:p-4 space-y-2.5">
                        
                        {/* Linha Superior: Nome do Modelo (Esquerda) e Stepper de Quantidade (Direita) */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-bold text-white tracking-wide uppercase truncate">
                              {item.brand} {item.model}
                            </span>
                          </div>

                          {/* Stepper de Quantidade do Produto */}
                          <div className="flex items-center bg-black/60 border border-white/10 rounded-lg p-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(item.id, -1)}
                              className="size-6 rounded bg-white/5 hover:bg-white/10 text-white grid place-items-center cursor-pointer transition-colors active:scale-95"
                              title="Diminuir quantidade"
                            >
                              <Minus className="size-3" />
                            </button>
                            <span className="w-9 text-center text-xs font-bold text-emerald-400">
                              {item.qty}x
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(item.id, 1)}
                              className="size-6 rounded bg-white/5 hover:bg-white/10 text-white grid place-items-center cursor-pointer transition-colors active:scale-95"
                              title="Aumentar quantidade"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                        </div>

                        {/* Sub-linha: Resumo Legível dos Sabores */}
                        <div className="text-xs">
                          {flavorsSummary ? (
                            <span className="text-zinc-300 font-medium">
                              {flavorsSummary}
                            </span>
                          ) : (
                            <span className="text-amber-400/80 italic text-[11px] flex items-center gap-1">
                              <AlertCircle className="size-3" /> Nenhum sabor distribuído (clique em Sabores para definir)
                            </span>
                          )}
                        </div>

                        {/* Linha Inferior: Métricas Financeiras & Ações */}
                        <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          {/* Métricas Financeiras */}
                          <div className="flex items-center gap-3 sm:gap-4 text-xs text-zinc-400 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground uppercase">Custo unitário:</span>
                              <div className="flex items-center gap-0.5">
                                <span className="text-[11px] text-muted-foreground">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unitCost}
                                  onChange={(e) => handleUpdateItemField(item.id, "unitCost", parseFloat(e.target.value) || 0)}
                                  className="w-16 bg-black/50 border border-white/10 hover:border-emerald-500/40 focus:border-emerald-400 rounded px-1.5 py-0.5 text-xs font-bold text-white text-right focus:outline-none transition-colors"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground uppercase">Custo total:</span>
                              <span className="font-bold text-white">
                                R$ {(item.qty * item.unitCost).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground uppercase">Venda estimada:</span>
                              <span className="font-semibold text-emerald-400">
                                R$ {item.unitSell.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Ações: [Sabores ▾] e [🗑] */}
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setFlavorSearchQuery("");
                                setExpandedItemId(isExpanded ? null : item.id);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                isExpanded
                                  ? "bg-emerald-500 text-black shadow-sm"
                                  : allocatedCount === item.qty && allocatedCount > 0
                                  ? "bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/30"
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              }`}
                            >
                              <span>Sabores</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                isExpanded
                                  ? "bg-black/20 text-black"
                                  : allocatedCount === item.qty && allocatedCount > 0
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}>
                                {allocatedCount}/{item.qty}
                              </span>
                              <ChevronDown className={`size-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="size-7 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 grid place-items-center cursor-pointer transition-colors"
                              title="Remover produto da lista"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline Accordion de Sabores */}
                      {isExpanded && (
                        <div className="border-t border-white/10 bg-[#0d0d0f] p-3 sm:p-4 space-y-3.5 rounded-b-xl animate-in fade-in duration-150">
                          {/* Topo do Accordion: Título + Contador Claro + Botão Fechar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-white/5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-xs font-bold uppercase tracking-wider text-white">
                                SABORES — {item.brand} {item.model}
                              </span>

                              {/* Contador de unidades com apresentação clara */}
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  allocatedCount === item.qty
                                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                    : allocatedCount > item.qty
                                    ? "bg-red-500/15 border-red-500/30 text-red-400"
                                    : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                }`}
                              >
                                {allocatedCount}/{item.qty} unidades distribuídas
                                {allocatedCount < item.qty && ` (faltam ${item.qty - allocatedCount})`}
                                {allocatedCount > item.qty && ` (excesso de ${allocatedCount - item.qty})`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              {allocatedCount !== item.qty && allocatedCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemField(item.id, "qty", allocatedCount)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                                  title="Ajustar a quantidade do pod para coincidir com os sabores distribuídos"
                                >
                                  Ajustar Pod para {allocatedCount} un
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setExpandedItemId(null)}
                                className="size-6 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white grid place-items-center cursor-pointer transition-colors"
                                title="Fechar painel de sabores"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Barra de Busca / Adicionar Sabor */}
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Pesquisar sabor ou digitar novo..."
                                value={flavorSearchQuery}
                                onChange={(e) => setFlavorSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && flavorSearchQuery.trim()) {
                                    e.preventDefault();
                                    handleAddFlavorToItem(item.id, flavorSearchQuery);
                                  }
                                }}
                                className="w-full bg-black/60 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-400 transition-colors"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddFlavorToItem(item.id, flavorSearchQuery)}
                              disabled={!flavorSearchQuery.trim()}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                            >
                              + Adicionar
                            </button>
                          </div>

                          {/* SEÇÃO 1: SABORES DISPONÍVEIS */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              <span>SABORES DISPONÍVEIS ({filteredCatalog.length})</span>
                              <span className="text-[9px] text-zinc-500 font-normal">Clique para incluir no pedido</span>
                            </div>

                            {filteredCatalog.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto custom-scrollbar p-0.5">
                                {filteredCatalog.map((flv) => {
                                  const inList = parsedFlavors.find(
                                    (f) => f.flavor.toLowerCase() === flv.toLowerCase()
                                  );
                                  return (
                                    <button
                                      key={flv}
                                      type="button"
                                      onClick={() => handleAddFlavorToItem(item.id, flv)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                                        inList
                                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold"
                                          : "bg-white/5 border-white/10 text-zinc-300 hover:border-emerald-500/40 hover:text-white hover:bg-white/10"
                                      }`}
                                    >
                                      <span>{inList ? "✓" : "+"}</span>
                                      <span>{flv}</span>
                                      {inList && (
                                        <span className="text-[10px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                          {inList.qty}x
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[11px] text-zinc-500 italic py-0.5">
                                {flavorSearchQuery.trim()
                                  ? `Nenhum sabor cadastrado encontrado para "${flavorSearchQuery}". Clique em "+ Adicionar" acima para incluir.`
                                  : "Nenhum sabor cadastrado no estoque para este modelo. Digite o sabor acima para adicionar."}
                              </p>
                            )}
                          </div>

                          {/* SEÇÃO 2: SABORES SELECIONADOS */}
                          <div className="space-y-2 pt-1 border-t border-white/5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              SABORES SELECIONADOS ({parsedFlavors.length})
                            </div>

                            {parsedFlavors.length === 0 ? (
                              <div className="p-3 rounded-lg bg-black/30 border border-dashed border-white/10 text-center text-xs text-muted-foreground">
                                Nenhum sabor adicionado ainda. Escolha um dos sabores disponíveis acima ou digite no campo de busca.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-0.5">
                                {parsedFlavors.map((flv, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-2 px-2.5 rounded-lg bg-black/40 border border-white/10 gap-2"
                                  >
                                    <span className="text-xs font-semibold text-white truncate min-w-0 flex-1">
                                      {flv.flavor}
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <div className="flex items-center bg-black/60 border border-white/10 rounded-md p-0.5">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateFlavorQty(item.id, flv.flavor, -1)}
                                          className="size-5 rounded bg-white/5 hover:bg-white/10 text-white grid place-items-center cursor-pointer transition-colors active:scale-95"
                                          title="Diminuir quantidade"
                                        >
                                          <Minus className="size-3" />
                                        </button>
                                        <span className="w-6 text-center text-xs font-bold text-emerald-400">
                                          {flv.qty}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateFlavorQty(item.id, flv.flavor, 1)}
                                          className="size-5 rounded bg-white/5 hover:bg-white/10 text-white grid place-items-center cursor-pointer transition-colors active:scale-95"
                                          title="Aumentar quantidade"
                                        >
                                          <Plus className="size-3" />
                                        </button>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveFlavorFromItem(item.id, flv.flavor)}
                                        className="size-6 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 grid place-items-center cursor-pointer transition-colors"
                                        title="Remover sabor"
                                      >
                                        <Trash2 className="size-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Footer do Accordion */}
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedItemId(null)}
                              className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Concluir Sabores
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {orderItems.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground space-y-2 bg-[#141414] border border-white/10 rounded-xl">
                    <Package className="size-6 mx-auto text-muted-foreground/40" />
                    <p className="text-xs">Nenhum pod adicionado ao pedido.</p>
                    <button
                      type="button"
                      onClick={handleResetOrderToDefault}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold cursor-pointer"
                    >
                      Restaurar Sugestão IA
                    </button>
                  </div>
                )}
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

        </div>

        {/* ─── FOOTER MODAL ─── */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#0d0d0d] flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span className="text-[11px] text-muted-foreground">Sincronizado com Estoque e Financeiro</span>
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
