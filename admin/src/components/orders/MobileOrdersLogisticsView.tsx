import { useState, useMemo, useEffect } from "react";
import { formatBRL } from "@/lib/cart";
import { isOrderNational, extractNationalInfo } from "@/lib/nationalSales";
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
  Store,
  QrCode,
  CreditCard,
  Banknote,
  Send,
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
}

type MobileTab = "PREPARANDO" | "EM_ROTA" | "ENTREGUE" | "CONCLUIDO" | "AGUARDANDO_PAGAMENTO";

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

interface TabDefinition {
  id: MobileTab;
  label: string;
  activeColor: string;
  dotColor: string;
}

const TABS: TabDefinition[] = [
  {
    id: "PREPARANDO",
    label: "Preparando",
    activeColor: "bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]",
    dotColor: "bg-amber-500",
  },
  {
    id: "EM_ROTA",
    label: "Em Rota",
    activeColor: "bg-blue-500/20 border-blue-500 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.25)]",
    dotColor: "bg-blue-500",
  },
  {
    id: "ENTREGUE",
    label: "Entregues",
    activeColor: "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
    dotColor: "bg-emerald-500",
  },
  {
    id: "CONCLUIDO",
    label: "Concluídos",
    activeColor: "bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)]",
    dotColor: "bg-purple-400",
  },
  {
    id: "AGUARDANDO_PAGAMENTO",
    label: "Aguardando Pagamento",
    activeColor: "bg-zinc-100/20 border-zinc-300 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)]",
    dotColor: "bg-zinc-400",
  },
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
    case "AGUARDANDO_PAGAMENTO":
      return "Aguardando Pagamento";
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
}: MobileOrdersLogisticsViewProps) {
  // Aba ativa nas pílulas horizontais
  const [activeTab, setActiveTab] = useState<MobileTab>("PREPARANDO");

  // Campo de busca rápida
  const [searchQuery, setSearchQuery] = useState("");

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
      AGUARDANDO_PAGAMENTO: 0,
      PREPARANDO: 0,
      EM_ROTA: 0,
      ENTREGUE: 0,
      CONCLUIDO: 0,
    };
    orders.forEach((o) => {
      if (res[o.status] !== undefined) {
        res[o.status]++;
      }
    });
    return res;
  }, [orders]);

  // Se houver pedidos em Aguardando Pagamento mas a aba ativa estiver vazia, ou vice-versa
  useEffect(() => {
    // Se a aba atual estiver vazia mas outra aba tiver pedidos ativos, podemos mantê-la ou navegar
  }, [counts]);

  // Filtragem dos pedidos conforme a aba ativa e o campo de busca
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return orders.filter((o) => {
      // 1. Filtro da aba
      if (o.status !== activeTab) return false;

      // 2. Filtro de busca
      if (!q) return true;

      const matchesId = o.id.toLowerCase().includes(q) || o.realId.toLowerCase().includes(q);
      const matchesClient = (o.clientName || "").toLowerCase().includes(q);
      const matchesPhone = (o.phone || "").toLowerCase().includes(q);
      const matchesAddress = (o.address || "").toLowerCase().includes(q);
      const matchesItems = o.items.some(
        (i) => (i.model || "").toLowerCase().includes(q) || (i.flavor || "").toLowerCase().includes(q)
      );

      return matchesId || matchesClient || matchesPhone || matchesAddress || matchesItems;
    });
  }, [orders, activeTab, searchQuery]);

  return (
    <div className="flex flex-col h-full w-full bg-[#070709] text-white select-none overflow-hidden">
      {/* ========================================================
          1. HEADER COMPACTO MOBILE COM STATUS REALTIME
         ======================================================== */}
      <header className="shrink-0 bg-[#0c0c0f] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Package className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight truncate">
                Painel de Pedidos
              </h1>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full shrink-0">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wider">
                  Ao Vivo
                </span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium leading-none mt-0.5">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} no sistema
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenPushModal}
            className="size-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white active:scale-95 transition-all cursor-pointer"
            aria-label="Notificações Push"
            title="Alertas & Push"
          >
            <Bell className="size-4" />
          </button>
        </div>
      </header>

      {/* ========================================================
          2. CAMPO DE BUSCA COMPACTO (>= 16px font-size)
         ======================================================== */}
      <div className="shrink-0 bg-[#09090c] px-4 pt-3 pb-2.5 border-b border-white/5">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar pedido por cliente, ID, sabor ou modelo..."
            className="w-full bg-[#141418] border border-white/10 focus:border-emerald-500/50 rounded-xl pl-10 pr-9 py-2.5 text-base text-white placeholder:text-zinc-500 focus:outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Limpar busca"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          3. PÍLULAS HORIZONTAIS DE NAVEGAÇÃO DE STATUS
         ======================================================== */}
      <div className="shrink-0 bg-[#0a0a0d] border-b border-white/10 py-2.5 select-none">
        <div className="flex items-center gap-2 overflow-x-auto px-4 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden touch-pan-x">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = counts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 border transition-all active:scale-95 cursor-pointer ${
                  isActive
                    ? tab.activeColor
                    : "bg-[#151519] border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className={`size-2 rounded-full ${tab.dotColor} ${isActive ? "animate-pulse" : ""}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-white/5 text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {/* Espaçador para swipe lateral suave até a última pílula */}
          <div className="w-2 shrink-0" aria-hidden="true" />
        </div>
      </div>

      {/* ========================================================
          4. ÁREA DE PEDIDOS OCUPANDO O ESPAÇO RESTANTE
         ======================================================== */}
      <main className="flex-1 min-h-0 flex flex-col overflow-y-auto px-4 py-3 custom-scrollbar">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <Loader2 className="size-8 animate-spin text-emerald-400 mx-auto" />
            <p className="text-xs text-zinc-400">Carregando pedidos...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-sm bg-[#121215] border border-dashed border-white/10 rounded-2xl p-6 text-center space-y-3 shadow-lg">
              <Package className="size-9 text-zinc-600 mx-auto" />
              <div>
                <p className="text-sm font-bold text-zinc-200">Nenhum pedido nesta fase</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  {searchQuery
                    ? `Nenhum resultado para "${searchQuery}"`
                    : `Não há pedidos em "${getTabLabel(activeTab)}"`}
                </p>
              </div>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                >
                  Limpar busca
                </button>
              ) : activeTab !== "PREPARANDO" && counts.PREPARANDO > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("PREPARANDO")}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5 mx-auto"
                >
                  <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
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
              .map((i) => `${i.quantity || 1}x ${i.flavor || i.model || "Pod"}`)
              .join(", ");

            return (
              <div
                key={order.realId}
                className="bg-[#121215] border border-white/10 hover:border-white/20 rounded-2xl p-4 space-y-3 shadow-md transition-all active:scale-[0.99]"
              >
                {/* Cabeçalho do Card (ID + Tempo + Pagamento) */}
                <div
                  onClick={() => setSelectedOrderForDetails(order)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-zinc-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                      #{order.id}
                    </span>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Clock className="size-3 text-zinc-500" />
                      {getRelativeTime(order.createdAt)}
                    </span>
                  </div>

                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-emerald-400">
                    {order.paymentMethod || "PIX"}
                  </span>
                </div>

                {/* Corpo do Card: Cliente + Produtos + Destino (Toque abre Detalhes) */}
                <div
                  onClick={() => setSelectedOrderForDetails(order)}
                  className="space-y-1.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white truncate leading-tight">
                      {order.clientName}
                    </h3>
                    <ChevronRight className="size-4 text-zinc-600 shrink-0" />
                  </div>

                  {/* Resumo dos Itens */}
                  <p className="text-xs text-zinc-300 line-clamp-1 leading-snug">
                    <span className="text-emerald-400 font-bold">{podsCount} pod(s):</span>{" "}
                    {itemsSummary}
                  </p>

                  {/* Destino Logístico */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {isNational ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                        <Truck className="size-3" />
                        Correios ({nationalInfo?.state || "Nacional"})
                      </span>
                    ) : order.address &&
                      (order.address.includes("Balcão") || order.address.includes("balcao")) ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                        <Store className="size-3 text-zinc-400" />
                        Balcão / Retirada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md truncate max-w-[240px]">
                        <Bike className="size-3 shrink-0" />
                        <span className="truncate">{order.address || "Entrega Local"}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Linha de Total */}
                <div
                  onClick={() => setSelectedOrderForDetails(order)}
                  className="flex items-baseline justify-between pt-2 border-t border-white/5 cursor-pointer"
                >
                  <span className="text-xs text-zinc-400 font-medium">
                    {order.shippingFee > 0
                      ? `+ Frete ${formatBRL(order.shippingFee)}`
                      : "Frete Grátis"}
                  </span>
                  <span className="text-base font-black text-emerald-400">
                    {formatBRL(order.totalAmount)}
                  </span>
                </div>

                {/* ========================================================
                    5. BOTÃO DE AÇÃO PRINCIPAL MOBILE (>= 48px Altura)
                   ======================================================== */}
                <div className="pt-1">
                  {order.status === "PREPARANDO" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrderForDispatch(order);
                        setNotifyWhatsAppOnDispatch(false);
                      }}
                      className="w-full min-h-[48px] bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-98 transition-all"
                    >
                      <Truck className="size-4" />
                      <span>Despachar Pedido ➔</span>
                    </button>
                  )}

                  {order.status === "EM_ROTA" && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(order.realId, "ENTREGUE")}
                      className="w-full min-h-[48px] bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.3)] active:scale-98 transition-all"
                    >
                      <CheckCircle2 className="size-4" />
                      <span>Confirmar Entrega ✓</span>
                    </button>
                  )}

                  {order.status === "ENTREGUE" && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(order.realId, "CONCLUIDO")}
                      className="w-full min-h-[48px] bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-98 transition-all"
                    >
                      <CheckCircle2 className="size-4" />
                      <span>Concluir Pedido ✓</span>
                    </button>
                  )}

                  {order.status === "CONCLUIDO" && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForDetails(order)}
                      className="w-full min-h-[44px] bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-98 transition-all"
                    >
                      <span>Ver Detalhes do Pedido</span>
                      <ChevronRight className="size-3.5 text-zinc-400" />
                    </button>
                  )}

                  {order.status === "AGUARDANDO_PAGAMENTO" && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(order.realId, "PREPARANDO")}
                      className="w-full min-h-[48px] bg-emerald-500/20 border border-emerald-500 text-emerald-400 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-98 transition-all"
                    >
                      <Check className="size-4" />
                      <span>Confirmar Pagamento (Pix Caiu)</span>
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
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
                      className="min-h-[44px] bg-emerald-500 text-black font-extrabold rounded-xl"
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
                          <span className="text-emerald-400">{item.quantity}x</span>{" "}
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
                      className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1"
                    >
                      {copiedText === "address" ? (
                        <>
                          <Check className="size-3" />
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
                    <MapPin className="size-4 text-emerald-400 shrink-0 mt-0.5" />
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
                  <span className="text-lg font-black text-emerald-400">
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
                      <ReceiptText className="size-4 text-emerald-400" />
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
                    className="w-full min-h-[44px] bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold rounded-xl flex items-center justify-center gap-2"
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
                  <div className="size-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
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
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
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
                    className="w-full min-h-[50px] bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-98 transition-all"
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
                      className="size-5 rounded-md accent-emerald-500 bg-[#121215] border-white/20"
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
