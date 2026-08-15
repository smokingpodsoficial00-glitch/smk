import { useState } from "react";
import { 
  X, MessageSquare, ShoppingBag, MapPin, Phone, Crown, Calendar, 
  Sparkles, CheckCircle2, Save, Tag, Flame, ShieldAlert, HeartHandshake,
  Send, ExternalLink
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { type RealClient, type FlavorProfileType, type ProspectingStatusType, updateClientCrmProfile } from "@/lib/crm";
import { useAuth } from "../../contexts/AuthContext";

export function ClientProfileModal({ 
  client, 
  onClose,
  onClientUpdated
}: { 
  client: RealClient; 
  onClose: () => void;
  onClientUpdated?: () => void;
}) {
  const { company } = useAuth();
  
  // Estados Locais Editáveis
  const [flavorProfile, setFlavorProfile] = useState<FlavorProfileType>(client.flavorProfile || 'fruity');
  const [favoriteBrand, setFavoriteBrand] = useState<string>(client.favoriteBrand || 'Ignite');
  const [inVipGroup, setInVipGroup] = useState<boolean>(client.inVipGroup || false);
  const [prospectingStatus, setProspectingStatus] = useState<ProspectingStatusType>(client.prospectingStatus || 'base_antiga');
  const [customNotes, setCustomNotes] = useState<string>(client.customNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const phoneClean = client.cleanPhone || client.phone.replace(/\D/g, '');
  const waNumber = phoneClean.startsWith('55') ? phoneClean : `55${phoneClean}`;

  // Templates Rápidos de Mensagem 1-a-1
  const copyRetornoSbc = `Oii ${client.name}, tudo bem? 💨\nPassando pra te avisar que a *Smoking Pods tá de volta oficialmente à ativa em SBC!*\n\nAs entregas pro final de semana já estão rolando a todo vapor pra você *garantir o seu pod a tempo e não ficar na mão no rolê*. Reabrimos com estoque 100% renovado, produtos originais e o delivery rápido de sempre de *30 a 40 min* pelo Uber Direct.\n\n📦 *Cardápio Digital:* https://smoking-pods.vercel.app\n\nQual modelo e sabor posso separar pra você já garantir pro fds?`;
  
  const copyRecompra = `E aí ${client.name}! Tudo certo? 💨 Vi que já faz um tempinho desde o seu ${client.lastProduct}. Seu pod já tá nas últimas puxadas? Já quer ir garantindo o próximo pra não ficar na mão no rolê? Me avisa aqui!`;
  
  const copyGrupoVip = `Fala ${client.name}! Tranquilo? Criamos o *Grupo VIP Fechado no WhatsApp* da Smoking Pods onde soltamos os lotes novos e frete promocional antes de todo mundo.\n\nÉ 100% silencioso (só avisos importantes). Se quiser entrar: [LINK_DO_GRUPO_VIP]`;

  const handleSaveProfile = async () => {
    setIsSaving(true);
    const success = await updateClientCrmProfile(
      client.phone,
      {
        flavorProfile,
        favoriteBrand,
        inVipGroup,
        prospectingStatus,
        customNotes
      },
      company?.id
    );
    setIsSaving(false);
    if (success) {
      setSaveFeedback("✅ Perfil do cliente atualizado com sucesso!");
      setTimeout(() => setSaveFeedback(null), 3500);
      if (onClientUpdated) onClientUpdated();
    } else {
      alert("Erro ao salvar perfil no banco de dados.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-end p-0">
      <div className="bg-[#0a0a0a] border-l border-white/10 h-full w-full max-w-xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header do Perfil 360 */}
        <header className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#111]">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl font-bold border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{client.name}</h2>
                {client.segment === 'champion' && (
                  <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold flex items-center gap-1">
                    <Crown className="size-3" /> VIP Champion
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                  <Phone className="size-3 text-muted-foreground/60" /> {client.phone}
                </span>
                <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                  • {client.prospectingStatusLabel}
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
          
          {/* Quick Stats de LTV & Recorrência */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#141414] border border-white/10 p-3.5 rounded-2xl">
              <h4 className="text-[11px] text-muted-foreground mb-1">Lifetime Value (LTV)</h4>
              <p className="text-lg font-bold text-emerald-400 font-mono">{formatBRL(client.spent)}</p>
            </div>
            <div className="bg-[#141414] border border-white/10 p-3.5 rounded-2xl">
              <h4 className="text-[11px] text-muted-foreground mb-1">Total de Pedidos</h4>
              <p className="text-lg font-bold text-white font-mono">{client.ordersCount} compras</p>
            </div>
            <div className="bg-[#141414] border border-white/10 p-3.5 rounded-2xl">
              <h4 className="text-[11px] text-muted-foreground mb-1">Última Compra</h4>
              <p className="text-lg font-bold text-amber-400 font-mono">há {client.daysSinceLastOrder}d</p>
            </div>
          </div>

          {/* Seção 1: Inteligência & Preferências de Consumo */}
          <div className="bg-[#111] border border-white/10 p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Sparkles className="size-3.5" />
              Preferências & Perfil do Cliente
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Perfil de Sabor */}
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1.5">
                  Perfil de Sabor Predominante
                </label>
                <select
                  value={flavorProfile}
                  onChange={(e) => setFlavorProfile(e.target.value as FlavorProfileType)}
                  className="w-full bg-[#181818] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ice">❄️ Mentolado / Ice</option>
                  <option value="fruity">🍓 Frutado / Doce</option>
                  <option value="tobacco">🍂 Atabacado / Intenso</option>
                  <option value="dessert">🍰 Sobremesa / Doce</option>
                  <option value="other">🍧 Outro / Variado</option>
                </select>
              </div>

              {/* Marca Favorita */}
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1.5">
                  Marca Favorita
                </label>
                <select
                  value={favoriteBrand}
                  onChange={(e) => setFavoriteBrand(e.target.value)}
                  className="w-full bg-[#181818] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="Ignite">Ignite</option>
                  <option value="Oxbar">Oxbar</option>
                  <option value="Life Pod">Life Pod</option>
                  <option value="ElfBar">ElfBar</option>
                  <option value="Lost Mary">Lost Mary</option>
                  <option value="Outra">Outra Marca</option>
                </select>
              </div>
            </div>

            {/* Status no Grupo VIP & Funil */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1.5">
                  Funil / Status no CRM
                </label>
                <select
                  value={prospectingStatus}
                  onChange={(e) => setProspectingStatus(e.target.value as ProspectingStatusType)}
                  className="w-full bg-[#181818] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="base_antiga">🎯 Base Antiga (Prospecção)</option>
                  <option value="contatado">💬 Em Negociação / Contatado</option>
                  <option value="reativado">🌱 Reativado (Ativo)</option>
                  <option value="vip_recorrente">🏆 VIP Recorrente</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1.5">
                  Participa do Grupo VIP?
                </label>
                <button
                  type="button"
                  onClick={() => setInVipGroup(!inVipGroup)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    inVipGroup 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                      : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>{inVipGroup ? 'Sim, Membro do Grupo VIP' : 'Não está no Grupo'}</span>
                </button>
              </div>
            </div>

            {/* Anotações Internas */}
            <div className="pt-2 border-t border-white/5">
              <label className="text-xs font-semibold text-white/70 block mb-1.5">
                Notas do Atendente / Gostos Específicos
              </label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Ex: Prefere pagar no Pix, pedir à noite, gosta de sabores de uva com menta..."
                rows={2}
                className="w-full bg-[#181818] border border-white/15 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500 resize-none font-sans"
              />
            </div>

            {/* Botão de Salvar Alterações */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-emerald-400 font-semibold">{saveFeedback}</span>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all border border-white/10 disabled:opacity-50"
              >
                <Save className="size-3.5 text-emerald-400" />
                <span>{isSaving ? 'Salvando...' : 'Salvar no Supabase'}</span>
              </button>
            </div>
          </div>

          {/* Endereço de Entrega */}
          <div className="bg-[#111] border border-white/10 p-4 rounded-2xl">
            <h4 className="text-xs font-semibold text-white/70 mb-1.5 flex items-center gap-1.5">
              <MapPin className="size-3.5 text-emerald-400" />
              Endereço de Entrega (SBC / ABC)
            </h4>
            <p className="text-xs text-white/90 font-mono">
              {client.address || 'Endereço não informado'}
            </p>
          </div>

          {/* Ações Rápidas de Disparo 1-a-1 */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
              <Send className="size-3.5 text-emerald-400" />
              Disparo Direto de WhatsApp com Copys Oficiais
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(copyRetornoSbc)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-[#141414] hover:bg-[#1a1a1a] border border-white/10 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                  🚀 Retorno SBC (FDS)
                </div>
                <div className="text-[10px] text-white/40 mt-1 line-clamp-2">
                  Copy oficial para garantir o pod no final de semana.
                </div>
              </a>

              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(copyRecompra)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-[#141414] hover:bg-[#1a1a1a] border border-white/10 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                  💨 Lembrete de Puffs
                </div>
                <div className="text-[10px] text-white/40 mt-1 line-clamp-2">
                  Aviso citando o último {client.lastProduct}.
                </div>
              </a>

              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(copyGrupoVip)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-[#141414] hover:bg-[#1a1a1a] border border-white/10 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                  👑 Convite Grupo VIP
                </div>
                <div className="text-[10px] text-white/40 mt-1 line-clamp-2">
                  Link inbound voluntário no privado.
                </div>
              </a>
            </div>
          </div>

          {/* Histórico Real de Pedidos */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/70 mb-3 flex items-center gap-2">
              <ShoppingBag className="size-3.5 text-emerald-400" />
              Histórico de Pedidos ({client.orders.length})
            </h3>

            <div className="flex flex-col gap-2.5">
              {client.orders.map((order, idx) => {
                const orderDate = new Date(order.created_at).toLocaleDateString('pt-BR');
                const items: any[] = Array.isArray(order.items) ? order.items : [];

                return (
                  <div key={order.id || idx} className="bg-[#111] border border-white/10 rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-white/60 flex items-center gap-1">
                        <Calendar className="size-3" />
                        {orderDate}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {order.delivery_status || 'CONCLUÍDO'}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-white">
                      {items.map(i => `${i.quantity || 1}x ${i.name || 'Pod'} ${i.flavor || ''}`).join(', ') || 'Ignite V50'}
                    </div>

                    <div className="flex items-center justify-between text-xs text-white/50 pt-1.5 border-t border-white/5">
                      <span>Total Pago</span>
                      <span className="font-mono font-bold text-emerald-400">{formatBRL(parseFloat(order.total_amount || 0))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer com Ação no WhatsApp */}
        <footer className="p-4 border-t border-white/10 bg-[#111]">
          <a
            href={client.whatsappUrl || `https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] cursor-pointer"
          >
            <MessageSquare className="size-4" />
            Abrir Conversa Direta no WhatsApp Web
          </a>
        </footer>

      </div>
    </div>
  );
}

