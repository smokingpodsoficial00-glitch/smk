import { X, MessageSquare, ShoppingBag, MapPin, Phone, Crown, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/cart";

// Mock detalhado de um cliente
const mockClientDetails = {
  id: "c1",
  name: "Lucas Mendes",
  phone: "+55 (11) 95555-5555",
  segment: "champion",
  ltv: 1250,
  favoriteFlavorFamily: "Frutados (Ice)",
  address: "Av Prestes Maia, 333 - Nova Petrópolis, SBC",
  timeline: [
    { type: "bot", text: "Lembrete de reposição disparado (Waka 10000)", date: "Hoje, 10:30" },
    { type: "order", text: "Pedido #PED-089 Entregue (Elf Bar BC5000)", date: "Há 22 dias" },
    { type: "bot", text: "Mensagem de boas vindas recebida", date: "Há 4 meses" }
  ]
};

export function ClientProfileModal({ clientId, onClose }: { clientId: string, onClose: () => void }) {
  // Num cenário real, usaríamos o clientId para buscar os dados no Supabase.
  const c = mockClientDetails;

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end p-0">
      <div className="bg-[#0a0a0a] border-l border-border h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <header className="px-6 py-5 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xl font-bold">
              {c.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{c.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="size-3" /> {c.phone}
                </span>
                {c.segment === 'champion' && (
                  <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1">
                    <Crown className="size-3" /> VIP
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-muted-foreground hover:text-white transition-colors">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border p-4 rounded-xl">
              <h4 className="text-xs text-muted-foreground mb-1">Lifetime Value (LTV)</h4>
              <p className="text-xl font-bold text-white">{formatBRL(c.ltv)}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl">
              <h4 className="text-xs text-muted-foreground mb-1">Perfil de Sabor</h4>
              <p className="text-sm font-semibold text-primary">{c.favoriteFlavorFamily}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-elevated/50 p-3 rounded-lg border border-white/5">
            <MapPin className="size-4 shrink-0 mt-0.5 text-silver" />
            <span>{c.address}</span>
          </div>

          <div className="h-px bg-border w-full" />

          {/* Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-silver mb-4 flex items-center gap-2">
              <MessageSquare className="size-4" />
              Histórico & Interações (Timeline 360)
            </h3>
            
            <div className="relative pl-4 border-l border-border ml-2 flex flex-col gap-6">
              {c.timeline.map((event, idx) => (
                <div key={idx} className="relative">
                  <div className={`absolute -left-[21px] w-2.5 h-2.5 rounded-full border-2 border-background ${event.type === 'bot' ? 'bg-primary' : 'bg-emerald-400'}`} />
                  <div className="text-xs text-muted-foreground mb-1">{event.date}</div>
                  <div className={`text-sm ${event.type === 'bot' ? 'text-silver' : 'font-medium text-emerald-400'}`}>
                    {event.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Action Footer */}
        <div className="p-6 border-t border-border bg-card">
          <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(var(--primary),0.2)]">
            <AlertTriangle className="size-4" />
            Assumir Conversa no WhatsApp
          </button>
          <p className="text-xs text-center text-muted-foreground mt-3">
            O Bot será paralisado e o chat abrirá na tela para você falar diretamente.
          </p>
        </div>
      </div>
    </div>
  );
}
