import { useState } from "react";
import { 
  X, MessageSquare, ShoppingBag, MapPin, Phone, Crown, Calendar, 
  Send, Trash2, Edit2, Loader2, CheckCircle2, User
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { 
  type RealClient, 
  updateBasicClientData,
  formatPhoneForDisplay
} from "@/lib/crm";
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
  onClientUpdated?: (updatedClient?: RealClient) => void;
}) {
  const { company } = useAuth();
  
  // Estados de Exibição e Edição Cadastral do Cliente
  const [currentName, setCurrentName] = useState<string>(client.name || '');
  const [currentPhone, setCurrentPhone] = useState<string>(client.phone || '');
  const [currentAddress, setCurrentAddress] = useState<string>(client.address || '');
  
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editName, setEditName] = useState<string>(client.name || '');
  const [editPhone, setEditPhone] = useState<string>(client.cleanPhone || client.phone || '');
  const [editAddress, setEditAddress] = useState<string>(client.address || '');
  
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  const handleDeleteOrder = async (orderId: string) => {
    if (confirm(`Deseja realmente excluir este pedido do histórico? O estoque dos itens vendidos será restaurado.`)) {
      const res = await deleteOrderWithStockRestoration(orderId, { 
        restoreStock: true,
        deleteClientIfNoOrders: false,
        companyId: company?.id 
      });
      if (res.success) {
        alert('Pedido excluído com sucesso e estoque devolvido.');
        if (onClientUpdated) onClientUpdated();
        onClose();
      } else {
        alert('Erro ao excluir pedido: ' + (res.error || 'Erro desconhecido'));
      }
    }
  };

  const handleDeleteClient = async () => {
    if (confirm(`Deseja realmente remover o cadastro de ${client.name} do CRM?`)) {
      const res = await deleteClientRecord(client.id, company?.id);
      if (res.success) {
        alert('Cliente removido do CRM.');
        if (onClientUpdated) onClientUpdated();
        onClose();
      } else {
        alert('Erro ao remover cliente: ' + (res.error || 'Erro desconhecido'));
      }
    }
  };

  const phoneClean = client.cleanPhone || (client.phone && client.phone !== 'Sem telefone' ? String(client.phone).replace(/\D/g, '') : '');
  const waNumber = phoneClean ? (phoneClean.startsWith('55') ? phoneClean : `55${phoneClean}`) : '';

  // Templates Rápidos de Mensagem 1-a-1
  const copyRetornoSbc = `Oii ${client.name}, tudo bem?\nPassando pra te avisar que a nossa loja tá de volta com tudo!\n\nAs entregas pro final de semana já estão rolando a todo vapor pra você *garantir os seus produtos a tempo e não ficar na mão*. Reabrimos com estoque 100% renovado, produtos originais e atendimento ágil.\n\nQual item posso separar pra você já garantir pro fds?`;
  
  const copyRecompra = `E aí ${client.name}! Tudo certo? Vi que já faz um tempinho desde a sua última compra de ${client.lastProduct}. Já quer ir garantindo a sua reposição pra não ficar na mão? Me avisa aqui!`;
  
  const copyGrupoVip = `Fala ${client.name}! Tranquilo? Criamos o *Grupo VIP Fechado no WhatsApp* da nossa loja onde soltamos novidades, lotes novos e condições exclusivas antes de todo mundo.\n\n100% silencioso (só avisos importantes). Se quiser entrar: [LINK_DO_GRUPO_VIP]`;

  const handleSaveBasicClient = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError("O nome do cliente não pode ficar em branco.");
      return;
    }

    setIsSavingClient(true);
    setEditError(null);
    setEditSuccess(null);

    const res = await updateBasicClientData({
      clientId: client.id,
      name: trimmedName,
      phone: editPhone,
      address: editAddress,
      companyId: company?.id,
    });

    setIsSavingClient(false);

    if (res.success) {
      const newPhoneDisplay = formatPhoneForDisplay(res.savedPhone);
      const newName = res.savedName || trimmedName;
      const newAddress = res.savedAddress !== undefined ? res.savedAddress : editAddress.trim();
      
      setCurrentName(newName);
      setCurrentPhone(newPhoneDisplay);
      setCurrentAddress(newAddress);
      setEditSuccess("Dados cadastrais e endereço atualizados com sucesso!");
      
      const updatedClientObj: RealClient = {
        ...client,
        name: newName,
        phone: newPhoneDisplay,
        address: newAddress,
        cleanPhone: res.savedPhone ? res.savedPhone.replace(/\D/g, '') : '',
      };

      if (onClientUpdated) {
        onClientUpdated(updatedClientObj);
      }

      setTimeout(() => {
        setIsEditingClient(false);
        setEditSuccess(null);
      }, 1500);
    } else {
      setEditError(res.error || "Erro ao salvar alterações no banco.");
    }
  };

  const handleCancelEdit = () => {
    setEditName(currentName);
    setEditPhone(currentPhone);
    setEditAddress(currentAddress);
    setIsEditingClient(false);
    setEditError(null);
    setEditSuccess(null);
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
              {currentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">{currentName}</h2>
                {client.segment === 'champion' && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1 tracking-wider">
                    <Crown className="size-3" /> VIP
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                  <Phone className="size-3 text-muted-foreground/50" /> {currentPhone}
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">
                  • {client.prospectingStatusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => {
                if (isEditingClient) {
                  handleCancelEdit();
                } else {
                  setIsEditingClient(true);
                  setEditName(currentName);
                  const initialPhone = currentPhone && currentPhone !== 'Sem telefone' 
                    ? (client.cleanPhone || currentPhone) 
                    : '';
                  setEditPhone(initialPhone);
                  setEditAddress(currentAddress || '');
                  setEditError(null);
                  setEditSuccess(null);
                }
              }} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors cursor-pointer"
              title="Editar dados cadastrais e endereço"
            >
              <Edit2 className="size-3.5" />
              <span>Editar cadastro</span>
            </button>

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

        {/* Formulário de Edição de Informações (Nome, Telefone e Endereço) */}
        {isEditingClient && (
          <div className="bg-[#121214] border-b border-amber-500/20 p-5 space-y-4 shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Edit2 className="size-3.5 text-amber-400" />
                  Editar dados cadastrais & endereço
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Atualize nome, telefone e endereço oficial do cliente no sistema
                </p>
              </div>
              <span className="text-[10px] font-mono text-white/40">ID: {client.id.slice(0, 8)}</span>
            </div>

            {editError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                <span>{editSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-white/70 block mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-white/70 block mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="11999999999 ou vazio para remover"
                  className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-white/70 block mb-1 flex items-center gap-1.5">
                <MapPin className="size-3 text-amber-400" />
                Endereço de Entrega Completo
              </label>
              <textarea
                rows={2}
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Ex: Rua Alexandra Lunardi Fanani, 57 - Assunção, São Bernardo do Campo - SP, 09810-200"
                className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50 transition-colors resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isSavingClient}
                onClick={handleCancelEdit}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold cursor-pointer transition-colors border border-white/10 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isSavingClient}
                onClick={handleSaveBasicClient}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-[0_0_12px_rgba(245,158,11,0.2)] disabled:opacity-50"
              >
                {isSavingClient ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin text-black" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar alterações</span>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
          
          {/* ========================================================
              PARTE DE CIMA: TODAS AS INFORMAÇÕES DO CLIENTE & ENDEREÇO
             ======================================================== */}
          <div className="space-y-3">
            {/* Bloco Unificado de Dados Cadastrais e Endereço */}
            <div className="bg-[#141417] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="size-3 text-emerald-400" />
                  Dados Cadastrais do Cliente
                </span>
                <span className="text-[10px] font-mono text-zinc-500">ID: {client.id.slice(0, 8)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Nome Oficial</span>
                  <p className="font-semibold text-white mt-0.5">{currentName}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">WhatsApp / Telefone</span>
                  <p className="font-mono text-white mt-0.5 flex items-center gap-1">
                    <Phone className="size-3 text-emerald-400" />
                    {currentPhone}
                  </p>
                </div>
              </div>

              {/* Endereço de Entrega em Destaque */}
              <div className="pt-2 border-t border-white/5">
                <span className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-1">
                  <MapPin className="size-3 text-amber-400" /> Endereço Cadastrado
                </span>
                <p className="text-xs text-zinc-200 mt-1 leading-relaxed bg-black/40 border border-white/5 rounded-lg p-2.5">
                  {currentAddress || 'Nenhum endereço cadastrado para este cliente.'}
                </p>
              </div>
            </div>

            {/* Quick Stats de LTV & Recorrência */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#141414] border border-white/5 p-3.5 rounded-xl flex flex-col justify-between">
                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lifetime Value (LTV)</h4>
                <p className="text-lg font-bold text-emerald-400 font-mono">{formatBRL(client.spent)}</p>
              </div>
              <div className="bg-[#141414] border border-white/5 p-3.5 rounded-xl flex flex-col justify-between">
                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total de Pedidos</h4>
                <p className="text-lg font-bold text-white">{client.ordersCount} <span className="text-xs text-muted-foreground font-normal lowercase">compras</span></p>
              </div>
              <div className="bg-[#141414] border border-white/5 p-3.5 rounded-xl flex flex-col justify-between">
                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Última Compra</h4>
                <p className="text-lg font-bold text-white">há {client.daysSinceLastOrder}d</p>
              </div>
            </div>
          </div>

          {/* ========================================================
              PARTE DE BAIXO: DISPAROS DIRETOS & HISTÓRICO DE COMPRAS
             ======================================================== */}

          {/* Disparos Diretos & Follow-up */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Send className="size-3 text-emerald-400" />
                Disparos Diretos & Follow-up
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
                  Aviso Geral
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  Copy para antecipar compras do final de semana.
                </div>
              </a>

              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(copyRecompra)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-[#141414] hover:bg-white/5 border border-white/5 rounded-xl text-left transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors uppercase tracking-wider">
                  Lembrete de Recompra
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

          {/* Histórico Real de Compras */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <ShoppingBag className="size-3 text-emerald-400" />
              Histórico de Compras ({client.orders.length})
            </h3>

            {client.orders.length === 0 ? (
              <div className="p-6 bg-[#141414] border border-white/5 rounded-xl text-center text-xs text-muted-foreground">
                Nenhum pedido registrado para este cliente ainda.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {client.orders.map((order) => {
                  const orderDate = new Date(order.created_at).toLocaleDateString('pt-BR');
                  const items: any[] = Array.isArray(order.items) ? order.items : [];

                  return (
                    <div key={order.id} className="bg-[#141414] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
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
                        {items.map(i => `${i.quantity || 1}x ${i.name || 'Produto'} ${i.flavor || ''}`).join(', ') || 'Produto'}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-white/5">
                        <span className="uppercase tracking-wider">Total Pago</span>
                        <span className="font-mono font-bold text-white">{formatBRL(parseFloat(order.total_amount || 0))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer com Ação no WhatsApp */}
        <footer className="p-4 border-t border-white/5 bg-[#0f0f0f] rounded-b-2xl shrink-0">
          {phoneClean && !currentPhone.includes('Instagram') && !currentPhone.startsWith('INSTA_') ? (
            <a
              href={client.whatsappUrl || `https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs uppercase tracking-wider"
            >
              <MessageSquare className="size-4" />
              Abrir Conversa Direta no WhatsApp Web
            </a>
          ) : (
            <div className="w-full bg-white/5 text-white/40 border border-white/10 font-medium py-3 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-not-allowed select-none">
              <Phone className="size-4 text-white/30" />
              Cliente sem WhatsApp / sem telefone cadastrado
            </div>
          )}
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
