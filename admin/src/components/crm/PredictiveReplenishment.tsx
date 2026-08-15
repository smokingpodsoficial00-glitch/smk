import { useState, useEffect } from "react";
import { Clock, Send, Loader2, Sparkles, MessageCircle, AlertTriangle, Flame, CheckCircle2, Calendar } from "lucide-react";
import { fetchLiveClients, type RealClient } from "@/lib/crm";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export function PredictiveReplenishment({ onSelectClient }: { onSelectClient: (client: RealClient) => void }) {
  const { company } = useAuth();
  const [clients, setClients] = useState<RealClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'urgent' | 'warning' | 'ok'>('all');

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
      .channel('replenishment_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_orders' }, loadClients)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_clients' }, loadClients)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="size-8 text-emerald-400 animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Calculando estimativa de término de pods e datas de recompra...</p>
      </div>
    );
  }

  const urgentClients = clients.filter(c => c && c.urgencyLevel === 'urgent');
  const warningClients = clients.filter(c => c && c.urgencyLevel === 'warning');
  const okClients = clients.filter(c => c && c.urgencyLevel === 'ok');

  const filteredClients = urgencyFilter === 'all'
    ? clients
    : clients.filter(c => c && c.urgencyLevel === urgencyFilter);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Banner Explicativo com Estatísticas */}
      <div className="bg-card border border-border p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Clock className="size-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Radar Preditivo de Recompra (Ciclo por Puffs)
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase font-mono">
                IA Preditiva Ativa
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              O sistema monitora a capacidade do pod comprado (5k, 10k, 15k, 20k puffs) e estima a data de esgotamento. 
              Dispare antes do final de semana ou antes que o cliente compre na concorrência!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold font-mono">
            🔴 {urgentClients.length} Pods Secos
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold font-mono">
            🟡 {warningClients.length} Secando
          </span>
        </div>
      </div>

      {/* Seletor de Abas de Criticidade */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setUrgencyFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            urgencyFilter === 'all'
              ? 'bg-white/10 text-white border border-white/20 shadow-sm'
              : 'text-muted-foreground hover:bg-white/5 border border-transparent'
          }`}
        >
          Todos os Clientes ({clients.length})
        </button>

        <button
          onClick={() => setUrgencyFilter('urgent')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            urgencyFilter === 'urgent'
              ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
              : 'text-muted-foreground hover:bg-white/5 border border-transparent'
          }`}
        >
          <span className="size-2 rounded-full bg-red-500 animate-ping" />
          🔴 Disparo Urgente Hoje ({urgentClients.length})
        </button>

        <button
          onClick={() => setUrgencyFilter('warning')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            urgencyFilter === 'warning'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-muted-foreground hover:bg-white/5 border border-transparent'
          }`}
        >
          🟡 Fim Próximo (1 a 4 dias) ({warningClients.length})
        </button>

        <button
          onClick={() => setUrgencyFilter('ok')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            urgencyFilter === 'ok'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-muted-foreground hover:bg-white/5 border border-transparent'
          }`}
        >
          🟢 Pod Novo em Uso ({okClients.length})
        </button>
      </div>

      {filteredClients.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          <p className="text-sm">Nenhum cliente com compras nessa categoria de urgência.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map(item => {
            const progress = Math.min((item.daysSinceLastOrder / item.expectedCycleDays) * 100, 100);
            const isOverdue = item.urgencyLevel === 'urgent';
            const isNearEnd = item.urgencyLevel === 'warning';

            const phoneClean = item.cleanPhone || item.phone.replace(/\D/g, '');
            const msg = `E aí ${item.name}! Tudo certo? 💨 Vi que já faz um tempinho desde a sua última compra do ${item.lastProduct}. Seu pod já tá na final? Já quer ir garantindo o próximo para não ficar na mão no rolê? Me avisa aqui!`;
            const waUrl = item.whatsappUrl || `https://wa.me/${phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean}?text=${encodeURIComponent(msg)}`;

            return (
              <div 
                key={item.id} 
                className={`border rounded-2xl p-5 flex flex-col md:flex-row gap-6 md:items-center justify-between transition-all ${
                  isOverdue 
                    ? 'bg-[#120808] border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
                    : isNearEnd
                    ? 'bg-[#120f08] border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                    : 'bg-card border-border hover:border-white/20'
                }`}
              >
                <div 
                  className="flex items-center gap-4 cursor-pointer min-w-[280px]" 
                  onClick={() => onSelectClient(item)}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-white border border-white/20 shrink-0 text-base">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base hover:text-emerald-400 transition-colors flex items-center gap-2">
                      {item.name}
                      {isOverdue ? (
                        <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                          🔴 Pod Secou
                        </span>
                      ) : isNearEnd ? (
                        <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                          🟡 Faltam ~{item.estimatedDaysLeft}d
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                          🟢 Pod Novo
                        </span>
                      )}
                    </h4>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
                      <span>Último: <strong className="text-white font-medium">{item.lastProduct}</strong> ({item.lastPuffs} puffs)</span>
                      <span>•</span>
                      <span className="text-white/70 font-mono">compra em {item.lastOrderDate}</span>
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso do Ciclo */}
                <div className="flex-1 max-w-sm">
                  <div className="flex justify-between text-xs mb-1.5 font-bold">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3 text-muted-foreground" />
                      Reposição: {item.nextReplenishmentDate}
                    </span>
                    <span className={isOverdue ? 'text-red-400 font-mono' : isNearEnd ? 'text-amber-400 font-mono' : 'text-emerald-400 font-mono'}>
                      {isOverdue ? `Atrasado há ${item.daysSinceLastOrder - item.expectedCycleDays}d` : `${progress.toFixed(0)}% do ciclo`}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#141414] rounded-full overflow-hidden border border-white/5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOverdue ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]' : 
                        isNearEnd ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-emerald-500'
                      }`} 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Botão de Disparo 1-a-1 */}
                <div className="flex items-center gap-3 justify-end shrink-0">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      isOverdue 
                        ? 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                        : isNearEnd
                        ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    }`}
                  >
                    <MessageCircle className="size-3.5" />
                    <span>Lembrete Recompra</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

