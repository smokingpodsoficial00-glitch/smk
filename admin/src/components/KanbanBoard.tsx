import { useState, useEffect } from "react";
import { formatBRL } from "@/lib/cart"; 
import { 
  Clock, MapPin, ReceiptText, CheckCircle2, Truck, Bike, X, Loader2, 
  Search, Filter, MoreVertical, ChevronDown, ChevronUp, Copy, Printer, 
  Trash2, RotateCcw, Package, DollarSign, Eye, EyeOff
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { deductStockForOrderItems } from "@/lib/stockSync";

export interface AdminOrder {
  id: string;
  realId: string;
  clientName: string;
  phone: string;
  address: string;
  items: { model: string; flavor: string; quantity: number; price: number }[];
  totalAmount: number;
  paymentMethod: string;
  receiptUrl: string | null;
  paymentStatus: string;
  status: 'AGUARDANDO_PAGAMENTO' | 'PREPARANDO' | 'EM_ROTA' | 'ENTREGUE' | 'CONCLUIDO' | 'CANCELADO';
  time: string;
  createdAt: string;
}

const getCompletedIds = (): string[] => {
  try {
    const raw = localStorage.getItem('smoking_completed_order_ids');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveCompletedIds = (ids: string[]) => {
  try {
    localStorage.setItem('smoking_completed_order_ids', JSON.stringify(ids));
  } catch {}
};

export function KanbanBoard() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<string | null>(null);

  // Estados para o histórico ERP de Concluídos
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("TODOS");
  const [timeFilter, setTimeFilter] = useState("24H");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const { data } = await supabase
        .from('smoking_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        const completedIds = getCompletedIds();
        const mapped: AdminOrder[] = data.map(o => {
          const isCompleted = completedIds.includes(o.id) || o.delivery_status === 'CONCLUIDO';
          return {
            id: o.id.substring(0, 8).toUpperCase(),
            realId: o.id,
            clientName: o.client_name || 'Cliente Sem Nome',
            phone: o.client_phone,
            address: o.shipping_address,
            items: Array.isArray(o.items) ? o.items.map((i: any) => ({
              model: i.name || '',
              flavor: i.flavor || '',
              quantity: i.quantity || 1,
              price: i.price ? parseFloat(i.price) : 90
            })) : [],
            totalAmount: parseFloat(o.total_amount) + parseFloat(o.shipping_fee || 0),
            paymentMethod: o.payment_method,
            receiptUrl: o.receipt_url,
            paymentStatus: o.payment_status,
            status: isCompleted ? 'CONCLUIDO' : (o.delivery_status || 'AGUARDANDO_PAGAMENTO'),
            time: new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            createdAt: o.created_at
          };
        });
        setOrders(mapped);
      }
    } catch (err) {
      console.error("Erro ao buscar pedidos no Supabase:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Polling de 3 em 3 segundos para manter sincronizado entre usuários
    const intervalId = setInterval(() => {
      fetchOrders();
    }, 3000);

    // Inscrição Realtime no canal do Supabase
    const subscription = supabase
      .channel('smoking_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(subscription);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<'kanban' | 'concluidos'>('kanban');

  const updateStatus = async (realId: string, newDeliveryStatus: AdminOrder['status'], deliveryType?: 'uber' | 'proprio') => {
    let paymentUpdate: any = {};
    if (newDeliveryStatus === 'PREPARANDO') {
      paymentUpdate.payment_status = 'PAGO';
      const targetOrder = orders.find(o => o.realId === realId);
      if (targetOrder && targetOrder.items) {
        deductStockForOrderItems(targetOrder.items);
      }
    } else if (newDeliveryStatus === 'AGUARDANDO_PAGAMENTO') {
      paymentUpdate.payment_status = 'PENDENTE';
    }

    if (newDeliveryStatus === 'CONCLUIDO') {
      const current = getCompletedIds();
      if (!current.includes(realId)) {
        saveCompletedIds([...current, realId]);
      }
    } else {
      const current = getCompletedIds();
      if (current.includes(realId)) {
        saveCompletedIds(current.filter(id => id !== realId));
      }
    }

    try {
      // Otimista
      setOrders(prev => prev.map(o => o.realId === realId ? { ...o, status: newDeliveryStatus } : o));

      const { error } = await supabase
        .from('smoking_orders')
        .update({
          delivery_status: newDeliveryStatus,
          ...paymentUpdate
        })
        .eq('id', realId);

      if (error) {
        console.warn("Aviso ao atualizar status no Supabase:", error.message);
      }

      // Disparar Webhook caso despache para Rota
      if (newDeliveryStatus === 'EM_ROTA') {
        const order = orders.find(o => o.realId === realId);
        if (order) {
          try {
            await fetch('http://localhost:3006/api/webhook/dispatch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: order.id,
                clientPhone: order.phone,
                deliveryType: deliveryType || 'proprio'
              })
            });
          } catch (e) {
            console.error('Falha ao disparar webhook de despacho:', e);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const columns = [
    { title: "Aguardando Pagamento", status: "AGUARDANDO_PAGAMENTO" },
    { title: "Preparando", status: "PREPARANDO" },
    { title: "Em Rota", status: "EM_ROTA" },
    { title: "Entregue", status: "ENTREGUE" },
  ] as const;

  const activeOrders = orders.filter(o => o.status !== 'CONCLUIDO');
  const allCompletedOrders = orders.filter(o => o.status === 'CONCLUIDO');

  // Filtro dinâmico para a aba de histórico ERP
  const filteredCompletedOrders = allCompletedOrders.filter(o => {
    const orderDate = new Date(o.createdAt);
    const now = new Date();
    
    // Filtro por Período
    if (timeFilter === 'HOJE') {
      if (orderDate.toDateString() !== now.toDateString()) return false;
    } else if (timeFilter === 'ONTEM') {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (orderDate.toDateString() !== yesterday.toDateString()) return false;
    } else if (timeFilter === '7DIAS') {
      const d7 = new Date();
      d7.setDate(now.getDate() - 7);
      if (orderDate < d7) return false;
    } else if (timeFilter === '30DIAS') {
      const d30 = new Date();
      d30.setDate(now.getDate() - 30);
      if (orderDate < d30) return false;
    } else if (timeFilter === '24H') {
      const d24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (orderDate < d24) return false;
    }

    // Filtro por Forma de Pagamento
    if (paymentFilter !== 'TODOS') {
      if ((o.paymentMethod || '').toUpperCase() !== paymentFilter) return false;
    }

    // Busca Universal (ID, Cliente, Telefone, Endereço, Sabor, Modelo)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesId = o.id.toLowerCase().includes(q) || o.realId.toLowerCase().includes(q);
      const matchesClient = o.clientName.toLowerCase().includes(q) || (o.phone || '').includes(q);
      const matchesAddress = o.address.toLowerCase().includes(q);
      const matchesItems = o.items.some(i => i.flavor.toLowerCase().includes(q) || i.model.toLowerCase().includes(q));
      return matchesId || matchesClient || matchesAddress || matchesItems;
    }

    return true;
  });

  const totalCompletedAmount24h = filteredCompletedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCompletedItems24h = filteredCompletedOrders.reduce((sum, o) => sum + o.items.reduce((iSum, i) => iSum + i.quantity, 0), 0);
  const avgTicket24h = filteredCompletedOrders.length > 0 ? totalCompletedAmount24h / filteredCompletedOrders.length : 0;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <Loader2 className="size-8 text-primary animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Carregando painel de pedidos...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
      <header className="h-16 px-6 flex items-center justify-between border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-semibold">Painel de Pedidos</h2>
          <p className="text-xs text-muted-foreground tracking-wide uppercase">Atualizado em tempo real (Supabase)</p>
        </div>

        {/* Abas Principais */}
        <div className="flex items-center gap-2 bg-card p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'kanban' 
                ? 'bg-primary text-primary-foreground shadow' 
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            📦 Pedidos em Andamento ({activeOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('concluidos')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'concluidos' 
                ? 'bg-emerald-500 text-black font-bold shadow' 
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            Concluídos ({allCompletedOrders.length})
          </button>
        </div>
      </header>

      {/* Conteúdo da Aba: KANBAN EM ANDAMENTO */}
      {activeTab === 'kanban' && (
        <div className="flex-1 overflow-hidden p-4 md:p-6 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-5 h-full w-full min-h-0">
            {columns.map(col => {
              const colOrders = orders.filter(o => o.status === col.status);
              return (
                <div key={col.title} className="flex flex-col h-full max-h-full min-w-0 min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                    <h3 className="font-medium text-silver text-sm lg:text-base truncate">{col.title}</h3>
                    <span className="grid place-items-center bg-elevated text-xs font-semibold size-6 rounded-full shrink-0">
                      {colOrders.length}
                    </span>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-8 pr-1.5 custom-scrollbar min-h-0">
                    {colOrders.map(order => (
                      <OrderCard 
                        key={order.realId} 
                        order={order} 
                        onUpdate={(realId, newStatus) => updateStatus(realId, newStatus)} 
                        onDispatchClick={() => setSelectedOrderForDispatch(order.realId)}
                      />
                    ))}
                    {colOrders.length === 0 && (
                      <div className="border border-dashed border-border rounded-2xl p-4 text-center text-xs text-muted-foreground">
                        Nenhum pedido aqui
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Conteúdo da Aba: HISTÓRICO DE CONCLUÍDOS (ESTILO ERP) */}
      {activeTab === 'concluidos' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">
          {/* Top Banner - 3 Cards Enxutos e Objetivos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Receita (24h)</span>
              <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                {formatBRL(totalCompletedAmount24h)}
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Pedidos Concluídos</span>
              <div className="text-2xl font-bold text-silver font-mono mt-1">
                {filteredCompletedOrders.length} <span className="text-xs font-sans text-muted-foreground">pedidos</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Pods Vendidos & Ticket Médio</span>
              <div className="text-xl font-bold text-silver font-mono mt-1 flex items-baseline justify-between">
                <span>{totalCompletedItems24h} <span className="text-xs font-sans text-muted-foreground">pods</span></span>
                <span className="text-sm font-sans text-emerald-400 font-semibold">TM: {formatBRL(avgTicket24h)}</span>
              </div>
            </div>
          </div>

          {/* Barra de Busca Universal + Filtros Rápidos */}
          <div className="bg-card border border-border rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Campo de Busca */}
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar pedido por ID, cliente, sabor, modelo ou endereço..."
                className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner"
              />
            </div>

            {/* Filtros Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              {/* Filtro Período */}
              <div className="flex items-center gap-1.5 bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-silver">
                <Clock className="size-3.5 text-muted-foreground" />
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="bg-[#0f0f0f] text-xs text-silver focus:outline-none cursor-pointer"
                >
                  <option value="24H" className="bg-[#121212]">Últimas 24h</option>
                  <option value="HOJE" className="bg-[#121212]">Hoje</option>
                  <option value="ONTEM" className="bg-[#121212]">Ontem</option>
                  <option value="7DIAS" className="bg-[#121212]">Últimos 7 dias</option>
                  <option value="30DIAS" className="bg-[#121212]">Últimos 30 dias</option>
                </select>
              </div>

              {/* Filtro Pagamento */}
              <div className="flex items-center gap-1.5 bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-silver">
                <Filter className="size-3.5 text-muted-foreground" />
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="bg-[#0f0f0f] text-xs text-silver focus:outline-none cursor-pointer"
                >
                  <option value="TODOS" className="bg-[#121212]">Todos Pagamentos</option>
                  <option value="PIX" className="bg-[#121212]">PIX</option>
                  <option value="DINHEIRO" className="bg-[#121212]">Dinheiro</option>
                  <option value="CARTAO" className="bg-[#121212]">Cartão</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabela ERP Compacta de Pedidos Concluídos */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {filteredCompletedOrders.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground">
                Nenhum pedido concluído encontrado com os filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-elevated/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-4 font-semibold">ID</th>
                      <th className="py-3 px-3 font-semibold">Hora</th>
                      <th className="py-3 px-4 font-semibold">Cliente</th>
                      <th className="py-3 px-4 font-semibold">Itens Resumidos</th>
                      <th className="py-3 px-4 font-semibold text-right">Total</th>
                      <th className="py-3 px-4 font-semibold text-center">Pagamento</th>
                      <th className="py-3 px-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredCompletedOrders.map((order) => {
                      const isExpanded = expandedOrderId === order.realId;
                      const isMenuOpen = activeActionMenuId === order.realId;
                      const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

                      return (
                        <tr key={order.realId} className="group hover:bg-white/[0.02] transition-colors">
                          <td colSpan={7} className="p-0">
                            {/* Linha Principal do Pedido */}
                            <div 
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.realId)}
                              className="flex items-center justify-between py-3 px-4 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-3 w-full">
                                {/* ID */}
                                <span className="font-mono text-silver font-semibold w-24 shrink-0">
                                  #{order.id}
                                </span>

                                {/* Hora */}
                                <span className="text-muted-foreground font-mono w-16 shrink-0 flex items-center gap-1">
                                  <Clock className="size-3 text-muted-foreground/70" />
                                  {order.time}
                                </span>

                                {/* Cliente */}
                                <div className="w-48 shrink-0 truncate">
                                  <span className="font-medium text-white">{order.clientName}</span>
                                  {order.phone && <span className="text-[10px] text-muted-foreground block truncate">{order.phone}</span>}
                                </div>

                                {/* Itens Resumidos */}
                                <div className="flex-1 min-w-0 truncate text-muted-foreground">
                                  <span className="text-silver font-medium">
                                    {order.items.length} {order.items.length === 1 ? 'item' : 'itens'} ({itemCount} pods)
                                  </span>
                                  <span className="text-[11px] ml-2 text-muted-foreground/80 truncate">
                                    — {order.items.map(i => `${i.quantity}x ${i.flavor}`).join(', ')}
                                  </span>
                                </div>

                                {/* Total */}
                                <span className="font-mono font-semibold text-emerald-400 text-sm w-24 text-right shrink-0">
                                  {formatBRL(order.totalAmount)}
                                </span>

                                {/* Pagamento Badge */}
                                <div className="w-24 text-center shrink-0">
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-elevated border border-border text-silver">
                                    {order.paymentMethod || 'PIX'}
                                  </span>
                                </div>

                                {/* Menu de Ações (⋮) */}
                                <div className="w-12 flex justify-end shrink-0 relative" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => setActiveActionMenuId(isMenuOpen ? null : order.realId)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                                    title="Opções do pedido"
                                  >
                                    <MoreVertical className="size-4" />
                                  </button>

                                  {/* Menu Dropdown de Ações */}
                                  {isMenuOpen && (
                                    <div className="absolute right-0 top-8 z-50 bg-[#121212] border border-border rounded-xl shadow-2xl py-1.5 w-44 text-xs font-medium animate-in fade-in zoom-in-95 duration-150">
                                      <button
                                        onClick={() => {
                                          setExpandedOrderId(isExpanded ? null : order.realId);
                                          setActiveActionMenuId(null);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-silver cursor-pointer"
                                      >
                                        <Eye className="size-3.5 text-primary" />
                                        Ver detalhes
                                      </button>

                                      <button
                                        onClick={() => {
                                          updateStatus(order.realId, 'ENTREGUE');
                                          setActiveActionMenuId(null);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-amber-400 cursor-pointer"
                                      >
                                        <RotateCcw className="size-3.5" />
                                        Reabrir pedido
                                      </button>

                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(`Pedido #${order.id} - ${order.clientName} - Total ${formatBRL(order.totalAmount)}`);
                                          alert("Resumo do pedido copiado para a área de transferência!");
                                          setActiveActionMenuId(null);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-silver cursor-pointer"
                                      >
                                        <Copy className="size-3.5 text-blue-400" />
                                        Duplicar dados
                                      </button>

                                      <button
                                        onClick={() => {
                                          window.print();
                                          setActiveActionMenuId(null);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-silver cursor-pointer"
                                      >
                                        <Printer className="size-3.5 text-purple-400" />
                                        Imprimir
                                      </button>

                                      <div className="h-px bg-border my-1" />

                                      <button
                                        onClick={() => {
                                          if (confirm(`Deseja realmente excluir o histórico do pedido #${order.id}?`)) {
                                            saveCompletedIds(getCompletedIds().filter(id => id !== order.realId));
                                            setOrders(prev => prev.filter(o => o.realId !== order.realId));
                                          }
                                          setActiveActionMenuId(null);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-red-500/10 flex items-center gap-2 text-red-400 cursor-pointer"
                                      >
                                        <Trash2 className="size-3.5" />
                                        Excluir registro
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Detalhes Expandidos (Inline Drawer) */}
                            {isExpanded && (
                              <div className="bg-elevated/40 border-t border-border/80 p-4 space-y-3 animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                  {/* Lista de Itens */}
                                  <div className="bg-card/70 border border-border/60 rounded-xl p-3 space-y-2">
                                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">Itens Solicitados</span>
                                    <div className="space-y-1.5">
                                      {order.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs">
                                          <span className="text-silver font-medium">{item.quantity}x {item.flavor}</span>
                                          <span className="text-muted-foreground text-[11px]">{item.model}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Endereço e Cliente */}
                                  <div className="bg-card/70 border border-border/60 rounded-xl p-3 space-y-2">
                                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">Entrega</span>
                                    <div className="flex items-start gap-1.5 text-silver">
                                      <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                                      <span className="leading-snug">{order.address || 'Endereço não informado'}</span>
                                    </div>
                                  </div>

                                  {/* Informações Financeiras & Comprovante */}
                                  <div className="bg-card/70 border border-border/60 rounded-xl p-3 space-y-2 flex flex-col justify-between">
                                    <div>
                                      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">Pagamento</span>
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="text-silver font-medium">{order.paymentMethod}</span>
                                        <span className="text-emerald-400 font-semibold">{formatBRL(order.totalAmount)}</span>
                                      </div>
                                    </div>

                                    {order.receiptUrl && (
                                      <a 
                                        href={order.receiptUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-1.5 bg-elevated hover:bg-white/10 text-xs text-silver px-3 py-1.5 rounded-lg border border-border transition-colors mt-2"
                                      >
                                        <ReceiptText className="size-3.5" />
                                        Ver Comprovante Anexado
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
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
      )}

      {/* Modal de Despacho Logístico */}
      {selectedOrderForDispatch && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedOrderForDispatch(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="size-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-primary/20 p-2 rounded-lg text-primary">
                <Truck className="size-5" />
              </div>
              <h2 className="text-xl font-semibold">Despacho Logístico</h2>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              Este pedido está pronto para entrega. Como você deseja enviá-lo?
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  updateStatus(selectedOrderForDispatch, 'EM_ROTA', 'proprio');
                  setSelectedOrderForDispatch(null);
                }}
                className="flex items-center gap-4 bg-elevated hover:bg-white/10 border border-border p-4 rounded-xl transition-all group"
              >
                <div className="bg-white/5 p-2 rounded-lg group-hover:bg-white/10 transition-colors">
                  <Bike className="size-5 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Entregador Próprio da Casa</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Motoboy exclusivo (sem rastreio)</p>
                </div>
              </button>

              <button 
                onClick={() => {
                  updateStatus(selectedOrderForDispatch, 'EM_ROTA', 'uber');
                  setSelectedOrderForDispatch(null);
                }}
                className="flex items-center gap-4 bg-[#0F0F0F] hover:bg-[#1A1A1A] border border-[#2A2A2A] hover:border-green-500/50 p-4 rounded-xl transition-all group"
              >
                <div className="bg-black p-2 rounded-lg">
                  <div className="w-5 h-5 bg-white rounded-sm" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Uber Direct</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Integração API com Rastreio em Tempo Real</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ 
  order, 
  onUpdate, 
  onDispatchClick 
}: { 
  order: AdminOrder; 
  onUpdate: (realId: string, s: AdminOrder['status']) => void;
  onDispatchClick: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-4 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{order.id}</span>
          <h4 className="font-semibold text-sm mt-0.5">{order.clientName}</h4>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono bg-elevated px-2 py-1 rounded-md">
          <Clock className="size-3" />
          {order.time}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-y border-border py-3">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex items-start justify-between text-sm">
            <div className="flex gap-3">
              <span className="text-primary font-medium">{item.quantity}x</span>
              <div className="flex flex-col">
                <span className="font-medium text-silver">{item.flavor}</span>
                <span className="text-[10px] text-muted-foreground">{item.model}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <MapPin className="size-3.5 shrink-0 mt-0.5" />
        <span className="leading-snug">{order.address}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Total ({order.paymentMethod})</span>
          <span className="font-semibold">{formatBRL(order.totalAmount)}</span>
        </div>
        
        {order.receiptUrl && (
          <button className="flex items-center gap-1.5 text-xs font-medium text-silver hover:text-white transition-colors bg-elevated px-2.5 py-1.5 rounded-lg border border-border">
            <ReceiptText className="size-3.5" />
            Comprovante
          </button>
        )}
      </div>

      {/* Ações baseadas no Status */}
      <div className="mt-2 flex flex-col gap-2">
        {order.status === 'AGUARDANDO_PAGAMENTO' && (
          <button 
            onClick={() => onUpdate(order.realId, 'PREPARANDO')}
            className="w-full bg-elevated hover:bg-white/10 text-white text-sm font-medium py-2 rounded-xl border border-border transition-colors cursor-pointer"
          >
            Confirmar Pagamento
          </button>
        )}

        {order.status === 'PREPARANDO' && (
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate(order.realId, 'AGUARDANDO_PAGAMENTO')}
              className="bg-elevated hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-medium px-3 py-2.5 rounded-xl border border-border transition-colors shrink-0 cursor-pointer"
              title="Voltar status"
            >
              Voltar
            </button>
            <button 
              onClick={onDispatchClick}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Truck className="size-4" />
              POD Despachado
            </button>
          </div>
        )}

        {order.status === 'EM_ROTA' && (
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate(order.realId, 'PREPARANDO')}
              className="bg-elevated hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-medium px-3 py-2 rounded-xl border border-border transition-colors shrink-0 cursor-pointer"
              title="Voltar status"
            >
              Voltar
            </button>
            <button 
              onClick={() => onUpdate(order.realId, 'ENTREGUE')}
              className="flex-1 bg-elevated hover:bg-white/10 text-white text-sm font-medium py-2 rounded-xl border border-border transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="size-4" />
              Marcar Entregue
            </button>
          </div>
        )}

        {order.status === 'ENTREGUE' && (
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate(order.realId, 'EM_ROTA')}
              className="bg-elevated hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-medium px-3 py-2 rounded-xl border border-border transition-colors shrink-0 cursor-pointer"
              title="Voltar para Rota"
            >
              Voltar
            </button>
            <button 
              onClick={() => onUpdate(order.realId, 'CONCLUIDO')}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="size-4" />
              Concluir Pedido
            </button>
          </div>
        )}

        {order.status === 'CONCLUIDO' && (
          <button 
            onClick={() => onUpdate(order.realId, 'ENTREGUE')}
            className="w-full bg-background hover:bg-elevated text-muted-foreground hover:text-white text-xs font-medium py-2 rounded-xl border border-border transition-colors cursor-pointer"
          >
            Reabrir (Voltar para Entregue)
          </button>
        )}
      </div>
    </div>
  );
}
