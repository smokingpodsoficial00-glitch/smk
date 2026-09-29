import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  ShoppingCart,
  Receipt,
  Clock,
  Calendar,
  Search,
  MessageSquare,
  Eye,
  Trash2,
  Crown,
  Flame,
  MapPin,
  CreditCard,
  Loader2,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { fetchSalesHistory, type DetailedSale } from "@/lib/salesHistory";
import { fetchLiveClients, type RealClient } from "@/lib/crm";
import { supabase } from "@/lib/supabase";
import { deleteOrderWithStockRestoration } from "@/lib/orders";
import { SaleDetailModal } from "./SaleDetailModal";

interface MobileCRMViewProps {
  companyId?: string;
  refreshKey: number;
  onOpenManualSale: () => void;
  onSelectClient: (client: RealClient) => void;
}

export function MobileCRMView({
  companyId,
  refreshKey,
  onOpenManualSale,
  onSelectClient,
}: MobileCRMViewProps) {
  const [sales, setSales] = useState<DetailedSale[]>([]);
  const [clients, setClients] = useState<RealClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Visão ativa no CRM Mobile: 'vendas' (Últimas Vendas) | 'clientes' (Base Simplificada)
  const [activeSection, setActiveSection] = useState<"vendas" | "clientes">("vendas");

  // Filtros rápidos de vendas
  const [salesPeriod, setSalesPeriod] = useState<"all" | "24h" | "3d" | "7d">("all");
  const [clientFilter, setClientFilter] = useState<"all" | "recompra" | "vip">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal de detalhe de venda
  const [selectedSale, setSelectedSale] = useState<DetailedSale | null>(null);

  const loadMobileCRMData = async () => {
    try {
      const [salesData, liveClients] = await Promise.all([
        fetchSalesHistory(companyId),
        fetchLiveClients(companyId),
      ]);
      setSales(Array.isArray(salesData?.sales) ? salesData.sales : []);
      setClients(Array.isArray(liveClients) ? liveClients : []);
    } catch (err) {
      console.error("Erro ao carregar CRM Mobile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMobileCRMData();

    const channel = supabase
      .channel("mobile_crm_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_orders" }, loadMobileCRMData)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_clients" }, loadMobileCRMData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, refreshKey]);

  // Cálculo em tempo real: Resumo das Últimas 24 Horas e Últimos 3 Dias
  const shortTermSummary = useMemo(() => {
    const now = Date.now();
    const ms24h = 24 * 60 * 60 * 1000;
    const ms3d = 3 * 24 * 60 * 60 * 1000;

    let rev24h = 0;
    let orders24h = 0;
    let pods24h = 0;

    let rev3d = 0;
    let orders3d = 0;
    let pods3d = 0;

    for (const sale of sales) {
      if (sale.delivery_status === "CANCELADO") continue;
      const saleTime = new Date(sale.created_at).getTime();
      const amount = Number(sale.total_amount) || 0;
      const podsCount = Array.isArray(sale.items)
        ? sale.items.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0)
        : 1;

      if (saleTime >= now - ms24h) {
        rev24h += amount;
        orders24h += 1;
        pods24h += podsCount;
      }

      if (saleTime >= now - ms3d) {
        rev3d += amount;
        orders3d += 1;
        pods3d += podsCount;
      }
    }

    const ticket24h = orders24h > 0 ? rev24h / orders24h : 0;
    const dailyAvg3d = rev3d / 3;

    return {
      rev24h,
      orders24h,
      pods24h,
      ticket24h,
      rev3d,
      orders3d,
      pods3d,
      dailyAvg3d,
    };
  }, [sales]);

  // Indicadores rápidos da base de clientes
  const clientCounters = useMemo(() => {
    const total = clients.length;
    const vipCount = clients.filter(
      (c) => c && (c.segment === "champion" || c.segment === "loyal" || c.inVipGroup)
    ).length;
    const endingSoonCount = clients.filter(
      (c) => c && (c.isEndingSoon || c.urgencyLevel === "urgent" || c.urgencyLevel === "warning")
    ).length;
    return { total, vipCount, endingSoonCount };
  }, [clients]);

  // Filtragem das Últimas Vendas
  const filteredSales = useMemo(() => {
    const now = Date.now();
    return sales.filter((sale) => {
      const saleTime = new Date(sale.created_at).getTime();

      if (salesPeriod === "24h" && saleTime < now - 24 * 60 * 60 * 1000) return false;
      if (salesPeriod === "3d" && saleTime < now - 3 * 24 * 60 * 60 * 1000) return false;
      if (salesPeriod === "7d" && saleTime < now - 7 * 24 * 60 * 60 * 1000) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (sale.client_name || "").toLowerCase().includes(q);
        const matchPhone = (sale.clean_phone || "").includes(q) || (sale.client_phone || "").includes(q);
        const matchCode = (sale.order_code || "").toLowerCase().includes(q);
        const matchItem = Array.isArray(sale.items) && sale.items.some(
          (i) =>
            (i.name || "").toLowerCase().includes(q) ||
            (i.flavor || "").toLowerCase().includes(q)
        );
        if (!matchName && !matchPhone && !matchCode && !matchItem) return false;
      }

      return true;
    });
  }, [sales, salesPeriod, searchQuery]);

  // Filtragem dos Clientes Simplificados
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (!client) return false;

      if (clientFilter === "recompra") {
        if (!client.isEndingSoon && client.urgencyLevel !== "urgent" && client.urgencyLevel !== "warning") {
          return false;
        }
      } else if (clientFilter === "vip") {
        if (client.segment !== "champion" && client.segment !== "loyal" && !client.inVipGroup) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (client.name || "").toLowerCase().includes(q);
        const matchPhone = (client.cleanPhone || "").includes(q) || (client.phone || "").includes(q);
        const matchProduct = (client.lastProduct || "").toLowerCase().includes(q);
        const matchFlavor = (client.lastFlavor || "").toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchProduct && !matchFlavor) return false;
      }

      return true;
    });
  }, [clients, clientFilter, searchQuery]);

  const handleDeleteSale = async (sale: DetailedSale) => {
    if (
      confirm(
        `Deseja excluir a venda ${sale.order_code || ""} de ${sale.client_name} (${formatBRL(
          sale.total_amount
        )})? O estoque será devolvido.`
      )
    ) {
      try {
        const res = await deleteOrderWithStockRestoration(sale.id, { restoreStock: true });
        if (res.success) {
          loadMobileCRMData();
        } else {
          alert("Erro ao excluir venda: " + (res.error || "Erro desconhecido"));
        }
      } catch (err: any) {
        alert("Erro ao excluir venda: " + err.message);
      }
    }
  };

  const formatFriendlyDate = (isoString: string) => {
    const d = new Date(isoString);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Hoje às ${timeStr}`;
    if (isYesterday) return `Ontem às ${timeStr}`;
    return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${timeStr}`;
  };

  const buildWhatsAppLink = (phone: string, clientName: string) => {
    const clean = String(phone || "").replace(/\D/g, "");
    if (!clean) return "#";
    const fullPhone = clean.startsWith("55") ? clean : `55${clean}`;
    const firstName = (clientName || "Cliente").split(" ")[0];
    const text = encodeURIComponent(`Fala ${firstName}, tudo certo? Passando aqui da loja!`);
    return `https://wa.me/${fullPhone}?text=${text}`;
  };

  return (
    <div className="space-y-5 pb-10">
      {/* ━━━ CABEÇALHO COMPACTO MOBILE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
        <div>
          <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <Users className="size-5 text-emerald-400 shrink-0" />
            <span>CRM & Últimas Vendas</span>
          </h1>
          <p className="text-[11px] text-white/50 mt-0.5">
            Resumo de 24h, últimos 3 dias e histórico em tempo real
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenManualSale}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] cursor-pointer active:scale-95 shrink-0"
        >
          <ShoppingCart className="size-3.5 text-black stroke-[2.5]" />
          <span>+ Venda</span>
        </button>
      </div>

      {/* ━━━ BLOCO 1 (TOPO): RESUMO DAS ÚLTIMAS 24 HORAS & ÚLTIMOS 3 DIAS ━━━ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-amber-400" />
            <span>Termômetro de Curto Prazo</span>
          </span>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            Tempo Real
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Card 1: Resumo das Últimas 24 Horas */}
          <div
            onClick={() => {
              setActiveSection("vendas");
              setSalesPeriod(salesPeriod === "24h" ? "all" : "24h");
            }}
            className={`rounded-2xl p-3.5 space-y-2 border transition-all cursor-pointer relative overflow-hidden ${
              salesPeriod === "24h" && activeSection === "vendas"
                ? "bg-emerald-500/15 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                : "bg-gradient-to-b from-emerald-500/10 to-[#0e0e10] border-emerald-500/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Clock className="size-3 shrink-0" />
                <span>Últimas 24 Horas</span>
              </span>
            </div>

            <div>
              <div className="text-xl font-black text-white tracking-tight">
                {formatBRL(shortTermSummary.rev24h)}
              </div>
              <p className="text-[11px] font-bold text-emerald-300 mt-0.5">
                {shortTermSummary.orders24h} {shortTermSummary.orders24h === 1 ? "venda" : "vendas"} · {shortTermSummary.pods24h} pods
              </p>
            </div>

            <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50">
              <span>Ticket 24h:</span>
              <span className="font-bold text-white/80">{formatBRL(shortTermSummary.ticket24h)}</span>
            </div>
          </div>

          {/* Card 2: Resumo dos Últimos 3 Dias */}
          <div
            onClick={() => {
              setActiveSection("vendas");
              setSalesPeriod(salesPeriod === "3d" ? "all" : "3d");
            }}
            className={`rounded-2xl p-3.5 space-y-2 border transition-all cursor-pointer relative overflow-hidden ${
              salesPeriod === "3d" && activeSection === "vendas"
                ? "bg-amber-500/15 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                : "bg-gradient-to-b from-amber-500/10 to-[#0e0e10] border-amber-500/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Calendar className="size-3 shrink-0" />
                <span>Últimos 3 Dias</span>
              </span>
            </div>

            <div>
              <div className="text-xl font-black text-white tracking-tight">
                {formatBRL(shortTermSummary.rev3d)}
              </div>
              <p className="text-[11px] font-bold text-amber-300 mt-0.5">
                {shortTermSummary.orders3d} {shortTermSummary.orders3d === 1 ? "venda" : "vendas"} · {shortTermSummary.pods3d} pods
              </p>
            </div>

            <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50">
              <span>Média/dia:</span>
              <span className="font-bold text-white/80">{formatBRL(shortTermSummary.dailyAvg3d)}</span>
            </div>
          </div>
        </div>

        {/* Faixa Compacta: Base de Clientes (3 Pílulas Rápidas) */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveSection("clientes");
              setClientFilter("all");
            }}
            className="bg-[#0e0e10] border border-white/10 rounded-xl px-2.5 py-2 flex flex-col items-center justify-center text-center active:scale-95 transition-all"
          >
            <span className="text-[9px] uppercase font-bold text-white/50 tracking-wider">Base Total</span>
            <span className="text-xs font-extrabold text-white mt-0.5">{clientCounters.total} clientes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection("clientes");
              setClientFilter("vip");
            }}
            className="bg-[#0e0e10] border border-amber-500/20 rounded-xl px-2.5 py-2 flex flex-col items-center justify-center text-center active:scale-95 transition-all"
          >
            <span className="text-[9px] uppercase font-bold text-amber-400/80 tracking-wider">VIP & Fiéis</span>
            <span className="text-xs font-extrabold text-amber-400 mt-0.5">{clientCounters.vipCount} recorrentes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection("clientes");
              setClientFilter("recompra");
            }}
            className="bg-[#0e0e10] border border-emerald-500/20 rounded-xl px-2.5 py-2 flex flex-col items-center justify-center text-center active:scale-95 transition-all"
          >
            <span className="text-[9px] uppercase font-bold text-emerald-400/80 tracking-wider">Fim de Pod</span>
            <span className="text-xs font-extrabold text-emerald-400 mt-0.5">{clientCounters.endingSoonCount} alertas</span>
          </button>
        </div>
      </div>

      {/* ━━━ BLOCO 2 (ABAIXO): CRMZINHO SIMPLIFICADO (ÚLTIMAS VENDAS & CLIENTES) ━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl p-3.5 space-y-3.5 shadow-xl">
        {/* Seletor Principal: Últimas Vendas vs Clientes & Recompra */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-black/60 border border-white/15 gap-1">
          <button
            type="button"
            onClick={() => setActiveSection("vendas")}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === "vendas"
                ? "bg-white text-black shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Receipt className="size-3.5 shrink-0" />
            <span>Últimas Vendas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("clientes")}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === "clientes"
                ? "bg-emerald-500 text-black shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Users className="size-3.5 shrink-0" />
            <span>Clientes ({clients.length})</span>
          </button>
        </div>

        {/* Campo de Busca Instantânea */}
        <div className="relative">
          <Search className="size-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              activeSection === "vendas"
                ? "Buscar venda por cliente, sabor ou telefone..."
                : "Buscar cliente por nome, sabor ou WhatsApp..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/50 border border-white/15 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* VISÃO 1: ÚLTIMAS VENDAS (PADRÃO)                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeSection === "vendas" && (
          <div className="space-y-3">
            {/* Pílulas de Filtro Rápido de Tempo */}
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: "all", label: "Todas" },
                  { id: "24h", label: "Últ. 24h" },
                  { id: "3d", label: "3 Dias" },
                  { id: "7d", label: "7 Dias" },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSalesPeriod(pill.id)}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center ${
                    salesPeriod === pill.id
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-black/40 text-white/60 border-white/10"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center text-white/50 text-xs gap-2">
                <Loader2 className="size-6 animate-spin text-emerald-400" />
                <span>Carregando últimas vendas...</span>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="py-8 text-center space-y-2 bg-black/30 rounded-2xl border border-white/10 p-4">
                <Receipt className="size-8 text-white/20 mx-auto" />
                <p className="text-xs font-bold text-white/80">Nenhuma venda neste filtro.</p>
                <p className="text-[11px] text-white/40">
                  Alterne para "Todas" acima para consultar todo o histórico.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredSales.slice(0, 40).map((sale) => (
                  <div
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className="bg-black/50 border border-white/12 rounded-2xl p-3.5 space-y-2.5 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    {/* Linha 1: Nome do Cliente + Horário + Valor */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-extrabold text-white truncate">
                            {sale.client_name || "Cliente"}
                          </span>
                          {sale.is_vip && (
                            <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full uppercase shrink-0">
                              VIP
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/45 flex items-center gap-1.5 mt-0.5">
                          <Clock className="size-3 text-white/35 shrink-0" />
                          <span>{formatFriendlyDate(sale.created_at)}</span>
                          <span className="text-white/25">•</span>
                          <span className="font-mono text-[10px] text-white/40">
                            {sale.order_code || `#${sale.id.slice(0, 6)}`}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-black text-emerald-400 font-mono">
                          {formatBRL(sale.total_amount)}
                        </div>
                        <span className="text-[9.5px] text-white/40 font-mono uppercase">
                          {sale.payment_method || "PIX"}
                        </span>
                      </div>
                    </div>

                    {/* Linha 2: Pods e Sabores Comprados */}
                    <div className="flex flex-wrap gap-1.5">
                      {sale.items.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 bg-white/[0.05] border border-white/10 text-[11px] px-2.5 py-1 rounded-xl text-white/90 font-medium"
                        >
                          <strong className="text-emerald-400 font-mono">{item.quantity}x</strong>
                          <span className="truncate max-w-[140px]">{item.name || "Pod"}</span>
                          {item.flavor && (
                            <span className="text-amber-300 font-semibold truncate max-w-[120px]">
                              • {item.flavor}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Linha 3: Status + Botões Rápidos (WhatsApp & Detalhes) */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase tracking-wider ${
                          sale.delivery_status === "CONCLUIDO"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : sale.delivery_status === "CANCELADO"
                            ? "bg-red-500/15 text-red-300 border border-red-500/30"
                            : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {sale.delivery_status}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {sale.client_phone && (
                          <a
                            href={buildWhatsAppLink(sale.client_phone, sale.client_name)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all"
                          >
                            <MessageSquare className="size-3" />
                            <span>WhatsApp</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(sale);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-[11px] font-semibold transition-all cursor-pointer"
                        >
                          <Eye className="size-3" />
                          <span>Raio-X</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSale(sale);
                          }}
                          className="p-1.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
                          title="Excluir Venda"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* VISÃO 2: CLIENTES & RECOMPRA SIMPLIFICADO                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeSection === "clientes" && (
          <div className="space-y-3">
            {/* Pílulas de Filtro Rápido de Clientes */}
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "recompra", label: "🔥 Fim de Pod" },
                  { id: "vip", label: "👑 VIP & Fiéis" },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setClientFilter(pill.id)}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center ${
                    clientFilter === pill.id
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-black/40 text-white/60 border-white/10"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center text-white/50 text-xs gap-2">
                <Loader2 className="size-6 animate-spin text-emerald-400" />
                <span>Carregando base de clientes...</span>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="py-8 text-center space-y-2 bg-black/30 rounded-2xl border border-white/10 p-4">
                <Users className="size-8 text-white/20 mx-auto" />
                <p className="text-xs font-bold text-white/80">Nenhum cliente encontrado.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredClients.slice(0, 40).map((client) => (
                  <div
                    key={client.id}
                    onClick={() => onSelectClient(client)}
                    className="bg-black/50 border border-white/12 rounded-2xl p-3.5 space-y-2.5 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-extrabold text-white truncate">
                            {client.name}
                          </span>
                          {(client.segment === "champion" || client.inVipGroup) && (
                            <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full uppercase">
                              VIP
                            </span>
                          )}
                          {client.isEndingSoon && (
                            <span className="text-[9px] font-black bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.2 rounded-full uppercase">
                              Fim de Pod
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/45 mt-0.5 truncate">
                          Último: <strong className="text-white/80">{client.lastProduct}</strong>
                          {client.lastFlavor ? ` • ${client.lastFlavor}` : ""}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-emerald-400 font-mono">
                          {formatBRL(client.spent)}
                        </div>
                        <span className="text-[10px] text-white/45">
                          {client.ordersCount} {client.ordersCount === 1 ? "compra" : "compras"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="text-[10.5px] text-white/50">
                        Última compra há <strong className="text-white/80">{client.daysSinceLastOrder}d</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {client.whatsappUrl && (
                          <a
                            href={client.whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all"
                          >
                            <MessageSquare className="size-3" />
                            <span>Chamar no Whats</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectClient(client);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 text-white/80 border border-white/10 text-[11px] font-semibold"
                        >
                          <Eye className="size-3" />
                          <span>Ficha</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalhe da Venda */}
      <SaleDetailModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onDeleteSale={() => loadMobileCRMData()}
      />
    </div>
  );
}
