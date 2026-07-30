import { useState, useEffect } from "react";
import { Clock, Send, Loader2, Sparkles, MessageCircle } from "lucide-react";
import { fetchLiveClients, type RealClient } from "@/lib/crm";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export function PredictiveReplenishment({ onSelectClient }: { onSelectClient: (client: RealClient) => void }) {
  const { company } = useAuth();
  const [clients, setClients] = useState<RealClient[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClients = async () => {
    const live = await fetchLiveClients(company?.id);
    setClients(live);
    setLoading(false);
  };

  useEffect(() => {
    loadClients();

    const channel = supabase
      .channel('replenishment_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_orders' }, loadClients)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="size-8 text-white animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Calculando estimativa de término de pods dos clientes...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Explicativo */}
      <div className="bg-card border border-border p-6 rounded-2xl flex items-start gap-4 shadow-lg">
        <div className="bg-white/10 border border-white/20 p-3 rounded-xl text-white shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.15)]">
          <Clock className="size-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Aviso de Fim de Pod & Lembretes de Recompra
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
              Tempo Real
            </span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
            Quando um cliente compra um Pod, o sistema calcula a quantidade estimada de dias até o pod acabar. 
            Envie uma mensagem direta no WhatsApp falando: <em className="text-white font-medium">"Seu pod já tá na final? Já quer ir comprando outro?"</em> com apenas 1 clique!
          </p>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          <p className="text-sm">Nenhum cliente com compras recentes para calcular o término do pod.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {clients.map(item => {
            const progress = Math.min((item.daysSinceLastOrder / item.expectedCycleDays) * 100, 100);
            const isOverdue = item.daysSinceLastOrder >= item.expectedCycleDays;
            const isNearEnd = item.estimatedDaysLeft <= 4 || progress >= 75;

            const phoneClean = item.cleanPhone || item.phone.replace(/\D/g, '');
            const msg = `E aí ${item.name}! Tudo certo? 💨 Vi que já faz um tempinho desde a sua última compra do ${item.lastProduct}. Seu pod já tá na final? Já quer ir garantindo o próximo para não ficar na mão? Me avisa aqui!`;
            const waUrl = item.whatsappUrl || `https://wa.me/${phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean}?text=${encodeURIComponent(msg)}`;

            return (
              <div 
                key={item.id} 
                className={`border rounded-2xl p-5 flex flex-col md:flex-row gap-6 md:items-center justify-between transition-all ${
                  isNearEnd || isOverdue 
                    ? 'bg-[#0f0f0f] border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
                    : 'bg-card border-border hover:border-white/20'
                }`}
              >
                <div 
                  className="flex items-center gap-4 cursor-pointer" 
                  onClick={() => onSelectClient(item)}
                >
                  <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center font-bold text-white border border-white/20 shrink-0">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base hover:text-amber-400 transition-colors flex items-center gap-2">
                      {item.name}
                      {isOverdue ? (
                        <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-full font-extrabold uppercase animate-pulse">
                          🔴 Pod Possivelmente Acabou
                        </span>
                      ) : isNearEnd ? (
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                          ⚠️ Pod no Fim (Faltam ~{item.estimatedDaysLeft} dias)
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                          🟢 Pod Novo
                        </span>
                      )}
                    </h4>
                    <div className="text-xs text-muted-foreground mt-1">
                      Última compra: <strong className="text-white font-medium">{item.lastProduct}</strong> ({item.lastPuffs} puffs) há <strong className="text-white font-mono">{item.daysSinceLastOrder} dias</strong> em {item.lastOrderDate}
                    </div>
                  </div>
                </div>

                <div className="flex-1 max-w-md">
                  <div className="flex justify-between text-xs mb-1.5 font-bold">
                    <span className="text-muted-foreground">Ciclo de Uso Estimado</span>
                    <span className={isOverdue ? 'text-red-400' : isNearEnd ? 'text-amber-400' : 'text-emerald-400'}>
                      {isOverdue ? 'Acabou! (100%)' : isNearEnd ? `Fim Próximo (${progress.toFixed(0)}%)` : `Em uso (${progress.toFixed(0)}%)`}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#141414] rounded-full overflow-hidden border border-[#222]">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOverdue ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]' : 
                        isNearEnd ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-emerald-500'
                      }`} 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-end shrink-0">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95 cursor-pointer"
                  >
                    <MessageCircle className="size-4 fill-black text-emerald-500" />
                    <span>💬 Enviar Lembrete WhatsApp</span>
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
