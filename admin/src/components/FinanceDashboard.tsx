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
function RevenueEvolutionChart({
  data,
  periodType,
}: {
  data: EvolutionPoint[];
  periodType: "mensal" | "trimestral" | "semestral" | "anual";
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-white/40 text-xs italic">
        Nenhum dado disponível para o período selecionado.
      </div>
    );
  }

  // Separação de ciclos concluídos vs ciclo em andamento
  const completedPoints = data.filter((d) => !d.isCurrent);
  const currentPoint = data.find((d) => d.isCurrent);

  // Faturamento total no recorte histórico
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  // Média por ciclo: considera apenas ciclos CONCLUÍDOS para não diluir a média
  const completedRevenue = completedPoints.reduce((sum, d) => sum + d.revenue, 0);
  const avgRevenue =
    completedPoints.length > 0
      ? completedRevenue / completedPoints.length
      : totalRevenue / (data.length || 1);

  // Pico histórico de vendas
  const maxPoint = [...data].sort((a, b) => b.revenue - a.revenue)[0];

  // Tendência recente: compara ESTRITAMENTE os dois últimos ciclos CONCLUÍDOS
  const lastCompleted =
    completedPoints.length > 0 ? completedPoints[completedPoints.length - 1] : null;
  const prevCompleted =
    completedPoints.length > 1 ? completedPoints[completedPoints.length - 2] : null;
  const trendDiff = lastCompleted && prevCompleted ? lastCompleted.revenue - prevCompleted.revenue : 0;
  const trendPct =
    lastCompleted && prevCompleted && prevCompleted.revenue > 0
      ? (trendDiff / prevCompleted.revenue) * 100
      : null;
  const trendSubtitle =
    lastCompleted && prevCompleted
      ? `${lastCompleted.label.replace(" — em andamento", "").replace(" (em andamento)", "")} vs. ${prevCompleted.label.replace(" — em andamento", "").replace(" (em andamento)", "")} (concluídos)`
      : completedPoints.length === 1
      ? "1º ciclo concluído"
      : "Em apuração";

  const width = 800;
  const height = 285;
  const padLeft = 65;
  const padRight = 45;
  const padTop = 35;
  const padBottom = 55;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const rawMax = Math.max(...data.map((d) => d.revenue), 100);
  const yMax = Math.ceil(rawMax * 1.18);

  const points = data.map((d, i) => {
    const x =
      data.length === 1
        ? padLeft + chartWidth / 2
        : padLeft + (i / (data.length - 1)) * chartWidth;
    const y = padTop + chartHeight - (d.revenue / yMax) * chartHeight;
    return { ...d, x, y, index: i };
  });

  const completedPointsWithCoords = points.filter((p) => !p.isCurrent);
  const currentPointWithCoords = points.find((p) => p.isCurrent);
  const lastCompletedPoint =
    completedPointsWithCoords.length > 0
      ? completedPointsWithCoords[completedPointsWithCoords.length - 1]
      : null;

  // Caminho da linha sólida dos ciclos concluídos
  const completedLinePath =
    completedPointsWithCoords.length === 1
      ? `M ${completedPointsWithCoords[0].x - 30} ${completedPointsWithCoords[0].y} L ${completedPointsWithCoords[0].x + 30} ${completedPointsWithCoords[0].y}`
      : completedPointsWithCoords.length > 1
      ? completedPointsWithCoords.reduce(
          (acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`,
          ""
        )
      : "";

  // Caminho da área preenchida dos ciclos concluídos
  const completedAreaPath =
    completedPointsWithCoords.length === 1
      ? `M ${completedPointsWithCoords[0].x - 30} ${padTop + chartHeight} L ${completedPointsWithCoords[0].x - 30} ${completedPointsWithCoords[0].y} L ${completedPointsWithCoords[0].x + 30} ${completedPointsWithCoords[0].y} L ${completedPointsWithCoords[0].x + 30} ${padTop + chartHeight} Z`
      : completedPointsWithCoords.length > 1
      ? `M ${completedPointsWithCoords[0].x} ${padTop + chartHeight} ${completedPointsWithCoords.reduce(
          (acc, p) => `${acc} L ${p.x} ${p.y}`,
          ""
        )} L ${completedPointsWithCoords[completedPointsWithCoords.length - 1].x} ${padTop + chartHeight} Z`
      : "";

  // Segmento em andamento (linha pontilhada do último concluído até o ciclo atual)
  const inProgressLinePath =
    lastCompletedPoint && currentPointWithCoords
      ? `M ${lastCompletedPoint.x} ${lastCompletedPoint.y} L ${currentPointWithCoords.x} ${currentPointWithCoords.y}`
      : "";

  // Área sob o segmento em andamento
  const inProgressAreaPath =
    lastCompletedPoint && currentPointWithCoords
      ? `M ${lastCompletedPoint.x} ${padTop + chartHeight} L ${lastCompletedPoint.x} ${lastCompletedPoint.y} L ${currentPointWithCoords.x} ${currentPointWithCoords.y} L ${currentPointWithCoords.x} ${padTop + chartHeight} Z`
      : "";

  // Fallback caso todos os pontos sejam abertos
  const fallbackLinePath =
    completedPointsWithCoords.length === 0
      ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "")
      : "";

  const gridLevels = [0, 0.33, 0.66, 1];
  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="space-y-4">
      {/* Barra Resumo / KPIs de Evolução */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs">
        <div>
          <span className="text-white/40 block text-[10px] uppercase font-semibold">Faturamento no Recorte</span>
          <span className="text-white font-extrabold text-sm sm:text-base">{formatBRL(totalRevenue)}</span>
        </div>
        <div>
          <span className="text-white/40 block text-[10px] uppercase font-semibold">Pico de Vendas</span>
          <span className="text-emerald-400 font-extrabold text-sm sm:text-base">
            {maxPoint ? `${formatBRL(maxPoint.revenue)}` : "—"}
          </span>
          {maxPoint && maxPoint.revenue > 0 && (
            <span className="text-[10px] text-white/40 block truncate">
              {maxPoint.label.replace(" — em andamento", "").replace(" (em andamento)", "")}
            </span>
          )}
        </div>
        <div>
          <span className="text-white/40 block text-[10px] uppercase font-semibold">Média por Ciclo</span>
          <span className="text-white/90 font-extrabold text-sm sm:text-base">{formatBRL(avgRevenue)}</span>
          <span className="text-[10px] text-white/40 block truncate">
            {completedPoints.length > 0
              ? `${completedPoints.length} ${completedPoints.length === 1 ? "ciclo concluído" : "ciclos concluídos"}`
              : "Ciclo vigente"}
          </span>
        </div>
        <div>
          <span className="text-white/40 block text-[10px] uppercase font-semibold">Tendência Recente</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {trendDiff > 0 ? (
              <span className="text-emerald-400 font-extrabold text-sm sm:text-base flex items-center gap-0.5">
                <span>↑</span>
                <span>{trendPct !== null ? `+${trendPct.toFixed(1)}%` : "Crescimento"}</span>
              </span>
            ) : trendDiff < 0 ? (
              <span className="text-red-400 font-extrabold text-sm sm:text-base flex items-center gap-0.5">
                <span>↓</span>
                <span>{trendPct !== null ? `${trendPct.toFixed(1)}%` : "Queda"}</span>
              </span>
            ) : (
              <span className="text-white/60 font-extrabold text-sm sm:text-base flex items-center gap-0.5">
                <span>→</span>
                <span>Estável (0%)</span>
              </span>
            )}
          </div>
          {trendSubtitle && (
            <span className="text-[10px] text-white/40 block truncate">
              {trendSubtitle}
            </span>
          )}
        </div>
      </div>

      {/* Gráfico SVG Principal */}
      <div className="bg-black/60 border border-white/15 rounded-3xl p-4 sm:p-6 space-y-3 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Curva de Evolução do Faturamento
            </span>
            <span className="text-[10px] text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
              {periodType === "mensal"
                ? "Ciclos 14 → 13"
                : periodType === "trimestral"
                ? "Blocos de 3 ciclos"
                : periodType === "semestral"
                ? "Blocos de 6 ciclos"
                : "Anual"}
            </span>
          </div>
          <span className="text-[11px] text-white/40 hidden sm:inline-block">
            Passe o mouse ou toque nos pontos para ver os detalhes
          </span>
        </div>

        {/* ViewBox SVG Responsivo */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[550px] select-none"
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="80%" stopColor="#10b981" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="currentSegmentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
              </linearGradient>
              <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Linhas de Grade Horizontais */}
            {gridLevels.map((lvl) => {
              const yVal = padTop + chartHeight - lvl * chartHeight;
              const val = lvl * yMax;
              return (
                <g key={lvl}>
                  <line
                    x1={padLeft}
                    y1={yVal}
                    x2={width - padRight}
                    y2={yVal}
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padLeft - 8}
                    y={yVal + 3}
                    textAnchor="end"
                    fill="rgba(255, 255, 255, 0.4)"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {formatBRL(val).replace(",00", "")}
                  </text>
                </g>
              );
            })}

            {/* Área Preenchida dos Ciclos Concluídos */}
            {completedAreaPath && <path d={completedAreaPath} fill="url(#revenueGradient)" />}

            {/* Área Suave do Ciclo em Andamento */}
            {inProgressAreaPath && <path d={inProgressAreaPath} fill="url(#currentSegmentGradient)" />}

            {/* Linha Principal Sólida dos Ciclos Concluídos */}
            {completedLinePath && (
              <path
                d={completedLinePath}
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#emeraldGlow)"
              />
            )}

            {/* Linha Pontilhada do Segmento em Andamento */}
            {inProgressLinePath && (
              <path
                d={inProgressLinePath}
                fill="none"
                stroke="#34d399"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
            )}

            {/* Fallback caso não haja ciclos concluídos */}
            {fallbackLinePath && (
              <path
                d={fallbackLinePath}
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeDasharray="4 4"
              />
            )}

            {/* Indicadores nos Segmentos:
                - Entre ciclos concluídos: setas normais (↗ / ↘ / →)
                - Ligação para ciclo em andamento: pill neutro 'em andamento' (sem seta falsa de queda) */}
            {points.map((p, i) => {
              if (i === 0) return null;
              const prev = points[i - 1];
              const midX = (prev.x + p.x) / 2;
              const midY = (prev.y + p.y) / 2;

              // Transição para ciclo em andamento
              if (p.isCurrent) {
                return (
                  <g key={`inprogress-pill-${i}`}>
                    <rect
                      x={midX - 44}
                      y={midY - 10}
                      width="88"
                      height="20"
                      rx="10"
                      fill="#0e0e10"
                      stroke="rgba(52, 211, 153, 0.45)"
                      strokeWidth="1"
                    />
                    <circle cx={midX - 32} cy={midY} r="3" fill="#34d399" />
                    <text
                      x={midX + 6}
                      y={midY + 3.5}
                      textAnchor="middle"
                      fill="#34d399"
                      fontSize="8.5"
                      fontWeight="bold"
                    >
                      em andamento
                    </text>
                  </g>
                );
              }

              // Segmento normal entre dois ciclos concluídos
              const isUp = p.revenue > prev.revenue;
              const isDown = p.revenue < prev.revenue;
              const arrowSymbol = isUp ? "↗" : isDown ? "↘" : "→";
              const arrowColor = isUp ? "#34d399" : isDown ? "#f87171" : "rgba(255,255,255,0.4)";

              return (
                <g key={`arrow-${i}`}>
                  <circle cx={midX} cy={midY} r="8" fill="#0e0e10" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                  <text
                    x={midX}
                    y={midY + 3.5}
                    textAnchor="middle"
                    fill={arrowColor}
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {arrowSymbol}
                  </text>
                </g>
              );
            })}

            {/* Pontos de Dados & Rótulos */}
            {points.map((p, i) => {
              const isHovered = hoveredIdx === i;
              const isPeak = p.revenue === maxPoint?.revenue && p.revenue > 0 && !p.isCurrent;

              return (
                <g
                  key={p.id}
                  className="cursor-pointer transition-transform"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onClick={() => setHoveredIdx(i)}
                >
                  {/* Linha Guia Vertical no Hover */}
                  {isHovered && (
                    <line
                      x1={p.x}
                      y1={padTop}
                      x2={p.x}
                      y2={padTop + chartHeight}
                      stroke={p.isCurrent ? "rgba(52, 211, 153, 0.4)" : "rgba(16, 185, 129, 0.4)"}
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Halo Pulsante no Ponto Selecionado / Hover */}
                  {isHovered && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={12}
                      fill={p.isCurrent ? "rgba(52, 211, 153, 0.25)" : "rgba(16, 185, 129, 0.25)"}
                    />
                  )}

                  {/* Círculo do Ponto */}
                  {p.isCurrent ? (
                    <g>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={10}
                        fill="rgba(52, 211, 153, 0.12)"
                        stroke="rgba(52, 211, 153, 0.5)"
                        strokeWidth="1"
                        strokeDasharray="3 2"
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 6 : 5}
                        fill="#0e0e10"
                        stroke="#34d399"
                        strokeWidth="2.5"
                      />
                      <circle cx={p.x} cy={p.y} r="2" fill="#34d399" />
                    </g>
                  ) : (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6.5 : isPeak ? 5.5 : 4.5}
                      fill={isPeak ? "#34d399" : "#10b981"}
                      stroke="#0e0e10"
                      strokeWidth="2.5"
                    />
                  )}

                  {/* Rótulo de Valor Flutuante Acima do Ponto */}
                  <text
                    x={p.x}
                    y={p.y - 12}
                    textAnchor="middle"
                    fill={p.isCurrent ? "#34d399" : p.revenue > 0 ? (isPeak ? "#34d399" : "#ffffff") : "rgba(255,255,255,0.35)"}
                    fontSize={isHovered ? "11" : "10"}
                    fontWeight={isHovered || isPeak || p.isCurrent ? "bold" : "600"}
                  >
                    {formatBRL(p.revenue).replace(",00", "")}
                  </text>

                  {/* Rótulo do Eixo X (Nome do Período) */}
                  <text
                    x={p.x}
                    y={padTop + chartHeight + 20}
                    textAnchor="middle"
                    fill={p.isCurrent ? "#34d399" : isHovered ? "#ffffff" : "rgba(255,255,255,0.8)"}
                    fontSize="11"
                    fontWeight={p.isCurrent || isHovered ? "bold" : "500"}
                  >
                    {p.label.replace(" — em andamento", "").replace(" (em andamento)", "")}
                  </text>

                  {/* Sub-rótulo com Datas dos Ciclos 14 → 13 ou status em andamento */}
                  <text
                    x={p.x}
                    y={padTop + chartHeight + 35}
                    textAnchor="middle"
                    fill={p.isCurrent ? "#34d399" : "rgba(255,255,255,0.35)"}
                    fontSize="9"
                    fontWeight={p.isCurrent ? "bold" : "normal"}
                    fontFamily={p.isCurrent ? "sans-serif" : "monospace"}
                  >
                    {p.isCurrent
                      ? "em andamento"
                      : p.periodLabel.includes("→")
                      ? p.periodLabel.replace(/\/2026/g, "").slice(0, 11)
                      : p.periodLabel.slice(0, 10)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Card Detalhado do Ponto em Foco */}
        {activePoint && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">{activePoint.fullTitle}</span>
                {activePoint.isCurrent && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Ciclo Vigente (Em Andamento)</span>
                  </span>
                )}
              </div>
              <p className="text-white/50 text-[11px]">
                {activePoint.periodLabel}
                {activePoint.isCurrent && " · Faturamento apurado até o momento (ciclo aberto)"}
              </p>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-semibold">Faturamento</span>
                <span className="text-white font-extrabold text-sm">{formatBRL(activePoint.revenue)}</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-semibold">CMV (Custo)</span>
                <span className="text-red-400 font-bold text-sm">{formatBRL(activePoint.cmv)}</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-semibold">Lucro Líquido</span>
                <span className="text-emerald-400 font-extrabold text-sm">{formatBRL(activePoint.netProfit)}</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-semibold">Volume</span>
                <span className="text-white/80 font-semibold">{activePoint.orders} ped ({activePoint.pods} pods)</span>
              </div>
            </div>
          </div>
        )}
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

  // Dados Reais da Aba Evolução (Curva de Faturamento ao Longo dos Períodos)
  const evolutionData = useMemo<EvolutionPoint[]>(() => {
    if (historyTab === "mensal") {
      // Ordena cronologicamente: do ciclo mais antigo para o mais recente
      const sorted = [...monthlyCycles].sort((a, b) => a.cycle.id.localeCompare(b.cycle.id));
      return sorted.map((m) => ({
        id: m.cycle.id,
        label: m.cycle.isCurrent ? `${m.cycle.monthName} — em andamento` : m.cycle.monthName,
        fullTitle: `${m.cycle.name}${m.cycle.isCurrent ? " — em andamento" : ""} (${m.cycle.label})`,
        periodLabel: m.cycle.label,
        revenue: m.grossRevenue,
        cmv: m.cmv,
        netProfit: m.netProfit,
        orders: m.totalOrders,
        pods: m.totalPodsSold,
        isCurrent: m.cycle.isCurrent,
      }));
    }
    if (historyTab === "trimestral") {
      const sorted = [...quarterlyPeriods].reverse();
      return sorted.map((q) => {
        const parts = q.name.split(" ");
        const shortName = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : q.name;
        const hasCurrent = q.includedCycles?.some((c) => c.cycle.isCurrent);
        return {
          id: q.id,
          label: hasCurrent ? `${shortName} — em andamento` : shortName,
          fullTitle: `${q.name}${hasCurrent ? " — em andamento" : ""} (${q.label})`,
          periodLabel: q.label,
          revenue: q.grossRevenue,
          cmv: q.cmv,
          netProfit: q.netProfit,
          orders: q.totalOrders,
          pods: q.totalPodsSold,
          isCurrent: Boolean(hasCurrent),
        };
      });
    }
    if (historyTab === "semestral") {
      const sorted = [...semiannualPeriods].reverse();
      return sorted.map((s) => {
        const parts = s.name.split(" ");
        const shortName = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : s.name;
        const hasCurrent = s.includedCycles?.some((c) => c.cycle.isCurrent);
        return {
          id: s.id,
          label: hasCurrent ? `${shortName} — em andamento` : shortName,
          fullTitle: `${s.name}${hasCurrent ? " — em andamento" : ""} (${s.label})`,
          periodLabel: s.label,
          revenue: s.grossRevenue,
          cmv: s.cmv,
          netProfit: s.netProfit,
          orders: s.totalOrders,
          pods: s.totalPodsSold,
          isCurrent: Boolean(hasCurrent),
        };
      });
    }
    // Anual
    const sorted = [...annualPeriods].reverse();
    return sorted.map((y) => {
      const hasCurrent = y.includedCycles?.some((c) => c.cycle.isCurrent);
      const shortName = y.name.replace("Ano Financeiro · ", "Ano ");
      return {
        id: y.id,
        label: hasCurrent ? `${shortName} — em andamento` : shortName,
        fullTitle: `${y.name}${hasCurrent ? " — em andamento" : ""} (${y.label})`,
        periodLabel: y.label,
        revenue: y.grossRevenue,
        cmv: y.cmv,
        netProfit: y.netProfit,
        orders: y.totalOrders,
        pods: y.totalPodsSold,
        isCurrent: Boolean(hasCurrent),
      };
    });
  }, [historyTab, monthlyCycles, quarterlyPeriods, semiannualPeriods, annualPeriods]);

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
            <Sparkles className="size-6 text-emerald-400" />
            <span>Financeiro</span>
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Visão consolidada do ciclo atual, caixa disponível e inteligência comercial.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 text-white/90 border border-white/10">
            <Calendar className="size-3.5 text-emerald-400" />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-xs font-semibold text-emerald-400 mt-1">
                Margem: {profitMargin}%
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
            {/* Seletor de Modalidade da Evolução: Mensal / Trimestral / Semestral / Anual */}
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
                Gráfico dinâmico alimentado 100% pelos dados reais do banco
              </span>
            </div>

            {/* O Gráfico como elemento principal */}
            <RevenueEvolutionChart data={evolutionData} periodType={historyTab} />
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
