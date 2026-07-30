import { useState, useEffect } from "react";
import { Bot, Clock, MessageSquare, Send, Loader2, RefreshCw } from "lucide-react";
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
        <Loader2 className="size-8 text-primary animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Calculando ciclo de vida dos pods dos clientes...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Explicativo */}
      <div className="bg-card border border-border p-6 rounded-2xl flex items-start gap-4">
        <div className="bg-primary/20 p-3 rounded-xl text-primary shrink-0">
          <Clock className="size-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            Pipeline de Secagem do Vape (Ciclo de Vida)
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono">
              Tempo Real
            </span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
            O sistema calcula automaticamente quando o vape do cliente deve acabar com base na quantidade de Puffs e na data da última compra. 
            Dispare um lembrete com 1 clique diretamente no WhatsApp do cliente antes que o pod dele acabe!
          </p>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          <p className="text-sm">Nenhum pedido registrado no banco para calcular a secagem.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {clients.map(item => {
            const progress = Math.min((item.daysSinceLastOrder / item.expectedCycleDays) * 100, 100);
            const isOverdue = item.daysSinceLastOrder >= item.expectedCycleDays;
            const isNearEnd = progress >= 70;

            const phoneClean = item.phone.replace(/\D/g, '');
            const msg = `Fala ${item.name}! Tudo bem? Passando pra avisar que seu ${item.lastProduct} já tá chegando no fim do ciclo (${item.daysSinceLastOrder} dias de uso)! Separamos uma promoção de reposição pra você hoje. Quer dar uma olhada no cardápio?`;
            const waUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`;

            return (
              <div 
                key={item.id} 
                className="bg-elevated border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row gap-6 md:items-center justify-between hover:border-white/10 transition-colors"
              >
                <div 
                  className="flex items-center gap-4 cursor-pointer" 
                  onClick={() => onSelectClient(item)}
                >
                  <div className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center font-bold text-silver border border-white/10 shrink-0">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white hover:text-primary transition-colors flex items-center gap-2">
                      {item.name}
                      {isOverdue && (
                        <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-bold uppercase">
                          Vape Secou
                        </span>
                      )}
                    </h4>
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                      Comprou <strong className="text-silver">{item.lastProduct}</strong> há <strong className="text-white">{item.daysSinceLastOrder} dias</strong> ({item.lastOrderDate})
                    </div>
                  </div>
                </div>

                <div className="flex-1 max-w-md">
                  <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-muted-foreground">Progresso do Vape</span>
                    <span className={isOverdue ? 'text-red-400 font-bold' : isNearEnd ? 'text-yellow-400 font-bold' : 'text-emerald-400'}>
                      {isOverdue ? 'Secou! (100%)' : isNearEnd ? `Quase no Fim (${progress.toFixed(0)}%)` : `Vape Cheio (${progress.toFixed(0)}%)`}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-background rounded-full overflow-hidden border border-white/5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOverdue ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                        isNearEnd ? 'bg-yellow-500' : 'bg-emerald-500'
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold transition-all shadow-sm active:scale-95"
                  >
                    <Send className="size-3.5" />
                    Enviar Oferta no Zap
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
