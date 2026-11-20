import { useState, useEffect, useMemo, useRef } from "react";
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
  CalendarDays,
  Clock,
  ChevronRight,
  Trash2,
  Plus,
  X,
  AlertCircle,
  History,
  FileText,
  CheckCircle2,
  GitCompare,
  ChevronDown,
  ChevronUp,
  Zap,
  Scale,
  Globe,
  Route,
  Building2,
  Users,
  Banknote,
  Search,
  ArrowDownRight,
  AlertTriangle,
  Calculator,
  Edit3,
  UserPlus,
  Minus,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { fetchProductCostsMap } from "../lib/productCosts";
import { MobileFinanceView } from "./finance/MobileFinanceView";
import { NationalSalesModal } from "./NationalSalesModal";
import { ManualSaleModal } from "./ManualSaleModal";
import { WeeklyGoalsModal } from "./WeeklyGoalsModal";
import { NewTransactionModal } from "./partners/NewTransactionModal";
import { isOrderNational, extractNationalInfo } from "@/lib/nationalSales";
import { isOrderFiadoPending, extractFiadoInfo } from "@/lib/fiadoSales";
import { isCaixaRealReset, setCaixaRealReset } from "@/lib/financialCycles";
import {
  type WeeklyGoalsConfig,
  loadWeeklyGoals,
  syncWeeklyGoalsFromOrders,
  calculateWeeklyPerformances,
} from "@/lib/weeklyGoals";
import {
  fetchStockRepurchases,
  createStockRepurchase,
  deleteStockRepurchase,
  enrichStockRepurchasesList,
  type StockRepurchase,
} from "../lib/stockRepurchases";
import { RepurchaseComparisonModal } from "./finance/RepurchaseComparisonModal";
import { RegisterStockModal } from "./stock/RegisterStockModal";
import {
  calculateUnifiedFinancials,
  type UnifiedFinancialOverview,
} from "@/lib/unifiedFinancialEngine";
import {
  loadLocalPayrollConfig,
  saveLocalPayrollConfig,
  savePayrollConfigToSupabase,
  type PayrollConfig,
  type PartnerPayrollItem,
} from "@/lib/partnerPayroll";
import {
  deletePartnerTransaction,
  type Partner,
  type PartnerTransaction,
  type PartnerTransactionType,
  calculatePartnersFinancials,
} from "@/lib/partners";
import { NewPartnerModal } from "./partners/NewPartnerModal";
import { PayrollConfigModal } from "./partners/PayrollConfigModal";
import { DilutionSimulatorModal } from "./partners/DilutionSimulatorModal";

import {
  type CycleDefinition,
  type CycleFinancialMetrics,
  type ConsolidatedPeriod,
  type AllTimeFinancialMetrics,
  type PeriodEvolution,
  type GroupedPeriodEvolution,
  getCurrentCycle,
  getCycleForDate,
  getSaoPauloDateParts,
  MONTH_NAMES,
  calculateMetricsForCycle,
  calculateAllTimeMetrics,
  calculatePeriodEvolutions,
  generateHistoricalMonthlyCycles,
  generateHistoricalQuarters,
  generateHistoricalSemesters,
  generateHistoricalYears,
  filterValidOrders,
  CLEAN_SLATE_RESET_TIMESTAMP,
} from "../lib/financialCycles";

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
      <div className="flex items-center gap-1 text-[11px] text-white/40">
        <span className="italic">Sem comparação</span>
        <span className="text-[10px] text-white/30">vs. período anterior</span>
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
    <div className="flex items-center gap-1.5 text-xs font-semibold">
      <span className={color}>
        {evolution.arrow} {evolution.text}
      </span>
      <span className="text-[11px] text-white/40 font-normal">
        {evolution.labelVs}
      </span>
    </div>
  );
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
 * Componente de visualização gráfica da evolução do faturamento (Aba Evolução)
 */
/**
 * Funções auxiliares para geração de curvas Bézier cúbicas suaves (estilo TradingView/Stripe)
 */
/**
 * Algoritmo Fritsch-Carlson de Spline Cúbica Monotônica (padrão TradingView / D3 Monotone)
 * Garante que a curva financeira passe com precisão cirúrgica por cada ponto:
 * - Em valores zerados (0), a curva se mantém 100% reta no piso (sem ondulações ou mergulhos)
 * - Em picos de alta e fundos (quedas), a derivada é zero, eliminando qualquer efeito balão
 * - Reproduz o visual exato de gráficos de ativos / day trade de alta resolução
 */
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

/**
 * Componente Gráfico SaaS Técnico & Minimalista (Revenue Performance)
 * Estilo Day Trade / Terminal Financeiro:
 * - Altura compacta e proporcional (180px) para não tomar a tela toda
 * - Curva Monotônica de alta fidelidade
 * - Resting state 100% limpo, sem números colidindo
 * - Crosshair + HUD dinâmico no hover
 */
function RevenueEvolutionChart({
  data,
  periodType,
  availableCycles,
  selectedCycleId,
  onCycleChange,
}: {
  data: EvolutionPoint[];
  periodType: "mensal" | "anual";
  availableCycles?: CycleFinancialMetrics[];
  selectedCycleId?: string;
  onCycleChange?: (id: string) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-center text-white/40 text-xs italic bg-[#0f1115] border border-white/10 rounded-xl">
        Nenhum dado disponível para o período selecionado.
      </div>
    );
  }

  // KPIs totais
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const totalNetProfit = data.reduce((sum, d) => sum + d.netProfit, 0);
  const totalOrdersCount = data.reduce((sum, d) => sum + d.orders, 0);
  const totalPodsCount = data.reduce((sum, d) => sum + d.pods, 0);
  const overallMargin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

  // Dimensões compactas estilo trading terminal (180px de altura)
  const width = 740;
  const height = 180;
  const padLeft = 52;
  const padRight = 20;
  const padTop = 14;
  const padBottom = 26;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxVal = Math.max(...data.map((d) => Math.max(d.revenue, d.netProfit)), 50);
  const yMax = Math.ceil(maxVal * 1.12);

  // Mapear pontos
  const revenuePoints = data.map((d, i) => {
    const x = data.length === 1 ? padLeft + chartW / 2 : padLeft + (i / (data.length - 1)) * chartW;
    const y = padTop + chartH - (Math.max(0, d.revenue) / yMax) * chartH;
    return { ...d, x, y, index: i };
  });

  const profitPoints = data.map((d, i) => {
    const x = data.length === 1 ? padLeft + chartW / 2 : padLeft + (i / (data.length - 1)) * chartW;
    const y = padTop + chartH - (Math.max(0, d.netProfit) / yMax) * chartH;
    return { ...d, x, y, index: i };
  });

  const revLinePath = generateSmoothPath(revenuePoints);
  const revAreaPath = generateSmoothArea(revenuePoints, padTop + chartH);
  const profLinePath = generateSmoothPath(profitPoints);

  // 4 níveis Y limpos (0%, 33%, 66%, 100%)
  const gridLevels = [0, 0.33, 0.66, 1];

  // No modo Mensal (~30 dias) espaça labels; no Anual (12 meses) exibe TODOS
  const isMonthlyDaily = periodType === "mensal";
  const xLabelStep = isMonthlyDaily ? Math.max(1, Math.ceil(data.length / 8)) : 1;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const clampedX = Math.max(padLeft, Math.min(width - padRight, svgX));
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < revenuePoints.length; i++) {
      const d = Math.abs(revenuePoints[i].x - clampedX);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHoveredIdx(best);
  };

  const handlePointerLeave = () => setHoveredIdx(null);

  const activePoint = hoveredIdx !== null ? revenuePoints[hoveredIdx] : null;
  const activeProfitPoint = hoveredIdx !== null ? profitPoints[hoveredIdx] : null;

  return (
    <div className="bg-[#0f1115] border border-white/10 rounded-xl p-3 sm:p-3.5 shadow-xl relative select-none">
      {/* Header Compacto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
        <div>
          <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
            <span>Desempenho Financeiro</span>
            <span className="text-[9px] text-white/30 font-normal">Revenue Performance</span>
          </h4>
          <p className="text-[10px] text-white/40 mt-0.5">
            {isMonthlyDaily
              ? "Acompanhamento dia a dia das vendas e rentabilidade do ciclo."
              : "Visão mensal dos 12 meses do ano financeiro."}
          </p>
        </div>

        {/* Seletor de Ciclo (modo Mensal) */}
        {isMonthlyDaily && availableCycles && availableCycles.length > 0 && onCycleChange && (
          <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0 self-start sm:self-auto">
            <span className="text-[10px] text-white/40 shrink-0">Ciclo:</span>
            <select
              value={selectedCycleId || availableCycles[0]?.cycle.id}
              onChange={(e) => onCycleChange(e.target.value)}
              className="w-full sm:w-auto max-w-full min-w-0 truncate bg-black/80 border border-white/15 rounded-lg px-2.5 py-1 sm:py-0.5 text-[11px] font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
            >
              {availableCycles.map((c) => (
                <option key={c.cycle.id} value={c.cycle.id} className="bg-[#121316] text-white">
                  {c.cycle.name} {c.cycle.isCurrent ? "(Vigente)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Legenda Estilo Terminal */}
      <div className="flex items-center justify-between gap-3 mb-1.5 text-[11px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#10b981] shadow-sm shadow-emerald-500/40" />
            <span className="text-white/80 font-medium text-[10.5px]">Faturamento Bruto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#06b6d4] shadow-sm shadow-cyan-500/40" />
            <span className="text-white/80 font-medium text-[10.5px]">Lucro Líquido Real</span>
          </div>
        </div>
        <span className="text-[9.5px] text-white/35 hidden sm:inline-block">
          Passe o cursor sobre a curva para inspecionar
        </span>
      </div>

      {/* SVG Chart Compacto com Tooltip Seguro (overflow-visible para nunca cortar o card) */}
      <div className="relative w-full overflow-visible">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            <linearGradient id="saasAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
              <stop offset="60%" stopColor="#10b981" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Rótulo lateral Y */}
          <text
            transform="rotate(-90)"
            x={-(padTop + chartH / 2)}
            y="12"
            textAnchor="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize="7.5"
            fontWeight="500"
          >
            Receita (R$)
          </text>

          {/* Grade Horizontal + Labels Y */}
          {gridLevels.map((lvl) => {
            const yVal = padTop + chartH - lvl * chartH;
            const val = lvl * yMax;
            return (
              <g key={`hg-${lvl}`}>
                <line x1={padLeft} y1={yVal} x2={width - padRight} y2={yVal} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x={padLeft - 5} y={yVal + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="8.5" fontFamily="monospace">
                  {lvl === 0 ? "0" : formatBRL(val).replace(",00", "")}
                </text>
              </g>
            );
          })}

          {/* Grade Vertical */}
          {revenuePoints.map((p, i) => {
            if (i % xLabelStep !== 0 && i !== revenuePoints.length - 1) return null;
            return (
              <line key={`vg-${i}`} x1={p.x} y1={padTop} x2={p.x} y2={padTop + chartH} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            );
          })}

          {/* Área sob a curva de faturamento */}
          {revAreaPath && <path d={revAreaPath} fill="url(#saasAreaGrad)" />}

          {/* Linha Faturamento (Verde Esmeralda) */}
          {revLinePath && (
            <path d={revLinePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Linha Lucro (Ciano) */}
          {profLinePath && (
            <path d={profLinePath} fill="none" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Crosshair vertical no hover */}
          {hoveredIdx !== null && activePoint && (
            <>
              <line x1={activePoint.x} y1={padTop} x2={activePoint.x} y2={padTop + chartH} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1={padLeft} y1={activePoint.y} x2={activePoint.x} y2={activePoint.y} stroke="rgba(16,185,129,0.3)" strokeWidth="1" strokeDasharray="2 2" />
              {activeProfitPoint && (
                <line x1={padLeft} y1={activeProfitPoint.y} x2={activeProfitPoint.x} y2={activeProfitPoint.y} stroke="rgba(6,182,212,0.3)" strokeWidth="1" strokeDasharray="2 2" />
              )}
            </>
          )}

          {/* Dots Lucro */}
          {profitPoints.map((p, i) => {
            const isHov = hoveredIdx === i;
            const show = p.netProfit > 0 || isHov;
            if (!show && data.length > 15) return null;
            return (
              <circle
                key={`pd-${i}`}
                cx={p.x}
                cy={p.y}
                r={isHov ? 4.5 : 2}
                fill={isHov ? "#ffffff" : "#06b6d4"}
                stroke={isHov ? "#06b6d4" : "none"}
                strokeWidth={isHov ? 2 : 0}
              />
            );
          })}

          {/* Dots Faturamento */}
          {revenuePoints.map((p, i) => {
            const isHov = hoveredIdx === i;
            const show = p.revenue > 0 || isHov;
            if (!show && data.length > 15) return null;
            return (
              <circle
                key={`rd-${i}`}
                cx={p.x}
                cy={p.y}
                r={isHov ? 5 : 2.5}
                fill={isHov ? "#ffffff" : "#10b981"}
                stroke={isHov ? "#10b981" : "#0f1115"}
                strokeWidth={isHov ? 2 : 1}
              />
            );
          })}

          {/* Eixo X labels */}
          {revenuePoints.map((p, i) => {
            const isHov = hoveredIdx === i;
            if (!isHov && i % xLabelStep !== 0 && i !== revenuePoints.length - 1) return null;
            return (
              <text
                key={`xl-${i}`}
                x={p.x}
                y={padTop + chartH + 14}
                textAnchor="middle"
                fill={isHov ? "#ffffff" : "rgba(255,255,255,0.45)"}
                fontSize={isHov ? "8.5" : "8"}
                fontWeight={isHov ? "bold" : "normal"}
                fontFamily="monospace"
              >
                {p.label.replace(" (vigente)", "").replace(" (atual)", "")}
              </text>
            );
          })}

          {/* Rótulo inferior central */}
          <text
            x={padLeft + chartW / 2}
            y={height - 3}
            textAnchor="middle"
            fill="rgba(255,255,255,0.25)"
            fontSize="8"
            fontWeight="500"
          >
            {isMonthlyDaily ? "Dias do Ciclo (14 → 13)" : "12 Meses do Ano (Jan → Dez)"}
          </text>
        </svg>

        {/* HUD / Tooltip flutuante inteligente (inverte para baixo quando o ponto está no topo, garantindo 100% de visibilidade) */}
        {hoveredIdx !== null && activePoint && (() => {
          // Se o ponto estiver na metade superior do gráfico (ex: pico de Agosto), exibe o tooltip ABAIXO do ponto
          // Se o ponto estiver na metade inferior, exibe ACIMA do ponto
          const isNearTop = activePoint.y < height * 0.55;
          const isNearRight = activePoint.x > width * 0.72;
          const isNearLeft = activePoint.x < width * 0.28;

          const xTranslate = isNearRight ? "-95%" : isNearLeft ? "-5%" : "-50%";
          const yTranslate = isNearTop ? "14px" : "calc(-100% - 14px)";

          return (
            <div
              className="pointer-events-none absolute z-30 transition-transform duration-75 ease-out"
              style={{
                left: `${(activePoint.x / width) * 100}%`,
                top: `${(activePoint.y / height) * 100}%`,
                transform: `translate(${xTranslate}, ${yTranslate})`,
              }}
            >
              <div className="bg-[#12141a]/95 border border-white/20 rounded-lg p-2.5 shadow-2xl backdrop-blur-md min-w-[180px] text-[11px] space-y-1">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
                  <span className="font-bold text-white text-[11px] truncate max-w-[145px]">
                    {activePoint.fullTitle}
                  </span>
                  {activePoint.isCurrent && (
                    <span className="text-[7.5px] bg-emerald-500/25 text-emerald-300 px-1 py-0.2 rounded font-bold shrink-0">
                      Atual
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between gap-2 pt-0.5">
                  <span className="text-white/50 text-[9.5px] flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-[#10b981]" />
                    Faturamento:
                  </span>
                  <span className="text-emerald-400 font-extrabold text-xs">
                    {formatBRL(activePoint.revenue)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-white/50 text-[9.5px] flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-[#06b6d4]" />
                    Lucro Líquido:
                  </span>
                  <span className="text-cyan-400 font-bold text-xs">
                    {formatBRL(activePoint.netProfit)}
                  </span>
                </div>

                {activePoint.revenue > 0 && (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-white/50 text-[9px]">Margem:</span>
                    <span className="text-white/80 font-medium text-[9.5px]">
                      {((activePoint.netProfit / activePoint.revenue) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}

                <div className="pt-0.5 border-t border-white/5 flex items-center justify-between text-[9px] text-white/45">
                  <span>Volume:</span>
                  <span className="text-white font-medium">
                    {activePoint.orders} ped · {activePoint.pods} pods
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* KPIs Footer Compacto */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 mt-1.5 border-t border-white/5 text-[11px]">
        <div>
          <span className="text-white/40 block text-[9px] uppercase font-semibold">
            Faturamento Total
          </span>
          <span className="text-emerald-400 font-extrabold text-xs sm:text-sm">
            {formatBRL(totalRevenue)}
          </span>
        </div>
        <div>
          <span className="text-white/40 block text-[9px] uppercase font-semibold">
            Lucro Líquido Total
          </span>
          <span className="text-cyan-400 font-extrabold text-xs sm:text-sm">
            {formatBRL(totalNetProfit)}
          </span>
        </div>
        <div>
          <span className="text-white/40 block text-[9px] uppercase font-semibold">
            Margem Líquida
          </span>
          <span className="text-white font-extrabold text-xs sm:text-sm">
            {overallMargin.toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-white/40 block text-[9px] uppercase font-semibold">
            Volume Total
          </span>
          <span className="text-white/80 font-medium text-[11px]">
            {totalOrdersCount} ped ({totalPodsCount} pods)
          </span>
        </div>
      </div>
    </div>
  );
}

interface ComparisonDayRecord {
  dayIndex: number;
  relativeLabel: string;
  baseDateFormatted: string;
  baseFullDate: string;
  baseRevenue: number;
  baseProfit: number;
  baseOrders: number;
  basePods: number;
  baseAccumRevenue: number;
  isBaseFuture: boolean;
  isBaseToday: boolean;

  compDateFormatted: string;
  compFullDate: string;
  compRevenue: number;
  compProfit: number;
  compOrders: number;
  compPods: number;
  compAccumRevenue: number;

  diffRevenue: number;
  diffPercentRevenue: number;
  diffAccumRevenue: number;
  diffAccumPercentRevenue: number;
}

/**
 * Componente Gráfico Comparativo Mês a Mês (MoM Benchmark)
 * Estilo Day Trade / Terminal Financeiro Ultracompacto (180px de altura)
 * Cruza o Mês Atual (Verde Esmeralda) com o Mês Passado (Roxo/Violeta Neon)
 */
function MonthComparisonChart({
  records,
  baseCycleName,
  compCycleName,
  mode,
  onModeChange,
}: {
  records: ComparisonDayRecord[];
  baseCycleName: string;
  compCycleName: string;
  mode: "diario" | "acumulado";
  onModeChange: (m: "diario" | "acumulado") => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!records || records.length === 0) {
    return (
      <div className="p-6 text-center text-white/40 text-xs italic bg-[#0f1115] border border-white/10 rounded-xl">
        Selecione dois ciclos para visualizar o comparativo mês a mês.
      </div>
    );
  }

  // Dimensões compactas exatas (180px de altura) — evita gráficos enormes
  const width = 740;
  const height = 180;
  const padLeft = 52;
  const padRight = 20;
  const padTop = 14;
  const padBottom = 26;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const isAcum = mode === "acumulado";

  // Identificar valor máximo para escala Y
  const maxVal = Math.max(
    ...records.map((r) => {
      const bVal = isAcum ? r.baseAccumRevenue : (r.isBaseFuture ? 0 : r.baseRevenue);
      const cVal = isAcum ? r.compAccumRevenue : r.compRevenue;
      return Math.max(bVal, cVal);
    }),
    50
  );
  const yMax = Math.ceil(maxVal * 1.12);

  // Mapear pontos do Mês Atual (apenas dias já decorridos)
  const validBaseRecords = records.filter((r) => !r.isBaseFuture);
  const basePoints = validBaseRecords.map((r) => {
    const x = records.length <= 1
      ? padLeft + chartW / 2
      : padLeft + ((r.dayIndex - 1) / (records.length - 1)) * chartW;
    const val = isAcum ? r.baseAccumRevenue : r.baseRevenue;
    const y = padTop + chartH - (Math.max(0, val) / yMax) * chartH;
    return { ...r, x, y, val };
  });

  // Mapear pontos do Mês Anterior (todos os dias do ciclo histórico)
  const compPoints = records.map((r) => {
    const x = records.length <= 1
      ? padLeft + chartW / 2
      : padLeft + ((r.dayIndex - 1) / (records.length - 1)) * chartW;
    const val = isAcum ? r.compAccumRevenue : r.compRevenue;
    const y = padTop + chartH - (Math.max(0, val) / yMax) * chartH;
    return { ...r, x, y, val };
  });

  const baseLinePath = generateSmoothPath(basePoints);
  const baseAreaPath = generateSmoothArea(basePoints, padTop + chartH);
  const compLinePath = generateSmoothPath(compPoints);

  const gridLevels = [0, 0.33, 0.66, 1];
  const xLabelStep = Math.max(1, Math.ceil(records.length / 8));

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const clampedX = Math.max(padLeft, Math.min(width - padRight, svgX));
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < records.length; i++) {
      const px = padLeft + (i / (records.length - 1)) * chartW;
      const d = Math.abs(px - clampedX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHoveredIdx(best);
  };

  const handlePointerLeave = () => setHoveredIdx(null);

  const activeRecord = hoveredIdx !== null ? records[hoveredIdx] : null;

  return (
    <div className="bg-[#0f1115] border border-white/10 rounded-xl p-3 sm:p-3.5 shadow-xl relative select-none">
      {/* Header Compacto com Legenda e Alternador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#10b981] shadow-sm shadow-emerald-500/40" />
            <span className="text-white/90 font-bold text-[11px]">{baseCycleName}</span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-extrabold uppercase">Atual</span>
          </div>
          <span className="text-white/30 text-xs font-mono">vs</span>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#a855f7] shadow-sm shadow-purple-500/40" />
            <span className="text-white/80 font-medium text-[11px]">{compCycleName}</span>
            <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold uppercase">Anterior</span>
          </div>
        </div>

        {/* Alternador de Modo do Gráfico */}
        <div className="inline-flex p-0.5 rounded-lg bg-black/60 border border-white/15 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onModeChange("diario")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
              mode === "diario"
                ? "bg-white text-black shadow-sm font-extrabold"
                : "text-white/60 hover:text-white"
            }`}
          >
            📊 Vendas Diárias
          </button>
          <button
            type="button"
            onClick={() => onModeChange("acumulado")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
              mode === "acumulado"
                ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-sm font-extrabold"
                : "text-white/60 hover:text-white"
            }`}
          >
            📈 Faturamento Acumulado (Ritmo)
          </button>
        </div>
      </div>

      {/* SVG Chart Compacto (180px) */}
      <div className="relative w-full overflow-visible">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            <linearGradient id="compBaseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
              <stop offset="60%" stopColor="#10b981" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="compTargetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Rótulo lateral Y */}
          <text
            transform="rotate(-90)"
            x={-(padTop + chartH / 2)}
            y="12"
            textAnchor="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize="7.5"
            fontWeight="500"
          >
            {isAcum ? "Acumulado (R$)" : "Receita Diária (R$)"}
          </text>

          {/* Grade Horizontal + Labels Y */}
          {gridLevels.map((lvl) => {
            const yVal = padTop + chartH - lvl * chartH;
            const val = lvl * yMax;
            return (
              <g key={`cg-${lvl}`}>
                <line x1={padLeft} y1={yVal} x2={width - padRight} y2={yVal} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x={padLeft - 5} y={yVal + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="8.5" fontFamily="monospace">
                  {lvl === 0 ? "0" : formatBRL(val).replace(",00", "")}
                </text>
              </g>
            );
          })}

          {/* Grade Vertical */}
          {records.map((r, i) => {
            if (i % xLabelStep !== 0 && i !== records.length - 1) return null;
            const x = padLeft + (i / (records.length - 1)) * chartW;
            return (
              <line key={`cvg-${i}`} x1={x} y1={padTop} x2={x} y2={padTop + chartH} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            );
          })}

          {/* Área sob a curva do mês atual */}
          {baseAreaPath && <path d={baseAreaPath} fill="url(#compBaseGrad)" />}

          {/* Linha Mês Anterior (Violeta Neon tracejada elegante) */}
          {compLinePath && (
            <path
              d={compLinePath}
              fill="none"
              stroke="#a855f7"
              strokeWidth="2"
              strokeDasharray={isAcum ? "none" : "5 2.5"}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          )}

          {/* Linha Mês Atual (Verde Esmeralda sólida destacada) */}
          {baseLinePath && (
            <path
              d={baseLinePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Crosshair vertical no hover */}
          {hoveredIdx !== null && (
            <>
              {(() => {
                const hovX = padLeft + (hoveredIdx / (records.length - 1)) * chartW;
                return (
                  <line
                    x1={hovX}
                    y1={padTop}
                    x2={hovX}
                    y2={padTop + chartH}
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                );
              })()}
            </>
          )}

          {/* Dots Mês Anterior */}
          {compPoints.map((p, i) => {
            const isHov = hoveredIdx === i;
            const show = p.val > 0 || isHov;
            if (!show && records.length > 15) return null;
            return (
              <circle
                key={`cpd-${i}`}
                cx={p.x}
                cy={p.y}
                r={isHov ? 4.5 : 2}
                fill={isHov ? "#ffffff" : "#a855f7"}
                stroke={isHov ? "#a855f7" : "none"}
                strokeWidth={isHov ? 2 : 0}
              />
            );
          })}

          {/* Dots Mês Atual */}
          {basePoints.map((p, i) => {
            const isHov = hoveredIdx === (p.dayIndex - 1);
            const show = p.val > 0 || isHov;
            if (!show && records.length > 15) return null;
            return (
              <circle
                key={`bpd-${i}`}
                cx={p.x}
                cy={p.y}
                r={isHov ? 5 : 2.5}
                fill={isHov ? "#ffffff" : "#10b981"}
                stroke={isHov ? "#10b981" : "#0f1115"}
                strokeWidth={isHov ? 2 : 1}
              />
            );
          })}

          {/* Labels do Eixo X */}
          {records.map((r, i) => {
            const isHov = hoveredIdx === i;
            if (!isHov && i % xLabelStep !== 0 && i !== records.length - 1) return null;
            const x = padLeft + (i / (records.length - 1)) * chartW;
            return (
              <text
                key={`cxl-${i}`}
                x={x}
                y={padTop + chartH + 13}
                textAnchor="middle"
                fill={isHov ? "#ffffff" : "rgba(255,255,255,0.45)"}
                fontSize={isHov ? "8.5" : "7.5"}
                fontWeight={isHov ? "bold" : "normal"}
                fontFamily="monospace"
              >
                {r.baseDateFormatted !== "—" ? r.baseDateFormatted : r.compDateFormatted}
              </text>
            );
          })}

          {/* Legenda do Eixo X */}
          <text
            x={padLeft + chartW / 2}
            y={height - 2}
            textAnchor="middle"
            fill="rgba(255,255,255,0.25)"
            fontSize="8"
            fontWeight="500"
          >
            Dias do Ciclo (14 → 13) · Datas de Vendas nos Dois Meses
          </text>
        </svg>

        {/* HUD / Tooltip Flutuante Duplo */}
        {hoveredIdx !== null && activeRecord && (() => {
          const hovX = padLeft + (hoveredIdx / (records.length - 1)) * chartW;
          const isNearRight = hovX > width * 0.70;
          const isNearLeft = hovX < width * 0.30;
          const xTranslate = isNearRight ? "-95%" : isNearLeft ? "-5%" : "-50%";

          const baseVal = isAcum ? activeRecord.baseAccumRevenue : activeRecord.baseRevenue;
          const compVal = isAcum ? activeRecord.compAccumRevenue : activeRecord.compRevenue;
          const diff = baseVal - compVal;
          const diffPerc = compVal > 0 ? (diff / compVal) * 100 : 0;

          return (
            <div
              className="pointer-events-none absolute z-30 transition-transform duration-75 ease-out"
              style={{
                left: `${(hovX / width) * 100}%`,
                top: "10px",
                transform: `translateX(${xTranslate})`,
              }}
            >
              <div className="bg-[#12141a]/95 border border-white/20 rounded-xl p-3 shadow-2xl backdrop-blur-md min-w-[210px] text-[11px] space-y-1.5">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
                  <span className="font-extrabold text-white text-[11px]">
                    Dia {activeRecord.dayIndex} do Ciclo
                  </span>
                  <span className="text-[9px] text-white/50 font-mono">
                    {activeRecord.baseDateFormatted} vs {activeRecord.compDateFormatted}
                  </span>
                </div>

                {/* Mês Atual */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/60 flex items-center gap-1 font-medium">
                      <span className="size-1.5 rounded-full bg-[#10b981]" />
                      {baseCycleName}:
                    </span>
                    <span className="font-black text-emerald-400">
                      {activeRecord.isBaseFuture ? "Ainda não decorrido" : formatBRL(baseVal)}
                    </span>
                  </div>
                  {!activeRecord.isBaseFuture && (
                    <div className="text-[9px] text-white/40 pl-2.5">
                      {activeRecord.basePods} pods em {activeRecord.baseOrders} ped
                    </div>
                  )}
                </div>

                {/* Mês Anterior */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/60 flex items-center gap-1 font-medium">
                      <span className="size-1.5 rounded-full bg-[#a855f7]" />
                      {compCycleName}:
                    </span>
                    <span className="font-bold text-purple-300">
                      {formatBRL(compVal)}
                    </span>
                  </div>
                  <div className="text-[9px] text-white/40 pl-2.5">
                    {activeRecord.compPods} pods em {activeRecord.compOrders} ped
                  </div>
                </div>

                {/* Diferença */}
                {!activeRecord.isBaseFuture && (
                  <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px]">
                    <span className="text-white/60 font-semibold">Variação:</span>
                    <span
                      className={`font-black flex items-center gap-0.5 ${
                        diff >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {diff >= 0 ? "+" : ""}{formatBRL(diff)} ({diff >= 0 ? "+" : ""}{diffPerc.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// Cache em memória para dados brutos do Financeiro (evita re-fetch em navegações rápidas entre páginas)
import {
  type FinanceDataCache,
  FINANCE_CACHE_TTL_MS,
  invalidateFinanceCache,
  getFinanceSessionCache,
  setFinanceSessionCache,
} from "@/lib/financeCache";
export { invalidateFinanceCache };

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    if (diffMs < 0) return "Agora";
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Agora mesmo";
    if (diffMins < 60) return `Há ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "Há 1 hora";
    if (diffHours < 24) return `Há ${diffHours} horas`;
    return "Ontem";
  } catch {
    return dateString;
  }
}

function formatOrderClockTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  } catch {
    return "";
  }
}

export default function FinanceDashboard({
  initialTab,
}: {
  initialTab?: "visao-geral" | "24h" | "patrimonio" | "socios" | "faturamento" | "dre" | "caixa" | "pro-labore" | "resultados";
} = {}) {
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

  // Estados de Ciclo Financeiro (Regra 14 -> 13 no fuso America/Sao_Paulo)
  const [currentCycle, setCurrentCycle] = useState<CycleDefinition>(getCurrentCycle());
  const [monthlyCycles, setMonthlyCycles] = useState<CycleFinancialMetrics[]>([]);
  const [partnerTransactions, setPartnerTransactions] = useState<any[]>([]);
  const [quarterlyPeriods, setQuarterlyPeriods] = useState<ConsolidatedPeriod[]>([]);
  const [semiannualPeriods, setSemiannualPeriods] = useState<ConsolidatedPeriod[]>([]);
  const [annualPeriods, setAnnualPeriods] = useState<ConsolidatedPeriod[]>([]);
  const [allValidOrders, setAllValidOrders] = useState<any[]>([]);
  const [persistedProductCosts, setPersistedProductCosts] = useState<Record<string, number>>({});

  // Seletores da Área: Faturamento a Longo Prazo (3 Abas: Histórico, Evolução e Comparativo)
  const [longTermTab, setLongTermTab] = useState<"historico" | "evolucao" | "comparativo">("historico");
  const [historyTab, setHistoryTab] = useState<"mensal" | "trimestral" | "semestral" | "anual">("mensal");
  const [evolutionTab, setEvolutionTab] = useState<"mensal" | "anual">("mensal");
  const [selectedEvolutionCycleId, setSelectedEvolutionCycleId] = useState<string>("");
  const [selectedMonthCycleId, setSelectedMonthCycleId] = useState<string>("");
  const [selectedQuarterId, setSelectedQuarterId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  // Seletores da Área de Comparação Mês a Mês
  const [compBaseCycleId, setCompBaseCycleId] = useState<string>("");
  const [compTargetCycleId, setCompTargetCycleId] = useState<string>("");
  const [compChartMode, setCompChartMode] = useState<"diario" | "acumulado">("diario");
  const [showCompDailyTable, setShowCompDailyTable] = useState<boolean>(false);

  // Vendas Nacionais (Fora de SP / Correios)
  const [isNationalModalOpen, setIsNationalModalOpen] = useState(false);
  const [isNationalManualSaleOpen, setIsNationalManualSaleOpen] = useState(false);

  // Metas Semanais (4 Semanas do Ciclo 14 -> 13)
  const [weeklyGoalsConfig, setWeeklyGoalsConfig] = useState<WeeklyGoalsConfig>(() =>
    loadWeeklyGoals(company?.id, currentCycle.id)
  );
  const [isWeeklyGoalsModalOpen, setIsWeeklyGoalsModalOpen] = useState(false);

  // ── Módulo Ativo dos Módulos Financeiros Integrados SMK ──
  const [mainTab, setMainTab] = useState<"visao-geral" | "24h" | "patrimonio" | "socios" | "faturamento">(() => {
    if (initialTab === "24h") return "24h";
    if (initialTab === "socios" || initialTab === "pro-labore") return "socios";
    if (initialTab === "patrimonio") return "patrimonio";
    if (initialTab === "resultados") return "faturamento";
    return "visao-geral";
  });

  useEffect(() => {
    if (initialTab) {
      if (initialTab === "24h") {
        setMainTab("24h");
      } else if (initialTab === "socios" || initialTab === "pro-labore") {
        setMainTab("socios");
      } else if (initialTab === "patrimonio") {
        setMainTab("patrimonio");
      } else if (initialTab === "resultados") {
        setMainTab("faturamento");
      } else {
        setMainTab("visao-geral");
      }
    }
  }, [initialTab]);

  // Aba Últimas 24 Horas
  const [search24h, setSearch24h] = useState<string>("");
  const [filterPayment24h, setFilterPayment24h] = useState<string>("TODOS");

  // Modais de Sócios & Tesouraria
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [newTxDefaultType, setNewTxDefaultType] = useState<PartnerTransactionType>('APORTE');
  const [newTxDefaultPartnerId, setNewTxDefaultPartnerId] = useState<string | undefined>(undefined);
  const [newTxDefaultAmount, setNewTxDefaultAmount] = useState<number | undefined>(undefined);
  const [isNewPartnerModalOpen, setIsNewPartnerModalOpen] = useState(false);
  const [isPayrollConfigModalOpen, setIsPayrollConfigModalOpen] = useState(false);
  const [isDilutionModalOpen, setIsDilutionModalOpen] = useState(false);

  // Extrato de Movimentações
  const [txFilterType, setTxFilterType] = useState<string>("TODOS");
  const [txSearchQuery, setTxSearchQuery] = useState<string>("");
  const [txToDelete, setTxToDelete] = useState<PartnerTransaction | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState(false);

  // Folha de Pagamento Config
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig>(() =>
    loadLocalPayrollConfig(company?.id || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5", [])
  );

  // Raw Orders State (Preservado para contagem oficial de fiados pendentes e pedidos válidos)
  const [rawOrdersList, setRawOrdersList] = useState<any[]>([]);
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [isCompanyExpenseModalOpen, setIsCompanyExpenseModalOpen] = useState(false);

  // Recompra de Estoque & Caixa Real State (Módulo Independente)
  const [repurchases, setRepurchases] = useState<StockRepurchase[]>([]);
  const [financeProductsList, setFinanceProductsList] = useState<any[]>([]);
  const [loadingRepurchases, setLoadingRepurchases] = useState(false);
  const [isRepurchaseModalOpen, setIsRepurchaseModalOpen] = useState(false);
  const [isRepurchaseComparisonOpen, setIsRepurchaseComparisonOpen] = useState(false);
  const [selectedRepurchaseForComparison, setSelectedRepurchaseForComparison] = useState<string | null>(null);
  const [isRegisterStockModalOpen, setIsRegisterStockModalOpen] = useState(false);
  const [repurchaseToDelete, setRepurchaseToDelete] = useState<StockRepurchase | null>(null);

  const enrichedRepurchases = useMemo(
    () => enrichStockRepurchasesList(repurchases, financeProductsList),
    [repurchases, financeProductsList]
  );

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

  const hasLoadedOnceRef = useRef(false);
  const fetchInFlightRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const fetchFinanceDataRef = useRef<(isRetry?: boolean, forceRefresh?: boolean) => Promise<void>>(async () => {});

  const fetchFinanceData = async (isRetry = false, forceRefresh = false): Promise<void> => {
    if (authLoading) return;
    // Single-flight: evita consultas sobrepostas; se chegar evento durante a busca, agenda 1 nova rodada
    if (fetchInFlightRef.current && !isRetry) {
      pendingRefreshRef.current = true;
      return;
    }
    fetchInFlightRef.current = true;
    try {
      await fetchFinanceDataInner(isRetry, forceRefresh);
    } finally {
      fetchInFlightRef.current = false;
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        fetchFinanceDataRef.current(false, true);
      }
    }
  };

  const fetchFinanceDataInner = async (isRetry = false, forceRefresh = false): Promise<void> => {

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
      const now = Date.now();
      const cached = getFinanceSessionCache();
      const hasFreshCache =
        !forceRefresh &&
        cached &&
        cached.companyId === targetCompanyId &&
        now - cached.timestamp < FINANCE_CACHE_TTL_MS;

      // Spinner de tela cheia SOMENTE no primeiro carregamento.
      // Atualizações em segundo plano (realtime/refresh) mantêm a tela visível.
      if (!hasFreshCache && !hasLoadedOnceRef.current) {
        setLoading(true);
      }
      setFinanceError(null);

      let persistedCosts: Record<string, number> = {};
      let rawOrders: any[] = [];
      let productsData: any[] = [];
      let loadedRepurchases: StockRepurchase[] = [];
      let loadedPartnerTxs: any[] = [];
      let loadedPartners: any[] = [];

      if (hasFreshCache && cached) {
        persistedCosts = cached.data.persistedCosts;
        rawOrders = cached.data.rawOrders;
        productsData = cached.data.productsData;
        loadedRepurchases = cached.data.repurchases;
        loadedPartnerTxs = cached.data.partnerTxs;
        loadedPartners = cached.data.partners;
      } else {
        // Executa todas as consultas financeiras em paralelo com projeção leve (sem Base64 de imagens)
        const [persistedCostsRes, ordersRes, productsRes, repurchasesRes, partnerTxRes, partnersRes] = await Promise.all([
          fetchProductCostsMap(targetCompanyId).catch(() => ({})),
          supabase
            .from("smoking_orders")
            .select("*")
            .eq("company_id", targetCompanyId)
            .neq("delivery_status", "CANCELADO"),
          supabase
            .from("smoking_products")
            .select("id, brand, name, stock, price, cost_price")
            .eq("company_id", targetCompanyId)
            .eq("is_active", true),
          supabase
            .from("smoking_stock_repurchases")
            .select("*")
            .eq("company_id", targetCompanyId)
            .order("purchase_date", { ascending: false }),
          supabase
            .from("smoking_partner_transactions")
            .select("*")
            .eq("company_id", targetCompanyId),
          supabase
            .from("smoking_partners")
            .select("*")
            .eq("company_id", targetCompanyId),
        ]);

        // Inspecionar explicitamente se smoking_orders retornou erro
        if (ordersRes.error) {
          console.error("[FinanceDashboard] Erro ao consultar smoking_orders:", ordersRes.error.message);
          const isAuth =
            ordersRes.error.code === "42501" ||
            ordersRes.error.message?.includes("permission denied") ||
            ordersRes.error.message?.includes("JWT") ||
            ordersRes.error.message?.includes("token");

          // Tentativa de recuperação única se for erro de permissão/token
          if (isAuth && !isRetry) {
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session?.user) {
              console.log("[FinanceDashboard] Sessão Supabase confirmada. Executando retry único...");
              return fetchFinanceData(true, true);
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
          return;
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

        persistedCosts = persistedCostsRes || {};
        rawOrders = ordersRes.data;
        productsData = productsRes.data;

        if (!rawOrders) {
          setFinanceError({
            message: "Resposta do banco de dados não retornou lista de pedidos válida.",
          });
          setLoading(false);
          return;
        }

        // Mapear recompras oficiais da empresa
        if (Array.isArray(repurchasesRes.data)) {
          loadedRepurchases = repurchasesRes.data.map((row: any) => ({
            id: row.id,
            company_id: row.company_id || targetCompanyId,
            stock_purchase_amount: Number(row.stock_purchase_amount) || 0,
            freight_amount: Number(row.freight_amount) || 0,
            total_repurchase_amount:
              Number(row.total_repurchase_amount) ||
              (Number(row.stock_purchase_amount) || 0) + (Number(row.freight_amount) || 0),
            purchase_date: row.purchase_date || new Date().toISOString().split("T")[0],
            notes: row.notes || "",
            created_at: row.created_at || new Date().toISOString(),
          }));
        }

        loadedPartnerTxs = partnerTxRes?.data || [];
        loadedPartners = partnersRes?.data || [];

        // Salvar no cache em memória
        setFinanceSessionCache({
          companyId: targetCompanyId,
          timestamp: Date.now(),
          data: {
            persistedCosts,
            rawOrders,
            productsData,
            repurchases: loadedRepurchases,
            partnerTxs: loadedPartnerTxs,
            partners: loadedPartners,
          },
        });
      }

      setRepurchases(loadedRepurchases);
      setFinanceProductsList(productsData || []);
      setRawOrdersList(rawOrders || []);
      const validOrders = filterValidOrders(rawOrders);
      setAllValidOrders(validOrders);
      setPersistedProductCosts(persistedCosts);

      setPartnerTransactions(loadedPartnerTxs);
      setPartnersList(loadedPartners);

      // Identificar Ciclo Vigente e Sincronizar Metas
      const curCycle = getCurrentCycle();
      setCurrentCycle(curCycle);
      const syncedGoals = syncWeeklyGoalsFromOrders(rawOrders, targetCompanyId, curCycle.id);
      setWeeklyGoalsConfig(syncedGoals);

      // 4. Gerar Histórico de Longo Prazo (Mensal, Trimestral, Semestral e Anual)
      const historicalMonths = generateHistoricalMonthlyCycles(
        validOrders,
        loadedRepurchases,
        persistedCosts,
        loadedPartnerTxs,
        loadedPartners
      );
      setMonthlyCycles(historicalMonths);

      // Selecionar o ciclo mensal fechado mais recente (ex: Agosto/2026) por padrão para consulta imediata
      const firstClosed = historicalMonths.find((m) => m.cycle.isClosed);
      const defaultCycleId = firstClosed ? firstClosed.cycle.id : (historicalMonths[0]?.cycle.id || curCycle.id);
      setSelectedMonthCycleId((prev) => prev || defaultCycleId);

      const quarters = generateHistoricalQuarters(historicalMonths);
      setQuarterlyPeriods(quarters);
      if (quarters.length > 0) {
        setSelectedQuarterId((prev) => prev || quarters[0].id);
      }

      const semesters = generateHistoricalSemesters(historicalMonths);
      setSemiannualPeriods(semesters);
      if (semesters.length > 0) {
        setSelectedSemesterId((prev) => prev || semesters[0].id);
      }

      const years = generateHistoricalYears(historicalMonths);
      setAnnualPeriods(years);
      if (years.length > 0) {
        setSelectedYearId((prev) => prev || years[0].id);
      }

      setHasLoadedSuccessfully(true);
      hasLoadedOnceRef.current = true;
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

  // Mantém o ref sempre apontando para a versão mais recente (evita closure velha no realtime)
  fetchFinanceDataRef.current = fetchFinanceData;

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

    // Busca consolidada inicial (já busca ordens, produtos leves, recompras, sócios e custos em paralelo)
    fetchFinanceDataRef.current();

    // Debounce para listeners Realtime: agrupa rajadas (ex.: venda = pedido + baixa de estoque) em 1 só recarga silenciosa
    let debounceTimer: any = null;
    const handleRealtimeChange = () => {
      invalidateFinanceCache();
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchFinanceDataRef.current(false, true);
      }, 1500);
    };

    const targetCompanyId = company.id;
    const companyFilter = `company_id=eq.${targetCompanyId}`;
    const financeChannel = supabase
      .channel(`finance_realtime_${targetCompanyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_orders", filter: companyFilter }, handleRealtimeChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_products", filter: companyFilter }, handleRealtimeChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_stock_repurchases", filter: companyFilter }, handleRealtimeChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_partner_transactions", filter: companyFilter }, handleRealtimeChange)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(financeChannel);
    };
    // Dependências PRIMITIVAS: renovação de token do Supabase recria o objeto `user`
    // e antes disso disparava recarga completa + nova assinatura realtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, company?.id, !!companyUser, authLoading]);

  // ── MOTOR FINANCEIRO UNIFICADO SMK (FONTE ÚNICA DA VERDADE) ──
  const targetCompanyId = company?.id || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
  const unified = useMemo<UnifiedFinancialOverview>(() => {
    return calculateUnifiedFinancials({
      companyId: targetCompanyId,
      orders: rawOrdersList.length > 0 ? rawOrdersList : allValidOrders,
      products: financeProductsList,
      repurchases,
      partners: partnersList,
      partnerTransactions,
      payrollConfig,
      persistedCosts: persistedProductCosts,
      cleanSlateTimestamp: CLEAN_SLATE_RESET_TIMESTAMP,
    });
  }, [
    targetCompanyId,
    rawOrdersList,
    allValidOrders,
    financeProductsList,
    repurchases,
    partnersList,
    partnerTransactions,
    payrollConfig,
    persistedProductCosts,
  ]);

  // Indicadores Oficiais Mapeados Diretamente do Motor Unificado
  const grossRevenue = unified.grossRevenue;
  const cmv = unified.cmv;
  const companyExpenses = unified.companyExpenses;
  const logisticsFee = unified.logisticsFee;
  const netProfit = unified.netProfit;
  const profitMargin = unified.profitMargin;
  const totalOrders = unified.totalOrders;
  const totalPodsSold = unified.totalPodsSold;
  const brandSales = unified.brandSales;
  const realCash = unified.cash.realCash;
  const stockAssetCost = unified.stock.stockAssetCost;
  const stockAssetRetail = unified.stock.stockAssetRetail;
  const stockAssetUnits = unified.stock.totalUnitsInStock;
  const totalFiadoPending = unified.accountsReceivable;
  const allTimeMetrics = unified.allTimeMetrics;
  const totalStockPurchases = allTimeMetrics.stockPurchases;
  const totalFreightRepurchases = allTimeMetrics.freightRepurchases;
  const totalInvestedRepurchases = allTimeMetrics.totalInvestedRepurchases;

  // Overview para simuladores e compatibilidade
  const financialsOverview = useMemo(() => {
    return calculatePartnersFinancials({
      partners: partnersList,
      transactions: partnerTransactions,
      orders: rawOrdersList.length > 0 ? rawOrdersList : allValidOrders,
      products: financeProductsList,
      persistedCosts: persistedProductCosts,
      repurchases,
      companyId: targetCompanyId,
      payrollConfig,
    });
  }, [partnersList, partnerTransactions, rawOrdersList, allValidOrders, financeProductsList, persistedProductCosts, repurchases, targetCompanyId, payrollConfig]);

  // Handler para exclusão segura de movimentações no Extrato
  const handleConfirmDeleteTx = async () => {
    if (!txToDelete) return;
    try {
      setIsDeletingTx(true);
      await deletePartnerTransaction(txToDelete.id, targetCompanyId);
      setTxToDelete(null);
      await fetchFinanceData(false, true);
    } catch (err: any) {
      alert("Erro ao excluir movimentação: " + (err?.message || "Erro desconhecido"));
    } finally {
      setIsDeletingTx(false);
    }
  };

  // Filtro de Transações para o Extrato
  const filteredTransactions = useMemo(() => {
    let list = [...partnerTransactions];
    if (txFilterType !== "TODOS") {
      list = list.filter((tx) => tx.type === txFilterType);
    }
    if (txSearchQuery.trim()) {
      const q = txSearchQuery.toLowerCase().trim();
      list = list.filter((tx) => {
        const desc = (tx.description || "").toLowerCase();
        const partnerName = (tx.partner_name || "").toLowerCase();
        return desc.includes(q) || partnerName.includes(q);
      });
    }
    return list.sort((a, b) => {
      const dateA = a.date || a.created_at || "";
      const dateB = b.date || b.created_at || "";
      return dateB.localeCompare(dateA);
    });
  }, [partnerTransactions, txFilterType, txSearchQuery]);

  // Sincronizar configuração de Metas Semanais
  useEffect(() => {
    setWeeklyGoalsConfig(loadWeeklyGoals(company?.id, currentCycle.id));
    const handleGoalsUpdate = () => {
      setWeeklyGoalsConfig(loadWeeklyGoals(company?.id, currentCycle.id));
    };
    window.addEventListener("smk-weekly-goals-updated", handleGoalsUpdate);
    return () => window.removeEventListener("smk-weekly-goals-updated", handleGoalsUpdate);
  }, [company?.id, currentCycle.id]);

  // Desempenho Realizado das 4 Semanas do Ciclo Atual (Semana 1 a 4)
  const weeklyPerformances = useMemo(() => {
    return calculateWeeklyPerformances(
      currentCycle,
      allValidOrders,
      weeklyGoalsConfig,
      persistedProductCosts
    );
  }, [currentCycle, allValidOrders, weeklyGoalsConfig, persistedProductCosts]);

  // Trajeto da Meta Mensal (Termômetro de Compensação Global do Ciclo)
  const monthlyTrajectory = useMemo(() => {
    const totalRealized = Number(weeklyPerformances.reduce((acc, wp) => acc + wp.revenue, 0).toFixed(2));
    const target = weeklyGoalsConfig.monthlyTarget || 7000;
    const diffFromTarget = Number((totalRealized - target).toFixed(2)); // Saldo total oficial do mês
    const isTargetAchieved = totalRealized >= target;
    const remaining = isTargetAchieved ? 0 : Number((target - totalRealized).toFixed(2));
    const surplus = isTargetAchieved ? diffFromTarget : 0;
    const progressPerc = target > 0 ? (totalRealized / target) * 100 : 0;

    // Saldo acumulado oficial final (ou da última semana processada)
    const finalCumulativeBalance = weeklyPerformances.length > 0
      ? weeklyPerformances[weeklyPerformances.length - 1].cumulativeBalance
      : diffFromTarget;

    const [endD, endM, endY] = currentCycle.endDateStr.split("/").map(Number);
    const cycleEndDate = new Date(endY, endM - 1, endD, 23, 59, 59, 999);
    const now = new Date();
    const diffTime = cycleEndDate.getTime() - now.getTime();
    const remainingDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const dailyPaceNeeded = remainingDays > 0 ? remaining / remainingDays : 0;

    return {
      totalRealized,
      target,
      remaining,
      surplus,
      isTargetAchieved,
      diffFromTarget,
      finalCumulativeBalance,
      progressPerc,
      remainingDays,
      dailyPaceNeeded,
    };
  }, [weeklyPerformances, weeklyGoalsConfig.monthlyTarget, currentCycle.endDateStr]);

  // ─── Apuração em Tempo Real: Janela Móvel de 24 Horas ────────────────────
  const last24hData = useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const orders24hRaw = (allValidOrders || []).filter((order: any) => {
      if (!order.created_at) return false;
      const orderTime = new Date(order.created_at).getTime();
      return orderTime >= oneDayAgo && orderTime <= now + 60000;
    }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    let totalRevenue = 0;
    let totalCMV = 0;
    let totalPods = 0;
    const uniqueClientsSet = new Set<string>();

    const enrichedOrders = orders24hRaw.map((order: any) => {
      let orderRevenue = 0;
      let orderCMV = 0;
      let orderPods = 0;

      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const brand = (item.brand || "OUTROS").toUpperCase();
        const modelName = (item.name || "POD").toUpperCase();
        const itemPrice = Number(item.price || item.unit_price) || 0;
        const modelKey = (item.modelKey || `${brand}__${modelName}`).toLowerCase();

        let itemCost = Number(item.cost_price || item.costPrice) || 0;
        if (!itemCost && item.product_id && persistedProductCosts[item.product_id]) {
          itemCost = persistedProductCosts[item.product_id];
        }
        if (!itemCost && modelKey && DEFAULT_MODEL_COSTS[modelKey]) {
          itemCost = DEFAULT_MODEL_COSTS[modelKey];
        }
        if (!itemCost) itemCost = 65;

        orderRevenue += qty * itemPrice;
        orderCMV += qty * itemCost;
        orderPods += qty;
      }

      const shippingFee = parseFloat(order.shipping_fee || 0);
      const isNational = isOrderNational(order);
      let nationalShippingProfit = 0;
      let motoboyShippingFee = 0;
      if (isNational) {
        const info = extractNationalInfo(order);
        const shipCharged = info.shippingFeeCharged || shippingFee;
        const shipCost = info.shippingCostReal || 0;
        nationalShippingProfit = Math.max(0, shipCharged - shipCost);
      } else {
        motoboyShippingFee = shippingFee;
      }

      // Faturamento líquido dos produtos (Sem taxa de frete repassada ao motoboy)
      const baseProductRevenue = orderRevenue > 0
        ? orderRevenue
        : Math.max(0, (Number(order.total_amount) || 0) - motoboyShippingFee);

      const finalRevenue = Number((baseProductRevenue + nationalShippingProfit).toFixed(2));
      const orderNetProfit = Number((finalRevenue - orderCMV).toFixed(2));
      const orderMarginPct = finalRevenue > 0 ? (orderNetProfit / finalRevenue) * 100 : 0;

      totalRevenue += finalRevenue;
      totalCMV += orderCMV;
      totalPods += orderPods;

      const clientKey = (order.client_phone || order.client_name || order.id || "").toLowerCase().trim();
      if (clientKey) uniqueClientsSet.add(clientKey);

      return {
        ...order,
        computedRevenue: finalRevenue,
        computedCMV: orderCMV,
        computedNetProfit: orderNetProfit,
        computedMarginPct: orderMarginPct,
        computedPods: orderPods,
        shippingFeePassedThrough: motoboyShippingFee,
      };
    });

    const netProfit = totalRevenue - totalCMV;
    const marginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const avgTicket = enrichedOrders.length > 0 ? totalRevenue / enrichedOrders.length : 0;

    return {
      orders: enrichedOrders,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCMV: Number(totalCMV.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      marginPct: Number(marginPct.toFixed(1)),
      ordersCount: enrichedOrders.length,
      totalPods,
      avgTicket: Number(avgTicket.toFixed(2)),
      uniqueClientsCount: uniqueClientsSet.size,
    };
  }, [allValidOrders, persistedProductCosts]);

  const filtered24hOrders = useMemo(() => {
    return last24hData.orders.filter((order: any) => {
      if (filterPayment24h !== "TODOS") {
        const method = (order.payment_method || "").toUpperCase();
        if (filterPayment24h === "PIX" && !method.includes("PIX")) return false;
        if (filterPayment24h === "CARTAO" && !method.includes("CART") && !method.includes("CRED") && !method.includes("DEB")) return false;
        if (filterPayment24h === "DINHEIRO" && !method.includes("DINH") && !method.includes("ESPEC")) return false;
        if (filterPayment24h === "FIADO" && !isOrderFiadoPending(order)) return false;
      }

      if (search24h.trim()) {
        const q = search24h.toLowerCase().trim();
        const clientName = (order.client_name || "").toLowerCase();
        const clientPhone = (order.client_phone || "").toLowerCase();
        const itemsStr = Array.isArray(order.items)
          ? order.items.map((i: any) => `${i.name || ''} ${i.flavor || ''}`).join(' ').toLowerCase()
          : '';
        if (!clientName.includes(q) && !clientPhone.includes(q) && !itemsStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [last24hData.orders, search24h, filterPayment24h]);

  // Seletores Memoizados para a Área de Faturamento a Longo Prazo
  const selectedMonthlyMetric = useMemo(() => {
    return (
      monthlyCycles.find((m) => m.cycle.id === selectedMonthCycleId) ||
      monthlyCycles.find((m) => m.cycle.isClosed) ||
      monthlyCycles[0] ||
      null
    );
  }, [monthlyCycles, selectedMonthCycleId]);

  // Comparação Mensal: ciclo financeiro imediatamente anterior (14 -> 13)
  const previousMonthlyMetric = useMemo(() => {
    if (!selectedMonthlyMetric) return null;
    const { year, month } = selectedMonthlyMetric.cycle;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevId = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
    return monthlyCycles.find((m) => m.cycle.id === prevId) || null;
  }, [selectedMonthlyMetric, monthlyCycles]);

  const monthlyEvolution = useMemo(() => {
    return calculatePeriodEvolutions(selectedMonthlyMetric, previousMonthlyMetric, "ciclo anterior");
  }, [selectedMonthlyMetric, previousMonthlyMetric]);

  const selectedQuarter = useMemo(() => {
    return quarterlyPeriods.find((q) => q.id === selectedQuarterId) || quarterlyPeriods[0] || null;
  }, [quarterlyPeriods, selectedQuarterId]);

  // Comparação Trimestral: trimestre imediatamente anterior (os 3 ciclos anteriores)
  const previousQuarter = useMemo(() => {
    if (!selectedQuarter) return null;
    const idx = quarterlyPeriods.findIndex((q) => q.id === selectedQuarter.id);
    if (idx >= 0 && idx < quarterlyPeriods.length - 1) {
      return quarterlyPeriods[idx + 1];
    }
    return null;
  }, [selectedQuarter, quarterlyPeriods]);

  const quarterlyEvolution = useMemo(() => {
    return calculatePeriodEvolutions(selectedQuarter, previousQuarter, "período anterior");
  }, [selectedQuarter, previousQuarter]);

  const selectedSemester = useMemo(() => {
    return semiannualPeriods.find((s) => s.id === selectedSemesterId) || semiannualPeriods[0] || null;
  }, [semiannualPeriods, selectedSemesterId]);

  // Comparação Semestral: semestre imediatamente anterior (os 6 ciclos anteriores)
  const previousSemester = useMemo(() => {
    if (!selectedSemester) return null;
    const idx = semiannualPeriods.findIndex((s) => s.id === selectedSemester.id);
    if (idx >= 0 && idx < semiannualPeriods.length - 1) {
      return semiannualPeriods[idx + 1];
    }
    return null;
  }, [selectedSemester, semiannualPeriods]);

  const semiannualEvolution = useMemo(() => {
    return calculatePeriodEvolutions(selectedSemester, previousSemester, "período anterior");
  }, [selectedSemester, previousSemester]);

  const selectedYear = useMemo(() => {
    return annualPeriods.find((y) => y.id === selectedYearId) || annualPeriods[0] || null;
  }, [annualPeriods, selectedYearId]);

  // Comparação Anual: ano financeiro imediatamente anterior (os 12 ciclos anteriores)
  const previousYear = useMemo(() => {
    if (!selectedYear) return null;
    const idx = annualPeriods.findIndex((y) => y.id === selectedYear.id);
    if (idx >= 0 && idx < annualPeriods.length - 1) {
      return annualPeriods[idx + 1];
    }
    return null;
  }, [selectedYear, annualPeriods]);

  const annualEvolution = useMemo(() => {
    return calculatePeriodEvolutions(selectedYear, previousYear, "período anterior");
  }, [selectedYear, previousYear]);

  // Ciclo Ativo Selecionado para a Aba Evolução (padrão: ciclo mais recente / vigente)
  const activeEvolutionCycle = useMemo(() => {
    if (selectedEvolutionCycleId) {
      const found = monthlyCycles.find((m) => m.cycle.id === selectedEvolutionCycleId);
      if (found) return found;
    }
    return monthlyCycles[0] || null;
  }, [monthlyCycles, selectedEvolutionCycleId]);

  // Dias do Ciclo Selecionado (Visão de 30 dias contínuos 14 -> 13 dia a dia - processado apenas se aba Evolução estiver ativa)
  const monthlyCycleDailyPoints = useMemo<EvolutionPoint[]>(() => {
    if (longTermTab !== "evolucao") return [];
    if (!activeEvolutionCycle) return [];

    const cycleDef = activeEvolutionCycle.cycle;
    const [startD, startM, startY] = cycleDef.startDateStr.split("/").map(Number);
    const [endD, endM, endY] = cycleDef.endDateStr.split("/").map(Number);

    const startDate = new Date(startY, startM - 1, startD, 12, 0, 0);
    const endDate = new Date(endY, endM - 1, endD, 12, 0, 0);

    const nowSP = getSaoPauloDateParts(new Date());
    const todayStr = `${nowSP.year}-${String(nowSP.month).padStart(2, "0")}-${String(nowSP.day).padStart(2, "0")}`;

    const WEEKDAYS_FULL = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];

    // Indexar pedidos por data no fuso America/Sao_Paulo
    const ordersByDay = new Map<string, any[]>();
    for (const order of allValidOrders || []) {
      if (!order.created_at) continue;
      const p = getSaoPauloDateParts(order.created_at);
      const key = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
      if (!ordersByDay.has(key)) {
        ordersByDay.set(key, []);
      }
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
            const brand = (item.brand || "OUTROS").toUpperCase();
            const modelName = (item.name || "POD").toUpperCase();
            const itemPrice = Number(item.price || item.unit_price) || 0;
            const modelKey = (item.modelKey || `${brand}__${modelName}`).toLowerCase();

            let itemCost = Number(item.cost_price || item.costPrice) || 0;
            if (!itemCost && item.product_id && persistedProductCosts[item.product_id]) {
              itemCost = persistedProductCosts[item.product_id];
            }
            if (!itemCost && modelKey && DEFAULT_MODEL_COSTS[modelKey]) {
              itemCost = DEFAULT_MODEL_COSTS[modelKey];
            }
            if (!itemCost) itemCost = 65;

            dayRev += qty * itemPrice;
            dayCmv += qty * itemCost;
            dayPods += qty;
          }
        } else {
          dayRev += Number(o.total_amount) || 0;
          dayCmv += (Number(o.total_amount) || 0) * 0.45;
          dayPods += 1;
        }
      }

      const dayProfit = dayRev - dayCmv;
      const isToday = dateKey === todayStr;
      const dayOfWeek = cur.getDay();
      const fullWd = WEEKDAYS_FULL[dayOfWeek];
      const dayFormatted = String(parts.day).padStart(2, "0");
      const monthFormatted = String(parts.month).padStart(2, "0");

      points.push({
        id: dateKey,
        label: `${dayFormatted}/${monthFormatted}`,
        fullTitle: `${parts.day} de ${MONTH_NAMES[parts.month]} de ${parts.year}${isToday ? " (Hoje)" : ""}`,
        periodLabel: `${fullWd} · ${dayFormatted}/${monthFormatted}/${parts.year}`,
        revenue: Number(dayRev.toFixed(2)),
        cmv: Number(dayCmv.toFixed(2)),
        netProfit: Number(dayProfit.toFixed(2)),
        orders: dayOrders.length,
        pods: dayPods,
        isCurrent: isToday,
      });

      cur.setDate(cur.getDate() + 1);
      if (points.length > 35) break;
    }

    return points;
  }, [longTermTab, activeEvolutionCycle, allValidOrders, persistedProductCosts]);

  // Dados Reais da Aba Evolução (Curva de Faturamento ao Longo dos Períodos - calculada somente na aba ativa)
  const evolutionData = useMemo<EvolutionPoint[]>(() => {
    if (longTermTab !== "evolucao") return [];
    if (evolutionTab === "mensal") {
      return monthlyCycleDailyPoints;
    }

    // Helper: transforma um CycleFinancialMetrics em EvolutionPoint usando o nome do mês como label
    const cycleToPoint = (c: CycleFinancialMetrics): EvolutionPoint => {
      const SHORT_MONTHS = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const shortLabel = SHORT_MONTHS[c.cycle.month] || c.cycle.monthName.slice(0, 3);
      return {
        id: c.cycle.id,
        label: c.cycle.isCurrent ? `${shortLabel} (atual)` : shortLabel,
        fullTitle: `${c.cycle.name}${c.cycle.isCurrent ? " — em andamento" : ""} (${c.cycle.label})`,
        periodLabel: c.cycle.label,
        revenue: c.grossRevenue,
        cmv: c.cmv,
        netProfit: c.netProfit,
        orders: c.totalOrders,
        pods: c.totalPodsSold,
        isCurrent: c.cycle.isCurrent,
      };
    };

    // Anual — Apresentação oficial e cronológica de todos os 12 meses do ano financeiro (Jan → Dez)
    const currentYear = currentCycle.year || 2026;
    const SHORT_MONTHS = [
      "",
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];
    const FULL_MONTH_NAMES = [
      "",
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    // Indexar métricas de ciclos mensais disponíveis
    const cycleByMonth = new Map<number, CycleFinancialMetrics>();
    for (const m of monthlyCycles) {
      if (m.cycle.year === currentYear) {
        cycleByMonth.set(m.cycle.month, m);
      }
    }

    // Indexar pedidos válidos diretamente por mês calendário para cobrir meses sem ciclo
    const ordersByMonth = new Map<number, any[]>();
    for (const order of allValidOrders || []) {
      if (!order.created_at) continue;
      const p = getSaoPauloDateParts(order.created_at);
      if (p.year === currentYear) {
        if (!ordersByMonth.has(p.month)) {
          ordersByMonth.set(p.month, []);
        }
        ordersByMonth.get(p.month)!.push(order);
      }
    }

    const annualPoints: EvolutionPoint[] = [];

    for (let m = 1; m <= 12; m++) {
      const shortLabel = SHORT_MONTHS[m];
      const fullMonthName = FULL_MONTH_NAMES[m];
      const existing = cycleByMonth.get(m);

      let rev = 0;
      let cmvVal = 0;
      let profit = 0;
      let ordersCount = 0;
      let podsCount = 0;
      let isCurrentMonth = false;

      if (existing) {
        rev = existing.grossRevenue;
        cmvVal = existing.cmv;
        profit = existing.netProfit;
        ordersCount = existing.totalOrders;
        podsCount = existing.totalPodsSold;
        isCurrentMonth = existing.cycle.isCurrent;
      } else {
        const mOrders = ordersByMonth.get(m) || [];
        if (mOrders.length > 0) {
          for (const o of mOrders) {
            const items = Array.isArray(o.items) ? o.items : [];
            for (const it of items) {
              const qty = Number(it.quantity) || 1;
              const price = Number(it.price || it.unit_price) || 0;
              let cost = Number(it.cost_price || it.costPrice) || 0;
              if (!cost && it.product_id && persistedProductCosts[it.product_id]) {
                cost = persistedProductCosts[it.product_id];
              }
              if (!cost) cost = 65;
              rev += qty * price;
              cmvVal += qty * cost;
              podsCount += qty;
            }
            if (items.length === 0) {
              rev += Number(o.total_amount) || 0;
              cmvVal += (Number(o.total_amount) || 0) * 0.45;
              podsCount += 1;
            }
          }
          ordersCount = mOrders.length;
          profit = rev - cmvVal;
        }
        isCurrentMonth = m === currentCycle.month && currentYear === currentCycle.year;
      }

      annualPoints.push({
        id: `ano-${currentYear}-${String(m).padStart(2, "0")}`,
        label: isCurrentMonth ? `${shortLabel} (atual)` : shortLabel,
        fullTitle: `${fullMonthName} de ${currentYear}${isCurrentMonth ? " (Ciclo Vigente)" : ""}`,
        periodLabel: `Ano ${currentYear} · ${fullMonthName}`,
        revenue: Number(rev.toFixed(2)),
        cmv: Number(cmvVal.toFixed(2)),
        netProfit: Number(profit.toFixed(2)),
        orders: ordersCount,
        pods: podsCount,
        isCurrent: isCurrentMonth,
      });
    }

    return annualPoints;
  }, [
    longTermTab,
    evolutionTab,
    monthlyCycleDailyPoints,
    quarterlyPeriods,
    monthlyCycles,
    currentCycle,
    allValidOrders,
    persistedProductCosts,
  ]);

  // ─── Lógica Especializada de Comparação Mês a Mês (MoM Benchmark) ────────
  const getCycleDailyRecords = (
    cycleMetric: CycleFinancialMetrics,
    orders: any[],
    costsMap: Record<string, number>
  ) => {
    const cycleDef = cycleMetric.cycle;
    const [startD, startM, startY] = cycleDef.startDateStr.split("/").map(Number);
    const [endD, endM, endY] = cycleDef.endDateStr.split("/").map(Number);

    const startDate = new Date(startY, startM - 1, startD, 12, 0, 0);
    const endDate = new Date(endY, endM - 1, endD, 12, 0, 0);

    const nowSP = getSaoPauloDateParts(new Date());
    const todayStr = `${nowSP.year}-${String(nowSP.month).padStart(2, "0")}-${String(nowSP.day).padStart(2, "0")}`;

    const ordersByDay = new Map<string, any[]>();
    for (const order of orders || []) {
      if (!order.created_at) continue;
      const p = getSaoPauloDateParts(order.created_at);
      const key = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
      if (!ordersByDay.has(key)) ordersByDay.set(key, []);
      ordersByDay.get(key)!.push(order);
    }

    const days: {
      dayIndex: number;
      dateKey: string;
      dateFormatted: string;
      fullDate: string;
      revenue: number;
      profit: number;
      orders: number;
      pods: number;
      accumRevenue: number;
      accumProfit: number;
      accumPods: number;
      isFuture: boolean;
      isToday: boolean;
    }[] = [];

    let cur = new Date(startDate);
    let dayIdx = 1;
    let accumRev = 0;
    let accumProf = 0;
    let accumP = 0;

    while (cur <= endDate) {
      const parts = getSaoPauloDateParts(cur);
      const dateKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
      const dayOrders = ordersByDay.get(dateKey) || [];

      const isToday = dateKey === todayStr;
      const isFuture = cycleDef.isCurrent && dateKey > todayStr;

      let dayRev = 0;
      let dayCmv = 0;
      let dayPods = 0;

      if (!isFuture) {
        for (const o of dayOrders) {
          const items = Array.isArray(o.items) ? o.items : [];
          if (items.length > 0) {
            for (const item of items) {
              const qty = Number(item.quantity) || 1;
              const brand = (item.brand || "OUTROS").toUpperCase();
              const modelName = (item.name || "POD").toUpperCase();
              const itemPrice = Number(item.price || item.unit_price) || 0;
              const modelKey = (item.modelKey || `${brand}__${modelName}`).toLowerCase();

              let itemCost = Number(item.cost_price || item.costPrice) || 0;
              if (!itemCost && item.product_id && costsMap[item.product_id]) {
                itemCost = costsMap[item.product_id];
              }
              if (!itemCost && modelKey && DEFAULT_MODEL_COSTS[modelKey]) {
                itemCost = DEFAULT_MODEL_COSTS[modelKey];
              }
              if (!itemCost) itemCost = 65;

              dayRev += qty * itemPrice;
              dayCmv += qty * itemCost;
              dayPods += qty;
            }
          } else {
            dayRev += Number(o.total_amount) || 0;
            dayCmv += (Number(o.total_amount) || 0) * 0.45;
            dayPods += 1;
          }
        }
        accumRev += dayRev;
        accumProf += (dayRev - dayCmv);
        accumP += dayPods;
      }

      const dayFormatted = `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`;

      days.push({
        dayIndex: dayIdx,
        dateKey,
        dateFormatted: dayFormatted,
        fullDate: `${parts.day} de ${MONTH_NAMES[parts.month]} de ${parts.year}`,
        revenue: Number(dayRev.toFixed(2)),
        profit: Number((dayRev - dayCmv).toFixed(2)),
        orders: isFuture ? 0 : dayOrders.length,
        pods: isFuture ? 0 : dayPods,
        accumRevenue: Number(accumRev.toFixed(2)),
        accumProfit: Number(accumProf.toFixed(2)),
        accumPods: accumP,
        isFuture,
        isToday,
      });

      cur.setDate(cur.getDate() + 1);
      dayIdx++;
      if (dayIdx > 35) break;
    }

    return days;
  };

  // Ciclo Base Selecionado (Padrão: Ciclo Vigente ou o 1º da lista)
  const compBaseCycle = useMemo(() => {
    if (compBaseCycleId) {
      const found = monthlyCycles.find((m) => m.cycle.id === compBaseCycleId);
      if (found) return found;
    }
    return monthlyCycles.find((m) => m.cycle.isCurrent) || monthlyCycles[0] || null;
  }, [monthlyCycles, compBaseCycleId]);

  // Ciclo de Comparação Selecionado (Padrão: Ciclo Anterior ao Base)
  const compTargetCycle = useMemo(() => {
    if (compTargetCycleId) {
      const found = monthlyCycles.find((m) => m.cycle.id === compTargetCycleId);
      if (found) return found;
    }
    if (compBaseCycle) {
      const { year, month } = compBaseCycle.cycle;
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevId = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
      const found = monthlyCycles.find((m) => m.cycle.id === prevId);
      if (found) return found;
    }
    return monthlyCycles.find((m) => m.cycle.id !== compBaseCycle?.cycle.id) || null;
  }, [monthlyCycles, compTargetCycleId, compBaseCycle]);

  // Registros Diários Comparativos Pareados (processados apenas se aba Comparativo estiver ativa)
  const comparisonRecords = useMemo<ComparisonDayRecord[]>(() => {
    if (longTermTab !== "comparativo") return [];
    if (!compBaseCycle || !compTargetCycle) return [];

    const baseDays = getCycleDailyRecords(compBaseCycle, allValidOrders, persistedProductCosts);
    const compDays = getCycleDailyRecords(compTargetCycle, allValidOrders, persistedProductCosts);

    const totalDays = Math.max(baseDays.length, compDays.length);
    const records: ComparisonDayRecord[] = [];

    for (let i = 0; i < totalDays; i++) {
      const b = baseDays[i] || {
        dayIndex: i + 1,
        dateFormatted: "—",
        fullDate: "—",
        revenue: 0,
        profit: 0,
        orders: 0,
        pods: 0,
        accumRevenue: baseDays[baseDays.length - 1]?.accumRevenue || 0,
        isFuture: true,
        isToday: false,
      };

      const c = compDays[i] || {
        dayIndex: i + 1,
        dateFormatted: "—",
        fullDate: "—",
        revenue: 0,
        profit: 0,
        orders: 0,
        pods: 0,
        accumRevenue: compDays[compDays.length - 1]?.accumRevenue || 0,
      };

      const diffRev = b.revenue - c.revenue;
      const diffPercRev = c.revenue > 0 ? (diffRev / c.revenue) * 100 : 0;
      const diffAccum = b.accumRevenue - c.accumRevenue;
      const diffPercAccum = c.accumRevenue > 0 ? (diffAccum / c.accumRevenue) * 100 : 0;

      records.push({
        dayIndex: i + 1,
        relativeLabel: `Dia ${i + 1}`,
        baseDateFormatted: b.dateFormatted,
        baseFullDate: b.fullDate,
        baseRevenue: b.revenue,
        baseProfit: b.profit,
        baseOrders: b.orders,
        basePods: b.pods,
        baseAccumRevenue: b.accumRevenue,
        isBaseFuture: b.isFuture,
        isBaseToday: b.isToday,

        compDateFormatted: c.dateFormatted,
        compFullDate: c.fullDate,
        compRevenue: c.revenue,
        compProfit: c.profit,
        compOrders: c.orders,
        compPods: c.pods,
        compAccumRevenue: c.accumRevenue,

        diffRevenue: diffRev,
        diffPercentRevenue: diffPercRev,
        diffAccumRevenue: diffAccum,
        diffAccumPercentRevenue: diffPercAccum,
      });
    }

    return records;
  }, [longTermTab, compBaseCycle, compTargetCycle, allValidOrders, persistedProductCosts]);

  // Cálculos de Resumo Head-to-Head (processados apenas se aba Comparativo estiver ativa)
  const compMetrics = useMemo(() => {
    if (longTermTab !== "comparativo") return null;
    if (!compBaseCycle || !compTargetCycle) return null;

    const revDiff = compBaseCycle.grossRevenue - compTargetCycle.grossRevenue;
    const revDiffPerc = compTargetCycle.grossRevenue > 0 ? (revDiff / compTargetCycle.grossRevenue) * 100 : 0;

    const profitDiff = compBaseCycle.netProfit - compTargetCycle.netProfit;
    const profitDiffPerc = compTargetCycle.netProfit > 0 ? (profitDiff / compTargetCycle.netProfit) * 100 : 0;

    const podsDiff = compBaseCycle.totalPodsSold - compTargetCycle.totalPodsSold;
    const podsDiffPerc = compTargetCycle.totalPodsSold > 0 ? (podsDiff / compTargetCycle.totalPodsSold) * 100 : 0;

    const ticketDiff = compBaseCycle.averageTicket - compTargetCycle.averageTicket;
    const ticketDiffPerc = compTargetCycle.averageTicket > 0 ? (ticketDiff / compTargetCycle.averageTicket) * 100 : 0;

    const marginDiff = compBaseCycle.profitMargin - compTargetCycle.profitMargin;

    // Cálculo de Ritmo / Pacing
    const elapsedDays = comparisonRecords.filter((r) => !r.isBaseFuture).length || 1;
    const dailyPace = compBaseCycle.grossRevenue / elapsedDays;
    const projectedTotal = dailyPace * comparisonRecords.length;
    const projectedDiff = projectedTotal - compTargetCycle.grossRevenue;
    const projectedDiffPerc = compTargetCycle.grossRevenue > 0 ? (projectedDiff / compTargetCycle.grossRevenue) * 100 : 0;

    return {
      revDiff,
      revDiffPerc,
      profitDiff,
      profitDiffPerc,
      podsDiff,
      podsDiffPerc,
      ticketDiff,
      ticketDiffPerc,
      marginDiff,
      elapsedDays,
      dailyPace,
      projectedTotal,
      projectedDiff,
      projectedDiffPerc,
    };
  }, [longTermTab, compBaseCycle, compTargetCycle, comparisonRecords]);

  // Contagem de Vendas Nacionais no histórico
  const nationalOrdersCount = useMemo(() => {
    return allValidOrders.filter((o) => isOrderNational(o)).length;
  }, [allValidOrders]);

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
  
  // totalFiadoPending centralizado no Motor Unificado

  // Patrimônio Real Total da Loja = Estoque Físico Atual + Fiados a Receber (Caixa Real em R$ 0,00)
  // Regra oficial Clean Slate: Os únicos recursos da loja são Estoque e Fiados a Receber
  const totalCompanyEquity = (realCash || 0) + (stockAssetRetail || 0) + totalFiadoPending;
  const stockAssetProfit = (stockAssetRetail || 0) - (stockAssetCost || 0);

  // Métricas de Eficiência Comercial & Ticket Médio (HISTÓRICO COMPLETO)
  const averageTicket = allTimeMetrics.averageTicket;
  const averageNetProfitPerOrder = allTimeMetrics.averageNetProfitPerOrder;
  const averageNetMarginPercent = allTimeMetrics.profitMargin;
  const averagePricePerPod = allTimeMetrics.averagePricePerPod;

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
              Métricas de Vendas, Tesouraria, Campeões de Lucro por Produto e DRE Executivo.
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
    <>
      {/* ━━━ VISÃO EXCLUSIVA MOBILE (< 768px): FINANCEIRO APP NATIVO ━━━ */}
      <div className="block md:hidden h-full w-full overflow-hidden bg-[#070709] text-white">
        <MobileFinanceView
          company={company}
          loading={loading}
          currentCycle={currentCycle}
          grossRevenue={grossRevenue}
          cmv={cmv}
          companyExpenses={companyExpenses}
          logisticsFee={logisticsFee}
          netProfit={netProfit}
          profitMargin={profitMargin}
          totalOrders={totalOrders}
          totalPodsSold={totalPodsSold}
          brandSales={brandSales}
          realCash={realCash}
          totalStockPurchases={totalStockPurchases}
          totalFreightRepurchases={totalFreightRepurchases}
          stockAssetCost={stockAssetCost}
          stockAssetRetail={stockAssetRetail}
          allTimeMetrics={allTimeMetrics}
          monthlyCycles={monthlyCycles}
          quarterlyPeriods={quarterlyPeriods}
          semiannualPeriods={semiannualPeriods}
          annualPeriods={annualPeriods}
          weeklyGoalsConfig={weeklyGoalsConfig}
          weeklyPerformances={weeklyPerformances}
          monthlyTrajectory={monthlyTrajectory}
          repurchases={repurchases}
          marketingSpent={marketingSpent}
          onRefresh={() => fetchFinanceData(false)}
          onOpenNationalModal={() => setIsNationalModalOpen(true)}
          nationalOrdersCount={nationalOrdersCount}
          persistedProductCosts={persistedProductCosts}
          allValidOrders={allValidOrders}
          selectedMonthCycleId={selectedMonthCycleId}
          onSelectMonthCycleId={setSelectedMonthCycleId}
          selectedMonthlyMetric={selectedMonthlyMetric}
          monthlyEvolution={monthlyEvolution}
          selectedQuarterId={selectedQuarterId}
          onSelectQuarterId={setSelectedQuarterId}
          selectedQuarter={selectedQuarter}
          quarterlyEvolution={quarterlyEvolution}
          selectedSemesterId={selectedSemesterId}
          onSelectSemesterId={setSelectedSemesterId}
          selectedSemester={selectedSemester}
          semiannualEvolution={semiannualEvolution}
          selectedYearId={selectedYearId}
          onSelectYearId={setSelectedYearId}
          selectedYear={selectedYear}
          annualEvolution={annualEvolution}
          onOpenRepurchaseComparison={() => {
            setSelectedRepurchaseForComparison(null);
            setIsRepurchaseComparisonOpen(true);
          }}
          onOpenRegisterStock={() => setIsRegisterStockModalOpen(true)}
        />
      </div>

      {/* ━━━ VISÃO COMPLETA COMPUTADOR (>= 768px): PAINEL EXECUTIVO INTACTO ━━━ */}
      <div className="hidden md:block flex-1 h-full overflow-y-auto overflow-x-hidden bg-background p-4 sm:p-6 lg:p-8 space-y-6 text-white custom-scrollbar">
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="size-6 text-white" />
            <span>Financeiro</span>
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Visão consolidada do ciclo atual, caixa disponível e inteligência comercial.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Botão Vendas Nacionais (Fora de SP) */}
          <button
            type="button"
            onClick={() => setIsNationalModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
            title="Abrir Painel Financeiro de Vendas Nacionais (Fora de SP)"
          >
            <Globe className="size-3.5 text-amber-400" />
            <span>Envios Nacionais</span>
            {nationalOrdersCount > 0 && (
              <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {nationalOrdersCount}
              </span>
            )}
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 text-white/90 border border-white/10">
            <Calendar className="size-3.5 text-white/70" />
            <span>Ciclo atual: {currentCycle.startDateStr.slice(0, 5)} → {currentCycle.endDateStr.slice(0, 5)}</span>
          </div>
        </div>
      </header>

      {/* Aviso caso consulta de recompras tenha falhado */}
      {repurchasesError && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 flex items-center gap-3">
          <AlertCircle className="size-5 shrink-0 text-amber-400" />
          <span>Aviso: Não foi possível sincronizar o histórico de recompras ({repurchasesError.message}).</span>
        </div>
      )}

            {/* ━━━ BARRA DE NAVEGAÇÃO DOS 4 MÓDULOS FINANCEIROS INTEGRADOS SMK ━━━ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10 no-scrollbar">
        <button
          type="button"
          onClick={() => setMainTab("visao-geral")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            mainTab === "visao-geral"
              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
              : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5"
          }`}
        >
          <Sparkles className="size-4" />
          <span>Visão Geral</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab("24h")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            mainTab === "24h"
              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
              : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5"
          }`}
        >
          <Clock className="size-4" />
          <span>Últimas 24 Horas</span>
          {last24hData.ordersCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
              mainTab === "24h" ? "bg-black/25 text-black" : "bg-emerald-500/20 text-emerald-400"
            }`}>
              {last24hData.ordersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab("patrimonio")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            mainTab === "patrimonio"
              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
              : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5"
          }`}
        >
          <Boxes className="size-4" />
          <span>Patrimônio & Estoque</span>
          {unified.stock.hasIncompleteCostEvaluation && (
            <span className="size-2 rounded-full bg-amber-400" title="Produtos sem custo apurado" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab("socios")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            mainTab === "socios"
              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
              : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5"
          }`}
        >
          <Users className="size-4" />
          <span>Sócios & Pró-Labore</span>
          {!unified.capTable.isCapTableCalculable && (
            <span className="size-2 rounded-full bg-rose-400" title="Participação não calculável" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab("faturamento")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            mainTab === "faturamento"
              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
              : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5"
          }`}
        >
          <TrendingUp className="size-4" />
          <span>Faturamento & Ciclos</span>
        </button>
      </div>
      {/* ━━━ ABA 1: VISÃO GERAL (CAIXA REAL, CICLO ATUAL, ESTOQUE NA PRATELEIRA & EFICIÊNCIA COMERCIAL) ━━━ */}
      {mainTab === "visao-geral" && (
        <div className="space-y-6">
        {/* ━━━ CAIXA REAL OFICIAL (DESTAQUE NO TOPO) ━━━ */}
        <div className={`p-6 rounded-3xl border-2 space-y-3 relative overflow-hidden shadow-xl transition-all ${
          unified.cash.isNegative
            ? "bg-rose-500/10 border-rose-500/40"
            : "bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-black/80 border-emerald-500/40 shadow-emerald-950/20"
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${
              unified.cash.isNegative ? "text-rose-400" : "text-emerald-400"
            }`}>
              <Wallet className="size-5" />
              <span>Caixa Real Oficial da Empresa</span>
            </span>
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
              unified.cash.isNegative
                ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
            }`}>
              {unified.cash.isNegative ? "Déficit Real em Caixa" : "Superávit Real em Caixa"}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pt-1">
            <div className={`text-3xl sm:text-4xl font-black tracking-tight ${
              unified.cash.isNegative ? "text-rose-400" : "text-emerald-300"
            }`}>
              {formatBRL(unified.cash.realCash)}
            </div>
            <p className="text-xs text-white/50">
              Posição real de liquidez disponível em dinheiro líquido apurada por transações efetivas.
            </p>
          </div>
        </div>

{/* ━━━ BLOCO 1: CICLO ATUAL (14 → 13) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] sm:bg-transparent border border-white/15 sm:border-0 rounded-3xl p-4 sm:p-0 space-y-4 sm:space-y-3 shadow-xl sm:shadow-none">
        <div className="flex items-center justify-between border-b border-white/10 sm:border-0 pb-3 sm:pb-0">
          <span className="text-xs font-bold text-white/80 sm:text-white/60 uppercase tracking-wider">
            Ciclo Atual ({currentCycle.startDateStr.slice(0, 5)} → {currentCycle.endDateStr.slice(0, 5)})
          </span>
          <span className="text-xs font-semibold text-emerald-400 sm:text-white/40 bg-emerald-500/10 sm:bg-transparent px-2.5 py-0.5 sm:p-0 rounded-full border border-emerald-500/20 sm:border-0">
            {totalOrders} {totalOrders === 1 ? "pedido" : "pedidos"} · {totalPodsSold} produtos
          </span>
        </div>

        <div data-tour="financeiro-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* 1. Faturamento Bruto Real (Sem o Frete) */}
          <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-lg hover:border-white/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                Faturamento Bruto
              </span>
              <div className="size-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                <DollarSign className="size-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {formatBRL(grossRevenue)}
              </div>
              <p className="text-xs font-medium text-white/50 mt-1">
                Sem o frete
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

          {/* 2. Custos da Empresa (Substitui antigo Custo de Reposição CMV) */}
          <div className="bg-[#0e0e10] border border-orange-500/25 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-lg hover:border-orange-500/40 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-orange-300/90 uppercase tracking-wider">
                  Custos da Empresa
                </span>
                <div className="size-8 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-orange-400">
                  <Building2 className="size-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-orange-400">
                  {formatBRL(companyExpenses)}
                </div>
                <p className="text-xs font-medium text-white/50 mt-1">
                  Despesas operacionais do ciclo · Acumulado: {formatBRL(allTimeMetrics.companyExpenses || 0)}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] text-white/40 font-medium">
                Abatido do Caixa e Lucro
              </span>
              <button
                type="button"
                onClick={() => setIsCompanyExpenseModalOpen(true)}
                className="text-[10px] font-bold text-orange-300 hover:text-white bg-orange-500/15 hover:bg-orange-500/30 border border-orange-500/30 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3" />
                <span>Lançar Custo</span>
              </button>
            </div>
          </div>

          {/* 3. Logística & Frete */}
          <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-lg hover:border-white/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                Frete e Logística
              </span>
              <div className="size-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                <Truck className="size-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {formatBRL(logisticsFee)}
              </div>
              <p className="text-xs font-medium text-white/50 mt-1">
                Entregas locais (motoboy/Uber)
              </p>
            </div>
          </div>

          {/* 4. Lucro Líquido Real */}
          <div className="bg-[#0e0e10] border border-emerald-500/40 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl bg-gradient-to-b from-emerald-500/5 to-transparent hover:border-emerald-400 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider">
                Lucro Líquido Real
              </span>
              <div className="size-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <TrendingUp className="size-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300">
                {formatBRL(netProfit)}
              </div>
              <p className="text-xs font-bold text-emerald-400 mt-1">
                Margem de Lucro: {profitMargin}%
              </p>
            </div>
          </div>
        </div>
      </div>

{/* ━━━ BLOCO 2: PATRIMÔNIO & ESTOQUE NA PRATELEIRA (Visível apenas no Computador) ━━━━━━━━━━━━━━ */}
      <div className="hidden md:block bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl hover:border-white/25 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Landmark className="size-5 text-white" />
              <span>Patrimônio & Estoque na Prateleira</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Capital imobilizado em mercadorias no armazém e investimentos em tráfego.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4 items-stretch">
          {/* Card 1: Custo dos Pods na Prateleira */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/30 transition-all min-w-0">
            <div className="space-y-1.5 sm:space-y-2">
              <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5 truncate">
                <Box className="size-4 text-white/70 shrink-0" /> Custo Prateleira
              </span>
              <div className="text-lg sm:text-xl xl:text-2xl font-extrabold text-white truncate">
                {formatBRL(stockAssetCost)}
              </div>
            </div>
            <p className="text-xs text-white/50 truncate mt-2">
              {stockAssetUnits} unidades no armazém.
            </p>
          </div>

          {/* Card 2: Valor Potencial de Venda */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/30 transition-all min-w-0">
            <div className="space-y-1.5 sm:space-y-2">
              <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5 truncate">
                <DollarSign className="size-4 text-white/70 shrink-0" /> Venda do Estoque
              </span>
              <div className="text-lg sm:text-xl xl:text-2xl font-extrabold text-white truncate">
                {formatBRL(stockAssetRetail)}
              </div>
            </div>
            <p className="text-xs text-white/50 truncate mt-2">
              Valor bruto na venda das {stockAssetUnits} unidades.
            </p>
          </div>

          {/* Card 3: Lucro Potencial do Estoque */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/30 transition-all min-w-0">
            <div className="space-y-1.5 sm:space-y-2">
              <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1.5 truncate">
                <TrendingUp className="size-4 text-emerald-400 shrink-0" /> Lucro Potencial
              </span>
              <div className="text-lg sm:text-xl xl:text-2xl font-extrabold text-emerald-400 truncate">
                {formatBRL(stockAssetProfit)}
              </div>
            </div>
            <p className="text-xs text-white/50 truncate mt-2">
              Lucro ao liquidar o estoque.
            </p>
          </div>

          {/* Card 4: Investimento em Marketing (Editável) */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative hover:border-white/30 transition-all min-w-0">
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5 truncate">
                  <Megaphone className="size-4 text-white/70 shrink-0" /> Anúncios / Ads
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingMarketing(!isEditingMarketing)}
                  className="text-[10px] text-white/80 hover:text-white hover:underline font-bold shrink-0"
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
                    className="p-1.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors shrink-0"
                  >
                    <Check className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-lg sm:text-xl xl:text-2xl font-extrabold text-white truncate">
                  {formatBRL(numericMarketingSpent)}
                </div>
              )}
            </div>

            <p className="text-xs text-white/50 truncate mt-2">
              Total investido em tráfego pago.
            </p>
          </div>

          {/* Card 5: Patrimônio Total da Loja (Caixa Real + Estoque) */}
          <div className="bg-gradient-to-br from-white/10 to-emerald-500/10 border border-white/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/50 transition-all min-w-0">
            <div className="space-y-1.5 sm:space-y-2">
              <span className="text-[11px] text-white uppercase font-extrabold tracking-wider flex items-center gap-1.5">
                <Landmark className="size-4 text-white shrink-0" />
                <span className="leading-tight">Patrimônio Total da Loja</span>
              </span>
              <div className="text-xl sm:text-2xl xl:text-2.5xl font-black text-white tracking-tight truncate">
                {formatBRL(totalCompanyEquity)}
              </div>
            </div>
            <div className="mt-2 text-[11px] text-white/70 font-medium leading-snug">
              <span>Caixa Real ({formatBRL(realCash)})</span>
              <span className="mx-1">+</span>
              <span>Estoque ({formatBRL(stockAssetRetail)})</span>
              {totalFiadoPending > 0 && (
                <>
                  <span className="mx-1">+</span>
                  <span className="text-amber-400">Fiados ({formatBRL(totalFiadoPending)})</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

{/* ━━━ BLOCO DEDICADO: 🎯 EFICIÊNCIA COMERCIAL (HISTÓRICO COMPLETO) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-xl hover:border-white/25 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-white/10 pb-3.5 sm:pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="size-5 text-white shrink-0" />
              <span>Eficiência Comercial</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Médias acumuladas de venda e rentabilidade no histórico completo ({allTimeMetrics.totalOrders} pedidos).
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] sm:text-xs font-semibold text-white/70 bg-white/5 px-3 py-1 rounded-xl border border-white/10">
              Histórico Completo
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1: Ticket Médio */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-4 sm:p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[10px] sm:text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <ReceiptText className="size-3.5 sm:size-4 text-white/70 shrink-0" />
              <span className="truncate">Ticket Médio</span>
            </span>
            <div className="text-xl sm:text-3xl font-extrabold text-white">
              {formatBRL(averageTicket)}
            </div>
            <p className="text-[11px] sm:text-xs text-white/50">
              Valor médio por compra
            </p>
            <div className="hidden sm:block pt-2 border-t border-white/10 text-[10px] text-white/40 font-medium">
              Fat. ({formatBRL(allTimeMetrics.grossRevenue)}) ÷ {allTimeMetrics.totalOrders} ped
            </div>
          </div>

          {/* Card 2: Margem Média Líquida (%) */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-4 sm:p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[10px] sm:text-[11px] text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Percent className="size-3.5 sm:size-4 text-emerald-400 shrink-0" />
              <span className="truncate">Margem Média</span>
            </span>
            <div className="text-xl sm:text-3xl font-extrabold text-emerald-400">
              {averageNetMarginPercent.toFixed(1)}%
            </div>
            <p className="text-[11px] sm:text-xs text-white/50">
              Margem líquida média
            </p>
            <div className="hidden sm:block pt-2 border-t border-white/10 text-[10px] text-emerald-400/70 font-medium">
              Lucro Líquido ÷ Faturamento
            </div>
          </div>

          {/* Card 3: Margem por Pedido */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-4 sm:p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[10px] sm:text-[11px] text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <TrendingUp className="size-3.5 sm:size-4 text-emerald-400 shrink-0" />
              <span className="truncate">Lucro / Pedido</span>
            </span>
            <div className="text-xl sm:text-3xl font-extrabold text-emerald-300">
              {formatBRL(averageNetProfitPerOrder)}
            </div>
            <p className="text-[11px] sm:text-xs text-white/50">
              Ganho médio por pedido
            </p>
            <div className="hidden sm:block pt-2 border-t border-white/10 text-[10px] text-emerald-400/70 font-medium">
              Lucro ({formatBRL(allTimeMetrics.netProfit)}) ÷ {allTimeMetrics.totalOrders} ped
            </div>
          </div>

          {/* Card 4: Preço Médio por Unidade */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-4 sm:p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[10px] sm:text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Box className="size-3.5 sm:size-4 text-white/70 shrink-0" />
              <span className="truncate">Preço / Unidade</span>
            </span>
            <div className="text-xl sm:text-3xl font-extrabold text-white">
              {formatBRL(averagePricePerPod)}
            </div>
            <p className="text-[11px] sm:text-xs text-white/50">
              Preço médio por unidade
            </p>
            <div className="hidden sm:block pt-2 border-t border-white/10 text-[10px] text-white/40 font-medium">
              Fat. ({formatBRL(allTimeMetrics.grossRevenue)}) ÷ {allTimeMetrics.totalPodsSold} un
            </div>
          </div>
        </div>
      </div>
        </div>
      )}

      {/* ━━━ ABA: ÚLTIMAS 24 HORAS (AO VIVO) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {mainTab === "24h" && (
        <div className="space-y-6">
          {/* Header Executivo 24h */}
          <div className="p-6 bg-gradient-to-r from-emerald-500/10 via-black to-emerald-500/5 border border-emerald-500/30 rounded-3xl space-y-2 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <Clock className="size-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Histórico de Vendas em Tempo Real (Últimas 24 Horas)
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    Ao Vivo · 24h Móveis
                  </span>
                </div>
                <p className="text-xs text-white/60">
                  Visão consolidada de faturamento, margem líquida real, custo de reposição e clientes atendidos nas últimas 24 horas.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchFinanceData(false, true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Atualizar dados agora"
                >
                  <RefreshCw className="size-3.5 text-emerald-400" />
                  <span>Atualizar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Grid de 4 Cards Centrais 24h */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Faturamento 24h */}
            <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                  Faturamento (24h)
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <DollarSign className="size-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white">
                {formatBRL(last24hData.totalRevenue)}
              </div>
              <p className="text-xs text-white/40">
                Ticket Médio: <strong className="text-white/80">{formatBRL(last24hData.avgTicket)}</strong> / pedido
              </p>
            </div>

            {/* Card 2: Lucro Líquido Real 24h */}
            <div className="bg-[#0e0e10] border border-emerald-500/30 rounded-2xl p-5 space-y-2 shadow-lg bg-emerald-500/[0.03]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Lucro Líquido Real (24h)
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-400">
                {formatBRL(last24hData.netProfit)}
              </div>
              <p className="text-xs text-emerald-400/80">
                Margem Líquida Real: <strong>{last24hData.marginPct.toFixed(1)}%</strong>
              </p>
            </div>

            {/* Card 3: Custo de Reposição (CMV 24h) */}
            <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                  Custo Reposição (24h)
                </span>
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                  <Boxes className="size-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-400">
                {formatBRL(last24hData.totalCMV)}
              </div>
              <p className="text-xs text-white/40">
                Custo de aquisição dos produtos vendidos
              </p>
            </div>

            {/* Card 4: Volume & Clientes 24h */}
            <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                  Volume de Saída (24h)
                </span>
                <div className="p-1.5 rounded-lg bg-white/5 text-white/70">
                  <ShoppingBag className="size-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white">
                {last24hData.totalPods} <span className="text-xs font-semibold text-white/50">pods</span>
              </div>
              <p className="text-xs text-white/40">
                <strong className="text-white/80">{last24hData.ordersCount}</strong> pedidos · <strong className="text-white/80">{last24hData.uniqueClientsCount}</strong> clientes
              </p>
            </div>
          </div>

          {/* Tabela / Feed de Clientes e Pedidos das Últimas 24 Horas */}
          <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="size-4 text-emerald-400" />
                  <span>Últimos Clientes & Pedidos (Ordem Cronológica)</span>
                  <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-mono">
                    {filtered24hOrders.length}
                  </span>
                </h4>
                <p className="text-xs text-white/50 mt-0.5">
                  Lista detalhada de cada venda finalizada nas últimas 24 horas com lucro apurado por pedido.
                </p>
              </div>

              {/* Filtros e Busca */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="size-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search24h}
                    onChange={(e) => setSearch24h(e.target.value)}
                    placeholder="Buscar cliente, telefone ou pod..."
                    className="bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all w-48 sm:w-60"
                  />
                </div>

                <select
                  value={filterPayment24h}
                  onChange={(e) => setFilterPayment24h(e.target.value)}
                  className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                >
                  <option value="TODOS">Todos Pagamentos</option>
                  <option value="PIX">PIX</option>
                  <option value="CARTAO">Cartão</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="FIADO">Fiado / Pendente</option>
                </select>
              </div>
            </div>

            {/* Lista dos Pedidos */}
            {filtered24hOrders.length === 0 ? (
              <div className="py-12 px-4 text-center border border-white/10 rounded-2xl bg-black/40 space-y-3">
                <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
                  <Clock className="size-6" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <p className="text-sm font-semibold text-white/80">Nenhum pedido registrado nas últimas 24 horas</p>
                  <p className="text-xs text-white/40">
                    Assim que uma venda for concluída no PDV, Checkout ou cadastrada manualmente, ela aparecerá aqui instantaneamente com seu faturamento e lucro apurados.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered24hOrders.map((order: any) => {
                  const items = Array.isArray(order.items) ? order.items : [];
                  const isFiado = isOrderFiadoPending(order);
                  const isNational = isOrderNational(order);
                  const clientPhoneClean = (order.client_phone || '').replace(/\D/g, '');
                  const waLink = clientPhoneClean ? `https://wa.me/55${clientPhoneClean}` : null;

                  return (
                    <div
                      key={order.id || order.created_at}
                      className="bg-black/50 border border-white/10 hover:border-white/25 rounded-2xl p-4 transition-all space-y-3 group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                            {(order.client_name || "C").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-bold text-white tracking-tight">
                                {order.client_name || "Cliente sem nome"}
                              </h5>
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 hover:underline"
                                  title="Abrir WhatsApp do cliente"
                                >
                                  <span>{order.client_phone}</span>
                                  <ExternalLink className="size-2.5" />
                                </a>
                              )}
                            </div>
                            <p className="text-[11px] text-white/40 flex items-center gap-1.5">
                              <span>Pedido #{String(order.id || '').slice(0, 8)}</span>
                              <span>·</span>
                              <span className="text-white/60 font-medium">
                                {formatOrderClockTime(order.created_at)} ({formatRelativeTime(order.created_at)})
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {isFiado && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {(() => {
                                const info = extractFiadoInfo(order);
                                if (info.upfrontPaid > 0) {
                                  return `Fiado (Entrada: ${formatBRL(info.upfrontPaid)} / Restante: ${formatBRL(info.amountOwed)})`;
                                }
                                return `Fiado a Receber (${formatBRL(info.amountOwed)})`;
                              })()}
                            </span>
                          )}
                          {isNational && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              Envio Nacional
                            </span>
                          )}
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-white/70 border border-white/10 uppercase">
                            {order.payment_method || "PIX"}
                          </span>
                        </div>
                      </div>

                      {/* Itens e Financeiro do Pedido */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Lista de Pods */}
                        <div className="space-y-1 flex-1">
                          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                            Produtos Comprados ({order.computedPods} un):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map((item: any, idx: number) => (
                              <span
                                key={idx}
                                className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-white/80"
                              >
                                <strong className="text-emerald-400">{item.quantity || 1}x</strong> {item.name || item.brand || "Pod"} {item.flavor ? `— ${item.flavor}` : ""}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Bloco de Valores do Pedido */}
                        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-2 md:pt-0 md:pl-5 shrink-0">
                          <div>
                            <span className="text-[10px] text-white/40 uppercase block font-bold">Faturamento</span>
                            <span className="text-sm font-black text-white">{formatBRL(order.computedRevenue)}</span>
                            {order.shippingFeePassedThrough > 0 && (
                              <span className="text-[9px] text-white/40 block font-normal">
                                +{formatBRL(order.shippingFeePassedThrough)} motoboy
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-[10px] text-white/40 uppercase block font-bold">Custo (CMV)</span>
                            <span className="text-sm font-bold text-rose-400">-{formatBRL(order.computedCMV)}</span>
                          </div>

                          <div className="bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-xl text-right">
                            <span className="text-[10px] text-emerald-400/80 uppercase block font-bold">Lucro Líquido</span>
                            <span className="text-sm font-black text-emerald-400">+{formatBRL(order.computedNetProfit)}</span>
                            <span className="text-[10px] text-emerald-300 block font-mono">
                              {order.computedMarginPct.toFixed(1)}% margem
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ━━━ ABA 2: PATRIMÔNIO & ESTOQUE FÍSICO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {mainTab === "patrimonio" && (
        <div className="space-y-6">
          {/* Cabeçalho do Bloco */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="size-5 text-emerald-400" />
                <span>Patrimônio & Avaliação do Estoque</span>
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                Demonstrativo oficial dos 6 blocos patrimoniais. Separação rigorosa entre dinheiro em caixa, mercadoria imobilizada e contas a receber.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRegisterStockModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Plus className="size-3.5 stroke-[3]" />
                <span>Cadastrar Estoque / Custo</span>
              </button>
            </div>
          </div>

          {/* Banner de Alerta Crítico quando houver produtos sem custo real apurado */}
          {unified.stock.hasIncompleteCostEvaluation && (
            <div className="p-5 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl space-y-2 text-amber-200">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="size-5 text-amber-400 shrink-0" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                  Atenção: Patrimônio a Custo com Dados Pendentes
                </h4>
              </div>
              <p className="text-xs leading-relaxed text-amber-200/90">
                Existem <strong>{unified.stock.missingCostProducts.length} produtos</strong> com unidades disponíveis em estoque sem custo unitário real de aquisição cadastrado.
                Conforme a regra oficial da auditoria SMK, <strong>não utilizamos custos fixos arbitrários de R$ 65 nem estimativas silenciosas</strong>.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {unified.stock.missingCostProducts.map((p) => (
                  <span
                    key={p.id}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-xs border border-amber-500/30"
                  >
                    {p.name} ({p.stock} un sem custo)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Os 6 Cards Oficiais Exigidos no Diagnóstico e Auditoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4 items-stretch">
            {/* 1. Caixa Real */}
            <div className={`border rounded-2xl p-4 flex flex-col justify-between transition-all ${
              unified.cash.isNegative
                ? "bg-rose-500/10 border-rose-500/30"
                : "bg-black/40 border-white/15 hover:border-emerald-500/40"
            }`}>
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider block">
                  1. Caixa Real
                </span>
                <div className={`text-xl font-black ${
                  unified.cash.isNegative ? "text-rose-400" : "text-emerald-400"
                }`}>
                  {formatBRL(unified.cash.realCash)}
                </div>
              </div>
              <p className="text-[10px] text-white/50 pt-2 border-t border-white/10">
                Liquidez efetiva
              </p>
            </div>

            {/* 2. Estoque a Custo */}
            <div className="bg-black/40 border border-white/15 hover:border-white/30 rounded-2xl p-4 flex flex-col justify-between transition-all">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider block">
                  2. Estoque a Custo
                </span>
                <div className="text-xl font-black text-white">
                  {formatBRL(unified.stock.stockAssetCost)}
                </div>
              </div>
              <p className="text-[10px] text-white/50 pt-2 border-t border-white/10">
                {unified.stock.totalUnitsInStock} unidades a preço de compra
              </p>
            </div>

            {/* 3. Estoque a Preço de Venda */}
            <div className="bg-black/40 border border-white/15 hover:border-white/30 rounded-2xl p-4 flex flex-col justify-between transition-all">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider block">
                  3. Estoque a Venda
                </span>
                <div className="text-xl font-black text-white">
                  {formatBRL(unified.stock.stockAssetRetail)}
                </div>
              </div>
              <p className="text-[10px] text-white/50 pt-2 border-t border-white/10">
                Valor bruto na prateleira
              </p>
            </div>

            {/* 4. Contas a Receber (Fiados) */}
            <div className="bg-black/40 border border-white/15 hover:border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between transition-all">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider block">
                  4. Contas a Receber
                </span>
                <div className="text-xl font-black text-amber-400">
                  {formatBRL(unified.accountsReceivable)}
                </div>
              </div>
              <p className="text-[10px] text-white/50 pt-2 border-t border-white/10">
                Fiados em aberto
              </p>
            </div>

            {/* 5. Patrimônio Operacional a Custo */}
            <div className="bg-gradient-to-br from-emerald-500/10 via-black/40 to-black/60 border border-emerald-500/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-extrabold text-emerald-400 tracking-wider block">
                  5. Patrimônio a Custo
                </span>
                <div className="text-xl font-black text-emerald-300">
                  {formatBRL(unified.equity.operationalEquityAtCost)}
                </div>
              </div>
              <p className="text-[10px] text-white/50 pt-2 border-t border-white/10">
                Caixa Real + Estoque a Custo
              </p>
            </div>

            {/* 6. Potencial Comercial */}
            <div className="bg-black/40 border border-white/15 hover:border-white/30 rounded-2xl p-4 flex flex-col justify-between transition-all">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider block">
                  6. Potencial Comercial
                </span>
                <div className="text-xl font-black text-white">
                  {formatBRL(unified.equity.commercialPotential)}
                </div>
              </div>
              <p className="text-[10px] text-white/50 pt-2 border-t border-white/10">
                Margem embutida: {unified.stock.commercialPotentialMarginPct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Histórico e Métricas de Recompras de Estoque */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <PackagePlus className="size-4 text-emerald-400" />
                  <span>Histórico de Recompras e Fretes de Reposição</span>
                </h4>
                <p className="text-xs text-white/50 mt-0.5">
                  Registro de mercadorias adquiridas para reposição física do estoque.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRepurchaseForComparison(null);
                    setIsRepurchaseComparisonOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <GitCompare className="size-4 text-emerald-400" />
                  <span>Comparativo de Recompras</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenRepurchaseModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <Plus className="size-3.5 stroke-[3]" />
                  <span>Nova Recompra</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2">
                <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="size-4 text-white/70" /> Total Pago em Mercadorias
                </span>
                <div className="text-2xl font-black text-white">
                  {formatBRL(totalStockPurchases)}
                </div>
                <p className="text-xs text-white/50">
                  {repurchases.length} reposições cadastradas
                </p>
              </div>

              <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2">
                <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="size-4 text-white/70" /> Fretes Pagos aos Fornecedores
                </span>
                <div className="text-2xl font-black text-white">
                  {formatBRL(totalFreightRepurchases)}
                </div>
                <p className="text-xs text-white/50">
                  Fretes das reposições
                </p>
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

          {enrichedRepurchases.length === 0 ? (
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
                    <th className="py-3.5 px-5">Data</th>
                    <th className="py-3.5 px-5 text-right">Estoque (Produtos)</th>
                    <th className="py-3.5 px-5 text-right">Frete Reposição</th>
                    <th className="py-3.5 px-5 text-right">Total Desembolsado</th>
                    <th className="py-3.5 px-5 text-right">Lucro da Compra</th>
                    <th className="py-3.5 px-5 text-center">Nosso ROI</th>
                    <th className="py-3.5 px-5 text-right">Crescimento vs Anterior</th>
                    <th className="py-3.5 px-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {enrichedRepurchases.map((rep) => {
                    const formattedDate = rep.purchase_date
                      ? new Date(rep.purchase_date + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—";
                    return (
                      <tr key={rep.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-5 font-mono font-bold text-white/90 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-4 px-5 text-right font-extrabold text-white text-sm whitespace-nowrap">
                          {formatBRL(rep.stock_purchase_amount)}
                        </td>
                        <td className="py-4 px-5 text-right font-bold text-white/70 whitespace-nowrap">
                          {rep.freight_amount > 0 ? formatBRL(rep.freight_amount) : "R$ 0,00"}
                        </td>
                        <td className="py-4 px-5 text-right font-black text-amber-300 text-sm whitespace-nowrap">
                          {formatBRL(rep.total_repurchase_amount)}
                        </td>
                        <td className="py-4 px-5 text-right font-mono font-extrabold text-emerald-400 text-sm whitespace-nowrap">
                          +{formatBRL(rep.projectedProfit)}
                        </td>
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                            +{rep.markupPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right font-mono font-bold whitespace-nowrap">
                          {rep.profitGrowthPct != null && rep.profitGrowthDiff != null ? (
                            <span className={rep.profitGrowthDiff >= 0 ? "text-emerald-400" : "text-amber-400"}>
                              {rep.profitGrowthDiff >= 0 ? "▲ +" : "▼ "}
                              {rep.profitGrowthPct.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-white/30 text-[10px]">1ª Recompra</span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRepurchaseForComparison(rep.id);
                                setIsRepurchaseComparisonOpen(true);
                              }}
                              title="Comparar esta recompra com a anterior"
                              className="h-8 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                            >
                              <GitCompare className="size-3.5" />
                              <span>Comparar</span>
                            </button>
                            <button
                              onClick={() => setRepurchaseToDelete(rep)}
                              title="Excluir Recompra"
                              className="size-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 inline-flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
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
        </div>
      )}

      {/* ━━━ ABA 3: SÓCIOS & PRÓ-LABORE (CAP TABLE OFICIAL, SALÁRIOS & EXTRATO DE MOVIMENTAÇÕES) ━━━ */}
      {mainTab === "socios" && (
        <div className="space-y-6">
          {/* Banner da Nova Regra Oficial */}
          <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-black to-emerald-500/5 border border-emerald-500/30 rounded-2xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Scale className="size-4 text-emerald-400" />
                Nova Regra Oficial de Participação dos Sócios
              </span>
              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                Capital Líquido = Aportes − Retiradas de Capital
              </span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              A participação percentual de cada sócio é calculada estritamente pela proporção do seu <strong>Capital Líquido Individual</strong> sobre o <strong>Capital Líquido Total</strong>.
              Pró-labore, distribuição de lucro e custos da empresa <strong>NÃO alteram a participação societária</strong>.
            </p>
          </div>

          {/* Indicadores Centrais do Cap Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-2">
              <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                Capital Líquido Total
              </span>
              <div className="text-2xl font-black text-white">
                {formatBRL(unified.capTable.totalNetCapitalInvested)}
              </div>
              <p className="text-xs text-white/40">
                Aportes ({formatBRL(unified.capTable.totalGrossContributed)}) − Retiradas ({formatBRL(unified.capTable.totalWithdrawn)})
              </p>
            </div>

            <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-2">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Total de Aportes
              </span>
              <div className="text-2xl font-black text-emerald-400">
                +{formatBRL(unified.capTable.totalGrossContributed)}
              </div>
              <p className="text-xs text-white/40">
                Dinheiro ({formatBRL(unified.capTable.totalCashContributed)}) + Mercadoria ({formatBRL(unified.capTable.totalStockContributed)})
              </p>
            </div>

            <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-2">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                Total de Retiradas
              </span>
              <div className="text-2xl font-black text-rose-400">
                -{formatBRL(unified.capTable.totalWithdrawn)}
              </div>
              <p className="text-xs text-white/40">
                Devolução de capital investido
              </p>
            </div>

            <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-2">
              <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                Status do Cap Table
              </span>
              <div className="text-base font-bold text-white">
                {unified.capTable.isCapTableCalculable ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" /> 100% Consolidado
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="size-4" /> Não Calculável
                  </span>
                )}
              </div>
              <p className="text-xs text-white/40">
                {unified.capTable.partnerShares.length} sócios ativos cadastrados
              </p>
            </div>
          </div>

          {/* Barra de Ações Rápidas de Sócios */}
          <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Ações Executivas:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNewPartnerModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <UserPlus className="size-3.5 text-emerald-400" />
                <span>Novo Sócio</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewTxDefaultType('APORTE');
                  setNewTxDefaultPartnerId(undefined);
                  setNewTxDefaultAmount(undefined);
                  setIsNewTxModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="size-3.5 text-emerald-400" />
                <span>Registrar Aporte</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewTxDefaultType('RETIRADA_CAPITAL');
                  setNewTxDefaultPartnerId(undefined);
                  setNewTxDefaultAmount(undefined);
                  setIsNewTxModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Minus className="size-3.5 text-rose-400" />
                <span>Retirada de Capital</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPayrollConfigModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Percent className="size-3.5 text-emerald-400" />
                <span>Configurar % (Salários & Reinvestimento)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDilutionModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Calculator className="size-3.5 text-emerald-400" />
                <span>Simulador de Diluição</span>
              </button>
            </div>
          </div>

          {/* Banner da Base de Lucro do Ciclo & Fatia da Empresa */}
          <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Banknote className="size-5 text-emerald-400" />
                  <span>Distribuição de Pró-Labore & Reinvestimento da Loja</span>
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Divisão automática do Lucro Líquido Real apurado no ciclo ({currentCycle.startDateStr.slice(0, 5)} → {currentCycle.endDateStr.slice(0, 5)}) entre reinvestimento da empresa e pró-labore dos sócios.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Base Apurada:</span>
                <span className="text-base font-black text-emerald-400">
                  {formatBRL(unified.payroll.baseNetProfit)}
                </span>
              </div>
            </div>

            {/* Fatia da Empresa (Fundo de Reinvestimento) */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">Fatia da Empresa (Fundo de Reinvestimento)</h4>
                    <button
                      type="button"
                      onClick={() => setIsPayrollConfigModalOpen(true)}
                      className="text-xs font-black text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 px-2.5 py-0.5 rounded-full cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-1 shadow-sm"
                      title="Clique para alterar a porcentagem de reinvestimento da loja"
                    >
                      <span>{unified.payroll.reinvestmentPct}%</span>
                      <Edit3 className="size-2.5 opacity-80" />
                    </button>
                  </div>
                  <p className="text-xs text-white/50">
                    Aporte retido automaticamente do lucro líquido para giro de estoque e novas reposições.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block">Retido no Ciclo</span>
                  <span className="text-xl font-black text-emerald-400">{formatBRL(unified.payroll.reinvestmentAmount)}</span>
                </div>
                <div className="border-l border-white/10 pl-6">
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block">Saldo Acumulado</span>
                  <span className="text-xl font-black text-white">{formatBRL(unified.payroll.totalReinvestmentAccumulated)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grid de Cards Unificados dos Sócios (Equity + Pró-Labore + Ações) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {unified.capTable.partnerShares.map((share) => {
              const item = unified.payroll.partnerItems.find((p: PartnerPayrollItem) => p.partner.id === share.partner.id);
              const hasAvailable = item ? item.availableToReceive > 0 : false;
              const hasCash = (unified.cash.realCash || 0) > 0;
              const canWithdraw = hasAvailable && hasCash;
              const isNegative = item ? item.availableToReceive < 0 : false;

              return (
                <div
                  key={share.partner.id}
                  className="bg-[#0e0e10] border border-white/15 hover:border-white/25 rounded-2xl p-5 space-y-4 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header do Sócio */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-md"
                          style={{ backgroundColor: share.partner.avatar_color || '#10b981' }}
                        >
                          {share.partner.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                            {share.partner.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-white/50">
                            <span>Sócio Cotista</span>
                            {item && (
                              <>
                                <span>·</span>
                                <button
                                  type="button"
                                  onClick={() => setIsPayrollConfigModalOpen(true)}
                                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold hover:underline cursor-pointer transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/20"
                                  title="Clique para alterar a porcentagem de pró-labore deste sócio"
                                >
                                  <span>Pró-labore: {item.salaryPct}%</span>
                                  <Edit3 className="size-2.5 opacity-80" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {share.isEquityCalculable ? (
                          <span className="text-xs font-black text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 shadow-sm" title="Participação societária oficial calculada pelo capital líquido">
                            {share.equityPercentage.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-rose-400 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            <span>Não calculável</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Capital Investido Líquido */}
                    <div className="bg-black/60 p-4 rounded-xl border border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Capital Líquido Investido:</span>
                        <span className="text-white font-bold">{formatBRL(share.netCapitalInvested)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[11px]">
                        <div>
                          <span className="text-white/40 block">Aportes:</span>
                          <span className="font-semibold text-emerald-400">+{formatBRL(share.grossCapitalContributed)}</span>
                        </div>
                        <div>
                          <span className="text-white/40 block">Retiradas:</span>
                          <span className="font-semibold text-rose-400">-{formatBRL(share.capitalWithdrawn)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Fatias Patrimoniais Proporcionais */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-white/40 block">Patrimônio Proporcional</span>
                        <span className="font-bold text-white">
                          {share.isEquityCalculable ? formatBRL(share.shareOfOperationalEquity) : "—"}
                        </span>
                      </div>

                      <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-white/40 block">Fatia do Caixa Real</span>
                        <span className="font-bold text-emerald-400">
                          {share.isEquityCalculable ? formatBRL(share.shareOfRealCash) : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Os 4 Níveis Transparentes de Pró-Labore / Salário */}
                    {item && (
                      <div className="space-y-2 bg-black/60 p-3.5 rounded-xl border border-white/10 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                          <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                            <Banknote className="size-3.5 text-emerald-400" />
                            <span>Pró-Labore do Ciclo</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsPayrollConfigModalOpen(true)}
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm"
                            title="Clique para alterar a porcentagem de pró-labore"
                          >
                            <span>{item.salaryPct}% do lucro</span>
                            <Edit3 className="size-2.5 opacity-80" />
                          </button>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-white/50">1. Gerado no Ciclo:</span>
                          <span className="font-bold text-white">{formatBRL(item.grossSalaryGenerated)}</span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-white/50">2. Saldo de Ciclos Anteriores:</span>
                          <span className={`font-mono font-bold ${(item.carriedOverPendingSalary || 0) < 0 ? "text-rose-400" : "text-white/80"}`}>
                            {(item.carriedOverPendingSalary || 0) < 0 ? "-" : "+"}{formatBRL(Math.abs(item.carriedOverPendingSalary || 0))}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-white/50">3. Total Já Sacado:</span>
                          <span className="font-mono font-bold text-white/80">-{formatBRL(item.totalSalaryPaidAllTime)}</span>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-white/10">
                          <span className="text-xs font-bold text-white">4. Disponível para Receber:</span>
                          <span className={`text-sm font-black ${
                            isNegative ? "text-rose-400" : canWithdraw ? "text-emerald-400" : "text-white/50"
                          }`}>
                            {formatBRL(item.availableToReceive)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ações do Card */}
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    {item && (
                      <button
                        type="button"
                        disabled={!canWithdraw}
                        onClick={() => {
                          setNewTxDefaultType('PRO_LABORE');
                          setNewTxDefaultPartnerId(item.partner.id);
                          setNewTxDefaultAmount(item.availableToReceive > 0 ? item.availableToReceive : undefined);
                          setIsNewTxModalOpen(true);
                        }}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          canWithdraw
                            ? "bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer shadow-md active:scale-95"
                            : "bg-white/5 border border-white/10 text-white/30 cursor-not-allowed"
                        }`}
                      >
                        <Banknote className="size-3.5" />
                        <span>{canWithdraw ? "Receber / Sacar Salário" : !hasCash && hasAvailable ? "Caixa Zerado / Sem Saldo em Conta" : isNegative ? "Saldo Devedor (Bloqueado)" : "Sem Saldo para Sacar"}</span>
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewTxDefaultType('APORTE');
                          setNewTxDefaultPartnerId(share.partner.id);
                          setNewTxDefaultAmount(undefined);
                          setIsNewTxModalOpen(true);
                        }}
                        className="py-1.5 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="size-3" />
                        <span>+ Aporte</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewTxDefaultType('RETIRADA_CAPITAL');
                          setNewTxDefaultPartnerId(share.partner.id);
                          setNewTxDefaultAmount(undefined);
                          setIsNewTxModalOpen(true);
                        }}
                        className="py-1.5 px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Minus className="size-3" />
                        <span>- Retirada</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Extrato Completo de Movimentações Registradas na Base da Área de Sócios */}
          {/* Extrato Completo de Movimentações */}
          <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <History className="size-4 text-emerald-400" />
                  <span>Extrato de Movimentações Registradas</span>
                  <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-mono">
                    {filteredTransactions.length}
                  </span>
                </h4>
                <p className="text-xs text-white/50 mt-0.5">
                  Histórico unificado de movimentações financeiras com auditoria e exclusão segura.
                </p>
              </div>

              {/* Filtros do Extrato */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="size-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={txSearchQuery}
                    onChange={(e) => setTxSearchQuery(e.target.value)}
                    placeholder="Buscar sócio ou descrição..."
                    className="bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all w-44 sm:w-56"
                  />
                </div>

                <select
                  value={txFilterType}
                  onChange={(e) => setTxFilterType(e.target.value)}
                  className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                >
                  <option value="TODOS">Todas as Categorias</option>
                  <option value="APORTE">🟢 Aportes de Capital</option>
                  <option value="RETIRADA_CAPITAL">🔴 Retiradas de Capital</option>
                  <option value="PRO_LABORE">💸 Salários / Pró-labore</option>
                  <option value="DESPESA_OPERACIONAL">🏢 Custos Operacionais</option>
                  <option value="COMPRA_ESTOQUE">📦 Compras de Estoque</option>
                </select>
              </div>
            </div>

            {/* Tabela do Extrato */}
            <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/40">
              {filteredTransactions.length === 0 ? (
                <div className="p-10 text-center text-xs text-white/50 space-y-2">
                  <p>Nenhuma movimentação encontrada para os filtros selecionados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50 text-[10px] uppercase font-bold bg-white/5">
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Categoria / Tipo</th>
                        <th className="py-3 px-4">Sócio / Origem</th>
                        <th className="py-3 px-4">Descrição</th>
                        <th className="py-3 px-4 text-right">Valor (R$)</th>
                        <th className="py-3 px-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredTransactions.map((tx) => {
                        const isEntry = tx.type === 'APORTE';
                        const isRetirada = tx.type === 'RETIRADA_CAPITAL';
                        const isSalary = tx.type === 'PRO_LABORE' || tx.type === 'DISTRIBUICAO_LUCRO';
                        const isExpense = tx.type === 'DESPESA_OPERACIONAL';

                        return (
                          <tr key={tx.id} className="hover:bg-white/5 transition-all">
                            <td className="py-3 px-4 font-mono text-white/60 whitespace-nowrap">
                              {(tx.date || tx.created_at || '').slice(0, 10).split('-').reverse().join('/')}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {isEntry ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <ArrowDownRight className="size-3" />
                                  Aporte (Entrada)
                                </span>
                              ) : isRetirada ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  <TrendingDown className="size-3" />
                                  Retirada de Capital
                                </span>
                              ) : isSalary ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  <Banknote className="size-3" />
                                  Salário / Pró-labore
                                </span>
                              ) : isExpense ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                                  <Building2 className="size-3" />
                                  Custo Operacional
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md bg-white/5 text-white/70 border border-white/10">
                                  {tx.type}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-white font-medium">
                                <span className={`size-1.5 rounded-full ${
                                  isEntry ? "bg-emerald-400" : isRetirada ? "bg-rose-400" : isSalary ? "bg-emerald-300" : "bg-zinc-400"
                                }`} />
                                {tx.partner_name || "Smoking Pods"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-white/70 max-w-[240px] truncate" title={tx.description}>
                              {tx.description || "—"}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                              <span className={isEntry ? "text-emerald-400" : isRetirada ? "text-rose-400" : "text-white"}>
                                {isEntry ? "+" : "-"}{formatBRL(tx.amount)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setTxToDelete(tx)}
                                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Excluir movimentação"
                              >
                                <Trash2 className="size-3.5" />
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
        </div>
      )}

      {/* ━━━ ABA 4: FATURAMENTO & CICLOS (METAS SEMANAIS, HISTÓRICO & DRE EXECUTIVO) ━━━━━━━━━━ */}
      {mainTab === "faturamento" && (
        <div className="space-y-6">
{/* ━━━ NOVO BLOCO: 🎯 METAS SEMANAIS DO CICLO (SEMANA 1 A 4) — Visível apenas no Computador ━━━━━━━━━━━━━━ */}
      <div className="hidden md:block bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl hover:border-white/25 transition-all">
        {/* Cabeçalho da Seção de Metas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Target className="size-5 text-emerald-400" />
              <span>Metas Semanais do Ciclo</span>
              <span className="text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded-full">
                Ciclo {currentCycle.startDateStr.slice(0, 5)} → {currentCycle.endDateStr.slice(0, 5)}
              </span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Ritmo de faturamento dividido nas 4 semanas oficiais. Meta Mensal Vigente:{" "}
              <strong className="text-emerald-400 font-extrabold">{formatBRL(weeklyGoalsConfig.monthlyTarget)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsWeeklyGoalsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 cursor-pointer"
            >
              <Target className="size-4 stroke-[2.5]" />
              <span>⚙️ Ajustar Metas</span>
            </button>
          </div>
        </div>

        {/* Os 4 Cards de Metas Semanais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {weeklyPerformances.map((wp) => {
            const isCurrent = wp.status === "CURRENT";
            const isAchieved = wp.status === "ACHIEVED";
            const isBelow = wp.status === "BELOW";

            return (
              <div
                key={wp.week.weekNumber}
                className={`border rounded-2xl p-5 space-y-3 relative overflow-hidden transition-all shadow-lg ${
                  isCurrent
                    ? "bg-gradient-to-b from-emerald-500/15 via-[#0e0e10] to-[#0e0e10] border-emerald-500/50 shadow-emerald-950/30"
                    : isAchieved
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : isBelow
                    ? "bg-amber-500/5 border-amber-500/30"
                    : "bg-[#0e0e10] border-white/10 opacity-75"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-white uppercase tracking-wider block">
                      {wp.week.label}
                    </span>
                    <span className="text-[10px] text-white/50 font-medium">
                      {wp.week.dateRangeFormatted}
                    </span>
                  </div>

                  {isCurrent && (
                    <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Em Andamento
                    </span>
                  )}
                  {isAchieved && (
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="size-3" />
                      Meta Batida
                    </span>
                  )}
                  {isBelow && (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full">
                      Abaixo da Meta
                    </span>
                  )}
                  {wp.status === "FUTURE" && (
                    <span className="text-[10px] font-bold bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full">
                      Próxima
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-2xl font-black text-white">
                    {formatBRL(wp.revenue)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/50 mt-1">
                    <span>Meta: {formatBRL(wp.goal)}</span>
                    <span
                      className={`font-extrabold ${
                        isAchieved || wp.percentage >= 100
                          ? "text-emerald-400"
                          : isCurrent
                          ? "text-emerald-300"
                          : "text-white/60"
                      }`}
                    >
                      {wp.percentage}%
                    </span>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="space-y-1.5 pt-1">
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        wp.percentage >= 100
                          ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
                          : isCurrent
                          ? "bg-gradient-to-r from-emerald-500 to-amber-400"
                          : "bg-amber-400"
                      }`}
                      style={{ width: `${Math.min(100, wp.percentage)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/40 font-medium">
                    <span>
                      {wp.podsSold} {wp.podsSold === 1 ? "un vendida" : "un vendidas"}
                    </span>
                    <span>
                      {wp.ordersCount} {wp.ordersCount === 1 ? "pedido" : "pedidos"}
                    </span>
                  </div>
                </div>

                {/* Bloco de Compensação da Semana (Resultado Semanal & Saldo Acumulado) */}
                {(wp.status !== "FUTURE" || wp.revenue > 0) && (
                  <div className="pt-2 border-t border-white/5 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-white/50 text-[10px]">Resultado da semana:</span>
                      <span
                        className={`font-black text-[11px] ${
                          wp.netWeeklyResult >= 0 ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {wp.netWeeklyResult >= 0 ? "+" : ""}
                        {formatBRL(wp.netWeeklyResult)}
                      </span>
                    </div>

                    {/* Detalhe de amortização de déficit passado */}
                    {wp.surplusUsedForCompensation > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-emerald-300/80">
                        <span>Compensou déficit:</span>
                        <span className="font-bold">{formatBRL(wp.surplusUsedForCompensation)}</span>
                      </div>
                    )}

                    {/* Saldo Acumulado de Compensação até esta semana */}
                    <div className="flex items-center justify-between pt-0.5 text-[10px]">
                      <span className="text-white/40">Saldo acumulado:</span>
                      <span
                        className={`font-black ${
                          wp.cumulativeBalance >= 0 ? "text-emerald-300" : "text-amber-300"
                        }`}
                      >
                        {wp.cumulativeBalance >= 0 ? "+ " : "- "}
                        {formatBRL(Math.abs(wp.cumulativeBalance))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ─── Trajeto da Meta Mensal & Termômetro de Compensação ─── */}
        <div className="pt-4 border-t border-white/10 space-y-4">
          {/* Header do Trajeto */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-amber-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Route className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    Trajeto da Meta Mensal
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {monthlyTrajectory.progressPerc.toFixed(1)}% do mês percorrido
                  </span>
                </div>
                <p className="text-[11px] text-white/50 mt-0.5">
                  {monthlyTrajectory.isTargetAchieved ? (
                    <span className="text-emerald-400 font-bold">
                      🎉 Meta mensal batida com sucesso! Excedente acumulado:{" "}
                      <strong className="text-emerald-300 font-extrabold">{formatBRL(monthlyTrajectory.surplus)}</strong> (Realizado: {formatBRL(monthlyTrajectory.totalRealized)} de {formatBRL(monthlyTrajectory.target)}).
                    </span>
                  ) : (
                    <span>
                      Realizado: <strong className="text-white font-bold">{formatBRL(monthlyTrajectory.totalRealized)}</strong>. Saldo acumulado:{" "}
                      <strong className="text-amber-400 font-bold">
                        {monthlyTrajectory.diffFromTarget < 0 ? "- " : "+ "}
                        {formatBRL(Math.abs(monthlyTrajectory.diffFromTarget))}
                      </strong>
                      . Faltam exatamente{" "}
                      <strong className="text-emerald-300 font-extrabold">{formatBRL(monthlyTrajectory.remaining)}</strong> para a meta de{" "}
                      <strong className="text-emerald-400 font-bold">{formatBRL(monthlyTrajectory.target)}</strong>.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Pílulas de Apoio: Dias Restantes & Ritmo Necessário */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl text-xs">
                <Clock className="size-3.5 text-amber-400 shrink-0" />
                <span className="text-white/50 text-[11px]">Tempo restante:</span>
                <span className="font-extrabold text-white text-[11px]">{monthlyTrajectory.remainingDays} dias</span>
              </div>

              <div className="flex items-center gap-1.5 bg-black/40 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs">
                <Zap className="size-3.5 text-emerald-400 shrink-0" />
                <span className="text-white/50 text-[11px]">Ritmo necessário:</span>
                <span className="font-extrabold text-emerald-400 text-[11px]">
                  {formatBRL(monthlyTrajectory.dailyPaceNeeded)}/dia
                </span>
              </div>
            </div>
          </div>

          {/* A Barra de Trajeto Contínua (Roadmap com os 4 Checkpoints Semanais) */}
          <div className="space-y-3 bg-black/40 border border-white/10 p-4 rounded-2xl">
            {/* Linha dos Checkpoints com Marcadores */}
            <div className="relative pt-2 pb-1">
              {/* Trilho de Fundo */}
              <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden relative">
                {/* Preenchimento Dinâmico de Progresso */}
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-300 rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                  style={{ width: `${Math.min(100, monthlyTrajectory.progressPerc)}%` }}
                />
              </div>

              {/* Marcadores das 4 Semanas no Trilho */}
              <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between pointer-events-none px-0.5">
                {/* Checkpoint S1 (25%) */}
                <div className="relative left-[25%] -translate-x-1/2 flex flex-col items-center">
                  <div
                    className={`size-3 rounded-full border-2 ${
                      monthlyTrajectory.progressPerc >= 25
                        ? "bg-emerald-400 border-black ring-2 ring-emerald-500/50"
                        : "bg-black border-white/30"
                    }`}
                  />
                </div>
                {/* Checkpoint S2 (50%) */}
                <div className="relative left-[50%] -translate-x-1/2 flex flex-col items-center">
                  <div
                    className={`size-3 rounded-full border-2 ${
                      monthlyTrajectory.progressPerc >= 50
                        ? "bg-emerald-400 border-black ring-2 ring-emerald-500/50"
                        : "bg-black border-white/30"
                    }`}
                  />
                </div>
                {/* Checkpoint S3 (75%) */}
                <div className="relative left-[75%] -translate-x-1/2 flex flex-col items-center">
                  <div
                    className={`size-3 rounded-full border-2 ${
                      monthlyTrajectory.progressPerc >= 75
                        ? "bg-emerald-400 border-black ring-2 ring-emerald-500/50"
                        : "bg-black border-white/30"
                    }`}
                  />
                </div>
                {/* Checkpoint Final S4 (100%) */}
                <div className="relative left-[100%] -translate-x-full flex flex-col items-center">
                  <div
                    className={`size-3.5 rounded-full border-2 ${
                      monthlyTrajectory.progressPerc >= 100
                        ? "bg-emerald-300 border-black ring-2 ring-emerald-400"
                        : "bg-black border-white/40"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Labels das 4 Etapas do Trajeto com Saldo Acumulado de Cada Etapa */}
            <div className="grid grid-cols-4 text-[10px] pt-1 border-t border-white/5 text-white/50">
              {weeklyPerformances.map((wp, idx) => {
                const isFinal = idx === 3;
                return (
                  <div key={wp.week.weekNumber} className={idx === 0 ? "text-left" : isFinal ? "text-right" : "text-center"}>
                    <span className={`font-bold block ${isFinal ? "text-emerald-400" : "text-white/80"}`}>
                      {isFinal ? "Meta Final" : wp.week.label}
                    </span>
                    <span className="text-white/40 block">
                      {isFinal ? formatBRL(monthlyTrajectory.target) : formatBRL(wp.goal)}
                    </span>
                    {(wp.status !== "FUTURE" || wp.revenue > 0) && (
                      <span
                        className={`text-[9px] font-extrabold block mt-0.5 ${
                          wp.cumulativeBalance >= 0 ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        Saldo: {wp.cumulativeBalance >= 0 ? "+" : "-"}
                        {formatBRL(Math.abs(wp.cumulativeBalance))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Nota de Inteligência e Compensação Automática Explicativa */}
            <div className="pt-2 border-t border-white/5 flex items-start gap-2 text-[11px] text-white/60 leading-relaxed">
              <Sparkles className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Compensação Automática de Metas:</strong> Os excedentes de semanas que ultrapassam a meta compensam automaticamente déficits acumulados de semanas anteriores.{" "}
                {monthlyTrajectory.isTargetAchieved ? (
                  <span className="text-emerald-300 font-bold">
                    Meta mensal batida com crédito excedente acumulado de {formatBRL(monthlyTrajectory.surplus)}!
                  </span>
                ) : monthlyTrajectory.diffFromTarget < 0 ? (
                  <span>
                    Saldo acumulado atual: <strong className="text-amber-400 font-bold">-{formatBRL(Math.abs(monthlyTrajectory.diffFromTarget))}</strong> (faltam {formatBRL(monthlyTrajectory.remaining)} para bater a meta mensal de {formatBRL(monthlyTrajectory.target)}).
                  </span>
                ) : (
                  <span>
                    Crédito acumulado atual: <strong className="text-emerald-300 font-bold">+{formatBRL(monthlyTrajectory.diffFromTarget)}</strong>.
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

{/* ━━━ NOVO BLOCO: 📈 FATURAMENTO A LONGO PRAZO (2 ABAS: HISTÓRICO & EVOLUÇÃO) ━━━━━━━━━━━━━━ */}
      <div data-tour="financeiro-longo-prazo" className="bg-[#0e0e10] border border-white/15 rounded-3xl p-4 sm:p-6 space-y-5 sm:space-y-6 shadow-xl hover:border-white/25 transition-all">
        {/* Cabeçalho do Bloco: Abas Principais [ Histórico ] [ Evolução ] [ Mês a Mês ] */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="size-5 text-emerald-400 shrink-0" />
              <span>Faturamento a Longo Prazo</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Consulta de períodos anteriores e acompanhamento visual da evolução de receitas.
            </p>
          </div>

          {/* Abas Principais: Grid de 3 colunas alinhadas no celular e inline-flex no PC */}
          <div className="grid grid-cols-3 sm:inline-flex w-full sm:w-auto p-1 rounded-2xl bg-black/60 border border-white/15 gap-1">
            <button
              type="button"
              onClick={() => setLongTermTab("historico")}
              className={`px-2 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                longTermTab === "historico"
                  ? "bg-white text-black shadow-md font-extrabold"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <History className="size-3.5 sm:size-4 shrink-0" />
              <span className="truncate">Histórico</span>
            </button>
            <button
              type="button"
              onClick={() => setLongTermTab("evolucao")}
              className={`px-2 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                longTermTab === "evolucao"
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-extrabold"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <TrendingUp className="size-3.5 sm:size-4 shrink-0" />
              <span className="truncate">Evolução</span>
            </button>
            <button
              type="button"
              onClick={() => setLongTermTab("comparativo")}
              className={`px-2 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                longTermTab === "comparativo"
                  ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/25 font-extrabold"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <GitCompare className="size-3.5 sm:size-4 shrink-0" />
              <span className="sm:hidden truncate">Mês a Mês</span>
              <span className="hidden sm:inline">Comparar Mês a Mês</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ABA 1 — HISTÓRICO                                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {longTermTab === "historico" && (
          <div className="space-y-6">
            {/* Seletor de Modalidade: Mensal / Trimestral / Semestral / Anual */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto p-1 rounded-2xl bg-black/60 border border-white/15 gap-1">
                <button
                  type="button"
                  onClick={() => setHistoryTab("mensal")}
                  className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    historyTab === "mensal"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Calendar className="size-3.5 shrink-0" />
                  <span className="truncate">Mensal (14 → 13)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab("trimestral")}
                  className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    historyTab === "trimestral"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <BarChart3 className="size-3.5 shrink-0" />
                  <span className="truncate">Trimestral</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab("semestral")}
                  className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    historyTab === "semestral"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Layers className="size-3.5 shrink-0" />
                  <span className="truncate">Semestral</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab("anual")}
                  className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    historyTab === "anual"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Award className="size-3.5 shrink-0" />
                  <span className="truncate">Anual</span>
                </button>
              </div>

              <span className="text-[11px] text-white/40">
                Comparativo com período anterior: ↑ crescimento · ↓ queda · → estável
              </span>
            </div>

        {/* ─── ABA 1: VISÃO MENSAL (CICLOS 14 -> 13) ─── */}
        {historyTab === "mensal" && (
          <div className="space-y-5">
            {/* Barra de Seleção do Ciclo Mensal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-white/10 p-3.5 rounded-2xl overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto min-w-0">
                <span className="text-xs font-bold text-white/70 flex items-center gap-1.5 shrink-0">
                  <CalendarDays className="size-4 text-emerald-400 shrink-0" />
                  <span>Selecionar Ciclo Mensal:</span>
                </span>
                <select
                  value={selectedMonthCycleId}
                  onChange={(e) => setSelectedMonthCycleId(e.target.value)}
                  className="w-full sm:w-auto max-w-full min-w-0 truncate bg-black/80 border border-white/20 rounded-xl px-3 py-2 sm:py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {monthlyCycles.map((m) => (
                    <option key={m.cycle.id} value={m.cycle.id} className="bg-[#121214] text-white">
                      {m.cycle.name} ({m.cycle.label}) {m.cycle.isCurrent ? "· Vigente" : "· Encerrado"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedMonthlyMetric && (
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <span
                    className={`text-[10px] font-extrabold px-3 py-1 rounded-full border ${
                      selectedMonthlyMetric.cycle.isCurrent
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-white/5 text-white/70 border-white/10"
                    }`}
                  >
                    {selectedMonthlyMetric.cycle.isCurrent ? "🟢 Ciclo Vigente em Andamento" : "🔒 Ciclo Financeiro Encerrado"}
                  </span>
                </div>
              )}
            </div>

            {selectedMonthlyMetric ? (
              <div className="space-y-4">
                {/* 4 Cards Principais do Ciclo Selecionado */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  {/* Card 1: Faturamento */}
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      Faturamento Bruto
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-white">
                      {formatBRL(selectedMonthlyMetric.grossRevenue)}
                    </div>
                    <EvolutionBadge evolution={monthlyEvolution.grossRevenue} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      {selectedMonthlyMetric.totalOrders} ped ({selectedMonthlyMetric.totalPodsSold} un)
                    </p>
                  </div>

                  {/* Card 2: CMV */}
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      Custo Reposição (CMV)
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-red-400">
                      {formatBRL(selectedMonthlyMetric.cmv)}
                    </div>
                    <EvolutionBadge evolution={monthlyEvolution.cmv} invertColors={true} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      Custo de mercadoria
                    </p>
                  </div>

                  {/* Card 3: Frete */}
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      Frete e Logística
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-white/80">
                      {formatBRL(selectedMonthlyMetric.logisticsFee)}
                    </div>
                    <EvolutionBadge evolution={monthlyEvolution.logisticsFee} invertColors={true} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      Entregas do ciclo
                    </p>
                  </div>

                  {/* Card 4: Lucro Líquido */}
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider block truncate">
                      Lucro Líquido Real
                    </span>
                    <div className="text-lg sm:text-2xl font-black text-emerald-300">
                      {formatBRL(selectedMonthlyMetric.netProfit)}
                    </div>
                    <EvolutionBadge evolution={monthlyEvolution.netProfit} />
                    <p className="text-[10px] sm:text-[11px] font-bold text-emerald-400">
                      Margem: {selectedMonthlyMetric.profitMargin}%
                    </p>
                  </div>
                </div>

                {/* 4 Indicadores Secundários do Ciclo Selecionado (Visível no PC) */}
                <div className="hidden sm:grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/30 border border-white/10 rounded-2xl p-4 text-xs">
                  <div>
                    <span className="text-white/50 block text-[10px] uppercase font-semibold">Ticket Médio</span>
                    <span className="text-white font-extrabold text-sm">{formatBRL(selectedMonthlyMetric.averageTicket)}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[10px] uppercase font-semibold">Preço Médio / Unidade</span>
                    <span className="text-white font-extrabold text-sm">{formatBRL(selectedMonthlyMetric.averagePricePerPod)}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[10px] uppercase font-semibold">Recompras de Estoque</span>
                    <span className="text-amber-300 font-extrabold text-sm">{formatBRL(selectedMonthlyMetric.stockPurchases)}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[10px] uppercase font-semibold">Geração Líquida Caixa</span>
                    <span className="text-emerald-300 font-extrabold text-sm">{formatBRL(selectedMonthlyMetric.realCash)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/40 italic text-center py-4">Nenhum ciclo selecionado.</p>
            )}

            {/* Tabela Comparativa de Todos os Ciclos Mensais (Oculta no Mobile, Visível no Desktop) */}
            <div className="hidden md:block space-y-2.5 pt-2">
              <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                <History className="size-4 text-white/60" />
                <span>Histórico Completo de Ciclos Mensais (14 → 13)</span>
                <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                  {monthlyCycles.length} ciclos
                </span>
              </h4>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-white/60 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Ciclo Financeiro</th>
                      <th className="py-3 px-4">Período Oficial</th>
                      <th className="py-3 px-4 text-right">Faturamento</th>
                      <th className="py-3 px-4 text-right">CMV</th>
                      <th className="py-3 px-4 text-right">Lucro Líquido</th>
                      <th className="py-3 px-4 text-right">Margem</th>
                      <th className="py-3 px-4 text-center">Pedidos</th>
                      <th className="py-3 px-4 text-center">Unidades</th>
                      <th className="py-3 px-4 text-right">Recompras</th>
                      <th className="py-3 px-4 text-right">Saldo do Ciclo</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {monthlyCycles.map((m) => {
                      const isSelected = selectedMonthlyMetric?.cycle.id === m.cycle.id;
                      return (
                        <tr
                          key={m.cycle.id}
                          onClick={() => setSelectedMonthCycleId(m.cycle.id)}
                          className={`hover:bg-white/5 transition-colors cursor-pointer ${
                            isSelected ? "bg-emerald-500/10 border-l-2 border-emerald-400" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                            <span>{m.cycle.name}</span>
                            {isSelected && <span className="text-[10px] text-emerald-400 font-bold">● Ativo</span>}
                          </td>
                          <td className="py-3 px-4 font-mono text-white/70 text-[11px]">{m.cycle.label}</td>
                          <td className="py-3 px-4 text-right font-bold text-white">{formatBRL(m.grossRevenue)}</td>
                          <td className="py-3 px-4 text-right font-medium text-red-400">{formatBRL(m.cmv)}</td>
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-400">{formatBRL(m.netProfit)}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-300">{m.profitMargin}%</td>
                          <td className="py-3 px-4 text-center font-semibold text-white/80">{m.totalOrders}</td>
                          <td className="py-3 px-4 text-center font-semibold text-white/80">{m.totalPodsSold} un</td>
                          <td className="py-3 px-4 text-right font-medium text-amber-300">
                            {m.stockPurchases > 0 ? formatBRL(m.stockPurchases) : "R$ 0,00"}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-300">{formatBRL(m.realCash)}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                m.cycle.isCurrent
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : "bg-white/10 text-white/60 border-white/10"
                              }`}
                            >
                              {m.cycle.isCurrent ? "Vigente" : "Encerrado"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA 2: VISÃO TRIMESTRAL (CONSOLIDAÇÃO DE 3 CICLOS) ─── */}
        {historyTab === "trimestral" && (
          <div className="space-y-5">
            {/* Seletor de Trimestre */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-white/10 p-3.5 rounded-2xl overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto min-w-0">
                <span className="text-xs font-bold text-white/70 flex items-center gap-1.5 shrink-0">
                  <BarChart3 className="size-4 text-emerald-400 shrink-0" />
                  <span>Selecionar Trimestre (3 Ciclos Consolidados):</span>
                </span>
                <select
                  value={selectedQuarterId}
                  onChange={(e) => setSelectedQuarterId(e.target.value)}
                  className="w-full sm:w-auto max-w-full min-w-0 truncate bg-black/80 border border-white/20 rounded-xl px-3 py-2 sm:py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {quarterlyPeriods.map((q) => (
                    <option key={q.id} value={q.id} className="bg-[#121214] text-white">
                      {q.name} ({q.label})
                    </option>
                  ))}
                </select>
              </div>

              {selectedQuarter && (
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/5 text-white/80 border border-white/10 self-start sm:self-auto shrink-0">
                  {selectedQuarter.includedCycles.length} ciclos mensais consolidados
                </span>
              )}
            </div>

            {selectedQuarter ? (
              <div className="space-y-4">
                {/* 4 KPIs Consolidados do Trimestre */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      Faturamento Trimestral
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-white">
                      {formatBRL(selectedQuarter.grossRevenue)}
                    </div>
                    <EvolutionBadge evolution={quarterlyEvolution.grossRevenue} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      {selectedQuarter.totalOrders} ped ({selectedQuarter.totalPodsSold} un)
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      CMV Trimestral
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-red-400">
                      {formatBRL(selectedQuarter.cmv)}
                    </div>
                    <EvolutionBadge evolution={quarterlyEvolution.cmv} invertColors={true} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      Custo nos 3 ciclos
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      Frete Trimestral
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-white/80">
                      {formatBRL(selectedQuarter.logisticsFee)}
                    </div>
                    <EvolutionBadge evolution={quarterlyEvolution.logisticsFee} invertColors={true} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      Fretes nos 3 ciclos
                    </p>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider block truncate">
                      Lucro Líquido Trim.
                    </span>
                    <div className="text-lg sm:text-2xl font-black text-emerald-300">
                      {formatBRL(selectedQuarter.netProfit)}
                    </div>
                    <EvolutionBadge evolution={quarterlyEvolution.netProfit} />
                    <p className="text-[10px] sm:text-[11px] font-bold text-emerald-400">
                      Margem: {selectedQuarter.profitMargin}%
                    </p>
                  </div>
                </div>

                {/* Tabela dos 3 Ciclos Componentes (Oculta no Mobile, Visível no Desktop) */}
                <div className="hidden md:block space-y-2 pt-2">
                  <h5 className="text-xs font-bold text-white/70 uppercase tracking-wider">
                    Ciclos que Compõem este Trimestre
                  </h5>
                  <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 text-white/60 font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-4">Ciclo</th>
                          <th className="py-2.5 px-4">Período (14 a 13)</th>
                          <th className="py-2.5 px-4 text-right">Faturamento</th>
                          <th className="py-2.5 px-4 text-right">CMV</th>
                          <th className="py-2.5 px-4 text-right">Lucro Líquido</th>
                          <th className="py-2.5 px-4 text-right">Margem</th>
                          <th className="py-2.5 px-4 text-center">Pedidos</th>
                          <th className="py-2.5 px-4 text-right">Recompras</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-medium">
                        {selectedQuarter.includedCycles.map((c) => (
                          <tr key={c.cycle.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 font-bold text-white">{c.cycle.name}</td>
                            <td className="py-3 px-4 font-mono text-white/70 text-[11px]">{c.cycle.label}</td>
                            <td className="py-3 px-4 text-right font-bold text-white">{formatBRL(c.grossRevenue)}</td>
                            <td className="py-3 px-4 text-right font-medium text-red-400">{formatBRL(c.cmv)}</td>
                            <td className="py-3 px-4 text-right font-extrabold text-emerald-400">{formatBRL(c.netProfit)}</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-300">{c.profitMargin}%</td>
                            <td className="py-3 px-4 text-center text-white/80">{c.totalOrders}</td>
                            <td className="py-3 px-4 text-right text-amber-300">{formatBRL(c.stockPurchases)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/40 italic text-center py-4">Nenhum trimestre disponível.</p>
            )}
          </div>
        )}

        {/* ─── ABA 3: VISÃO SEMESTRAL (CONSOLIDAÇÃO DE 6 CICLOS) ─── */}
        {historyTab === "semestral" && (
          <div className="space-y-5">
            {/* Seletor de Semestre */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-white/10 p-3.5 rounded-2xl overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto min-w-0">
                <span className="text-xs font-bold text-white/70 flex items-center gap-1.5 shrink-0">
                  <Layers className="size-4 text-emerald-400 shrink-0" />
                  <span>Selecionar Semestre (6 Ciclos Consolidados):</span>
                </span>
                <select
                  value={selectedSemesterId}
                  onChange={(e) => setSelectedSemesterId(e.target.value)}
                  className="w-full sm:w-auto max-w-full min-w-0 truncate bg-black/80 border border-white/20 rounded-xl px-3 py-2 sm:py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {semiannualPeriods.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#121214] text-white">
                      {s.name} ({s.label})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSemester && (
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/5 text-white/80 border border-white/10 self-start sm:self-auto shrink-0">
                  {selectedSemester.includedCycles.length} ciclos mensais consolidados
                </span>
              )}
            </div>

            {selectedSemester ? (
              <div className="space-y-4">
                {/* 4 KPIs Consolidados do Semestre */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      Faturamento Semestral
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-white">
                      {formatBRL(selectedSemester.grossRevenue)}
                    </div>
                    <EvolutionBadge evolution={semiannualEvolution.grossRevenue} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      {selectedSemester.totalOrders} ped ({selectedSemester.totalPodsSold} un)
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      CMV Semestral
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-red-400">
                      {formatBRL(selectedSemester.cmv)}
                    </div>
                    <EvolutionBadge evolution={semiannualEvolution.cmv} invertColors={true} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      Custo nos 6 ciclos
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      Frete Semestral
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-white/80">
                      {formatBRL(selectedSemester.logisticsFee)}
                    </div>
                    <EvolutionBadge evolution={semiannualEvolution.logisticsFee} invertColors={true} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      Fretes nos 6 ciclos
                    </p>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider block truncate">
                      Lucro Líquido Sem.
                    </span>
                    <div className="text-lg sm:text-2xl font-black text-emerald-300">
                      {formatBRL(selectedSemester.netProfit)}
                    </div>
                    <EvolutionBadge evolution={semiannualEvolution.netProfit} />
                    <p className="text-[10px] sm:text-[11px] font-bold text-emerald-400">
                      Margem: {selectedSemester.profitMargin}%
                    </p>
                  </div>
                </div>

                {/* Tabela dos 6 Ciclos Componentes (Oculta no Mobile, Visível no Desktop) */}
                <div className="hidden md:block space-y-2 pt-2">
                  <h5 className="text-xs font-bold text-white/70 uppercase tracking-wider">
                    Ciclos que Compõem este Semestre
                  </h5>
                  <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 text-white/60 font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-4">Ciclo</th>
                          <th className="py-2.5 px-4">Período (14 a 13)</th>
                          <th className="py-2.5 px-4 text-right">Faturamento</th>
                          <th className="py-2.5 px-4 text-right">CMV</th>
                          <th className="py-2.5 px-4 text-right">Lucro Líquido</th>
                          <th className="py-2.5 px-4 text-right">Margem</th>
                          <th className="py-2.5 px-4 text-center">Pedidos</th>
                          <th className="py-2.5 px-4 text-right">Recompras</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-medium">
                        {selectedSemester.includedCycles.map((c) => (
                          <tr key={c.cycle.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 font-bold text-white">{c.cycle.name}</td>
                            <td className="py-3 px-4 font-mono text-white/70 text-[11px]">{c.cycle.label}</td>
                            <td className="py-3 px-4 text-right font-bold text-white">{formatBRL(c.grossRevenue)}</td>
                            <td className="py-3 px-4 text-right font-medium text-red-400">{formatBRL(c.cmv)}</td>
                            <td className="py-3 px-4 text-right font-extrabold text-emerald-400">{formatBRL(c.netProfit)}</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-300">{c.profitMargin}%</td>
                            <td className="py-3 px-4 text-center text-white/80">{c.totalOrders}</td>
                            <td className="py-3 px-4 text-right text-amber-300">{formatBRL(c.stockPurchases)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/40 italic text-center py-4">Nenhum semestre disponível.</p>
            )}
          </div>
        )}

        {/* ─── ABA 4: VISÃO ANUAL (CONSOLIDAÇÃO DE 12 CICLOS) ─── */}
        {historyTab === "anual" && (
          <div className="space-y-5">
            {/* Seletor de Ano */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-white/10 p-3.5 rounded-2xl overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto min-w-0">
                <span className="text-xs font-bold text-white/70 flex items-center gap-1.5 shrink-0">
                  <Award className="size-4 text-emerald-400 shrink-0" />
                  <span>Selecionar Ano Financeiro (12 Ciclos Consolidados):</span>
                </span>
                <select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="w-full sm:w-auto max-w-full min-w-0 truncate bg-black/80 border border-white/20 rounded-xl px-3 py-2 sm:py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {annualPeriods.map((y) => (
                    <option key={y.id} value={y.id} className="bg-[#121214] text-white">
                      {y.name} ({y.label})
                    </option>
                  ))}
                </select>
              </div>

              {selectedYear && (
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/5 text-white/80 border border-white/10 self-start sm:self-auto shrink-0">
                  {selectedYear.includedCycles.length} ciclos mensais no ano
                </span>
              )}
            </div>

            {selectedYear ? (
              <div className="space-y-4">
                {/* 4 KPIs Consolidados do Ano */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      Faturamento Anual
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-white">
                      {formatBRL(selectedYear.grossRevenue)}
                    </div>
                    <EvolutionBadge evolution={annualEvolution.grossRevenue} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      {selectedYear.totalOrders} ped ({selectedYear.totalPodsSold} un)
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      CMV Anual
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-red-400">
                      {formatBRL(selectedYear.cmv)}
                    </div>
                    <EvolutionBadge evolution={annualEvolution.cmv} invertColors={true} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      Custo no ano
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider block truncate">
                      Frete Anual
                    </span>
                    <div className="text-lg sm:text-2xl font-extrabold text-white/80">
                      {formatBRL(selectedYear.logisticsFee)}
                    </div>
                    <EvolutionBadge evolution={annualEvolution.logisticsFee} invertColors={true} />
                    <p className="text-[10px] sm:text-[11px] text-white/50">
                      Fretes no ano
                    </p>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider block truncate">
                      Lucro Líquido Anual
                    </span>
                    <div className="text-lg sm:text-2xl font-black text-emerald-300">
                      {formatBRL(selectedYear.netProfit)}
                    </div>
                    <EvolutionBadge evolution={annualEvolution.netProfit} />
                    <p className="text-[10px] sm:text-[11px] font-bold text-emerald-400">
                      Margem: {selectedYear.profitMargin}%
                    </p>
                  </div>
                </div>

                {/* Tabela de Todos os Ciclos do Ano (Oculta no Mobile, Visível no Desktop) */}
                <div className="hidden md:block space-y-2 pt-2">
                  <h5 className="text-xs font-bold text-white/70 uppercase tracking-wider">
                    Evolução Mensal do Ano Financeiro
                  </h5>
                  <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 text-white/60 font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-4">Ciclo</th>
                          <th className="py-2.5 px-4">Período (14 a 13)</th>
                          <th className="py-2.5 px-4 text-right">Faturamento</th>
                          <th className="py-2.5 px-4 text-right">CMV</th>
                          <th className="py-2.5 px-4 text-right">Lucro Líquido</th>
                          <th className="py-2.5 px-4 text-right">Margem</th>
                          <th className="py-2.5 px-4 text-center">Pedidos</th>
                          <th className="py-2.5 px-4 text-right">Recompras</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-medium">
                        {selectedYear.includedCycles.map((c) => (
                          <tr key={c.cycle.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 font-bold text-white">{c.cycle.name}</td>
                            <td className="py-3 px-4 font-mono text-white/70 text-[11px]">{c.cycle.label}</td>
                            <td className="py-3 px-4 text-right font-bold text-white">{formatBRL(c.grossRevenue)}</td>
                            <td className="py-3 px-4 text-right font-medium text-red-400">{formatBRL(c.cmv)}</td>
                            <td className="py-3 px-4 text-right font-extrabold text-emerald-400">{formatBRL(c.netProfit)}</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-300">{c.profitMargin}%</td>
                            <td className="py-3 px-4 text-center text-white/80">{c.totalOrders}</td>
                            <td className="py-3 px-4 text-right text-amber-300">{formatBRL(c.stockPurchases)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ABA 2 — EVOLUÇÃO                                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {longTermTab === "evolucao" && (
          <div className="space-y-6">
            {/* Seletor de Modalidade da Evolução: Mensal / Trimestral / Anual */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex p-1 rounded-2xl bg-black/60 border border-white/15">
                <button
                  type="button"
                  onClick={() => setEvolutionTab("mensal")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    evolutionTab === "mensal"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Calendar className="size-3.5" />
                  <span>Mensal (14 → 13)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEvolutionTab("anual")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    evolutionTab === "anual"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Award className="size-3.5" />
                  <span>Anual</span>
                </button>
              </div>

              <span className="text-[11px] text-white/40">
                Gráfico dinâmico alimentado 100% pelos dados reais do banco
              </span>
            </div>

            {/* O Gráfico como elemento principal */}
            <RevenueEvolutionChart
              data={evolutionData}
              periodType={evolutionTab}
              availableCycles={monthlyCycles}
              selectedCycleId={selectedEvolutionCycleId}
              onCycleChange={setSelectedEvolutionCycleId}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ABA 3 — COMPARAR COM MÊS ANTERIOR (MoM BENCHMARK)                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {longTermTab === "comparativo" && (
          <div className="space-y-4">
            {/* 1. Barra Superior de Seleção dos Dois Ciclos para Benchmark */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-white/10 p-3.5 rounded-2xl">
              <div className="grid grid-cols-1 sm:flex sm:items-center gap-2.5 flex-wrap w-full sm:w-auto">
                {/* Seletor Mês Base (Verde) */}
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="text-[11px] font-bold text-white/70 shrink-0">Mês Base:</span>
                  <select
                    value={compBaseCycle?.cycle.id}
                    onChange={(e) => setCompBaseCycleId(e.target.value)}
                    className="bg-black/90 border border-emerald-500/50 rounded-xl px-2.5 py-1.5 sm:py-1 text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-400 cursor-pointer flex-1 sm:flex-initial"
                  >
                    {monthlyCycles.map((m) => (
                      <option key={`base-${m.cycle.id}`} value={m.cycle.id} className="bg-[#121214] text-white">
                        {m.cycle.name} {m.cycle.isCurrent ? "(Vigente)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="hidden sm:inline text-white/30 text-xs font-mono font-bold">vs</span>

                {/* Seletor Mês Comparado (Roxo) */}
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="text-[11px] font-bold text-white/70 shrink-0">Comparar com:</span>
                  <select
                    value={compTargetCycle?.cycle.id}
                    onChange={(e) => setCompTargetCycleId(e.target.value)}
                    className="bg-black/90 border border-purple-500/50 rounded-xl px-2.5 py-1.5 sm:py-1 text-xs font-bold text-purple-300 focus:outline-none focus:border-purple-400 cursor-pointer flex-1 sm:flex-initial"
                  >
                    {monthlyCycles.map((m) => (
                      <option key={`comp-${m.cycle.id}`} value={m.cycle.id} className="bg-[#121214] text-white">
                        {m.cycle.name} {m.cycle.isCurrent ? "(Vigente)" : "(Fechado)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <span className="text-[11px] text-white/40 hidden md:inline-block">
                Comparativo normalizado dia a dia do ciclo oficial (14 → 13)
              </span>
            </div>

            {/* 2. Placar Executivo Head-to-Head (5 KPIs Compactos) */}
            {compMetrics && compBaseCycle && compTargetCycle && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-2.5">
                {/* 1. Faturamento Bruto */}
                <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-3 space-y-1.5">
                  <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
                    Faturamento Bruto
                  </span>
                  <div className="text-base sm:text-lg font-black text-white">
                    {formatBRL(compBaseCycle.grossRevenue)}
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-0.5">
                    <span className="text-white/40">Ant: {formatBRL(compTargetCycle.grossRevenue).replace(",00", "")}</span>
                    <span className={`font-extrabold flex items-center gap-0.5 ${compMetrics.revDiff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {compMetrics.revDiff >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {compMetrics.revDiff >= 0 ? "+" : ""}{compMetrics.revDiffPerc.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* 2. Lucro Líquido Real */}
                <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-3 space-y-1.5">
                  <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
                    Lucro Líquido Real
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-400">
                    {formatBRL(compBaseCycle.netProfit)}
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-0.5">
                    <span className="text-white/40">Ant: {formatBRL(compTargetCycle.netProfit).replace(",00", "")}</span>
                    <span className={`font-extrabold flex items-center gap-0.5 ${compMetrics.profitDiff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {compMetrics.profitDiff >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {compMetrics.profitDiff >= 0 ? "+" : ""}{compMetrics.profitDiffPerc.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* 3. Unidades Vendidas */}
                <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-3 space-y-1.5">
                  <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
                    Unidades Vendidas
                  </span>
                  <div className="text-base sm:text-lg font-black text-white">
                    {compBaseCycle.totalPodsSold} un
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-0.5">
                    <span className="text-white/40">Ant: {compTargetCycle.totalPodsSold}</span>
                    <span className={`font-extrabold flex items-center gap-0.5 ${compMetrics.podsDiff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {compMetrics.podsDiff >= 0 ? "+" : ""}{compMetrics.podsDiff} ({compMetrics.podsDiff >= 0 ? "+" : ""}{compMetrics.podsDiffPerc.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* 4. Ticket Médio */}
                <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-3 space-y-1.5">
                  <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
                    Ticket Médio
                  </span>
                  <div className="text-base sm:text-lg font-black text-white">
                    {formatBRL(compBaseCycle.averageTicket)}
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-0.5">
                    <span className="text-white/40">Ant: {formatBRL(compTargetCycle.averageTicket)}</span>
                    <span className={`font-extrabold flex items-center gap-0.5 ${compMetrics.ticketDiff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {compMetrics.ticketDiff >= 0 ? "+" : ""}{compMetrics.ticketDiffPerc.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* 5. Margem Líquida */}
                <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 sm:p-3 space-y-1.5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
                    Margem Líquida
                  </span>
                  <div className="text-base sm:text-lg font-black text-cyan-300">
                    {compBaseCycle.profitMargin}%
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-0.5">
                    <span className="text-white/40">Ant: {compTargetCycle.profitMargin}%</span>
                    <span className={`font-extrabold ${compMetrics.marginDiff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {compMetrics.marginDiff >= 0 ? "+" : ""}{compMetrics.marginDiff.toFixed(1)} p.p.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Pílula de Ritmo & Velocidade (Sleek Compact Bar) */}
            {compMetrics && compBaseCycle && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-transparent border border-white/10 px-3.5 py-2 rounded-xl text-xs">
                <div className="flex items-center gap-3.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Zap className="size-3.5 text-amber-400 shrink-0" />
                    <span className="text-white/60">Ritmo de Venda:</span>
                    <span className="font-extrabold text-white">{formatBRL(compMetrics.dailyPace)}/dia</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-emerald-400 shrink-0" />
                    <span className="text-white/60">Ciclo:</span>
                    <span className="font-bold text-white/90">{compMetrics.elapsedDays} de {comparisonRecords.length} dias</span>
                  </div>
                </div>
                {compBaseCycle.cycle.isCurrent && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-white/60">Projeção de Fechamento:</span>
                    <span className="font-black text-emerald-300">{formatBRL(compMetrics.projectedTotal)}</span>
                    <span className={`font-extrabold px-1.5 py-0.5 rounded text-[10px] ${compMetrics.projectedDiff >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                      {compMetrics.projectedDiff >= 0 ? "+" : ""}{compMetrics.projectedDiffPerc.toFixed(1)}% vs anterior
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 4. O Gráfico Compacto (180px de Altura - Proporcional e Leve) */}
            <MonthComparisonChart
              records={comparisonRecords}
              baseCycleName={compBaseCycle ? compBaseCycle.cycle.name : "Mês Atual"}
              compCycleName={compTargetCycle ? compTargetCycle.cycle.name : "Mês Anterior"}
              mode={compChartMode}
              onModeChange={setCompChartMode}
            />

            {/* 5. Acordeão da Tabela Detalhada Dia a Dia */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCompDailyTable(!showCompDailyTable)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 transition-colors text-xs font-bold text-white/80 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="size-3.5 text-purple-400" />
                  <span>Ver Detalhamento e Auditoria Dia a Dia ({comparisonRecords.length} dias)</span>
                </span>
                {showCompDailyTable ? <ChevronUp className="size-4 text-white/50" /> : <ChevronDown className="size-4 text-white/50" />}
              </button>

              {showCompDailyTable && (
                <div className="mt-2.5 overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-white/60 font-bold uppercase text-[10px]">
                        <th className="py-2 px-3">Dia</th>
                        <th className="py-2 px-3">Data Atual</th>
                        <th className="py-2 px-3 text-right">Venda Atual (R$)</th>
                        <th className="py-2 px-3 text-center">Unidades</th>
                        <th className="py-2 px-3">Data Anterior</th>
                        <th className="py-2 px-3 text-right">Venda Anterior (R$)</th>
                        <th className="py-2 px-3 text-center">Unidades</th>
                        <th className="py-2 px-3 text-right">Variação (R$)</th>
                        <th className="py-2 px-3 text-right">Acumulado Atual</th>
                        <th className="py-2 px-3 text-right">Acumulado Anterior</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium text-[11px]">
                      {comparisonRecords.map((r) => (
                        <tr key={`comp-row-${r.dayIndex}`} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 font-bold text-white/70">{r.dayIndex}º</td>
                          <td className="py-2 px-3 font-mono text-emerald-400 font-bold">{r.baseDateFormatted}</td>
                          <td className="py-2 px-3 text-right font-bold text-white">
                            {r.isBaseFuture ? <span className="text-white/30 italic text-[10px]">Pendente</span> : formatBRL(r.baseRevenue)}
                          </td>
                          <td className="py-2 px-3 text-center text-white/80">{r.isBaseFuture ? "—" : r.basePods}</td>
                          <td className="py-2 px-3 font-mono text-purple-300">{r.compDateFormatted}</td>
                          <td className="py-2 px-3 text-right text-white/80">{formatBRL(r.compRevenue)}</td>
                          <td className="py-2 px-3 text-center text-white/70">{r.compPods}</td>
                          <td className="py-2 px-3 text-right font-bold">
                            {r.isBaseFuture ? (
                              <span className="text-white/30">—</span>
                            ) : (
                              <span className={r.diffRevenue >= 0 ? "text-emerald-400" : "text-red-400"}>
                                {r.diffRevenue >= 0 ? "+" : ""}{formatBRL(r.diffRevenue)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-extrabold text-emerald-300">
                            {r.isBaseFuture ? "—" : formatBRL(r.baseAccumRevenue)}
                          </td>
                          <td className="py-2 px-3 text-right text-purple-300">
                            {formatBRL(r.compAccumRevenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

{/* ━━━ BLOCO 4: DEMONSTRATIVO DE RESULTADO (DRE EXECUTIVO — Visível apenas no Computador) ━━━━━━━━━━━━━━ */}
      <div className="hidden md:block bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl hover:border-white/25 transition-all">
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
                <td className="py-3.5 px-4 text-muted-foreground">Custo de aquisição pago ao fornecedor pelos produtos</td>
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
      )}


{/* ━━━ MODAL: NOVO LANÇAMENTO (APORTE / RETIRADA / PRÓ-LABORE / CUSTO) ━━━ */}
      {isNewTxModalOpen && (
        <NewTransactionModal
          isOpen={isNewTxModalOpen}
          onClose={() => setIsNewTxModalOpen(false)}
          onTransactionCreated={() => {
            fetchFinanceData(false, true);
          }}
          partners={partnersList}
          companyId={targetCompanyId}
          defaultType={newTxDefaultType}
          defaultPartnerId={newTxDefaultPartnerId}
          defaultAmount={newTxDefaultAmount}
        />
      )}

      {/* ━━━ MODAL: CADASTRAR NOVO SÓCIO ━━━ */}
      {isNewPartnerModalOpen && (
        <NewPartnerModal
          isOpen={isNewPartnerModalOpen}
          onClose={() => setIsNewPartnerModalOpen(false)}
          onPartnerCreated={() => {
            fetchFinanceData(false, true);
          }}
          companyId={targetCompanyId}
          currentTotalNetCapital={unified.capTable.totalNetCapitalInvested}
        />
      )}

      {/* ━━━ MODAL: CONFIGURAÇÃO DE SALÁRIOS & REINVESTIMENTO ━━━ */}
      {isPayrollConfigModalOpen && (
        <PayrollConfigModal
          isOpen={isPayrollConfigModalOpen}
          onClose={() => setIsPayrollConfigModalOpen(false)}
          currentConfig={payrollConfig}
          partners={partnersList}
          cycleNetProfit={unified.netProfit}
          allTimeNetProfit={unified.allTimeMetrics.netProfit}
          onSave={async (newCfg: PayrollConfig) => {
            setPayrollConfig(newCfg);
            saveLocalPayrollConfig(newCfg, targetCompanyId);
            await savePayrollConfigToSupabase(newCfg, targetCompanyId);
            await fetchFinanceData(false, true);
          }}
        />
      )}

      {/* ━━━ MODAL: SIMULADOR DE DILUIÇÃO / APORTES ━━━ */}
      {isDilutionModalOpen && (
        <DilutionSimulatorModal
          isOpen={isDilutionModalOpen}
          onClose={() => setIsDilutionModalOpen(false)}
          currentOverview={financialsOverview}
          existingPartners={partnersList}
        />
      )}

      {/* ━━━ MODAL: CONFIRMAR EXCLUSÃO DE MOVIMENTAÇÃO NO EXTRATO ━━━ */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e0e10] border border-red-500/30 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Movimentação?</h3>
                <p className="text-xs text-white/50">Esta ação irá recalcular o Caixa e o Cap Table</p>
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-white/60">Data:</span>
                <span className="text-white font-bold">{txToDelete.date || txToDelete.created_at?.slice(0, 10)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Descrição:</span>
                <span className="text-white font-bold truncate max-w-[180px]">{txToDelete.description || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Valor:</span>
                <span className="text-white font-bold">{formatBRL(txToDelete.amount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingTx}
                onClick={() => setTxToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/70 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingTx}
                onClick={handleConfirmDeleteTx}
                className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                {isDeletingTx && <Loader2 className="size-3.5 animate-spin" />}
                <span>Excluir Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal Especializado de Inteligência em Vendas Nacionais */}
      <NationalSalesModal
        isOpen={isNationalModalOpen}
        onClose={() => setIsNationalModalOpen(false)}
        orders={allValidOrders}
        persistedCosts={persistedProductCosts}
        onOpenNewSale={() => {
          setIsNationalManualSaleOpen(true);
        }}
      />

      {/* Modal de Registro de Venda Manual com Suporte a Envio Nacional */}
      <ManualSaleModal
        isOpen={isNationalManualSaleOpen}
        onClose={() => setIsNationalManualSaleOpen(false)}
        defaultIsNational={true}
        onSaleSuccess={() => {
          setIsNationalManualSaleOpen(false);
          fetchFinanceData();
        }}
      />

      {/* Modal de Configuração e Ajuste de Metas Semanais */}
      <WeeklyGoalsModal
        isOpen={isWeeklyGoalsModalOpen}
        onClose={() => setIsWeeklyGoalsModalOpen(false)}
        currentGoals={weeklyGoalsConfig}
        cycle={currentCycle}
        companyId={company?.id}
        onGoalsSaved={(newGoals) => {
          setWeeklyGoalsConfig(newGoals);
        }}
      />

      {/* Modal de Lançamento Rápido de Custo da Empresa direto pelo Financeiro */}
      {isCompanyExpenseModalOpen && (
        <NewTransactionModal
          isOpen={isCompanyExpenseModalOpen}
          onClose={() => setIsCompanyExpenseModalOpen(false)}
          onTransactionCreated={() => {
            fetchFinanceData();
          }}
          partners={partnersList}
          companyId={company?.id}
          defaultType="DESPESA_OPERACIONAL"
        />
      )}

      {/* Modal Completo: Registro & Comparativo de Recompras (Recompra a Recompra, Lucros e Crescimento) */}
      <RepurchaseComparisonModal
        isOpen={isRepurchaseComparisonOpen}
        onClose={() => setIsRepurchaseComparisonOpen(false)}
        repurchases={repurchases}
        products={financeProductsList}
        initialSelectedId={selectedRepurchaseForComparison}
        onOpenRegisterStockModal={() => {
          setIsRepurchaseComparisonOpen(false);
          setIsRegisterStockModalOpen(true);
        }}
      />

      {/* Modal Integrado de Registrar Estoque / Compra de Mercadorias (direto pelo Financeiro) */}
      <RegisterStockModal
        isOpen={isRegisterStockModalOpen}
        onClose={() => setIsRegisterStockModalOpen(false)}
        companyId={company?.id}
        products={financeProductsList}
        costsMap={persistedProductCosts}
        onSuccess={() => {
          invalidateFinanceCache();
          fetchFinanceData(false, true);
        }}
      />
      </div>
    </>
  );
}
