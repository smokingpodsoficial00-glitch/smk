import { Bot, MessageSquare, ShoppingCart, UserMinus, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";

export function BotAutomations() {
  const [cartEnabled, setCartEnabled] = useState(true);
  const [winBackEnabled, setWinBackEnabled] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card border border-border p-6 rounded-2xl flex items-start gap-4">
        <div className="bg-primary/20 p-3 rounded-xl text-primary shrink-0">
          <Bot className="size-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Central de Automações do WhatsApp</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
            Configure as regras de disparo automático do seu Bot. Essas mensagens são enviadas em background pelo Node.js sempre que um gatilho é acionado.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Automação: Carrinho Abandonado */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-elevated rounded-lg text-orange-400">
                <ShoppingCart className="size-5" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Recuperação de Carrinho Abandonado</h4>
                <p className="text-xs text-muted-foreground">Dispara 45 minutos após montar pedido e não pagar Pix.</p>
              </div>
            </div>
            <button onClick={() => setCartEnabled(!cartEnabled)} className="text-muted-foreground hover:text-white transition-colors">
              {cartEnabled ? <ToggleRight className="size-8 text-primary" /> : <ToggleLeft className="size-8" />}
            </button>
          </div>
          
          <div className={`transition-opacity ${!cartEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className="block text-xs font-medium text-silver mb-2">Mensagem do Bot:</label>
            <textarea 
              className="w-full bg-background border border-border rounded-xl p-4 text-sm text-muted-foreground focus:outline-none focus:border-primary/50 resize-none h-24"
              defaultValue="Oi [Nome]! Vi que você separou uns pods aqui com a gente mas o pagamento não caiu. Teve algum problema com o Pix? Se quiser, eu seguro o seu estoque até o final do dia!"
            />
          </div>
        </div>

        {/* Automação: Win-Back */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-elevated rounded-lg text-purple-400">
                <UserMinus className="size-5" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Win-Back (Recuperação de Inativos)</h4>
                <p className="text-xs text-muted-foreground">Dispara para clientes que não compram há mais de 45 dias.</p>
              </div>
            </div>
            <button onClick={() => setWinBackEnabled(!winBackEnabled)} className="text-muted-foreground hover:text-white transition-colors">
              {winBackEnabled ? <ToggleRight className="size-8 text-primary" /> : <ToggleLeft className="size-8" />}
            </button>
          </div>
          
          <div className={`transition-opacity ${!winBackEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className="block text-xs font-medium text-silver mb-2">Mensagem do Bot (Com Cupom):</label>
            <textarea 
              className="w-full bg-background border border-border rounded-xl p-4 text-sm text-muted-foreground focus:outline-none focus:border-primary/50 resize-none h-24"
              defaultValue="[Nome], você sumiu! Saudade de mandar um motoboy pra você haha. Seguinte, liberei um cupom VOLTA10 de 10% de desconto no nosso cardápio válido só pra hoje. Vai um pod aí?"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
