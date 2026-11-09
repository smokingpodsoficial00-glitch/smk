import { useState, useMemo, useEffect } from "react";
import { formatBRL } from "@/lib/cart";
import { isOrderNational, extractNationalInfo } from "@/lib/nationalSales";
import { markFiadoOrderAsPaid, reopenFiadoOrder } from "@/lib/fiadoSales";
import { invalidateFinanceCache } from "@/lib/financeCache";
import { invalidateLiveClientsCache } from "@/lib/crm";
import { invalidateSalesHistoryCache } from "@/lib/salesHistory";
import type { AdminOrder } from "../KanbanBoard";
import {
  Clock,
  MapPin,
  ReceiptText,
  CheckCircle2,
  Truck,
  Bike,
  X,
  Loader2,
  Search,
  Copy,
  Trash2,
  RotateCcw,
  Package,
  Bell,
  ArrowLeft,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
  Check,
  ChevronRight,
  ChevronDown,
  Store,
  QrCode,
  CreditCard,
  Banknote,
  Send,
  BookOpen,
  Calendar,
  Phone,
} from "lucide-react";

export interface MobileOrdersLogisticsViewProps {
  orders: AdminOrder[];
  loading: boolean;
  onUpdateStatus: (
    realId: string,
    newDeliveryStatus: AdminOrder["status"],
    deliveryType?: "uber" | "proprio",
    options?: { notifyWhatsApp?: boolean }
  ) => Promise<void>;
  onDeleteOrder: (realId: string) => Promise<void>;
  onGrantDiscount: (realId: string) => Promise<void>;
  onOpenWhatsAppDiscount: (realId: string) => void;
  onOpenManualSale: () => void;
  onOpenPushModal: () => void;
  onOrdersChanged?: () => void;
}

type MobileTab = "PREPARANDO" | "EM_ROTA" | "ENTREGUE" | "CONCLUIDO" | "FIADOS";

function getRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "agora mesmo";
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours} h`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

interface ActiveFlowTab {
  id: "PREPARANDO" | "EM_ROTA" | "ENTREGUE";
  label: string;
}

const ACTIVE_FLOW_TABS: ActiveFlowTab[] = [
  { id: "PREPARANDO", label: "Preparando" },
  { id: "EM_ROTA", label: "Em Rota" },
  { id: "ENTREGUE", label: "Entregues" },
];

function getTabLabel(tab: MobileTab): string {
  switch (tab) {
    case "PREPARANDO":
      return "Preparando";
    case "EM_ROTA":
      return "Em Rota";
    case "ENTREGUE":
      return "Entregues";
    case "CONCLUIDO":
      return "Concluídos";
    case "FIADOS":
      return "Fiados";
    default:
      return "";
  }
}

export function MobileOrdersLogisticsView({
  orders,
  loading,
  onUpdateStatus,
  onDeleteOrder,
  onGrantDiscount,
  onOpenWhatsAppDiscount,
  onOpenManualSale,
  onOpenPushModal,
  onOrdersChanged,
}: MobileOrdersLogisticsViewProps) {
  // Aba ativa nas abas enquadradas no celular
  const [activeTab, setActiveTab] = useState<MobileTab>("PREPARANDO");
  const [processingFiadoId, setProcessingFiadoId] = useState<string | null>(null);

  // Controle de cards expandidos / minimizados
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  const toggleExpand = (realId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(realId)) {
        next.delete(realId);
      } else {
        next.add(realId);
      }
      return next;
    });
  };

  // Estado para Bottom Sheet de Detalhes
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<AdminOrder | null>(null);

  // Estado para Bottom Sheet de Despacho Logístico
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<AdminOrder | null>(null);
  const [notifyWhatsAppOnDispatch, setNotifyWhatsAppOnDispatch] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Feedback de cópia
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string | null | undefined, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Contagem por Status
  const counts: Record<string, number> = useMemo(() => {
    const res: Record<string, number> = {
      PREPARANDO: 0,
      EM_ROTA: 0,
      ENTREGUE: 0,
      CONCLUIDO: 0,
      FIADOS: 0,
    };
    orders.forEach((o) => {
      if (o.isFiado) {
        res.FIADOS++;
      }
      if (!o.isFiado || o.fiadoStatus !== "PENDENTE") {
        if (res[o.status] !== undefined) {
          res[o.status]++;
        }
      }
    });
    return res;
  }, [orders]);

  // Filtragem dos pedidos conforme a aba ativa
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (activeTab === "FIADOS") {
        return Boolean(o.isFiado);
      }
      if (o.isFiado && o.fiadoStatus === "PENDENTE") return false;
      return o.status === activeTab;
    });
  }, [orders, activeTab]);

  return (
    <div className="flex flex-col h-full w-full bg-[#070709] text-white select-none overflow-hidden">
      {/* ━━━ NAVEGAÇÃO DE STATUS ENQUADRADA NO CELULAR (SEM SCROLL LATERAL) ━━━ */}
      <div className="shrink-0 bg-[#09090c] border-b border-white/10 px-3 py-2 space-y-1.5 select-none">
        {/* Linha 1: Funil em Andamento (3 colunas iguais) */}
        <div className="grid grid-cols-3 gap-1.5 w-full">
          {ACTIVE_FLOW_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = counts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`h-11 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border transition-all active:scale-95 cursor-pointer ${
                  isActive
                    ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.35)]"
                    : "bg-[#141418] border-white/10 text-zinc-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isActive ? "bg-black/15 text-black" : "bg-white/10 text-white"
                    }`}
                  >
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Linha 2: Concluídos & Fiados (2 colunas destacadas) */}
        <div className="grid grid-cols-2 gap-1.5 w-full">
          {/* Concluídos */}
          <button
            type="button"
            onClick={() => setActiveTab("CONCLUIDO")}
            className={`h-11 px-3 rounded-xl text-xs font-bold flex items-center justify-between border transition-all active:scale-95 cursor-pointer ${
              activeTab === "CONCLUIDO"
                ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.35)]"
                : "bg-[#141418] border-white/10 text-zinc-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`size-4 ${activeTab === "CONCLUIDO" ? "text-black" : "text-white"}`} />
              <span>Concluídos</span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-mono font-extrabold ${
                activeTab === "CONCLUIDO" ? "bg-black/15 text-black" : "bg-white/10 text-white"
              }`}
            >
              {counts.CONCLUIDO ?? 0}
            </span>
          </button>

          {/* Fiados (ÁREA MAIS DESTACADA) */}
          <button
            type="button"
            onClick={() => setActiveTab("FIADOS")}
            className={`h-11 px-3 rounded-xl text-xs font-bold flex items-center justify-between border-2 transition-all active:scale-95 cursor-pointer ${
              activeTab === "FIADOS"
                ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.45)] ring-2 ring-white/50"
                : counts.FIADOS > 0
                ? "bg-[#18181d] border-white/40 text-white shadow-[0_0_12px_rgba(255,255,255,0.15)]"
                : "bg-[#141418] border-white/20 text-zinc-300 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className={`size-4 ${activeTab === "FIADOS" ? "text-black" : "text-white"}`} />
              <span className="tracking-wide">Fiados</span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-mono font-extrabold ${
                activeTab === "FIADOS"
                  ? "bg-black text-white"
                  : counts.FIADOS > 0
                  ? "bg-white text-black shadow-sm"
                  : "bg-white/10 text-white"
              }`}
            >
              {counts.FIADOS ?? 0}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================
          4. ÁREA DE PEDIDOS OCUPANDO O ESPAÇO RESTANTE
         ======================================================== */}
      <main className="flex-1 min-h-0 flex flex-col overflow-y-auto px-4 py-3 custom-scrollbar">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <Loader2 className="size-8 animate-spin text-white mx-auto" />
            <p className="text-xs text-zinc-400">Carregando pedidos...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-sm bg-[#121215] border border-dashed border-white/10 rounded-2xl p-6 text-center space-y-3 shadow-lg">
              <Package className="size-9 text-zinc-500 mx-auto" />
              <div>
                <p className="text-sm font-bold text-white">Nenhum pedido nesta fase</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Não há pedidos em "{getTabLabel(activeTab)}"
                </p>
              </div>
              {activeTab !== "PREPARANDO" && counts.PREPARANDO > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("PREPARANDO")}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5 mx-auto"
                >
                  <span className="size-1.5 rounded-full bg-white animate-pulse" />
                  <span>Ver Preparando ({counts.PREPARANDO})</span>
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {filteredOrders.map((order) => {
              const isNational = isOrderNational(order);
              const nationalInfo = isNational ? extractNationalInfo(order) : null;
              const podsCount = order.items.reduce((acc, i) => acc + (i.quantity || 1), 0);
              const itemsSummary = order.items
                .map((i) => `${i.quantity || 1}x ${i.flavor || i.model || "Produto"}`)
                .join(", ");
              const isExpanded = expandedOrderIds.has(order.realId);
              const isFiadoPending = activeTab === "FIADOS" || Boolean(order.isFiado && order.fiadoStatus !== "PAGO");

              // ━━━ ESTADO MINIMIZADO (Apenas Nome, Dia de Pagamento e Valor a Pagar) ━━━
              if (!isExpanded) {
                return (
                  <div
                    key={order.realId}
                    onClick={() => toggleExpand(order.realId)}
                    style={isFiadoPending ? { borderColor: "rgba(239, 68, 68, 0.4)", backgroundColor: "#161214" } : undefined}
                    className={`border rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all select-none shadow-sm ${
                      isFiadoPending
                        ? "border-red-500/40 bg-[#161214]"
                        : "bg-[#121215] border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate leading-tight">
                          {order.clientName}
                        </h3>
                        {isFiadoPending && (
                          <span
                            style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.4)" }}
                            className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border shrink-0"
                          >
                            Falta pagar
                          </span>
                        )}
                      </div>
                      {order.isFiado ? (
                        <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                          <Calendar
                            style={{ color: isFiadoPending ? "#f87171" : undefined }}
                            className={`size-3 shrink-0 ${isFiadoPending ? "text-red-400" : "text-zinc-400"}`}
                          />
                          <span>
                            Dia do pagamento:{" "}
                            <b
                              style={{ color: isFiadoPending ? "#f87171" : "#ffffff" }}
                              className={isFiadoPending ? "text-red-400" : "text-white"}
                            >
                              {order.fiadoDueDateFormatted || "A combinar"}
                            </b>
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                          <Calendar className="size-3 text-zinc-400 shrink-0" />
                          <span>Data: <b className="text-white">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</b></span>
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        {isFiadoPending && (
                          <span
                            style={{ color: "#f87171" }}
                            className="text-[9px] font-extrabold uppercase tracking-wider block"
                          >
                            Falta pagar
                          </span>
                        )}
                        <span
                          style={{ color: isFiadoPending ? "#ef4444" : "#ffffff" }}
                          className={`text-sm font-black block ${isFiadoPending ? "text-red-500" : "text-white"}`}
                        >
                          {formatBRL(order.isFiado ? (order.fiadoAmountOwed || order.totalAmount) : order.totalAmount)}
                        </span>
                      </div>
                      <ChevronDown
                        style={{ color: isFiadoPending ? "#f87171" : undefined }}
                        className="size-4 text-zinc-500 shrink-0"
                      />
                    </div>
                  </div>
                );
              }

              // ━━━ ESTADO MAXIMIZADO (O Card Completo Exatamente como no Print) ━━━
              return (
                <div
                  key={order.realId}
                  className="bg-[#121215] border border-white/20 hover:border-white/30 rounded-2xl p-4 space-y-3 shadow-md transition-all active:scale-[0.99]"
                >
                  {/* Cabeçalho do Card (ID + Tempo + Pagamento + Botão Minimizar) */}
                  <div className="flex items-center justify-between">
                    <div
                      onClick={() => toggleExpand(order.realId)}
                      className="flex items-center gap-2 cursor-pointer"
                      title="Clique para minimizar"
                    >
                      <span className="font-mono text-xs font-bold text-white bg-white/10 border border-white/20 px-2 py-0.5 rounded-md">
                        #{order.id}
                      </span>
                      <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                        <Clock className="size-3 text-zinc-400" />
                        {getRelativeTime(order.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        (order.isFiado || activeTab === "FIADOS")
                          ? isFiadoPending
                            ? "bg-red-500/15 border border-red-500/40 text-red-400"
                            : "bg-white/10 border border-white/20 text-white"
                          : "bg-white/10 border border-white/20 text-white"
                      }`}>
                        {(order.isFiado || activeTab === "FIADOS")
                          ? isFiadoPending
                            ? `FALTA PAGAR (${order.fiadoDueDateFormatted || "Pendente"})`
                            : "FIADO PAGO"
                          : order.paymentMethod || "PIX"}
                      </span>

                      {/* Botão de Minimizar */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(order.realId);
                        }}
                        className="size-7 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
                        title="Minimizar card"
                      >
                        <ChevronDown className="size-4 rotate-180" />
                      </button>
                    </div>
                  </div>

                  {/* Corpo do Card: Cliente + Produtos + Destino (ao clicar, minimiza/recolhe o card) */}
                  <div
                    onClick={() => toggleExpand(order.realId)}
                    className="space-y-1.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white truncate leading-tight">
                        {order.clientName}
                      </h3>
                      <ChevronDown className="size-4 text-zinc-500 shrink-0 rotate-180" />
                    </div>

                    {/* Resumo dos Itens */}
                    <p className="text-xs text-zinc-300 line-clamp-1 leading-snug">
                      <span className="text-white font-bold">{podsCount} item(ns):</span>{" "}
                      {itemsSummary}
                    </p>

                    {/* Destino Logístico */}
                    <div className="flex items-center gap-2 pt-0.5">
                      {isNational ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-white/10 border border-white/20 px-2 py-0.5 rounded-md">
                          <Truck className="size-3 text-white" />
                          Correios ({nationalInfo?.state || "Nacional"})
                        </span>
                      ) : order.address &&
                        (order.address.includes("Balcão") || order.address.includes("balcao")) ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-white/10 border border-white/20 px-2 py-0.5 rounded-md">
                          <Store className="size-3 text-zinc-300" />
                          Balcão / Retirada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-white/10 border border-white/20 px-2 py-0.5 rounded-md truncate max-w-[240px]">
                          <Bike className="size-3 shrink-0 text-white" />
                          <span className="truncate">{order.address || "Entrega Local"}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Linha de Total (ao clicar, minimiza/recolhe o card) */}
                  <div
                    onClick={() => toggleExpand(order.realId)}
                    className="flex items-baseline justify-between pt-2 border-t border-white/5 cursor-pointer"
                  >
                    <span className="text-xs text-zinc-400 font-medium">
                      {order.shippingFee > 0
                        ? `+ Frete ${formatBRL(order.shippingFee)}`
                        : "Frete Grátis"}
                    </span>
                    <span className="text-base font-black text-white">
                      {formatBRL(order.totalAmount)}
                    </span>
                  </div>

                  {/* Bloco de Fiado no Card Mobile (Exatamente como no print, com destaque vermelho para falta pagar) */}
                  {(order.isFiado || activeTab === "FIADOS") && (
                    <div
                      style={isFiadoPending ? { borderColor: "rgba(239, 68, 68, 0.4)", backgroundColor: "rgba(239, 68, 68, 0.05)" } : undefined}
                      className={`p-3 rounded-xl border space-y-2 ${
                        isFiadoPending
                          ? "border-red-500/40 bg-red-500/[0.05]"
                          : "border-white/20 bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className={`flex items-center gap-1 font-medium ${isFiadoPending ? "text-red-300" : "text-zinc-300"}`}>
                          Dia do pagamento:{" "}
                          <b
                            style={{ color: isFiadoPending ? "#f87171" : "#ffffff" }}
                            className={isFiadoPending ? "text-red-400" : "text-white"}
                          >
                            {order.fiadoDueDateFormatted || "Não informada"}
                          </b>
                        </span>
                        <div className="text-right">
                          {isFiadoPending && (
                            <span
                              style={{ color: "#f87171" }}
                              className="text-[9px] font-extrabold text-red-400 uppercase tracking-wider block"
                            >
                              Falta pagar
                            </span>
                          )}
                          <span
                            style={{ color: isFiadoPending ? "#ef4444" : "#ffffff" }}
                            className={`font-extrabold text-sm ${isFiadoPending ? "text-red-500" : "text-white"}`}
                          >
                            {formatBRL(order.fiadoAmountOwed || order.totalAmount)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {order.phone && !order.phone.startsWith("INSTA_") && (
                          <a
                            href={`https://wa.me/${order.phone.replace(/\D/g, "").startsWith("55") ? order.phone.replace(/\D/g, "") : `55${order.phone.replace(/\D/g, "")}`}?text=${encodeURIComponent(`Olá ${order.clientName}! Tudo bem? Passando para combinar sobre o pagamento do seu pedido #${order.id} no valor de ${formatBRL(order.fiadoAmountOwed || order.totalAmount)}, para ${order.fiadoDueDateFormatted || "o dia combinado"}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 min-h-[40px] rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Phone className="size-3.5 text-zinc-300" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                        {order.fiadoStatus === "PENDENTE" ? (
                          <button
                            type="button"
                            disabled={processingFiadoId === order.realId}
                            onClick={async () => {
                              setProcessingFiadoId(order.realId);
                              const res = await markFiadoOrderAsPaid({ orderId: order.realId, paidMethod: "PIX" });
                              setProcessingFiadoId(null);
                              if (res.success) {
                                try {
                                  const raw = localStorage.getItem("smoking_completed_order_ids");
                                  const ids = raw ? JSON.parse(raw) : [];
                                  if (!ids.includes(order.realId)) {
                                    localStorage.setItem("smoking_completed_order_ids", JSON.stringify([...ids, order.realId]));
                                  }
                                } catch {}
                                invalidateFinanceCache();
                                invalidateLiveClientsCache();
                                invalidateSalesHistoryCache();
                                onOrdersChanged?.();
                              } else {
                                alert("Erro ao confirmar pagamento: " + (res.error || ""));
                              }
                            }}
                            className="flex-1 min-h-[40px] rounded-xl bg-white hover:bg-zinc-200 text-black text-[11px] font-extrabold flex items-center justify-center gap-1 shadow-[0_0_12px_rgba(255,255,255,0.3)] active:scale-95 transition-all"
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>{processingFiadoId === order.realId ? "Salvando..." : "Confirmar que foi Pago"}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={processingFiadoId === order.realId}
                            onClick={async () => {
                              setProcessingFiadoId(order.realId);
                              const res = await reopenFiadoOrder({ orderId: order.realId });
                              setProcessingFiadoId(null);
                              if (res.success) {
                                try {
                                  const raw = localStorage.getItem("smoking_completed_order_ids");
                                  const ids = raw ? JSON.parse(raw) : [];
                                  localStorage.setItem("smoking_completed_order_ids", JSON.stringify(ids.filter((id: string) => id !== order.realId)));
                                } catch {}
                                invalidateFinanceCache();
                                invalidateLiveClientsCache();
                                invalidateSalesHistoryCache();
                                onOrdersChanged?.();
                              }
                            }}
                            className="px-3 min-h-[40px] rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-zinc-300 text-[11px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                          >
                            <RotateCcw className="size-3" />
                            <span>Desfazer</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Ações operacionais / Ver Detalhes */}
                  <div className="pt-1">
                    {order.status === "PREPARANDO" && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.realId, "EM_ROTA")}
                        className="w-full min-h-[48px] bg-white hover:bg-zinc-200 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.35)] active:scale-98 transition-all"
                      >
                        <Truck className="size-4" />
                        <span>Despachar Pedido ➔</span>
                      </button>
                    )}

                    {order.status === "EM_ROTA" && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.realId, "ENTREGUE")}
                        className="w-full min-h-[48px] bg-white hover:bg-zinc-200 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.35)] active:scale-98 transition-all"
                      >
                        <CheckCircle2 className="size-4" />
                        <span>Confirmar Entrega ✓</span>
                      </button>
                    )}

                    {order.status === "ENTREGUE" && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.realId, "CONCLUIDO")}
                        className="w-full min-h-[48px] bg-white hover:bg-zinc-200 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.35)] active:scale-98 transition-all"
                      >
                        <CheckCircle2 className="size-4" />
                        <span>Concluir Pedido ✓</span>
                      </button>
                    )}

                    {(order.status === "CONCLUIDO" || activeTab === "FIADOS" || !["PREPARANDO", "EM_ROTA", "ENTREGUE"].includes(order.status)) && (
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForDetails(order)}
                        className="w-full min-h-[44px] bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-98 transition-all"
                      >
                        <span>Ver Detalhes do Pedido</span>
                        <ChevronRight className="size-3.5 text-zinc-400" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ========================================================
          6. BOTTOM SHEET: DETALHES COMPLETOS DO PEDIDO
         ======================================================== */}
      {selectedOrderForDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200">
          <div
            className="flex-1"
            onClick={() => setSelectedOrderForDetails(null)}
          />

          <div className="bg-[#121215] border-t border-white/15 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* Puxador Superior */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-2.5 mb-1 shrink-0" />

            {/* Cabeçalho do Bottom Sheet */}
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-white">
                    Pedido #{selectedOrderForDetails.id}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-white border border-white/20">
                    {selectedOrderForDetails.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Registrado em {new Date(selectedOrderForDetails.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrderForDetails(null)}
                className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Conteúdo Rolável dos Detalhes */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar text-xs">
              {/* Alerta de Desconto Solicitado pelo Dono */}
              {selectedOrderForDetails.requestedDiscount && (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span>🏷️ Cliente Solicitou 10% de Desconto</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onGrantDiscount(selectedOrderForDetails.realId);
                        setSelectedOrderForDetails(null);
                      }}
                      className="min-h-[44px] bg-white text-black font-extrabold rounded-xl"
                    >
                      Aprovar 10%
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenWhatsAppDiscount(selectedOrderForDetails.realId)}
                      className="min-h-[44px] bg-[#25D366] text-black font-extrabold rounded-xl"
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>
              )}

              {/* Bloco do Cliente */}
              <div className="bg-[#18181c] border border-white/5 rounded-2xl p-4 space-y-2.5">
                <span className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider block">
                  Cliente & Contato
                </span>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">
                      {selectedOrderForDetails.clientName}
                    </h4>
                    {selectedOrderForDetails.phone && (
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {selectedOrderForDetails.phone}
                      </p>
                    )}
                  </div>

                  {selectedOrderForDetails.phone &&
                    !selectedOrderForDetails.phone.startsWith("INSTA_") && (
                      <a
                        href={`https://wa.me/${selectedOrderForDetails.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] px-3 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] font-bold flex items-center gap-1.5 shrink-0"
                      >
                        <MessageCircle className="size-3.5" />
                        <span>Conversar</span>
                      </a>
                    )}
                </div>
              </div>

              {/* Bloco de Produtos */}
              <div className="bg-[#18181c] border border-white/5 rounded-2xl p-4 space-y-2.5">
                <span className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider block">
                  Itens do Pedido ({selectedOrderForDetails.items.length} tipo(s))
                </span>
                <div className="space-y-2 divide-y divide-white/5">
                  {selectedOrderForDetails.items.map((item, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">
                          <span className="text-white font-extrabold">{item.quantity}x</span>{" "}
                          {item.flavor || "Sabor Único"}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{item.model}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-white">
                          {formatBRL((item.price || 0) * (item.quantity || 1))}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-[10px] text-zinc-500 block">
                            {formatBRL(item.price || 0)} cada
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloco de Logística & Endereço */}
              <div className="bg-[#18181c] border border-white/5 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider">
                    Logística & Entrega
                  </span>
                  {selectedOrderForDetails.address && (
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedOrderForDetails.address, "address")}
                      className="text-[11px] text-zinc-300 hover:text-white font-semibold flex items-center gap-1"
                    >
                      {copiedText === "address" ? (
                        <>
                          <Check className="size-3 text-white" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copiar Endereço</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-zinc-300">
                    <MapPin className="size-4 text-white shrink-0 mt-0.5" />
                    <p className="leading-snug">
                      {selectedOrderForDetails.address || "Atendimento Balcão / WhatsApp"}
                    </p>
                  </div>

                  {isOrderNational(selectedOrderForDetails) && (() => {
                    const natInfo = extractNationalInfo(selectedOrderForDetails);
                    return (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 mt-2">
                        <div className="flex items-center justify-between text-amber-300 font-bold">
                          <span>🇧🇷 Envio Nacional (Correios)</span>
                          <span>{natInfo.state}</span>
                        </div>
                        {natInfo.city && (
                          <p className="text-[11px] text-zinc-400">Cidade: {natInfo.city}</p>
                        )}
                        {natInfo.trackingCode && (
                          <div className="flex items-center justify-between pt-1 text-white font-mono">
                            <span>Rastreio: {natInfo.trackingCode}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(natInfo.trackingCode, "tracking")}
                              className="text-[10px] text-amber-300 underline"
                            >
                              {copiedText === "tracking" ? "Copiado!" : "Copiar"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                    <span className="text-zinc-400">Taxa de Frete:</span>
                    <span className="font-bold text-white">
                      {selectedOrderForDetails.shippingFee > 0
                        ? formatBRL(selectedOrderForDetails.shippingFee)
                        : "Grátis"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloco Financeiro & Recibo */}
              <div className="bg-[#18181c] border border-white/5 rounded-2xl p-4 space-y-2.5">
                <span className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider block">
                  Pagamento
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">
                    Método: <b>{selectedOrderForDetails.paymentMethod}</b>
                  </span>
                  <span className="text-lg font-black text-white">
                    {formatBRL(selectedOrderForDetails.totalAmount)}
                  </span>
                </div>

                {selectedOrderForDetails.receiptUrl &&
                  selectedOrderForDetails.receiptUrl !== "CONCLUIDO" &&
                  selectedOrderForDetails.receiptUrl !== "SOLICITOU_DESCONTO" && (
                    <a
                      href={selectedOrderForDetails.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] w-full rounded-xl bg-white/5 border border-white/10 text-white font-semibold flex items-center justify-center gap-2 mt-2"
                    >
                      <ReceiptText className="size-4 text-white" />
                      <span>Ver Comprovante Anexado</span>
                      <ExternalLink className="size-3 text-zinc-500" />
                    </a>
                  )}
              </div>

              {/* ========================================================
                  AÇÕES SECUNDÁRIAS DO BOTTOM SHEET
                 ======================================================== */}
              <div className="space-y-2 pt-2">
                {/* Voltar Status */}
                {selectedOrderForDetails.status === "EM_ROTA" && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onUpdateStatus(selectedOrderForDetails.realId, "PREPARANDO");
                      setSelectedOrderForDetails(null);
                    }}
                    className="w-full min-h-[44px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-300 font-semibold flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="size-4" />
                    <span>Voltar para "Preparando"</span>
                  </button>
                )}

                {selectedOrderForDetails.status === "ENTREGUE" && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onUpdateStatus(selectedOrderForDetails.realId, "EM_ROTA");
                      setSelectedOrderForDetails(null);
                    }}
                    className="w-full min-h-[44px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-300 font-semibold flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="size-4" />
                    <span>Voltar para "Em Rota"</span>
                  </button>
                )}

                {selectedOrderForDetails.status === "CONCLUIDO" && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onUpdateStatus(selectedOrderForDetails.realId, "ENTREGUE");
                      setSelectedOrderForDetails(null);
                    }}
                    className="w-full min-h-[44px] bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <RotateCcw className="size-4" />
                    <span>Reabrir Pedido</span>
                  </button>
                )}

                {/* Excluir Pedido com Restauração de Estoque */}
                <button
                  type="button"
                  onClick={async () => {
                    const orderIdToDelete = selectedOrderForDetails.realId;
                    setSelectedOrderForDetails(null);
                    await onDeleteOrder(orderIdToDelete);
                  }}
                  className="w-full min-h-[44px] bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-400 font-bold rounded-xl flex items-center justify-center gap-2"
                >
                  <Trash2 className="size-4" />
                  <span>Excluir Pedido (Devolver ao Estoque)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          7. BOTTOM SHEET: DESPACHO LOGÍSTICO (Substitui modal desktop)
         ======================================================== */}
      {selectedOrderForDispatch && (() => {
        const isNational = isOrderNational(selectedOrderForDispatch);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200">
            <div
              className="flex-1"
              onClick={() => {
                if (!isDispatching) setSelectedOrderForDispatch(null);
              }}
            />

            <div className="bg-[#121215] border-t border-white/15 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-1 mb-1 shrink-0" />

              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Truck className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Despacho Logístico</h3>
                    <p className="text-[11px] text-zinc-400">
                      Pedido #{selectedOrderForDispatch.id} • {selectedOrderForDispatch.clientName}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isDispatching}
                  onClick={() => setSelectedOrderForDispatch(null)}
                  className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              {isNational ? (
                /* Fluxo Nacional (Correios) */
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 border border-white/15 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-white font-bold text-xs">
                      <Package className="size-4" />
                      <span>Envio Nacional (Correios / Sedex / PAC)</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Este pedido é para fora de SP. O disparo automático de motoboy local no WhatsApp
                      está <b>bloqueado por segurança</b> para não confundir o cliente.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isDispatching}
                    onClick={async () => {
                      setIsDispatching(true);
                      await onUpdateStatus(selectedOrderForDispatch.realId, "EM_ROTA", "proprio", {
                        notifyWhatsApp: false,
                      });
                      setIsDispatching(false);
                      setSelectedOrderForDispatch(null);
                    }}
                    className="w-full min-h-[50px] bg-white hover:bg-zinc-200 text-black font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.35)] active:scale-98 transition-all"
                  >
                    {isDispatching ? (
                      <>
                        <Loader2 className="size-4 animate-spin text-black" />
                        <span>Confirmando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4" />
                        <span>Confirmar Despacho (Correios)</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Fluxo Local (Motoboy / Uber) */
                <div className="space-y-3.5">
                  <p className="text-xs text-zinc-400">
                    Escolha a modalidade de entrega para despachar o pedido:
                  </p>

                  {/* Toggle de WhatsApp */}
                  <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#18181c] border border-white/10 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={notifyWhatsAppOnDispatch}
                      onChange={(e) => setNotifyWhatsAppOnDispatch(e.target.checked)}
                      disabled={isDispatching}
                      className="size-5 rounded-md accent-white bg-[#121215] border-white/20"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Avisar cliente no WhatsApp agora
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Dispara: <i>"Seu pedido já saiu para entrega!"</i>
                      </span>
                    </div>
                  </label>

                  {/* Opção 1: Motoboy Próprio */}
                  <button
                    type="button"
                    disabled={isDispatching}
                    onClick={async () => {
                      setIsDispatching(true);
                      await onUpdateStatus(selectedOrderForDispatch.realId, "EM_ROTA", "proprio", {
                        notifyWhatsApp: notifyWhatsAppOnDispatch,
                      });
                      setIsDispatching(false);
                      setSelectedOrderForDispatch(null);
                    }}
                    className="w-full min-h-[56px] p-3.5 bg-[#18181c] hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3.5 text-left active:scale-98 transition-all"
                  >
                    <div className="size-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
                      <Bike className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Entregador Próprio da Casa</h4>
                      <p className="text-[11px] text-zinc-400">Motoboy exclusivo da loja</p>
                    </div>
                  </button>

                  {/* Opção 2: Uber Direct */}
                  <button
                    type="button"
                    disabled={isDispatching}
                    onClick={async () => {
                      setIsDispatching(true);
                      await onUpdateStatus(selectedOrderForDispatch.realId, "EM_ROTA", "uber", {
                        notifyWhatsApp: notifyWhatsAppOnDispatch,
                      });
                      setIsDispatching(false);
                      setSelectedOrderForDispatch(null);
                    }}
                    className="w-full min-h-[56px] p-3.5 bg-[#18181c] hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3.5 text-left active:scale-98 transition-all"
                  >
                    <div className="size-10 rounded-xl bg-black border border-white/20 flex items-center justify-center text-white shrink-0 font-black text-xs">
                      UBER
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Uber Direct</h4>
                      <p className="text-[11px] text-zinc-400">Integração com rastreio em tempo real</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
