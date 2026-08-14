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
  ChevronRight
} from "lucide-react";

interface ReplenishmentPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCash?: number;
  stockRetailValue?: number;
  stockCostValue?: number;
  totalPodsInStock?: number;
}

interface FinancialGoals {
  reorderCashGoal: number; // ex: 1000
  paraguayScaleGoal: number; // ex: 5000
  monthlyRevenueGoal: number; // ex: 8000
  quarterlyRevenueGoal: number; // ex: 25000
  annualRevenueGoal: number; // ex: 100000
}

const DEFAULT_GOALS: FinancialGoals = {
  reorderCashGoal: 1000,
  paraguayScaleGoal: 5000,
  monthlyRevenueGoal: 8000,
  quarterlyRevenueGoal: 25000,
  annualRevenueGoal: 100000,
};

const LOCAL_STORAGE_GOALS_KEY = "smk_financial_goals_v1";

export const ReplenishmentPlannerModal: React.FC<ReplenishmentPlannerModalProps> = ({
  isOpen,
  onClose,
  currentCash = 513,
  stockRetailValue = 1042.89,
  stockCostValue = 783,
  totalPodsInStock = 12,
}) => {
  const [activeTab, setActiveTab] = useState<"goals" | "order" | "contingency">("goals");

  // Estado das Metas Editáveis
  const [goals, setGoals] = useState<FinancialGoals>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_GOALS_KEY);
      if (saved) return { ...DEFAULT_GOALS, ...JSON.parse(saved) };
    } catch (e) {}
    return DEFAULT_GOALS;
  });

  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [tempGoals, setTempGoals] = useState<FinancialGoals>(goals);
  const [copiedOrder, setCopiedOrder] = useState(false);

  // Marca Nova Selecionada no Buffer
  const [selectedNewBrand, setSelectedNewBrand] = useState("Geek Bar Pulse 15K");
  const [customNewBrandCost, setCustomNewBrandCost] = useState("70");

  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_GOALS_KEY);
        if (saved) {
          const parsed = { ...DEFAULT_GOALS, ...JSON.parse(saved) };
          setGoals(parsed);
          setTempGoals(parsed);
        }
      } catch (e) {}
    }
  }, [isOpen]);

  const handleSaveGoals = () => {
    setGoals(tempGoals);
    setIsEditingGoals(false);
    try {
      localStorage.setItem(LOCAL_STORAGE_GOALS_KEY, JSON.stringify(tempGoals));
    } catch (e) {}
  };

  const handleResetGoals = () => {
    setTempGoals(DEFAULT_GOALS);
    setGoals(DEFAULT_GOALS);
    setIsEditingGoals(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_GOALS_KEY);
    } catch (e) {}
  };

  // Cálculos de Progresso
  const totalEquity = currentCash + stockRetailValue;
  const cashNeededForReorder = Math.max(0, goals.reorderCashGoal - currentCash);
  const reorderProgressPct = Math.min(100, Math.round((currentCash / goals.reorderCashGoal) * 100));

  const averagePodPrice = totalPodsInStock > 0 ? stockRetailValue / totalPodsInStock : 86.9;
  const podsNeededToSell = averagePodPrice > 0 ? Math.ceil(cashNeededForReorder / averagePodPrice) : 0;
  const paraguayProgressPct = Math.min(100, Math.round((totalEquity / goals.paraguayScaleGoal) * 100));

  // Itens da Ordem de Compra Fixa
  const fixedOrderItems = [
    { brand: "Elfbar", model: "BC15K", qty: 3, unitCost: 48, unitSell: 64.99, badge: "Alto Giro / Menor Custo", flavors: "Blue Razz Ice (2x), Strawberry Kiwi" },
    { brand: "Elfbar", model: "Ice King 40K", qty: 2, unitCost: 70, unitSell: 89.90, badge: "Campeão #1 de Vendas", flavors: "Green Apple Ice, Watermelon Ice" },
    { brand: "Lost Mary", model: "Dura 35K", qty: 3, unitCost: 65, unitSell: 79.90, badge: "Excelente Retenção", flavors: "Pom. Cherry Pineapple, Grape Ice" },
    { brand: "Oxbar", model: "50K", qty: 1, unitCost: 65, unitSell: 99.90, badge: "Maior Margem Líquida", flavors: "Pineapple Ice" },
    { brand: "Elfbar", model: "GH23K", qty: 1, unitCost: 65, unitSell: 86.90, badge: "Desejo de Catálogo", flavors: "Grape Ice" },
    { brand: "Ignite", model: "V500", qty: 1, unitCost: 80, unitSell: 108.90, badge: "Modelo Premium", flavors: "Strawberry Kiwi" },
    { brand: "Ignite", model: "V55 Ultra Thin", qty: 1, unitCost: 52, unitSell: 71.90, badge: "Entrada Acessível", flavors: "Strawberry Ice" },
    { brand: "Ignite", model: "V80 Ultra Slim", qty: 1, unitCost: 55, unitSell: 78.90, badge: "Margem & Variedade", flavors: "Passion Fruit Sour Kiwi" },
  ];

  const fixedCostTotal = fixedOrderItems.reduce((acc, item) => acc + (item.qty * item.unitCost), 0);
  const fixedSellTotal = fixedOrderItems.reduce((acc, item) => acc + (item.qty * item.unitSell), 0);
  const fixedUnitsTotal = fixedOrderItems.reduce((acc, item) => acc + item.qty, 0);

  const newBrandCost = parseFloat(customNewBrandCost) || 70;
  const newBrandSell = 94.90;
  const totalOrderCostWithBuffer = fixedCostTotal + (2 * newBrandCost);
  const totalOrderSellWithBuffer = fixedSellTotal + (2 * newBrandSell);
  const totalOrderUnits = fixedUnitsTotal + 2;

  const supplierShippingFee = 50;
  const totalSpentWithShipping = totalOrderCostWithBuffer + supplierShippingFee;
  const projectedNetProfit = totalOrderSellWithBuffer - totalSpentWithShipping;
  const projectedRoiPct = totalSpentWithShipping > 0 ? ((projectedNetProfit / totalSpentWithShipping) * 100).toFixed(1) : 0;
  const dilutedShippingPerPod = totalOrderUnits > 0 ? (supplierShippingFee / totalOrderUnits).toFixed(2) : "2.94";

  // Gerador de Texto para WhatsApp do Fornecedor
  const generatedWhatsAppMessage = useMemo(() => {
    return `📦 *PEDIDO DE REPOSIÇÃO — SMOKING PODS*
📍 *Origem:* São Bernardo do Campo / SP
💰 *Lote Fechado:* ~R$ 1.000,00

*LISTA DE MODELOS E QUANTIDADES:*
${fixedOrderItems.map(item => `• ${item.qty}x ${item.brand} ${item.model} (${item.flavors})`).join("\n")}
• 2x ${selectedNewBrand} (Marca Nova / Sabores Sortidos)

*Total de Peças:* ${totalOrderUnits} unidades
*Frete Estimado:* R$ 50,00 (Diluído: R$ ${dilutedShippingPerPod}/pod)

Por favor, me confirme a disponibilidade destes sabores e a chave Pix para faturarmos o pedido! 🚀`;
  }, [fixedOrderItems, selectedNewBrand, totalOrderUnits, dilutedShippingPerPod]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f1216] border border-white/15 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* ─── HEADER MODAL ─── */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-transparent to-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Boxes className="size-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Planejador de Estoque & Metas de Escala
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider">
                  Remessa #2 SP
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Gatilhos automáticos de compra, diluição de frete e metas dinâmicas de patrimônio
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
        <div className="flex border-b border-white/10 px-4 sm:px-6 bg-black/30">
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
            onClick={() => setActiveTab("order")}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "order"
                ? "border-amber-400 text-amber-400 bg-amber-500/5"
                : "border-transparent text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            <ShoppingCart className="size-3.5" />
            <span>📦 Pedido Ativo & WhatsApp</span>
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

        {/* ─── CONTEÚDO PRINCIPAL (SCROLLÁVEL) ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">

          {/* ABA 1: METAS & TERMÔMETRO DE CAIXA */}
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

              {/* GATILHO #1: META DO LOTE DE R$ 1.000 (IMEDIATO) */}
              <div className="bg-card border border-emerald-500/30 rounded-2xl p-5 space-y-4 bg-gradient-to-b from-emerald-950/20 to-transparent shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-emerald-500/20 text-emerald-400 grid place-items-center">
                      <Zap className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Gatilho de Recompra: Lote Mínimo de R$ {goals.reorderCashGoal.toLocaleString("pt-BR")}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Diluição de frete de SP para R$ 2,94/pod — Máxima margem líquida
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
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
                    <span className="font-semibold text-white">Meta: R$ {goals.reorderCashGoal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Diagnóstico de Vendas Restantes */}
                <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Flame className="size-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-silver">
                      {cashNeededForReorder > 0 ? (
                        <>Faltam apenas <strong className="text-emerald-400">R$ {cashNeededForReorder.toFixed(2)}</strong> em vendas (<strong className="text-amber-300">~{podsNeededToSell} pods</strong> vendidos) para acionar a compra!</>
                      ) : (
                        <strong className="text-emerald-400">🎉 META ALCANÇADA! O caixa já tem saldo suficiente para o lote de R$ 1.000!</strong>
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

              {/* GATILHO #2: TRANSIÇÃO PARA O PARAGUAI */}
              <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-cyan-500/20 text-cyan-400 grid place-items-center">
                      <Target className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Meta de Transição: Compras no Paraguai / Foz (R$ {goals.paraguayScaleGoal.toLocaleString("pt-BR")})
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Destrava freteiro dedicado e aumenta a margem em +30% a +40% por unidade
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
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

              {/* PAINEL DE METAS PERIÓDICAS EDITÁVEIS */}
              <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-amber-400" />
                    <h4 className="text-xs uppercase font-bold text-silver tracking-wider">
                      Metas Estratégicas Periódicas (Editáveis)
                    </h4>
                  </div>

                  {!isEditingGoals ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingGoals(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 transition-colors cursor-pointer"
                    >
                      <Edit3 className="size-3.5 text-amber-400" />
                      <span>Editar Metas</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetGoals}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="size-3" />
                        <span>Restaurar</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveGoals}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
                      >
                        <Save className="size-3.5" />
                        <span>Salvar</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="border border-white/10 rounded-xl p-3.5 bg-black/20 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Meta Mensal (Faturamento)</span>
                    {isEditingGoals ? (
                      <input
                        type="number"
                        value={tempGoals.monthlyRevenueGoal}
                        onChange={(e) => setTempGoals({ ...tempGoals, monthlyRevenueGoal: Number(e.target.value) || 0 })}
                        className="w-full bg-black/50 border border-amber-400/50 rounded-lg px-2 py-1 text-sm font-bold text-amber-300 focus:outline-none"
                      />
                    ) : (
                      <div className="text-lg font-bold text-white">
                        R$ {goals.monthlyRevenueGoal.toLocaleString("pt-BR")}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground block">~{Math.round(goals.monthlyRevenueGoal / 85)} pods/mês</span>
                  </div>

                  <div className="border border-white/10 rounded-xl p-3.5 bg-black/20 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Meta Trimestral (Q1..Q4)</span>
                    {isEditingGoals ? (
                      <input
                        type="number"
                        value={tempGoals.quarterlyRevenueGoal}
                        onChange={(e) => setTempGoals({ ...tempGoals, quarterlyRevenueGoal: Number(e.target.value) || 0 })}
                        className="w-full bg-black/50 border border-amber-400/50 rounded-lg px-2 py-1 text-sm font-bold text-amber-300 focus:outline-none"
                      />
                    ) : (
                      <div className="text-lg font-bold text-white">
                        R$ {goals.quarterlyRevenueGoal.toLocaleString("pt-BR")}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground block">Escala de capital</span>
                  </div>

                  <div className="border border-white/10 rounded-xl p-3.5 bg-black/20 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Meta Anual (Consolidação)</span>
                    {isEditingGoals ? (
                      <input
                        type="number"
                        value={tempGoals.annualRevenueGoal}
                        onChange={(e) => setTempGoals({ ...tempGoals, annualRevenueGoal: Number(e.target.value) || 0 })}
                        className="w-full bg-black/50 border border-amber-400/50 rounded-lg px-2 py-1 text-sm font-bold text-amber-300 focus:outline-none"
                      />
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

          {/* ABA 2: PEDIDO ATIVO & WHATSAPP */}
          {activeTab === "order" && (
            <div className="space-y-6">
              
              {/* Tabela do Núcleo Fixo do Pedido */}
              <div className="bg-card border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-emerald-400" />
                    <span className="text-xs uppercase font-bold text-white tracking-wider">
                      Núcleo Fixo de Reposição (13 Peças • R$ {fixedCostTotal.toFixed(2)})
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Baseado em velocidade de saída</span>
                </div>

                <div className="divide-y divide-white/5">
                  {fixedOrderItems.map((item, idx) => (
                    <div key={idx} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold grid place-items-center shrink-0">
                          {item.qty}x
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{item.brand} {item.model}</span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/5 text-silver border border-white/10">
                              {item.badge}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">Sabores: {item.flavors}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right self-end sm:self-center">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Custo Total</span>
                          <span className="text-xs font-bold text-white">R$ {(item.qty * item.unitCost).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Preço Venda</span>
                          <span className="text-xs font-bold text-emerald-400">R$ {item.unitSell.toFixed(2)}/un</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buffer de Flexibilidade & Marca Nova */}
              <div className="bg-card border border-amber-500/30 rounded-2xl p-5 space-y-4 bg-gradient-to-b from-amber-950/20 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="size-4 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Buffer de Flexibilidade & Marca Nova (Saldo: R$ 180 a R$ 200)
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Margem para inovação de catálogo e adaptação ao estoque do fornecedor no dia
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                    +2 Unidades
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Marca Nova / Modelo Novidade</label>
                    <select
                      value={selectedNewBrand}
                      onChange={(e) => setSelectedNewBrand(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="Geek Bar Pulse 15K">Geek Bar Pulse 15K (~R$ 70 custo)</option>
                      <option value="Waka soPro 20K">Waka soPro 20K (~R$ 70 custo)</option>
                      <option value="Nikbar / Vozol">Nikbar / Vozol (~R$ 60 custo)</option>
                      <option value="Maskking / Outro">Maskking / Outro Modelo Novidade</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Custo Unitário Estimado (R$)</label>
                    <input
                      type="number"
                      value={customNewBrandCost}
                      onChange={(e) => setCustomNewBrandCost(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Reconciliação Financeira do Lote Completo */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total de Pods</span>
                    <span className="text-xl font-bold text-white">{totalOrderUnits} un</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Custo Total + Frete</span>
                    <span className="text-xl font-bold text-white">R$ {totalSpentWithShipping.toFixed(2)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Frete Diluído</span>
                    <span className="text-xl font-bold text-cyan-400">R$ {dilutedShippingPerPod}/pod</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Lucro Líquido Limpo</span>
                    <span className="text-xl font-extrabold text-emerald-400">R$ {projectedNetProfit.toFixed(2)}</span>
                  </div>
                </div>

                {/* Botão de Cópia para WhatsApp */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCopyOrderText}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.98] cursor-pointer"
                  >
                    {copiedOrder ? (
                      <>
                        <Check className="size-4 text-black" />
                        <span>✅ Mensagem do Pedido Copiada para a Área de Transferência!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-4 text-black" />
                        <span>📋 Copiar Pedido Formatado para o WhatsApp do Fornecedor</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ABA 3: MATRIZ DE SUBSTITUTOS DE FORNECEDOR */}
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
