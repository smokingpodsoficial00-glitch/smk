import { useState, useEffect } from "react";
import { formatBRL } from "@/lib/cart"; 
import { 
  Clock, MapPin, ReceiptText, CheckCircle2, Truck, Bike, X, Loader2, 
  Search, Filter, MoreVertical, ChevronDown, ChevronUp, Copy, Printer, 
  Trash2, RotateCcw, Package, DollarSign, Eye, EyeOff
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { returnStockForOrderItems } from "@/lib/stockSync";

export interface AdminOrder {
  id: string;
  realId: string;
  clientName: string;
  phone: string;
  address: string;
  items: { model: string; flavor: string; quantity: number; price: number }[];
  totalAmount: number;
  shippingFee: number;
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
            totalAmount: parseFloat(o.total_amount || 0),
            shippingFee: parseFloat(o.shipping_fee || 0),
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
          delivery_status: newDeliveryStatus === 'CONCLUIDO' ? 'ENTREGUE' : newDeliveryStatus,
          ...paymentUpdate
        })
        .eq('id', realId);

      if (error) {
        console.warn("Aviso ao atualizar status no Supabase:", error.message);
      }

      // Disparar Webhook caso despache para Rota (Assíncrono, sem bloquear a transação)
      if (newDeliveryStatus === 'EM_ROTA') {
        const order = orders.find(o => o.realId === realId);
        if (order) {
          fetch('http://localhost:3006/api/webhook/dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.id,
              clientPhone: order.phone,
              deliveryType: deliveryType || 'proprio'
            })
          }).catch(e => console.error('Falha ao disparar webhook de despacho:', e));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOrder = async (realId: string) => {
    const targetOrder = orders.find(o => o.realId === realId);
    if (!targetOrder) return;
    
    if (confirm(`Deseja realmente recusar/excluir o pedido #${targetOrder.id}? Os itens serão devolvidos ao estoque.`)) {
      if (targetOrder.status !== 'ENTREGUE') {
        await returnStockForOrderItems(targetOrder.items);
      }
      
      const { error } = await supabase
        .from('smoking_orders')
        .delete()
        .eq('id', realId);
        
      if (!error) {
        setOrders(prev => prev.filter(o => o.realId !== realId));
      } else {
        alert("Erro ao excluir do banco de dados: " + error.message);
      }
    }
  };

  const columns = [
    { title: "Aguardando Pagamento", status: "AGUARDANDO_PAGAMENTO", color: "bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.2)]" },
    { title: "Preparando", status: "PREPARANDO", color: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" },
    { title: "Em Rota", status: "EM_ROTA", color: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]" },
    { title: "Entregue", status: "ENTREGUE", color: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" },
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
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      if (orderDate < sevenDaysAgo) return false;
    } else if (timeFilter === '30DIAS') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      if (orderDate < thirtyDaysAgo) return false;
    } else if (timeFilter === '24H') {
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (orderDate < oneDayAgo) return false;
    }

    // Filtro por Tipo de Pagamento
    if (paymentFilter !== 'TODOS') {
      if (o.paymentMethod !== paymentFilter) return false;
    }

    // Filtro por Busca Geral
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchesId = o.id.toLowerCase().includes(q);
      const matchesClient = o.clientName.toLowerCase().includes(q) || (o.phone && o.phone.toLowerCase().includes(q));
      const matchesAddress = o.address && o.address.toLowerCase().includes(q);
      const matchesItems = o.items.some(i => i.model.toLowerCase().includes(q) || i.flavor.toLowerCase().includes(q));
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#050505] relative">
      <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 shrink-0 bg-[#070707]">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-white">Painel de Pedidos</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-white/40 uppercase font-semibold tracking-wider font-mono">tempo real ativo</span>
          </div>
        </div>

        {/* Abas Principais */}
        <div className="flex items-center gap-1 bg-[#121212]/50 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'kanban' 
                ? 'bg-white/5 text-emerald-400 font-bold border border-white/5' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            📦 Pedidos ({activeOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('concluidos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'concluidos' 
                ? 'bg-white/5 text-emerald-400 font-bold border border-white/5' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            Concluídos ({allCompletedOrders.length})
          </button>
        </div>
      </header>

      {/* Conteúdo da Aba: KANBAN EM ANDAMENTO */}
      {activeTab === 'kanban' && (
        <div className="flex-1 overflow-hidden p-6 flex flex-col gap-4 min-h-0 bg-[#070707]/30">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6 min-h-0">
            {columns.map(col => {
              const colOrders = orders.filter(o => o.status === col.status);
              return (
                <div key={col.title} className="flex flex-col h-full max-h-full min-w-0 min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between px-1 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className={`size-2 rounded-full ${col.color}`} />
                      <h3 className="font-bold text-white/70 text-[10px] tracking-wider uppercase truncate">{col.title}</h3>
                    </div>
                    <span className="text-[10px] font-bold text-white/30 font-mono shrink-0">
                      {colOrders.length} {colOrders.length === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>
                  
                  <div className="h-px bg-white/5 my-3 w-full shrink-0" />
                  
                  <div className="flex-1 flex flex-col gap-4 overflow-y-auto pb-12 pr-1.5 custom-scrollbar min-h-0">
                    {colOrders.map(order => (
                      <OrderCard 
                        key={order.realId} 
                        order={order} 
                        onUpdate={(realId, newStatus) => updateStatus(realId, newStatus)} 
                        onDispatchClick={() => setSelectedOrderForDispatch(order.realId)}
                        onDelete={handleDeleteOrder}
                      />
                    ))}
                    {colOrders.length === 0 && (
                      <div className="border border-dashed border-[#1f1f1f] rounded-2xl py-8 px-4 text-center text-xs text-white/20 font-medium">
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
                                        onClick={async () => {
                                          if (confirm(`Deseja realmente excluir o histórico do pedido #${order.id}?`)) {
                                            if (order.status !== 'ENTREGUE') {
                                              await returnStockForOrderItems(order.items);
                                            }
                                            const { error } = await supabase
                                              .from('smoking_orders')
                                              .delete()
                                              .eq('id', order.realId);
                                            
                                            if (!error) {
                                              saveCompletedIds(getCompletedIds().filter(id => id !== order.realId));
                                              setOrders(prev => prev.filter(o => o.realId !== order.realId));
                                            } else {
                                              alert("Erro ao excluir do banco de dados: " + error.message);
                                            }
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
                className="flex items-center gap-4 bg-elevated hover:bg-white/10 border border-border p-4 rounded-xl transition-all group cursor-pointer"
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
                className="flex items-center gap-4 bg-[#0F0F0F] hover:bg-[#1A1A1A] border border-[#2A2A2A] hover:border-green-500/50 p-4 rounded-xl transition-all group cursor-pointer"
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
    return date.toLocaleDateString('pt-BR');
  } catch {
    return "";
  }
}

function OrderCard({ 
  order, 
  onUpdate, 
  onDispatchClick,
  onDelete
}: { 
  order: AdminOrder; 
  onUpdate: (realId: string, s: AdminOrder['status']) => void;
  onDispatchClick: () => void;
  onDelete: (realId: string) => void;
}) {
  const getProgressColor = (status: AdminOrder['status']) => {
    if (status === 'AGUARDANDO_PAGAMENTO') return 'bg-white/30 w-1/4';
    if (status === 'PREPARANDO') return 'bg-amber-500 w-2/4 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
    if (status === 'EM_ROTA') return 'bg-blue-500 w-3/4 shadow-[0_0_10px_rgba(59,130,246,0.2)]';
    return 'bg-emerald-500 w-full shadow-[0_0_10px_rgba(16,185,129,0.2)]';
  };

  return (
    <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-emerald-500/30 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 relative group">
      
      {/* Barra de Progresso Superior */}
      <div className="w-full h-1 bg-[#161616] rounded-full overflow-hidden mb-1">
        <div className={`h-full ${getProgressColor(order.status)} transition-all duration-500`} />
      </div>

      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[9px] uppercase tracking-wider text-white/30 font-mono font-bold">Pedido #{order.id}</span>
          <h4 className="font-bold text-base text-white/90 group-hover:text-white transition-colors mt-0.5">{order.clientName}</h4>
        </div>
        <div className="flex items-center gap-1.5 text-white/40 text-[10px] font-semibold tracking-wider uppercase bg-[#141414] border border-[#222] px-2.5 py-1 rounded-lg shrink-0">
          <Clock className="size-3" />
          {getRelativeTime(order.createdAt)}
        </div>
      </div>

      {/* Itens do Pedido */}
      <div className="flex flex-col gap-3 py-1">
        <div className="text-[9px] font-bold tracking-wider text-white/30 uppercase">Itens</div>
        {order.items.map((item, idx) => (
          <div key={idx} className="flex gap-2 text-xs items-center">
            <span className="text-emerald-400 font-bold text-xs shrink-0 select-none">{item.quantity}x</span>
            <div className="flex flex-col">
              <span className="font-semibold text-white/80">{item.flavor}</span>
              <span className="text-[10px] text-white/40 mt-0.5">{item.model}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Endereço e Taxa de Entrega */}
      <div className="flex flex-col gap-2 bg-[#121212]/40 p-3 rounded-xl border border-white/5">
        <div className="flex items-start justify-between gap-2 text-xs text-white/60">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <MapPin className="size-3.5 shrink-0 mt-0.5 text-white/40" />
            <span className="leading-snug">{order.address}</span>
          </div>
        </div>

        {/* Badge da Taxa de Entrega */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
          <span className="text-white/40 flex items-center gap-1 font-medium">
            <Bike className="size-3 text-emerald-400" /> Taxa de Entrega:
          </span>
          <span className={`font-semibold px-2 py-0.5 rounded-md text-[10px] ${
            order.shippingFee > 0 
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
              : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
          }`}>
            {order.shippingFee > 0 ? formatBRL(order.shippingFee) : 'Grátis (3+ pods)'}
          </span>
        </div>
      </div>

      {/* Total e Comprovante */}
      <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-3.5">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase text-white/40 tracking-wider font-semibold">Total ({order.paymentMethod})</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono font-bold text-base text-emerald-400">{formatBRL(order.totalAmount)}</span>
            <span className="text-[10px] text-white/30 font-mono">
              ({order.shippingFee > 0 ? `inclui ${formatBRL(order.shippingFee)} entrega` : 'frete grátis'})
            </span>
          </div>
        </div>
        
        {order.receiptUrl && (
          <a 
            href={order.receiptUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1.5 text-[11px] font-semibold text-white/70 hover:text-white transition-colors bg-[#161616] hover:bg-[#222] px-2.5 py-1.5 rounded-lg border border-[#2e2e2e]"
          >
            <ReceiptText className="size-3.5" />
            Recibo
          </a>
        )}
      </div>

      {/* Ações baseadas no Status */}
      <div className="mt-1 flex flex-col gap-2">
        {order.status === 'AGUARDANDO_PAGAMENTO' && (
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => onUpdate(order.realId, 'PREPARANDO')}
              className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-[0_4px_15px_rgba(16,185,129,0.05)] active:scale-[0.98]"
            >
              ✓ Confirmar Pagamento (Pix Caiu)
            </button>
            {order.phone && (
              <a
                href={`https://wa.me/${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Oi ${order.clientName}, tudo certo? Estou verificando o seu pagamento do pedido #${order.id}, consegue me mandar o comprovante?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#161616] hover:bg-[#222] text-white/60 hover:text-white text-xs font-semibold py-2.5 rounded-xl border border-[#2e2e2e] transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                💬 Verificar Pix no WhatsApp
              </a>
            )}
            <button 
              onClick={() => onDelete(order.realId)}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Trash2 className="size-3.5" />
              Recusar Pedido (Devolver Estoque)
            </button>
          </div>
        )}

        {order.status === 'PREPARANDO' && (
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate(order.realId, 'AGUARDANDO_PAGAMENTO')}
              className="bg-[#161616] hover:bg-[#222] text-white/60 hover:text-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#2e2e2e] transition-colors shrink-0 cursor-pointer"
              title="Voltar status"
            >
              ← Voltar
            </button>
            <button 
              onClick={onDispatchClick}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              Despachar →
            </button>
          </div>
        )}

        {order.status === 'EM_ROTA' && (
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate(order.realId, 'PREPARANDO')}
              className="bg-[#161616] hover:bg-[#222] text-white/60 hover:text-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#2e2e2e] transition-colors shrink-0 cursor-pointer"
              title="Voltar status"
            >
              ← Voltar
            </button>
            <button 
              onClick={() => onUpdate(order.realId, 'ENTREGUE')}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              ✓ Marcar Entregue
            </button>
          </div>
        )}

        {order.status === 'ENTREGUE' && (
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate(order.realId, 'EM_ROTA')}
              className="bg-[#161616] hover:bg-[#222] text-white/60 hover:text-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#2e2e2e] transition-colors shrink-0 cursor-pointer"
              title="Voltar para Rota"
            >
              ← Voltar
            </button>
            <button 
              onClick={() => onUpdate(order.realId, 'CONCLUIDO')}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              ✓ Concluir
            </button>
          </div>
        )}

        {order.status === 'CONCLUIDO' && (
          <button 
            onClick={() => onUpdate(order.realId, 'ENTREGUE')}
            className="w-full bg-[#161616] hover:bg-[#222] text-white/50 hover:text-white text-[11px] font-semibold py-2.5 rounded-xl border border-[#2e2e2e] transition-colors cursor-pointer"
          >
            Reabrir Pedido
          </button>
        )}
      </div>
    </div>
  );
}
