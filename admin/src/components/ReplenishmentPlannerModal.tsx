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
  Minus
} from "lucide-react";

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

export interface FinancialGoals {
  reorderCashGoal: number; // ex: 1000, 2000, 5000
  paraguayScaleGoal: number; // ex: 5000, 10000, 25000
  monthlyRevenueGoal: number; // ex: 8000
  quarterlyRevenueGoal: number; // ex: 25000
  annualRevenueGoal: number; // ex: 100000
}

export const DEFAULT_GOALS: FinancialGoals = {
  reorderCashGoal: 1000,
  paraguayScaleGoal: 5000,
  monthlyRevenueGoal: 8000,
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

interface ReplenishmentPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCash?: number;
  stockRetailValue?: number;
  stockCostValue?: number;
  totalPodsInStock?: number;
  onGoalsUpdated?: (newGoals: FinancialGoals) => void;
}

export const ReplenishmentPlannerModal: React.FC<ReplenishmentPlannerModalProps> = ({
  isOpen,
  onClose,
  currentCash = 513,
  stockRetailValue = 1042.89,
  stockCostValue = 783,
  totalPodsInStock = 12,
  onGoalsUpdated,
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

  // Formulário para Adicionar Novo Pod ao Pedido
  const [showAddPodForm, setShowAddPodForm] = useState(false);
  const [newPodBrand, setNewPodBrand] = useState("");
  const [newPodModel, setNewPodModel] = useState("");
  const [newPodQty, setNewPodQty] = useState("1");
  const [newPodCost, setNewPodCost] = useState("65");
  const [newPodSell, setNewPodSell] = useState("89.90");
  const [newPodFlavors, setNewPodFlavors] = useState("Sabores Sortidos");

  useEffect(() => {
    if (isOpen) {
      const curGoals = loadSavedGoals();
      setGoals(curGoals);
      setTempGoals(curGoals);
      setOrderItems(loadSavedOrderItems());
      setIsEditingGoals(false);
      setShowAddPodForm(false);
      setSavedSuccessAlert(false);
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
    setShowAddPodForm(false);
  };

  const handleResetOrderToDefault = () => {
    saveOrderItemsToStorage(DEFAULT_ORDER_ITEMS);
  };

  // Salvar Metas
  const handleSaveGoals = () => {
    setGoals(tempGoals);
    setIsEditingGoals(false);
    setSavedSuccessAlert(true);
    setTimeout(() => setSavedSuccessAlert(false), 3000);

    try {
      localStorage.setItem(LOCAL_STORAGE_GOALS_KEY, JSON.stringify(tempGoals));
    } catch (e) {}

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

  // Cálculos de Metas em Tempo Real
  const activeReorderGoal = isEditingGoals ? tempGoals.reorderCashGoal : goals.reorderCashGoal;
  const activeParaguayGoal = isEditingGoals ? tempGoals.paraguayScaleGoal : goals.paraguayScaleGoal;

  const totalEquity = currentCash + stockRetailValue;
  const cashNeededForReorder = Math.max(0, activeReorderGoal - currentCash);
  const reorderProgressPct = activeReorderGoal > 0 ? Math.min(100, Math.round((currentCash / activeReorderGoal) * 100)) : 100;

  const averagePodPrice = totalPodsInStock > 0 ? stockRetailValue / totalPodsInStock : 86.9;
  const podsNeededToSell = averagePodPrice > 0 ? Math.ceil(cashNeededForReorder / averagePodPrice) : 0;
  const paraguayProgressPct = activeParaguayGoal > 0 ? Math.min(100, Math.round((totalEquity / activeParaguayGoal) * 100)) : 100;

  // Gerador de Texto para WhatsApp do Fornecedor Baseado na Lista Real do Usuário
  const generatedWhatsAppMessage = useMemo(() => {
    return `📦 *PEDIDO DE REPOSIÇÃO — SMOKING PODS*
📍 *Origem:* São Bernardo do Campo / SP
💰 *Lote Total:* R$ ${totalSpentWithShipping.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

*LISTA DE MODELOS E QUANTIDADES:*
${orderItems.map(item => `• ${item.qty}x ${item.brand} ${item.model} (${item.flavors})`).join("\n")}

*Total de Peças:* ${totalUnitsInOrder} unidades
*Frete Estimado:* R$ ${supplierShippingFee.toFixed(2)} (Diluído: R$ ${dilutedShippingPerPod}/pod)

Por favor, me confirme a disponibilidade destes sabores e a chave Pix para faturarmos o pedido! 🚀`;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f1216] border border-white/15 rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* ─── HEADER MODAL ─── */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-transparent to-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)] shrink-0">
              <Boxes className="size-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Planejador de Estoque, Recompra & Metas
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider">
                  {totalUnitsInOrder} Peças no Pedido
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Monte, adicione e personalize o pedido exato para envio ao fornecedor
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ─── NAVEGAÇÃO DE ABAS ─── */}
        <div className="flex flex-wrap items-center justify-between border-b border-white/10 px-4 sm:px-6 bg-black/30 gap-2">
          <div className="flex">
            <button
              type="button"
              onClick={() => setActiveTab("order")}
              className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "order"
                  ? "border-amber-400 text-amber-400 bg-amber-500/5"
                  : "border-transparent text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <ShoppingCart className="size-3.5" />
              <span>📦 Pedido Ativo & WhatsApp ({totalUnitsInOrder} pods)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("goals")}
              className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "goals"
                  ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                  : "border-transparent text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <Target className="size-3.5" />
              <span>🎯 Metas & Termômetro de Caixa</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("contingency")}
              className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "contingency"
                  ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
                  : "border-transparent text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>🔄 Matriz de Substitutos</span>
            </button>
          </div>

          {/* Ações de Topo para Pedido e Metas */}
          {activeTab === "order" && (
            <div className="py-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetOrderToDefault}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                title="Voltar para a sugestão padrão de 15 peças da IA"
              >
                <RotateCcw className="size-3 inline mr-1" />
                Restaurar Sugestão IA
              </button>
              <button
                type="button"
                onClick={() => setShowAddPodForm(!showAddPodForm)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black text-xs font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all cursor-pointer active:scale-95"
              >
                <Plus className="size-3.5 text-black" />
                <span>Adicionar Pod ao Pedido</span>
              </button>
            </div>
          )}

          {activeTab === "goals" && (
            <div className="py-2 flex items-center gap-2">
              {savedSuccessAlert && (
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 animate-in fade-in">
                  <CheckCircle2 className="size-3.5" /> Metas salvas!
                </span>
              )}
              {!isEditingGoals ? (
                <button
                  type="button"
                  onClick={() => setIsEditingGoals(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black text-xs font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all cursor-pointer active:scale-95"
                >
                  <Edit3 className="size-3.5 text-black" />
                  <span>Editar Todos os Gatilhos & Metas</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleResetGoals}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="size-3" />
                    <span>Padrão</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingGoals(false)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGoals}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(16,185,129,0.35)] cursor-pointer active:scale-95"
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">

          {/* ════════════════════════════════════════════════════════════
              ABA 1: PEDIDO ATIVO & WHATSAPP (100% DINÂMICO)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === "order" && (
            <div className="space-y-6">

              {/* Formulário Retrátil para Adicionar Novo Pod ao Pedido */}
              {showAddPodForm && (
                <div className="bg-card border border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-4 bg-gradient-to-b from-emerald-950/25 to-transparent shadow-[0_0_20px_rgba(16,185,129,0.1)] animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plus className="size-4 text-emerald-400" />
                      <h4 className="text-sm font-bold text-white">Adicionar Novo Modelo / Pod ao Pedido</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddPodForm(false)}
                      className="size-6 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white grid place-items-center"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Marca</label>
                      <input
                        type="text"
                        placeholder="Ex: Elfbar, Ignite, Waka..."
                        value={newPodBrand}
                        onChange={(e) => setNewPodBrand(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Modelo do Pod *</label>
                      <input
                        type="text"
                        placeholder="Ex: BC15K, Pulse 15K, V50..."
                        value={newPodModel}
                        onChange={(e) => setNewPodModel(e.target.value)}
                        className="w-full bg-black/50 border border-emerald-500/50 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={newPodQty}
                        onChange={(e) => setNewPodQty(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Custo Unitário (R$)</label>
                      <input
                        type="number"
                        value={newPodCost}
                        onChange={(e) => setNewPodCost(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-muted-foreground">Sabores Escolhidos</label>
                      <input
                        type="text"
                        placeholder="Ex: Watermelon Ice, Blue Razz, Grape..."
                        value={newPodFlavors}
                        onChange={(e) => setNewPodFlavors(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Preço de Venda Pretendido (R$)</label>
                      <input
                        type="number"
                        value={newPodSell}
                        onChange={(e) => setNewPodSell(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddPodForm(false)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPodToOrder}
                      disabled={!newPodModel.trim()}
                      className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer"
                    >
                      Confirmar e Inserir no Pedido
                    </button>
                  </div>
                </div>
              )}

              {/* Tabela Interativa de Itens do Pedido */}
              <div className="bg-card border border-white/10 rounded-2xl overflow-hidden shadow-lg">
                <div className="p-4 bg-white/5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-emerald-400" />
                    <span className="text-xs uppercase font-bold text-white tracking-wider">
                      Itens do Pedido de Reposição ({totalUnitsInOrder} Peças • Custo Produtos: R$ {totalCostOfOrder.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Edite quantidades (+ / -), custos ou remova itens
                  </span>
                </div>

                <div className="divide-y divide-white/5">
                  {orderItems.map((item) => (
                    <div key={item.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors">
                      
                      {/* Dados do Pod */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Stepper de Quantidade */}
                        <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.id, -1)}
                            className="size-6 rounded-lg bg-white/5 hover:bg-white/10 text-white grid place-items-center cursor-pointer transition-colors"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-extrabold text-emerald-400">
                            {item.qty}x
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.id, 1)}
                            className="size-6 rounded-lg bg-white/5 hover:bg-white/10 text-white grid place-items-center cursor-pointer transition-colors"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white truncate">
                              {item.brand} {item.model}
                            </span>
                            {item.badge && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/5 text-silver border border-white/10 shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          
                          {/* Edição Rápida de Sabores */}
                          <div className="mt-1">
                            <input
                              type="text"
                              value={item.flavors}
                              onChange={(e) => handleUpdateItemField(item.id, "flavors", e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-emerald-400 text-xs text-muted-foreground focus:text-white px-1 py-0.5 focus:outline-none transition-colors"
                              placeholder="Sabores deste modelo..."
                            />
                          </div>
                        </div>
                      </div>

                      {/* Valores e Custo Unitário Editável */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 self-stretch sm:self-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Custo Unit.</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">R$</span>
                            <input
                              type="number"
                              value={item.unitCost}
                              onChange={(e) => handleUpdateItemField(item.id, "unitCost", parseFloat(e.target.value) || 0)}
                              className="w-14 bg-black/30 border border-white/10 hover:border-white/25 focus:border-emerald-400 rounded px-1.5 py-0.5 text-xs font-bold text-white text-right focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Custo Total</span>
                          <span className="text-xs font-extrabold text-white">
                            R$ {(item.qty * item.unitCost).toFixed(2)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Venda Est.</span>
                          <span className="text-xs font-bold text-emerald-400">
                            R$ {item.unitSell.toFixed(2)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="size-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 grid place-items-center cursor-pointer transition-colors ml-1"
                          title="Remover do pedido"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                    </div>
                  ))}

                  {orderItems.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground space-y-2">
                      <Package className="size-8 mx-auto text-muted-foreground/50" />
                      <p className="text-xs">Nenhum pod adicionado ao pedido.</p>
                      <button
                        type="button"
                        onClick={handleResetOrderToDefault}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold"
                      >
                        Carregar Sugestão da IA
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Totalizador Financeiro e Reconciliação em Tempo Real */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
                
                {/* Linha de Custo de Frete do Fornecedor */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <DollarSign className="size-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white">Frete Estimado do Fornecedor de SP:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <input
                      type="number"
                      value={supplierShippingFee}
                      onChange={(e) => setSupplierShippingFee(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs font-bold text-cyan-300 text-right focus:outline-none focus:border-cyan-400"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      (Diluído: <strong className="text-cyan-400">R$ {dilutedShippingPerPod}/pod</strong>)
                    </span>
                  </div>
                </div>

                {/* 4 Cards de Métricas Consolidadas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total de Peças</span>
                    <span className="text-xl font-extrabold text-white">{totalUnitsInOrder} un</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Investido</span>
                    <span className="text-xl font-extrabold text-white">R$ {totalSpentWithShipping.toFixed(2)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Faturamento Previsto</span>
                    <span className="text-xl font-bold text-amber-300">R$ {totalSellOfOrder.toFixed(2)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">Lucro Líquido Limpo</span>
                    <span className="text-xl font-extrabold text-emerald-400">R$ {projectedNetProfit.toFixed(2)}</span>
                  </div>
                </div>

                {/* Botão de Cópia para WhatsApp com a lista exata */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCopyOrderText}
                    disabled={orderItems.length === 0}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {copiedOrder ? (
                      <>
                        <Check className="size-4 text-black" />
                        <span>✅ Mensagem do Pedido Copiada para a Área de Transferência!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-4 text-black" />
                        <span>📋 Copiar Pedido Formatado para o WhatsApp do Fornecedor ({totalUnitsInOrder} Peças)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              ABA 2: METAS & TERMÔMETRO DE CAIXA
          ════════════════════════════════════════════════════════════ */}
          {activeTab === "goals" && (
            <div className="space-y-6">

              {/* Banner de Saldo e Patrimônio Total */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-card border border-white/10 rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Caixa em Mãos
                  </span>
                  <div className="text-2xl font-extrabold text-emerald-400">
                    R$ {currentCash.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-muted-foreground">Disponível para compras</span>
                </div>

                <div className="bg-card border border-white/10 rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Estoque em Prateleira
                  </span>
                  <div className="text-2xl font-extrabold text-white">
                    R$ {stockRetailValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {totalPodsInStock} pods a preço de venda
                  </span>
                </div>

                <div className="bg-card border border-white/10 rounded-xl p-4 flex flex-col gap-1 bg-gradient-to-br from-white/[0.04] to-transparent">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                    Patrimônio Líquido Total
                  </span>
                  <div className="text-2xl font-extrabold text-amber-300">
                    R$ {totalEquity.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-muted-foreground">Caixa + Valor dos Pods</span>
                </div>
              </div>

              {/* GATILHO #1: META DO LOTE DE COMPRA (100% EDITÁVEL) */}
              <div className="bg-card border border-emerald-500/30 rounded-2xl p-5 space-y-4 bg-gradient-to-b from-emerald-950/20 to-transparent shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-emerald-500/20 text-emerald-400 grid place-items-center shrink-0">
                      <Zap className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">
                          Gatilho de Recompra: Lote Mínimo de R$ {activeReorderGoal.toLocaleString("pt-BR")}
                        </h4>
                        {!isEditingGoals && (
                          <button
                            type="button"
                            onClick={() => setIsEditingGoals(true)}
                            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 cursor-pointer"
                            title="Editar valor deste gatilho"
                          >
                            <Edit3 className="size-3" />
                            <span>Ajustar Gatilho</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Diluição de frete de SP para ~R$ 2,94/pod — Protege a margem e cresce junto com o caixa
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3 self-end sm:self-center">
                    {isEditingGoals && (
                      <div className="flex items-center gap-1.5 bg-black/60 border border-emerald-400/50 rounded-xl px-2.5 py-1">
                        <span className="text-xs font-bold text-emerald-400">R$</span>
                        <input
                          type="number"
                          value={tempGoals.reorderCashGoal}
                          onChange={(e) => setTempGoals({ ...tempGoals, reorderCashGoal: Number(e.target.value) || 0 })}
                          className="w-24 bg-transparent text-sm font-extrabold text-white focus:outline-none"
                          placeholder="1000"
                        />
                      </div>
                    )}
                    <span className="text-xs font-bold text-emerald-400">
                      {reorderProgressPct}% Concluído
                    </span>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="space-y-1.5">
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full transition-all duration-500"
                      style={{ width: `${reorderProgressPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>R$ {currentCash.toFixed(2)} acumulados</span>
                    <span className="font-semibold text-white">Meta do Lote: R$ {activeReorderGoal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Diagnóstico de Vendas Restantes */}
                <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Flame className="size-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-silver">
                      {cashNeededForReorder > 0 ? (
                        <>Faltam apenas <strong className="text-emerald-400">R$ {cashNeededForReorder.toFixed(2)}</strong> em vendas (<strong className="text-amber-300">~{podsNeededToSell} pods</strong> vendidos) para acionar a compra!</>
                      ) : (
                        <strong className="text-emerald-400">🎉 META ALCANÇADA! O caixa já tem saldo suficiente para o lote de R$ {activeReorderGoal.toLocaleString("pt-BR")}!</strong>
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("order")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shrink-0 cursor-pointer"
                  >
                    <span>Ver Pedido</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* GATILHO #2: TRANSIÇÃO DE ESCALA / PARAGUAI (100% EDITÁVEL) */}
              <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-cyan-500/20 text-cyan-400 grid place-items-center shrink-0">
                      <Target className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">
                          Meta de Transição / Escala: R$ {activeParaguayGoal.toLocaleString("pt-BR")}
                        </h4>
                        {!isEditingGoals && (
                          <button
                            type="button"
                            onClick={() => setIsEditingGoals(true)}
                            className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 cursor-pointer"
                            title="Editar valor desta meta de escala"
                          >
                            <Edit3 className="size-3" />
                            <span>Ajustar Escala</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Destrava compras diretas no Paraguai / Foz (+30% a +40% de margem líquida com freteiro)
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3 self-end sm:self-center">
                    {isEditingGoals && (
                      <div className="flex items-center gap-1.5 bg-black/60 border border-cyan-400/50 rounded-xl px-2.5 py-1">
                        <span className="text-xs font-bold text-cyan-400">R$</span>
                        <input
                          type="number"
                          value={tempGoals.paraguayScaleGoal}
                          onChange={(e) => setTempGoals({ ...tempGoals, paraguayScaleGoal: Number(e.target.value) || 0 })}
                          className="w-24 bg-transparent text-sm font-extrabold text-white focus:outline-none"
                          placeholder="5000"
                        />
                      </div>
                    )}
                    <span className="text-xs font-bold text-cyan-400">
                      {paraguayProgressPct}% Concluído (Patrimônio R$ {totalEquity.toFixed(0)})
                    </span>
                  </div>
                </div>

                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${paraguayProgressPct}%` }}
                  />
                </div>
              </div>

              {/* PAINEL DE METAS PERIÓDICAS (MENSAL, TRIMESTRAL, ANUAL) — 100% EDITÁVEIS */}
              <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-amber-400" />
                    <h4 className="text-xs uppercase font-bold text-silver tracking-wider">
                      Metas Estratégicas Periódicas (Faturamento & Patrimônio)
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="border border-white/10 rounded-xl p-3.5 bg-black/20 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Meta Mensal (Faturamento)</span>
                    {isEditingGoals ? (
                      <div className="flex items-center gap-1 bg-black/50 border border-amber-400/50 rounded-lg px-2 py-1">
                        <span className="text-xs font-bold text-amber-400">R$</span>
                        <input
                          type="number"
                          value={tempGoals.monthlyRevenueGoal}
                          onChange={(e) => setTempGoals({ ...tempGoals, monthlyRevenueGoal: Number(e.target.value) || 0 })}
                          className="w-full bg-transparent text-sm font-bold text-amber-300 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="text-lg font-bold text-white">
                        R$ {goals.monthlyRevenueGoal.toLocaleString("pt-BR")}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground block">
                      ~{Math.round((isEditingGoals ? tempGoals.monthlyRevenueGoal : goals.monthlyRevenueGoal) / 85)} pods/mês
                    </span>
                  </div>

                  <div className="border border-white/10 rounded-xl p-3.5 bg-black/20 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Meta Trimestral (Q1..Q4)</span>
                    {isEditingGoals ? (
                      <div className="flex items-center gap-1 bg-black/50 border border-amber-400/50 rounded-lg px-2 py-1">
                        <span className="text-xs font-bold text-amber-400">R$</span>
                        <input
                          type="number"
                          value={tempGoals.quarterlyRevenueGoal}
                          onChange={(e) => setTempGoals({ ...tempGoals, quarterlyRevenueGoal: Number(e.target.value) || 0 })}
                          className="w-full bg-transparent text-sm font-bold text-amber-300 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="text-lg font-bold text-white">
                        R$ {goals.quarterlyRevenueGoal.toLocaleString("pt-BR")}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground block">Escala contínua</span>
                  </div>

                  <div className="border border-white/10 rounded-xl p-3.5 bg-black/20 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Meta Anual (Consolidação)</span>
                    {isEditingGoals ? (
                      <div className="flex items-center gap-1 bg-black/50 border border-emerald-400/50 rounded-lg px-2 py-1">
                        <span className="text-xs font-bold text-emerald-400">R$</span>
                        <input
                          type="number"
                          value={tempGoals.annualRevenueGoal}
                          onChange={(e) => setTempGoals({ ...tempGoals, annualRevenueGoal: Number(e.target.value) || 0 })}
                          className="w-full bg-transparent text-sm font-bold text-emerald-300 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="text-lg font-bold text-emerald-400">
                        R$ {goals.annualRevenueGoal.toLocaleString("pt-BR")}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground block">Domínio do Grande ABC</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              ABA 3: MATRIZ DE SUBSTITUTOS DE FORNECEDOR
          ════════════════════════════════════════════════════════════ */}
          {activeTab === "contingency" && (
            <div className="space-y-4">
              <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="size-5 text-cyan-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Guia de Contingência: O que fazer se o fornecedor não tiver o produto?
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Regras práticas para não travar a compra caso faltem sabores ou modelos no dia
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="border border-white/10 rounded-xl p-4 bg-black/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-red-400" />
                      <h5 className="text-xs font-bold text-white">Se faltar Elfbar BC15K</h5>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Substituir imediatamente por <strong>Ignite V55 Ultra Thin</strong> (R$ 52), <strong>Lost Mary OS5000</strong> ou <strong>Elfbar BC5000</strong> para manter o ticket baixo e alto giro.
                    </p>
                  </div>

                  <div className="border border-white/10 rounded-xl p-4 bg-black/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-cyan-400" />
                      <h5 className="text-xs font-bold text-white">Se faltar Elfbar Ice King 40K</h5>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Substituir por <strong>Elfbar TE30K</strong> (R$ 65), <strong>Lost Mary 30K</strong> ou <strong>Oxbar Magic Maze 30K</strong> para manter o apelo de alta contagem de puffs e tela.
                    </p>
                  </div>

                  <div className="border border-white/10 rounded-xl p-4 bg-black/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-amber-400" />
                      <h5 className="text-xs font-bold text-white">Se faltar Ignite V500 ou V80</h5>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Substituir por <strong>Ignite V50 clássico</strong> (R$ 65) ou <strong>Ignite V250</strong> (R$ 68), garantindo que a marca Ignite tenha sempre opções ativas no cardápio.
                    </p>
                  </div>

                  <div className="border border-white/10 rounded-xl p-4 bg-black/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-400" />
                      <h5 className="text-xs font-bold text-white">Regra de Ouro dos Sabores</h5>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Priorizar sempre a grade Ice: <em>Watermelon Ice, Blueberry Ice, Grape Ice, Menthol/Spearmint, Strawberry Kiwi e Miami Mint</em> (Zero Encalhe).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ─── FOOTER MODAL ─── */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span>Diretriz Salva no Obsidian: Cerebro Smoking Pods</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
