import { X, MessageSquare, ShoppingBag, MapPin, Phone, Crown, Calendar, PackageCheck, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { RealClient } from "@/lib/crm";

export function ClientProfileModal({ client, onClose }: { client: RealClient, onClose: () => void }) {
  const phoneClean = client.phone.replace(/\D/g, '');
  const waUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(`Olá ${client.name}! Tudo bem?`)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-end p-0">
      <div className="bg-[#0a0a0a] border-l border-border h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header do Perfil 360 */}
        <header className="px-6 py-5 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xl font-bold border border-primary/30">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{client.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                  <Phone className="size-3 text-muted-foreground/60" /> {client.phone}
                </span>
                {client.segment === 'champion' && (
                  <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1">
                    <Crown className="size-3" /> VIP Champion
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/5 rounded-full text-muted-foreground hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border p-4 rounded-xl">
              <h4 className="text-xs text-muted-foreground mb-1">Lifetime Value (LTV Real)</h4>
              <p className="text-xl font-bold text-emerald-400 font-mono">{formatBRL(client.spent)}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl">
              <h4 className="text-xs text-muted-foreground mb-1">Total de Pedidos Realizados</h4>
              <p className="text-xl font-bold text-white font-mono">{client.ordersCount} pedidos</p>
            </div>
          </div>

          {/* Endereço de Entrega */}
          <div className="bg-card border border-border p-4 rounded-xl">
            <h4 className="text-xs font-semibold text-silver mb-2 flex items-center gap-2">
              <MapPin className="size-4 text-emerald-400" />
              Endereço Principal de Entrega
            </h4>
            <p className="text-sm text-muted-foreground font-mono">
              {client.address}
            </p>
          </div>

          {/* Histórico Real de Pedidos */}
          <div>
            <h3 className="text-sm font-semibold text-silver mb-4 flex items-center gap-2">
              <ShoppingBag className="size-4 text-primary" />
              Histórico do Cliente ({client.orders.length} pedidos registrados)
            </h3>

            <div className="flex flex-col gap-3">
              {client.orders.map((order, idx) => {
                const orderDate = new Date(order.created_at).toLocaleDateString('pt-BR');
                const items: any[] = Array.isArray(order.items) ? order.items : [];

                return (
                  <div key={order.id || idx} className="bg-elevated border border-white/5 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                        <Calendar className="size-3" />
                        {orderDate}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {order.delivery_status || 'ENTREGUE'}
                      </span>
                    </div>

                    <div className="text-sm font-medium text-white">
                      {items.map(i => `${i.quantity || 1}x ${i.name || 'Pod'} ${i.flavor || ''}`).join(', ') || 'Pod Descartável'}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5">
                      <span>Valor Total</span>
                      <span className="font-mono font-bold text-silver">{formatBRL(parseFloat(order.total_amount || 0))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer com Ação no WhatsApp */}
        <footer className="p-4 border-t border-border bg-card">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <MessageSquare className="size-4" />
            Abrir Conversa no WhatsApp
          </a>
        </footer>

      </div>
    </div>
  );
}
