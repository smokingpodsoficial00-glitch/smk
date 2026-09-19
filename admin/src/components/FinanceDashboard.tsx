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
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="text-[10px] text-white/40">Ciclo:</span>
            <select
              value={selectedCycleId || availableCycles[0]?.cycle.id}
              onChange={(e) => onCycleChange(e.target.value)}
              className="bg-black/80 border border-white/15 rounded-lg px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
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
          className="w-full h-auto min-w-[480px] cursor-crosshair overflow-visible"
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

  // Estados de Ciclo Financeiro (Regra 14 -> 13 no fuso America/Sao_Paulo)
  const [currentCycle, setCurrentCycle] = useState<CycleDefinition>(getCurrentCycle());
  const [monthlyCycles, setMonthlyCycles] = useState<CycleFinancialMetrics[]>([]);
  const [partnerTransactions, setPartnerTransactions] = useState<any[]>([]);
  const [quarterlyPeriods, setQuarterlyPeriods] = useState<ConsolidatedPeriod[]>([]);
  const [semiannualPeriods, setSemiannualPeriods] = useState<ConsolidatedPeriod[]>([]);
  const [annualPeriods, setAnnualPeriods] = useState<ConsolidatedPeriod[]>([]);
  const [allValidOrders, setAllValidOrders] = useState<any[]>([]);
  const [persistedProductCosts, setPersistedProductCosts] = useState<Record<string, number>>({});

  // Seletores da Área: Faturamento a Longo Prazo (2 Abas: Histórico e Evolução)
  const [longTermTab, setLongTermTab] = useState<"historico" | "evolucao">("historico");
  const [historyTab, setHistoryTab] = useState<"mensal" | "trimestral" | "semestral" | "anual">("mensal");
  const [evolutionTab, setEvolutionTab] = useState<"mensal" | "anual">("mensal");
  const [selectedEvolutionCycleId, setSelectedEvolutionCycleId] = useState<string>("");
  const [selectedMonthCycleId, setSelectedMonthCycleId] = useState<string>("");
  const [selectedQuarterId, setSelectedQuarterId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  // Financial Metrics State (Correspondente ao Ciclo Vigente)
  const [grossRevenue, setGrossRevenue] = useState(0);
  const [cmv, setCmv] = useState(0);
  const [logisticsFee, setLogisticsFee] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [profitMargin, setProfitMargin] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPodsSold, setTotalPodsSold] = useState(0);
  const [brandSales, setBrandSales] = useState<Array<{ brand: string; count: number; revenue: number }>>([]);
  const [modelProfits, setModelProfits] = useState<ModelProfitItem[]>([]);

  // Stock Asset State (Inventário Físico na Prateleira)
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
      const [persistedCostsRes, ordersRes, productsRes, repurchasesRes, partnerTxRes] = await Promise.all([
        fetchProductCostsMap(targetCompanyId).catch(() => ({})),
        supabase
          .from("smoking_orders")
          .select("*")
          .eq("company_id", targetCompanyId)
          .neq("delivery_status", "CANCELADO"),
        supabase
          .from("smoking_products")
          .select("id, name, brand, stock, price, cost_price, flavor")
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
          .eq("company_id", targetCompanyId)
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

      // Mapear recompras oficiais da empresa
      let loadedRepurchases: StockRepurchase[] = [];
      if (Array.isArray(repurchasesRes.data)) {
        loadedRepurchases = repurchasesRes.data.map((row: any) => ({
          id: row.id,
          company_id: row.company_id || targetCompanyId,
          stock_purchase_amount: Number(row.stock_purchase_amount) || 0,
          freight_amount: Number(row.freight_amount) || 0,
          total_repurchase_amount: Number(row.total_repurchase_amount) || (Number(row.stock_purchase_amount) || 0) + (Number(row.freight_amount) || 0),
          purchase_date: row.purchase_date || new Date().toISOString().split("T")[0],
          notes: row.notes || "",
          created_at: row.created_at || new Date().toISOString(),
        }));
        setRepurchases(loadedRepurchases);
      }

      const validOrders = filterValidOrders(rawOrders);
      setAllValidOrders(validOrders);
      setPersistedProductCosts(persistedCosts);
      
      const loadedPartnerTxs = partnerTxRes?.data || [];
      setPartnerTransactions(loadedPartnerTxs);

      // 1. Estoque Físico na Prateleira
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

      // 2. Identificar e Apurar o Ciclo Atual Vigente (Regra 14 -> 13 em America/Sao_Paulo)
      const curCycle = getCurrentCycle();
      setCurrentCycle(curCycle);

      const curCycleMetrics = calculateMetricsForCycle(curCycle, validOrders, loadedRepurchases, persistedCosts);
      setGrossRevenue(curCycleMetrics.grossRevenue);
      setCmv(curCycleMetrics.cmv);
      setLogisticsFee(curCycleMetrics.logisticsFee);
      setNetProfit(curCycleMetrics.netProfit);
      setProfitMargin(curCycleMetrics.profitMargin);
      setTotalOrders(curCycleMetrics.totalOrders);
      setTotalPodsSold(curCycleMetrics.totalPodsSold);

      // 3. Vendas por Marca no Ciclo Vigente
      const brandMap: Record<string, { count: number; revenue: number }> = {};
      for (const order of curCycleMetrics.orders) {
        const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          const qty = Number(item.quantity) || 1;
          const brand = (item.brand || "OUTROS").toUpperCase();
          const itemPrice = Number(item.price || item.unit_price) || 0;
          if (!brandMap[brand]) {
            brandMap[brand] = { count: 0, revenue: 0 };
          }
          brandMap[brand].count += qty;
          brandMap[brand].revenue += qty * itemPrice;
        }
      }
      const brandList = Object.entries(brandMap).map(([brand, data]) => ({
        brand,
        count: data.count,
        revenue: data.revenue,
      }));
      setBrandSales(brandList);

      // 4. Gerar Histórico de Longo Prazo (Mensal, Trimestral, Semestral e Anual)
      const historicalMonths = generateHistoricalMonthlyCycles(validOrders, loadedRepurchases, persistedCosts);
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
        fetchFinanceData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subOrders);
      supabase.removeChannel(subProducts);
      supabase.removeChannel(subRepurchases);
    };
  }, [user, company?.id, companyUser, authLoading]);

  // ── All-Time Metrics (Histórico Completo para Eficiência Comercial & Caixa Real Atual) ──
  const allTimeMetrics = useMemo(() => {
    return calculateAllTimeMetrics(allValidOrders, repurchases, persistedProductCosts, partnerTransactions);
  }, [allValidOrders, repurchases, persistedProductCosts, partnerTransactions]);

  // CAIXA REAL ATUAL: Posição patrimonial viva da empresa (NÃO reinicia no dia 14)
  // Conforme regra fundamental: Faturamento total acumulado - total pago em recompras
  const realCash = allTimeMetrics.realCash;
  const totalStockPurchases = allTimeMetrics.stockPurchases;
  const totalFreightRepurchases = allTimeMetrics.freightRepurchases;
  const totalInvestedRepurchases = allTimeMetrics.totalInvestedRepurchases;

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

  // Dias do Ciclo Selecionado (Visão de 30 dias contínuos 14 -> 13 dia a dia)
  const monthlyCycleDailyPoints = useMemo<EvolutionPoint[]>(() => {
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
  }, [activeEvolutionCycle, allValidOrders, persistedProductCosts]);

  // Dados Reais da Aba Evolução (Curva de Faturamento ao Longo dos Períodos)
  const evolutionData = useMemo<EvolutionPoint[]>(() => {
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
    evolutionTab,
    monthlyCycleDailyPoints,
    quarterlyPeriods,
    monthlyCycles,
    currentCycle,
    allValidOrders,
    persistedProductCosts,
  ]);

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
  
  // Patrimônio Real Total da Loja = Caixa Real Calculado Atual + Valor de Venda do Estoque Físico Atual
  // Regra oficial: NÃO utiliza Faturamento Bruto Acumulado (faturamento é volume histórico, não patrimônio)
  const totalCompanyEquity = (realCash || 0) + (stockAssetRetail || 0);
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
            <Sparkles className="size-6 text-white" />
            <span>Financeiro</span>
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Visão consolidada do ciclo atual, caixa disponível e inteligência comercial.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
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

      {/* ━━━ BLOCO 1: CICLO ATUAL (14 → 13) ━━━━━━━━━━━━━━ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white/60 uppercase tracking-wider">
            Ciclo Atual ({currentCycle.startDateStr.slice(0, 5)} → {currentCycle.endDateStr.slice(0, 5)})
          </span>
          <span className="text-xs text-white/40">
            {totalOrders} {totalOrders === 1 ? "pedido" : "pedidos"} · {totalPodsSold} pods
          </span>
        </div>

        <div data-tour="financeiro-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

          {/* 2. Custo de Reposição (CMV) */}
          <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-lg hover:border-white/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                Custo de Reposição (CMV)
              </span>
              <div className="size-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <TrendingDown className="size-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-red-400">
                {formatBRL(cmv)}
              </div>
              <p className="text-xs font-medium text-white/50 mt-1">
                Custo dos pods vendidos
              </p>
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
                Fretes das entregas
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

      {/* ━━━ NOVO BLOCO: 📦 RECOMPRA DE ESTOQUE & CAIXA REAL (MÓDULO INDEPENDENTE) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl hover:border-white/25 transition-all">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <PackagePlus className="size-5 text-white" />
              <span>Recompra de Estoque & Caixa Real</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Controle de desembolsos para reposição de mercadorias, fretes de fornecedores e saldo real remanescente em caixa.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenRepurchaseModal}
              data-tour="btn-registrar-recompra"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-black font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.35)] transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="size-4 stroke-[3]" />
              <span>Registrar Recompra</span>
            </button>
          </div>
        </div>

        {/* 3 Cards de Indicadores de Recompra */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: CAIXA REAL CALCULADO (Posição Atual Viva - Não Reinicia no Dia 14) */}
          <div className="bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-black/60 border-2 border-emerald-500/50 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl shadow-emerald-950/20 hover:border-emerald-400 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="size-4 text-emerald-400" /> Caixa Real Calculado
              </span>
              <span className="text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full">
                Posição Atual
              </span>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300 tracking-tight">
                {formatBRL(realCash)}
              </div>
              <p className="text-xs font-semibold text-emerald-400/90 mt-1">
                Posição financeira atual calculada pelo sistema
              </p>
            </div>

            <div className="pt-2.5 border-t border-emerald-500/20 text-[10px] text-white/50 flex flex-col gap-1">
              <span className="text-white/70">Fat. total ({formatBRL(allTimeMetrics.grossRevenue)}) − Recompras ({formatBRL(totalStockPurchases)})</span>
              <span className="text-emerald-400/80 font-medium">⚡ Calculado pelo sistema (não é saldo bancário direto). Não reinicia no dia 14.</span>
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

          {/* Card 3: FRETES DE REPOSIÇÃO */}
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

      {/* ━━━ BLOCO DEDICADO: 🎯 EFICIÊNCIA COMERCIAL (HISTÓRICO COMPLETO) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl hover:border-white/25 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="size-5 text-white" />
              <span>Eficiência Comercial</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Médias acumuladas de venda e rentabilidade no histórico completo ({allTimeMetrics.totalOrders} pedidos).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white/70 bg-white/5 px-3 py-1 rounded-xl border border-white/10">
              Histórico Completo
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Ticket Médio */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <ReceiptText className="size-4 text-white/70" /> Ticket Médio
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {formatBRL(averageTicket)}
            </div>
            <p className="text-xs text-white/50">
              Valor médio por compra no histórico.
            </p>
            <div className="pt-2 border-t border-white/10 text-[10px] text-white/40 font-medium">
              Fat. total ({formatBRL(allTimeMetrics.grossRevenue)}) ÷ {allTimeMetrics.totalOrders} pedidos
            </div>
          </div>

          {/* Card 2: Margem Média Líquida (%) */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Percent className="size-4 text-emerald-400" /> Margem Média
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {averageNetMarginPercent.toFixed(1)}%
            </div>
            <p className="text-xs text-white/50">
              Margem líquida média da operação.
            </p>
            <div className="pt-2 border-t border-white/10 text-[10px] text-emerald-400/70 font-medium">
              Lucro Líquido total ÷ Faturamento total
            </div>
          </div>

          {/* Card 3: Margem por Pedido */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <TrendingUp className="size-4 text-emerald-400" /> Margem por Pedido
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300">
              {formatBRL(averageNetProfitPerOrder)}
            </div>
            <p className="text-xs text-white/50">
              Ganho líquido médio por pedido entregue.
            </p>
            <div className="pt-2 border-t border-white/10 text-[10px] text-emerald-400/70 font-medium">
              Lucro Líquido ({formatBRL(allTimeMetrics.netProfit)}) ÷ {allTimeMetrics.totalOrders} pedidos
            </div>
          </div>

          {/* Card 4: Preço Médio por Pod */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Box className="size-4 text-white/70" /> Preço Médio por Pod
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {formatBRL(averagePricePerPod)}
            </div>
            <p className="text-xs text-white/50">
              Preço médio por unidade vendida.
            </p>
            <div className="pt-2 border-t border-white/10 text-[10px] text-white/40 font-medium">
              Faturamento ({formatBRL(allTimeMetrics.grossRevenue)}) ÷ {allTimeMetrics.totalPodsSold} pods
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ BLOCO 2: PATRIMÔNIO & ESTOQUE NA PRATELEIRA ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl hover:border-white/25 transition-all">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Custo dos Pods na Prateleira */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <Box className="size-4 text-white/70" /> Custo Prateleira
            </span>
            <div className="text-2xl font-extrabold text-white">
              {formatBRL(stockAssetCost)}
            </div>
            <p className="text-xs text-white/50">
              {stockAssetUnits} pods no armazém.
            </p>
          </div>

          {/* Card 2: Valor Potencial de Venda */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <DollarSign className="size-4 text-white/70" /> Venda do Estoque
            </span>
            <div className="text-2xl font-extrabold text-white">
              {formatBRL(stockAssetRetail)}
            </div>
            <p className="text-xs text-white/50">
              Valor bruto na venda dos {stockAssetUnits} pods.
            </p>
          </div>

          {/* Card 3: Lucro Potencial do Estoque */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 hover:border-white/30 transition-all">
            <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider block flex items-center gap-1.5">
              <TrendingUp className="size-4 text-emerald-400" /> Lucro Potencial
            </span>
            <div className="text-2xl font-extrabold text-emerald-400">
              {formatBRL(stockAssetProfit)}
            </div>
            <p className="text-xs text-white/50">
              Lucro ao liquidar o estoque.
            </p>
          </div>

          {/* Card 4: Investimento em Marketing (Editável) */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-5 space-y-2 relative hover:border-white/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/70 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Megaphone className="size-4 text-white/70" /> Anúncios / Ads
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
              Total investido em tráfego pago.
            </p>
          </div>

          {/* Card 5: Patrimônio Total da Loja (Caixa Real + Estoque) */}
          <div className="bg-gradient-to-br from-white/10 to-emerald-500/10 border border-white/30 rounded-2xl p-5 space-y-2 hover:border-white/50 transition-all">
            <span className="text-[11px] text-white uppercase font-extrabold tracking-wider block flex items-center gap-1.5">
              <Landmark className="size-4 text-white" /> Patrimônio Total da Loja
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {formatBRL(totalCompanyEquity)}
            </div>
            <p className="text-xs text-white/70 font-medium">
              Caixa Real ({formatBRL(realCash)}) + Estoque ({formatBRL(stockAssetRetail)})
            </p>
          </div>
        </div>
      </div>

      {/* ━━━ NOVO BLOCO: 📈 FATURAMENTO A LONGO PRAZO (2 ABAS: HISTÓRICO & EVOLUÇÃO) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl hover:border-white/25 transition-all">
        {/* Cabeçalho do Bloco: Duas Abas Principais [ Histórico ] [ Evolução ] */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="size-5 text-emerald-400" />
              <span>Faturamento a Longo Prazo</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Consulta de períodos anteriores e acompanhamento visual da evolução de receitas.
            </p>
          </div>

          {/* Abas Principais: [ Histórico ] [ Evolução ] */}
          <div className="inline-flex p-1 rounded-2xl bg-black/60 border border-white/15 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setLongTermTab("historico")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                longTermTab === "historico"
                  ? "bg-white text-black shadow-md font-extrabold"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <History className="size-4" />
              <span>Histórico</span>
            </button>
            <button
              type="button"
              onClick={() => setLongTermTab("evolucao")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                longTermTab === "evolucao"
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-extrabold"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <TrendingUp className="size-4" />
              <span>Evolução</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ABA 1 — HISTÓRICO                                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {longTermTab === "historico" && (
          <div className="space-y-6">
            {/* Seletor de Modalidade: Mensal / Trimestral / Semestral / Anual */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex p-1 rounded-2xl bg-black/60 border border-white/15">
                <button
                  type="button"
                  onClick={() => setHistoryTab("mensal")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    historyTab === "mensal"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Calendar className="size-3.5" />
                  <span>Mensal (14 → 13)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab("trimestral")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    historyTab === "trimestral"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <BarChart3 className="size-3.5" />
                  <span>Trimestral</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab("semestral")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    historyTab === "semestral"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Layers className="size-3.5" />
                  <span>Semestral</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab("anual")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    historyTab === "anual"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Award className="size-3.5" />
                  <span>Anual</span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-white/10 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-bold text-white/70 flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-emerald-400" />
                  <span>Selecionar Ciclo Mensal:</span>
                </span>
                <select
                  value={selectedMonthCycleId}
                  onChange={(e) => setSelectedMonthCycleId(e.target.value)}
                  className="bg-black/80 border border-white/20 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {monthlyCycles.map((m) => (
                    <option key={m.cycle.id} value={m.cycle.id} className="bg-[#121214] text-white">
                      {m.cycle.name} ({m.cycle.label}) {m.cycle.isCurrent ? "· Vigente" : "· Encerrado"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedMonthlyMetric && (
                <div className="flex items-center gap-2">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Faturamento */}
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Faturamento Bruto Real
                    </span>
                    <div className="text-2xl font-extrabold text-white">
                      {formatBRL(selectedMonthlyMetric.grossRevenue)}
                    </div>
                    <EvolutionBadge evolution={monthlyEvolution.grossRevenue} />
                    <p className="text-[11px] text-white/50">
                      {selectedMonthlyMetric.totalOrders} pedidos ({selectedMonthlyMetric.totalPodsSold} pods)
                    </p>
                  </div>

                  {/* Card 2: CMV */}
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Custo Reposição (CMV)
                    </span>
                    <div className="text-2xl font-extrabold text-red-400">
                      {formatBRL(selectedMonthlyMetric.cmv)}
                    </div>
                    <EvolutionBadge evolution={monthlyEvolution.cmv} invertColors={true} />
                    <p className="text-[11px] text-white/50">
                      Custo de mercadoria do ciclo
                    </p>
                  </div>

                  {/* Card 3: Frete */}
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Frete Logística (Cobrado)
                    </span>
                    <div className="text-2xl font-extrabold text-white/80">
                      {formatBRL(selectedMonthlyMetric.logisticsFee)}
                    </div>
                    <EvolutionBadge evolution={monthlyEvolution.logisticsFee} invertColors={true} />
                    <p className="text-[11px] text-white/50">
                      Diluído nas entregas do ciclo
                    </p>
                  </div>

                  {/* Card 4: Lucro Líquido */}
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider block">
                      Lucro Líquido Real
                    </span>
                    <div className="text-2xl font-black text-emerald-300">
                      {formatBRL(selectedMonthlyMetric.netProfit)}
                    </div>
                    <EvolutionBadge evolution={monthlyEvolution.netProfit} />
                    <p className="text-[11px] font-bold text-emerald-400">
                      Margem Líquida: {selectedMonthlyMetric.profitMargin}%
                    </p>
                  </div>
                </div>

                {/* 4 Indicadores Secundários do Ciclo Selecionado */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/30 border border-white/10 rounded-2xl p-4 text-xs">
                  <div>
                    <span className="text-white/50 block text-[10px] uppercase font-semibold">Ticket Médio</span>
                    <span className="text-white font-extrabold text-sm">{formatBRL(selectedMonthlyMetric.averageTicket)}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block text-[10px] uppercase font-semibold">Preço Médio / Pod</span>
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

            {/* Tabela Comparativa de Todos os Ciclos Mensais */}
            <div className="space-y-2.5 pt-2">
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
                      <th className="py-3 px-4 text-center">Pods</th>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-white/10 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-bold text-white/70 flex items-center gap-1.5">
                  <BarChart3 className="size-4 text-emerald-400" />
                  <span>Selecionar Trimestre (3 Ciclos Consolidados):</span>
                </span>
                <select
                  value={selectedQuarterId}
                  onChange={(e) => setSelectedQuarterId(e.target.value)}
                  className="bg-black/80 border border-white/20 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {quarterlyPeriods.map((q) => (
                    <option key={q.id} value={q.id} className="bg-[#121214] text-white">
                      {q.name} ({q.label})
                    </option>
                  ))}
                </select>
              </div>

              {selectedQuarter && (
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/5 text-white/80 border border-white/10">
                  {selectedQuarter.includedCycles.length} ciclos mensais consolidados
                </span>
              )}
            </div>

            {selectedQuarter ? (
              <div className="space-y-4">
                {/* 4 KPIs Consolidados do Trimestre */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Faturamento Trimestral
                    </span>
                    <div className="text-2xl font-extrabold text-white">
                      {formatBRL(selectedQuarter.grossRevenue)}
                    </div>
                    <EvolutionBadge evolution={quarterlyEvolution.grossRevenue} />
                    <p className="text-[11px] text-white/50">
                      {selectedQuarter.totalOrders} pedidos ({selectedQuarter.totalPodsSold} pods)
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      CMV Trimestral
                    </span>
                    <div className="text-2xl font-extrabold text-red-400">
                      {formatBRL(selectedQuarter.cmv)}
                    </div>
                    <EvolutionBadge evolution={quarterlyEvolution.cmv} invertColors={true} />
                    <p className="text-[11px] text-white/50">
                      Custo total de reposição nos 3 ciclos
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Frete Logística Trimestral
                    </span>
                    <div className="text-2xl font-extrabold text-white/80">
                      {formatBRL(selectedQuarter.logisticsFee)}
                    </div>
                    <EvolutionBadge evolution={quarterlyEvolution.logisticsFee} invertColors={true} />
                    <p className="text-[11px] text-white/50">
                      Fretes cobrados nos 3 ciclos
                    </p>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider block">
                      Lucro Líquido Trimestral
                    </span>
                    <div className="text-2xl font-black text-emerald-300">
                      {formatBRL(selectedQuarter.netProfit)}
                    </div>
                    <EvolutionBadge evolution={quarterlyEvolution.netProfit} />
                    <p className="text-[11px] font-bold text-emerald-400">
                      Margem Média: {selectedQuarter.profitMargin}%
                    </p>
                  </div>
                </div>

                {/* Tabela dos 3 Ciclos Componentes */}
                <div className="space-y-2 pt-2">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-white/10 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-bold text-white/70 flex items-center gap-1.5">
                  <Layers className="size-4 text-emerald-400" />
                  <span>Selecionar Semestre (6 Ciclos Consolidados):</span>
                </span>
                <select
                  value={selectedSemesterId}
                  onChange={(e) => setSelectedSemesterId(e.target.value)}
                  className="bg-black/80 border border-white/20 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {semiannualPeriods.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#121214] text-white">
                      {s.name} ({s.label})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSemester && (
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/5 text-white/80 border border-white/10">
                  {selectedSemester.includedCycles.length} ciclos mensais consolidados
                </span>
              )}
            </div>

            {selectedSemester ? (
              <div className="space-y-4">
                {/* 4 KPIs Consolidados do Semestre */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Faturamento Semestral
                    </span>
                    <div className="text-2xl font-extrabold text-white">
                      {formatBRL(selectedSemester.grossRevenue)}
                    </div>
                    <EvolutionBadge evolution={semiannualEvolution.grossRevenue} />
                    <p className="text-[11px] text-white/50">
                      {selectedSemester.totalOrders} pedidos ({selectedSemester.totalPodsSold} pods)
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      CMV Semestral
                    </span>
                    <div className="text-2xl font-extrabold text-red-400">
                      {formatBRL(selectedSemester.cmv)}
                    </div>
                    <EvolutionBadge evolution={semiannualEvolution.cmv} invertColors={true} />
                    <p className="text-[11px] text-white/50">
                      Custo total de reposição nos 6 ciclos
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Frete Logística Semestral
                    </span>
                    <div className="text-2xl font-extrabold text-white/80">
                      {formatBRL(selectedSemester.logisticsFee)}
                    </div>
                    <EvolutionBadge evolution={semiannualEvolution.logisticsFee} invertColors={true} />
                    <p className="text-[11px] text-white/50">
                      Fretes cobrados nos 6 ciclos
                    </p>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider block">
                      Lucro Líquido Semestral
                    </span>
                    <div className="text-2xl font-black text-emerald-300">
                      {formatBRL(selectedSemester.netProfit)}
                    </div>
                    <EvolutionBadge evolution={semiannualEvolution.netProfit} />
                    <p className="text-[11px] font-bold text-emerald-400">
                      Margem Média: {selectedSemester.profitMargin}%
                    </p>
                  </div>
                </div>

                {/* Tabela dos 6 Ciclos Componentes */}
                <div className="space-y-2 pt-2">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-white/10 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-bold text-white/70 flex items-center gap-1.5">
                  <Award className="size-4 text-emerald-400" />
                  <span>Selecionar Ano Financeiro (12 Ciclos Consolidados):</span>
                </span>
                <select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="bg-black/80 border border-white/20 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {annualPeriods.map((y) => (
                    <option key={y.id} value={y.id} className="bg-[#121214] text-white">
                      {y.name} ({y.label})
                    </option>
                  ))}
                </select>
              </div>

              {selectedYear && (
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/5 text-white/80 border border-white/10">
                  {selectedYear.includedCycles.length} ciclos mensais no ano
                </span>
              )}
            </div>

            {selectedYear ? (
              <div className="space-y-4">
                {/* 4 KPIs Consolidados do Ano */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Faturamento Anual
                    </span>
                    <div className="text-2xl font-extrabold text-white">
                      {formatBRL(selectedYear.grossRevenue)}
                    </div>
                    <EvolutionBadge evolution={annualEvolution.grossRevenue} />
                    <p className="text-[11px] text-white/50">
                      {selectedYear.totalOrders} pedidos ({selectedYear.totalPodsSold} pods)
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      CMV Anual
                    </span>
                    <div className="text-2xl font-extrabold text-red-400">
                      {formatBRL(selectedYear.cmv)}
                    </div>
                    <EvolutionBadge evolution={annualEvolution.cmv} invertColors={true} />
                    <p className="text-[11px] text-white/50">
                      Custo total de reposição no ano
                    </p>
                  </div>

                  <div className="bg-black/40 border border-white/15 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Frete Logística Anual
                    </span>
                    <div className="text-2xl font-extrabold text-white/80">
                      {formatBRL(selectedYear.logisticsFee)}
                    </div>
                    <EvolutionBadge evolution={annualEvolution.logisticsFee} invertColors={true} />
                    <p className="text-[11px] text-white/50">
                      Fretes cobrados no ano
                    </p>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider block">
                      Lucro Líquido Anual
                    </span>
                    <div className="text-2xl font-black text-emerald-300">
                      {formatBRL(selectedYear.netProfit)}
                    </div>
                    <EvolutionBadge evolution={annualEvolution.netProfit} />
                    <p className="text-[11px] font-bold text-emerald-400">
                      Margem Média: {selectedYear.profitMargin}%
                    </p>
                  </div>
                </div>

                {/* Tabela de Todos os Ciclos do Ano */}
                <div className="space-y-2 pt-2">
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
