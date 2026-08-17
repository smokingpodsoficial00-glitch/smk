import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, User, Phone, Sparkles, MessageSquare, 
  CheckCircle2, AlertCircle, Save, Plus, ArrowRight, Tag
} from 'lucide-react';
import { 
  createFollowUp, 
  FOLLOWUP_CATEGORIES, 
  type FollowUpReasonCategory,
  generateFollowUpMessage
} from '@/lib/followUps';
import { fetchLiveClients, type RealClient } from '@/lib/crm';
import { useAuth } from '@/contexts/AuthContext';

interface NewFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFollowUpCreated: () => void;
  initialClient?: {
    name: string;
    phone: string;
    product?: string;
    flavor?: string;
    puffs?: number;
  } | null;
}

export function NewFollowUpModal({
  isOpen,
  onClose,
  onFollowUpCreated,
  initialClient
}: NewFollowUpModalProps) {
  const { company } = useAuth();

  const [clients, setClients] = useState<RealClient[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ name: string; phone: string } | null>(null);

  // Form states
  const [customName, setCustomName] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [reasonCategory, setReasonCategory] = useState<FollowUpReasonCategory>('sem_dinheiro_salario');
  const [reasonDescription, setReasonDescription] = useState('');
  const [targetProduct, setTargetProduct] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carrega lista de clientes para busca
  useEffect(() => {
    if (isOpen) {
      fetchLiveClients(company?.id).then(setClients);
      if (initialClient) {
        setSelectedClient({ name: initialClient.name, phone: initialClient.phone });
        setCustomName(initialClient.name);
        setCustomPhone(initialClient.phone);
        if (initialClient.product) setTargetProduct(initialClient.product);
      } else {
        setSelectedClient(null);
        setCustomName('');
        setCustomPhone('');
        setTargetProduct('');
        setReasonDescription('');
      }
    }
  }, [isOpen, initialClient, company?.id]);

  if (!isOpen) return null;

  // Atalhos Rápidos de Data
  const setQuickDate = (type: 'tomorrow' | 'friday' | 'day5' | 'next_week') => {
    const today = new Date();
    const d = new Date();

    if (type === 'tomorrow') {
      d.setDate(today.getDate() + 1);
    } else if (type === 'friday') {
      const dayOfWeek = today.getDay(); // 0 = Dom, 5 = Sex
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
      d.setDate(today.getDate() + daysUntilFriday);
    } else if (type === 'day5') {
      // Próximo dia 5 do mês
      if (today.getDate() < 5) {
        d.setDate(5);
      } else {
        d.setMonth(today.getMonth() + 1);
        d.setDate(5);
      }
    } else if (type === 'next_week') {
      d.setDate(today.getDate() + 7);
    }

    setScheduledDate(d.toISOString().split('T')[0]);
  };

  const previewMessage = generateFollowUpMessage({
    client_name: customName || selectedClient?.name || 'Cliente',
    reason_category: reasonCategory,
    reason_description: reasonDescription,
    target_product: targetProduct,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = customPhone || selectedClient?.phone;
    const name = customName || selectedClient?.name || 'Cliente';

    if (!phone || !phone.trim()) {
      alert('Por favor, informe o telefone do cliente.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createFollowUp({
        company_id: company?.id,
        client_phone: phone,
        client_name: name,
        reason_category: reasonCategory,
        reason_description: reasonDescription,
        target_product: targetProduct || undefined,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
      });

      onFollowUpCreated();
      onClose();
    } catch (err: any) {
      alert('Erro ao agendar follow-up: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrar clientes para o autocomplete
  const filteredClients = clientSearch.trim()
    ? clients.filter(c => 
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.phone.includes(clientSearch)
      ).slice(0, 5)
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c0c0c] border border-white/10 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
              <Calendar className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Agendar Follow-up Estratégico
              </h3>
              <p className="text-xs text-white/50">
                Registre o motivo do porquê o cliente não comprou agora e marque a data de retorno.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          
          {/* 1. Seleção / Digitação do Cliente */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
              <User className="size-3.5 text-amber-400" />
              Cliente & WhatsApp
            </label>

            {!selectedClient ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="🔍 Digite para buscar na base ou preencha abaixo..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full bg-[#161616] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500"
                />

                {filteredClients.length > 0 && (
                  <div className="bg-[#181818] border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
                    {filteredClients.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedClient({ name: c.name, phone: c.phone });
                          setCustomName(c.name);
                          setCustomPhone(c.phone);
                          setClientSearch('');
                        }}
                        className="p-3 hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{c.name}</div>
                          <div className="text-[11px] text-white/50 font-mono">{c.phone}</div>
                        </div>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Selecionar
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <input
                      type="text"
                      placeholder="Nome do cliente"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full bg-[#161616] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="WhatsApp (ex: 11999998888)"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      className="w-full bg-[#161616] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500 font-mono"
                      required
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">{customName || selectedClient.name}</div>
                  <div className="text-[11px] text-amber-400 font-mono">{customPhone || selectedClient.phone}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="text-[10px] text-white/60 hover:text-white underline cursor-pointer"
                >
                  Trocar Cliente
                </button>
              </div>
            )}
          </div>

          {/* 2. Categoria / Motivo Comercial */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
              <Tag className="size-3.5 text-amber-400" />
              Por que o cliente não comprou agora?
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(Object.keys(FOLLOWUP_CATEGORIES) as FollowUpReasonCategory[]).map(catKey => {
                const cat = FOLLOWUP_CATEGORIES[catKey];
                const isSelected = reasonCategory === catKey;

                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setReasonCategory(catKey)}
                    className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                        : 'bg-[#161616] text-white/70 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.label.replace(/^[^\s]+\s/, '')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Data Marcada para Retorno + Atalhos Rápidos */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
              <Clock className="size-3.5 text-emerald-400" />
              Data Marcada para o Disparo
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setQuickDate('tomorrow')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[11px] font-bold transition-colors cursor-pointer"
              >
                ⚡ Amanhã
              </button>
              <button
                type="button"
                onClick={() => setQuickDate('friday')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[11px] font-bold transition-colors cursor-pointer"
              >
                🎉 Sexta-feira (FDS)
              </button>
              <button
                type="button"
                onClick={() => setQuickDate('day5')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[11px] font-bold transition-colors cursor-pointer"
              >
                💰 Dia 05 (Salário)
              </button>
              <button
                type="button"
                onClick={() => setQuickDate('next_week')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[11px] font-bold transition-colors cursor-pointer"
              >
                🗓️ Em 1 Semana
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full bg-[#161616] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono cursor-pointer"
                  required
                />
              </div>
              <div>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full bg-[#161616] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 4. Descrição / Nota do Atendente */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white/70">
              Descrição / O que ficou combinado?
            </label>
            <textarea
              placeholder="Ex: Falou que vai receber dia 05 às 10h e quer 2 Ignite V50 Watermelon Ice..."
              value={reasonDescription}
              onChange={(e) => setReasonDescription(e.target.value)}
              rows={2}
              className="w-full bg-[#161616] border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500 resize-none font-sans"
            />
          </div>

          {/* 5. Prévia da Mensagem de WhatsApp */}
          <div className="p-3.5 bg-[#141414] border border-white/5 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <MessageSquare className="size-3.5" />
              Prévia do Script de Disparo (WhatsApp)
            </div>
            <p className="text-xs text-white/70 font-mono whitespace-pre-wrap line-clamp-4 bg-black/40 p-2.5 rounded-xl border border-white/5">
              {previewMessage}
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold transition-all"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] cursor-pointer disabled:opacity-50"
            >
              <Save className="size-4 stroke-[2.5]" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Follow-up'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
