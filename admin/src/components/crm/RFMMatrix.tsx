import { useState, useEffect } from "react";
import { Star, AlertTriangle, TrendingUp, UserCheck, Crown, ShieldAlert, Phone, Loader2, MessageSquare, ExternalLink } from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { fetchLiveClients, RealClient } from "@/lib/crm";
import { supabase } from "@/lib/supabase";

export function RFMMatrix({ onSelectClient }: { onSelectClient: (client: RealClient) => void }) {
  const [clients, setClients] = useState<RealClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSegment, setFilterSegment] = useState<string>('all');

  const loadClients = async () => {
    const live = await fetchLiveClients();
    setClients(live);
    setLoading(false);
  };

  useEffect(() => {
    loadClients();

    const channel = supabase
      .channel('rfm_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_orders' }, loadClients)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="size-8 text-primary animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Carregando Matriz RFM de clientes reais...</p>
      </div>
    );
  }

  const champions = clients.filter(c => c.segment === 'champion');
  const loyals = clients.filter(c => c.segment === 'loyal');
  const atRisk = clients.filter(c => c.segment === 'at_risk');

  const filteredClients = filterSegment === 'all' 
    ? clients 
    : clients.filter(c => c.segment === filterSegment);

  return (
    <div className="flex flex-col gap-6">
      {/* Cards de Métricas do CRM */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => setFilterSegment(filterSegment === 'champion' ? 'all' : 'champion')}
          className={`bg-card border p-5 rounded-2xl cursor-pointer transition-all ${filterSegment === 'champion' ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border hover:border-white/10'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Crown className="size-4 text-yellow-500" />
              <h3 className="text-sm font-medium">Champions (VIPs)</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">LTV Alto</span>
          </div>
          <div className="text-2xl font-bold text-white">{champions.length} clientes</div>
          <p className="text-xs text-muted-foreground mt-1">Clientes de maior valor e frequência de recompra.</p>
        </div>

        <div 
          onClick={() => setFilterSegment(filterSegment === 'loyal' ? 'all' : 'loyal')}
          className={`bg-card border p-5 rounded-2xl cursor-pointer transition-all ${filterSegment === 'loyal' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border hover:border-white/10'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCheck className="size-4 text-emerald-400" />
              <h3 className="text-sm font-medium">Clientes Leais</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Recorrentes</span>
          </div>
          <div className="text-2xl font-bold text-white">{loyals.length} clientes</div>
          <p className="text-xs text-muted-foreground mt-1">Base sólida que faz pedidos periodicamente.</p>
        </div>

        <div 
          onClick={() => setFilterSegment(filterSegment === 'at_risk' ? 'all' : 'at_risk')}
          className={`bg-card border p-5 rounded-2xl cursor-pointer transition-all ${filterSegment === 'at_risk' ? 'border-red-500/50 bg-red-500/5' : 'border-border hover:border-white/10'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldAlert className="size-4 text-red-400" />
              <h3 className="text-sm font-medium">Em Risco (Win-back)</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-400">Sem pedido 30d+</span>
          </div>
          <div className="text-2xl font-bold text-white">{atRisk.length} clientes</div>
          <p className="text-xs text-muted-foreground mt-1">Oportunidade para enviar cupom de reposição.</p>
        </div>
      </div>

      {/* Tabela Principal de Clientes Reais */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-elevated/30">
          <div>
            <h3 className="font-semibold text-silver">Listagem de Clientes Reais ({filteredClients.length})</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Clique em um cliente para ver o histórico completo de pedidos e endereço.</p>
          </div>
          {filterSegment !== 'all' && (
            <button 
              onClick={() => setFilterSegment('all')}
              className="text-xs text-primary hover:underline font-semibold"
            >
              Mostrar Todos os Clientes
            </button>
          )}
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm">Nenhum cliente registrado nesta categoria ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-elevated/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Cliente & Telefone</th>
                  <th className="px-6 py-4 font-medium">Segmento RFM</th>
                  <th className="px-6 py-4 font-medium">LTV (Gasto Total)</th>
                  <th className="px-6 py-4 font-medium">Pedidos</th>
                  <th className="px-6 py-4 font-medium">Última Compra</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredClients.map(client => {
                  const phoneClean = client.phone.replace(/\D/g, '');
                  const waUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(`Olá ${client.name}, tudo bem? Aqui é da Smoking Pods!`)}`;

                  return (
                    <tr 
                      key={client.id} 
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4" onClick={() => onSelectClient(client)}>
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-elevated flex items-center justify-center font-bold text-silver border border-white/10 group-hover:border-primary/50 transition-colors">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white group-hover:text-primary transition-colors">
                              {client.name}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="size-3 text-muted-foreground/60" />
                              {client.phone}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4" onClick={() => onSelectClient(client)}>
                        {client.segment === 'champion' && (
                          <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit">
                            <Crown className="size-3.5" /> VIP Champion
                          </span>
                        )}
                        {client.segment === 'loyal' && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit">
                            <UserCheck className="size-3.5" /> Leal
                          </span>
                        )}
                        {client.segment === 'new' && (
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit">
                            <Star className="size-3.5" /> Novato
                          </span>
                        )}
                        {client.segment === 'at_risk' && (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit">
                            <AlertTriangle className="size-3.5" /> Em Risco
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 font-mono font-bold text-emerald-400" onClick={() => onSelectClient(client)}>
                        {formatBRL(client.spent)}
                      </td>

                      <td className="px-6 py-4 font-mono text-silver" onClick={() => onSelectClient(client)}>
                        {client.ordersCount} {client.ordersCount === 1 ? 'pedido' : 'pedidos'}
                      </td>

                      <td className="px-6 py-4 text-xs text-muted-foreground" onClick={() => onSelectClient(client)}>
                        <div>{client.lastOrderDate}</div>
                        <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {client.daysSinceLastOrder === 0 ? 'Hoje' : `há ${client.daysSinceLastOrder} dias`}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-all"
                            title="Abrir WhatsApp"
                          >
                            <MessageSquare className="size-3.5" />
                            WhatsApp
                          </a>
                        </div>
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
  );
}
