import { useState, useMemo } from "react";
import {
  X,
  Globe,
  Plus,
  Package,
  TrendingUp,
  DollarSign,
  Copy,
  ExternalLink,
  Check,
  MapPin,
  Truck,
  Calendar,
  User,
  Search,
  Percent,
} from "lucide-react";
import {
  calculateNationalMetrics,
  extractNationalInfo,
} from "@/lib/nationalSales";

interface NationalSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: any[];
  persistedCosts: Record<string, number>;
  onOpenNewSale?: (defaultProps?: { isNational: boolean }) => void;
}

export function NationalSalesModal({
  isOpen,
  onClose,
  orders,
  persistedCosts,
  onOpenNewSale,
}: NationalSalesModalProps) {
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>("ALL");

  const nationalMetrics = useMemo(() => {
    return calculateNationalMetrics(orders, persistedCosts);
  }, [orders, persistedCosts]);

  // Filtrar pedidos nacionais por busca e estado
  const filteredOrders = useMemo(() => {
    return nationalMetrics.orders.filter((order) => {
      const info = extractNationalInfo(order);

      // Filtro de Estado
      if (selectedStateFilter !== "ALL" && info.state !== selectedStateFilter) {
        return false;
      }

      // Filtro de Busca
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const clientName = (order.client_name || "").toLowerCase();
      const clientPhone = (order.client_phone || "").toLowerCase();
      const city = info.city.toLowerCase();
      const state = info.state.toLowerCase();
      const tracking = (info.trackingCode || "").toLowerCase();

      return (
        clientName.includes(q) ||
        clientPhone.includes(q) ||
        city.includes(q) ||
        state.includes(q) ||
        tracking.includes(q)
      );
    });
  }, [nationalMetrics.orders, searchQuery, selectedStateFilter]);

  const handleCopyTracking = (code: string, id: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedTrackingId(id);
    setTimeout(() => {
      setCopiedTrackingId(null);
    }, 2000);
  };

  const formatBRL = (val: number) => {
    return `R$ ${val.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#111113] border border-white/15 rounded-3xl max-w-4xl w-full p-5 sm:p-7 space-y-6 shadow-2xl my-auto text-white">
        {/* Cabeçalho do Modal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Globe className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-white">
                  Envios Nacionais & Fora de SP
                </h3>
                <span className="text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full">
                  CORREIOS / BRASIL
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                Painel financeiro e operacional isolado de vendas despachadas para outros estados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {onOpenNewSale && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNewSale({ isNational: true });
                }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="size-4 stroke-[3]" />
                <span>+ Nova Venda Nacional</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-white/60 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* 4 KPIs de Alto Padrão */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Total Faturado Nacional */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1 relative overflow-hidden">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="size-3 text-amber-400" />
              Faturamento Nacional
            </span>
            <div className="text-xl sm:text-2xl font-black text-white">
              {formatBRL(nationalMetrics.totalRevenue)}
            </div>
            <p className="text-[10px] text-white/40">
              Integrado no faturamento global
            </p>
          </div>

          {/* 2. Lucro Líquido Nacional */}
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 space-y-1 relative overflow-hidden">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="size-3 text-emerald-400" />
              Lucro Líquido
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400">
              {formatBRL(nationalMetrics.totalProfit)}
            </div>
            <p className="text-[10px] text-emerald-300/60 font-semibold">
              Margem de {nationalMetrics.profitMargin}%
            </p>
          </div>

          {/* 3. Pods / Pedidos Despachados */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1 relative overflow-hidden">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="size-3 text-white/70" />
              Volume de Envios
            </span>
            <div className="text-xl sm:text-2xl font-black text-white">
              {nationalMetrics.totalOrders} {nationalMetrics.totalOrders === 1 ? "envio" : "envios"}
            </div>
            <p className="text-[10px] text-white/40">
              {nationalMetrics.totalPodsSold} pods entregues
            </p>
          </div>

          {/* 4. Ticket Médio Nacional */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1 relative overflow-hidden">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <Percent className="size-3 text-white/70" />
              Ticket Médio
            </span>
            <div className="text-xl sm:text-2xl font-black text-white">
              {formatBRL(nationalMetrics.averageTicket)}
            </div>
            <p className="text-[10px] text-white/40">
              Média por pedido nacional
            </p>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, cidade, estado ou rastreio..."
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400/50"
            />
          </div>

          {/* Filtro de Estado (UF) */}
          {nationalMetrics.stateDistribution.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedStateFilter("ALL")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                  selectedStateFilter === "ALL"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    : "bg-black/30 border-white/10 text-white/60 hover:text-white"
                }`}
              >
                Todos ({nationalMetrics.totalOrders})
              </button>
              {nationalMetrics.stateDistribution.map((st) => (
                <button
                  key={st.state}
                  type="button"
                  onClick={() => setSelectedStateFilter(st.state)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                    selectedStateFilter === st.state
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                      : "bg-black/30 border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {st.state} ({st.count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabela de Envios Nacionais */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-white/60 px-1">
            <span className="font-bold uppercase tracking-wider">
              Histórico de Vendas Despachadas ({filteredOrders.length})
            </span>
            <span className="text-[11px] text-white/40">
              *Frete dos correios não é somado no frete local de motoboy
            </span>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-white/15 bg-white/5 space-y-3">
              <div className="size-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
                <Truck className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white">
                  Nenhuma venda nacional encontrada
                </h4>
                <p className="text-xs text-white/50 max-w-sm mx-auto">
                  Marque a caixinha &quot;Venda Nacional (Fora de SP)&quot; ao registrar uma nova venda para que os dados apareçam aqui.
                </p>
              </div>
              {onOpenNewSale && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNewSale({ isNational: true });
                  }}
                  className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-black font-extrabold text-xs px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer mt-2"
                >
                  <Plus className="size-4 stroke-[3]" />
                  <span>Cadastrar Primeira Venda Nacional</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1 custom-scrollbar">
              {filteredOrders.map((order) => {
                const info = extractNationalInfo(order);
                const items = Array.isArray(order.items) ? order.items : [];
                const isCopied = copiedTrackingId === order.id;

                // Calcular custo e lucro específico desse pedido (Pods + Margem de Frete)
                let orderCmv = 0;
                let podCount = 0;
                let orderProductsRev = 0;
                for (const it of items) {
                  const qty = Number(it.quantity) || 1;
                  const itemCost = Number(it.cost_price || it.costPrice) || persistedCosts[it.product_id] || 65;
                  const itemPrice = Number(it.price || it.unit_price) || 0;
                  orderProductsRev += qty * itemPrice;
                  orderCmv += qty * itemCost;
                  podCount += qty;
                }
                const shipCharged = info.shippingFeeCharged || Number(order.shipping_fee) || 0;
                const shipCost = info.shippingCostReal || 0;
                const shippingMargin = shipCharged - shipCost;
                const productProfit = orderProductsRev - orderCmv;
                const orderProfit = Number((productProfit + shippingMargin).toFixed(2));
                const orderRev = Number(order.total_amount) || (orderProductsRev + shipCharged);

                const formattedDate = order.created_at
                  ? new Date(order.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—";

                return (
                  <div
                    key={order.id}
                    className="bg-black/50 border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-xs">
                          {info.state || "BR"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white flex items-center gap-1.5">
                              <User className="size-3.5 text-white/50" />
                              {order.client_name || "Cliente"}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.2 rounded-full">
                              PAGO
                            </span>
                          </div>
                          <div className="text-[11px] text-white/50 flex items-center gap-1.5 mt-0.5">
                            <MapPin className="size-3 text-amber-400" />
                            <span>
                              {info.city ? `${info.city} - ` : ""}
                              {info.state || "Brasil"}
                            </span>
                            <span>·</span>
                            <Calendar className="size-3 text-white/40" />
                            <span>{formattedDate}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:text-right">
                        <div>
                          <div className="text-sm font-extrabold text-white">
                            {formatBRL(orderRev)}
                          </div>
                          <div className="text-[10px] font-bold text-emerald-400">
                            +{formatBRL(orderProfit)} lucro
                          </div>
                          {shippingMargin !== 0 && (
                            <div className="text-[9px] text-white/40 font-medium">
                              (Pods: +{formatBRL(productProfit)} · Frete: +{formatBRL(shippingMargin)})
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Itens do Pedido */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {items.map((item: any, i: number) => (
                        <span
                          key={i}
                          className="bg-white/5 border border-white/10 text-white/80 px-2.5 py-1 rounded-lg text-[11px] font-medium"
                        >
                          <strong className="text-white font-bold">{item.quantity}x</strong>{" "}
                          {item.brand} {item.name} - {item.flavor}
                        </span>
                      ))}
                    </div>

                    {/* Código de Rastreio & Endereço */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/5 text-[11px]">
                      <div className="text-white/60 truncate max-w-md">
                        <span className="font-semibold text-white/80">Endereço: </span>
                        {info.fullAddress || "Endereço cadastrado"}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {info.trackingCode ? (
                          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                            <span className="text-[10px] text-white/50">Rastreio:</span>
                            <code className="text-amber-400 font-mono font-bold text-xs">
                              {info.trackingCode}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyTracking(info.trackingCode!, order.id)}
                              title="Copiar código de rastreio"
                              className="text-white/60 hover:text-white p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                            >
                              {isCopied ? (
                                <Check className="size-3 text-emerald-400" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                            <a
                              href={`https://rastreamento.correios.com.br/app/index.php?codigo=${info.trackingCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Rastrear nos Correios"
                              className="text-amber-400 hover:text-amber-300 p-1 hover:bg-white/10 rounded transition-colors"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg">
                            Sem rastreio informado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé com botão de fechar */}
        <div className="flex items-center justify-end border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
}
