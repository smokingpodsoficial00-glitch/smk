import { useState, useEffect } from "react";
import { formatBRL } from "@/lib/cart"; 
import { Clock, MapPin, ReceiptText, CheckCircle2, Truck, Bike, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

    // Inscrição Realtime no canal do Supabase
    const subscription = supabase
      .channel('smoking_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
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
  const completed24hOrders = orders.filter(o => o.status === 'CONCLUIDO');

  const totalCompletedAmount24h = completed24hOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCompletedItems24h = completed24hOrders.reduce((sum, o) => sum + o.items.reduce((iSum, i) => iSum + i.quantity, 0), 0);

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
            Concluídos 24h ({completed24hOrders.length})
          </button>
        </div>
      </header>

      {/* Conteúdo da Aba: KANBAN EM ANDAMENTO */}
      {activeTab === 'kanban' && (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-6 h-full items-start min-w-max">
            {columns.map(col => {
              const colOrders = orders.filter(o => o.status === col.status);
              return (
                <div key={col.title} className="w-80 flex flex-col h-full max-h-full">
                  <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                    <h3 className="font-medium text-silver">{col.title}</h3>
                    <span className="grid place-items-center bg-elevated text-xs font-semibold size-6 rounded-full">
                      {colOrders.length}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-4 overflow-y-auto pb-4 pr-2 custom-scrollbar">
                    {colOrders.map(order => (
                      <OrderCard 
                        key={order.realId} 
                        order={order} 
                        onUpdate={(realId, newStatus) => updateStatus(realId, newStatus)} 
                        onDispatchClick={() => setSelectedOrderForDispatch(order.realId)}
                      />
                    ))}
                    {colOrders.length === 0 && (
                      <div className="border border-dashed border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
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

      {/* Conteúdo da Aba: ABA EXTENSA DE CONCLUÍDOS (24H) */}
      {activeTab === 'concluidos' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Banner de Estatísticas das últimas 24h */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-emerald-500/20 rounded-2xl p-5 flex flex-col justify-between">
              <span className="text-xs uppercase text-muted-foreground font-semibold">Faturamento Concluído (24h)</span>
              <div className="text-3xl font-bold text-emerald-400 font-mono mt-2">
                {formatBRL(totalCompletedAmount24h)}
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between">
              <span className="text-xs uppercase text-muted-foreground font-semibold">Total de Entregas Finalizadas</span>
              <div className="text-3xl font-bold text-silver font-mono mt-2">
                {completed24hOrders.length} <span className="text-sm font-sans text-muted-foreground">pedidos ({totalCompletedItems24h} pods)</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between">
              <span className="text-xs uppercase text-muted-foreground font-semibold">Janela de Retenção</span>
              <div className="text-lg font-medium text-silver mt-2 flex items-center gap-2">
                <Clock className="size-4 text-emerald-400" />
                Últimas 24 Horas
              </div>
            </div>
          </div>

          {/* Grid Extenso com Todos os Pedidos Concluídos */}
          {completed24hOrders.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl py-16 text-center text-muted-foreground">
              Nenhum pedido concluído nas últimas 24 horas.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completed24hOrders.map(order => (
                <OrderCard 
                  key={order.realId} 
                  order={order} 
                  onUpdate={(realId, newStatus) => updateStatus(realId, newStatus)} 
                  onDispatchClick={() => {}}
                />
              ))}
            </div>
          )}
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
