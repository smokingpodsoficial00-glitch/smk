import { useState, useEffect } from "react";
import { Star, UserCheck, Crown, ShieldAlert, Phone, Loader2, MessageSquare, Trophy } from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { fetchLiveClients, type RealClient } from "@/lib/crm";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export function RFMMatrix({ onSelectClient }: { onSelectClient: (client: RealClient) => void }) {
  const { company } = useAuth();
  const [clients, setClients] = useState<RealClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSegment, setFilterSegment] = useState<string>('all');

  const loadClients = async () => {
    try {
      const live = await fetchLiveClients(company?.id);
      setClients(Array.isArray(live) ? live : []);
    } catch (err) {
      console.error("Erro no loadClients:", err);
      setClients([]);
    } finally {
      setLoading(false);
    }
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
  }, [company?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="size-8 text-primary animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Carregando Ranking de Clientes...</p>
      </div>
    );
  }

  const champions = clients.filter(c => c && c.segment === 'champion');
  const loyals = clients.filter(c => c && c.segment === 'loyal');
  const atRisk = clients.filter(c => c && c.segment === 'at_risk');

  const filteredClients = filterSegment === 'all' 
    ? clients 
    : clients.filter(c => c && c.segment === filterSegment);

  return (
    <div className="flex flex-col gap-6">
      {/* Cards de Categorização por Recorrência e LTV */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => setFilterSegment(filterSegment === 'champion' ? 'all' : 'champion')}
          className={`bg-card border p-5 rounded-2xl cursor-pointer transition-all ${filterSegment === 'champion' ? 'border-amber-500/50 bg-amber-500/5' : 'border-border hover:border-white/10'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Crown className="size-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">🥇 Clientes VIPs</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">LTV Alto</span>
          </div>
          <div className="text-2xl font-bold text-white">{champions.length} clientes</div>
          <p className="text-xs text-muted-foreground mt-1">Os clientes que mais compram e geram maior faturamento.</p>
        </div>

        <div 
          onClick={() => setFilterSegment(filterSegment === 'loyal' ? 'all' : 'loyal')}
          className={`bg-card border p-5 rounded-2xl cursor-pointer transition-all ${filterSegment === 'loyal' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border hover:border-white/10'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCheck className="size-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">🔄 Clientes Recorrentes</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Frequentes</span>
          </div>
          <div className="text-2xl font-bold text-white">{loyals.length} clientes</div>
          <p className="text-xs text-muted-foreground mt-1">Clientes fiéis que fazem pedidos periodicamente.</p>
        </div>

        <div 
          onClick={() => setFilterSegment(filterSegment === 'at_risk' ? 'all' : 'at_risk')}
          className={`bg-card border p-5 rounded-2xl cursor-pointer transition-all ${filterSegment === 'at_risk' ? 'border-red-500/50 bg-red-500/5' : 'border-border hover:border-white/10'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldAlert className="size-4 text-red-400" />
              <h3 className="text-sm font-bold text-white">⚠️ Clientes em Risco</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Sumidos +25d</span>
          </div>
          <div className="text-2xl font-bold text-white">{atRisk.length} clientes</div>
          <p className="text-xs text-muted-foreground mt-1">Não compram há tempo. Excelente oportunidade de reconquista!</p>
        </div>
      </div>

      {/* Tabela Principal de Clientes */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between bg-black/40">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Trophy className="size-4 text-amber-400" />
              Ranking Completo de Clientes ({filteredClients.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Cada telefone WhatsApp gera um único registro acumulando o LTV total gasto.</p>
          </div>
          {filterSegment !== 'all' && (
            <button 
              onClick={() => setFilterSegment('all')}
              className="text-xs text-white hover:underline font-semibold bg-white/10 px-3 py-1.5 rounded-lg border border-white/20"
            >
              Mostrar Todos
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
              <thead className="text-xs text-muted-foreground uppercase bg-white/5 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold text-white">Cliente & Telefone</th>
                  <th className="px-6 py-4 font-bold text-white">Classificação</th>
                  <th className="px-6 py-4 font-bold text-white">LTV (Total Gasto)</th>
                  <th className="px-6 py-4 font-bold text-white">Pedidos</th>
                  <th className="px-6 py-4 font-bold text-white">Última Compra</th>
                  <th className="px-6 py-4 font-bold text-white text-right">Ação WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredClients.map(client => {
                  if (!client) return null;
                  const phoneClean = (client.phone || '').replace(/\D/g, '');
                  const waUrl = client.whatsappUrl || `https://wa.me/${phoneClean}?text=${encodeURIComponent(`Olá ${client.name || 'Cliente'}, tudo bem? Aqui é da Smoking Pods!`)}`;

                  return (
                    <tr 
                      key={client.id || phoneClean} 
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4" onClick={() => onSelectClient(client)}>
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-white/10 flex items-center justify-center font-bold text-white border border-white/20 group-hover:border-white transition-colors">
                            {(client.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-amber-400 transition-colors">
                              {client.name || 'Cliente'}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="size-3 text-muted-foreground/60" />
                              {client.phone || 'Sem telefone'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4" onClick={() => onSelectClient(client)}>
                        {client.segment === 'champion' && (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
                            <Crown className="size-3.5" /> 🥇 VIP (LTV Alto)
                          </span>
                        )}
                        {client.segment === 'loyal' && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
                            <UserCheck className="size-3.5" /> 🔄 Recorrente
                          </span>
                        )}
                        {client.segment === 'new' && (
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
                            <Star className="size-3.5" /> ✨ Novato
                          </span>
                        )}
                        {client.segment === 'at_risk' && (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
                            <ShieldAlert className="size-3.5" /> ⚠️ Em Risco
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 font-mono font-extrabold text-emerald-400 text-base" onClick={() => onSelectClient(client)}>
                        {formatBRL(client.spent || 0)}
                      </td>

                      <td className="px-6 py-4 font-mono font-semibold text-white" onClick={() => onSelectClient(client)}>
                        {client.ordersCount || 1} {client.ordersCount === 1 ? 'pedido' : 'pedidos'}
                      </td>

                      <td className="px-6 py-4 text-xs text-muted-foreground" onClick={() => onSelectClient(client)}>
                        <div className="font-semibold text-white">{client.lastOrderDate || 'Hoje'}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {client.daysSinceLastOrder === 0 ? 'Hoje' : `há ${client.daysSinceLastOrder || 0} dias`}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all cursor-pointer"
                            title="Abrir conversa no WhatsApp"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>WhatsApp</span>
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
