import { Bot, CheckCircle2, Clock, Send } from "lucide-react";

const pipelineData = [
  { id: "c4", name: "Ana Souza", product: "Ignite V50", puffs: "5000", daysSincePurchase: 18, expectedCycle: 20, status: "pending_bot" },
  { id: "c1", name: "Lucas Mendes", product: "Elf Bar BC5000", puffs: "5000", daysSincePurchase: 22, expectedCycle: 20, status: "bot_sent" },
  { id: "c5", name: "Pedro Gomes", product: "Waka 10000", puffs: "10000", daysSincePurchase: 35, expectedCycle: 30, status: "purchased" },
];

export function PredictiveReplenishment({ onSelectClient }: { onSelectClient: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card border border-border p-6 rounded-2xl flex items-start gap-4">
        <div className="bg-primary/20 p-3 rounded-xl text-primary shrink-0">
          <Clock className="size-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Pipeline de Secagem (Ciclo de Vida)</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
            A IA calcula automaticamente quando o vape do cliente deve acabar com base no número de Puffs e no histórico de recompra dele. 
            No momento exato, o bot dispara uma mensagem de lembrete pelo WhatsApp.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {pipelineData.map(item => {
          const progress = Math.min((item.daysSincePurchase / item.expectedCycle) * 100, 100);
          const isOverdue = item.daysSincePurchase >= item.expectedCycle;

          return (
            <div key={item.id} className="bg-elevated border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row gap-6 md:items-center justify-between hover:border-white/10 transition-colors">
              <div className="flex items-center gap-4 cursor-pointer" onClick={() => onSelectClient(item.id)}>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center font-bold text-silver">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-medium text-white hover:text-primary transition-colors">{item.name}</h4>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Comprou {item.product} ({item.puffs} puffs) há {item.daysSincePurchase} dias
                  </div>
                </div>
              </div>

              <div className="flex-1 max-w-md">
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span className="text-muted-foreground">Vape Cheio</span>
                  <span className={isOverdue ? 'text-red-400' : 'text-yellow-400'}>
                    {isOverdue ? 'Secou!' : 'Quase no Fim'}
                  </span>
                </div>
                <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${isOverdue ? 'bg-red-500' : 'bg-yellow-500'}`} 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 w-48 justify-end shrink-0">
                {item.status === 'pending_bot' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-muted-foreground border border-white/10">
                    <Clock className="size-3.5"/> Aguardando D-2
                  </span>
                )}
                {item.status === 'bot_sent' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Send className="size-3.5"/> Bot Enviou Push
                  </span>
                )}
                {item.status === 'purchased' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="size-3.5"/> Recomprou!
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
