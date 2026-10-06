import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Users,
  Search,
  MessageSquare,
  Clock,
  MapPin,
  X,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  Calendar,
  Trash2,
  Edit2,
  ChevronRight,
  Flame,
  Crown,
  Send,
  Copy,
  Receipt,
  Eye,
  Check,
  Phone,
  AlertTriangle,
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { fetchSalesHistory, invalidateSalesHistoryCache, type DetailedSale } from "@/lib/salesHistory";
import {
  fetchLiveClients,
  invalidateLiveClientsCache,
  updateBasicClientData,
  recordReplenishmentAlert,
  matchesVisualSearch,
  formatPhoneForDisplay,
  type RealClient,
} from "@/lib/crm";
import { supabase } from "@/lib/supabase";
import { deleteOrderWithStockRestoration, deleteClientRecord } from "@/lib/orders";

interface MobileCRMViewProps {
  companyId?: string;
  refreshKey?: number;
  onOpenManualSale?: () => void;
  onSelectClient?: (client: RealClient) => void;
}

export function MobileCRMView({
  companyId,
  refreshKey,
}: MobileCRMViewProps) {
  const [clients, setClients] = useState<RealClient[]>([]);
  const [sales, setSales] = useState<DetailedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtros rápidos móveis: 'todos' | 'recompra' | 'vip' | 'vendas'
  const [activeFilter, setActiveFilter] = useState<"todos" | "recompra" | "vip" | "vendas">("todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Bottom Sheets Móveis
  const [selectedClientForSheet, setSelectedClientForSheet] = useState<RealClient | null>(null);
  const [selectedSaleForSheet, setSelectedSaleForSheet] = useState<DetailedSale | null>(null);

  // Estados de edição de cliente no Bottom Sheet
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Trava anti-duplo-clique para envio de alertas WhatsApp
  const [submittingAlerts, setSubmittingAlerts] = useState<Set<string>>(new Set());
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Carregamento de dados com tratamento resiliente e cache inteligente
  const realtimeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadCRMData = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) {
      setIsRefreshing(true);
      invalidateLiveClientsCache(companyId);
      invalidateSalesHistoryCache(companyId);
    }
    try {
      const [liveClients, salesData] = await Promise.all([
        fetchLiveClients(companyId),
        fetchSalesHistory(companyId),
      ]);
      setClients(Array.isArray(liveClients) ? liveClients : []);
      setSales(Array.isArray(salesData?.sales) ? salesData.sales : []);
    } catch (err) {
      console.error("[MobileCRMView] Erro ao carregar dados do CRM:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCRMData();

    const handleRealtimeChange = () => {
      invalidateLiveClientsCache(companyId);
      invalidateSalesHistoryCache(companyId);
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
      realtimeDebounceTimerRef.current = setTimeout(() => {
        loadCRMData();
      }, 300);
    };

    const targetCompanyId = companyId || 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
    const channel = supabase
      .channel(`mobile_crm_${targetCompanyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_orders" }, handleRealtimeChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_clients" }, handleRealtimeChange)
      .subscribe();

    return () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [companyId, refreshKey]);

  // Contadores dinâmicos
  const counters = useMemo(() => {
    const total = clients.length;
    const endingSoon = clients.filter(
      (c) => c && (c.isEndingSoon || c.urgencyLevel === "urgent" || c.urgencyLevel === "warning")
    ).length;
    const vips = clients.filter(
      (c) => c && (c.segment === "champion" || c.segment === "loyal" || c.inVipGroup)
    ).length;
    const totalSales = sales.length;
    return { total, endingSoon, vips, totalSales };
  }, [clients, sales]);

  // Filtragem dos Clientes
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (!client) return false;

      // 1. Filtro da Aba
      if (activeFilter === "recompra") {
        if (!client.isEndingSoon && client.urgencyLevel !== "urgent" && client.urgencyLevel !== "warning") {
          return false;
        }
      } else if (activeFilter === "vip") {
        if (client.segment !== "champion" && client.segment !== "loyal" && !client.inVipGroup) {
          return false;
        }
      }

      // 2. Filtro de Busca Instantânea
      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        const qDigits = q.replace(/\D/g, "");
        const matchName = matchesVisualSearch(client.name, q);
        const matchPhone = qDigits
          ? (client.cleanPhone || client.phone || "").replace(/\D/g, "").includes(qDigits)
          : false;
        const matchProduct = matchesVisualSearch(client.lastProduct, q);
        const matchFlavor = matchesVisualSearch(client.lastFlavor, q);
        const matchAddress = matchesVisualSearch(client.address, q);

        if (!matchName && !matchPhone && !matchProduct && !matchFlavor && !matchAddress) {
          return false;
        }
      }

      return true;
    });
  }, [clients, activeFilter, searchQuery]);

  // Filtragem das Vendas
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (!sale) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (sale.client_name || "").toLowerCase().includes(q);
        const matchPhone = (sale.clean_phone || "").includes(q) || (sale.client_phone || "").includes(q);
        const matchCode = (sale.order_code || "").toLowerCase().includes(q);
        const matchItem =
          Array.isArray(sale.items) &&
          sale.items.some(
            (i) => (i.name || "").toLowerCase().includes(q) || (i.flavor || "").toLowerCase().includes(q)
          );

        if (!matchName && !matchPhone && !matchCode && !matchItem) return false;
      }

      return true;
    });
  }, [sales, searchQuery]);

  // Formatação amigável de data
  const formatFriendlyDate = (isoString?: string | null): string => {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Hoje às ${timeStr}`;
    if (isYesterday) return `Ontem às ${timeStr}`;
    return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${timeStr}`;
  };

  // Disparo de Alerta de Recompra com Trava Anti-Duplo Clique
  const handleSendReplenishmentAlert = async (client: RealClient) => {
    if (!client.id || submittingAlerts.has(client.id)) return;

    // Trava de estado imediata
    setSubmittingAlerts((prev) => new Set(prev).add(client.id));

    try {
      // 1. Registra no banco persistente
      const res = await recordReplenishmentAlert({
        clientId: client.id,
        companyId,
      });

      if (res.success && res.timestamp) {
        // Atualiza estado local imediatamente
        setClients((prev) =>
          prev.map((c) => (c.id === client.id ? { ...c, lastReplenishmentAlertAt: res.timestamp } : c))
        );
        if (selectedClientForSheet?.id === client.id) {
          setSelectedClientForSheet((prev) =>
            prev ? { ...prev, lastReplenishmentAlertAt: res.timestamp } : prev
          );
        }
      }

      // 2. Abre conversa no WhatsApp
      const cleanPhone = (client.cleanPhone || client.phone || "").replace(/\D/g, "");
      const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      const url =
        client.whatsappUrl ||
        `https://wa.me/${fullPhone}?text=${encodeURIComponent(
          client.whatsappMessage || `Fala ${client.name.split(" ")[0]}! Tudo certo? Passando aqui da loja!`
        )}`;

      window.open(url, "_blank");
    } catch (err) {
      console.error("[MobileCRMView] Falha ao enviar aviso de recompra:", err);
    } finally {
      setSubmittingAlerts((prev) => {
        const next = new Set(prev);
        next.delete(client.id);
        return next;
      });
    }
  };

  // Salvar Edição Básica de Cliente no Bottom Sheet
  const handleSaveClientData = async () => {
    if (!selectedClientForSheet) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError("O nome do cliente não pode ficar em branco.");
      return;
    }

    setIsSavingClient(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      const res = await updateBasicClientData({
        clientId: selectedClientForSheet.id,
        name: trimmedName,
        phone: editPhone,
        companyId,
      });

      if (res.success) {
        const newPhoneDisplay = formatPhoneForDisplay(res.savedPhone);
        const newClean = res.savedPhone ? res.savedPhone.replace(/\D/g, "") : "";

        const updatedObj: RealClient = {
          ...selectedClientForSheet,
          name: res.savedName || trimmedName,
          phone: newPhoneDisplay,
          cleanPhone: newClean,
        };

        setSelectedClientForSheet(updatedObj);
        setClients((prev) => prev.map((c) => (c.id === updatedObj.id ? updatedObj : c)));
        setEditSuccess("Cadastro atualizado com sucesso!");

        setTimeout(() => {
          setIsEditingClient(false);
          setEditSuccess(null);
        }, 1200);
      } else {
        setEditError(res.error || "Erro ao salvar alterações no banco.");
      }
    } catch (err: any) {
      setEditError(err?.message || "Erro inesperado ao salvar cliente.");
    } finally {
      setIsSavingClient(false);
    }
  };

  // Excluir Pedido com Restauração de Estoque Garantida
  const handleDeleteOrderFromSheet = async (orderId: string) => {
    if (
      !confirm(
        "Deseja realmente excluir este pedido do histórico? O estoque dos itens vendidos será restaurado."
      )
    ) {
      return;
    }

    try {
      const res = await deleteOrderWithStockRestoration(orderId, {
        restoreStock: true,
        companyId,
      });

      if (res.success) {
        alert("✅ Pedido excluído com sucesso e estoque devolvido.");
        await loadCRMData();

        // Atualiza a Ficha atual
        if (selectedClientForSheet) {
          const updatedOrders = (selectedClientForSheet.orders || []).filter((o) => o.id !== orderId);
          setSelectedClientForSheet({
            ...selectedClientForSheet,
            orders: updatedOrders,
            ordersCount: Math.max(0, selectedClientForSheet.ordersCount - 1),
          });
        }
      } else {
        alert("Erro ao excluir pedido: " + (res.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      alert("Erro ao excluir pedido: " + err.message);
    }
  };

  // Excluir Venda da Aba de Últimas Vendas
  const handleDeleteSale = async (sale: DetailedSale) => {
    if (
      !confirm(
        `Deseja realmente excluir a venda #${sale.order_code || sale.id.slice(0, 8)} de ${
          sale.client_name
        } (${formatBRL(sale.total_amount)})? O estoque será devolvido.`
      )
    ) {
      return;
    }

    try {
      const res = await deleteOrderWithStockRestoration(sale.id, {
        restoreStock: true,
        companyId,
      });

      if (res.success) {
        alert("✅ Venda excluída com sucesso e estoque devolvido.");
        setSelectedSaleForSheet(null);
        await loadCRMData();
      } else {
        alert("Erro ao excluir venda: " + (res.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      alert("Erro ao excluir venda: " + err.message);
    }
  };

  // Excluir Cliente do CRM
  const handleDeleteClientRecord = async (client: RealClient) => {
    if (!confirm(`Deseja realmente remover o cliente "${client.name}" do cadastro do CRM?`)) {
      return;
    }

    try {
      const res = await deleteClientRecord(client.id, companyId);
      if (res.success) {
        alert("✅ Cliente removido do CRM.");
        setSelectedClientForSheet(null);
        await loadCRMData();
      } else {
        alert("Erro ao remover cliente: " + (res.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      alert("Erro ao remover cliente: " + err.message);
    }
  };

  // Copiar resumo de venda
  const handleCopySaleSummary = (sale: DetailedSale) => {
    const itemsText = (sale.items || [])
      .map(
        (i) =>
          `• ${i.quantity}x ${i.name || "Produto"} ${i.flavor || ""} (${formatBRL(
            (i.price || 0) * (i.quantity || 1)
          )})`
      )
      .join("\n");

    const text =
      `*Resumo do Pedido*\n` +
      `📅 Data: ${formatFriendlyDate(sale.created_at)}\n` +
      `👤 Cliente: ${sale.client_name}\n` +
      `📱 Telefone: ${sale.client_phone}\n` +
      `📍 Endereço: ${sale.address || "Não informado"}\n\n` +
      `*Itens:*\n${itemsText}\n\n` +
      `💰 *Total Pago:* ${formatBRL(sale.total_amount)}\n` +
      `🚚 Status: ${sale.delivery_status}`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#070709] text-white select-none overflow-hidden">
      {/* ========================================================
          1. HEADER COMPACTO MOBILE COM STATUS REALTIME
         ======================================================== */}
      <header className="shrink-0 bg-[#0c0c0f] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Users className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight truncate">
                CRM de Clientes
              </h1>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full shrink-0">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wider">
                  Ao Vivo
                </span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium leading-none mt-0.5">
              {clients.length} {clients.length === 1 ? "cliente" : "clientes"} no sistema
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadCRMData(true)}
            disabled={isRefreshing}
            className="size-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            aria-label="Atualizar dados do CRM"
            title="Recarregar"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
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
            placeholder={
              activeFilter === "vendas"
                ? "Buscar venda por cliente, produto ou fone..."
                : "Buscar por nome, telefone ou produto..."
            }
            className="w-full h-11 pl-10 pr-9 rounded-xl bg-black/60 border border-white/10 text-white placeholder:text-zinc-500 text-base focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 size-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-white"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          3. BARRA HORIZONTAL DESLIZANTE DE FILTROS (PILLS COM SCROLL X)
          ======================================================== */}
      <div className="shrink-0 bg-[#0c0c0f] border-b border-white/10 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        {/* Pill 1: Todos */}
        <button
          type="button"
          onClick={() => setActiveFilter("todos")}
          className={`shrink-0 min-h-[44px] px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            activeFilter === "todos"
              ? "bg-white text-black border-white shadow-sm font-extrabold"
              : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
          }`}
        >
          <Users className="size-3.5 shrink-0" />
          <span>Todos</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
              activeFilter === "todos" ? "bg-black/15 text-black" : "bg-white/10 text-zinc-300"
            }`}
          >
            {counters.total}
          </span>
        </button>

        {/* Pill 2: Recompra */}
        <button
          type="button"
          onClick={() => setActiveFilter("recompra")}
          className={`shrink-0 min-h-[44px] px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            activeFilter === "recompra"
              ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.2)] font-extrabold"
              : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
          }`}
        >
          <Flame className="size-3.5 text-rose-400 shrink-0" />
          <span>Recompra</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
              activeFilter === "recompra" ? "bg-rose-500/30 text-rose-200" : "bg-white/10 text-zinc-300"
            }`}
          >
            {counters.endingSoon}
          </span>
        </button>

        {/* Pill 3: VIP & Fiéis */}
        <button
          type="button"
          onClick={() => setActiveFilter("vip")}
          className={`shrink-0 min-h-[44px] px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            activeFilter === "vip"
              ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-extrabold"
              : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
          }`}
        >
          <Crown className="size-3.5 text-amber-400 shrink-0" />
          <span>VIP & Fiéis</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
              activeFilter === "vip" ? "bg-amber-500/30 text-amber-200" : "bg-white/10 text-zinc-300"
            }`}
          >
            {counters.vips}
          </span>
        </button>

        {/* Pill 4: Últimas Vendas */}
        <button
          type="button"
          onClick={() => setActiveFilter("vendas")}
          className={`shrink-0 min-h-[44px] px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            activeFilter === "vendas"
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)] font-extrabold"
              : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
          }`}
        >
          <Receipt className="size-3.5 text-emerald-400 shrink-0" />
          <span>Últimas Vendas</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
              activeFilter === "vendas" ? "bg-emerald-500/30 text-emerald-200" : "bg-white/10 text-zinc-300"
            }`}
          >
            {counters.totalSales}
          </span>
        </button>
      </div>

      {/* ========================================================
          4. CONTEÚDO PRINCIPAL (LISTA VERTICAL SCROLLÁVEL)
         ======================================================== */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 pb-32 custom-scrollbar">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400 text-xs">
            <Loader2 className="size-8 animate-spin text-emerald-400" />
            <span className="font-semibold tracking-wide">Carregando Inteligência do CRM...</span>
          </div>
        ) : activeFilter !== "vendas" ? (
          /* ====================================================
             LISTA DE CLIENTES (PRIMEIRA DOBRA IMEDIATA)
             ==================================================== */
          filteredClients.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-[#0d0d11] border border-white/5 rounded-2xl p-6">
              <Users className="size-10 text-zinc-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Nenhum cliente encontrado</p>
                <p className="text-xs text-zinc-400">
                  {searchQuery
                    ? "Tente buscar por outro termo ou limpe a busca."
                    : "Nenhum cliente registrado nesta categoria."}
                </p>
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  Limpar Busca
                </button>
              )}
            </div>
          ) : (
            filteredClients.map((client) => {
              const cleanPhone = (client.cleanPhone || client.phone || "").replace(/\D/g, "");
              const isAlertSent = Boolean(client.lastReplenishmentAlertAt);
              const isUrgent = client.urgencyLevel === "urgent";
              const isWarning = client.urgencyLevel === "warning";
              const isVip = client.segment === "champion" || client.segment === "loyal" || client.inVipGroup;

              return (
                <div
                  key={client.id}
                  onClick={() => {
                    setSelectedClientForSheet(client);
                    setIsEditingClient(false);
                    setEditName(client.name);
                    setEditPhone(cleanPhone || client.phone || "");
                    setEditError(null);
                    setEditSuccess(null);
                  }}
                  className="bg-[#0e0e12] border border-white/10 hover:border-white/20 rounded-2xl p-3.5 space-y-3 active:scale-[0.99] transition-all cursor-pointer shadow-md"
                >
                  {/* Linha 1: Nome + Badges de Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-extrabold text-white truncate">
                          {client.name || "Cliente"}
                        </span>
                        {isVip && (
                          <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/35 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                            VIP
                          </span>
                        )}
                        {isUrgent ? (
                          <span className="text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/35 px-1.5 py-0.5 rounded-full uppercase shrink-0 flex items-center gap-1">
                            <Flame className="size-2.5" /> Recompra Urgente
                          </span>
                        ) : isWarning ? (
                          <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/35 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                            Secando
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                            Em Uso
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                        Último: <strong className="text-zinc-200">{client.lastProduct || "Produto"}</strong>
                        {client.lastFlavor ? ` • ${client.lastFlavor}` : ""}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-emerald-400 font-mono">
                        {formatBRL(client.spent)}
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {client.ordersCount} {client.ordersCount === 1 ? "compra" : "compras"}
                      </span>
                    </div>
                  </div>

                  {/* Linha 2: Indicadores de Tempo & Aviso Enviado */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-white/5">
                    <span>
                      Última compra há{" "}
                      <strong className="text-zinc-200">{client.daysSinceLastOrder} dias</strong>
                    </span>
                    {isAlertSent && (
                      <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="size-3" /> Aviso enviado
                      </span>
                    )}
                  </div>

                  {/* Linha 3: Ações com Touch Target >= 44px */}
                  <div className="pt-1 flex items-center gap-2">
                    {cleanPhone && !client.phone.includes("Instagram") && !client.phone.startsWith("INSTA_") ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendReplenishmentAlert(client);
                        }}
                        disabled={submittingAlerts.has(client.id)}
                        className="flex-1 min-h-[44px] px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                      >
                        <MessageSquare className="size-4" />
                        <span>
                          {submittingAlerts.has(client.id)
                            ? "Enviando..."
                            : isUrgent
                            ? "Aviso de Recompra"
                            : "WhatsApp"}
                        </span>
                      </button>
                    ) : (
                      <div className="flex-1 min-h-[44px] px-3 rounded-xl bg-white/5 border border-white/10 text-zinc-500 text-xs font-medium flex items-center justify-center gap-2">
                        <Phone className="size-3.5 opacity-50" />
                        <span>Sem WhatsApp</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClientForSheet(client);
                        setIsEditingClient(false);
                        setEditName(client.name);
                        setEditPhone(cleanPhone || client.phone || "");
                        setEditError(null);
                        setEditSuccess(null);
                      }}
                      className="min-h-[44px] px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <Eye className="size-4" />
                      <span>Ficha</span>
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* ====================================================
             LISTA DE ÚLTIMAS VENDAS
             ==================================================== */
          filteredSales.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-[#0d0d11] border border-white/5 rounded-2xl p-6">
              <Receipt className="size-10 text-zinc-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Nenhuma venda encontrada</p>
                <p className="text-xs text-zinc-400">Não há registros de vendas recentes para este filtro.</p>
              </div>
            </div>
          ) : (
            filteredSales.slice(0, 50).map((sale) => (
              <div
                key={sale.id}
                onClick={() => setSelectedSaleForSheet(sale)}
                className="bg-[#0e0e12] border border-white/10 hover:border-white/20 rounded-2xl p-3.5 space-y-2.5 active:scale-[0.99] transition-all cursor-pointer shadow-md"
              >
                {/* Linha 1: Cliente + Horário + Valor */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-extrabold text-white truncate">
                        {sale.client_name || "Cliente"}
                      </span>
                      {sale.is_vip && (
                        <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/35 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                          VIP
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <Clock className="size-3 text-zinc-500 shrink-0" />
                      <span>{formatFriendlyDate(sale.created_at)}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {sale.order_code || `#${sale.id.slice(0, 6)}`}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-black text-emerald-400 font-mono">
                      {formatBRL(sale.total_amount)}
                    </div>
                    <span className="text-[9.5px] text-zinc-500 font-mono uppercase">
                      {sale.payment_method || "PIX"}
                    </span>
                  </div>
                </div>

                {/* Linha 2: Itens Comprados */}
                <div className="flex flex-wrap gap-1.5">
                  {(sale.items || []).map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 bg-white/[0.04] border border-white/10 text-[11px] px-2.5 py-1 rounded-xl text-zinc-200 font-medium"
                    >
                      <strong className="text-emerald-400 font-mono">{item.quantity}x</strong>
                      <span className="truncate max-w-[130px]">{item.name || "Produto"}</span>
                      {item.flavor && (
                        <span className="text-amber-300 font-semibold truncate max-w-[110px]">
                          • {item.flavor}
                        </span>
                      )}
                    </span>
                  ))}
                </div>

                {/* Linha 3: Status + Ações com min-h-[44px] */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      sale.delivery_status === "CONCLUIDO"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : sale.delivery_status === "CANCELADO"
                        ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {sale.delivery_status || "PREPARANDO"}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSaleForSheet(sale);
                      }}
                      className="min-h-[44px] px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    >
                      <Eye className="size-3.5" />
                      <span>Raio-X</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSale(sale);
                      }}
                      className="min-h-[44px] px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                      title="Excluir Venda (Devolver ao Estoque)"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </main>

      {/* ========================================================
          5. BOTTOM SHEET: FICHA 360º DO CLIENTE
         ======================================================== */}
      {selectedClientForSheet && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200">
          <div className="flex-1" onClick={() => setSelectedClientForSheet(null)} />

          <div
            className="w-full bg-[#0d0d12] border-t border-white/15 rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra de Arraste Superior */}
            <div className="w-full pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </div>

            {/* Cabeçalho da Ficha */}
            <header className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#111116]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold text-base shrink-0">
                  {(selectedClientForSheet.name || "C").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base font-extrabold text-white truncate">
                      {selectedClientForSheet.name}
                    </h2>
                    {(selectedClientForSheet.segment === "champion" ||
                      selectedClientForSheet.inVipGroup) && (
                      <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                        VIP
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">
                    {selectedClientForSheet.phone || "Sem telefone"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedClientForSheet(null)}
                className="size-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </header>

            {/* Conteúdo Rolável da Ficha */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {/* Formulário de Edição Básica de Cadastro */}
              {isEditingClient ? (
                <div className="bg-[#14141a] border border-amber-500/30 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Edit2 className="size-3.5" /> Editar Cadastro
                    </h3>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      ID: {selectedClientForSheet.id.slice(0, 8)}
                    </span>
                  </div>

                  {editError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
                      {editError}
                    </div>
                  )}

                  {editSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 flex items-center gap-1.5">
                      <Check className="size-3.5" />
                      <span>{editSuccess}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                        Nome do Cliente
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nome completo"
                        className="w-full h-11 px-3.5 rounded-xl bg-black/60 border border-white/15 text-white text-base focus:outline-none focus:border-amber-400/50"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                        Telefone (WhatsApp)
                      </label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="11999999999"
                        className="w-full h-11 px-3.5 rounded-xl bg-black/60 border border-white/15 text-white text-base focus:outline-none focus:border-amber-400/50 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isSavingClient}
                      onClick={() => setIsEditingClient(false)}
                      className="min-h-[44px] px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-zinc-300"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      disabled={isSavingClient}
                      onClick={handleSaveClientData}
                      className="min-h-[44px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5 shadow-md disabled:opacity-50"
                    >
                      {isSavingClient ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin text-black" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <span>Salvar</span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-[#14141a] border border-white/5 rounded-2xl p-3.5">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                      Identidade Cadastral
                    </span>
                    <p className="text-xs font-bold text-white mt-0.5 truncate">
                      {selectedClientForSheet.name}
                    </p>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      {selectedClientForSheet.phone || "Sem telefone"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingClient(true);
                      setEditName(selectedClientForSheet.name);
                      setEditPhone(
                        selectedClientForSheet.cleanPhone || selectedClientForSheet.phone || ""
                      );
                    }}
                    className="min-h-[44px] px-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Edit2 className="size-3.5" />
                    <span>Editar</span>
                  </button>
                </div>
              )}

              {/* Endereço de Entrega */}
              <div className="bg-[#14141a] border border-white/5 rounded-2xl p-3.5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-1">
                  <MapPin className="size-3 text-emerald-400" /> Endereço de Entrega
                </span>
                <p className="text-xs text-zinc-200">
                  {selectedClientForSheet.address || "Endereço não informado"}
                </p>
              </div>

              {/* Resumo Financeiro & Ciclo */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#14141a] border border-white/5 rounded-2xl p-3 text-center">
                  <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">
                    LTV Total
                  </span>
                  <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
                    {formatBRL(selectedClientForSheet.spent)}
                  </div>
                </div>

                <div className="bg-[#14141a] border border-white/5 rounded-2xl p-3 text-center">
                  <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">
                    Compras
                  </span>
                  <div className="text-sm font-black text-white mt-0.5">
                    {selectedClientForSheet.ordersCount} un
                  </div>
                </div>

                <div className="bg-[#14141a] border border-white/5 rounded-2xl p-3 text-center">
                  <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">
                    Última Compra
                  </span>
                  <div className="text-sm font-black text-amber-400 mt-0.5">
                    há {selectedClientForSheet.daysSinceLastOrder}d
                  </div>
                </div>
              </div>

              {/* Ações Rápidas de Disparo WhatsApp */}
              <div className="bg-[#14141a] border border-white/5 rounded-2xl p-4 space-y-3">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <Send className="size-3.5 text-emerald-400" /> Disparos Rápidos de WhatsApp
                </span>

                <div className="space-y-2">
                  {/* Botão Principal: Aviso de Recompra Inteligente */}
                  <button
                    type="button"
                    onClick={() => handleSendReplenishmentAlert(selectedClientForSheet)}
                    disabled={submittingAlerts.has(selectedClientForSheet.id)}
                    className="w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.25)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <MessageSquare className="size-4 text-black" />
                    <span>
                      {submittingAlerts.has(selectedClientForSheet.id)
                        ? "Registrando..."
                        : "Aviso de Recompra"}
                    </span>
                  </button>

                  {/* Templates Adicionais */}
                  {(() => {
                    const cleanP = (
                      selectedClientForSheet.cleanPhone ||
                      selectedClientForSheet.phone ||
                      ""
                    ).replace(/\D/g, "");
                    const fullP = cleanP.startsWith("55") ? cleanP : `55${cleanP}`;
                    const fName = selectedClientForSheet.name.split(" ")[0];

                    const copyLembrete = `E aí ${fName}! Tudo certo? Vi que já faz um tempinho desde a sua última compra de ${selectedClientForSheet.lastProduct}. Já quer ir garantindo a reposição para não ficar sem?`;
                    const copyGrupoVip = `Fala ${fName}! Tranquilo? Criamos o nosso Grupo VIP Fechado no WhatsApp com novidades e descontos exclusivos. Se quiser entrar: [LINK_DO_GRUPO]`;

                    return (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <a
                          href={`https://wa.me/${fullP}?text=${encodeURIComponent(copyLembrete)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[44px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-zinc-300 flex items-center justify-center text-center transition-all"
                        >
                          Lembrete de Recompra
                        </a>

                        <a
                          href={`https://wa.me/${fullP}?text=${encodeURIComponent(copyGrupoVip)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[44px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-zinc-300 flex items-center justify-center text-center transition-all"
                        >
                          Convite Grupo VIP
                        </a>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Histórico Real de Compras do Cliente */}
              <div className="space-y-2.5">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="size-3.5 text-emerald-400" /> Histórico de Compras (
                  {(selectedClientForSheet.orders || []).length})
                </span>

                {(selectedClientForSheet.orders || []).length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#14141a] border border-white/5 text-center text-xs text-zinc-500">
                    Nenhum pedido atribuído a este cliente.
                  </div>
                ) : (
                  (selectedClientForSheet.orders || []).map((order) => {
                    const items: any[] = Array.isArray(order.items) ? order.items : [];

                    return (
                      <div
                        key={order.id}
                        className="bg-[#14141a] border border-white/5 rounded-2xl p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                            <Calendar className="size-3 text-zinc-500" />
                            {formatFriendlyDate(order.created_at)}
                          </span>

                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              {order.delivery_status || "CONCLUIDO"}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleDeleteOrderFromSheet(order.id)}
                              className="size-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-all cursor-pointer"
                              title="Excluir este pedido e devolver estoque"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-xs text-zinc-200">
                          {items
                            .map((i) => `${i.quantity || 1}x ${i.name || "Produto"} ${i.flavor || ""}`)
                            .join(", ") || "1x Produto"}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/5 font-mono">
                          <span className="text-zinc-500 text-[10px] uppercase">Total Pago</span>
                          <span className="font-bold text-white">
                            {formatBRL(parseFloat(order.total_amount || 0))}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Zona de Perigo: Excluir Cliente */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleDeleteClientRecord(selectedClientForSheet)}
                  className="w-full min-h-[44px] rounded-xl bg-rose-500/10 hover:bg-rose-500/15 text-rose-400 border border-rose-500/20 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="size-4" />
                  <span>Excluir Cadastro do Cliente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          6. BOTTOM SHEET: RAIO-X DA VENDA
         ======================================================== */}
      {selectedSaleForSheet && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200">
          <div className="flex-1" onClick={() => setSelectedSaleForSheet(null)} />

          <div
            className="w-full bg-[#0d0d12] border-t border-white/15 rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra de Arraste Superior */}
            <div className="w-full pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </div>

            {/* Cabeçalho do Raio-X */}
            <header className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#111116]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold shrink-0">
                  <Receipt className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-white truncate">
                    Raio-X da Venda {selectedSaleForSheet.order_code || `#${selectedSaleForSheet.id.slice(0, 6)}`}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {formatFriendlyDate(selectedSaleForSheet.created_at)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSaleForSheet(null)}
                className="size-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </header>

            {/* Conteúdo Rolável do Raio-X */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {/* Card do Comprador */}
              <div className="bg-[#14141a] border border-white/5 rounded-2xl p-4 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  Comprador
                </span>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold text-white">
                    {selectedSaleForSheet.client_name}
                  </p>
                  {selectedSaleForSheet.clean_phone && (
                    <a
                      href={`https://wa.me/${
                        selectedSaleForSheet.clean_phone.startsWith("55")
                          ? selectedSaleForSheet.clean_phone
                          : `55${selectedSaleForSheet.clean_phone}`
                      }`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5"
                    >
                      <MessageSquare className="size-3.5" /> WhatsApp
                    </a>
                  )}
                </div>
                <p className="text-xs text-zinc-400 font-mono">
                  {selectedSaleForSheet.client_phone || "Sem telefone"}
                </p>
                {selectedSaleForSheet.address && (
                  <p className="text-xs text-zinc-300 pt-1 border-t border-white/5 flex items-start gap-1.5">
                    <MapPin className="size-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{selectedSaleForSheet.address}</span>
                  </p>
                )}
              </div>

              {/* Itens Comprados */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Itens da Venda
                </span>

                <div className="space-y-2">
                  {(selectedSaleForSheet.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-[#14141a] border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white truncate">
                          {item.quantity}x {item.name || "Produto"}
                        </div>
                        {item.flavor && (
                          <div className="text-amber-300 text-[11px] font-medium truncate">
                            {item.flavor}
                          </div>
                        )}
                      </div>

                      <div className="text-right font-mono font-bold text-emerald-400 shrink-0 ml-3">
                        {formatBRL((item.price || 0) * (item.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total e Pagamento */}
              <div className="bg-[#14141a] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Forma de Pagamento
                  </span>
                  <p className="text-xs font-bold text-white uppercase mt-0.5">
                    {selectedSaleForSheet.payment_method || "PIX"}
                  </p>
                </div>

                <div className="text-right font-mono">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Total Pago
                  </span>
                  <div className="text-lg font-black text-emerald-400">
                    {formatBRL(selectedSaleForSheet.total_amount)}
                  </div>
                </div>
              </div>

              {/* Ações: Copiar Resumo e Excluir */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopySaleSummary(selectedSaleForSheet)}
                  className="w-full min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  {copiedSummary ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                  <span>{copiedSummary ? "Copiado para a área de transferência!" : "Copiar Resumo da Venda"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteSale(selectedSaleForSheet)}
                  className="w-full min-h-[44px] rounded-xl bg-rose-500/10 hover:bg-rose-500/15 text-rose-400 border border-rose-500/20 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="size-4" />
                  <span>Excluir Venda (Devolver ao Estoque)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
