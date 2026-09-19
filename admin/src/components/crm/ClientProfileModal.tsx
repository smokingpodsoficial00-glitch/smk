import { useState } from "react";
import { 
  X, MessageSquare, ShoppingBag, MapPin, Phone, Crown, Calendar, 
  Sparkles, CheckCircle2, Save, Tag, Flame, ShieldAlert, HeartHandshake,
  Send, ExternalLink, Trash2
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { type RealClient, type FlavorProfileType, type ProspectingStatusType, updateClientCrmProfile } from "@/lib/crm";
import { useAuth } from "../../contexts/AuthContext";
import { NewFollowUpModal } from "./NewFollowUpModal";
import { deleteOrderWithStockRestoration, deleteClientRecord } from "@/lib/orders";

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
  const [inVipGroup, setInVipGroup] = useState<boolean>(Boolean(client.inVipGroup));
  const [prospectingStatus, setProspectingStatus] = useState<ProspectingStatusType>(client.prospectingStatus || 'base_antiga');
  const [customNotes, setCustomNotes] = useState<string>(client.customNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  const handleDeleteOrder = async (orderId: string) => {
    if (confirm(`Deseja realmente excluir este pedido do histórico? O estoque dos itens vendidos será restaurado.`)) {
      const res = await deleteOrderWithStockRestoration(orderId, { 
        restoreStock: true,
        deleteClientIfNoOrders: false,
        companyId: company?.id 
      });
      if (res.success) {
        alert('✅ Pedido excluído com sucesso e estoque devolvido.');
        if (onClientUpdated) onClientUpdated();
        onClose();
      } else {
        alert('Erro ao excluir pedido: ' + (res.error || 'Erro desconhecido'));
      }
    }
  };

  const handleDeleteClient = async () => {
    if (confirm(`Deseja realmente remover o cadastro de ${client.name} do CRM?`)) {
      const res = await deleteClientRecord(client.cleanPhone || client.phone, company?.id);
      if (res.success) {
        alert('✅ Cliente removido do CRM.');
        if (onClientUpdated) onClientUpdated();
        onClose();
      } else {
        alert('Erro ao remover cliente: ' + (res.error || 'Erro desconhecido'));
      }
    }
  };

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
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div 
        className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header do Perfil 360 */}
        <header className="px-6 py-5 border-b border-white/5 flex items-start justify-between bg-[#0f0f0f] rounded-t-2xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-full bg-[#141414] text-emerald-400 flex items-center justify-center text-lg font-bold border border-white/5">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">{client.name}</h2>
                {client.segment === 'champion' && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1 tracking-wider">
                    <Crown className="size-3" /> VIP
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                  <Phone className="size-3 text-muted-foreground/50" /> {client.phone}
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">
                  • {client.prospectingStatusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={handleDeleteClient} 
              className="p-1.5 hover:bg-red-500/10 rounded-lg text-white/30 hover:text-red-400 transition-colors cursor-pointer"
              title="Excluir este cliente do CRM"
            >
              <Trash2 className="size-4" />
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
          
          {/* Quick Stats de LTV & Recorrência */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#141414] border border-white/5 p-4 rounded-xl flex flex-col justify-between">
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Lifetime Value (LTV)</h4>
              <p className="text-lg font-bold text-white">{formatBRL(client.spent)}</p>
            </div>
            <div className="bg-[#141414] border border-white/5 p-4 rounded-xl flex flex-col justify-between">
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Total de Pedidos</h4>
              <p className="text-lg font-bold text-white">{client.ordersCount} <span className="text-xs text-muted-foreground font-normal lowercase">compras</span></p>
            </div>
            <div className="bg-[#141414] border border-white/5 p-4 rounded-xl flex flex-col justify-between">
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Última Compra</h4>
              <p className="text-lg font-bold text-white">há {client.daysSinceLastOrder}d</p>
            </div>
          </div>

          {/* Seção 1: Inteligência & Preferências de Consumo */}
          <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-xl space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="size-3 text-emerald-400" />
              Preferências & Perfil do Cliente
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Perfil de Sabor */}
              <div>
                <label className="text-[11px] font-semibold text-white/60 block mb-1.5">
                  Perfil de Sabor Predominante
                </label>
                <select
                  value={flavorProfile}
                  onChange={(e) => setFlavorProfile(e.target.value as FlavorProfileType)}
                  className="w-full bg-[#141414] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer transition-colors"
                >
                  <option value="ice">Mentolado / Ice</option>
                  <option value="fruity">Frutado / Doce</option>
                  <option value="tobacco">Atabacado / Intenso</option>
                  <option value="dessert">Sobremesa / Doce</option>
                  <option value="other">Outro / Variado</option>
                </select>
              </div>

              {/* Marca Favorita */}
              <div>
                <label className="text-[11px] font-semibold text-white/60 block mb-1.5">
                  Marca Favorita
                </label>
                <select
                  value={favoriteBrand}
                  onChange={(e) => setFavoriteBrand(e.target.value)}
                  className="w-full bg-[#141414] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer transition-colors"
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
                <label className="text-[11px] font-semibold text-white/60 block mb-1.5">
                  Funil / Status no CRM
                </label>
                <select
                  value={prospectingStatus}
                  onChange={(e) => setProspectingStatus(e.target.value as ProspectingStatusType)}
                  className="w-full bg-[#141414] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer transition-colors"
                >
                  <option value="base_antiga">Base Antiga (Prospecção)</option>
                  <option value="contatado">Em Negociação / Contatado</option>
                  <option value="reativado">Reativado (Ativo)</option>
                  <option value="vip_recorrente">VIP Recorrente</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-white/60 block mb-1.5">
                  Participa do Grupo VIP?
                </label>
                <button
                  type="button"
                  onClick={() => setInVipGroup(!inVipGroup)}
                  className={`w-full py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    inVipGroup 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-[#141414] text-white/50 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>{inVipGroup ? 'Membro do Grupo VIP' : 'Não está no Grupo'}</span>
                </button>
              </div>
            </div>

            {/* Anotações Internas */}
            <div className="pt-2 border-t border-white/5">
              <label className="text-[11px] font-semibold text-white/60 block mb-1.5">
                Notas do Atendente / Gostos Específicos
              </label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Ex: Prefere pagar no Pix, pedir à noite, gosta de sabores de uva com menta..."
                rows={2}
                className="w-full bg-[#141414] border border-white/10 rounded-lg p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 resize-none font-sans transition-colors"
              />
            </div>

            {/* Botão de Salvar Alterações */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-emerald-400 font-semibold">{saveFeedback}</span>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all border border-emerald-500/20 disabled:opacity-50 tracking-wider uppercase"
              >
                <Save className="size-3.5" />
                <span>{isSaving ? 'Salvando...' : 'Salvar no Supabase'}</span>
              </button>
            </div>
          </div>

          {/* Endereço de Entrega */}
          <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl">
            <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5 tracking-wider">
              <MapPin className="size-3 text-emerald-400" />
              Endereço de Entrega (SBC / ABC)
            </h4>
            <p className="text-xs text-white/80 font-mono">
              {client.address || 'Endereço não informado'}
            </p>
          </div>

          {/* Ações Rápidas de Disparo 1-a-1 & Agendamento */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Send className="size-3 text-emerald-400" />
                Disparo Direto & Follow-up
              </h3>

              <button
                type="button"
                onClick={() => setIsFollowUpModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <Calendar className="size-3" />
                <span>+ Agendar Follow-up</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(copyRetornoSbc)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-[#141414] hover:bg-white/5 border border-white/5 rounded-xl text-left transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors uppercase tracking-wider">
                  Retorno SBC
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  Copy para garantir o pod no final de semana.
                </div>
              </a>

              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(copyRecompra)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-[#141414] hover:bg-white/5 border border-white/5 rounded-xl text-left transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors uppercase tracking-wider">
                  Lembrete de Puffs
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  Aviso citando o último {client.lastProduct}.
                </div>
              </a>

              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(copyGrupoVip)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-[#141414] hover:bg-white/5 border border-white/5 rounded-xl text-left transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors uppercase tracking-wider">
                  Convite Grupo VIP
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  Link inbound voluntário no privado.
                </div>
              </a>
            </div>
          </div>

          {/* Histórico Real de Pedidos */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <ShoppingBag className="size-3 text-emerald-400" />
              Histórico de Pedidos ({client.orders.length})
            </h3>

            <div className="flex flex-col gap-2.5">
              {client.orders.map((order, idx) => {
                const orderDate = new Date(order.created_at).toLocaleDateString('pt-BR');
                const items: any[] = Array.isArray(order.items) ? order.items : [];

                return (
                  <div key={order.id || idx} className="bg-[#141414] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                        <Calendar className="size-3" />
                        {orderDate}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {order.delivery_status || 'CONCLUÍDO'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id)}
                          className="p-1 hover:bg-red-500/10 rounded text-white/30 hover:text-red-400 transition-colors cursor-pointer"
                          title="Excluir esta venda (Devolver ao Estoque)"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] font-medium text-white/90">
                      {items.map(i => `${i.quantity || 1}x ${i.name || 'Pod'} ${i.flavor || ''}`).join(', ') || 'Ignite V50'}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-white/5">
                      <span className="uppercase tracking-wider">Total Pago</span>
                      <span className="font-mono font-bold text-white">{formatBRL(parseFloat(order.total_amount || 0))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer com Ação no WhatsApp */}
        <footer className="p-4 border-t border-white/5 bg-[#0f0f0f] rounded-b-2xl shrink-0">
          <a
            href={client.whatsappUrl || `https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs uppercase tracking-wider"
          >
            <MessageSquare className="size-4" />
            Abrir Conversa Direta no WhatsApp Web
          </a>
        </footer>
      </div>

      {/* Modal de Follow-up com dados pré-preenchidos */}
      <NewFollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        onFollowUpCreated={() => {
          setIsFollowUpModalOpen(false);
          if (onClientUpdated) onClientUpdated();
        }}
        initialClient={{
          id: client.id,
          name: client.name,
          phone: client.phone,
          product: client.lastProduct,
          flavor: client.lastFlavor,
          puffs: client.lastPuffs
        }}
      />
    </div>
  );
}
