import { useState, useEffect } from "react";
import { formatBRL } from "@/lib/cart"; 
import { 
  Clock, MapPin, ReceiptText, CheckCircle2, Truck, Bike, X, Loader2, 
  Search, Filter, MoreVertical, ChevronDown, ChevronUp, Copy, Printer, 
  Trash2, RotateCcw, Package, DollarSign, Eye, EyeOff, AlertTriangle, UserCheck
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

/**
 * Calcula os minutos decorridos desde a criação do pedido
 */
function getElapsedMinutes(createdAt: string): number {
  try {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  } catch {
    return 0;
  }
}

/**
 * Define o nível de urgência com base no tempo decorrido do pedido
 */
function getTimeUrgency(minutes: number): { level: 'normal' | 'atencao' | 'urgente'; barColor: string; badgeBg: string; label: string } {
  if (minutes < 15) {
    return { level: 'normal', barColor: 'bg-emerald-500', badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'Normal' };
  } else if (minutes < 30) {
    return { level: 'atencao', barColor: 'bg-amber-500', badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30', label: 'Atenção' };
  } else if (minutes < 45) {
    return { level: 'atencao', barColor: 'bg-orange-500', badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/30', label: 'Atenção' };
  } else {
    return { level: 'urgente', barColor: 'bg-red-500', badgeBg: 'bg-red-500/10 text-red-400 border-red-500/30', label: 'Urgente' };
  }
}

/**
 * Badge colorido para Formas de Pagamento (PIX, Dinheiro, Cartão)
 */
function getPaymentMethodBadge(method: string) {
  const m = (method || 'PIX').toUpperCase();
  if (m.includes('PIX')) {
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">PIX</span>;
  }
  if (m.includes('DINHEIRO') || m.includes('DIN')) {
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">DINHEIRO</span>;
  }
  return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">CARTÃO</span>;
}

export function KanbanBoard() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<string | null>(null);

  // Estados para busca e filtros do histórico ERP
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("TODOS");
  const [timeFilter, setTimeFilter] = useState("24H");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'kanban' | 'concluidos'>('kanban');

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
            totalAmount: parseFloat(o.total_amount || 0) + parseFloat(o.shipping_fee || 0),
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

    // Polling de 3 em 3 segundos para manter dados sincronizados
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

  // Definições de colunas com visual marcante e contadores
  const columns = [
    { title: "AGUARDANDO PAGAMENTO", status: "AGUARDANDO_PAGAMENTO", color: "bg-[#e2e8f0]", barColor: "bg-white" },
    { title: "PREPARANDO", status: "PREPARANDO", color: "bg-amber-500", barColor: "bg-amber-500" },
    { title: "EM ROTA", status: "EM_ROTA", color: "bg-blue-500", barColor: "bg-blue-500" },
    { title: "ENTREGUE", status: "ENTREGUE", color: "bg-emerald-500", barColor: "bg-emerald-500" },
  ] as const;

  // Filtragem de pedidos ativos, concluídos e atrasados
  const activeOrders = orders.filter(o => o.status !== 'CONCLUIDO');
  const allCompletedOrders = orders.filter(o => o.status === 'CONCLUIDO');
  const delayedOrders = activeOrders.filter(o => getElapsedMinutes(o.createdAt) >= 30);

  // Pedidos para o Kanban filtrados pelo campo de busca universal
  const filteredActiveOrders = activeOrders.filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.id.toLowerCase().includes(q) ||
      o.clientName.toLowerCase().includes(q) ||
      (o.phone && o.phone.toLowerCase().includes(q)) ||
      (o.address && o.address.toLowerCase().includes(q)) ||
      o.items.some(i => i.flavor.toLowerCase().includes(q) || i.model.toLowerCase().includes(q))
    );
  });

  // Métricas do Dashboard Superior
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const preparingCount = activeOrders.filter(o => o.status === 'PREPARANDO').length;
  const onRouteCount = activeOrders.filter(o => o.status === 'EM_ROTA').length;
  const completedCount = orders.filter(o => o.status === 'ENTREGUE' || o.status === 'CONCLUIDO').length;
  const avgTimeMinutes = activeOrders.length > 0
    ? Math.round(activeOrders.reduce((sum, o) => sum + getElapsedMinutes(o.createdAt), 0) / activeOrders.length)
    : 0;

  // Filtro para histórico ERP
  const filteredCompletedOrders = allCompletedOrders.filter(o => {
    const orderDate = new Date(o.createdAt);
    const now = new Date();
    
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

    if (paymentFilter !== 'TODOS' && o.paymentMethod !== paymentFilter) return false;

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
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] text-white">
        <Loader2 className="size-8 text-emerald-400 animate-spin mb-2" />
        <p className="text-xs text-white/50 font-mono">Carregando painel operacional de alta velocidade...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#070707] relative text-white select-none">
      
      {/* 1. CABEÇALHO COMPACTO E RICO EM INFORMAÇÃO */}
      <header className="bg-[#0b0b0b] border-b border-[#1c1c1c] px-4 lg:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        
        {/* Lado Esquerdo: Título & Contadores Resumidos */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base lg:text-lg font-black text-white tracking-tight uppercase">
                Painel de Pedidos
              </h1>
              {/* Indicador Tempo Real */}
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-emerald-400">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                </span>
                Tempo Real
              </div>
            </div>
            
            {/* Contadores da Seção 1 */}
            <div className="flex items-center gap-2 text-xs font-semibold mt-1">
              <span className="text-white/80 font-mono">
                <strong className="text-emerald-400 font-bold font-mono text-sm">{activeOrders.length < 10 ? `0${activeOrders.length}` : activeOrders.length}</strong> Ativos
              </span>
              <span className="text-white/20">•</span>
              <span className="text-white/80 font-mono">
                <strong className="text-blue-400 font-bold font-mono text-sm">{allCompletedOrders.length < 10 ? `0${allCompletedOrders.length}` : allCompletedOrders.length}</strong> Concluídos
              </span>
              <span className="text-white/20">•</span>
              <span className="text-white/80 font-mono">
                <strong className="text-red-400 font-bold font-mono text-sm">{delayedOrders.length < 10 ? `0${delayedOrders.length}` : delayedOrders.length}</strong> Atrasados
              </span>
            </div>
          </div>
        </div>

        {/* Lado Direito: Busca, Abas, Refresh & Operador */}
        <div className="flex items-center gap-2.5 flex-wrap">
          
          {/* Campo de Pesquisa em Tempo Real */}
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/40" />
            <input 
              type="text"
              placeholder="🔍 Buscar pedido..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/50 text-xs text-white placeholder:text-white/30 rounded-xl pl-9 pr-3 py-1.5 transition-all outline-none"
            />
          </div>

          {/* Abas Principais (Kanban vs Concluídos) */}
          <div className="flex items-center gap-1 bg-[#141414] p-1 rounded-xl border border-[#242424]">
            <button
              onClick={() => setActiveTab('kanban')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'kanban' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm' 
                  : 'text-white/50 hover:text-white'
              }`}
            >
              📦 Kanban ({activeOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('concluidos')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'concluidos' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm' 
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <CheckCircle2 className="size-3.5" />
              Concluídos ({allCompletedOrders.length})
            </button>
          </div>

          {/* Botão de Atualizar */}
          <button 
            onClick={() => fetchOrders()}
            className="bg-[#141414] hover:bg-[#202020] text-white/70 hover:text-white border border-[#262626] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Atualizar painel agora"
          >
            <RotateCcw className="size-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          {/* Informações do Operador */}
          <div className="flex items-center gap-2 bg-[#141414] border border-[#262626] px-2.5 py-1 rounded-xl shrink-0">
            <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
              👤
            </div>
            <div className="text-left hidden lg:block">
              <span className="text-[10px] font-extrabold text-white/90 block leading-none">Operador</span>
              <span className="text-[9px] text-emerald-400 font-mono font-bold leading-none">Online</span>
            </div>
          </div>

        </div>
      </header>

      {/* 15. DASHBOARD SUPERIOR DE INDICADORES (KPI BAR) */}
      <div className="bg-[#090909] border-b border-[#181818] px-4 lg:px-6 py-2 overflow-x-auto custom-scrollbar shrink-0">
        <div className="flex items-center gap-3 min-w-max">
          
          {/* Pedidos Hoje */}
          <div className="bg-[#111111] border border-[#222] px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <Package className="size-4 text-emerald-400" />
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-extrabold block">Pedidos Hoje</span>
              <span className="text-xs font-bold font-mono text-white">{todayOrders.length}</span>
            </div>
          </div>

          {/* Faturamento */}
          <div className="bg-[#111111] border border-[#222] px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <DollarSign className="size-4 text-emerald-400" />
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-extrabold block">Faturamento</span>
              <span className="text-xs font-bold font-mono text-emerald-400">{formatBRL(todayRevenue)}</span>
            </div>
          </div>

          {/* Preparando */}
          <div className="bg-[#111111] border border-[#222] px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-amber-500"></span>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-extrabold block">Preparando</span>
              <span className="text-xs font-bold font-mono text-amber-400">{preparingCount}</span>
            </div>
          </div>

          {/* Em Rota */}
          <div className="bg-[#111111] border border-[#222] px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <Bike className="size-4 text-blue-400" />
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-extrabold block">Em Rota</span>
              <span className="text-xs font-bold font-mono text-blue-400">{onRouteCount}</span>
            </div>
          </div>

          {/* Entregues */}
          <div className="bg-[#111111] border border-[#222] px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-extrabold block">Entregues</span>
              <span className="text-xs font-bold font-mono text-emerald-400">{completedCount}</span>
            </div>
          </div>

          {/* Atrasados */}
          <div className="bg-[#111111] border border-[#222] px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-extrabold block">Atrasados (&gt;30m)</span>
              <span className="text-xs font-bold font-mono text-red-400">{delayedOrders.length}</span>
            </div>
          </div>

          {/* Tempo Médio */}
          <div className="bg-[#111111] border border-[#222] px-3 py-1.5 rounded-xl flex items-center gap-2.5">
            <Clock className="size-4 text-purple-400" />
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-extrabold block">Tempo Médio</span>
              <span className="text-xs font-bold font-mono text-purple-300">{avgTimeMinutes} min</span>
            </div>
          </div>

        </div>
      </div>

      {/* CONTEÚDO DA ABA: KANBAN EM ANDAMENTO */}
      {activeTab === 'kanban' && (
        <div className="flex-1 overflow-hidden p-3 md:p-5 flex flex-col gap-4 min-h-0 bg-[#070707]">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5 min-h-0">
            {columns.map(col => {
              const colOrders = filteredActiveOrders.filter(o => o.status === col.status);
              return (
                <div key={col.title} className="flex flex-col h-full max-h-full min-w-0 min-h-0 overflow-hidden bg-[#0a0a0a]/60 border border-[#161616] rounded-2xl p-3">
                  
                  {/* 2. TÍTULOS DAS COLUNAS MAIS CHAMATIVOS COM BARRAS COLORIDAS */}
                  <div className="flex flex-col gap-2 pb-3 mb-2 shrink-0 border-b border-[#1f1f1f]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`size-3 rounded-full ${col.color} shadow-[0_0_10px_rgba(255,255,255,0.3)]`} />
                        <h3 className="font-black text-xs md:text-sm tracking-wider uppercase text-white">
                          {col.title}
                        </h3>
                      </div>
                      <span className="bg-[#161616] border border-[#282828] text-white font-mono font-black text-xs px-2.5 py-0.5 rounded-full shadow-inner">
                        {colOrders.length}
                      </span>
                    </div>
                    {/* Barra colorida chamativa abaixo do título */}
                    <div className={`h-1 rounded-full ${col.barColor} w-full`} />
                  </div>
                  
                  {/* LISTA DE CARDS DA COLUNA */}
                  <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto pb-10 pr-1.5 custom-scrollbar min-h-0">
                    {colOrders.map(order => (
                      <OrderCard 
                        key={order.realId} 
                        order={order} 
                        onUpdate={(realId, newStatus) => updateStatus(realId, newStatus)} 
                        onDispatchClick={() => setSelectedOrderForDispatch(order.realId)}
                        onDelete={handleDeleteOrder}
                      />
                    ))}

                    {/* 13. CARDS VAZIOS MAIS AMIGÁVEIS */}
                    {colOrders.length === 0 && (
                      <div className="border border-dashed border-[#1f1f1f] bg-[#0c0c0c]/40 rounded-2xl py-12 px-4 text-center flex flex-col items-center justify-center gap-2.5 my-auto">
                        <span className="text-3xl select-none">🍳</span>
                        <span className="text-xs font-bold text-white/70 block">Nenhum pedido nesta etapa</span>
                        <span className="text-[11px] text-white/30 max-w-[200px] leading-relaxed">
                          Os novos pedidos aparecerão aqui automaticamente.
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: HISTÓRICO DE CONCLUÍDOS (ESTILO ERP) */}
      {activeTab === 'concluidos' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">
          
          {/* Top Banner - 3 Cards Enxutos e Objetivos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0f0f0f] border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-xs uppercase text-white/40 font-extrabold tracking-wider">Receita (24h)</span>
              <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                {formatBRL(totalCompletedAmount24h)}
              </div>
            </div>
            
            <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-xs uppercase text-white/40 font-extrabold tracking-wider">Pedidos Concluídos</span>
              <div className="text-2xl font-bold text-white font-mono mt-1">
                {filteredCompletedOrders.length} <span className="text-xs font-sans text-white/40">pedidos</span>
              </div>
            </div>

            <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-xs uppercase text-white/40 font-extrabold tracking-wider">Pods Vendidos & Ticket Médio</span>
              <div className="text-xl font-bold text-white font-mono mt-1 flex items-baseline justify-between">
                <span>{totalCompletedItems24h} <span className="text-xs font-sans text-white/40">pods</span></span>
                <span className="text-sm font-sans text-emerald-400 font-bold">TM: {formatBRL(avgTicket24h)}</span>
              </div>
            </div>
          </div>

          {/* Barra de Busca Universal + Filtros Rápidos */}
          <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar pedido por ID, cliente, sabor, modelo ou endereço..."
                className="w-full bg-[#141414] border border-[#262626] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <div className="flex items-center gap-1.5 bg-[#141414] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white/70">
                <Clock className="size-3.5 text-white/40" />
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="bg-[#141414] text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="24H" className="bg-[#121212]">Últimas 24h</option>
                  <option value="HOJE" className="bg-[#121212]">Hoje</option>
                  <option value="ONTEM" className="bg-[#121212]">Ontem</option>
                  <option value="7DIAS" className="bg-[#121212]">Últimos 7 dias</option>
                  <option value="30DIAS" className="bg-[#121212]">Últimos 30 dias</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-[#141414] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white/70">
                <Filter className="size-3.5 text-white/40" />
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="bg-[#141414] text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="TODOS" className="bg-[#121212]">Todos Pagamentos</option>
                  <option value="PIX" className="bg-[#121212]">PIX</option>
                  <option value="DINHEIRO" className="bg-[#121212]">Dinheiro</option>
                  <option value="CARTAO" className="bg-[#121212]">Cartão</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabela ERP de Pedidos Concluídos */}
          <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl overflow-hidden">
            {filteredCompletedOrders.length === 0 ? (
              <div className="py-16 text-center text-xs text-white/40">
                Nenhum pedido concluído encontrado com os filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141414] text-white/40 uppercase text-[10px] tracking-wider border-b border-[#222]">
                    <tr>
                      <th className="py-3 px-4 font-extrabold">ID</th>
                      <th className="py-3 px-3 font-extrabold">Hora</th>
                      <th className="py-3 px-4 font-extrabold">Cliente</th>
                      <th className="py-3 px-4 font-extrabold">Itens Resumidos</th>
                      <th className="py-3 px-4 font-extrabold text-right">Total</th>
                      <th className="py-3 px-4 font-extrabold text-center">Pagamento</th>
                      <th className="py-3 px-4 font-extrabold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f1f1f]">
                    {filteredCompletedOrders.map((order) => {
                      const isExpanded = expandedOrderId === order.realId;
                      const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

                      return (
                        <tr key={order.realId} className="hover:bg-white/[0.02] transition-colors">
                          <td colSpan={7} className="p-0">
                            <div 
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.realId)}
                              className="flex items-center justify-between py-3 px-4 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-3 w-full">
                                <span className="font-mono text-white/80 font-bold w-24 shrink-0">
                                  #{order.id}
                                </span>

                                <span className="text-white/40 font-mono w-16 shrink-0 flex items-center gap-1">
                                  <Clock className="size-3 text-white/30" />
                                  {order.time}
                                </span>

                                <div className="w-48 shrink-0 truncate">
                                  <span className="font-bold text-white uppercase">{order.clientName}</span>
                                  {order.phone && <span className="text-[10px] text-white/40 block truncate">{order.phone}</span>}
                                </div>

                                <div className="flex-1 min-w-0 truncate text-white/50">
                                  <span className="text-white/90 font-semibold">
                                    {order.items.length} {order.items.length === 1 ? 'item' : 'itens'} ({itemCount} pods)
                                  </span>
                                  <span className="text-[11px] ml-2 text-white/40 truncate">
                                    — {order.items.map(i => `${i.quantity}x ${i.flavor}`).join(', ')}
                                  </span>
                                </div>

                                <span className="font-mono font-black text-emerald-400 text-sm w-24 text-right shrink-0">
                                  {formatBRL(order.totalAmount)}
                                </span>

                                <div className="w-24 text-center shrink-0">
                                  {getPaymentMethodBadge(order.paymentMethod)}
                                </div>

                                <div className="w-12 flex justify-end shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedOrderId(isExpanded ? null : order.realId);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
                                  >
                                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Detalhes Expandidos */}
                            {isExpanded && (
                              <div className="bg-[#121212]/80 border-t border-[#222] p-4 text-xs space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-1.5">
                                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider block">Itens Detalhados</span>
                                    {order.items.map((it, i) => (
                                      <div key={i} className="flex justify-between items-center text-white/90">
                                        <span><strong className="text-emerald-400">{it.quantity}x</strong> {it.flavor} ({it.model})</span>
                                        <span className="font-mono font-semibold text-white/60">{formatBRL(it.price * it.quantity)}</span>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-1.5">
                                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider block">Endereço de Entrega</span>
                                    <div className="flex items-start gap-1.5 text-white/80">
                                      <MapPin className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                      <span className="leading-snug">{order.address || 'Endereço não informado'}</span>
                                    </div>
                                  </div>

                                  <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-1.5 flex flex-col justify-between">
                                    <div>
                                      <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider block">Pagamento</span>
                                      <div className="flex items-center justify-between mt-1">
                                        {getPaymentMethodBadge(order.paymentMethod)}
                                        <span className="text-emerald-400 font-mono font-bold text-sm">{formatBRL(order.totalAmount)}</span>
                                      </div>
                                    </div>

                                    {order.receiptUrl && (
                                      <a 
                                        href={order.receiptUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-1.5 bg-[#202020] hover:bg-[#2c2c2c] text-xs text-white px-3 py-1.5 rounded-lg border border-[#333] transition-colors mt-2"
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
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedOrderForDispatch(null)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-400 border border-emerald-500/20">
                <Truck className="size-5" />
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Despacho Logístico</h2>
            </div>
            
            <p className="text-xs text-white/50 mb-6">
              Este pedido está pronto para entrega. Como você deseja enviá-lo?
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  updateStatus(selectedOrderForDispatch, 'EM_ROTA', 'proprio');
                  setSelectedOrderForDispatch(null);
                }}
                className="flex items-center gap-4 bg-[#181818] hover:bg-[#222] border border-[#2c2c2c] p-4 rounded-xl transition-all group cursor-pointer"
              >
                <div className="bg-white/5 p-2.5 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                  <Bike className="size-5 text-emerald-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white text-sm">Entregador Próprio da Casa</h3>
                  <p className="text-xs text-white/40 mt-0.5">Motoboy exclusivo (sem rastreio)</p>
                </div>
              </button>

              <button 
                onClick={() => {
                  updateStatus(selectedOrderForDispatch, 'EM_ROTA', 'uber');
                  setSelectedOrderForDispatch(null);
                }}
                className="flex items-center gap-4 bg-[#181818] hover:bg-[#222] border border-[#2c2c2c] hover:border-emerald-500/50 p-4 rounded-xl transition-all group cursor-pointer"
              >
                <div className="bg-black p-2.5 rounded-xl border border-white/10">
                  <div className="size-5 bg-white rounded-sm" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white text-sm">Uber Direct</h3>
                  <p className="text-xs text-white/40 mt-0.5">Integração API com Rastreio em Tempo Real</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * CARDS DOS PEDIDOS (REDESENHADOS PARA ALTA PERFORMANCE OPERACIONAL)
 * Implementa todas as 19 seções do roteiro de UI/UX
 */
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
  const elapsedMinutes = getElapsedMinutes(order.createdAt);
  const urgency = getTimeUrgency(elapsedMinutes);

  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] hover:border-emerald-500/40 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(0,0,0,0.6)] rounded-2xl p-4 flex flex-col gap-3.5 transition-all duration-300 relative group overflow-hidden">
      
      {/* 6. BARRA DE PROGRESSO SUPERIOR (TEMPO DO PEDIDO: VERDE / AMARELO / LARANJA / VERMELHO) */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#181818]">
        <div 
          className={`h-full ${urgency.barColor} transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(10, (elapsedMinutes / 45) * 100))}%` }}
        />
      </div>

      {/* 11 & 5. CABEÇALHO DO CARD: FAIXA DE PRIORIDADE + PEDIDO #ID + TEMPO DESTAQUE */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {/* 11. Faixa/Badge de Prioridade Visual */}
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${urgency.badgeBg}`}>
            <span className={`size-1.5 rounded-full ${urgency.barColor} animate-pulse`} />
            {urgency.label}
          </span>
          <span className="text-[10px] font-mono font-bold text-white/40 uppercase">#{order.id}</span>
        </div>

        {/* 5. Tempo do Pedido em Destaque */}
        <div className={`flex items-center gap-1 text-[11px] font-black font-mono px-2.5 py-0.5 rounded-lg border ${
          urgency.level === 'urgente' 
            ? 'bg-red-500/10 text-red-400 border-red-500/30' 
            : urgency.level === 'atencao' 
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
            : 'bg-white/5 text-white/70 border-white/10'
        }`}>
          <Clock className="size-3" />
          há {elapsedMinutes} min
        </div>
      </div>

      {/* 4. CLIENTE EM DESTAQUE (Elemento Principal do Card) */}
      <div className="border-b border-[#1c1c1c] pb-2.5">
        <h4 className="font-black text-base lg:text-lg text-white uppercase tracking-tight group-hover:text-emerald-400 transition-colors leading-tight">
          {order.clientName}
        </h4>
      </div>

      {/* 7. PRODUTO PRINCIPAL & ITENS (Quantidade e Produto Muito Maiores) */}
      <div className="flex flex-col gap-2 py-0.5">
        <span className="text-[9px] font-extrabold tracking-widest text-white/30 uppercase">Itens do Pedido</span>
        {order.items.map((item, idx) => (
          <div key={idx} className="flex flex-col bg-[#141414] border border-[#222] p-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-black text-base tracking-tight shrink-0 select-none">
                {item.quantity}x
              </span>
              <span className="font-black text-sm text-white uppercase tracking-wide">
                {item.flavor}
              </span>
            </div>
            {item.model && (
              <span className="text-[10px] font-semibold text-white/40 mt-0.5 ml-7">
                {item.model}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 8. ENDEREÇO COMPACTO */}
      <div className="flex items-center justify-between gap-2 text-xs bg-[#141414] p-2.5 rounded-xl border border-[#222]">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-white/70">
          <MapPin className="size-3.5 shrink-0 text-white/40" />
          <span className="truncate text-[11px] font-medium leading-snug">{order.address}</span>
        </div>

        {/* Taxa de Entrega Compacta */}
        <div className="shrink-0">
          <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] flex items-center gap-1 ${
            order.shippingFee > 0 
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
              : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
          }`}>
            <Bike className="size-3" />
            {order.shippingFee > 0 ? formatBRL(order.shippingFee) : 'Grátis'}
          </span>
        </div>
      </div>

      {/* 9 & 12. VALOR DO PEDIDO E FORMA DE PAGAMENTO */}
      <div className="flex items-center justify-between border-t border-[#1c1c1c] pt-3">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase text-white/40 tracking-wider font-extrabold">Total</span>
          <span className="font-mono font-black text-lg lg:text-xl text-emerald-400 mt-0.5">{formatBRL(order.totalAmount)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* 12. Badge da Forma de Pagamento */}
          {getPaymentMethodBadge(order.paymentMethod)}

          {/* Recibo (se houver) */}
          {order.receiptUrl && (
            <a 
              href={order.receiptUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1 text-[10px] font-bold text-white/70 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] px-2 py-1 rounded-lg border border-[#333] transition-colors"
            >
              <ReceiptText className="size-3" />
              Recibo
            </a>
          )}
        </div>
      </div>

      {/* 10. BOTÕES DE AÇÃO (1 AÇÃO PRINCIPAL EM DESTAQUE + SECUNDÁRIOS MENORES) */}
      <div className="mt-1 flex flex-col gap-2">
        {order.status === 'AGUARDANDO_PAGAMENTO' && (
          <div className="flex flex-col gap-2">
            {/* Ação Principal Destaque */}
            <button 
              onClick={() => onUpdate(order.realId, 'PREPARANDO')}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-[0.98] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              ✓ Confirmar Pagamento
            </button>

            {/* Secundários Menores */}
            <div className="grid grid-cols-2 gap-2">
              {order.phone ? (
                <a
                  href={`https://wa.me/${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Oi ${order.clientName}, tudo certo? Estou verificando o seu pagamento do pedido #${order.id}, consegue me mandar o comprovante?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#161616] hover:bg-[#222] text-white/60 hover:text-white text-[11px] font-bold py-2 rounded-xl border border-[#262626] transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-center"
                >
                  📱 WhatsApp
                </a>
              ) : <div />}
              
              <button 
                onClick={() => onDelete(order.realId)}
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-bold py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                ❌ Recusar
              </button>
            </div>
          </div>
        )}

        {order.status === 'PREPARANDO' && (
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate(order.realId, 'AGUARDANDO_PAGAMENTO')}
              className="bg-[#161616] hover:bg-[#222] text-white/60 hover:text-white text-xs font-bold px-3 py-3 rounded-xl border border-[#262626] transition-colors shrink-0 cursor-pointer"
              title="Voltar status"
            >
              ← Voltar
            </button>
            <button 
              onClick={onDispatchClick}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] uppercase tracking-wider"
            >
              Despachar →
            </button>
          </div>
        )}

        {order.status === 'EM_ROTA' && (
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate(order.realId, 'PREPARANDO')}
              className="bg-[#161616] hover:bg-[#222] text-white/60 hover:text-white text-xs font-bold px-3 py-3 rounded-xl border border-[#262626] transition-colors shrink-0 cursor-pointer"
              title="Voltar status"
            >
              ← Voltar
            </button>
            <button 
              onClick={() => onUpdate(order.realId, 'ENTREGUE')}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] uppercase tracking-wider"
            >
              ✓ Marcar Entregue
            </button>
          </div>
        )}

        {order.status === 'ENTREGUE' && (
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate(order.realId, 'EM_ROTA')}
              className="bg-[#161616] hover:bg-[#222] text-white/60 hover:text-white text-xs font-bold px-3 py-3 rounded-xl border border-[#262626] transition-colors shrink-0 cursor-pointer"
              title="Voltar para Rota"
            >
              ← Voltar
            </button>
            <button 
              onClick={() => onUpdate(order.realId, 'CONCLUIDO')}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] uppercase tracking-wider"
            >
              ✓ Concluir
            </button>
          </div>
        )}

        {order.status === 'CONCLUIDO' && (
          <button 
            onClick={() => onUpdate(order.realId, 'ENTREGUE')}
            className="w-full bg-[#161616] hover:bg-[#222] text-white/50 hover:text-white text-[11px] font-bold py-2.5 rounded-xl border border-[#262626] transition-colors cursor-pointer"
          >
            Reabrir Pedido
          </button>
        )}
      </div>
    </div>
  );
}
