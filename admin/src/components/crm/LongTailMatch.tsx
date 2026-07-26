import { Zap, Tag, ArrowRight } from "lucide-react";

export function LongTailMatch({ onSelectClient }: { onSelectClient: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gradient-to-br from-primary/20 via-primary/5 to-background border border-primary/20 p-6 rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="bg-primary/20 p-3 rounded-xl text-primary shrink-0 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
            <Zap className="size-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Matching de Estoque Ocioso (Cauda Longa)</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              O sistema encontrou produtos que estão com baixo giro no seu estoque. 
              Ao invés de fazer uma promoção para todo mundo, a IA filtrou os clientes específicos que amam essa família de sabores. Dispare um Push invisível e altamente conversível.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card de Oportunidade 1 */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col h-full">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-yellow-500 mb-1">
                <Tag className="size-3" />
                Oportunidade Encontrada
              </div>
              <h4 className="text-lg font-semibold">Ignite V50 - Melancia (Watermelon)</h4>
              <p className="text-sm text-muted-foreground mt-0.5">8 unidades paradas há mais de 15 dias.</p>
            </div>
            <div className="bg-elevated px-3 py-1.5 rounded-lg border border-white/5 text-center">
              <span className="block text-2xl font-bold text-white">14</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Clientes Match</span>
            </div>
          </div>
          
          <div className="bg-background rounded-xl p-4 mb-4 flex-1">
            <h5 className="text-xs font-medium text-silver mb-2">Mensagem Sugerida pela IA:</h5>
            <p className="text-sm italic text-muted-foreground">
              "Fala [Nome]! Vi que você curte uns frutados. Separamos um Ignite de Melancia com 10% off pra você garantir pro fim de semana. Quer que eu mande?"
            </p>
          </div>

          <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
            Disparar Oferta para os 14 clientes
            <ArrowRight className="size-4" />
          </button>
        </div>

        {/* Card de Oportunidade 2 */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col h-full opacity-80">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-yellow-500 mb-1">
                <Tag className="size-3" />
                Oportunidade Encontrada
              </div>
              <h4 className="text-lg font-semibold">Waka 10000 - Tabaco Mint</h4>
              <p className="text-sm text-muted-foreground mt-0.5">4 unidades paradas há mais de 30 dias.</p>
            </div>
            <div className="bg-elevated px-3 py-1.5 rounded-lg border border-white/5 text-center">
              <span className="block text-2xl font-bold text-white">3</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Clientes Match</span>
            </div>
          </div>
          
          <div className="bg-background rounded-xl p-4 mb-4 flex-1">
            <h5 className="text-xs font-medium text-silver mb-2">Mensagem Sugerida pela IA:</h5>
            <p className="text-sm italic text-muted-foreground">
              "Oi [Nome], chegou aquele Waka de Tabaco Mint que você gosta. Posso reservar o seu?"
            </p>
          </div>

          <button className="w-full bg-elevated hover:bg-white/10 text-white border border-border font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
            Revisar Clientes
          </button>
        </div>
      </div>
    </div>
  );
}
