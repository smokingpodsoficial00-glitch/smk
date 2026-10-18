import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Send, Users, ShieldAlert, Sparkles, Clock, CheckCircle2, 
  AlertTriangle, RefreshCw, MessageSquare, Play, Pause, ExternalLink,
  Flame, Lock, Copy, Check, Plus, Trash2, Edit3, ArrowRight, CheckSquare,
  Square, Calendar, Layers, ShieldCheck, HelpCircle, ChevronRight,
  ToggleLeft, ToggleRight, Zap, Smartphone, QrCode, LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getBackendUrl } from '@/lib/backend';
import { fetchLiveClients, type RealClient } from '@/lib/crm';
import { 
  fetchMarketingLists, 
  createMarketingList, 
  updateMarketingList, 
  deleteMarketingList, 
  type BroadcastList, 
  type ContactItem 
} from '@/lib/marketingLists';
import { 
  fetchMarketingCampaigns, 
  createMarketingCampaign, 
  updateMarketingCampaign, 
  deleteMarketingCampaign, 
  setMarketingCampaignStatus, 
  type Campaign 
} from '@/lib/marketingCampaigns';

export type { ContactItem, BroadcastList, Campaign };

interface WhatsAppGroup {
  id: string;
  name: string;
  participantsCount: number;
}

const OFFICIAL_TEMPLATES = [
  {
    id: 'oferta_do_dia_vip',
    title: '🔥 Oferta do Dia no VIP (Foto + Sabores)',
    badge: 'Nova • Vitrine Estoque',
    text: `🔥 OFERTA DO DIA NO VIP: [NOME_DO_MODELO]! 💨\n\n💰 Apenas R$ [PREÇO]\n\n✨ Sabores disponíveis em estoque agora:\n• [Sabor 1]\n• [Sabor 2]\n• [Sabor 3]\n\n🚀 Peça direto no nosso cardápio ou no whatsapp antes que esgote:\n👉 [LINK_DO_CARDAPIO_VERCEL]`,
  },
  {
    id: 'weekend_vip',
    title: 'Final de Semana + Grupo VIP',
    badge: 'Mais Convertida',
    text: `Oii, tudo bem? ✨\nPassando pra te avisar que nosso estoque pro final de semana já está abastecido!\n\nAs entregas já estão rolando a todo vapor pra você *garantir seus produtos a tempo e não ficar na mão*. Reabrimos com estoque 100% renovado, produtos originais e o delivery rápido de sempre de *30 a 40 min*.\n\n📦 *Dá uma olhada nas opções disponíveis no Cardápio Digital:*\n🔗 [LINK_DO_CARDAPIO_VERCEL]\n\n💬 *Também ativamos o Grupo VIP no WhatsApp pra soltar lotes exclusivos e frete promocional pro fds:*\n🔗 [LINK_DO_GRUPO_VIP_WHATSAPP]\n\nQual item posso separar pra você já garantir pro fds?`,
  },
  {
    id: 'antigos_clientes',
    title: 'Clientes das Antigas (Tom Pessoal)',
    badge: 'Alta Resposta',
    text: `Opa [Nome], quanto tempo! De boa? 🔥\nSei que fazia um tempinho que estávamos sem nos falar, mas organizamos a casa e *voltamos com tudo!*\n\nComo você é da nossa base das antigas, tô te mandando o *Catálogo Digital atualizado* pra você dar uma olhada nas novidades e produtos que chegaram:\n🔗 [LINK_DO_CARDAPIO_VERCEL]\n\n⚡ *Hoje tamo com prioridade máxima de entrega rápida (30-40 min via Uber Direct).*\n\n🔒 *Se quiser receber ofertas relâmpago e condições exclusivas antes de todo mundo, entra no nosso Grupo VIP:*\n🔗 [LINK_DO_GRUPO_VIP_WHATSAPP]\n\nTô por aqui se precisar de algo, só chamar!`,
  },
  {
    id: 'reposicao_ativa',
    title: 'Aviso de Recompra (Reposição)',
    badge: 'Timing de Uso',
    text: `E aí [Nome]! Tudo certo? ✨\nPelo meu controle aqui, seu último produto já deve estar no final ou precisando de reposição!\n\nPra você não ficar na mão no meio da semana, quer que eu já separe uma novidade pra você?\n\n📦 Cardápio completo no ar: [LINK_DO_CARDAPIO_VERCEL]\nMe avisa aqui qual produto posso agilizar pro seu delivery!`,
  },
  {
    id: 'insta_grupo_vip',
    title: 'Instagram & Bastidores (Grupo VIP)',
    badge: 'Comunidade & Prova Social',
    text: `📸 *BASTIDORES & COMUNICADOS OFICIAIS* 🚀\n\nSalve turma do VIP! Passando um recado rápido pra quem ainda não acompanha nosso perfil oficial no Instagram:\n\nÉ por lá que a gente posta em tempo real:\n• 🛵 Saída dos motoboys e rotina de entregas;\n• 🎬 Vídeos e unboxing das novidades e produtos que chegam;\n• 📢 Avisos de horários de funcionamento e novidades da loja.\n\n📲 *Clica no link e segue a gente lá pra acompanhar tudo:*\n🔗 [LINK_DO_INSTAGRAM]\n\n*Tamo junto!*`,
  },
  {
    id: 'salvar_contato_vip',
    title: 'Salvar Contato na Agenda (Status VIP)',
    badge: 'Alcance Orgânico & Status',
    text: `📲 *AVISO VIP: SALVE NOSSO CONTATO NA SUA AGENDA!* ⚡\n\nFala pessoal do VIP! Passando um recado importante pra vocês:\n\nQuem tem o nosso número salvo nos contatos do celular consegue acompanhar nossos *Status diários no WhatsApp*!\n\nÉ por lá que a gente posta:\n• ✨ Ofertas relâmpago de última hora com desconto;\n• 📦 Chegada de novidades e itens exclusivos antes de irem pro cardápio;\n• 🛵 Avisos rápidos de saídas do motoboy no dia a dia.\n\n👉 *Salva aí no seu celular:* Contato Oficial da Loja\n\n*Assim você não perde nenhuma oportunidade da semana!* 🥇`,
  },
  {
    id: 'lembrete_pre_fds_vip',
    title: 'Lembrete Pré-FDS / Reserva Semanal (Quarta 18:30)',
    badge: 'Antecipação & Sem Fila',
    text: `⏳ *LEMBRETE VIP: ANTECIPE SEU PEDIDO PRO FDS!* ✨\n\nSalve galera do VIP! Passando pra avisar quem gosta de se planejar com calma:\n\nSexta e sábado a fila de despacho do delivery costuma ser bem cheia. Se você já quiser garantir seus produtos agora no meio da semana, seu pedido sai na hora e sem correria!\n\n📦 *Cardápio 100% atualizado com os novos lotes:*\n🔗 [LINK_DO_CARDAPIO_VERCEL]\n\n⚡ *Entregas rápidas de 25 a 35 min!*\n\n*Garanta seus itens favoritos antes da correria do fds!* 🥇`,
  },
  {
    id: 'mgm_indique_ganhe',
    title: 'Programa Indique & Ganhe (1 Produto Grátis)',
    badge: 'Multiplicação de Base',
    text: `🎁 *GANHE 1 PRODUTO 100% GRÁTIS — PROGRAMA VIP!* 👑\n\nFala [Nome], beleza? Quer garantir seu próximo pedido com item na faixa?\n\nComo funciona nosso programa de indicação:\n1️⃣ Indique *5 amigos* que comprem na loja.\n2️⃣ Ao fazerem o pedido no WhatsApp, eles só precisam avisar: *"Fui indicado pelo [Nome]"*.\n3️⃣ Assim que os 5 pedidos forem confirmados, *você ganha 1 PRODUTO 100% GRÁTIS* (você só paga o frete do motoboy)!\n\n📲 *Manda o link do nosso Cardápio pra galera:*\n🔗 [LINK_DO_CARDAPIO_VERCEL]\n\n*Já avisa os parceiros e garante seu produto na faixa!* 🚀`,
  },
];

const LOCAL_STORAGE_LISTS = 'smoking_broadcast_lists_v1';
const LOCAL_STORAGE_CAMPAIGNS = 'smoking_marketing_campaigns_v1';

// Higienização automática de contatos corrompidos (substitui LIDs de 15/17 dígitos pelo telefone real)
function sanitizeBroadcastLists(lists: BroadcastList[]): { lists: BroadcastList[]; hasChanges: boolean } {
  let hasChanges = false;
  const sanitized = lists.map(list => {
    let listChanged = false;
    const cleanContacts = (list.contacts || []).map(c => {
      const raw = String(c.cleanPhone || c.phone || '').replace(/\D/g, '');
      const isEduardo = (c.name && c.name.toLowerCase().includes('eduardo')) || 
                        raw === '206494142341307' || raw === '55206494142341307' ||
                        raw === '69020627816488' || raw === '5569020627816488';
      if (isEduardo && raw !== '5511951741181' && raw !== '11951741181') {
        listChanged = true;
        hasChanges = true;
        return {
          ...c,
          name: 'Eduardo Oliveira Pizza',
          phone: '5511951741181',
          cleanPhone: '5511951741181',
          isSaved: true
        };
      }
      return c;
    });
    return listChanged ? { ...list, contacts: cleanContacts } : list;
  });
  return { lists: sanitized, hasChanges };
}

export default function MarketingModule() {
  const { company } = useAuth();
  
  // Abas do Módulo: 'campaigns' | 'broadcast_lists'
  const [activeTab, setActiveTab] = useState<'campaigns' | 'broadcast_lists'>('campaigns');
  
  // Base Global de Contatos e Grupos do WhatsApp
  const [allContacts, setAllContacts] = useState<ContactItem[]>([]);
  const [whatsAppGroups, setWhatsAppGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingSync, setLoadingSync] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Listas de Transmissão Criadas
  const [broadcastLists, setBroadcastLists] = useState<BroadcastList[]>([]);
  
  // Campanhas Criadas
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Estado da Conexão do WhatsApp Oficial & QR Code (Ciclo Lazy / Sob Demanda)
  const [whatsAppSessionStatus, setWhatsAppSessionStatus] = useState<string>('DISCONNECTED');
  const [hasSavedSession, setHasSavedSession] = useState<boolean>(false);
  const [whatsAppConnected, setWhatsAppConnected] = useState<boolean>(false);
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [qrLoading, setQrLoading] = useState<boolean>(false);

  // Consulta status sem disparar geração contínua de QR
  const checkWhatsAppStatus = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/qr`);
      if (res.ok) {
        setBackendOnline(true);
        const data = await res.json();
        setWhatsAppSessionStatus(data.status || 'DISCONNECTED');
        setHasSavedSession(!!data.hasSavedSession);

        if (data.isReady || data.status === 'CONNECTED') {
          setWhatsAppConnected(true);
          setQrCodeImageUrl(null);
        } else {
          setWhatsAppConnected(false);
          if (data.status === 'QR_AVAILABLE' && data.qrImageUrl) {
            setQrCodeImageUrl(data.qrImageUrl);
          } else {
            setQrCodeImageUrl(null);
          }
        }
      } else {
        setBackendOnline(false);
      }
    } catch (e) {
      setBackendOnline(false);
    }
  };

  // Checa status inicial no mount
  useEffect(() => {
    checkWhatsAppStatus();
  }, []);

  // Polling ativo APENAS enquanto o modal de conexão estiver aberto e não conectado
  useEffect(() => {
    if (!isQrModalOpen || whatsAppConnected) return;
    const interval = setInterval(checkWhatsAppStatus, 2500);
    return () => clearInterval(interval);
  }, [isQrModalOpen, whatsAppConnected]);

  // Ação explícita do usuário: "Conectar WhatsApp"
  const handleStartConnectWhatsApp = async () => {
    setIsQrModalOpen(true);
    setQrLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/whatsapp/connect`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setWhatsAppSessionStatus(data.status || 'CONNECTING');
        setHasSavedSession(!!data.hasSavedSession);
        if (data.isReady) {
          setWhatsAppConnected(true);
          setQrCodeImageUrl(null);
        } else if (data.qrImageUrl) {
          setWhatsAppConnected(false);
          setQrCodeImageUrl(data.qrImageUrl);
        }
      } else {
        alert('Falha ao comunicar com o servidor backend.');
      }
    } catch (err: any) {
      alert(`Erro ao iniciar conexão: ${err.message}`);
    } finally {
      setQrLoading(false);
    }
  };

  // Ação de cancelamento da conexão pelo usuário
  const handleCancelConnect = async () => {
    setIsQrModalOpen(false);
    if (!whatsAppConnected) {
      try {
        await fetch(`${getBackendUrl()}/api/whatsapp/disconnect`, { method: 'POST' });
      } catch (e) {}
      setQrCodeImageUrl(null);
      setWhatsAppSessionStatus('DISCONNECTED');
    }
  };

  const handleRefreshQr = async () => {
    setQrLoading(true);
    try {
      await fetch(`${getBackendUrl()}/api/whatsapp/connect`, { method: 'POST' });
      await checkWhatsAppStatus();
    } finally {
      setQrLoading(false);
    }
  };

  const handleLogoutWhatsApp = async () => {
    if (!confirm('Deseja realmente SAIR do WhatsApp? A sessão será excluída e exigirá novo QR Code para conectar.')) {
      return;
    }
    setQrLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/logout`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setWhatsAppConnected(false);
      setQrCodeImageUrl(null);
      setWhatsAppSessionStatus('SESSION_INVALID');
      setHasSavedSession(false);
      alert(data.message || 'Sessão destruída.');
    } catch (e) {
      alert('Não foi possível comunicar com o servidor backend.');
    } finally {
      setQrLoading(false);
    }
  };

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

  // Formulário de Criação de Campanha (Enxuto e Intuitivo)
  const [campaignFormName, setCampaignFormName] = useState('');
  const [campaignFormMessage, setCampaignFormMessage] = useState(OFFICIAL_TEMPLATES[0].text);
  const [campaignFormVariations, setCampaignFormVariations] = useState<string[]>([]);
  const [campaignFormUseVariations, setCampaignFormUseVariations] = useState<boolean>(false);
  const [campaignFormTargetType, setCampaignFormTargetType] = useState<'lists' | 'group'>('lists');
  const [campaignFormSelectedLists, setCampaignFormSelectedLists] = useState<Set<string>>(new Set());
  const [campaignFormTargetGroup, setCampaignFormTargetGroup] = useState<string>('');
  const [campaignFormFrequency, setCampaignFormFrequency] = useState<number>(7); // dias
  const [campaignFormWeekday, setCampaignFormWeekday] = useState<string>('QUARTA');
  const [campaignFormTime, setCampaignFormTime] = useState<string>('15:00');
  const [campaignFormStartDate, setCampaignFormStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [campaignFormBatchSize, setCampaignFormBatchSize] = useState<number>(5);
  const [campaignFormInterval, setCampaignFormInterval] = useState<number>(35);
  const [campaignFormImageUrl, setCampaignFormImageUrl] = useState<string>('');
  const [campaignFormIsStockOffer, setCampaignFormIsStockOffer] = useState<boolean>(false);
  const [campaignFormStockOfferCount, setCampaignFormStockOfferCount] = useState<number>(1);
  const [cardapioUrl] = useState('https://smoking-pods.vercel.app');
  const [grupoVipUrl] = useState('');

  // Execução de Disparo & Controle de Pausa Real
  const [executingCampaignId, setExecutingCampaignId] = useState<string | null>(null);
  const [dispatchProgress, setDispatchProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const isAbortingRef = React.useRef(false);

  const [loadingSanitize, setLoadingSanitize] = useState(false);

  const handleStopCampaign = () => {
    isAbortingRef.current = true;
    setDispatchProgress(prev => prev ? { ...prev, status: 'Interrompendo disparos... aguarde o contato atual.' } : null);
  };

  const handleCleanAndDeduplicateLists = async () => {
    if (!confirm('⚡ Executar Higienização & Desduplicação Automática?\n\nO sistema vai:\n1. Analisar todas as listas e remover contatos duplicados cruzados.\n2. Preservar contatos únicos sem repetição.\n3. Proteger a base para disparos seguros.\n\nDeseja continuar?')) return;

    setLoadingSanitize(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/marketing/clean-and-deduplicate-lists`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBroadcastLists(data.lists);
        localStorage.setItem(LOCAL_STORAGE_LISTS, JSON.stringify(data.lists));
        // Recarrega campanhas atualizadas
        try {
          const campRes = await fetch(`${getBackendUrl()}/api/marketing/campaigns`);
          const campData = await campRes.json();
          if (campData.success && campData.campaigns) {
            setCampaigns(campData.campaigns);
            localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS, JSON.stringify(campData.campaigns));
          }
        } catch (e) {}

        alert(`✨ Higienização Concluída com Sucesso!\n\n👥 Total analisado: ${data.totalOriginal}\n⚡ Contatos Únicos: ${data.totalUnique}\n🗑️ Duplicatas Eliminadas: ${data.duplicatesRemoved}\n\nSuas listas estão limpas e protegidas contra repetições!`);
      } else {
        alert(`⚠️ ${data.error || 'Erro ao higienizar listas.'}`);
      }
    } catch (err: any) {
      alert(`❌ Erro ao conectar com o servidor: ${err.message}`);
    } finally {
      setLoadingSanitize(false);
    }
  };

  // Carrega Listas e Campanhas canônicas do Supabase
  useEffect(() => {
    if (!company?.id) return;

    let isMounted = true;

    const loadMarketingData = async () => {
      try {
        const [lists, camps] = await Promise.all([
          fetchMarketingLists(company.id),
          fetchMarketingCampaigns(company.id)
        ]);

        const sanitized = sanitizeBroadcastLists(lists);
        let finalLists = sanitized.lists;

        if (!finalLists || finalLists.length === 0) {
          const defaultDemoList: BroadcastList = {
            id: 'list-demo-vip',
            name: '⭐ Lista de Teste VIP (Demonstração)',
            description: 'Lista criada para testar campanhas com segurança sem disparar para clientes reais.',
            color: '#10b981',
            createdAt: new Date().toISOString(),
            contacts: [
              {
                id: 'contact-demo-1',
                name: 'Cliente Teste (Demonstração)',
                phone: '5511999999999',
                cleanPhone: '5511999999999',
                isSaved: true
              }
            ]
          };
          finalLists = [defaultDemoList];
        }

        if (isMounted) {
          setBroadcastLists(finalLists);
          setCampaigns(camps);
        }

        if (sanitized.hasChanges) {
          localStorage.setItem(LOCAL_STORAGE_LISTS, JSON.stringify(sanitized.lists));
          fetch(`${getBackendUrl()}/api/marketing/lists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lists: sanitized.lists })
          }).catch(() => {});
        }
      } catch (e: any) {
        console.warn('[MarketingModule] Erro ao carregar dados do Supabase:', e?.message || e);
      }
    };

    loadMarketingData();

    return () => {
      isMounted = false;
    };
  }, [company?.id]);

  // Sincroniza Contatos e Grupos do WhatsApp via backend
  const syncWhatsAppContactsAndGroups = async () => {
    setLoadingSync(true);
    setSyncStatus('Lendo agenda do WhatsApp e grupos conectados...');
    try {
      let fetchedContacts: ContactItem[] = [];
      let fetchedGroups: WhatsAppGroup[] = [];

      try {
        const res = await fetch(`${getBackendUrl()}/api/marketing/whatsapp-data`);
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

      // Se WhatsApp offline ou vazio, faz fallback inteligente para o CRM de Clientes da loja
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
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err: any) {
      console.error('Erro na sincronização:', err);
      setSyncStatus('Erro ao sincronizar contatos.');
    } finally {
      setLoadingSync(false);
    }
  };

  // Carrega contatos e grupos do cache ao iniciar
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
      setListFormSelectedContacts(new Set(allContacts.map(c => c.id)));
    }
    setIsListModalOpen(true);
  };

  // Salva Lista no Supabase
  const handleSaveList = async () => {
    if (!company?.id) {
      alert('Sessão inválida: nenhuma empresa selecionada.');
      return;
    }
    if (!listFormName.trim()) {
      alert('Por favor, informe o nome da Lista de Transmissão.');
      return;
    }

    const selectedMembers = allContacts.filter(c => listFormSelectedContacts.has(c.id));

    try {
      if (editingList) {
        const updated = await updateMarketingList(company.id, editingList.id, {
          name: listFormName.trim(),
          description: listFormDesc.trim() || undefined,
          contacts: selectedMembers
        });
        setBroadcastLists(prev => prev.map(l => l.id === updated.id ? updated : l));
      } else {
        const newList = await createMarketingList(company.id, {
          name: listFormName.trim(),
          description: listFormDesc.trim() || 'Lista personalizada de contatos',
          contacts: selectedMembers,
          color: '#10b981',
        });
        setBroadcastLists(prev => [...prev, newList]);
      }
      setIsListModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao salvar lista: ${err?.message || err}`);
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!company?.id) return;
    if (confirm('Tem certeza que deseja excluir esta Lista de Transmissão?')) {
      try {
        await deleteMarketingList(company.id, id);
        setBroadcastLists(prev => prev.filter(l => l.id !== id));
      } catch (err: any) {
        alert(`Erro ao excluir lista: ${err?.message || err}`);
      }
    }
  };

  // Abre Modal de Criar/Editar Campanha
  const handleOpenCampaignModal = (campToEdit?: Campaign) => {
    if (campToEdit) {
      setEditingCampaign(campToEdit);
      setCampaignFormName(campToEdit.name);
      setCampaignFormMessage(campToEdit.message);
      setCampaignFormVariations(campToEdit.variations || []);
      setCampaignFormUseVariations(!!campToEdit.useVariations);
      setCampaignFormTargetType(campToEdit.targetType === 'group' ? 'group' : 'lists');
      setCampaignFormSelectedLists(new Set(campToEdit.selectedListIds || []));
      setCampaignFormTargetGroup(campToEdit.targetGroupId || (whatsAppGroups.length > 0 ? whatsAppGroups[0].id : ''));
      setCampaignFormFrequency(campToEdit.frequencyDays);
      setCampaignFormWeekday(campToEdit.scheduledWeekday || 'QUARTA');
      setCampaignFormTime(campToEdit.scheduledTime || '15:00');
      setCampaignFormStartDate(campToEdit.startDate || new Date().toISOString().split('T')[0]);
      setCampaignFormBatchSize(campToEdit.batchSize || 5);
      setCampaignFormInterval(campToEdit.batchIntervalMinutes || 35);
      setCampaignFormImageUrl(campToEdit.imageUrl || '');
      setCampaignFormIsStockOffer(!!campToEdit.isStockOffer);
      setCampaignFormStockOfferCount(campToEdit.stockOfferCount || 1);
    } else {
      setEditingCampaign(null);
      setCampaignFormName('');
      setCampaignFormMessage(OFFICIAL_TEMPLATES[0].text);
      setCampaignFormVariations([]);
      setCampaignFormUseVariations(false);
      setCampaignFormTargetType('lists');
      const firstListId = broadcastLists.length > 0 ? broadcastLists[0].id : '';
      setCampaignFormSelectedLists(new Set(firstListId ? [firstListId] : []));
      setCampaignFormTargetGroup(whatsAppGroups.length > 0 ? whatsAppGroups[0].id : '');
      setCampaignFormFrequency(7);
      setCampaignFormWeekday('QUARTA');
      setCampaignFormTime('15:00');
      setCampaignFormStartDate(new Date().toISOString().split('T')[0]);
      setCampaignFormBatchSize(5);
      setCampaignFormInterval(35);
      setCampaignFormImageUrl('');
      setCampaignFormIsStockOffer(false);
      setCampaignFormStockOfferCount(1);
    }
    setIsCampaignModalOpen(true);
  };

  // Salva Campanha no Supabase
  const handleSaveCampaign = async () => {
    if (!company?.id) {
      alert('Sessão inválida: nenhuma empresa selecionada.');
      return;
    }
    if (!campaignFormName.trim()) {
      alert('Por favor, informe o nome da Campanha.');
      return;
    }
    if (!campaignFormMessage.trim()) {
      alert('Por favor, escreva o texto da mensagem.');
      return;
    }

    let totalCount = 0;
    if (campaignFormTargetType === 'lists') {
      const uniqueContactPhones = new Set<string>();
      broadcastLists
        .filter(l => campaignFormSelectedLists.has(l.id))
        .forEach(l => l.contacts.forEach(c => uniqueContactPhones.add(c.cleanPhone || c.phone)));
      totalCount = uniqueContactPhones.size;
    } else {
      const selectedGroup = whatsAppGroups.find(g => g.id === campaignFormTargetGroup);
      totalCount = selectedGroup?.participantsCount || 1;
    }

    const selectedGroupName = whatsAppGroups.find(g => g.id === campaignFormTargetGroup)?.name;

    if (editingCampaign) {
      const updatedCamp: Campaign = {
        ...editingCampaign,
        name: campaignFormName.trim(),
        message: campaignFormMessage,
        variations: editingCampaign.variations || [],
        useVariations: editingCampaign.useVariations || false,
        targetType: campaignFormTargetType,
        selectedListIds: Array.from(campaignFormSelectedLists),
        targetGroupId: campaignFormTargetGroup,
        targetGroupName: selectedGroupName,
        frequencyDays: Number(campaignFormFrequency),
        scheduledWeekday: Number(campaignFormFrequency) === 7 ? campaignFormWeekday : undefined,
        scheduledTime: campaignFormTime,
        startDate: campaignFormStartDate,
        batchSize: campaignFormBatchSize || 5,
        batchIntervalMinutes: campaignFormInterval || 35,
        imageUrl: campaignFormImageUrl.trim() || undefined,
        isStockOffer: campaignFormIsStockOffer,
        stockOfferCount: campaignFormStockOfferCount,
        totalRecipients: totalCount,
        updatedAt: new Date().toISOString()
      };

      setCampaigns(prev => prev.map(c => c.id === updatedCamp.id ? updatedCamp : c));
      setIsCampaignModalOpen(false);

      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_CAMPAIGNS);
        const stored = raw ? JSON.parse(raw) : [];
        const newStored = stored.some((c: any) => c.id === updatedCamp.id)
          ? stored.map((c: any) => c.id === updatedCamp.id ? updatedCamp : c)
          : [...stored, updatedCamp];
        localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS, JSON.stringify(newStored));

        fetch(`${getBackendUrl()}/api/marketing/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaigns: newStored })
        }).catch(() => {});
      } catch (e) {}

      updateMarketingCampaign(
        company.id,
        editingCampaign.id,
        updatedCamp,
        editingCampaign.updatedAt || editingCampaign.createdAt
      ).catch(e => console.warn('[Marketing] Erro ao sincronizar campanha:', e));
    } else {
      const newCamp: Campaign = {
        id: `camp_${Date.now()}`,
        name: campaignFormName.trim(),
        message: campaignFormMessage,
        variations: [],
        useVariations: false,
        targetType: campaignFormTargetType,
        selectedListIds: Array.from(campaignFormSelectedLists),
        targetGroupId: campaignFormTargetGroup,
        targetGroupName: selectedGroupName,
        frequencyDays: Number(campaignFormFrequency),
        scheduledWeekday: Number(campaignFormFrequency) === 7 ? campaignFormWeekday : undefined,
        scheduledTime: campaignFormTime,
        startDate: campaignFormStartDate,
        batchSize: 5,
        batchIntervalMinutes: 35,
        imageUrl: campaignFormImageUrl.trim() || undefined,
        isStockOffer: campaignFormIsStockOffer,
        stockOfferCount: campaignFormStockOfferCount,
        status: 'active',
        totalRecipients: totalCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setCampaigns(prev => [...prev, newCamp]);
      setIsCampaignModalOpen(false);

      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_CAMPAIGNS);
        const stored = raw ? JSON.parse(raw) : [];
        const newStored = [...stored, newCamp];
        localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS, JSON.stringify(newStored));

        fetch(`${getBackendUrl()}/api/marketing/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaigns: newStored })
        }).catch(() => {});
      } catch (e) {}

      createMarketingCampaign(company.id, newCamp).catch(e => console.warn('[Marketing] Erro ao criar Supabase:', e));
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!company?.id) return;
    if (confirm('Tem certeza que deseja excluir esta Campanha?')) {
      try {
        await deleteMarketingCampaign(company.id, id);
        setCampaigns(prev => prev.filter(c => c.id !== id));
      } catch (err: any) {
        alert(`Erro ao excluir campanha: ${err?.message || err}`);
      }
    }
  };

  const toggleCampaignStatus = async (id: string) => {
    if (!company?.id) return;
    const current = campaigns.find(c => c.id === id);
    if (!current) return;
    const newStatus = current.status === 'active' ? 'paused' : 'active';
    try {
      await setMarketingCampaignStatus(company.id, id, newStatus);
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err: any) {
      alert(`Erro ao alterar status da campanha: ${err?.message || err}`);
    }
  };

  // Disparar Campanha
  const handleExecuteCampaign = async (camp: Campaign) => {
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
      ? `Iniciar disparo da campanha "${camp.name}" para ${targetContacts.length} contatos com cadência segura anti-ban (5 envios a cada 35 min)?`
      : `Disparar mensagem da campanha "${camp.name}" diretamente no grupo "${camp.targetGroupName || 'Grupo VIP'}"?`;

    if (!confirm(confirmText)) return;

    isAbortingRef.current = false;
    setExecutingCampaignId(camp.id);

    const sentHistoryKey = `SP_SENT_CAMPAIGN_${camp.id}`;
    let alreadySentPhones: string[] = [];
    try {
      alreadySentPhones = JSON.parse(localStorage.getItem(sentHistoryKey) || '[]');
    } catch {}

    try {
      const resp = await fetch(`${getBackendUrl()}/api/marketing/sent-history`);
      if (resp.ok) {
        const data = await resp.json();
        const serverCampSent = data.sentHistory?.[camp.id] || [];
        const serverGlobalSent = data.sentHistory?.globalSent || [];
        const combined = Array.from(new Set([...alreadySentPhones, ...serverCampSent, ...serverGlobalSent]));
        alreadySentPhones = combined;
        localStorage.setItem(sentHistoryKey, JSON.stringify(combined));
      }
    } catch {}

    let forceSend = false;
    if (camp.targetType === 'lists') {
      const pendingContacts = targetContacts.filter(c => {
        const raw = c.cleanPhone || c.phone;
        const clean = String(raw).replace(/\D/g, '');
        const norm = clean.startsWith('55') ? clean : `55${clean}`;
        return !alreadySentPhones.includes(norm) && !alreadySentPhones.includes(raw);
      });

      if (pendingContacts.length === 0 && targetContacts.length > 0) {
        const wantForce = confirm(
          `⚠️ Atenção: Todos os ${targetContacts.length} contatos desta lista já receberam esta mensagem anteriormente.\n\nDeseja reenviar mesmo assim?`
        );
        if (!wantForce) {
          setExecutingCampaignId(null);
          return;
        }
        forceSend = true;
      }
    }

    setDispatchProgress({ 
      current: forceSend ? 0 : alreadySentPhones.length, 
      total: targetContacts.length || 1, 
      status: forceSend 
        ? '🚀 Iniciando disparo para a lista selecionada...' 
        : (alreadySentPhones.length > 0 
          ? `Retomando disparos... (${alreadySentPhones.length} já enviados)` 
          : 'Iniciando disparos com cadência segura Anti-Ban...') 
    });

    let sentInThisSession = 0;
    let skippedCount = 0;
    const failedContacts: { name: string; reason: string }[] = [];

    try {
      if (camp.targetType === 'lists') {
        let batchCounter = 0;
        const effectiveBatchSize = (camp.batchSize && camp.batchSize <= 5) ? camp.batchSize : 5;
        const effectiveBatchIntervalMinutes = (camp.batchIntervalMinutes && camp.batchIntervalMinutes >= 35) ? camp.batchIntervalMinutes : 35;

        for (let i = 0; i < targetContacts.length; i++) {
          if (isAbortingRef.current) {
            alert(`🛑 Disparo interrompido. Foram enviados ${sentInThisSession} contatos nesta sessão.`);
            break;
          }

          const contact = targetContacts[i];
          const rawPhone = contact.cleanPhone || contact.phone;
          const cleanDigits = String(rawPhone).replace(/\D/g, '');
          const normalizedPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;

          if (!forceSend && (alreadySentPhones.includes(normalizedPhone) || alreadySentPhones.includes(rawPhone))) {
            continue;
          }

          let chosenText = camp.message;
          if (camp.useVariations && camp.variations && camp.variations.length > 0) {
            const allAvailableTexts = [camp.message, ...camp.variations.filter(v => v.trim().length > 0)];
            chosenText = allAvailableTexts[batchCounter % allAvailableTexts.length];
          }

          const formattedMsg = chosenText
            .replace(/\[Nome\]/gi, contact.name || 'Cliente')
            .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, cardapioUrl)
            .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, grupoVipUrl || '[Link do Grupo]');

          if (isAbortingRef.current) break;

          try {
            const res = await fetch(`${getBackendUrl()}/api/marketing/send-direct`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: normalizedPhone,
                name: contact.name,
                text: formattedMsg,
                campaignId: camp.id,
                companyId: company?.id,
                force: forceSend,
                imageUrl: camp.imageUrl,
                isStockOffer: camp.isStockOffer,
                stockOfferCount: camp.stockOfferCount || 1,
              })
            });
            const resData = await res.json();
            
            if (!res.ok || !resData.success) {
              const reason = resData.message || resData.error || 'Erro de entrega';
              failedContacts.push({ name: contact.name || normalizedPhone, reason });
              setDispatchProgress({
                current: alreadySentPhones.length,
                total: targetContacts.length,
                status: `⚠️ Erro no envio para ${contact.name || normalizedPhone}. Avançando...`
              });
              alreadySentPhones.push(normalizedPhone);
              localStorage.setItem(sentHistoryKey, JSON.stringify(alreadySentPhones));
              continue;
            }

            if (resData.skipped) {
              skippedCount++;
              setDispatchProgress({
                current: alreadySentPhones.length,
                total: targetContacts.length,
                status: `⏩ ${contact.name || normalizedPhone} já recebeu anteriormente. Pulando...`
              });
            } else {
              sentInThisSession++;
              alreadySentPhones.push(normalizedPhone);
              localStorage.setItem(sentHistoryKey, JSON.stringify(alreadySentPhones));

              setDispatchProgress({
                current: alreadySentPhones.length,
                total: targetContacts.length,
                status: `✅ Entregue (${sentInThisSession}/${targetContacts.length}) para ${contact.name || normalizedPhone}. Aguardando intervalo de segurança...`
              });
            }
          } catch (e: any) {
            setDispatchProgress({
              current: alreadySentPhones.length,
              total: targetContacts.length,
              status: `⚠️ Erro de conexão para ${contact.name}. Avançando...`
            });
            continue;
          }

          batchCounter++;

          // Intervalo individual entre mensagens (20 a 35 segundos aleatórios)
          const randomDelay = Math.floor(Math.random() * 15000) + 20000;
          for (let elapsed = 0; elapsed < randomDelay; elapsed += 250) {
            if (isAbortingRef.current) break;
            const remainingDelaySec = Math.max(0, Math.ceil((randomDelay - elapsed) / 1000));
            setDispatchProgress(prev => prev ? {
              ...prev,
              status: `⏳ Intervalo de proteção anti-ban: aguardando ${remainingDelaySec}s antes do próximo contato...`
            } : null);
            await new Promise(r => setTimeout(r, 250));
          }

          if (isAbortingRef.current) {
            alert(`🛑 Disparo interrompido. Foram enviados ${sentInThisSession} contatos.`);
            break;
          }

          // Pausa entre lotes (a cada 5 contatos pausa 35 min)
          const remainingContacts = targetContacts.filter(c => !alreadySentPhones.includes(c.cleanPhone || c.phone));
          if (batchCounter >= effectiveBatchSize && remainingContacts.length > 0) {
            batchCounter = 0;
            const pauseDurationMs = effectiveBatchIntervalMinutes * 60 * 1000;
            const targetEndTime = Date.now() + pauseDurationMs;

            while (Date.now() < targetEndTime) {
              if (isAbortingRef.current) break;

              const remainingSeconds = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
              const mins = Math.floor(remainingSeconds / 60);
              const secs = remainingSeconds % 60;

              setDispatchProgress({
                current: alreadySentPhones.length,
                total: targetContacts.length,
                status: `⏸️ Lote de ${effectiveBatchSize} enviado! Pausa anti-ban: ${mins}m ${secs < 10 ? '0' : ''}${secs}s restantes...`
              });

              await new Promise(r => setTimeout(r, 500));
            }

            if (isAbortingRef.current) {
              alert(`🛑 Disparo interrompido durante a pausa do lote.`);
              break;
            }
          }
        }
      } else {
        // Disparo para Grupo VIP
        const formattedMsg = camp.message
          .replace(/\[Nome\]/gi, 'Pessoal')
          .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, cardapioUrl)
          .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, grupoVipUrl || '');

        await fetch(`${getBackendUrl()}/api/marketing/send-direct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: camp.targetGroupId,
            name: camp.targetGroupName || 'Grupo VIP',
            text: formattedMsg,
            companyId: company?.id,
            imageUrl: camp.imageUrl,
            isStockOffer: camp.isStockOffer,
            stockOfferCount: camp.stockOfferCount || 1,
          })
        });

        setDispatchProgress({ current: 1, total: 1, status: 'Mensagem enviada com sucesso no grupo!' });
      }

      // Atualiza data do último envio
      const updated = campaigns.map(c => 
        c.id === camp.id ? { ...c, lastRunDate: new Date().toLocaleDateString('pt-BR') } : c
      );
      setCampaigns(updated);
      if (company?.id) {
        supabase
          .from('smoking_marketing_campaigns')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', camp.id)
          .eq('company_id', company.id)
          .select('updated_at')
          .single()
          .then(({ data }) => {
            if (data?.updated_at) {
              setCampaigns(prev => prev.map(c => 
                c.id === camp.id ? { ...c, updatedAt: data.updated_at } : c
              ));
            }
          });
      }
      if (!isAbortingRef.current) {
        if (camp.targetType === 'lists') {
          if (sentInThisSession > 0) {
            alert(`✅ Disparo finalizado com sucesso!\n\n${sentInThisSession} mensagem(ns) entregue(s) no WhatsApp.` + 
              (failedContacts.length > 0 ? `\n\n⚠️ ${failedContacts.length} contato(s) não puderam ser entregues.` : '') +
              (skippedCount > 0 ? `\n\n⏩ ${skippedCount} contato(s) já haviam recebido anteriormente.` : ''));
          } else if (skippedCount > 0) {
            alert(`⏩ Todos os contatos da lista já haviam recebido esta campanha.`);
          } else {
            alert('Disparo finalizado com sucesso!');
          }
        } else {
          alert('Mensagem enviada com sucesso no grupo!');
        }
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
    <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden md:overflow-hidden bg-background custom-scrollbar">
      {/* Header Principal do Marketing */}
      <header className="px-4 py-4 sm:px-6 sm:py-5 border-b border-white/10 shrink-0 bg-[#0a0a0a]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Megaphone className="size-5 text-emerald-400 shrink-0" />
                <span>Módulo de Marketing & Disparos</span>
              </h2>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium">
                Anti-Ban Ativo
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Campanhas automatizadas, Listas de Transmissão e disparos no Grupo VIP com cadência segura.
            </p>
          </div>

          {/* Botões de Ação do Header */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Botão de Conexão do WhatsApp */}
            <button
              type="button"
              data-tour="btn-conectar-whatsapp"
              onClick={handleStartConnectWhatsApp}
              disabled={qrLoading}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95 shrink-0 ${
                whatsAppConnected
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : whatsAppSessionStatus === 'CONNECTING'
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-300 animate-pulse'
                  : whatsAppSessionStatus === 'SESSION_INVALID'
                  ? 'bg-red-500/15 hover:bg-red-500/25 border-red-500/30 text-red-300'
                  : !backendOnline
                  ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/25 text-red-400'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold border-transparent shadow-sm'
              }`}
              title={
                whatsAppConnected
                  ? "🟢 WhatsApp Conectado e Pronto para Disparos"
                  : whatsAppSessionStatus === 'CONNECTING'
                  ? "Conectando ao WhatsApp..."
                  : whatsAppSessionStatus === 'SESSION_INVALID'
                  ? "🔴 Sessão Inválida — Conectar Novamente"
                  : !backendOnline
                  ? "Backend Offline. Inicie o servidor backend."
                  : hasSavedSession
                  ? "⚪ WhatsApp Desconectado (Clique para Conectar)"
                  : "Clique para Conectar WhatsApp via QR Code"
              }
            >
              {whatsAppConnected ? (
                <>
                  <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                  <Smartphone className="size-4 text-emerald-400" />
                  <span>WhatsApp Conectado</span>
                </>
              ) : whatsAppSessionStatus === 'CONNECTING' ? (
                <>
                  <RefreshCw className="size-4 text-amber-300 animate-spin" />
                  <span>Conectando WhatsApp...</span>
                </>
              ) : whatsAppSessionStatus === 'SESSION_INVALID' ? (
                <>
                  <AlertTriangle className="size-4 text-red-400" />
                  <span>Conectar Novamente</span>
                </>
              ) : !backendOnline ? (
                <>
                  <AlertTriangle className="size-4 text-red-400" />
                  <span>Backend Offline</span>
                </>
              ) : (
                <>
                  <QrCode className="size-4 text-black" />
                  <span>{hasSavedSession ? 'Conectar WhatsApp' : 'Conectar WhatsApp'}</span>
                </>
              )}
            </button>

            <button
              onClick={syncWhatsAppContactsAndGroups}
              disabled={loadingSync}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 shrink-0"
              title="Sincroniza contatos da agenda do WhatsApp e grupos"
            >
              <RefreshCw className={`size-3.5 text-white/70 ${loadingSync ? 'animate-spin' : ''}`} />
              <span>{loadingSync ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>

            <button
              data-tour="btn-nova-campanha"
              onClick={() => handleOpenCampaignModal()}
              className="px-4 py-2 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-all shadow-sm active:scale-95 shrink-0"
            >
              <Plus className="size-4 stroke-[3]" />
              <span>Nova Campanha</span>
            </button>
          </div>
        </div>

        {/* Alerta minimalista quando desconectado */}
        {!whatsAppConnected && (
          <div className="mt-3.5 bg-white/[0.03] border border-white/10 px-4 py-2 rounded-xl flex items-center justify-between gap-3 text-xs text-white/70">
            <div className="flex items-center gap-2.5">
              <span className={`size-2 rounded-full shrink-0 ${whatsAppSessionStatus === 'SESSION_INVALID' ? 'bg-red-400' : 'bg-white/30'}`} />
              <span className="text-[11px] sm:text-xs">
                {whatsAppSessionStatus === 'SESSION_INVALID'
                  ? 'A sessão foi desconectada pelo celular ou expirou. Clique em Conectar Novamente para reativar.'
                  : hasSavedSession
                  ? 'WhatsApp em espera. Clique em Conectar para ativar os envios da loja.'
                  : 'Conecte o WhatsApp da loja para habilitar os disparos automáticos e sincronização.'}
              </span>
            </div>
            <button
              onClick={handleStartConnectWhatsApp}
              className="px-3 py-1 bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <QrCode className="size-3.5" />
              <span>{hasSavedSession ? 'Ativar Conexão' : 'Conectar'}</span>
            </button>
          </div>
        )}

        {syncStatus && (
          <div className="mt-3 text-xs text-white/80 bg-white/[0.03] border border-white/10 px-3 py-1.5 rounded-lg font-mono">
            {syncStatus}
          </div>
        )}

        {/* Barra de Sub-Navegação (Tabs Discretas com Indicador Verde) */}
        <div className="flex items-center gap-6 mt-4 border-b border-white/5">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`pb-2.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'campaigns'
                ? 'text-white border-emerald-400 font-bold'
                : 'text-white/40 hover:text-white/80 border-transparent'
            }`}
          >
            <Layers className="size-4" />
            <span>Campanhas ({campaigns.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast_lists')}
            className={`pb-2.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'broadcast_lists'
                ? 'text-white border-emerald-400 font-bold'
                : 'text-white/40 hover:text-white/80 border-transparent'
            }`}
          >
            <Users className="size-4" />
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
                <p className="text-sm font-semibold text-white">Nenhuma campanha criada ainda.</p>
                <p className="text-xs max-w-md mx-auto">
                  Crie sua primeira campanha para disparar ofertas para suas Listas de Transmissão ou Grupo VIP.
                </p>
                <button
                  onClick={() => handleOpenCampaignModal()}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold inline-flex items-center gap-2"
                >
                  <Plus className="size-4" /> Criar Primeira Campanha
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* SEÇÃO 1: CAMPANHAS DE GRUPO VIP */}
                {(() => {
                  const groupCamps = campaigns.filter(c => c.targetType === 'group');
                  if (groupCamps.length === 0) return null;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <MessageSquare className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold text-white tracking-wider uppercase flex items-center gap-2">
                            Campanhas de Grupo (WhatsApp VIP)
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 font-mono">
                              {groupCamps.length}
                            </span>
                          </h3>
                          <p className="text-[11px] text-white/40">Disparos em canal e grupo oficial da loja</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupCamps.map(camp => (
                          <div 
                            key={camp.id}
                            className="bg-[#0a0a0a] border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all group"
                          >
                            <div className="space-y-3">
                              {/* 1. Primeira Linha: Nome da campanha + Status discreto */}
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                                  {camp.name}
                                </h3>
                                <span className={`text-[11px] font-medium shrink-0 flex items-center gap-1.5 ${
                                  camp.status === 'active' ? 'text-emerald-400' : 'text-white/40'
                                }`}>
                                  <span className={`size-1.5 rounded-full ${camp.status === 'active' ? 'bg-emerald-400' : 'bg-white/30'}`} />
                                  {camp.status === 'active' ? 'Ativa' : 'Pausada'}
                                </span>
                              </div>

                              {/* 2. Informações Básicas (Destino e Frequência) */}
                              <div className="text-xs space-y-1 text-white/60">
                                <div>
                                  <span className="text-white/40">Destino: </span>
                                  <span className="text-white/80 font-medium">
                                    {camp.targetGroupName || 'Clientes Smoking Vip'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-white/40">Frequência: </span>
                                  <span className="text-white/80">
                                    {camp.frequencyDays === 1
                                      ? `Diário (Todo Dia)${camp.scheduledTime ? ` às ${camp.scheduledTime}` : ''}`
                                      : camp.frequencyDays === 0 
                                        ? 'Disparo Único' 
                                        : camp.scheduledWeekday 
                                          ? `Toda ${camp.scheduledWeekday.charAt(0) + camp.scheduledWeekday.slice(1).toLowerCase()}${camp.scheduledTime ? ` às ${camp.scheduledTime}` : ''}` 
                                          : `A cada ${camp.frequencyDays} dias${camp.scheduledTime ? ` às ${camp.scheduledTime}` : ''}`}
                                  </span>
                                </div>
                                {(camp.isStockOffer || camp.imageUrl) && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    {camp.isStockOffer && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                        🔥 Vitrine Estoque ({camp.stockOfferCount || 1} {camp.stockOfferCount === 2 ? 'pods' : 'pod'}/dia)
                                      </span>
                                    )}
                                    {camp.imageUrl && !camp.isStockOffer && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                        📸 Com Imagem
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 3. Mensagem da Campanha (Tipografia padrão do sistema, sem mono) */}
                              <div className="bg-[#050505] p-3 rounded-xl border border-white/5">
                                <p className="text-xs text-white/70 line-clamp-3 leading-relaxed whitespace-pre-line">
                                  {camp.message}
                                </p>
                              </div>
                            </div>

                            {/* 4. Rodapé de Ações */}
                            <div className="flex items-center justify-between pt-3 border-t border-white/5 gap-2">
                              {/* Lado Esquerdo: Ativar/Desativar + Editar + Excluir */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleCampaignStatus(camp.id)}
                                  title={camp.status === 'active' ? 'Pausar Campanha' : 'Ativar Campanha'}
                                  className="text-white/40 hover:text-white transition-colors cursor-pointer"
                                >
                                  {camp.status === 'active' ? (
                                    <ToggleRight className="size-6 text-emerald-400" />
                                  ) : (
                                    <ToggleLeft className="size-6 text-white/30" />
                                  )}
                                </button>

                                <button
                                  onClick={() => handleOpenCampaignModal(camp)}
                                  title="Editar Campanha"
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
                                >
                                  <Edit3 className="size-3.5" />
                                </button>

                                <button
                                  onClick={() => handleDeleteCampaign(camp.id)}
                                  title="Excluir Campanha"
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all cursor-pointer"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>

                              {/* Lado Direito: Disparar no Grupo */}
                              <button
                                onClick={() => handleExecuteCampaign(camp)}
                                disabled={executingCampaignId === camp.id}
                                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                              >
                                <Send className="size-3" />
                                <span>Disparar no Grupo</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* SEÇÃO 2: CAMPANHAS NO PRIVADO (1 A 1 / LISTAS DE TRANSMISSÃO) */}
                {(() => {
                  const listCamps = campaigns.filter(c => c.targetType === 'lists');
                  if (listCamps.length === 0) return null;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <Users className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold text-white tracking-wider uppercase flex items-center gap-2">
                            Campanhas no Privado (1 a 1 / Listas)
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 font-mono">
                              {listCamps.length}
                            </span>
                          </h3>
                          <p className="text-[11px] text-white/40">Disparos diretos para o WhatsApp com cadência anti-ban</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {listCamps.map(camp => {
                          const targetListNames = broadcastLists
                            .filter(l => camp.selectedListIds?.includes(l.id))
                            .map(l => l.name);

                          return (
                            <div 
                              key={camp.id}
                              className="bg-[#0a0a0a] border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all group"
                            >
                              <div className="space-y-3">
                                {/* 1. Primeira Linha: Nome da campanha + Status discreto */}
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                                    {camp.name}
                                  </h3>
                                  <span className={`text-[11px] font-medium shrink-0 flex items-center gap-1.5 ${
                                    camp.status === 'active' ? 'text-emerald-400' : 'text-white/40'
                                  }`}>
                                    <span className={`size-1.5 rounded-full ${camp.status === 'active' ? 'bg-emerald-400' : 'bg-white/30'}`} />
                                    {camp.status === 'active' ? 'Ativa' : 'Pausada'}
                                  </span>
                                </div>

                                {/* 2. Informações Básicas (Destino e Frequência) */}
                                <div className="text-xs space-y-1 text-white/60">
                                  <div>
                                    <span className="text-white/40">Destino: </span>
                                    <span className="text-white/80 font-medium">
                                      {targetListNames.length > 0 ? targetListNames.join(', ') : `${targetListNames.length} listas`}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-white/40">Frequência: </span>
                                    <span className="text-white/80">
                                      {camp.frequencyDays === 1
                                        ? `Diário (Todo Dia)${camp.scheduledTime ? ` às ${camp.scheduledTime}` : ''}`
                                        : camp.frequencyDays === 0 
                                          ? 'Disparo Único' 
                                          : camp.frequencyDays === 7 && camp.scheduledWeekday
                                            ? `Toda ${camp.scheduledWeekday.charAt(0) + camp.scheduledWeekday.slice(1).toLowerCase()}${camp.scheduledTime ? ` às ${camp.scheduledTime}` : ''}` 
                                            : `A cada ${camp.frequencyDays} dias${camp.scheduledTime ? ` às ${camp.scheduledTime}` : ''}`}
                                    </span>
                                  </div>
                                  {(camp.isStockOffer || camp.imageUrl) && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                      {camp.isStockOffer && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                          🔥 Vitrine Estoque ({camp.stockOfferCount || 1} {camp.stockOfferCount === 2 ? 'pods' : 'pod'}/dia)
                                        </span>
                                      )}
                                      {camp.imageUrl && !camp.isStockOffer && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                          📸 Com Imagem
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* 3. Mensagem da Campanha (Tipografia padrão do sistema, sem mono) */}
                                <div className="bg-[#050505] p-3 rounded-xl border border-white/5">
                                  <p className="text-xs text-white/70 line-clamp-3 leading-relaxed whitespace-pre-line">
                                    {camp.message}
                                  </p>
                                </div>
                              </div>

                              {/* 4. Rodapé de Ações */}
                              <div className="flex items-center justify-between pt-3 border-t border-white/5 gap-2">
                                {/* Lado Esquerdo: Ativar/Desativar + Editar + Excluir */}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleCampaignStatus(camp.id)}
                                    title={camp.status === 'active' ? 'Pausar Campanha' : 'Ativar Campanha'}
                                    className="text-white/40 hover:text-white transition-colors cursor-pointer"
                                  >
                                    {camp.status === 'active' ? (
                                      <ToggleRight className="size-6 text-emerald-400" />
                                    ) : (
                                      <ToggleLeft className="size-6 text-white/30" />
                                    )}
                                  </button>

                                  <button
                                    onClick={() => handleOpenCampaignModal(camp)}
                                    title="Editar Campanha"
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
                                  >
                                    <Edit3 className="size-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleDeleteCampaign(camp.id)}
                                    title="Excluir Campanha"
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>

                                {/* Lado Direito: Ação de Disparo Principal */}
                                {executingCampaignId === camp.id ? (
                                  <button
                                    onClick={handleStopCampaign}
                                    className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all animate-pulse"
                                  >
                                    <span>🛑 Parar Disparos</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleExecuteCampaign(camp)}
                                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                                  >
                                    <Send className="size-3" />
                                    <span>{camp.frequencyDays > 0 ? 'Disparar Lote' : 'Disparar Tudo'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* ABA 2: LISTAS DE TRANSMISSÃO */}
        {/* ============================================================ */}
        {activeTab === 'broadcast_lists' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="size-4 text-emerald-400" />
                  Listas de Transmissão Salvas
                </h3>
                <p className="text-xs text-white/50">
                  Crie grupos de contatos segmentados para usar em diferentes disparos e campanhas.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleCleanAndDeduplicateLists}
                  disabled={loadingSanitize}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  title="Higieniza e remove duplicatas entre listas"
                >
                  <Zap className={`size-3.5 text-emerald-400 ${loadingSanitize ? 'animate-spin' : ''}`} />
                  <span>{loadingSanitize ? 'Higienizando...' : 'Higienizar & Desduplicar'}</span>
                </button>

                <button
                  onClick={() => handleOpenListModal()}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Plus className="size-4" /> Nova Lista
                </button>
              </div>
            </div>

            {/* Grid de Listas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {broadcastLists.map(list => (
                <div
                  key={list.id}
                  className="bg-[#0a0a0a] border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 font-bold">
                          <Users className="size-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                            {list.name}
                          </h4>
                          <span className="text-[10px] text-white/50 font-mono">
                            {list.contacts.length} {list.contacts.length === 1 ? 'contato' : 'contatos'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-white/50 leading-relaxed">
                      {list.description || 'Lista sem descrição'}
                    </p>

                    {/* Amostra dos Primeiros Contatos */}
                    <div className="p-3 bg-[#050505] rounded-xl border border-white/5 space-y-1">
                      <span className="text-[10px] text-white/40 uppercase font-semibold block mb-1">Membros na Lista:</span>
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
                        <span className="text-[10px] text-emerald-400 block pt-1">
                          + {list.contacts.length - 3} outros contatos...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <button
                      onClick={() => handleOpenListModal(list)}
                      className="text-xs text-white/70 hover:text-emerald-400 font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Edit3 className="size-3.5" />
                      <span>Gerenciar Contatos</span>
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
                  placeholder="Ex: Clientes VIP SBC (~150)"
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
      {/* MODAL: CRIAR / EDITAR CAMPANHA (SIMPLIFICADO E INTUITIVO) */}
      {/* ============================================================ */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header do Modal */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Megaphone className="size-5 text-emerald-400" />
                  {editingCampaign ? 'Configurar Campanha' : 'Nova Campanha de Disparo'}
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Configure o destino, a mensagem e o agendamento do disparo.
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
                  placeholder="Ex: Oferta Sextou VIP + Entrega Rápida"
                  value={campaignFormName}
                  onChange={(e) => setCampaignFormName(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Escolha do Destino */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-white/70 block">Onde deseja disparar?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCampaignFormTargetType('lists')}
                    className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      campaignFormTargetType === 'lists'
                        ? 'bg-purple-500/15 border-purple-500/40 text-white shadow-sm'
                        : 'bg-[#050505] border-white/10 text-white/50 hover:bg-white/5'
                    }`}
                  >
                    <Users className="size-5 text-purple-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block text-white">Listas de Transmissão</span>
                      <span className="text-[10px] text-white/40">Disparo no privado para cada contato</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCampaignFormTargetType('group')}
                    className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      campaignFormTargetType === 'group'
                        ? 'bg-amber-500/15 border-amber-500/40 text-white shadow-sm'
                        : 'bg-[#050505] border-white/10 text-white/50 hover:bg-white/5'
                    }`}
                  >
                    <MessageSquare className="size-5 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block text-white">Grupo de WhatsApp</span>
                      <span className="text-[10px] text-white/40">Dispara direto no canal/grupo VIP</span>
                    </div>
                  </button>
                </div>

                {/* Seleção de Múltiplas Listas */}
                {campaignFormTargetType === 'lists' && (
                  <div className="p-3.5 bg-[#050505] border border-white/10 rounded-xl space-y-2.5">
                    <span className="text-xs font-bold text-white block">
                      Selecione o público desta campanha:
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
                            className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
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
                  <div className="p-3.5 bg-[#050505] border border-white/10 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-white block">Grupo do WhatsApp:</span>

                    {whatsAppGroups.length > 0 ? (
                      <select
                        value={campaignFormTargetGroup}
                        onChange={(e) => setCampaignFormTargetGroup(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="">-- Selecione o grupo sincronizado --</option>
                        {whatsAppGroups.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name} {g.participantsCount > 0 ? `(${g.participantsCount} membros)` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={campaignFormTargetGroup}
                        onChange={(e) => setCampaignFormTargetGroup(e.target.value)}
                        placeholder="Ex: Grupo VIP Oficial"
                        className="w-full bg-black border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-400"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Frequência do Disparo e Horário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Frequência</label>
                  <select
                    value={campaignFormFrequency}
                    onChange={(e) => setCampaignFormFrequency(Number(e.target.value))}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    <option value={0}>Disparo Único (Manual)</option>
                    <option value={1}>Diário (Todo Dia)</option>
                    <option value={7}>Semanal (Toda Semana)</option>
                    <option value={14}>Quinzenal (A cada 14 dias)</option>
                    <option value={30}>Mensal (A cada 30 dias)</option>
                  </select>
                </div>

                {campaignFormFrequency === 7 && (
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
                )}

                {campaignFormFrequency > 0 && (
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1">⏰ Horário do Disparo</label>
                    <input
                      type="time"
                      value={campaignFormTime}
                      onChange={(e) => setCampaignFormTime(e.target.value)}
                      className="w-full bg-[#050505] border border-emerald-500/30 rounded-xl p-2.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                )}

                {/* Selo Anti-Ban Automático */}
                {campaignFormTargetType === 'lists' && (
                  <div className="col-span-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-emerald-300 block">Cadência Anti-Ban Automática</span>
                      <span className="text-white/60 text-[11px]">
                        Disparos em lotes seguros de 5 contatos com intervalo inteligente para máxima proteção do seu WhatsApp.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Opções de Vitrine de Estoque Dinâmico & Mídia */}
              <div className="p-4 bg-[#050505] border border-white/10 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Flame className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Vitrine Automática de Estoque (Foto + Sabores)
                      </span>
                      <span className="text-[11px] text-white/50">
                        Puxa pods reais do estoque com fotos e sabores disponíveis, aplicando rotação anti-repetição.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !campaignFormIsStockOffer;
                      setCampaignFormIsStockOffer(next);
                      if (next && (!campaignFormMessage || campaignFormMessage === OFFICIAL_TEMPLATES[1].text)) {
                        setCampaignFormMessage(OFFICIAL_TEMPLATES[0].text);
                      }
                    }}
                    className="cursor-pointer text-white/60 hover:text-white transition-colors"
                  >
                    {campaignFormIsStockOffer ? (
                      <ToggleRight className="size-7 text-amber-400" />
                    ) : (
                      <ToggleLeft className="size-7 text-white/30" />
                    )}
                  </button>
                </div>

                {campaignFormIsStockOffer && (
                  <div className="pt-3 border-t border-white/5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-white/80 block">Pods ofertados por disparo:</span>
                        <span className="text-[10px] text-white/40">Quantos pods diferentes serão divulgados em cada execução</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {[1, 2].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setCampaignFormStockOfferCount(num)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              campaignFormStockOfferCount === num
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                            }`}
                          >
                            {num} {num === 1 ? 'Pod' : 'Pods'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[11px] text-amber-300/80">
                      ℹ️ O robô consulta a tabela de produtos ativos com estoque &gt; 0, anexa a foto oficial do pod e preenche automaticamente o modelo, preço e sabores do dia.
                    </div>
                  </div>
                )}

                {/* Imagem Manual / Fallback */}
                {!campaignFormIsStockOffer && (
                  <div className="pt-3 border-t border-white/5">
                    <label className="text-xs font-bold text-white/70 block mb-1">
                      📸 URL da Imagem (Opcional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://exemplo.com/banner-promocional.jpg"
                      value={campaignFormImageUrl}
                      onChange={(e) => setCampaignFormImageUrl(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                    />
                    <span className="text-[10px] text-white/40 mt-1 block">
                      Ao preencher, a mensagem será disparada com esta imagem anexada.
                    </span>
                  </div>
                )}
              </div>

              {/* Mensagem & Modelos */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-white">Mensagem</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCampaignFormMessage(prev => prev + ' [Nome]')}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/70 font-mono cursor-pointer"
                    >
                      + [Nome]
                    </button>
                    <button
                      type="button"
                      onClick={() => setCampaignFormMessage(prev => prev + ' [LINK_DO_CARDAPIO_VERCEL]')}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/70 font-mono cursor-pointer"
                    >
                      + [Cardápio]
                    </button>
                    <button
                      type="button"
                      onClick={() => setCampaignFormMessage(prev => prev + ' [LINK_DO_GRUPO_VIP_WHATSAPP]')}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/70 font-mono cursor-pointer"
                    >
                      + [Grupo VIP]
                    </button>
                  </div>
                </div>

                {/* Modelos Prontos */}
                <div className="flex flex-wrap gap-1.5">
                  {OFFICIAL_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setCampaignFormMessage(t.text)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/70 hover:text-white transition-all cursor-pointer"
                    >
                      {t.title}
                    </button>
                  ))}
                </div>

                {/* Caixa de Texto da Mensagem */}
                <textarea
                  rows={6}
                  value={campaignFormMessage}
                  onChange={(e) => setCampaignFormMessage(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-emerald-500/50"
                  placeholder="Escreva a mensagem aqui..."
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
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold shadow-sm active:scale-95"
              >
                Salvar Campanha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 📱 MODAL: QR CODE CONEXÃO WHATSAPP OFICIAL                    */}
      {/* ============================================================ */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Conexão Oficial do WhatsApp</h3>
                  <p className="text-[11px] text-white/40">Disparos de marketing e sincronização da loja</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelConnect}
                className="size-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {whatsAppConnected ? (
              <div className="space-y-4 text-center py-3">
                <div className="size-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/15">
                  <CheckCircle2 className="size-9" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white">WhatsApp Conectado e Pronto!</h4>
                  <p className="text-xs text-white/50 mt-1 max-w-xs mx-auto">
                    A sessão está ativa e pronta para disparos automáticos e sincronização da loja.
                  </p>
                </div>

                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 text-xs text-white/70 space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Contatos na base:</span>
                    <strong className="text-white font-mono">{allContacts.length}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Grupos detectados:</span>
                    <strong className="text-white font-mono">{whatsAppGroups.length}</strong>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-white/5">
                    <span className="text-white/50">Status do Motor:</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="size-2 rounded-full bg-emerald-400 animate-ping" /> Online e Operando
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      syncWhatsAppContactsAndGroups();
                      setIsQrModalOpen(false);
                    }}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    Sincronizar Dados Agora
                  </button>
                  <button
                    type="button"
                    onClick={handleLogoutWhatsApp}
                    disabled={qrLoading}
                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <LogOut className="size-3.5" />
                    <span>Desconectar Sessão</span>
                  </button>
                </div>
              </div>
            ) : !backendOnline ? (
              <div className="space-y-4 text-center py-3">
                <div className="size-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400 shadow-lg shadow-red-500/10">
                  <AlertTriangle className="size-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Servidor Backend Não Detectado</h4>
                  <p className="text-xs text-white/50 mt-1 max-w-xs mx-auto leading-relaxed">
                    O motor do WhatsApp roda no servidor Node.js. Para gerar o QR Code ou conectar o celular da loja, certifique-se de iniciar o backend.
                  </p>
                </div>

                <div className="p-3.5 bg-black/60 border border-white/10 rounded-2xl text-left font-mono text-[11px] text-white/70 space-y-1.5">
                  <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Como iniciar o backend:</span>
                  <div className="text-emerald-400 font-bold bg-white/5 p-2 rounded-xl border border-white/5 select-all">
                    cd backend &amp;&amp; npm start
                  </div>
                </div>

                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshQr}
                    disabled={qrLoading}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <RefreshCw className={`size-3.5 ${qrLoading ? 'animate-spin' : ''}`} />
                    <span>Testar Conexão Novamente</span>
                  </button>
                </div>
              </div>
            ) : qrCodeImageUrl ? (
              <div className="space-y-4 text-center py-2">
                <p className="text-xs text-white/70 max-w-xs mx-auto">
                  Abra o WhatsApp no celular da loja, vá em <strong>Aparelhos Conectados ➔ Conectar Aparelho</strong> e aponte a câmera para o QR Code abaixo:
                </p>
                <div className="bg-white p-4 rounded-2xl inline-block mx-auto shadow-2xl shadow-emerald-500/10 border-2 border-white">
                  <img src={qrCodeImageUrl} alt="QR Code WhatsApp" className="size-60 object-contain mx-auto" />
                </div>
                <div className="text-[11px] text-emerald-400/90 flex items-center justify-center gap-2 font-mono">
                  <RefreshCw className="size-3 animate-spin" />
                  <span>Aguardando leitura no celular...</span>
                </div>
                <div className="pt-2 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshQr}
                    disabled={qrLoading}
                    className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <RefreshCw className={`size-3 ${qrLoading ? 'animate-spin' : ''}`} />
                    <span>Atualizar QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogoutWhatsApp}
                    disabled={qrLoading}
                    className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <LogOut className="size-3" />
                    <span>Resetar Sessão Presa</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center py-8">
                <RefreshCw className="size-8 text-amber-400 animate-spin mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-white">Iniciando Motor do WhatsApp...</h4>
                  <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto">
                    O servidor está carregando a sessão e gerando o QR Code para leitura.
                  </p>
                </div>
                <div className="pt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={handleLogoutWhatsApp}
                    disabled={qrLoading}
                    className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <LogOut className="size-3" />
                    <span>Forçar Novo QR Code (Resetar Sessão Presa)</span>
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-white/10 pt-3 flex justify-end">
              <button
                type="button"
                onClick={handleCancelConnect}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                {whatsAppConnected ? 'Fechar' : 'Cancelar / Fechar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
