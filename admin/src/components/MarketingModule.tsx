import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Send, Users, ShieldAlert, Sparkles, Clock, CheckCircle2, 
  AlertTriangle, RefreshCw, MessageSquare, Play, Pause, ExternalLink,
  Flame, Lock, Copy, Check, Plus, Trash2, Edit3, ArrowRight, CheckSquare,
  Square, Calendar, Layers, ShieldCheck, HelpCircle, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLiveClients, type RealClient } from '@/lib/crm';

// Interfaces de Estrutura de Marketing
export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  cleanPhone: string;
  isSaved?: boolean;
}

export interface BroadcastList {
  id: string;
  name: string;
  description: string;
  contacts: ContactItem[];
  color: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  targetType: 'lists' | 'group' | 'all';
  selectedListIds: string[]; // Suporte a múltiplas listas
  targetGroupId?: string;
  targetGroupName?: string;
  frequencyDays: number; // 0 = Disparo Único, 7 = Semanal, 14 = Quinzenal, etc.
  scheduledWeekday?: string; // 'QUARTA', 'SEXTA', 'SABADO', 'DOMINGO', etc.
  scheduledTime?: string; // Ex: '15:00', '18:30', etc.
  batchSize: number;
  batchIntervalMinutes: number;
  status: 'active' | 'paused' | 'completed';
  lastRunDate?: string;
  totalRecipients: number;
  createdAt: string;
}

interface WhatsAppGroup {
  id: string;
  name: string;
  participantsCount: number;
}

const OFFICIAL_TEMPLATES = [
  {
    id: 'weekend_vip',
    title: 'Final de Semana + Grupo VIP (Oficial SBC)',
    badge: 'Mais Convertida',
    text: `Oii, tudo bem? 💨\nPassando pra te avisar que a *Smoking Pods tá de volta oficialmente à ativa em SBC!*\n\nAs entregas pro final de semana já estão rolando a todo vapor pra você *garantir o seu pod a tempo e não ficar na mão no rolê*. Reabrimos com estoque 100% renovado, produtos originais e o delivery rápido de sempre de *30 a 40 min* pelo Uber Direct.\n\n📦 *Dá uma olhada nos modelos disponíveis no Cardápio Digital:*\n🔗 [LINK_DO_CARDAPIO_VERCEL]\n\n💬 *Também ativamos o Grupo VIP no WhatsApp pra soltar lotes exclusivos e frete promocional pro fds:*\n🔗 [LINK_DO_GRUPO_VIP_WHATSAPP]\n\nQual modelo e sabor posso separar pra você já garantir pro fds?`,
  },
  {
    id: 'antigos_clientes',
    title: 'Clientes das Antigas (Tom Pessoal)',
    badge: 'Alta Resposta',
    text: `Opa [Nome], quanto tempo! De boa? 🔥\nSei que fazia um tempinho que estávamos parados, mas organizamos a casa e *voltamos com tudo!*\n\nComo você é da nossa base das antigas, tô te mandando o *Cardápio Digital atualizado* pra você dar uma olhada nos pods que chegaram:\n🔗 [LINK_DO_CARDAPIO_VERCEL]\n\n⚡ *Hoje tamo com prioridade máxima de entrega rápida no ABC (30-40 min via Uber Direct).*\n\n🔒 *Se quiser receber ofertas relâmpago e condições exclusivas antes de todo mundo, entra no nosso Grupo VIP:*\n🔗 [LINK_DO_GRUPO_VIP_WHATSAPP]\n\nTô por aqui se precisar de algo, só chamar!`,
  },
  {
    id: 'reposicao_ativa',
    title: 'Aviso de Fim de Pod (Recompra)',
    badge: 'Timing de Uso',
    text: `E aí [Nome]! Tudo certo? 💨\nPelo meu controle aqui, seu último pod já deve estar nas últimas puxadas hahaha!\n\nPra você não ficar na mão no meio da semana, quer que eu já separe um sabor novo pra você?\n\n📦 Cardápio completo no ar: [LINK_DO_CARDAPIO_VERCEL]\nMe avisa aqui qual sabor posso agilizar pro seu delivery!`,
  },
];

const LOCAL_STORAGE_LISTS = 'smoking_broadcast_lists_v1';
const LOCAL_STORAGE_CAMPAIGNS = 'smoking_marketing_campaigns_v1';

export function MarketingModule() {
  const { company } = useAuth();
  
  // Abas do Módulo: 'hub' | 'campaigns' | 'broadcast_lists' | 'groups'
  const [activeTab, setActiveTab] = useState<'hub' | 'campaigns' | 'broadcast_lists' | 'groups'>('campaigns');
  
  // Base Global de Contatos e Grupos do WhatsApp
  const [allContacts, setAllContacts] = useState<ContactItem[]>([]);
  const [whatsAppGroups, setWhatsAppGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingSync, setLoadingSync] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Listas de Transmissão Criadas
  const [broadcastLists, setBroadcastLists] = useState<BroadcastList[]>([]);
  
  // Campanhas Criadas
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Modais de Criação / Edição
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<BroadcastList | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Formulário de Criação de Lista
  const [listFormName, setListFormName] = useState('');
  const [listFormDesc, setListFormDesc] = useState('');
  const [listFormSelectedContacts, setListFormSelectedContacts] = useState<Set<string>>(new Set());
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactsVisibleCount, setContactsVisibleCount] = useState(50);

  // Formulário de Criação de Campanha
  const [campaignFormName, setCampaignFormName] = useState('');
  const [campaignFormMessage, setCampaignFormMessage] = useState(OFFICIAL_TEMPLATES[0].text);
  const [campaignFormTargetType, setCampaignFormTargetType] = useState<'lists' | 'group'>('lists');
  const [campaignFormSelectedLists, setCampaignFormSelectedLists] = useState<Set<string>>(new Set());
  const [campaignFormTargetGroup, setCampaignFormTargetGroup] = useState<string>('');
  const [campaignFormFrequency, setCampaignFormFrequency] = useState<number>(7); // dias
  const [campaignFormWeekday, setCampaignFormWeekday] = useState<string>('QUARTA');
  const [campaignFormTime, setCampaignFormTime] = useState<string>('15:00');
  const [campaignFormBatchSize, setCampaignFormBatchSize] = useState<number>(20);
  const [campaignFormInterval, setCampaignFormInterval] = useState<number>(45);
  const [cardapioUrl, setCardapioUrl] = useState('https://smoking-pods.vercel.app');
  const [grupoVipUrl, setGrupoVipUrl] = useState('');

  // Execução de Disparo & Controle de Pausa Real
  const [executingCampaignId, setExecutingCampaignId] = useState<string | null>(null);
  const [dispatchProgress, setDispatchProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const isAbortingRef = React.useRef(false);

  const handleStopCampaign = () => {
    isAbortingRef.current = true;
    setDispatchProgress(prev => prev ? { ...prev, status: 'Interrompendo disparos... aguarde o contato atual.' } : null);
  };

  // Carrega Listas e Campanhas salvas no localStorage
  useEffect(() => {
    try {
      const savedLists = localStorage.getItem(LOCAL_STORAGE_LISTS);
      if (savedLists) {
        setBroadcastLists(JSON.parse(savedLists));
      } else {
        // Cria listas iniciais padrão
        const initialLists: BroadcastList[] = [
          {
            id: 'list_antigos_smk',
            name: 'Base Antiga (~300 SMK)',
            description: 'Contatos antigos de São Bernardo do Campo recuperados para reativação',
            contacts: [],
            color: '#10b981',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'list_vips_semanais',
            name: 'Clientes VIPs (Semanais)',
            description: 'Clientes de alta frequência para ofertas relâmpago',
            contacts: [],
            color: '#8b5cf6',
            createdAt: new Date().toISOString(),
          }
        ];
        setBroadcastLists(initialLists);
        localStorage.setItem(LOCAL_STORAGE_LISTS, JSON.stringify(initialLists));
      }

      const savedCampaigns = localStorage.getItem(LOCAL_STORAGE_CAMPAIGNS);
      if (savedCampaigns) {
        setCampaigns(JSON.parse(savedCampaigns));
      } else {
        const initialCampaign: Campaign = {
          id: 'camp_reativacao_fds',
          name: 'Reativação FDS + Convite Grupo VIP',
          message: OFFICIAL_TEMPLATES[0].text,
          targetType: 'lists',
          selectedListIds: ['list_antigos_smk'],
          frequencyDays: 7,
          batchSize: 20,
          batchIntervalMinutes: 45,
          status: 'active',
          totalRecipients: 0,
          createdAt: new Date().toISOString(),
        };
        setCampaigns([initialCampaign]);
        localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS, JSON.stringify([initialCampaign]));
      }
    } catch (e) {
      console.warn('Erro ao carregar storage local de marketing:', e);
    }
  }, []);

  // Salva no localStorage quando mudar
  const saveListsToStorage = (lists: BroadcastList[]) => {
    setBroadcastLists(lists);
    localStorage.setItem(LOCAL_STORAGE_LISTS, JSON.stringify(lists));
  };

  const saveCampaignsToStorage = (camps: Campaign[]) => {
    setCampaigns(camps);
    localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS, JSON.stringify(camps));
  };

  // Sincroniza Contatos e Grupos do WhatsApp via backend
  const syncWhatsAppContactsAndGroups = async () => {
    setLoadingSync(true);
    setSyncStatus('Lendo agenda do WhatsApp e grupos conectados...');
    try {
      // 1. Tenta puxar do WhatsApp real no backend
      let fetchedContacts: ContactItem[] = [];
      let fetchedGroups: WhatsAppGroup[] = [];

      try {
        const res = await fetch('http://localhost:3006/api/marketing/whatsapp-data');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.contacts)) {
            fetchedContacts = data.contacts.map((c: any) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              cleanPhone: c.phone.replace(/\D/g, ''),
              isSaved: c.isSaved,
            }));
          }
          if (data && Array.isArray(data.groups)) {
            fetchedGroups = data.groups;
          }
        }
      } catch (backendErr) {
        console.info('Backend local indisponível, buscando do CRM Supabase...');
      }

      // 2. Se WhatsApp offline ou vazio, faz fallback inteligente para o CRM de Clientes da loja
      if (fetchedContacts.length === 0) {
        const crmClients = await fetchLiveClients(company?.id);
        fetchedContacts = crmClients.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          cleanPhone: c.cleanPhone || c.phone.replace(/\D/g, ''),
          isSaved: true
        }));
      }

      setAllContacts(fetchedContacts);
      setWhatsAppGroups(fetchedGroups);
      
      try {
        localStorage.setItem('SP_MARKETING_CONTACTS', JSON.stringify(fetchedContacts));
        localStorage.setItem('SP_MARKETING_GROUPS', JSON.stringify(fetchedGroups));
      } catch (storeErr) {}

      setSyncStatus(`Sincronizado com sucesso! ${fetchedContacts.length} contatos e ${fetchedGroups.length} grupos carregados.`);
      
      // NÃO auto-preenche listas - o usuário deve selecionar manualmente os contatos

      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err: any) {
      console.error('Erro na sincronização:', err);
      setSyncStatus('Erro ao sincronizar contatos.');
    } finally {
      setLoadingSync(false);
    }
  };

  // Carrega contatos e grupos do localStorage ao iniciar
  useEffect(() => {
    try {
      const savedContacts = localStorage.getItem('SP_MARKETING_CONTACTS');
      const savedGroups = localStorage.getItem('SP_MARKETING_GROUPS');
      if (savedContacts) {
        setAllContacts(JSON.parse(savedContacts));
      }
      if (savedGroups) {
        setWhatsAppGroups(JSON.parse(savedGroups));
      }
    } catch (e) {
      console.warn('Erro ao carregar cache do marketing:', e);
    }
  }, [company?.id]);

  // Abre Modal de Criar/Editar Lista
  const handleOpenListModal = (listToEdit?: BroadcastList) => {
    if (listToEdit) {
      setEditingList(listToEdit);
      setListFormName(listToEdit.name);
      setListFormDesc(listToEdit.description);
      setListFormSelectedContacts(new Set(listToEdit.contacts.map(c => c.id)));
    } else {
      setEditingList(null);
      setListFormName('');
      setListFormDesc('');
      setListFormSelectedContacts(new Set(allContacts.map(c => c.id))); // Seleciona todos por padrão
    }
    setIsListModalOpen(true);
  };

  // Salva Lista
  const handleSaveList = () => {
    if (!listFormName.trim()) {
      alert('Por favor, informe o nome da Lista de Transmissão.');
      return;
    }

    const selectedMembers = allContacts.filter(c => listFormSelectedContacts.has(c.id));

    if (editingList) {
      const updated = broadcastLists.map(l => 
        l.id === editingList.id 
          ? { ...l, name: listFormName, description: listFormDesc, contacts: selectedMembers }
          : l
      );
      saveListsToStorage(updated);
    } else {
      const newList: BroadcastList = {
        id: `list_${Date.now()}`,
        name: listFormName.trim(),
        description: listFormDesc.trim() || 'Lista personalizada de contatos',
        contacts: selectedMembers,
        color: '#10b981',
        createdAt: new Date().toISOString(),
      };
      saveListsToStorage([...broadcastLists, newList]);
    }

    setIsListModalOpen(false);
  };

  const handleDeleteList = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta Lista de Transmissão?')) {
      const updated = broadcastLists.filter(l => l.id !== id);
      saveListsToStorage(updated);
    }
  };

  // Abre Modal de Criar/Editar Campanha
  const handleOpenCampaignModal = (campToEdit?: Campaign) => {
    if (campToEdit) {
      setEditingCampaign(campToEdit);
      setCampaignFormName(campToEdit.name);
      setCampaignFormMessage(campToEdit.message);
      setCampaignFormTargetType(campToEdit.targetType === 'group' ? 'group' : 'lists');
      setCampaignFormSelectedLists(new Set(campToEdit.selectedListIds || []));
      setCampaignFormTargetGroup(campToEdit.targetGroupId || '');
      setCampaignFormFrequency(campToEdit.frequencyDays);
      setCampaignFormWeekday(campToEdit.scheduledWeekday || 'QUARTA');
      setCampaignFormTime(campToEdit.scheduledTime || '15:00');
      setCampaignFormBatchSize(campToEdit.batchSize || 20);
      setCampaignFormInterval(campToEdit.batchIntervalMinutes || 45);
    } else {
      setEditingCampaign(null);
      setCampaignFormName('');
      setCampaignFormMessage(OFFICIAL_TEMPLATES[0].text);
      setCampaignFormTargetType('lists');
      // Seleciona a primeira lista por padrão
      const firstListId = broadcastLists.length > 0 ? broadcastLists[0].id : '';
      setCampaignFormSelectedLists(new Set(firstListId ? [firstListId] : []));
      setCampaignFormTargetGroup(whatsAppGroups.length > 0 ? whatsAppGroups[0].id : '');
      setCampaignFormFrequency(7);
      setCampaignFormWeekday('QUARTA');
      setCampaignFormTime('15:00');
      setCampaignFormBatchSize(20);
      setCampaignFormInterval(45);
    }
    setIsCampaignModalOpen(true);
  };

  // Salva Campanha
  const handleSaveCampaign = () => {
    if (!campaignFormName.trim()) {
      alert('Por favor, informe o nome da Campanha.');
      return;
    }
    if (!campaignFormMessage.trim()) {
      alert('Por favor, escreva o texto da mensagem.');
      return;
    }

    // Calcula total de destinatários únicos combinando as listas selecionadas
    let totalCount = 0;
    if (campaignFormTargetType === 'lists') {
      const uniqueContactIds = new Set<string>();
      broadcastLists
        .filter(l => campaignFormSelectedLists.has(l.id))
        .forEach(l => l.contacts.forEach(c => uniqueContactIds.add(c.id)));
      totalCount = uniqueContactIds.size;
    } else {
      const selectedGroup = whatsAppGroups.find(g => g.id === campaignFormTargetGroup);
      totalCount = selectedGroup?.participantsCount || 1;
    }

    const selectedGroupName = whatsAppGroups.find(g => g.id === campaignFormTargetGroup)?.name;

    if (editingCampaign) {
      const updated = campaigns.map(c => 
        c.id === editingCampaign.id 
          ? {
              ...c,
              name: campaignFormName.trim(),
              message: campaignFormMessage,
              targetType: campaignFormTargetType,
              selectedListIds: Array.from(campaignFormSelectedLists),
              targetGroupId: campaignFormTargetGroup,
              targetGroupName: selectedGroupName,
              frequencyDays: campaignFormFrequency,
              scheduledWeekday: campaignFormWeekday,
              scheduledTime: campaignFormTime,
              batchSize: campaignFormBatchSize,
              batchIntervalMinutes: campaignFormInterval,
              totalRecipients: totalCount,
            }
          : c
      );
      saveCampaignsToStorage(updated);
    } else {
      const newCamp: Campaign = {
        id: `camp_${Date.now()}`,
        name: campaignFormName.trim(),
        message: campaignFormMessage,
        targetType: campaignFormTargetType,
        selectedListIds: Array.from(campaignFormSelectedLists),
        targetGroupId: campaignFormTargetGroup,
        targetGroupName: selectedGroupName,
        frequencyDays: campaignFormFrequency,
        scheduledWeekday: campaignFormWeekday,
        scheduledTime: campaignFormTime,
        batchSize: campaignFormBatchSize,
        batchIntervalMinutes: campaignFormInterval,
        status: 'active',
        totalRecipients: totalCount,
        createdAt: new Date().toISOString(),
      };
      saveCampaignsToStorage([...campaigns, newCamp]);
    }

    setIsCampaignModalOpen(false);
  };

  const handleDeleteCampaign = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta Campanha?')) {
      const updated = campaigns.filter(c => c.id !== id);
      saveCampaignsToStorage(updated);
    }
  };

  const toggleCampaignStatus = (id: string) => {
    const updated = campaigns.map(c => 
      c.id === id ? { ...c, status: c.status === 'active' ? ('paused' as const) : ('active' as const) } : c
    );
    saveCampaignsToStorage(updated);
  };

  // Disparar Campanha Agora
  const handleExecuteCampaign = async (camp: Campaign) => {
    // 1. Reúne a lista de contatos destinatários
    let targetContacts: ContactItem[] = [];

    if (camp.targetType === 'lists') {
      const contactMap = new Map<string, ContactItem>();
      broadcastLists
        .filter(l => camp.selectedListIds.includes(l.id))
        .forEach(l => l.contacts.forEach(c => contactMap.set(c.id, c)));
      targetContacts = Array.from(contactMap.values());
    }

    if (camp.targetType === 'lists' && targetContacts.length === 0) {
      alert('Nenhum contato encontrado nas Listas de Transmissão selecionadas para esta campanha.');
      return;
    }

    const confirmText = camp.targetType === 'lists' 
      ? `Iniciar disparo da campanha "${camp.name}" para ${targetContacts.length} contatos em lotes de ${camp.batchSize} a cada ${camp.batchIntervalMinutes} min?`
      : `Disparar mensagem da campanha "${camp.name}" diretamente no grupo "${camp.targetGroupName || 'Grupo VIP'}"?`;

    if (!confirm(confirmText)) return;

    isAbortingRef.current = false;
    setExecutingCampaignId(camp.id);
    setDispatchProgress({ current: 0, total: targetContacts.length || 1, status: 'Iniciando disparos com cadência Anti-Ban...' });

    // Histórico de contatos já enviados para evitar repetição acidental
    const sentHistoryKey = `SP_SENT_CAMPAIGN_${camp.id}`;
    let alreadySentPhones: string[] = [];
    try {
      alreadySentPhones = JSON.parse(localStorage.getItem(sentHistoryKey) || '[]');
    } catch {}

    try {
      if (camp.targetType === 'lists') {
        let batchCounter = 0;

        for (let i = 0; i < targetContacts.length; i++) {
          // Checa se o usuário clicou em Cancelar / Parar
          if (isAbortingRef.current) {
            alert(`Disparo interrompido pelo usuário. Foram enviados ${i} contatos de ${targetContacts.length}.`);
            break;
          }

          const contact = targetContacts[i];
          const rawPhone = contact.cleanPhone || contact.phone;

          const formattedMsg = camp.message
            .replace(/\[Nome\]/gi, contact.name || 'Cliente')
            .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, cardapioUrl)
            .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, grupoVipUrl || '[Link do Grupo]');

          try {
            await fetch('http://localhost:3006/api/marketing/send-direct', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: rawPhone,
                name: contact.name,
                text: formattedMsg,
                companyId: company?.id,
              })
            });
            alreadySentPhones.push(rawPhone);
            localStorage.setItem(sentHistoryKey, JSON.stringify(alreadySentPhones));
          } catch (e) {}

          batchCounter++;
          setDispatchProgress({
            current: i + 1,
            total: targetContacts.length,
            status: `Enviado ${i + 1} de ${targetContacts.length} para ${contact.name || rawPhone}...`
          });

          // Delay individual seguro entre mensagens (6 a 8 segundos aleatórios)
          const randomDelay = Math.floor(Math.random() * 2000) + 6000;
          await new Promise(r => setTimeout(r, randomDelay));

          if (isAbortingRef.current) break;

          // Se atingiu o tamanho do lote e ainda há contatos restantes
          if (batchCounter >= camp.batchSize && (i + 1) < targetContacts.length) {
            batchCounter = 0;
            const totalPauseSeconds = (camp.batchIntervalMinutes || 25) * 60;

            for (let remaining = totalPauseSeconds; remaining > 0; remaining--) {
              if (isAbortingRef.current) break;

              const mins = Math.floor(remaining / 60);
              const secs = remaining % 60;
              setDispatchProgress({
                current: i + 1,
                total: targetContacts.length,
                status: `⏸️ Lote concluído! Pausa de segurança anti-ban: ${mins}m ${secs < 10 ? '0' : ''}${secs}s restantes...`
              });

              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
      } else {
        // Disparo para Grupo
        const formattedMsg = camp.message
          .replace(/\[Nome\]/gi, 'Pessoal')
          .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, cardapioUrl)
          .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, grupoVipUrl || '');

        await fetch('http://localhost:3006/api/marketing/send-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: camp.targetGroupId,
            name: camp.targetGroupName || 'Grupo VIP',
            text: formattedMsg,
            companyId: company?.id,
          })
        });

        setDispatchProgress({ current: 1, total: 1, status: 'Mensagem enviada com sucesso no grupo!' });
      }

      // Atualiza data do último envio
      const updated = campaigns.map(c => 
        c.id === camp.id ? { ...c, lastRunDate: new Date().toLocaleDateString('pt-BR') } : c
      );
      saveCampaignsToStorage(updated);
      if (!isAbortingRef.current) {
        alert('Disparo da campanha finalizado com sucesso!');
      }
    } catch (err: any) {
      alert('Erro ao disparar campanha: ' + err.message);
    } finally {
      setExecutingCampaignId(null);
      setDispatchProgress(null);
      isAbortingRef.current = false;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header Principal do Marketing */}
      <header className="px-6 py-5 border-b border-white/10 shrink-0 bg-[#0a0a0a]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Megaphone className="size-6 text-emerald-400" />
                Módulo de Marketing & Disparos
              </h2>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
                Exclusivo Smoking Pods
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Campanhas automatizadas, Listas de Transmissão salvas e disparos para Grupos VIP com Anti-Ban.
            </p>
          </div>

          {/* Botões de Ação do Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={syncWhatsAppContactsAndGroups}
              disabled={loadingSync}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              title="Sincroniza contatos da agenda do WhatsApp e grupos"
            >
              <RefreshCw className={`size-3.5 text-emerald-400 ${loadingSync ? 'animate-spin' : ''}`} />
              <span>{loadingSync ? 'Sincronizando...' : 'Sincronizar WhatsApp'}</span>
            </button>

            <button
              onClick={() => handleOpenCampaignModal()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
            >
              <Plus className="size-4 stroke-[3]" />
              <span>Nova Campanha</span>
            </button>
          </div>
        </div>

        {syncStatus && (
          <div className="mt-3 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg font-mono">
            {syncStatus}
          </div>
        )}

        {/* Barra de Sub-Navegação (Abas Limpas) */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'campaigns'
                ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                : 'text-white/50 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Layers className="size-4 text-emerald-400" />
            <span>Campanhas ({campaigns.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast_lists')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'broadcast_lists'
                ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                : 'text-white/50 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Users className="size-4 text-purple-400" />
            <span>Listas de Transmissão ({broadcastLists.length})</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal por Aba */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

        {/* ============================================================ */}
        {/* ABA 1: CAMPANHAS DE DISPARO */}
        {/* ============================================================ */}
        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            {/* Banner de Status de Execução Ativo */}
            {executingCampaignId && dispatchProgress && (
              <div className="p-5 bg-[#0c140e] border border-emerald-500/30 rounded-2xl space-y-3 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-bold">
                  <span className="text-emerald-400 flex items-center gap-2">
                    <RefreshCw className="size-4 animate-spin shrink-0" />
                    {dispatchProgress.status}
                  </span>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-white font-mono">{dispatchProgress.current} / {dispatchProgress.total}</span>
                    <button
                      type="button"
                      onClick={handleStopCampaign}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      <span>🛑 Parar Disparos</span>
                    </button>
                  </div>
                </div>
                <div className="h-2.5 w-full bg-black/60 rounded-full overflow-hidden border border-emerald-500/20">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${(dispatchProgress.current / Math.max(1, dispatchProgress.total)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Lista de Campanhas */}
            {campaigns.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 text-center text-white/40 space-y-3">
                <Megaphone className="size-10 text-white/20 mx-auto" />
                <p className="text-sm font-semibold text-white">Nenhuma campanha de marketing criada ainda.</p>
                <p className="text-xs max-w-md mx-auto">
                  Crie sua primeira campanha para disparar ofertas para suas Listas de Transmissão ou Grupos VIP.
                </p>
                <button
                  onClick={() => handleOpenCampaignModal()}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold inline-flex items-center gap-2"
                >
                  <Plus className="size-4" /> Criar Primeira Campanha
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {campaigns.map(camp => {
                  const targetListNames = broadcastLists
                    .filter(l => camp.selectedListIds?.includes(l.id))
                    .map(l => l.name);

                  return (
                    <div 
                      key={camp.id}
                      className="bg-[#0a0a0a] border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-md group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {camp.name}
                          </h3>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            camp.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                          }`}>
                            {camp.status === 'active' ? 'Ativa' : 'Pausada'}
                          </span>
                        </div>

                        {/* Informações de Destino */}
                        <div className="p-3 bg-[#050505] rounded-xl border border-white/5 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-white/60">
                            <span>Destino:</span>
                            <span className="font-semibold text-white">
                              {camp.targetType === 'lists' ? `${targetListNames.length} Listas Selecionadas` : 'Grupo WhatsApp'}
                            </span>
                          </div>
                          
                          {camp.targetType === 'lists' ? (
                            <div className="text-[11px] text-emerald-400 font-mono truncate">
                              📁 {targetListNames.join(', ') || 'Nenhuma lista'}
                            </div>
                          ) : (
                            <div className="text-[11px] text-amber-400 font-mono truncate">
                              💬 {camp.targetGroupName || 'Grupo VIP'}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-white/60 pt-1 border-t border-white/5">
                            <span>Frequência:</span>
                            <span className="font-semibold text-white">
                              {camp.frequencyDays === 0 
                                ? 'Disparo Único' 
                                : camp.scheduledWeekday 
                                  ? `Toda ${camp.scheduledWeekday.charAt(0) + camp.scheduledWeekday.slice(1).toLowerCase()}${camp.scheduledTime ? ` às ${camp.scheduledTime}` : ''}` 
                                  : `A cada ${camp.frequencyDays} dias`}
                            </span>
                          </div>
                        </div>

                        {/* Prévia da Mensagem */}
                        <p className="text-xs text-white/40 line-clamp-3 font-mono bg-[#050505] p-2.5 rounded-lg border border-white/5">
                          {camp.message}
                        </p>
                      </div>

                      {/* Ações da Campanha */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/5 gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleCampaignStatus(camp.id)}
                            title={camp.status === 'active' ? 'Pausar Campanha' : 'Ativar Campanha'}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
                          >
                            {camp.status === 'active' ? <Pause className="size-3.5" /> : <Play className="size-3.5 text-emerald-400" />}
                          </button>

                          <button
                            onClick={() => handleOpenCampaignModal(camp)}
                            title="Editar Configurações da Campanha"
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
                          >
                            <Edit3 className="size-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteCampaign(camp.id)}
                            title="Excluir Campanha"
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleExecuteCampaign(camp)}
                          disabled={executingCampaignId === camp.id}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all hover:shadow-md disabled:opacity-50"
                        >
                          <Send className="size-3" />
                          <span>Disparar Agora</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* ABA 2: LISTAS DE TRANSMISSÃO */}
        {/* ============================================================ */}
        {activeTab === 'broadcast_lists' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="size-5 text-purple-400" />
                  Listas de Transmissão Salvas
                </h3>
                <p className="text-xs text-white/50">
                  Crie grupos de contatos reutilizáveis para usar em diferentes campanhas. Adicione pessoas a qualquer momento.
                </p>
              </div>

              <button
                onClick={() => handleOpenListModal()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
              >
                <Plus className="size-4" /> Nova Lista de Transmissão
              </button>
            </div>

            {/* Grid de Listas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {broadcastLists.map(list => (
                <div
                  key={list.id}
                  className="bg-[#0a0a0a] border border-white/10 hover:border-purple-500/30 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-md group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                          <Users className="size-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                            {list.name}
                          </h4>
                          <span className="text-[10px] text-purple-400 font-mono">
                            {list.contacts.length} contatos vinculados
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-white/50 leading-relaxed">
                      {list.description || 'Lista sem descrição'}
                    </p>

                    {/* Amostra dos Primeiros Contatos */}
                    <div className="p-3 bg-[#050505] rounded-xl border border-white/5 space-y-1">
                      <span className="text-[10px] text-white/40 uppercase font-bold block mb-1">Membros na Lista:</span>
                      {list.contacts.length === 0 ? (
                        <span className="text-xs text-white/30 italic">Nenhum contato adicionado ainda</span>
                      ) : (
                        list.contacts.slice(0, 3).map(c => (
                          <div key={c.id} className="text-xs text-white/70 flex justify-between">
                            <span className="truncate">{c.name}</span>
                            <span className="text-white/40 font-mono text-[11px]">{c.phone}</span>
                          </div>
                        ))
                      )}
                      {list.contacts.length > 3 && (
                        <span className="text-[10px] text-purple-400 block pt-1">
                          + {list.contacts.length - 3} outros contatos...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <button
                      onClick={() => handleOpenListModal(list)}
                      className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="size-3.5" />
                      <span>Gerenciar Contatos (+Adicionar)</span>
                    </button>

                    <button
                      onClick={() => handleDeleteList(list.id)}
                      title="Excluir Lista"
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}



      </div>

      {/* ============================================================ */}
      {/* MODAL: CRIAR / EDITAR LISTA DE TRANSMISSÃO */}
      {/* ============================================================ */}
      {isListModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header do Modal */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="size-5 text-purple-400" />
                  {editingList ? 'Gerenciar Lista de Transmissão' : 'Nova Lista de Transmissão'}
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Selecione os contatos que farão parte desta lista
                </p>
              </div>
              <button 
                onClick={() => setIsListModalOpen(false)}
                className="text-white/40 hover:text-white text-sm font-mono px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Corpo do Formulário */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Nome da Lista</label>
                <input
                  type="text"
                  placeholder="Ex: Antigos Clientes SMK (~300)"
                  value={listFormName}
                  onChange={(e) => setListFormName(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Descrição (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Clientes da região de São Bernardo do Campo"
                  value={listFormDesc}
                  onChange={(e) => setListFormDesc(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {/* Seletor de Contatos */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/70">
                    Contatos ({listFormSelectedContacts.size} de {allContacts.length} selecionados)
                  </label>
                  <button
                    onClick={() => {
                      if (listFormSelectedContacts.size === allContacts.length) {
                        setListFormSelectedContacts(new Set());
                      } else {
                        setListFormSelectedContacts(new Set(allContacts.map(c => c.id)));
                      }
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                  >
                    {listFormSelectedContacts.size === allContacts.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Buscar contato por nome ou telefone..."
                  value={contactSearchQuery}
                  onChange={(e) => { setContactSearchQuery(e.target.value); setContactsVisibleCount(50); }}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                />

                <div className="h-60 overflow-y-auto border border-white/10 rounded-xl bg-[#050505] p-2 space-y-1 custom-scrollbar">
                  {(() => {
                    const query = contactSearchQuery.toLowerCase().trim();
                    const filtered = allContacts
                      .filter(c => 
                        c.name.toLowerCase().includes(query) || 
                        c.phone.includes(contactSearchQuery)
                      )
                      .sort((a, b) => {
                        if (!query) return a.name.localeCompare(b.name);
                        const aStarts = a.name.toLowerCase().startsWith(query);
                        const bStarts = b.name.toLowerCase().startsWith(query);
                        if (aStarts && !bStarts) return -1;
                        if (!aStarts && bStarts) return 1;
                        return a.name.localeCompare(b.name);
                      });
                    const CONTACTS_PER_PAGE = 50;
                    const visibleContacts = filtered.slice(0, contactsVisibleCount || CONTACTS_PER_PAGE);
                    const hasMore = filtered.length > visibleContacts.length;
                    
                    return (
                      <>
                        {filtered.length > CONTACTS_PER_PAGE && (
                          <div className="text-[10px] text-white/40 text-center py-1">
                            Mostrando {visibleContacts.length} de {filtered.length} contatos
                          </div>
                        )}
                        {visibleContacts.map(contact => {
                          const isSelected = listFormSelectedContacts.has(contact.id);
                          return (
                            <div
                              key={contact.id}
                              onClick={() => {
                                const next = new Set(listFormSelectedContacts);
                                if (next.has(contact.id)) next.delete(contact.id);
                                else next.add(contact.id);
                                setListFormSelectedContacts(next);
                              }}
                              className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                                isSelected ? 'bg-purple-500/15 border border-purple-500/30' : 'hover:bg-white/5 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  readOnly
                                  className="rounded border-white/20 bg-black text-purple-500 focus:ring-0 size-4 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-white block truncate">{contact.name}</span>
                                  <span className="text-[10px] text-white/40 font-mono truncate">{contact.phone}</span>
                                </div>
                              </div>
                              {contact.isSaved && (
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                  Salvo
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {hasMore && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContactsVisibleCount((prev: number) => (prev || CONTACTS_PER_PAGE) + CONTACTS_PER_PAGE);
                            }}
                            className="w-full py-2 mt-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-xs font-bold cursor-pointer transition-all"
                          >
                            Carregar mais {Math.min(CONTACTS_PER_PAGE, filtered.length - visibleContacts.length)} contatos...
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="p-4 border-t border-white/10 bg-[#0a0a0a] flex justify-end gap-2">
              <button
                onClick={() => setIsListModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveList}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
              >
                Salvar Lista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CRIAR / EDITAR CAMPANHA */}
      {/* ============================================================ */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header do Modal */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Megaphone className="size-5 text-emerald-400" />
                  {editingCampaign ? 'Configurar Campanha' : 'Nova Campanha de Disparo'}
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Configure o destino, mensagem e a frequência de disparo
                </p>
              </div>
              <button 
                onClick={() => setIsCampaignModalOpen(false)}
                className="text-white/40 hover:text-white text-sm font-mono px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Formulário */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
              {/* Nome da Campanha */}
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Nome da Campanha</label>
                <input
                  type="text"
                  placeholder="Ex: Reativação Sexta FDS + Lotes Exclusivos"
                  value={campaignFormName}
                  onChange={(e) => setCampaignFormName(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Escolha do Destino: Múltiplas Listas de Transmissão OU Grupo */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-white/70 block">Tipo de Destino do Disparo</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCampaignFormTargetType('lists')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      campaignFormTargetType === 'lists'
                        ? 'bg-purple-500/15 border-purple-500/40 text-white'
                        : 'bg-[#050505] border-white/10 text-white/50 hover:bg-white/5'
                    }`}
                  >
                    <Users className="size-5 text-purple-400" />
                    <div>
                      <span className="text-xs font-bold block text-white">Listas de Transmissão</span>
                      <span className="text-[10px] text-white/40">Selecione 1 ou mais listas de contatos</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCampaignFormTargetType('group')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      campaignFormTargetType === 'group'
                        ? 'bg-amber-500/15 border-amber-500/40 text-white'
                        : 'bg-[#050505] border-white/10 text-white/50 hover:bg-white/5'
                    }`}
                  >
                    <MessageSquare className="size-5 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold block text-white">Grupo de WhatsApp</span>
                      <span className="text-[10px] text-white/40">Dispara em canal / grupo VIP</span>
                    </div>
                  </button>
                </div>

                {/* Seleção de Múltiplas Listas */}
                {campaignFormTargetType === 'lists' && (
                  <div className="p-3.5 bg-[#050505] border border-white/10 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-white block">
                      Selecione as Listas que esta Campanha vai abordar:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {broadcastLists.map(list => {
                        const isChecked = campaignFormSelectedLists.has(list.id);
                        return (
                          <div
                            key={list.id}
                            onClick={() => {
                              const next = new Set(campaignFormSelectedLists);
                              if (next.has(list.id)) next.delete(list.id);
                              else next.add(list.id);
                              setCampaignFormSelectedLists(next);
                            }}
                            className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between ${
                              isChecked ? 'bg-purple-500/20 border-purple-500/40' : 'bg-black/50 border-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                readOnly
                                className="rounded border-white/20 bg-black text-purple-500 focus:ring-0 size-4 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-white">{list.name}</span>
                            </div>
                            <span className="text-[10px] text-purple-400 font-mono">{list.contacts.length} contatos</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Seleção do Grupo */}
                {campaignFormTargetType === 'group' && (
                  <div className="p-3.5 bg-[#050505] border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white block">Grupo de Destino do WhatsApp:</span>
                      <span className="text-[10px] text-amber-400 font-mono">Editável a qualquer momento</span>
                    </div>

                    {whatsAppGroups.length > 0 ? (
                      <select
                        value={campaignFormTargetGroup}
                        onChange={(e) => setCampaignFormTargetGroup(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 font-sans"
                      >
                        <option value="">-- Selecione o grupo sincronizado --</option>
                        {whatsAppGroups.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name} {g.participantsCount > 0 ? `(${g.participantsCount} membros)` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={campaignFormTargetGroup || 'Grupo VIP Oficial (Conectar WhatsApp para vincular)'}
                          onChange={(e) => setCampaignFormTargetGroup(e.target.value)}
                          placeholder="Ex: Grupo VIP Oficial SBC"
                          className="w-full bg-black border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-400"
                        />
                        <p className="text-[11px] text-white/50 leading-relaxed">
                          💡 <strong>WhatsApp em repouso:</strong> Você pode salvar a campanha agora normalmente. Quando o WhatsApp for reconectado, basta clicar em <strong>Editar</strong> nesta campanha para selecionar o grupo oficial da lista!
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Frequência do Disparo e Horário */}
              <div className={`grid gap-4 ${campaignFormTargetType === 'lists' ? 'grid-cols-1 md:grid-cols-3' : campaignFormFrequency > 0 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Recorrência / Intervalo</label>
                  <select
                    value={campaignFormFrequency}
                    onChange={(e) => setCampaignFormFrequency(Number(e.target.value))}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    <option value={0}>Disparo Único (Sem repetição)</option>
                    <option value={7}>Semanal (Escolher Dia da Semana)</option>
                    <option value={14}>Quinzenal (A cada 14 dias)</option>
                    <option value={21}>A cada 21 dias (3 semanas)</option>
                    <option value={30}>Mensal (A cada 30 dias)</option>
                  </select>
                </div>

                {campaignFormFrequency > 0 && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-white/70 block mb-1">Dia da Semana</label>
                      <select
                        value={campaignFormWeekday}
                        onChange={(e) => setCampaignFormWeekday(e.target.value)}
                        className="w-full bg-[#050505] border border-emerald-500/30 rounded-xl p-2.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
                      >
                        <option value="SEGUNDA">Toda Segunda-feira</option>
                        <option value="TERCA">Toda Terça-feira</option>
                        <option value="QUARTA">Toda Quarta-feira</option>
                        <option value="QUINTA">Toda Quinta-feira</option>
                        <option value="SEXTA">Toda Sexta-feira</option>
                        <option value="SABADO">Todo Sábado</option>
                        <option value="DOMINGO">Todo Domingo</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-white/70 block mb-1">Horário do Disparo</label>
                      <input
                        type="time"
                        value={campaignFormTime}
                        onChange={(e) => setCampaignFormTime(e.target.value)}
                        className="w-full bg-[#050505] border border-emerald-500/30 rounded-xl p-2.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </>
                )}

                {campaignFormTargetType === 'lists' && (
                  <div className="col-span-full">
                    <label className="text-xs font-bold text-white/70 block mb-1">Cadência Anti-Ban</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={campaignFormBatchSize}
                        onChange={(e) => setCampaignFormBatchSize(Number(e.target.value))}
                        className="w-1/2 bg-[#050505] border border-white/10 rounded-xl p-2.5 text-xs text-white font-mono"
                        placeholder="Lote (ex: 20)"
                      />
                      <input
                        type="number"
                        value={campaignFormInterval}
                        onChange={(e) => setCampaignFormInterval(Number(e.target.value))}
                        className="w-1/2 bg-[#050505] border border-white/10 rounded-xl p-2.5 text-xs text-white font-mono"
                        placeholder="Min (ex: 45)"
                      />
                    </div>
                    <span className="text-[10px] text-white/40 mt-1 block">Lote de contatos e intervalo em minutos</span>
                  </div>
                )}
              </div>

              {/* Modelos e Mensagem */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/70">Mensagem da Campanha</label>
                  <span className="text-[10px] text-white/40 font-mono">Variável: [Nome]</span>
                </div>

                {/* Modelos Prontos */}
                <div className="flex flex-wrap gap-2">
                  {OFFICIAL_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setCampaignFormMessage(t.text)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] text-white/70 font-semibold cursor-pointer"
                    >
                      {t.title}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={8}
                  value={campaignFormMessage}
                  onChange={(e) => setCampaignFormMessage(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-emerald-500/50"
                  placeholder="Escreva sua mensagem aqui..."
                />
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="p-4 border-t border-white/10 bg-[#0a0a0a] flex justify-end gap-2">
              <button
                onClick={() => setIsCampaignModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCampaign}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold"
              >
                Salvar Campanha
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
