import React, { useState, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Truck,
  Box,
  Boxes,
  PackagePlus,
  Wallet,
  Calendar,
  CalendarDays,
  Clock,
  Target,
  Percent,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Building2,
  Globe,
  Zap,
  Route,
  History,
  BarChart3,
  Layers,
  Award,
  FileSpreadsheet,
  GitCompare,
  FileText,
  ReceiptText,
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import {
  type CycleDefinition,
  type CycleFinancialMetrics,
  type ConsolidatedPeriod,
  type AllTimeFinancialMetrics,
  type PeriodEvolution,
  type GroupedPeriodEvolution,
  MONTH_NAMES,
  getSaoPauloDateParts,
  calculatePeriodEvolutions,
} from "@/lib/financialCycles";
import {
  type WeeklyGoalsConfig,
  type WeekPerformance,
  saveWeeklyGoals,
} from "@/lib/weeklyGoals";
import {
  type StockRepurchase,
  createStockRepurchase,
  deleteStockRepurchase,
} from "@/lib/stockRepurchases";
import { createPartnerTransaction } from "@/lib/partners";

function generateSmoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${pts[0].x - 10} ${pts[0].y} L ${pts[0].x + 10} ${pts[0].y}`;
  if (n === 2) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;

  const dxs: number[] = [];
  const dys: number[] = [];
  const ms: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    dxs.push(dx);
    dys.push(dy);
    ms.push(dx === 0 ? 0 : dy / dx);
  }

  const c1s: number[] = [ms[0]];
  for (let i = 0; i < ms.length - 1; i++) {
    const m0 = ms[i];
    const m1 = ms[i + 1];
    if (m0 * m1 <= 0) {
      c1s.push(0);
    } else {
      const dx0 = dxs[i];
      const dx1 = dxs[i + 1];
      const common = dx0 + dx1;
      c1s.push(common === 0 ? 0 : (3 * common) / ((common + dx1) / m0 + (common + dx0) / m1));
    }
  }
  c1s.push(ms[ms.length - 1]);

  let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dx = dxs[i];
    const cp1x = p1.x + dx / 3;
    const cp1y = p1.y + (c1s[i] * dx) / 3;
    const cp2x = p2.x - dx / 3;
    const cp2y = p2.y - (c1s[i + 1] * dx) / 3;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function generateSmoothArea(pts: { x: number; y: number }[], baseY: number): string {
  if (pts.length === 0) return "";
  const line = generateSmoothPath(pts);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${line} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
}

interface EvolutionPoint {
  id: string;
  label: string;
  fullTitle: string;
  periodLabel: string;
  revenue: number;
  cmv: number;
  netProfit: number;
  orders: number;
  pods: number;
  isCurrent?: boolean;
}

/**
 * Componente visual discreto de indicador de evolução percentual
 */
function EvolutionBadge({
  evolution,
  invertColors = false,
}: {
  evolution?: PeriodEvolution | null;
  invertColors?: boolean;
}) {
  if (!evolution || !evolution.hasComparison) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-white/40">
        <span className="italic">Sem comparação</span>
        <span className="text-[9px] text-white/30">vs. anterior</span>
      </div>
    );
  }

  let color = "text-white/60";
  if (evolution.direction === "up") {
    color = invertColors ? "text-red-400" : "text-emerald-400";
  } else if (evolution.direction === "down") {
    color = invertColors ? "text-emerald-400" : "text-red-400";
  }

  return (
    <div className="flex items-center gap-1 text-[11px] font-semibold">
      <span className={color}>
        {evolution.arrow} {evolution.text}
      </span>
      <span className="text-[10px] text-white/40 font-normal">
        {evolution.labelVs}
      </span>
    </div>
  );
}

export interface MobileFinanceViewProps {
  company: any;
  loading: boolean;
  currentCycle: CycleDefinition;
  grossRevenue: number;
  cmv: number;
  companyExpenses: number;
  logisticsFee: number;
  netProfit: number;
  profitMargin: number;
  totalOrders: number;
  totalPodsSold: number;
  brandSales: Array<{ brand: string; count: number; revenue: number }>;
  realCash: number;
  totalStockPurchases: number;
  totalFreightRepurchases: number;
  stockAssetCost: number;
  stockAssetRetail: number;
  allTimeMetrics: AllTimeFinancialMetrics;
  monthlyCycles: CycleFinancialMetrics[];
  quarterlyPeriods: ConsolidatedPeriod[];
  semiannualPeriods: ConsolidatedPeriod[];
  annualPeriods: ConsolidatedPeriod[];
  weeklyGoalsConfig: WeeklyGoalsConfig;
  weeklyPerformances: WeekPerformance[];
  monthlyTrajectory: {
    totalRealized: number;
    target: number;
    remaining: number;
    progressPerc: number;
    remainingDays: number;
    dailyPaceNeeded: number;
  };
  repurchases: StockRepurchase[];
  marketingSpent: string;
  onRefresh: () => void;
  onOpenNationalModal: () => void;
  nationalOrdersCount?: number;
  persistedProductCosts: Record<string, number>;
  allValidOrders: any[];
  // Seletores e Métricas Oficiais do Histórico (Sincronizados com o motor de cálculo)
  selectedMonthCycleId: string;
  onSelectMonthCycleId: (id: string) => void;
  selectedMonthlyMetric: CycleFinancialMetrics | null;
  monthlyEvolution: GroupedPeriodEvolution;
  selectedQuarterId: string;
  onSelectQuarterId: (id: string) => void;
  selectedQuarter: ConsolidatedPeriod | null;
  quarterlyEvolution: GroupedPeriodEvolution;
  selectedSemesterId: string;
  onSelectSemesterId: (id: string) => void;
  selectedSemester: ConsolidatedPeriod | null;
  semiannualEvolution: GroupedPeriodEvolution;
  selectedYearId: string;
  onSelectYearId: (id: string) => void;
  selectedYear: ConsolidatedPeriod | null;
  annualEvolution: GroupedPeriodEvolution;
}

function MobileFinanceViewComponent({
  company,
  loading,
  currentCycle,
  grossRevenue,
  cmv,
  companyExpenses,
  logisticsFee,
  netProfit,
  profitMargin,
  totalOrders,
  totalPodsSold,
  brandSales,
  realCash,
  totalStockPurchases,
  totalFreightRepurchases,
  stockAssetCost,
  stockAssetRetail,
  allTimeMetrics,
  monthlyCycles,
  quarterlyPeriods,
  semiannualPeriods,
  annualPeriods,
  weeklyGoalsConfig,
  weeklyPerformances,
  monthlyTrajectory,
  repurchases,
  marketingSpent,
  onRefresh,
  onOpenNationalModal,
  nationalOrdersCount = 0,
  persistedProductCosts,
  allValidOrders,
  selectedMonthCycleId,
  onSelectMonthCycleId,
  selectedMonthlyMetric,
  monthlyEvolution,
  selectedQuarterId,
  onSelectQuarterId,
  selectedQuarter,
  quarterlyEvolution,
  selectedSemesterId,
  onSelectSemesterId,
  selectedSemester,
  semiannualEvolution,
  selectedYearId,
  onSelectYearId,
  selectedYear,
  annualEvolution,
}: MobileFinanceViewProps) {
  // Aba ativa principal
  const [activeTab, setActiveTab] = useState<"resumo" | "metas" | "caixa" | "evolucao" | "historico">("resumo");

  // Sub-abas de Evolução e Histórico
  const [evolutionMode, setEvolutionMode] = useState<"diario" | "anual">("diario");
  const [historyTab, setHistoryTab] = useState<"mensal" | "trimestral" | "semestral" | "anual">("mensal");

  // Ponto ativo no gráfico (ao tocar)
  const [touchedPointIdx, setTouchedPointIdx] = useState<number | null>(null);

  // Estados de Bottom Sheets
  const [isRepurchaseSheetOpen, setIsRepurchaseSheetOpen] = useState(false);
  const [repurchaseToDelete, setRepurchaseToDelete] = useState<StockRepurchase | null>(null);
  const [isGoalsSheetOpen, setIsGoalsSheetOpen] = useState(false);
  const [isExpenseSheetOpen, setIsExpenseSheetOpen] = useState(false);

  // Estados de formulário para Nova Recompra
  const [stockAmountInput, setStockAmountInput] = useState("");
  const [freightAmountInput, setFreightAmountInput] = useState("");
  const [repurchaseDateInput, setRepurchaseDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [repurchaseNotesInput, setRepurchaseNotesInput] = useState("");
  const [isSavingRepurchase, setIsSavingRepurchase] = useState(false);
  const [repurchaseFormError, setRepurchaseFormError] = useState<string | null>(null);

  // Estados de formulário para Metas
  const [editingMonthlyTarget, setEditingMonthlyTarget] = useState<string>(String(weeklyGoalsConfig.monthlyTarget || 7000));
  const [editingW1, setEditingW1] = useState<string>(String(weeklyGoalsConfig.week1 || 1750));
  const [editingW2, setEditingW2] = useState<string>(String(weeklyGoalsConfig.week2 || 1750));
  const [editingW3, setEditingW3] = useState<string>(String(weeklyGoalsConfig.week3 || 1750));
  const [editingW4, setEditingW4] = useState<string>(String(weeklyGoalsConfig.week4 || 1750));
  const [isSavingGoals, setIsSavingGoals] = useState(false);

  // Estados de formulário para Nova Despesa Operacional
  const [expenseAmountInput, setExpenseAmountInput] = useState("");
  const [expenseDescInput, setExpenseDescInput] = useState("");
  const [expenseDateInput, setExpenseDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [expenseFormError, setExpenseFormError] = useState<string | null>(null);

  // ── Cálculo dos Pontos Diários do Ciclo Vigente (Modo Dia a Dia - calculado apenas quando aba Evolução ativa) ──
  const dailyEvolutionPoints = useMemo<EvolutionPoint[]>(() => {
    if (activeTab !== "evolucao" || evolutionMode !== "diario") return [];
    if (!currentCycle) return [];
    const [startD, startM, startY] = currentCycle.startDateStr.split("/").map(Number);
    const [endD, endM, endY] = currentCycle.endDateStr.split("/").map(Number);

    const startDate = new Date(startY, startM - 1, startD, 12, 0, 0);
    const endDate = new Date(endY, endM - 1, endD, 12, 0, 0);

    const nowSP = getSaoPauloDateParts(new Date());
    const todayStr = `${nowSP.year}-${String(nowSP.month).padStart(2, "0")}-${String(nowSP.day).padStart(2, "0")}`;

    const ordersByDay = new Map<string, any[]>();
    for (const order of allValidOrders || []) {
      if (!order.created_at) continue;
      const p = getSaoPauloDateParts(order.created_at);
      const key = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
      if (!ordersByDay.has(key)) ordersByDay.set(key, []);
      ordersByDay.get(key)!.push(order);
    }

    const points: EvolutionPoint[] = [];
    const cur = new Date(startDate);

    while (cur <= endDate) {
      const parts = getSaoPauloDateParts(cur);
      const dateKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
      const dayOrders = ordersByDay.get(dateKey) || [];

      let dayRev = 0;
      let dayCmv = 0;
      let dayPods = 0;

      for (const o of dayOrders) {
        const items = Array.isArray(o.items) ? o.items : [];
        if (items.length > 0) {
          for (const item of items) {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.price || item.unit_price) || 0;
            let cost = Number(item.cost_price || item.costPrice) || 0;
            if (!cost && item.product_id && persistedProductCosts[item.product_id]) {
              cost = persistedProductCosts[item.product_id];
            }
            if (!cost) cost = 65;
            dayRev += qty * price;
            dayCmv += qty * cost;
            dayPods += qty;
          }
        } else {
          dayRev += Number(o.total_amount) || 0;
          dayCmv += (Number(o.total_amount) || 0) * 0.45;
          dayPods += 1;
        }
      }

      const isToday = dateKey === todayStr;
      const dayFormatted = `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`;

      points.push({
        id: dateKey,
        label: dayFormatted,
        fullTitle: `${parts.day} de ${MONTH_NAMES[parts.month]} de ${parts.year}${isToday ? " (Hoje)" : ""}`,
        periodLabel: `${dayFormatted}/${parts.year}`,
        revenue: Number(dayRev.toFixed(2)),
        cmv: Number(dayCmv.toFixed(2)),
        netProfit: Number((dayRev - dayCmv).toFixed(2)),
        orders: dayOrders.length,
        pods: dayPods,
        isCurrent: isToday,
      });

      cur.setDate(cur.getDate() + 1);
      if (points.length > 35) break;
    }

    return points;
  }, [activeTab, evolutionMode, currentCycle, allValidOrders, persistedProductCosts]);

  // ── Cálculo dos Pontos Anuais (12 Meses - calculado apenas quando aba Evolução ativa) ──
  const annualEvolutionPoints = useMemo<EvolutionPoint[]>(() => {
    if (activeTab !== "evolucao" || evolutionMode !== "anual") return [];
    const currentYear = currentCycle.year || 2026;
    const SHORT_MONTHS = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    const cycleByMonth = new Map<number, CycleFinancialMetrics>();
    for (const m of monthlyCycles) {
      if (m.cycle.year === currentYear) {
        cycleByMonth.set(m.cycle.month, m);
      }
    }

    const annualPoints: EvolutionPoint[] = [];
    for (let m = 1; m <= 12; m++) {
      const shortLabel = SHORT_MONTHS[m];
      const existing = cycleByMonth.get(m);
      const isCurrentMonth = m === currentCycle.month && currentYear === currentCycle.year;

      annualPoints.push({
        id: `ano-${currentYear}-${String(m).padStart(2, "0")}`,
        label: shortLabel,
        fullTitle: `${MONTH_NAMES[m]} de ${currentYear}${isCurrentMonth ? " (Ciclo Vigente)" : ""}`,
        periodLabel: `${shortLabel}/${currentYear}`,
        revenue: existing ? existing.grossRevenue : 0,
        cmv: existing ? existing.cmv : 0,
        netProfit: existing ? existing.netProfit : 0,
        orders: existing ? existing.totalOrders : 0,
        pods: existing ? existing.totalPodsSold : 0,
        isCurrent: isCurrentMonth,
      });
    }

    return annualPoints;
  }, [activeTab, evolutionMode, currentCycle, monthlyCycles]);

  const activeChartData = evolutionMode === "diario" ? dailyEvolutionPoints : annualEvolutionPoints;

  // ── Handlers de Ações Assíncronas ──
  const handleSaveRepurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingRepurchase) return;

    const stockAmt = parseFloat(stockAmountInput.replace(",", "."));
    const freightAmt = parseFloat(freightAmountInput.replace(",", ".")) || 0;

    if (isNaN(stockAmt) || stockAmt <= 0) {
      setRepurchaseFormError("O valor pago em produtos deve ser maior que R$ 0,00.");
      return;
    }

    try {
      setIsSavingRepurchase(true);
      setRepurchaseFormError(null);

      const res = await createStockRepurchase({
        companyId: company?.id,
        stock_purchase_amount: stockAmt,
        freight_amount: freightAmt,
        purchase_date: repurchaseDateInput,
        notes: repurchaseNotesInput,
      });

      if (res.error) {
        setRepurchaseFormError(res.error.message || "Erro ao salvar reposição.");
        return;
      }

      setStockAmountInput("");
      setFreightAmountInput("");
      setRepurchaseNotesInput("");
      setIsRepurchaseSheetOpen(false);
      onRefresh();
    } catch (err: any) {
      setRepurchaseFormError(err.message || "Erro inesperado.");
    } finally {
      setIsSavingRepurchase(false);
    }
  };

  const handleConfirmDeleteRepurchase = async () => {
    if (!repurchaseToDelete || isSavingRepurchase) return;
    try {
      setIsSavingRepurchase(true);
      const res = await deleteStockRepurchase(repurchaseToDelete.id, company?.id);
      if (res.error) {
        alert("Erro ao excluir: " + res.error.message);
        return;
      }
      setRepurchaseToDelete(null);
      onRefresh();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    } finally {
      setIsSavingRepurchase(false);
    }
  };

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingGoals) return;

    const mTarget = parseFloat(editingMonthlyTarget.replace(",", ".")) || 7000;
    const w1 = parseFloat(editingW1.replace(",", ".")) || 1750;
    const w2 = parseFloat(editingW2.replace(",", ".")) || 1750;
    const w3 = parseFloat(editingW3.replace(",", ".")) || 1750;
    const w4 = parseFloat(editingW4.replace(",", ".")) || 1750;

    try {
      setIsSavingGoals(true);
      await saveWeeklyGoals(
        {
          monthlyTarget: mTarget,
          week1: w1,
          week2: w2,
          week3: w3,
          week4: w4,
          cycleId: currentCycle.id,
        },
        company?.id,
        currentCycle.id
      );
      setIsGoalsSheetOpen(false);
      onRefresh();
    } catch (err: any) {
      alert("Erro ao salvar metas: " + err.message);
    } finally {
      setIsSavingGoals(false);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingExpense) return;

    const amt = parseFloat(expenseAmountInput.replace(",", "."));
    if (isNaN(amt) || amt <= 0) {
      setExpenseFormError("O valor da despesa deve ser maior que R$ 0,00.");
      return;
    }

    if (!expenseDescInput.trim()) {
      setExpenseFormError("Informe a descrição do custo.");
      return;
    }

    try {
      setIsSavingExpense(true);
      setExpenseFormError(null);

      await createPartnerTransaction({
        companyId: company?.id,
        type: "DESPESA_OPERACIONAL",
        amount: amt,
        date: expenseDateInput,
        description: expenseDescInput.trim(),
        destinationCategory: "CAIXA_GERAL",
      });

      setExpenseAmountInput("");
      setExpenseDescInput("");
      setIsExpenseSheetOpen(false);
      onRefresh();
    } catch (err: any) {
      setExpenseFormError(err.message || "Erro inesperado.");
    } finally {
      setIsSavingExpense(false);
    }
  };

  // ── Renderização do Gráfico SVG Mobile Calibrado ──
  const renderMobileChart = () => {
    const data = activeChartData;
    if (!data || data.length === 0) {
      return (
        <div className="p-6 text-center text-white/40 text-xs italic bg-[#0e0e12] border border-white/10 rounded-2xl">
          Nenhum dado financeiro para o período.
        </div>
      );
    }

    const width = 340;
    const height = 150;
    const padLeft = 44;
    const padRight = 14;
    const padTop = 12;
    const padBottom = 22;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const maxVal = Math.max(...data.map((d) => Math.max(d.revenue, d.netProfit)), 50);
    const yMax = Math.ceil(maxVal * 1.15);

    const revPoints = data.map((d, i) => {
      const x = data.length === 1 ? padLeft + chartW / 2 : padLeft + (i / (data.length - 1)) * chartW;
      const y = padTop + chartH - (Math.max(0, d.revenue) / yMax) * chartH;
      return { ...d, x, y, index: i };
    });

    const profPoints = data.map((d, i) => {
      const x = data.length === 1 ? padLeft + chartW / 2 : padLeft + (i / (data.length - 1)) * chartW;
      const y = padTop + chartH - (Math.max(0, d.netProfit) / yMax) * chartH;
      return { ...d, x, y, index: i };
    });

    const revPath = generateSmoothPath(revPoints);
    const revArea = generateSmoothArea(revPoints, padTop + chartH);
    const profPath = generateSmoothPath(profPoints);

    const step = evolutionMode === "diario" ? Math.max(1, Math.ceil(data.length / 6)) : 2;
    const activePoint = touchedPointIdx !== null ? data[touchedPointIdx] : null;

    return (
      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-3">
        {/* Header do Gráfico */}
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span className="text-white/80 font-semibold text-[11px]">Faturamento</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-cyan-400" />
              <span className="text-white/80 font-semibold text-[11px]">Lucro Líquido</span>
            </div>
          </div>
          <span className="text-[10px] text-white/40">Toque no gráfico</span>
        </div>

        {/* SVG Interativo */}
        <div className="w-full relative touch-none select-none">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto cursor-pointer overflow-visible"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const touchX = ((e.clientX - rect.left) / rect.width) * width;
              let best = 0;
              let bestDist = Infinity;
              revPoints.forEach((p, idx) => {
                const dist = Math.abs(p.x - touchX);
                if (dist < bestDist) {
                  bestDist = dist;
                  best = idx;
                }
              });
              setTouchedPointIdx(best);
            }}
          >
            <defs>
              <linearGradient id="mobAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Linhas de Grade Horizontal */}
            {[0, 0.5, 1].map((lvl) => {
              const yVal = padTop + chartH - lvl * chartH;
              const val = lvl * yMax;
              return (
                <g key={`mgrid-${lvl}`}>
                  <line x1={padLeft} y1={yVal} x2={width - padRight} y2={yVal} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  <text x={padLeft - 4} y={yVal + 3} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontFamily="monospace">
                    {lvl === 0 ? "0" : formatBRL(val).replace(",00", "")}
                  </text>
                </g>
              );
            })}

            {/* Área e Linhas */}
            {revArea && <path d={revArea} fill="url(#mobAreaGrad)" />}
            {revPath && <path d={revPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />}
            {profPath && <path d={profPath} fill="none" stroke="#06b6d4" strokeWidth="1.75" strokeLinecap="round" strokeDasharray="3 2" />}

            {/* Pontos X */}
            {revPoints.map((p, i) => {
              const isSelected = touchedPointIdx === i;
              const showLabel = i % step === 0 || i === revPoints.length - 1;
              return (
                <g key={`pt-${i}`}>
                  {isSelected && (
                    <line x1={p.x} y1={padTop} x2={p.x} y2={padTop + chartH} stroke="rgba(255,255,255,0.3)" strokeDasharray="2 2" strokeWidth="1" />
                  )}
                  {isSelected && (
                    <circle cx={p.x} cy={p.y} r="4.5" fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />
                  )}
                  {showLabel && (
                    <text x={p.x} y={height - 4} textAnchor="middle" fill={isSelected ? "#ffffff" : "rgba(255,255,255,0.45)"} fontSize="7.5" fontFamily="monospace" fontWeight={isSelected ? "bold" : "normal"}>
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Inspetor de Ponto Tocado (Card Confortável Abaixo do Gráfico) */}
        <div className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-1.5 text-xs">
          {activePoint ? (
            <>
              <div className="flex items-center justify-between border-b border-white/10 pb-1">
                <span className="font-bold text-white text-[11px] truncate">{activePoint.fullTitle}</span>
                {activePoint.isCurrent && (
                  <span className="text-[8px] bg-emerald-500/25 text-emerald-300 px-1.5 py-0.5 rounded font-black uppercase">
                    Hoje
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div>
                  <span className="text-[10px] text-white/50 block">Faturamento:</span>
                  <span className="font-extrabold text-emerald-400 text-sm">{formatBRL(activePoint.revenue)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/50 block">Lucro Líquido:</span>
                  <span className="font-bold text-cyan-400 text-sm">{formatBRL(activePoint.netProfit)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-white/50">
                <span>Volume:</span>
                <span className="text-white font-medium">{activePoint.orders} ped · {activePoint.pods} un</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between text-white/60 text-[11px] py-1">
              <span>Toque em qualquer dia para inspecionar</span>
              <span className="text-emerald-400 font-bold">{data.length} dias</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#070709] overflow-hidden text-white select-none">
      {/* ━━━ 1. CABEÇALHO MOBILE ENXUTO ━━━ */}
      <header className="px-4 pt-3 pb-2.5 border-b border-white/10 shrink-0 bg-[#070709] z-20">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="size-5 text-emerald-400 shrink-0" />
              <span>Financeiro</span>
            </h1>
            <p className="text-[11px] text-white/50 font-medium truncate">
              Ciclo {currentCycle.startDateStr.slice(0, 5)} → {currentCycle.endDateStr.slice(0, 5)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Vendas Nacionais */}
            <button
              type="button"
              onClick={onOpenNationalModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all active:scale-95 cursor-pointer"
              title="Envios Nacionais"
            >
              <Globe className="size-3.5" />
              <span>Nacional</span>
              {nationalOrdersCount > 0 && (
                <span className="bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  {nationalOrdersCount}
                </span>
              )}
            </button>

            {/* Botão Atualizar */}
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all active:scale-95 cursor-pointer"
              title="Atualizar Financeiro"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ━━━ 2. BARRA DE PILLS HORIZONTAIS ━━━ */}
      <div className="px-4 py-2 border-b border-white/5 bg-[#0a0a0c] shrink-0 overflow-x-auto no-scrollbar flex items-center gap-2 z-10">
        {[
          { id: "resumo", label: "Resumo", icon: <DollarSign className="size-3.5" /> },
          { id: "metas", label: "Metas", icon: <Target className="size-3.5" /> },
          { id: "caixa", label: "Caixa Real", icon: <Wallet className="size-3.5" /> },
          { id: "evolucao", label: "Evolução", icon: <TrendingUp className="size-3.5" /> },
          { id: "historico", label: "Histórico", icon: <History className="size-3.5" /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setTouchedPointIdx(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[44px] ${
                isActive
                  ? "bg-white text-black shadow-md font-extrabold"
                  : "bg-white/5 text-white/70 hover:text-white border border-white/10"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ━━━ 3. CONTEÚDO PRINCIPAL ROLÁVEL (pb-28 para nunca sobrepor bottom nav) ━━━ */}
      <main className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-4 space-y-4 pb-28">
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ABA: RESUMO                                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "resumo" && (
          <div className="space-y-3.5">
            {/* Card Hero: Faturamento Bruto Real */}
            <div className="bg-[#0e0e12] border border-white/15 rounded-2xl p-4 space-y-2 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                  Faturamento Bruto (Ciclo)
                </span>
                <span className="text-[10px] font-bold bg-white/5 border border-white/10 text-white/70 px-2.5 py-0.5 rounded-full">
                  Sem frete local
                </span>
              </div>

              <div>
                <div className="text-3xl font-black text-white tracking-tight">
                  {formatBRL(grossRevenue)}
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  {totalOrders} {totalOrders === 1 ? "pedido validado" : "pedidos validados"} · {totalPodsSold} un
                </p>
              </div>

              {/* Marcas mais vendidas em pílulas horizontais */}
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

            {/* Grid 2x2: Lucro, Custos, Frete, Eficiência */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Lucro Líquido Real */}
              <div className="bg-gradient-to-b from-emerald-500/15 via-[#0e0e12] to-[#0e0e12] border border-emerald-500/40 rounded-2xl p-3.5 space-y-1.5 shadow-lg">
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block">
                  Lucro Líquido Real
                </span>
                <div className="text-xl font-black text-emerald-300">
                  {formatBRL(netProfit)}
                </div>
                <span className="text-[10px] font-bold text-emerald-400/90 block">
                  Margem: {profitMargin}%
                </span>
              </div>

              {/* Custos da Empresa */}
              <div className="bg-[#0e0e12] border border-orange-500/25 rounded-2xl p-3.5 space-y-1.5 shadow-lg flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-orange-300/90 uppercase tracking-wider block">
                    Custos da Empresa
                  </span>
                  <div className="text-xl font-extrabold text-orange-400">
                    {formatBRL(companyExpenses)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpenseSheetOpen(true)}
                  className="w-full text-[10px] font-bold text-orange-300 bg-orange-500/15 border border-orange-500/30 py-1.5 rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer min-h-[32px]"
                >
                  <Plus className="size-3" />
                  <span>Lançar Custo</span>
                </button>
              </div>

              {/* Frete / Logística Local */}
              <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-lg">
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
                  Frete & Entregas
                </span>
                <div className="text-lg font-extrabold text-white">
                  {formatBRL(logisticsFee)}
                </div>
                <span className="text-[9.5px] text-white/40 block">
                  Motoboy / Uber (Informativo)
                </span>
              </div>

              {/* Ticket Médio */}
              <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-lg">
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
                  Ticket Médio
                </span>
                <div className="text-lg font-extrabold text-white">
                  {formatBRL(allTimeMetrics.averageTicket)}
                </div>
                <span className="text-[9.5px] text-white/40 block">
                  Por compra (histórico)
                </span>
              </div>
            </div>

            {/* DRE Executivo em Formato Vertical / Card (Nunca tabela espremida) */}
            <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="size-4 text-emerald-400" />
                  <span>DRE Executivo do Ciclo</span>
                </h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {totalOrders} Pedidos
                </span>
              </div>

              <div className="space-y-2 text-xs font-medium">
                {/* 1. Faturamento Bruto */}
                <div className="flex items-center justify-between bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-400" />
                    <span className="font-bold text-white">🟢 Faturamento Bruto</span>
                  </div>
                  <span className="font-extrabold text-emerald-400">{formatBRL(grossRevenue)}</span>
                </div>

                {/* 2. CMV */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-red-400" />
                    <span className="text-white/70">🔴 (-) Custo Mercadoria (CMV)</span>
                  </div>
                  <span className="font-bold text-red-400">-{formatBRL(cmv)}</span>
                </div>

                {/* 3. Despesas da Empresa */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-orange-400" />
                    <span className="text-white/70">🟠 (-) Custos da Empresa</span>
                  </div>
                  <span className="font-bold text-orange-400">-{formatBRL(companyExpenses)}</span>
                </div>

                {/* 4. Lucro Líquido Real */}
                <div className="flex items-center justify-between bg-emerald-500/20 p-3 rounded-xl border-2 border-emerald-500/50 mt-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-emerald-400" />
                    <span className="font-black text-emerald-300 uppercase tracking-tight">(=) Lucro Líquido Real</span>
                  </div>
                  <span className="font-black text-emerald-300 text-sm">{formatBRL(netProfit)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ABA: METAS                                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "metas" && (
          <div className="space-y-4">
            {/* Card Trajeto da Meta Mensal */}
            <div className="bg-[#0e0e12] border border-white/15 rounded-2xl p-4 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">
                    Trajeto da Meta Mensal
                  </span>
                  <div className="text-2xl font-black text-white">
                    {formatBRL(monthlyTrajectory.totalRealized)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/50 block">Meta Global</span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {formatBRL(monthlyTrajectory.target)}
                  </span>
                </div>
              </div>

              {/* Barra Contínua com Progresso */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-emerald-400">
                    {monthlyTrajectory.progressPerc.toFixed(1)}% atingido
                  </span>
                  <span className="text-white/60">
                    Faltam {formatBRL(monthlyTrajectory.remaining)}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, monthlyTrajectory.progressPerc)}%` }}
                  />
                </div>
              </div>

              {/* Pílulas de Ritmo Diário e Dias Restantes */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="bg-black/50 border border-white/10 p-2.5 rounded-xl">
                  <span className="text-[10px] text-white/40 block">Tempo Restante:</span>
                  <span className="font-extrabold text-white text-xs">{monthlyTrajectory.remainingDays} dias</span>
                </div>
                <div className="bg-black/50 border border-emerald-500/30 p-2.5 rounded-xl">
                  <span className="text-[10px] text-white/40 block">Ritmo Diário:</span>
                  <span className="font-extrabold text-emerald-400 text-xs">
                    {formatBRL(monthlyTrajectory.dailyPaceNeeded)}/dia
                  </span>
                </div>
              </div>

              {/* Botão de Ajustar Metas */}
              <button
                type="button"
                onClick={() => {
                  setEditingMonthlyTarget(String(weeklyGoalsConfig.monthlyTarget || 7000));
                  setEditingW1(String(weeklyGoalsConfig.week1 || 1750));
                  setEditingW2(String(weeklyGoalsConfig.week2 || 1750));
                  setEditingW3(String(weeklyGoalsConfig.week3 || 1750));
                  setEditingW4(String(weeklyGoalsConfig.week4 || 1750));
                  setIsGoalsSheetOpen(true);
                }}
                className="w-full bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs py-2.5 rounded-xl border border-white/15 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer min-h-[44px]"
              >
                <Target className="size-4 text-emerald-400" />
                <span>⚙️ Ajustar Metas do Ciclo</span>
              </button>
            </div>

            {/* As 4 Semanas do Ciclo (Semana 1 a 4) */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider block px-1">
                Semanas do Ciclo (14 → 13)
              </span>

              {weeklyPerformances.map((wp) => {
                const isCurrent = wp.status === "CURRENT";
                const isAchieved = wp.status === "ACHIEVED";
                const isBelow = wp.status === "BELOW";

                return (
                  <div
                    key={wp.week.weekNumber}
                    className={`border rounded-2xl p-4 space-y-2.5 transition-all ${
                      isCurrent
                        ? "bg-gradient-to-b from-emerald-500/15 via-[#0e0e12] to-[#0e0e12] border-emerald-500/50 shadow-md"
                        : isAchieved
                        ? "bg-emerald-500/5 border-emerald-500/30"
                        : isBelow
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-[#0e0e12] border-white/10 opacity-75"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-white uppercase tracking-wider">
                          {wp.week.label}
                        </span>
                        <span className="text-[10px] text-white/50 block">
                          {wp.week.dateRangeFormatted}
                        </span>
                      </div>

                      {isCurrent && (
                        <span className="text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full animate-pulse">
                          ● Em Andamento
                        </span>
                      )}
                      {isAchieved && (
                        <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Meta Batida
                        </span>
                      )}
                      {isBelow && (
                        <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full">
                          Abaixo
                        </span>
                      )}
                      {wp.status === "FUTURE" && (
                        <span className="text-[9px] font-bold bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full">
                          Próxima
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div className="text-xl font-black text-white">
                        {formatBRL(wp.revenue)}
                      </div>
                      <div className="text-xs text-white/60 font-semibold">
                        Meta: {formatBRL(wp.goal)} ({wp.percentage}%)
                      </div>
                    </div>

                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          wp.percentage >= 100
                            ? "bg-emerald-400"
                            : isCurrent
                            ? "bg-gradient-to-r from-emerald-500 to-amber-400"
                            : "bg-amber-400"
                        }`}
                        style={{ width: `${Math.min(100, wp.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ABA: CAIXA REAL & RECOMPRA                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "caixa" && (
          <div className="space-y-4">
            {/* Card Hero: Caixa Real Atual */}
            <div className="bg-gradient-to-b from-emerald-500/20 via-[#0e0e12] to-[#0e0e12] border-2 border-emerald-500/50 rounded-2xl p-4 space-y-2.5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="size-3.5" /> Caixa Real Atual
                </span>
                <span className="text-[9px] font-black bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full uppercase">
                  Posição Viva
                </span>
              </div>

              <div>
                <div className="text-3xl font-black text-emerald-300 tracking-tight">
                  {formatBRL(realCash)}
                </div>
                <p className="text-xs font-semibold text-emerald-400/90 mt-0.5">
                  Saldo financeiro acumulado da empresa
                </p>
              </div>

              <div className="pt-2 border-t border-emerald-500/20 text-[10px] text-white/60 leading-relaxed">
                ⚡ <strong>Calculado pelo sistema:</strong> Faturamento total acumulado ({formatBRL(allTimeMetrics.grossRevenue)}) − Recompras de estoque ({formatBRL(totalStockPurchases)}). <span className="text-emerald-300 font-bold">Não zera no dia 14.</span>
              </div>
            </div>

            {/* Cards de Recompras de Estoque e Frete de Reposição */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-lg">
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
                  Recompras de Estoque
                </span>
                <div className="text-lg font-extrabold text-white">
                  {formatBRL(totalStockPurchases)}
                </div>
                <span className="text-[9.5px] text-white/40 block">
                  {repurchases.length} reposições
                </span>
              </div>

              <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-lg">
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
                  Fretes Fornecedores
                </span>
                <div className="text-lg font-extrabold text-white">
                  {formatBRL(totalFreightRepurchases)}
                </div>
                <span className="text-[9.5px] text-white/40 block">
                  Gasto logístico reposição
                </span>
              </div>
            </div>

            {/* Botão de Registrar Recompra */}
            <button
              type="button"
              onClick={() => {
                setStockAmountInput("");
                setFreightAmountInput("");
                setRepurchaseNotesInput("");
                setRepurchaseDateInput(new Date().toISOString().split("T")[0]);
                setRepurchaseFormError(null);
                setIsRepurchaseSheetOpen(true);
              }}
              className="w-full bg-white hover:bg-slate-100 text-black font-extrabold text-xs py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer min-h-[44px]"
            >
              <Plus className="size-4 stroke-[3]" />
              <span>+ Registrar Recompra de Estoque</span>
            </button>

            {/* Histórico de Recompras em Cards Verticais */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider">
                  Histórico de Reposições
                </span>
                <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-bold">
                  {repurchases.length}
                </span>
              </div>

              {repurchases.length === 0 ? (
                <div className="bg-[#0e0e12] border border-dashed border-white/15 rounded-2xl p-6 text-center text-white/50 text-xs">
                  Nenhuma reposição de estoque registrada.
                </div>
              ) : (
                <div className="space-y-2">
                  {repurchases.map((rep) => {
                    const formattedDate = rep.purchase_date
                      ? new Date(rep.purchase_date + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—";
                    return (
                      <div
                        key={rep.id}
                        className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-2 flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-white">{formattedDate}</span>
                            <span className="text-sm font-black text-amber-300">
                              {formatBRL(rep.total_repurchase_amount)}
                            </span>
                          </div>
                          <div className="text-[10px] text-white/50 mt-0.5 truncate">
                            Estoque: {formatBRL(rep.stock_purchase_amount)} · Frete: {formatBRL(rep.freight_amount)}
                          </div>
                          {rep.notes && (
                            <div className="text-[10px] text-white/40 italic truncate max-w-[200px]">
                              {rep.notes}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setRepurchaseToDelete(rep)}
                          className="size-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer min-h-[44px]"
                          title="Excluir Recompra"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ABA: EVOLUÇÃO (GRÁFICO MOBILE CALIBRADO)                           */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "evolucao" && (
          <div className="space-y-3.5">
            {/* Seletor de Modalidade: Dia a Dia vs Anual */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-black/60 border border-white/15 gap-1">
              <button
                type="button"
                onClick={() => {
                  setEvolutionMode("diario");
                  setTouchedPointIdx(null);
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
                  evolutionMode === "diario"
                    ? "bg-emerald-500 text-black font-black shadow-md"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <Calendar className="size-3.5" />
                <span>Dia a Dia (Ciclo)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEvolutionMode("anual");
                  setTouchedPointIdx(null);
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
                  evolutionMode === "anual"
                    ? "bg-emerald-500 text-black font-black shadow-md"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <BarChart3 className="size-3.5" />
                <span>Anual (12 Meses)</span>
              </button>
            </div>

            {/* O Gráfico SVG Responsivo */}
            {renderMobileChart()}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ABA: HISTÓRICO                                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "historico" && (
          <div className="space-y-3.5">
            {/* Seletor de Período em Pills */}
            <div className="grid grid-cols-4 p-1 rounded-2xl bg-black/60 border border-white/15 gap-1">
              {[
                { id: "mensal", label: "Mês" },
                { id: "trimestral", label: "Tri" },
                { id: "semestral", label: "Sem" },
                { id: "anual", label: "Ano" },
              ].map((sub) => {
                const isSel = historyTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setHistoryTab(sub.id as any)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center min-h-[44px] ${
                      isSel ? "bg-emerald-500 text-black font-black shadow-md" : "text-white/70"
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>

            {/* ─── 1. SUB-ABA: MENSAL (CICLOS OFICIAIS 14 -> 13) ─── */}
            {historyTab === "mensal" && (
              <div className="space-y-3.5">
                {/* Seletor de Ciclo Mensal */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] text-white/60 font-semibold flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-emerald-400" />
                      <span>Selecionar Ciclo Mensal:</span>
                    </span>
                    {selectedMonthlyMetric && (
                      <span
                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${
                          selectedMonthlyMetric.cycle.isCurrent
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-white/5 text-white/50 border-white/10"
                        }`}
                      >
                        {selectedMonthlyMetric.cycle.isCurrent ? "🟢 Vigente" : "🔒 Encerrado"}
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedMonthCycleId || selectedMonthlyMetric?.cycle.id || ""}
                    onChange={(e) => onSelectMonthCycleId(e.target.value)}
                    className="w-full bg-[#0e0e12] border border-white/15 rounded-xl px-3 py-2.5 text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50 cursor-pointer min-h-[44px]"
                  >
                    {monthlyCycles.map((m) => (
                      <option key={m.cycle.id} value={m.cycle.id} className="bg-[#121316] text-white">
                        {m.cycle.name} ({m.cycle.startDateStr.slice(0, 5)} → {m.cycle.endDateStr.slice(0, 5)}) {m.cycle.isCurrent ? "· Vigente" : "· Encerrado"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Card com KPIs Oficiais do Ciclo Mensal Selecionado */}
                {selectedMonthlyMetric ? (
                  <div className="space-y-3">
                    {/* 4 Cards Principais em Grid 2x2 */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Faturamento Bruto */}
                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          Faturamento Bruto
                        </span>
                        <div className="text-lg font-extrabold text-white">
                          {formatBRL(selectedMonthlyMetric.grossRevenue)}
                        </div>
                        <EvolutionBadge evolution={monthlyEvolution?.grossRevenue} />
                        <p className="text-[10px] text-white/50 truncate">
                          {selectedMonthlyMetric.totalOrders} ped ({selectedMonthlyMetric.totalPodsSold} un)
                        </p>
                      </div>

                      {/* CMV */}
                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          Custo Mercadorias (CMV)
                        </span>
                        <div className="text-lg font-extrabold text-red-400">
                          -{formatBRL(selectedMonthlyMetric.cmv)}
                        </div>
                        <EvolutionBadge evolution={monthlyEvolution?.cmv} invertColors={true} />
                        <p className="text-[10px] text-white/50 truncate">
                          Custo de mercadoria
                        </p>
                      </div>

                      {/* Frete e Logística */}
                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          Frete e Logística
                        </span>
                        <div className="text-lg font-extrabold text-white/80">
                          -{formatBRL(selectedMonthlyMetric.logisticsFee)}
                        </div>
                        <EvolutionBadge evolution={monthlyEvolution?.logisticsFee} invertColors={true} />
                        <p className="text-[10px] text-white/50 truncate">
                          Entregas locais
                        </p>
                      </div>

                      {/* Lucro Líquido Real */}
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block truncate">
                          Lucro Líquido Real
                        </span>
                        <div className="text-lg font-black text-emerald-300">
                          {formatBRL(selectedMonthlyMetric.netProfit)}
                        </div>
                        <EvolutionBadge evolution={monthlyEvolution?.netProfit} />
                        <p className="text-[10px] font-bold text-emerald-400 truncate">
                          Margem: {selectedMonthlyMetric.profitMargin}%
                        </p>
                      </div>
                    </div>

                    {/* Despesas Operacionais da Empresa (se houver no ciclo) */}
                    {selectedMonthlyMetric.companyExpenses > 0 && (
                      <div className="bg-orange-500/10 border border-orange-500/25 rounded-2xl p-3 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">
                            Custos da Empresa
                          </span>
                          <div className="text-base font-extrabold text-orange-300">
                            -{formatBRL(selectedMonthlyMetric.companyExpenses)}
                          </div>
                        </div>
                        <EvolutionBadge evolution={monthlyEvolution?.companyExpenses} invertColors={true} />
                      </div>
                    )}

                    {/* 4 Indicadores Secundários em Grid 2x2 */}
                    <div className="grid grid-cols-2 gap-2 bg-[#0e0e12] border border-white/10 rounded-2xl p-3 text-xs">
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Ticket Médio</span>
                        <span className="text-white font-extrabold text-sm">{formatBRL(selectedMonthlyMetric.averageTicket)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Preço Médio / Unidade</span>
                        <span className="text-white font-extrabold text-sm">{formatBRL(selectedMonthlyMetric.averagePricePerPod)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Recompras no Ciclo</span>
                        <span className="text-amber-300 font-extrabold text-sm">{formatBRL(selectedMonthlyMetric.stockPurchases)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Geração Líquida Caixa</span>
                        <span className="text-emerald-300 font-extrabold text-sm">{formatBRL(selectedMonthlyMetric.realCash)}</span>
                      </div>
                    </div>

                    {/* Lista Completa de Ciclos Mensais (Cards Interativos para Troca Rápida) */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                          <History className="size-3.5" />
                          <span>Todos os Ciclos Mensais (14 → 13)</span>
                        </span>
                        <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-bold">
                          {monthlyCycles.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {monthlyCycles.map((m) => {
                          const isSel = (selectedMonthCycleId || selectedMonthlyMetric?.cycle.id) === m.cycle.id;
                          return (
                            <div
                              key={m.cycle.id}
                              onClick={() => onSelectMonthCycleId(m.cycle.id)}
                              className={`bg-[#0e0e12] border rounded-2xl p-3.5 space-y-2 cursor-pointer transition-all active:scale-[0.98] ${
                                isSel
                                  ? "border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-950/20"
                                  : "border-white/10 hover:border-white/20"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-white text-xs">{m.cycle.name}</span>
                                  <span className="font-mono text-[10px] text-white/50">{m.cycle.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isSel && (
                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                      ● Ativo
                                    </span>
                                  )}
                                  <span
                                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                      m.cycle.isCurrent
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                        : "bg-white/10 text-white/50 border-white/10"
                                    }`}
                                  >
                                    {m.cycle.isCurrent ? "Vigente" : "Encerrado"}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5 text-xs">
                                <div>
                                  <span className="text-[10px] text-white/40 block">Faturamento</span>
                                  <span className="font-extrabold text-white">{formatBRL(m.grossRevenue)}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-white/40 block">Lucro Líquido Real</span>
                                  <span className="font-black text-emerald-300">
                                    {formatBRL(m.netProfit)} <span className="text-[10px] font-semibold text-emerald-400">({m.profitMargin}%)</span>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-white/50 pt-1 border-t border-white/5">
                                <span>{m.totalOrders} ped · {m.totalPodsSold} un · CMV: {formatBRL(m.cmv)}</span>
                                <span className="font-bold text-emerald-400/90">Saldo: {formatBRL(m.realCash)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-white/40 italic text-center py-4">Nenhum ciclo mensal disponível.</p>
                )}
              </div>
            )}

            {/* ─── 2. SUB-ABA: TRIMESTRAL (CONSOLIDAÇÃO DE 3 CICLOS) ─── */}
            {historyTab === "trimestral" && (
              <div className="space-y-3.5">
                {/* Seletor de Trimestre */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] text-white/60 font-semibold flex items-center gap-1.5">
                      <BarChart3 className="size-3.5 text-emerald-400" />
                      <span>Selecionar Trimestre (3 Ciclos):</span>
                    </span>
                    {selectedQuarter && (
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full border bg-white/5 text-white/70 border-white/10">
                        {selectedQuarter.includedCycles.length} ciclos
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedQuarterId || selectedQuarter?.id || ""}
                    onChange={(e) => onSelectQuarterId(e.target.value)}
                    className="w-full bg-[#0e0e12] border border-white/15 rounded-xl px-3 py-2.5 text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50 cursor-pointer min-h-[44px]"
                  >
                    {quarterlyPeriods.map((q) => (
                      <option key={q.id} value={q.id} className="bg-[#121316] text-white">
                        {q.name} ({q.label})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Card Principal do Trimestre Selecionado */}
                {selectedQuarter ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          Faturamento Trimestral
                        </span>
                        <div className="text-lg font-extrabold text-white">
                          {formatBRL(selectedQuarter.grossRevenue)}
                        </div>
                        <EvolutionBadge evolution={quarterlyEvolution?.grossRevenue} />
                        <p className="text-[10px] text-white/50 truncate">
                          {selectedQuarter.totalOrders} ped ({selectedQuarter.totalPodsSold} un)
                        </p>
                      </div>

                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          CMV Trimestral
                        </span>
                        <div className="text-lg font-extrabold text-red-400">
                          -{formatBRL(selectedQuarter.cmv)}
                        </div>
                        <EvolutionBadge evolution={quarterlyEvolution?.cmv} invertColors={true} />
                        <p className="text-[10px] text-white/50 truncate">
                          Custo nos 3 ciclos
                        </p>
                      </div>

                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          Frete Trimestral
                        </span>
                        <div className="text-lg font-extrabold text-white/80">
                          -{formatBRL(selectedQuarter.logisticsFee)}
                        </div>
                        <EvolutionBadge evolution={quarterlyEvolution?.logisticsFee} invertColors={true} />
                        <p className="text-[10px] text-white/50 truncate">
                          Fretes nos 3 ciclos
                        </p>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block truncate">
                          Lucro Líquido Trim.
                        </span>
                        <div className="text-lg font-black text-emerald-300">
                          {formatBRL(selectedQuarter.netProfit)}
                        </div>
                        <EvolutionBadge evolution={quarterlyEvolution?.netProfit} />
                        <p className="text-[10px] font-bold text-emerald-400 truncate">
                          Margem: {selectedQuarter.profitMargin}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-[#0e0e12] border border-white/10 rounded-2xl p-3 text-xs">
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Ticket Médio</span>
                        <span className="text-white font-extrabold text-sm">{formatBRL(selectedQuarter.averageTicket)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Preço Médio / Unidade</span>
                        <span className="text-white font-extrabold text-sm">{formatBRL(selectedQuarter.averagePricePerPod)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Recompras no Trimestre</span>
                        <span className="text-amber-300 font-extrabold text-sm">{formatBRL(selectedQuarter.stockPurchases)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Saldo do Trimestre</span>
                        <span className="text-emerald-300 font-extrabold text-sm">{formatBRL(selectedQuarter.realCash)}</span>
                      </div>
                    </div>

                    {/* Ciclos que Compõem o Trimestre */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="size-3.5" />
                          <span>Ciclos que Compõem este Trimestre</span>
                        </span>
                        <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-bold">
                          {selectedQuarter.includedCycles.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {selectedQuarter.includedCycles.map((c) => (
                          <div
                            key={c.cycle.id}
                            className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-white text-xs">{c.cycle.name}</span>
                              <span className="font-mono text-[10px] text-white/50">{c.cycle.label}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5 text-xs">
                              <div>
                                <span className="text-[10px] text-white/40 block">Faturamento</span>
                                <span className="font-extrabold text-white">{formatBRL(c.grossRevenue)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-white/40 block">Lucro Líquido</span>
                                <span className="font-black text-emerald-300">
                                  {formatBRL(c.netProfit)} <span className="text-[10px] font-semibold text-emerald-400">({c.profitMargin}%)</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-white/50 pt-1 border-t border-white/5">
                              <span>{c.totalOrders} ped · {c.totalPodsSold} pods · CMV: {formatBRL(c.cmv)}</span>
                              <span className="font-bold text-amber-300">Recompras: {formatBRL(c.stockPurchases)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-white/40 italic text-center py-4">Nenhum trimestre disponível.</p>
                )}
              </div>
            )}

            {/* ─── 3. SUB-ABA: SEMESTRAL (CONSOLIDAÇÃO DE 6 CICLOS) ─── */}
            {historyTab === "semestral" && (
              <div className="space-y-3.5">
                {/* Seletor de Semestre */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] text-white/60 font-semibold flex items-center gap-1.5">
                      <Layers className="size-3.5 text-emerald-400" />
                      <span>Selecionar Semestre (6 Ciclos):</span>
                    </span>
                    {selectedSemester && (
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full border bg-white/5 text-white/70 border-white/10">
                        {selectedSemester.includedCycles.length} ciclos
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedSemesterId || selectedSemester?.id || ""}
                    onChange={(e) => onSelectSemesterId(e.target.value)}
                    className="w-full bg-[#0e0e12] border border-white/15 rounded-xl px-3 py-2.5 text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50 cursor-pointer min-h-[44px]"
                  >
                    {semiannualPeriods.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#121316] text-white">
                        {s.name} ({s.label})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Card Principal do Semestre Selecionado */}
                {selectedSemester ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          Faturamento Semestral
                        </span>
                        <div className="text-lg font-extrabold text-white">
                          {formatBRL(selectedSemester.grossRevenue)}
                        </div>
                        <EvolutionBadge evolution={semiannualEvolution?.grossRevenue} />
                        <p className="text-[10px] text-white/50 truncate">
                          {selectedSemester.totalOrders} ped ({selectedSemester.totalPodsSold} pods)
                        </p>
                      </div>

                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          CMV Semestral
                        </span>
                        <div className="text-lg font-extrabold text-red-400">
                          -{formatBRL(selectedSemester.cmv)}
                        </div>
                        <EvolutionBadge evolution={semiannualEvolution?.cmv} invertColors={true} />
                        <p className="text-[10px] text-white/50 truncate">
                          Custo nos 6 ciclos
                        </p>
                      </div>

                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          Frete Semestral
                        </span>
                        <div className="text-lg font-extrabold text-white/80">
                          -{formatBRL(selectedSemester.logisticsFee)}
                        </div>
                        <EvolutionBadge evolution={semiannualEvolution?.logisticsFee} invertColors={true} />
                        <p className="text-[10px] text-white/50 truncate">
                          Fretes nos 6 ciclos
                        </p>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block truncate">
                          Lucro Líquido Sem.
                        </span>
                        <div className="text-lg font-black text-emerald-300">
                          {formatBRL(selectedSemester.netProfit)}
                        </div>
                        <EvolutionBadge evolution={semiannualEvolution?.netProfit} />
                        <p className="text-[10px] font-bold text-emerald-400 truncate">
                          Margem: {selectedSemester.profitMargin}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-[#0e0e12] border border-white/10 rounded-2xl p-3 text-xs">
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Ticket Médio</span>
                        <span className="text-white font-extrabold text-sm">{formatBRL(selectedSemester.averageTicket)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Preço Médio / Unidade</span>
                        <span className="text-white font-extrabold text-sm">{formatBRL(selectedSemester.averagePricePerPod)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Recompras no Semestre</span>
                        <span className="text-amber-300 font-extrabold text-sm">{formatBRL(selectedSemester.stockPurchases)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Saldo do Semestre</span>
                        <span className="text-emerald-300 font-extrabold text-sm">{formatBRL(selectedSemester.realCash)}</span>
                      </div>
                    </div>

                    {/* Ciclos que Compõem o Semestre */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="size-3.5" />
                          <span>Ciclos que Compõem este Semestre</span>
                        </span>
                        <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-bold">
                          {selectedSemester.includedCycles.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {selectedSemester.includedCycles.map((c) => (
                          <div
                            key={c.cycle.id}
                            className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-white text-xs">{c.cycle.name}</span>
                              <span className="font-mono text-[10px] text-white/50">{c.cycle.label}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5 text-xs">
                              <div>
                                <span className="text-[10px] text-white/40 block">Faturamento</span>
                                <span className="font-extrabold text-white">{formatBRL(c.grossRevenue)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-white/40 block">Lucro Líquido</span>
                                <span className="font-black text-emerald-300">
                                  {formatBRL(c.netProfit)} <span className="text-[10px] font-semibold text-emerald-400">({c.profitMargin}%)</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-white/50 pt-1 border-t border-white/5">
                              <span>{c.totalOrders} ped · {c.totalPodsSold} pods · CMV: {formatBRL(c.cmv)}</span>
                              <span className="font-bold text-amber-300">Recompras: {formatBRL(c.stockPurchases)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-white/40 italic text-center py-4">Nenhum semestre disponível.</p>
                )}
              </div>
            )}

            {/* ─── 4. SUB-ABA: ANUAL (CONSOLIDAÇÃO DE 12 CICLOS) ─── */}
            {historyTab === "anual" && (
              <div className="space-y-3.5">
                {/* Seletor de Ano */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] text-white/60 font-semibold flex items-center gap-1.5">
                      <Award className="size-3.5 text-emerald-400" />
                      <span>Selecionar Ano Financeiro (12 Ciclos):</span>
                    </span>
                    {selectedYear && (
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full border bg-white/5 text-white/70 border-white/10">
                        {selectedYear.includedCycles.length} ciclos
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedYearId || selectedYear?.id || ""}
                    onChange={(e) => onSelectYearId(e.target.value)}
                    className="w-full bg-[#0e0e12] border border-white/15 rounded-xl px-3 py-2.5 text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50 cursor-pointer min-h-[44px]"
                  >
                    {annualPeriods.map((y) => (
                      <option key={y.id} value={y.id} className="bg-[#121316] text-white">
                        {y.name} ({y.label})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Card Principal do Ano Selecionado */}
                {selectedYear ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          Faturamento Anual
                        </span>
                        <div className="text-lg font-extrabold text-white">
                          {formatBRL(selectedYear.grossRevenue)}
                        </div>
                        <EvolutionBadge evolution={annualEvolution?.grossRevenue} />
                        <p className="text-[10px] text-white/50 truncate">
                          {selectedYear.totalOrders} ped ({selectedYear.totalPodsSold} pods)
                        </p>
                      </div>

                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          CMV Anual
                        </span>
                        <div className="text-lg font-extrabold text-red-400">
                          -{formatBRL(selectedYear.cmv)}
                        </div>
                        <EvolutionBadge evolution={annualEvolution?.cmv} invertColors={true} />
                        <p className="text-[10px] text-white/50 truncate">
                          Custo no ano
                        </p>
                      </div>

                      <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
                          Frete Anual
                        </span>
                        <div className="text-lg font-extrabold text-white/80">
                          -{formatBRL(selectedYear.logisticsFee)}
                        </div>
                        <EvolutionBadge evolution={annualEvolution?.logisticsFee} invertColors={true} />
                        <p className="text-[10px] text-white/50 truncate">
                          Fretes no ano
                        </p>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 space-y-1 shadow-md">
                        <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block truncate">
                          Lucro Líquido Anual
                        </span>
                        <div className="text-lg font-black text-emerald-300">
                          {formatBRL(selectedYear.netProfit)}
                        </div>
                        <EvolutionBadge evolution={annualEvolution?.netProfit} />
                        <p className="text-[10px] font-bold text-emerald-400 truncate">
                          Margem: {selectedYear.profitMargin}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-[#0e0e12] border border-white/10 rounded-2xl p-3 text-xs">
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Ticket Médio</span>
                        <span className="text-white font-extrabold text-sm">{formatBRL(selectedYear.averageTicket)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Preço Médio / Pod</span>
                        <span className="text-white font-extrabold text-sm">{formatBRL(selectedYear.averagePricePerPod)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Recompras no Ano</span>
                        <span className="text-amber-300 font-extrabold text-sm">{formatBRL(selectedYear.stockPurchases)}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9.5px] uppercase font-semibold">Saldo do Ano</span>
                        <span className="text-emerald-300 font-extrabold text-sm">{formatBRL(selectedYear.realCash)}</span>
                      </div>
                    </div>

                    {/* Ciclos que Compõem o Ano */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="size-3.5" />
                          <span>Ciclos que Compõem este Ano</span>
                        </span>
                        <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-bold">
                          {selectedYear.includedCycles.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {selectedYear.includedCycles.map((c) => (
                          <div
                            key={c.cycle.id}
                            className="bg-[#0e0e12] border border-white/10 rounded-2xl p-3.5 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-white text-xs">{c.cycle.name}</span>
                              <span className="font-mono text-[10px] text-white/50">{c.cycle.label}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5 text-xs">
                              <div>
                                <span className="text-[10px] text-white/40 block">Faturamento</span>
                                <span className="font-extrabold text-white">{formatBRL(c.grossRevenue)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-white/40 block">Lucro Líquido</span>
                                <span className="font-black text-emerald-300">
                                  {formatBRL(c.netProfit)} <span className="text-[10px] font-semibold text-emerald-400">({c.profitMargin}%)</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-white/50 pt-1 border-t border-white/5">
                              <span>{c.totalOrders} ped · {c.totalPodsSold} pods · CMV: {formatBRL(c.cmv)}</span>
                              <span className="font-bold text-amber-300">Recompras: {formatBRL(c.stockPurchases)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-white/40 italic text-center py-4">Nenhum ano disponível.</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ━━━ BOTTOM SHEET: NOVA RECOMPRA DE ESTOQUE ━━━ */}
      {isRepurchaseSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#101014] border-t border-white/20 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <PackagePlus className="size-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Nova Recompra de Estoque</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRepurchaseSheetOpen(false)}
                className="size-9 rounded-xl bg-white/5 text-white/60 flex items-center justify-center cursor-pointer min-h-[44px]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRepurchase} className="p-4 space-y-3.5 overflow-y-auto custom-scrollbar">
              {repurchaseFormError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
                  {repurchaseFormError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Valor Pago no Estoque (R$) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 1500,00"
                  value={stockAmountInput}
                  onChange={(e) => setStockAmountInput(e.target.value)}
                  className="w-full bg-[#070709] border border-white/15 rounded-xl px-3.5 py-3 text-base font-bold text-white focus:outline-none focus:border-emerald-500 min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Frete da Reposição (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 80,00"
                  value={freightAmountInput}
                  onChange={(e) => setFreightAmountInput(e.target.value)}
                  className="w-full bg-[#070709] border border-white/15 rounded-xl px-3.5 py-3 text-base font-bold text-white focus:outline-none focus:border-emerald-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Data da Compra *
                </label>
                <input
                  type="date"
                  value={repurchaseDateInput}
                  onChange={(e) => setRepurchaseDateInput(e.target.value)}
                  className="w-full bg-[#070709] border border-white/15 rounded-xl px-3.5 py-3 text-base font-bold text-white focus:outline-none focus:border-emerald-500 min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Observações / Fornecedor
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: 50x Produtos / Fornecedor Central"
                  value={repurchaseNotesInput}
                  onChange={(e) => setRepurchaseNotesInput(e.target.value)}
                  className="w-full bg-[#070709] border border-white/15 rounded-xl px-3.5 py-2.5 text-base text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingRepurchase}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm py-3.5 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {isSavingRepurchase ? "Gravando Recompra..." : "Salvar Recompra"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ━━━ BOTTOM SHEET: CONFIRMAR EXCLUSÃO DE RECOMPRA ━━━ */}
      {repurchaseToDelete && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#101014] border-t border-white/20 rounded-t-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="size-5" />
                <h3 className="text-base font-bold text-white">Excluir Recompra?</h3>
              </div>
              <button
                type="button"
                onClick={() => setRepurchaseToDelete(null)}
                className="size-9 rounded-xl bg-white/5 text-white/60 flex items-center justify-center cursor-pointer min-h-[44px]"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              Tem certeza de que deseja remover esta reposição de{" "}
              <strong className="text-white font-extrabold">{formatBRL(repurchaseToDelete.total_repurchase_amount)}</strong>{" "}
              do dia {repurchaseToDelete.purchase_date}? Essa ação reverterá o impacto no Caixa Real.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setRepurchaseToDelete(null)}
                className="bg-white/10 hover:bg-white/15 text-white font-bold text-xs py-3 rounded-xl border border-white/15 min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingRepurchase}
                onClick={handleConfirmDeleteRepurchase}
                className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs py-3 rounded-xl shadow-lg active:scale-95 min-h-[44px] disabled:opacity-50"
              >
                {isSavingRepurchase ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ BOTTOM SHEET: AJUSTE DE METAS ━━━ */}
      {isGoalsSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#101014] border-t border-white/20 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Target className="size-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Ajustar Metas do Ciclo</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGoalsSheetOpen(false)}
                className="size-9 rounded-xl bg-white/5 text-white/60 flex items-center justify-center cursor-pointer min-h-[44px]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoals} className="p-4 space-y-3.5 overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Meta Mensal Global (R$) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editingMonthlyTarget}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingMonthlyTarget(val);
                    const num = parseFloat(val.replace(",", ".")) || 0;
                    const quarter = (num / 4).toFixed(2);
                    setEditingW1(quarter);
                    setEditingW2(quarter);
                    setEditingW3(quarter);
                    setEditingW4(quarter);
                  }}
                  className="w-full bg-[#070709] border border-white/15 rounded-xl px-3.5 py-3 text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 min-h-[44px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">Semana 1 (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editingW1}
                    onChange={(e) => setEditingW1(e.target.value)}
                    className="w-full bg-[#070709] border border-white/15 rounded-xl px-3 py-2.5 text-base font-bold text-white focus:outline-none focus:border-emerald-500 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">Semana 2 (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editingW2}
                    onChange={(e) => setEditingW2(e.target.value)}
                    className="w-full bg-[#070709] border border-white/15 rounded-xl px-3 py-2.5 text-base font-bold text-white focus:outline-none focus:border-emerald-500 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">Semana 3 (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editingW3}
                    onChange={(e) => setEditingW3(e.target.value)}
                    className="w-full bg-[#070709] border border-white/15 rounded-xl px-3 py-2.5 text-base font-bold text-white focus:outline-none focus:border-emerald-500 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">Semana 4 (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editingW4}
                    onChange={(e) => setEditingW4(e.target.value)}
                    className="w-full bg-[#070709] border border-white/15 rounded-xl px-3 py-2.5 text-base font-bold text-white focus:outline-none focus:border-emerald-500 min-h-[44px]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingGoals}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm py-3.5 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {isSavingGoals ? "Salvando Metas..." : "Salvar Metas do Ciclo"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ━━━ BOTTOM SHEET: NOVO CUSTO / DESPESA OPERACIONAL ━━━ */}
      {isExpenseSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#101014] border-t border-white/20 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-orange-400">
                <Building2 className="size-5" />
                <h3 className="text-base font-bold text-white">Lançar Custo da Empresa</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseSheetOpen(false)}
                className="size-9 rounded-xl bg-white/5 text-white/60 flex items-center justify-center cursor-pointer min-h-[44px]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-4 space-y-3.5 overflow-y-auto custom-scrollbar">
              {expenseFormError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
                  {expenseFormError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Valor da Despesa (R$) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 150,00"
                  value={expenseAmountInput}
                  onChange={(e) => setExpenseAmountInput(e.target.value)}
                  className="w-full bg-[#070709] border border-white/15 rounded-xl px-3.5 py-3 text-base font-bold text-orange-400 focus:outline-none focus:border-orange-500 min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Descrição do Custo *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Embalagens, Anúncios, Sistema..."
                  value={expenseDescInput}
                  onChange={(e) => setExpenseDescInput(e.target.value)}
                  className="w-full bg-[#070709] border border-white/15 rounded-xl px-3.5 py-3 text-base text-white focus:outline-none focus:border-orange-500 min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Data da Despesa *
                </label>
                <input
                  type="date"
                  value={expenseDateInput}
                  onChange={(e) => setExpenseDateInput(e.target.value)}
                  className="w-full bg-[#070709] border border-white/15 rounded-xl px-3.5 py-3 text-base font-bold text-white focus:outline-none focus:border-orange-500 min-h-[44px]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSavingExpense}
                className="w-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-sm py-3.5 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {isSavingExpense ? "Lançando Custo..." : "Registrar Custo Operacional"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export const MobileFinanceView = React.memo(MobileFinanceViewComponent);
