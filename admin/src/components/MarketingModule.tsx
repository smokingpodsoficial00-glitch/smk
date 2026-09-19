import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Send, Users, ShieldAlert, Sparkles, Clock, CheckCircle2, 
  AlertTriangle, RefreshCw, MessageSquare, Play, Pause, ExternalLink,
  Flame, Lock, Copy, Check, Plus, Trash2, Edit3, ArrowRight, CheckSquare,
  Square, Calendar, Layers, ShieldCheck, HelpCircle, ChevronRight,
  ToggleLeft, ToggleRight, Zap, QrCode, Smartphone, LogOut, FlaskConical
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
  {
    id: 'insta_grupo_vip',
    title: 'Instagram & Bastidores (Grupo VIP)',
    badge: 'Comunidade & Prova Social',
    text: `📸 *BASTIDORES & COMUNICADOS OFICIAIS — SMOKING PODS* 🚀\n\nSalve turma do VIP! Passando um recado rápido pra quem ainda não acompanha nosso perfil oficial no Instagram:\n\nÉ por lá que a gente posta em tempo real:\n• 🛵 Saída dos motoboys e rotina de entregas no ABC;\n• 🎬 Vídeos e unboxing dos novos pods que chegam;\n• 📢 Avisos de horários de funcionamento e novidades da loja.\n\n📲 *Clica no link e segue a gente lá pra acompanhar tudo:*\n🔗 [LINK_DO_INSTAGRAM]\n\n*Tamo junto!*`,
  },
  {
    id: 'salvar_contato_vip',
    title: 'Salvar Contato na Agenda (Status VIP)',
    badge: 'Alcance Orgânico & Status',
    text: `📲 *AVISO VIP: SALVE NOSSO CONTATO NA SUA AGENDA!* ⚡\n\nFala pessoal do VIP! Passando um recado importante pra vocês:\n\nQuem tem o nosso número salvo nos contatos do celular consegue acompanhar nossos *Status diários no WhatsApp*!\n\nÉ por lá que a gente posta:\n• 💨 Ofertas relâmpago de última hora com desconto;\n• 📦 Chegada de modelos raros antes de irem pro cardápio;\n• 🛵 Avisos rápidos de saídas do motoboy no dia a dia.\n\n👉 *Salva aí no seu celular:* Smoking Pods Oficial\n\n*Assim você não perde nenhuma oportunidade da semana!* 🥇`,
  },
  {
    id: 'lembrete_pre_fds_vip',
    title: 'Lembrete Pré-FDS / Reserva Semanal (Quarta 18:30)',
    badge: 'Antecipação & Sem Fila',
    text: `⏳ *LEMBRETE VIP: ANTECIPE SEU PEDIDO PRO FDS!* 💨\n\nSalve galera do VIP! Passando pra avisar quem gosta de se planejar com calma:\n\nSexta e sábado a fila de despacho do Uber Direct costuma ser bem cheia. Se você já quiser garantir seu pod agora no meio da semana, seu pedido sai na hora e sem correria!\n\n📦 *Cardápio 100% atualizado com os novos lotes:*\n🔗 [LINK_DO_CARDAPIO_VERCEL]\n\n⚡ *Entregas em 25 a 35 min em SBC e região!*\n\n*Garanta seu sabor favorito antes da correria do fds!* 🥇`,
  },
  {
    id: 'mgm_indique_ganhe',
    title: 'Programa Indique & Ganhe (1 Pod Grátis)',
    badge: 'Multiplicação de Base',
    text: `🎁 *GANHE 1 POD 100% GRÁTIS — PROGRAMA VIP SMOKING PODS!* 👑\n\nFala [Nome], beleza? Quer garantir seu próximo pod na faixa?\n\nComo funciona nosso programa de indicação:\n1️⃣ Indique *5 amigos* do rolê, da faculdade ou do trampo que comprem na Smoking Pods.\n2️⃣ Ao fazerem o pedido no WhatsApp, eles só precisam avisar: *"Fui indicado pelo [Nome]"*.\n3️⃣ Assim que os 5 pedidos forem confirmados, *você ganha 1 POD 100% GRÁTIS* (você só paga o frete do motoboy)!\n\n📲 *Manda o link do nosso Cardápio pra galera:*\n🔗 [LINK_DO_CARDAPIO_VERCEL]\n\n*Já avisa os parceiros e garante o seu pod na faixa!* 🚀`,
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
  const [campaignFormVariations, setCampaignFormVariations] = useState<string[]>([]);
  const [campaignFormUseVariations, setCampaignFormUseVariations] = useState<boolean>(false);
  const [campaignFormTargetType, setCampaignFormTargetType] = useState<'lists' | 'group'>('lists');
  const [campaignFormSelectedLists, setCampaignFormSelectedLists] = useState<Set<string>>(new Set());
  const [campaignFormTargetGroup, setCampaignFormTargetGroup] = useState<string>('');
  const [campaignFormFrequency, setCampaignFormFrequency] = useState<number>(7); // dias
  const [campaignFormWeekday, setCampaignFormWeekday] = useState<string>('QUARTA');
  const [campaignFormTime, setCampaignFormTime] = useState<string>('15:00');
  const [campaignFormStartDate, setCampaignFormStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [campaignFormBatchSize, setCampaignFormBatchSize] = useState<number>(10);
  const [campaignFormInterval, setCampaignFormInterval] = useState<number>(25);
  const [cardapioUrl, setCardapioUrl] = useState('https://smoking-pods.vercel.app');
  const [grupoVipUrl, setGrupoVipUrl] = useState('');

  // Execução de Disparo & Controle de Pausa Real
  const [executingCampaignId, setExecutingCampaignId] = useState<string | null>(null);
  const [dispatchProgress, setDispatchProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const isAbortingRef = React.useRef(false);

  // Estado da Conexão do WhatsApp Oficial
  const [whatsAppConnected, setWhatsAppConnected] = useState<boolean>(false);
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [qrLoading, setQrLoading] = useState<boolean>(false);

  const checkWhatsAppStatus = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/qr`);
      if (res.ok) {
        setBackendOnline(true);
        const data = await res.json();
        if (data.isReady) {
          setWhatsAppConnected(true);
          setQrCodeImageUrl(null);
        } else if (data.qrImageUrl) {
          setWhatsAppConnected(false);
          setQrCodeImageUrl(data.qrImageUrl);
        } else {
          setWhatsAppConnected(false);
        }
      } else {
        setBackendOnline(false);
      }
    } catch (e) {
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    checkWhatsAppStatus();
    const interval = setInterval(checkWhatsAppStatus, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshQr = async () => {
    setQrLoading(true);
    await checkWhatsAppStatus();
    setQrLoading(false);
  };

  // 🧪 Laboratório de Teste & Armadilha de Diagnóstico em Tempo Real
  const [isTestLabOpen, setIsTestLabOpen] = useState<boolean>(false);
  const [labPhone, setLabPhone] = useState<string>(() => {
    return localStorage.getItem('SP_LAB_TEST_PHONE') || '11948420071';
  });
  const [labName, setLabName] = useState<string>('Leo');
  const [labMessage, setLabMessage] = useState<string>('Fala parceiro! 💨 Teste de entrega oficial da Smoking Pods via WhatsApp.');
  const [labExecuting, setLabExecuting] = useState<boolean>(false);
  const [labResult, setLabResult] = useState<any>(null);
  const [labError, setLabError] = useState<string | null>(null);

  const handleRunLabTest = async () => {
    setLabExecuting(true);
    setLabResult(null);
    setLabError(null);
    localStorage.setItem('SP_LAB_TEST_PHONE', labPhone);

    try {
      const res = await fetch(`${getBackendUrl()}/api/marketing/test-lab-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: labPhone,
          name: labName,
          text: labMessage,
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLabError(data.message || data.error || 'Falha ao entregar a mensagem.');
      }
      setLabResult(data);
    } catch (err: any) {
      setLabError(err.message || 'Erro de conexão com o servidor local.');
    } finally {
      setLabExecuting(false);
    }
  };

  const handleOpenTestLabForCampaign = (camp: Campaign) => {
    setLabMessage(camp.message);
    setLabName('Leo');
    setLabResult(null);
    setLabError(null);
    setIsTestLabOpen(true);
  };

  const handleLogoutWhatsApp = async () => {
    if (!confirm('Deseja realmente desconectar a sessão do WhatsApp e gerar um novo QR Code?')) return;
    setQrLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/logout`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setWhatsAppConnected(false);
      setQrCodeImageUrl(null);
      alert(data.message || 'Sessão anterior desconectada. Gerando novo QR Code...');
      setTimeout(() => {
        checkWhatsAppStatus();
      }, 2000);
    } catch (e) {
      alert('Não foi possível comunicar com o servidor backend.');
    } finally {
      setQrLoading(false);
    }
  };

  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingSanitize, setLoadingSanitize] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<{
    totalContactsRaw: number;
    totalUnique: number;
    duplicateCount: number;
    alreadySentCount: number;
    virginCount: number;
    listsCount: number;
    globalSentTotal: number;
  } | null>(null);

  const fetchDiagnostic = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/marketing/lists-diagnostic`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDiagnosticData(data);
        }
      }
    } catch (e) {}
  };

  const handleStopCampaign = () => {
    isAbortingRef.current = true;
    setDispatchProgress(prev => prev ? { ...prev, status: 'Interrompendo disparos... aguarde o contato atual.' } : null);
  };

  const handleScanWhatsAppHistory = async () => {
    if (!confirm('Iniciar Varredura e Blindagem no WhatsApp?\n\nO sistema vai escanear o histórico de conversas para identificar todos os contatos que já receberam mensagens e garantir que NUNCA MAIS sejam repetidos.')) return;
    setLoadingScan(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/marketing/scan-chats`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchDiagnostic();
        alert(`✅ Varredura Concluída com Sucesso!\n\nNovos contatos identificados: ${data.identifiedCount}\nTotal de contatos blindados no sistema: ${data.totalTracked}\n\nEsses contatos nunca mais receberão mensagens repetidas.`);
      } else {
        alert(`⚠️ ${data.error || 'Não foi possível concluir a varredura. Certifique-se de que o WhatsApp está conectado.'}`);
      }
    } catch (err: any) {
      alert(`❌ Erro ao conectar com o servidor backend: ${err.message}`);
    } finally {
      setLoadingScan(false);
    }
  };

  const handleCleanAndDeduplicateLists = async () => {
    if (!confirm('⚡ Executar Higienização & Desduplicação Automática em 1 Clique?\n\nO sistema vai:\n1. Analisar todas as listas e remover 100% dos contatos duplicados cruzados.\n2. Criar a "⭐ BASE VIRGEM" com contatos únicos prontos para disparo.\n3. Criar a "🛡️ BASE BLINDADA" para contatos já contactados.\n4. Ajustar as campanhas ativas para apontar apenas para a base limpa.\n\nDeseja continuar?')) return;

    setLoadingSanitize(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/marketing/clean-and-deduplicate-lists`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBroadcastLists(data.lists);
        localStorage.setItem(LOCAL_STORAGE_LISTS, JSON.stringify(data.lists));
        await fetchDiagnostic();
        // Recarrega campanhas atualizadas
        try {
          const campRes = await fetch(`${getBackendUrl()}/api/marketing/campaigns`);
          const campData = await campRes.json();
          if (campData.success && campData.campaigns) {
            setCampaigns(campData.campaigns);
            localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS, JSON.stringify(campData.campaigns));
          }
        } catch (e) {}

        alert(`✨ Higienização e Desduplicação Concluída com Sucesso!\n\n👥 Total de contatos analisados: ${data.totalOriginal}\n⚡ Contatos Únicos Reais: ${data.totalUnique}\n🗑️ Duplicatas Eliminadas: ${data.duplicatesRemoved}\n⭐ Base Virgem (Prontos p/ Disparo): ${data.virginCount} contatos\n🛡️ Base Blindada (Já Abordados): ${data.alreadySentCount} contatos\n\nAgora a sua base está 100% protegida contra mensagens duplicadas!`);
      } else {
        alert(`⚠️ ${data.error || 'Erro ao higienizar listas.'}`);
      }
    } catch (err: any) {
      alert(`❌ Erro ao conectar com o servidor backend: ${err.message}`);
    } finally {
      setLoadingSanitize(false);
    }
  };

  // Carrega Listas e Campanhas canônicas do Supabase (Fonte Única de Verdade)
  useEffect(() => {
    fetchDiagnostic();

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
        console.warn('[MarketingModule] Erro ao carregar dados canônicos do Supabase:', e?.message || e);
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
      // 1. Tenta puxar do WhatsApp real no backend
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

  // Salva Lista no Supabase (com diffing cirúrgico e compensação segura)
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
      alert(`Erro ao salvar lista no Supabase: ${err?.message || err}`);
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!company?.id) return;
    if (confirm('Tem certeza que deseja excluir esta Lista de Transmissão?')) {
      try {
        await deleteMarketingList(company.id, id);
        setBroadcastLists(prev => prev.filter(l => l.id !== id));
      } catch (err: any) {
        alert(`Erro ao excluir lista no Supabase: ${err?.message || err}`);
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
      setCampaignFormBatchSize(campToEdit.batchSize || 10);
      setCampaignFormInterval(campToEdit.batchIntervalMinutes || 25);
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
      setCampaignFormBatchSize(10);
      setCampaignFormInterval(25);
    }
    setIsCampaignModalOpen(true);
  };

  // Salva Campanha no Supabase (com Optimistic Locking mandatório e compensação segura)
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

    // Calcula total de destinatários únicos combinando as listas selecionadas
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
        variations: campaignFormVariations.filter(v => v.trim().length > 0),
        useVariations: campaignFormUseVariations,
        targetType: campaignFormTargetType,
        selectedListIds: Array.from(campaignFormSelectedLists),
        targetGroupId: campaignFormTargetGroup,
        targetGroupName: selectedGroupName,
        frequencyDays: Number(campaignFormFrequency),
        scheduledWeekday: Number(campaignFormFrequency) === 7 ? campaignFormWeekday : undefined,
        scheduledTime: campaignFormTime,
        startDate: campaignFormStartDate,
        batchSize: campaignFormBatchSize,
        batchIntervalMinutes: campaignFormInterval,
        totalRecipients: totalCount,
        updatedAt: new Date().toISOString()
      };

      // 1. Atualização Instantânea no Estado da Tela
      setCampaigns(prev => prev.map(c => c.id === updatedCamp.id ? updatedCamp : c));
      setIsCampaignModalOpen(false);

      // 2. Persistência Imediata no localStorage
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_CAMPAIGNS);
        const stored = raw ? JSON.parse(raw) : [];
        const newStored = stored.some((c: any) => c.id === updatedCamp.id)
          ? stored.map((c: any) => c.id === updatedCamp.id ? updatedCamp : c)
          : [...stored, updatedCamp];
        localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS, JSON.stringify(newStored));

        // 3. Sincronização via API Backend
        fetch(`${getBackendUrl()}/api/marketing/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaigns: newStored })
        }).catch(() => {});
      } catch (e) {}

      // 4. Sincronização Supabase em background
      updateMarketingCampaign(
        company.id,
        editingCampaign.id,
        updatedCamp,
        editingCampaign.updatedAt || editingCampaign.createdAt
      ).catch(e => console.warn('[Marketing] Erro na sincronização Supabase:', e));
    } else {
      const newCamp: Campaign = {
        id: `camp_${Date.now()}`,
        name: campaignFormName.trim(),
        message: campaignFormMessage,
        variations: campaignFormVariations.filter(v => v.trim().length > 0),
        useVariations: campaignFormUseVariations,
        targetType: campaignFormTargetType,
        selectedListIds: Array.from(campaignFormSelectedLists),
        targetGroupId: campaignFormTargetGroup,
        targetGroupName: selectedGroupName,
        frequencyDays: Number(campaignFormFrequency),
        scheduledWeekday: Number(campaignFormFrequency) === 7 ? campaignFormWeekday : undefined,
        scheduledTime: campaignFormTime,
        startDate: campaignFormStartDate,
        batchSize: campaignFormBatchSize,
        batchIntervalMinutes: campaignFormInterval,
        status: 'active',
        totalRecipients: totalCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 1. Atualização Instantânea no Estado da Tela
      setCampaigns(prev => [...prev, newCamp]);
      setIsCampaignModalOpen(false);

      // 2. Persistência Imediata no localStorage
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_CAMPAIGNS);
        const stored = raw ? JSON.parse(raw) : [];
        const newStored = [...stored, newCamp];
        localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS, JSON.stringify(newStored));

        // 3. Sincronização via API Backend
        fetch(`${getBackendUrl()}/api/marketing/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaigns: newStored })
        }).catch(() => {});
      } catch (e) {}

      // 4. Sincronização Supabase em background
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
        alert(`Erro ao excluir campanha no Supabase: ${err?.message || err}`);
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

    // Histórico de contatos já enviados para evitar repetição acidental (Retomada Inteligente)
    const sentHistoryKey = `SP_SENT_CAMPAIGN_${camp.id}`;
    let alreadySentPhones: string[] = [];
    try {
      alreadySentPhones = JSON.parse(localStorage.getItem(sentHistoryKey) || '[]');
    } catch {}

    // Sincroniza e herda a blindagem central do servidor
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

    // Verifica se os contatos já constam como enviados (blindagem)
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
          `⚠️ ATENÇÃO: Todos os ${targetContacts.length} contatos desta lista já constam como enviados no histórico de segurança (blindagem anti-duplicação).\n\n` +
          `Deseja FORÇAR o envio mesmo assim (Modo Teste / Reenvio)?`
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
        ? '🚀 Modo Forçado / Teste ativado: disparando para a lista selecionada...' 
        : (alreadySentPhones.length > 0 
          ? `Retomando disparos... (${alreadySentPhones.length} já enviados e blindados)` 
          : 'Iniciando disparos com cadência Anti-Ban...') 
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
          // Trava 1: Checa se o usuário clicou em Parar ANTES de qualquer ação
          if (isAbortingRef.current) {
            alert(`🛑 Disparo interrompido instantaneamente. Foram enviados ${sentInThisSession} contatos nesta sessão.`);
            break;
          }

          const contact = targetContacts[i];
          const rawPhone = contact.cleanPhone || contact.phone;

          // Normaliza telefone com DDI 55
          const cleanDigits = String(rawPhone).replace(/\D/g, '');
          const normalizedPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;

          // Pula contatos que já receberam esta campanha anteriormente (a não ser em modo force/teste)
          if (!forceSend && (alreadySentPhones.includes(normalizedPhone) || alreadySentPhones.includes(rawPhone))) {
            continue;
          }

          // Trava 2: Seleciona a variação na ordem sequencial exata (1 a 5)
          let chosenText = camp.message;
          if (camp.useVariations && camp.variations && camp.variations.length > 0) {
            const allAvailableTexts = [camp.message, ...camp.variations.filter(v => v.trim().length > 0)];
            chosenText = allAvailableTexts[batchCounter % allAvailableTexts.length];
          }

          const formattedMsg = chosenText
            .replace(/\[Nome\]/gi, contact.name || 'Cliente')
            .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, cardapioUrl)
            .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, grupoVipUrl || '[Link do Grupo]');

          // Trava 3: Checa abort imediatamente antes do POST
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
              })
            });
            const resData = await res.json();
            
            if (!res.ok || !resData.success) {
              const reason = resData.message || resData.error || 'Erro de entrega';
              console.warn(`❌ [Armadilha] Falha no disparo para ${contact.name} (${normalizedPhone}):`, reason);
              failedContacts.push({ name: contact.name || normalizedPhone, reason });
              setDispatchProgress({
                current: alreadySentPhones.length,
                total: targetContacts.length,
                status: `⚠️ Barrado: ${contact.name || normalizedPhone} (${reason}). Avançando para o próximo...`
              });
              alreadySentPhones.push(normalizedPhone);
              localStorage.setItem(sentHistoryKey, JSON.stringify(alreadySentPhones));
              continue;
            }

            if (resData.skipped) {
              skippedCount++;
              console.log(`⏩ Contato ${normalizedPhone} pulado por trava anti-duplicação.`);
              setDispatchProgress({
                current: alreadySentPhones.length,
                total: targetContacts.length,
                status: `⏩ Pulado: ${contact.name || normalizedPhone} já recebeu esta campanha. Avançando...`
              });
            } else {
              sentInThisSession++;
              alreadySentPhones.push(normalizedPhone);
              localStorage.setItem(sentHistoryKey, JSON.stringify(alreadySentPhones));

              setDispatchProgress({
                current: alreadySentPhones.length,
                total: targetContacts.length,
                status: `✅ Entregue (${sentInThisSession}/${targetContacts.length}) para ${contact.name || normalizedPhone} (ID: ${resData.messageId || 'OK'}). Aguardando cadência anti-ban...`
              });
            }
          } catch (e: any) {
            console.error('Erro de conexão no disparo:', e);
            setDispatchProgress({
              current: alreadySentPhones.length,
              total: targetContacts.length,
              status: `⚠️ Erro de conexão com o servidor para ${contact.name}. Avançando...`
            });
            continue;
          }

          batchCounter++;

          // Trava 4: Intervalo de descanso individual entre contatos (20 a 35 segundos aleatórios) com cancelamento instantâneo
          const randomDelay = Math.floor(Math.random() * 15000) + 20000;
          for (let elapsed = 0; elapsed < randomDelay; elapsed += 250) {
            if (isAbortingRef.current) break;
            const remainingDelaySec = Math.max(0, Math.ceil((randomDelay - elapsed) / 1000));
            setDispatchProgress(prev => prev ? {
              ...prev,
              status: `⏳ Intervalo de segurança anti-ban: aguardando ${remainingDelaySec}s antes do próximo contato...`
            } : null);
            await new Promise(r => setTimeout(r, 250));
          }

          if (isAbortingRef.current) {
            alert(`🛑 Disparo interrompido instantaneamente. Foram enviados ${sentInThisSession} contatos nesta sessão.`);
            break;
          }

          // Trava 5: TRAVA RÍGIDA DE LOTE (Exatamente 5 contatos) com Relógio Real do Sistema (Date.now)
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
                status: `⏸️ Lote de ${effectiveBatchSize} concluído! Pausa de segurança anti-ban: ${mins}m ${secs < 10 ? '0' : ''}${secs}s restantes...`
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
        // Disparo para Grupo
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
              (failedContacts.length > 0 ? `\n\n⚠️ ${failedContacts.length} contato(s) foram barrados pela segurança anti-ban:\n${failedContacts.map(f => `• ${f.name}: ${f.reason}`).join('\n')}` : '') +
              (skippedCount > 0 ? `\n\n⏩ ${skippedCount} contato(s) já haviam recebido esta mensagem e foram preservados pela blindagem.` : ''));
          } else if (failedContacts.length > 0) {
            alert(`🛑 Nenhum disparo pôde ser entregue!\n\nMotivo da segurança do sistema:\n${failedContacts.map(f => `• ${f.name}: ${f.reason}`).join('\n')}\n\nO número cadastrado na lista é inválido. A correção automática foi aplicada.`);
          } else if (skippedCount > 0) {
            alert(`⏩ Nenhuma nova mensagem precisava ser enviada. Todos os contatos da lista já receberam esta campanha anteriormente.`);
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header Principal do Marketing */}
      <header className="px-6 py-5 border-b border-white/10 shrink-0 bg-[#0a0a0a]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Megaphone className="size-6 text-white" />
                Módulo de Marketing & Disparos
              </h2>
              <span className="text-[10px] font-mono uppercase bg-white/10 text-white border border-white/20 px-2.5 py-0.5 rounded-full font-bold shadow-sm">
                Exclusivo Smoking Pods
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Campanhas automatizadas, Listas de Transmissão salvas e disparos para Grupos VIP com Anti-Ban.
            </p>
          </div>

          {/* Botões de Ação do Header */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status & Conexão do WhatsApp */}
            <button
              onClick={() => setIsQrModalOpen(true)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                whatsAppConnected
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : !backendOnline
                  ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300 animate-pulse'
              }`}
              title={
                whatsAppConnected
                  ? "WhatsApp Conectado e Pronto para Disparos"
                  : !backendOnline
                  ? "Servidor Backend Offline - Clique para ver instruções"
                  : "Clique para escanear o QR Code"
              }
            >
              <Smartphone className={`size-3.5 ${
                whatsAppConnected ? 'text-emerald-400' : !backendOnline ? 'text-red-400' : 'text-amber-400'
              }`} />
              <span>
                {whatsAppConnected
                  ? '🟢 WhatsApp Conectado'
                  : !backendOnline
                  ? '🔴 Servidor Offline'
                  : '🟡 Conectar WhatsApp (QR)'}
              </span>
            </button>

            <button
              onClick={handleScanWhatsAppHistory}
              disabled={loadingScan}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              title="Faz varredura profunda no WhatsApp para blindar e impedir que qualquer contato receba mensagens repetidas"
            >
              <ShieldCheck className={`size-3.5 text-white/80 ${loadingScan ? 'animate-spin' : ''}`} />
              <span>{loadingScan ? 'Varrendo Histórico...' : '🔍 Varredura & Blindagem'}</span>
            </button>

            <button
              onClick={syncWhatsAppContactsAndGroups}
              disabled={loadingSync}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              title="Sincroniza contatos da agenda do WhatsApp e grupos"
            >
              <RefreshCw className={`size-3.5 text-white ${loadingSync ? 'animate-spin' : ''}`} />
              <span>{loadingSync ? 'Sincronizando...' : 'Sincronizar WhatsApp'}</span>
            </button>

            <button
              data-tour="btn-nova-campanha"
              onClick={() => handleOpenCampaignModal()}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-black text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.35)] active:scale-95"
            >
              <Plus className="size-4 stroke-[3]" />
              <span>Nova Campanha</span>
            </button>
          </div>
        </div>

        {syncStatus && (
          <div className="mt-3 text-xs text-white/90 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-mono">
            {syncStatus}
          </div>
        )}

        {/* Barra de Sub-Navegação (Abas Limpas) */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'campaigns'
                ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                : 'text-white/50 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Layers className="size-4 text-white" />
            <span>Campanhas ({campaigns.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast_lists')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'broadcast_lists'
                ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                : 'text-white/50 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Users className="size-4 text-white" />
            <span>Listas de Transmissão ({broadcastLists.length})</span>
          </button>
        </div>
      </header>

      {/* Alerta Compacto e Elegante de WhatsApp Desconectado */}
      {!whatsAppConnected && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-semibold">
              WhatsApp Desconectado:
            </span>
            <span className="text-white/70">
              O robô precisa estar conectado para disparar campanhas e sincronizar contatos.
            </span>
          </div>
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="px-3 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <QrCode className="size-3.5" />
            <span>Conectar Agora</span>
          </button>
        </div>
      )}

      {/* Conteúdo Principal por Aba */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

        {/* ============================================================ */}
        {/* CARD CENTRAL DE AUDITORIA, BLINDAGEM & DESDUPLICAÇÃO RÁPIDA */}
        {/* ============================================================ */}
        <div className="bg-[#0b0c10] border border-white/10 hover:border-purple-500/30 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Auditoria de Base & Blindagem Anti-Ban
                  </h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    Proteção Ativa
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  Elimina contatos duplicados entre listas e impede que o mesmo número receba mensagens repetidas.
                </p>
              </div>
            </div>

            {/* Ações de Higienização & Varredura */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleCleanAndDeduplicateLists}
                disabled={loadingSanitize}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-black flex items-center gap-2 cursor-pointer transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
                title="Higieniza e desduplica todas as listas em 1 clique"
              >
                <Zap className={`size-3.5 fill-black ${loadingSanitize ? 'animate-spin' : ''}`} />
                <span>{loadingSanitize ? 'Higienizando...' : '⚡ Higienizar & Desduplicar (1 Clique)'}</span>
              </button>

              <button
                onClick={handleScanWhatsAppHistory}
                disabled={loadingScan}
                className="px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                title="Faz varredura profunda no WhatsApp para blindar contatos já abordados"
              >
                <ShieldCheck className={`size-3.5 text-purple-400 ${loadingScan ? 'animate-spin' : ''}`} />
                <span>{loadingScan ? 'Varrendo...' : '🔍 Varrer Histórico'}</span>
              </button>

              <button
                onClick={() => setIsTestLabOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                title="Laboratório de Teste: Dispara para seu WhatsApp e rastreia o erro exato na entrega"
              >
                <FlaskConical className="size-3.5 text-cyan-400" />
                <span>🧪 Laboratório de Teste & Armadilha</span>
              </button>
            </div>
          </div>

          {/* Métricas Rápidas de Diagnóstico */}
          {diagnosticData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/5">
              <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 uppercase font-bold block">Contatos Brutos</span>
                <span className="text-base font-extrabold text-white font-mono">{diagnosticData.totalContactsRaw}</span>
                <span className="text-[10px] text-white/30 block mt-0.5">Somatório de todas as listas</span>
              </div>

              <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40 uppercase font-bold">Únicos Reais</span>
                  {diagnosticData.duplicateCount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold">
                      -{diagnosticData.duplicateCount} dupes
                    </span>
                  )}
                </div>
                <span className="text-base font-extrabold text-purple-300 font-mono">{diagnosticData.totalUnique}</span>
                <span className="text-[10px] text-white/30 block mt-0.5">Pessoas sem repetição</span>
              </div>

              <div className="p-3 bg-black/40 border border-emerald-500/20 rounded-xl">
                <span className="text-[10px] text-emerald-400/80 uppercase font-bold block">⭐ Base Virgem</span>
                <span className="text-base font-extrabold text-emerald-400 font-mono">{diagnosticData.virginCount}</span>
                <span className="text-[10px] text-white/40 block mt-0.5">Prontos para primeiro envio</span>
              </div>

              <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 uppercase font-bold block">🛡️ Já Abordados / Blindados</span>
                <span className="text-base font-extrabold text-white/70 font-mono">{diagnosticData.alreadySentCount || diagnosticData.globalSentTotal}</span>
                <span className="text-[10px] text-white/30 block mt-0.5">Imunes a reenvio acidental</span>
              </div>
            </div>
          )}
        </div>

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

            {/* Lista de Campanhas com Separação Visual por Tipo */}
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
              <div className="space-y-8">
                {/* SEÇÃO 1: CAMPANHAS DE GRUPO VIP (AMARELO / DOURADO) */}
                {(() => {
                  const groupCamps = campaigns.filter(c => c.targetType === 'group');
                  if (groupCamps.length === 0) return null;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-amber-500/20">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                          <MessageSquare className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                            Campanhas de Grupo (WhatsApp VIP)
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                              {groupCamps.length}
                            </span>
                          </h3>
                          <p className="text-[11px] text-white/40">Disparos em canal e grupo oficial da loja</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {groupCamps.map(camp => (
                          <div 
                            key={camp.id}
                            className="bg-[#0c0a06] border border-amber-500/25 hover:border-amber-500/50 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-[0_4px_20px_rgba(245,158,11,0.05)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.12)] group"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                                  {camp.name}
                                </h3>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                                  camp.status === 'active' 
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                                    : 'bg-white/5 text-white/40 border-white/10'
                                }`}>
                                  {camp.status === 'active' ? '🟢 Ativa' : '⚪ Off'}
                                </span>
                              </div>

                              {/* Informações de Destino */}
                              <div className="p-3 bg-[#050505] rounded-xl border border-amber-500/10 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between text-white/60">
                                  <span>Destino:</span>
                                  <span className="font-bold text-amber-400 flex items-center gap-1">
                                    <MessageSquare className="size-3" /> Grupo VIP
                                  </span>
                                </div>
                                
                                <div className="text-[11px] text-amber-300/80 font-mono truncate">
                                  💬 {camp.targetGroupName || 'Grupo VIP Oficial'}
                                </div>

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
                              <p className="text-xs text-white/50 line-clamp-3 font-mono bg-[#050505] p-2.5 rounded-lg border border-white/5">
                                {camp.message}
                              </p>
                            </div>

                            {/* Ações da Campanha */}
                            <div className="flex flex-col gap-3 pt-3 border-t border-amber-500/10">
                              {/* Switch Toggle de Automação Semanal */}
                              <div 
                                className="flex items-center justify-between cursor-pointer group/toggle"
                                onClick={() => toggleCampaignStatus(camp.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {camp.status === 'active' ? (
                                    <ToggleRight className="size-7 text-emerald-400 transition-all" />
                                  ) : (
                                    <ToggleLeft className="size-7 text-white/30 transition-all" />
                                  )}
                                  <div className="flex flex-col">
                                    <span className={`text-[11px] font-bold uppercase tracking-wider ${
                                      camp.status === 'active' ? 'text-emerald-400' : 'text-white/40'
                                    }`}>
                                      {camp.status === 'active' ? '🟢 Automação Ligada' : '⚪ Desligada'}
                                    </span>
                                    {camp.status === 'active' && camp.scheduledWeekday && camp.scheduledTime && (
                                      <span className="text-[10px] text-white/40 font-mono">
                                        Toda {camp.scheduledWeekday.charAt(0) + camp.scheduledWeekday.slice(1).toLowerCase()} às {camp.scheduledTime}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Botões de Ação */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
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
                                  className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all hover:shadow-md disabled:opacity-50"
                                >
                                  <Zap className="size-3" />
                                  <span>🧪 Testar Agora</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* SEÇÃO 2: CAMPANHAS DE LISTAS DE TRANSMISSÃO / 1 A 1 (ROXO) */}
                {(() => {
                  const listCamps = campaigns.filter(c => c.targetType === 'lists');
                  if (listCamps.length === 0) return null;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
                          <Users className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                            Campanhas no Privado (1 a 1 / Listas de Transmissão)
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                              {listCamps.length}
                            </span>
                          </h3>
                          <p className="text-[11px] text-white/40">Disparos diretos para o WhatsApp pessoal de cada cliente</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {listCamps.map(camp => {
                          const targetListNames = broadcastLists
                            .filter(l => camp.selectedListIds?.includes(l.id))
                            .map(l => l.name);

                          return (
                            <div 
                              key={camp.id}
                              className="bg-[#0b0811] border border-purple-500/25 hover:border-purple-500/50 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-[0_4px_20px_rgba(168,85,247,0.05)] hover:shadow-[0_4px_25px_rgba(168,85,247,0.12)] group"
                            >
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition-colors">
                                    {camp.name}
                                  </h3>
                                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                                    camp.status === 'active' 
                                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' 
                                      : 'bg-white/5 text-white/40 border-white/10'
                                  }`}>
                                    {camp.status === 'active' ? '🟢 Ativa' : '⚪ Off'}
                                  </span>
                                </div>

                                {/* Informações de Destino */}
                                <div className="p-3 bg-[#050505] rounded-xl border border-purple-500/10 space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between text-white/60">
                                    <span>Destino:</span>
                                    <span className="font-bold text-purple-400 flex items-center gap-1">
                                      <Users className="size-3" /> {targetListNames.length} Listas Selecionadas
                                    </span>
                                  </div>
                                  
                                  <div className="text-[11px] text-purple-300/80 font-mono truncate">
                                    📁 {targetListNames.join(', ') || 'Nenhuma lista'}
                                  </div>

                                  <div className="flex items-center justify-between text-white/60 pt-1 border-t border-white/5">
                                    <span>Frequência:</span>
                                    <span className="font-semibold text-white">
                                      {camp.frequencyDays === 0 
                                        ? 'Disparo Único' 
                                        : camp.frequencyDays === 7 && camp.scheduledWeekday
                                          ? `Toda ${camp.scheduledWeekday.charAt(0) + camp.scheduledWeekday.slice(1).toLowerCase()}${camp.scheduledTime ? ` às ${camp.scheduledTime}` : ''}` 
                                          : `A cada ${camp.frequencyDays} dias${camp.scheduledTime ? ` às ${camp.scheduledTime}` : ''}`}
                                    </span>
                                  </div>
                                </div>

                                {/* Prévia da Mensagem */}
                                <p className="text-xs text-white/50 line-clamp-3 font-mono bg-[#050505] p-2.5 rounded-lg border border-white/5">
                                  {camp.message}
                                </p>
                              </div>

                              {/* Ações da Campanha */}
                              <div className="flex flex-col gap-3 pt-3 border-t border-purple-500/10">
                                {/* Switch Toggle Universal Liga/Desliga */}
                                <div 
                                  className="flex items-center justify-between cursor-pointer group/toggle"
                                  onClick={() => toggleCampaignStatus(camp.id)}
                                >
                                  <div className="flex items-center gap-2">
                                    {camp.status === 'active' ? (
                                      <ToggleRight className="size-7 text-purple-400 transition-all" />
                                    ) : (
                                      <ToggleLeft className="size-7 text-white/30 transition-all" />
                                    )}
                                    <div className="flex flex-col">
                                      <span className={`text-[11px] font-bold uppercase tracking-wider ${
                                        camp.status === 'active' ? 'text-purple-400' : 'text-white/40'
                                      }`}>
                                        {camp.status === 'active' 
                                          ? (camp.frequencyDays > 0 ? '🟢 Automação Ligada' : '🟢 Campanha Ativa') 
                                          : '⚪ Desligada / Pausada'}
                                      </span>
                                      {camp.status === 'active' && camp.frequencyDays > 0 && (
                                        <span className="text-[10px] text-white/40 font-mono">
                                          {camp.frequencyDays === 7 && camp.scheduledWeekday
                                            ? `Toda ${camp.scheduledWeekday.charAt(0) + camp.scheduledWeekday.slice(1).toLowerCase()} às ${camp.scheduledTime || '15:00'}`
                                            : `A cada ${camp.frequencyDays} dias às ${camp.scheduledTime || '15:00'}`}
                                        </span>
                                      )}
                                      {camp.frequencyDays === 0 && (
                                        <span className="text-[10px] text-white/40 font-mono">
                                          Disparo manual avulso
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Botões de Ação */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
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

                                  {executingCampaignId === camp.id ? (
                                    <button
                                      onClick={handleStopCampaign}
                                      className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all hover:shadow-md animate-pulse"
                                    >
                                      <span>🛑 Parar Disparos</span>
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleOpenTestLabForCampaign(camp)}
                                        className="px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all hover:shadow-md"
                                        title="Abrir Laboratório de Teste com Armadilha para esta campanha"
                                      >
                                        <FlaskConical className="size-3" />
                                        <span>🧪 Testar Envio</span>
                                      </button>
                                      
                                      <button
                                        onClick={() => handleExecuteCampaign(camp)}
                                        className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all hover:shadow-md"
                                      >
                                        <Send className="size-3" />
                                        <span>{camp.frequencyDays > 0 ? 'Disparar Lote' : 'Disparar Tudo'}</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
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

              {/* Frequência do Disparo, Data de Início e Horário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                    <label className="text-xs font-bold text-white/70 block mb-1">📅 Data de Início</label>
                    <input
                      type="date"
                      value={campaignFormStartDate}
                      onChange={(e) => setCampaignFormStartDate(e.target.value)}
                      className="w-full bg-[#050505] border border-emerald-500/30 rounded-xl p-2.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
                    />
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

              {/* Modelos e Mensagem com Suporte a Variações Dinâmicas */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-white">Mensagem Principal</label>
                    <span className="text-[10px] text-white/40 font-mono">Variável: [Nome]</span>
                  </div>

                  {campaignFormTargetType === 'lists' && (
                    <button
                      type="button"
                      onClick={() => setCampaignFormUseVariations(!campaignFormUseVariations)}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        campaignFormUseVariations
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                          : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
                      }`}
                    >
                      <span>🔄 {campaignFormUseVariations ? 'Variações Anti-Ban Ativadas' : '+ Ativar Variações de Texto (Spintax)'}</span>
                    </button>
                  )}
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

                {/* Mensagem Base */}
                <textarea
                  rows={6}
                  value={campaignFormMessage}
                  onChange={(e) => setCampaignFormMessage(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-emerald-500/50"
                  placeholder="Escreva sua mensagem principal aqui..."
                />

                {/* Bloco de Variações Dinâmicas (Spintax) */}
                {campaignFormTargetType === 'lists' && campaignFormUseVariations && (
                  <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl space-y-3 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          🔄 5 Variações Fixas Anti-Ban ({campaignFormVariations.length + 1} de 5 configuradas)
                        </span>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          Cada 1 dos 5 contatos do lote recebe uma mensagem exclusiva. Máximo estrito: 5 variações.
                        </p>
                      </div>
                      {campaignFormVariations.length < 4 ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (campaignFormVariations.length < 4) {
                              setCampaignFormVariations([...campaignFormVariations, '']);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="size-3" /> Adicionar Variação ({campaignFormVariations.length + 2}/5)
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                          ✓ Limite Máximo de 5 Variações Atingido
                        </span>
                      )}
                    </div>

                    {campaignFormVariations.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-purple-500/20 text-center text-xs text-purple-300/40">
                        Nenhuma variação adicionada ainda. Clique em <strong>+ Adicionar Variação</strong> acima para colocar textos alternativos com outras saudações e frases.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {campaignFormVariations.map((v, idx) => (
                          <div key={idx} className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-purple-500/20">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-purple-400 font-mono">Variação #{idx + 2}</span>
                              <button
                                type="button"
                                onClick={() => setCampaignFormVariations(campaignFormVariations.filter((_, i) => i !== idx))}
                                className="text-red-400/70 hover:text-red-300 text-[10px] font-bold"
                              >
                                ✕ Remover
                              </button>
                            </div>
                            <textarea
                              rows={4}
                              value={v}
                              onChange={(e) => {
                                const copy = [...campaignFormVariations];
                                copy[idx] = e.target.value;
                                setCampaignFormVariations(copy);
                              }}
                              className="w-full bg-[#050505] border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-purple-500/50"
                              placeholder={`Texto da variação #${idx + 2}...`}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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

      {/* Modal de Conexão WhatsApp & QR Code */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-white/15 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
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
                onClick={() => setIsQrModalOpen(false)}
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
                    A sessão está ativa e pronta para leitura de contatos, grupos e disparos de campanhas em massa.
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
                onClick={() => setIsQrModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 🧪 MODAL: LABORATÓRIO DE DISPARO & ARMADILHA DE DIAGNÓSTICO */}
      {/* ============================================================ */}
      {isTestLabOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0e1017] border border-cyan-500/30 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            {/* Topo do Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <FlaskConical className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    Laboratório de Disparo &amp; Armadilha de Diagnóstico
                  </h3>
                  <p className="text-xs text-white/50">
                    Rastreie o percurso exato da mensagem e detecte qualquer falha de entrega em tempo real.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTestLabOpen(false)}
                className="size-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Formulário de Envio de Teste */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/80">WhatsApp de Teste (com DDD)</label>
                  <input
                    type="text"
                    value={labPhone}
                    onChange={e => setLabPhone(e.target.value)}
                    placeholder="Ex: 11948420071"
                    className="w-full bg-black/60 border border-white/10 focus:border-cyan-500/50 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 outline-none font-mono"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setLabPhone('11948420071')}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
                    >
                      Preencher meu número (11 94842-0071)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/80">Nome do Contato</label>
                  <input
                    type="text"
                    value={labName}
                    onChange={e => setLabName(e.target.value)}
                    placeholder="Ex: Leo"
                    className="w-full bg-black/60 border border-white/10 focus:border-cyan-500/50 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80">Corpo da Mensagem</label>
                <textarea
                  rows={3}
                  value={labMessage}
                  onChange={e => setLabMessage(e.target.value)}
                  placeholder="Escreva a mensagem de teste aqui..."
                  className="w-full bg-black/60 border border-white/10 focus:border-cyan-500/50 rounded-xl p-3 text-xs text-white placeholder:text-white/30 outline-none leading-relaxed custom-scrollbar"
                />
              </div>

              <button
                type="button"
                onClick={handleRunLabTest}
                disabled={labExecuting}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 active:scale-[0.99]"
              >
                {labExecuting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin text-black" />
                    <span>Executando Armadilha de Diagnóstico no WhatsApp...</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-4 fill-black text-black" />
                    <span>⚡ Disparar e Rastrear com Armadilha</span>
                  </>
                )}
              </button>
            </div>

            {/* Resultado e Telemetria em Tempo Real */}
            {labExecuting && (
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center gap-3 text-cyan-300 text-xs animate-pulse">
                <RefreshCw className="size-5 animate-spin shrink-0" />
                <div>
                  <p className="font-bold">Consultando a rede do WhatsApp...</p>
                  <p className="text-[11px] text-cyan-300/70 mt-0.5">
                    Validando formato, consultando registro ativo no servidor oficial e preparando envio com confirmação de entrega.
                  </p>
                </div>
              </div>
            )}

            {/* Painel do Erro Diagnosticado */}
            {labError && !labExecuting && (
              <div className="p-4 bg-red-500/15 border border-red-500/40 rounded-2xl space-y-2.5 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                    <ShieldAlert className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-red-300 uppercase tracking-wide">
                      Armadilha Ativada: Falha Detectada na Entrega
                    </h4>
                    <p className="text-xs text-white/90 mt-1 font-medium leading-relaxed">
                      {labError}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-black/40 border border-red-500/20 rounded-xl text-[11px] text-white/70 space-y-1">
                  <span className="font-bold text-red-300 block">💡 Diagnóstico Técnico:</span>
                  {labError.includes('LID') ? (
                    <p>Este registro contém um identificador interno de dispositivo (LID com 14+ dígitos) e não um número telefônico com DDD. O WhatsApp rejeita envios diretos para LIDs.</p>
                  ) : labError.includes('NÃO possui conta') || labError.includes('rejeitado') ? (
                    <p>O servidor oficial do WhatsApp confirmou que este telefone não possui conta ativa. Pode ter sido digitado errado, ser um telefone fixo ou ter sido cancelado na operadora.</p>
                  ) : labError.includes('offline') || labError.includes('desconectado') ? (
                    <p>O WhatsApp Web não está conectado ao backend. Conecte pelo botão "Conectar WhatsApp" no topo da página.</p>
                  ) : (
                    <p>Verifique se o número possui DDD correto e se o aparelho que enviou está com internet ativa.</p>
                  )}
                </div>
              </div>
            )}

            {/* Sucesso Confirmado com Recibo */}
            {labResult?.success && !labExecuting && (
              <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl space-y-2.5 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                      Mensagem Entregue e Confirmada pelo Servidor do WhatsApp!
                    </h4>
                    <p className="text-xs text-white/90 mt-1">
                      O corpo da mensagem chegou ao destinatário e o servidor gerou o recibo oficial.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-black/40 p-3 rounded-xl border border-white/5">
                  <div>
                    <span className="text-white/40 block">JID Canônico:</span>
                    <span className="text-emerald-300 font-bold">{labResult.canonicalJid}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block">Message ID:</span>
                    <span className="text-white font-bold">{labResult.messageId}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Linha do Tempo / Trace Passo a Passo */}
            {labResult?.trace && Array.isArray(labResult.trace) && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <h5 className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
                  Trilha de Auditoria do Disparo:
                </h5>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {labResult.trace.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 ${
                        item.status === 'OK'
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                          : item.status === 'ERROR'
                          ? 'bg-red-500/10 border-red-500/30 text-red-300'
                          : 'bg-white/5 border-white/10 text-white/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          {item.status === 'OK' ? '✓' : item.status === 'ERROR' ? '✕' : '•'} Passo {item.step}:
                        </span>
                        <span>{item.title}</span>
                      </div>
                      <span className="text-[10px] text-right text-white/60">
                        {item.message || (item.status === 'OK' ? 'Sucesso' : 'Pendente')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-white/10 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTestLabOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Fechar Laboratório
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
