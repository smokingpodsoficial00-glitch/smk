import { useState, useEffect, useRef } from 'react';
import { 
  Calendar, Clock, CheckCircle2, MessageSquare, 
  Search, Trash2, Edit3, Phone,
  Sparkles, Check, Package, RefreshCw,
  ShieldCheck, X, Zap, Send, Loader2
} from 'lucide-react';
import { 
  fetchFollowUps, 
  deleteFollowUp, 
  updateFollowUp, 
  isWithinSafeDispatchWindow,
  sync21DaysReplenishmentFollowUps,
  syncFollowUpsWithBackend,
  executeAutoDispatchBatch,
  executeForceSendFollowUp,
  isFollowUpDispatchBusy,
  sortFollowUpsDeterministic,
  formatFollowUpSentLabel,
  REPLENISHMENT_COPY_VARIATIONS,
  DEFAULT_COMPANY_ID,
  normalizeFollowUpPhone,
  generateFollowUpMessage,
  resetClientLocksAndCooldown,
  toLocalDateString,
  type FollowUpItem
} from '@/lib/followUps';
import { fetchLiveClients } from '@/lib/crm';
import { type FollowUpsTestSuiteReport } from '@/lib/followUpsTester';
import { useAuth } from '@/contexts/AuthContext';
import { NewFollowUpModal } from './NewFollowUpModal';
import { supabase } from '@/lib/supabase';

export function FollowUpsTab() {
  const { company } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncingEngine, setIsSyncingEngine] = useState(false);
  const [syncEngineFeedback, setSyncEngineFeedback] = useState<string | null>(null);
  const [serverAutoDispatchActive, setServerAutoDispatchActive] = useState<boolean | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [countdownNowMs, setCountdownNowMs] = useState<number>(() => Date.now());
  const loadSeqRef = useRef(0);
  const suppressRealtimeUntilRef = useRef(0);
  const delayedSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownFiredRef = useRef<Set<string>>(new Set());
  const loadDataRef = useRef<() => Promise<void>>(async () => {});
  const autoDispatchRef = useRef<(items: FollowUpItem[], cid: string) => Promise<void>>(async () => {});
  const [editingItem, setEditingItem] = useState<FollowUpItem | null>(null);
  const [editedMessage, setEditedMessage] = useState<string>('');
  const [selectedVariationIdx, setSelectedVariationIdx] = useState<number>(0);
  const [testReport, setTestReport] = useState<FollowUpsTestSuiteReport | null>(null);

  const windowCheck = isWithinSafeDispatchWindow();

  // Filtros
  const [tabFilter, setTabFilter] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Fallback seguro no painel quando o backend Node remoto ainda não foi reiniciado
   * para assumir o scheduler 24/7 (/api/marketing/followups/sync -> 404).
   * Executa sequencialmente com atualização imediata por cliente e bloqueio de concorrência.
   */
  const runGuardedFrontendAutoDispatch = async (items: FollowUpItem[], targetCompanyId: string) => {
    const result = await executeAutoDispatchBatch(items, {
      companyId: targetCompanyId,
      delayMs: 3500,
      onCandidateStart: (item) => {
        setSendingId(item.id);
      },
      onCandidateEnd: (item) => {
        setSendingId(prev => (prev === item.id ? null : prev));
      },
      onItemDispatched: (updatedItem, allSortedItems) => {
        suppressRealtimeUntilRef.current = Date.now() + 4500;
        setFollowUps(allSortedItems);
        setSyncEngineFeedback(
          `🤖 Disparo automático de 3 semanas enviado para ${updatedItem.client_name} (${updatedItem.client_phone})! Status atualizado para ENVIADO e contagem reiniciada para 21 dias.`
        );
      },
    });

    if (result.sentCount > 0) {
      suppressRealtimeUntilRef.current = Date.now() + 3000;
      if (delayedSyncTimerRef.current) clearTimeout(delayedSyncTimerRef.current);
      delayedSyncTimerRef.current = setTimeout(() => {
        void loadDataRef.current();
      }, 1500);
    }
  };

  autoDispatchRef.current = runGuardedFrontendAutoDispatch;

  const loadData = async () => {
    // Nunca sobrescreve a tela durante um disparo automático/manual em andamento
    if (isFollowUpDispatchBusy()) return;

    const seq = ++loadSeqRef.current;
    const targetCompanyId = company?.id || DEFAULT_COMPANY_ID;
    try {
      const liveClients = await fetchLiveClients(targetCompanyId);
      if (isFollowUpDispatchBusy()) return;

      // Sincroniza automaticamente a esteira respeitando exclusões persistidas e janela de corte
      await sync21DaysReplenishmentFollowUps(liveClients, targetCompanyId);
      if (isFollowUpDispatchBusy()) return;

      let data = await fetchFollowUps(targetCompanyId);

      // Sincroniza com o motor 24/7 no backend Node (mesmo padrão das Campanhas)
      const backendSync = await syncFollowUpsWithBackend(data, targetCompanyId);
      data = backendSync.items;

      if (seq === loadSeqRef.current && !isFollowUpDispatchBusy()) {
        setServerAutoDispatchActive(backendSync.serverAutoDispatchActive);
        setFollowUps(data);

        if (backendSync.serverAutoDispatchActive) {
          // O scheduler 24/7 do servidor assume o disparo; agenda 1 refresh leve se houver itens vencidos
          const hasDueItems = data.some(f => {
            if (f.status !== 'pendente' || f.reason_category !== 'recompra_futura') return false;
            if (f.scheduled_trigger_at) {
              const tMs = new Date(f.scheduled_trigger_at).getTime();
              if (!isNaN(tMs) && Date.now() < tMs) return false;
            }
            return (f.daysDiff ?? 0) <= 0;
          });
          if (hasDueItems) {
            if (delayedSyncTimerRef.current) clearTimeout(delayedSyncTimerRef.current);
            delayedSyncTimerRef.current = setTimeout(() => {
              void loadDataRef.current();
            }, 5000);
          }
        } else {
          // Fallback protegido no painel enquanto o servidor remoto não for reiniciado
          void runGuardedFrontendAutoDispatch(data, targetCompanyId);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar follow-ups:", e);
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  };

  loadDataRef.current = loadData;

  useEffect(() => {
    void loadDataRef.current();

    const targetCompanyId = company?.id || DEFAULT_COMPANY_ID;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pollTimer = setInterval(() => {
      if (!isFollowUpDispatchBusy()) {
        void loadDataRef.current();
      }
    }, 60000);

    const channel = supabase
      .channel(`crm_follow_ups_${targetCompanyId}`)
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'smoking_crm_follow_ups' 
        }, 
        () => {
          if (isFollowUpDispatchBusy() || Date.now() < suppressRealtimeUntilRef.current) return;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (!isFollowUpDispatchBusy()) {
              void loadDataRef.current();
            }
          }, 500);
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (delayedSyncTimerRef.current) clearTimeout(delayedSyncTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  // Contador regressivo segundo a segundo para ciclos com horário exato agendado (ex: teste de 1 minuto)
  const hasTimedPendingTrigger = followUps.some(
    f => f.status === 'pendente' && Boolean(f.scheduled_trigger_at)
  );

  useEffect(() => {
    if (!hasTimedPendingTrigger) return;
    const timer = setInterval(() => {
      const nowMs = Date.now();
      setCountdownNowMs(nowMs);
      const targetCompanyId = company?.id || DEFAULT_COMPANY_ID;
      const reachedTrigger = followUps.some(f => {
        if (f.status !== 'pendente' || !f.scheduled_trigger_at) return false;
        const tMs = new Date(f.scheduled_trigger_at).getTime();
        if (isNaN(tMs) || nowMs < tMs) return false;
        const triggerKey = `${f.id}::${f.scheduled_trigger_at}`;
        if (countdownFiredRef.current.has(triggerKey)) return false;
        countdownFiredRef.current.add(triggerKey);
        return true;
      });
      if (reachedTrigger && !isFollowUpDispatchBusy()) {
        if (serverAutoDispatchActive) {
          void loadDataRef.current();
        } else {
          void autoDispatchRef.current(followUps, targetCompanyId);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [hasTimedPendingTrigger, followUps, serverAutoDispatchActive, company?.id]);

  // Heartbeat automático a cada 30s para disparar follow-ups vencidos enquanto a aba estiver aberta
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (isFollowUpDispatchBusy()) return;
      void loadDataRef.current();
    }, 30000);
    return () => clearInterval(heartbeat);
  }, []);

  // Agendamento de Teste Rápido de 1 Minuto (60s) ao vivo
  const handleScheduleOneMinuteTest = async (item: FollowUpItem) => {
    const targetCompanyId = company?.id || DEFAULT_COMPANY_ID;
    const phoneClean = normalizeFollowUpPhone(item.client_phone);
    if (!phoneClean) return;

    resetClientLocksAndCooldown(phoneClean, targetCompanyId);

    const now = new Date();
    const triggerDate = new Date(now.getTime() + 60 * 1000);
    const triggerIso = triggerDate.toISOString();
    const spDate = toLocalDateString(triggerDate);
    const spTime = triggerDate.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const desc = 'Teste ao vivo: contagem regressiva de 1 minuto para disparo automático.';

    // Atualiza imediatamente na UI
    setFollowUps(prev => prev.map(f => {
      if (f.id !== item.id) return f;
      return {
        ...f,
        status: 'pendente',
        completed_at: null,
        last_sent_at: null,
        scheduled_date: spDate,
        scheduled_time: spTime,
        scheduled_trigger_at: triggerIso,
        daysDiff: 0,
        reason_description: desc,
      };
    }));
    setCountdownNowMs(Date.now());

    try {
      await updateFollowUp(item.id, {
        status: 'pendente',
        completed_at: null,
        last_sent_at: null,
        scheduled_date: spDate,
        scheduled_time: spTime,
        scheduled_trigger_at: triggerIso,
        reason_description: desc,
      }, targetCompanyId);
    } catch (err) {
      console.error('[FollowUps] Erro ao agendar teste de 1 minuto:', err);
    }
  };

  // Ações
  const handleSync21DaysEngine = async () => {
    setIsSyncingEngine(true);
    setSyncEngineFeedback(null);
    const targetCompanyId = company?.id || DEFAULT_COMPANY_ID;
    try {
      const liveClients = await fetchLiveClients(targetCompanyId);
      const res = await sync21DaysReplenishmentFollowUps(liveClients, targetCompanyId);
      await loadData();
      setSyncEngineFeedback(
        `✅ Esteira atualizada com sucesso! ${res.totalProcessed} clientes analisados. Novos criados: ${res.createdCount}. Reprogramados com trava anti-spam: ${res.cancelledRecentBuyerCount}.`
      );
    } catch (err: any) {
      setSyncEngineFeedback(`⚠️ Erro ao sincronizar esteira: ${err?.message || err}`);
    } finally {
      setIsSyncingEngine(false);
    }
  };

  const handleForceAutomaticSend = async (item: FollowUpItem, customTextOverride?: string) => {
    const targetCompanyId = company?.id || DEFAULT_COMPANY_ID;
    setSendingId(item.id);
    setSyncEngineFeedback(null);

    try {
      const result = await executeForceSendFollowUp(item, {
        companyId: targetCompanyId,
        customTextOverride,
      });

      if (!result.success) {
        if (!result.deduplicated) {
          alert(`⚠️ Não foi possível disparar automaticamente pelo motor WhatsApp.\n\nMotivo: ${result.error || 'WhatsApp desconectado ou servidor offline.'}\n\nConecte o WhatsApp no topo da aba Marketing ou use o botão de ícone do WhatsApp para enviar manualmente.`);
        }
        return;
      }

      const updatedItem = result.updatedItem!;
      suppressRealtimeUntilRef.current = Date.now() + 4000;

      // Atualiza estado em tela imediatamente para manter o cliente visível com 0% e selo "Enviado"
      setFollowUps(prev =>
        sortFollowUpsDeterministic(prev.map(f => (f.id === item.id ? updatedItem : f)))
      );

      // Se estava filtrando apenas por "Disparar Hoje" ou "Atrasados", volta para "Total na Esteira" para o cliente não sumir da tela!
      if (tabFilter === 'today' || tabFilter === 'overdue') {
        setTabFilter('all');
      }

      setSyncEngineFeedback(
        `✅ Mensagem única enviada para ${item.client_name} (${updatedItem.client_phone})! Status marcado como ENVIADO e ciclo de 3 semanas zerado para recomeçar.`
      );
      await loadData();
    } catch (err: any) {
      alert(`Erro ao processar disparo: ${err.message || err}`);
    } finally {
      setSendingId(prev => (prev === item.id ? null : prev));
    }
  };

  const handleDelete = async (item: FollowUpItem) => {
    const targetCompanyId = company?.id || DEFAULT_COMPANY_ID;
    const normPhone = normalizeFollowUpPhone(item.client_phone);
    setConfirmDeleteId(null);
    setDeletingId(item.id);
    suppressRealtimeUntilRef.current = Date.now() + 4000;

    // Remoção otimista imediata da interface (inclusive duplicatas do mesmo número na recompra)
    setFollowUps(prev =>
      prev.filter(f => {
        if (f.id === item.id) return false;
        if (item.reason_category === 'recompra_futura' && normPhone && f.reason_category === 'recompra_futura') {
          return normalizeFollowUpPhone(f.client_phone) !== normPhone;
        }
        return true;
      })
    );

    try {
      await deleteFollowUp(item.id, targetCompanyId, item);
      setSyncEngineFeedback(`🗑️ Cliente "${item.client_name}" removido definitivamente da esteira.`);
      await loadData();
    } catch (err: any) {
      setSyncEngineFeedback(`⚠️ Erro ao excluir registro: ${err?.message || err}`);
      await loadData();
    } finally {
      setDeletingId(prev => (prev === item.id ? null : prev));
    }
  };

  // Métricas (inclui vencidos <= 0 em Disparar Hoje para que nenhum cliente com 3 semanas atingidas fique invisível)
  const todayList = followUps.filter(f => f.status === 'pendente' && (f.daysDiff ?? 0) <= 0);
  const upcomingList = followUps.filter(f => f.status === 'pendente' && (f.daysDiff || 0) > 0);
  const completedList = followUps.filter(f => f.status === 'concluido' || Boolean(f.completed_at) || Boolean(f.last_sent_at));

  // Filtragem da Lista
  const filteredFollowUps = followUps.filter(item => {
    // 1. Filtro de Aba
    if (tabFilter === 'today' && (item.status !== 'pendente' || (item.daysDiff ?? 0) > 0)) return false;
    if (tabFilter === 'overdue' && (item.status !== 'pendente' || (item.daysDiff || 0) >= 0)) return false;
    if (tabFilter === 'upcoming' && (item.status !== 'pendente' || (item.daysDiff || 0) <= 0)) return false;
    if (tabFilter === 'completed' && item.status !== 'concluido' && !item.completed_at && !item.last_sent_at) return false;
    if (tabFilter === 'all' && item.status === 'cancelado') return false;

    // 2. Filtro de Categoria
    if (categoryFilter !== 'all' && item.reason_category !== categoryFilter) return false;

    // 3. Filtro de Busca
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (item.client_name || '').toLowerCase().includes(q);
      const matchPhone = (item.client_phone || '').includes(q);
      const matchDesc = (item.reason_description || '').toLowerCase().includes(q);
      const matchProd = (item.target_product || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchDesc && !matchProd) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Banner de Janela Segura & Esteira Automática de 21 Dias */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-[#0e0e10] to-[#0e0e10] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
            <Zap className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Esteira Oficial de Follow-Up Automático (21 Dias)
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                windowCheck.inWindow
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {windowCheck.inWindow ? '🟢 Janela Segura Aberta (10h-22h)' : '🌙 Fora da Janela (10h-22h)'}
              </span>
              {serverAutoDispatchActive === true ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                  🤖 Motor 24/7 no Servidor Ativo
                </span>
              ) : serverAutoDispatchActive === false ? (
                <span
                  title="O painel dispara automaticamente quando aberto. Reinicie o iniciar_backend.bat para ativar o modo 24/7 com navegador fechado."
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-500/15 text-blue-300 border-blue-500/30"
                >
                  ⚡ Auto-Disparo Ativo no Painel (reinicie iniciar_backend.bat para modo 24/7)
                </span>
              ) : null}
            </div>
            <p className="text-xs text-white/60 leading-relaxed max-w-2xl">
              Gatilho automático de 3 semanas (momento em que o pod começa a acabar). Com <strong>trava anti-spam</strong> se o cliente comprou recentemente e <strong>rotação de 5 copies curtas humanizadas</strong>.
            </p>
          </div>
        </div>

        <button
          onClick={handleSync21DaysEngine}
          disabled={isSyncingEngine}
          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black flex items-center gap-2 cursor-pointer transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${isSyncingEngine ? 'animate-spin' : ''}`} />
          <span>{isSyncingEngine ? 'Varrendo CRM...' : 'Sincronizar Esteira (21 Dias)'}</span>
        </button>
      </div>

      {syncEngineFeedback && (
        <div className="p-3.5 rounded-xl bg-[#0a0a0a] border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between gap-2">
          <span>{syncEngineFeedback}</span>
          <button onClick={() => setSyncEngineFeedback(null)} className="text-white/40 hover:text-white">✕</button>
        </div>
      )}

      {/* 1. Header com Métricas da Esteira Automática */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card Todos na Esteira */}
        <div 
          onClick={() => setTabFilter('all')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            tabFilter === 'all'
              ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
              : 'bg-card border-border hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Zap className="size-3.5" />
              Total na Esteira
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{followUps.filter(f => f.status !== 'cancelado').length}</div>
          <p className="text-[11px] text-white/50 mt-1">Clientes cadastrados aguardando ou disparados.</p>
        </div>

        {/* Card Futuros (Carregando 3 Semanas) */}
        <div 
          onClick={() => setTabFilter('upcoming')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            tabFilter === 'upcoming'
              ? 'bg-blue-500/15 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
              : 'bg-card border-border hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Contagem 3 Semanas
            </span>
            <span className="size-2 rounded-full bg-blue-400 animate-pulse" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{upcomingList.length}</div>
          <p className="text-[11px] text-white/50 mt-1">Compras recentes aguardando o pod secar.</p>
        </div>

        {/* Card Hoje / Pronto para Disparo */}
        <div 
          onClick={() => setTabFilter('today')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            tabFilter === 'today'
              ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
              : 'bg-card border-border hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Disparar Hoje
            </span>
            {todayList.length > 0 && <span className="size-2 rounded-full bg-amber-400 animate-ping" />}
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{todayList.length}</div>
          <p className="text-[11px] text-white/50 mt-1">Atingiram 3 semanas e prontos para disparo.</p>
        </div>

        {/* Card Concluídos */}
        <div 
          onClick={() => setTabFilter('completed')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            tabFilter === 'completed'
              ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
              : 'bg-card border-border hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Envios Concluídos
            </span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">{completedList.length}</div>
          <p className="text-[11px] text-white/50 mt-1">Mensagens entregues e vendas fechadas.</p>
        </div>

      </div>

      {/* 2. Barra de Ações & Filtros */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        
        {/* Busca */}
        <div className="relative w-full md:w-80">
          <Search className="size-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, telefone ou nota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141414] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filtro por Categoria */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#141414] border border-white/10 text-white text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-amber-500"
          >
            <option value="all">📂 Todos os Clientes & Status</option>
            <option value="recompra_futura">💨 Esteira de Recompra (21 Dias)</option>
            <option value="sem_dinheiro_salario">💰 Salário / Dia 05</option>
            <option value="pix_pendente">⚡ Pix Pendente</option>
            <option value="espera_sabor">📦 Espera de Sabor</option>
            <option value="negociacao_frete">🛵 Frete / Entrega</option>
            <option value="outro">📝 Outros</option>
          </select>

        </div>
      </div>

      {/* 3. Tabela CRM da Esteira de Recompra (3 Semanas) */}
      {loading ? (
        <div className="p-12 text-center text-white/50">Carregando esteira de recompra...</div>
      ) : filteredFollowUps.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 text-center text-white/40 space-y-3">
          <Clock className="size-10 text-white/20 mx-auto" />
          <p className="text-sm font-semibold text-white">Nenhum cliente na esteira no momento.</p>
          <p className="text-xs max-w-md mx-auto">
            Assim que um pedido for marcado como entregue/concluído, o cliente entra automaticamente nesta esteira com a contagem regressiva de 3 semanas.
          </p>
        </div>
      ) : (
        <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] text-white/50 uppercase bg-black/60 border-b border-white/10 font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 text-white/60 font-semibold">Cliente & Telefone</th>
                  <th className="px-5 py-3.5 text-white/60 font-semibold">Progresso (3 Semanas)</th>
                  <th className="px-5 py-3.5 text-white/60 font-semibold">Última Compra</th>
                  <th className="px-5 py-3.5 text-white/60 font-semibold text-center">Status do Disparo</th>
                  <th className="px-5 py-3.5 text-white/60 font-semibold text-right">Ação WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredFollowUps.map(item => {
                  const isCompleted = item.status === 'concluido';
                  const isCancelled = item.status === 'cancelado';

                  // Cálculo do progresso no ciclo de 3 Semanas (21 dias)
                  const totalDays = 21;
                  const daysLeft = Math.max(0, item.daysDiff ?? 0);
                  const triggerMs = item.scheduled_trigger_at ? new Date(item.scheduled_trigger_at).getTime() : NaN;
                  const msToTrigger = (!isCompleted && Boolean(item.scheduled_trigger_at) && !isNaN(triggerMs))
                    ? Math.max(0, triggerMs - countdownNowMs)
                    : 0;
                  const isCountdownPending = msToTrigger > 0;
                  const totalSecs = Math.ceil(msToTrigger / 1000);
                  const cdMins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
                  const cdSecs = String(totalSecs % 60).padStart(2, '0');
                  const elapsedDays = Math.max(0, Math.min(totalDays, totalDays - daysLeft));
                  const progressPct = isCountdownPending
                    ? 99
                    : (isCompleted || daysLeft === 0)
                    ? 100
                    : Math.round((elapsedDays / totalDays) * 100);

                  const phoneClean = String(item.client_phone || '').replace(/\D/g, '');
                  const phoneFormatted = phoneClean.startsWith('55') ? phoneClean : `55${phoneClean}`;
                  const waUrl = item.whatsappUrl || `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(item.whatsappMessage || '')}`;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-white/5 transition-colors group ${
                        isCancelled ? 'opacity-40 bg-[#080808]' : ''
                      }`}
                    >
                      {/* 1. Cliente & Telefone */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-[#141414] flex items-center justify-center font-bold text-white border border-white/10 group-hover:border-emerald-500/40 transition-colors">
                            {(item.client_name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                              {item.client_name || 'Cliente'}
                            </div>
                            <div className="text-xs text-white/50 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="size-3 text-white/40" />
                              {item.client_phone || 'Sem telefone'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Carregamento de 3 Semanas (% ao decorrer dos dias) */}
                      <td className="px-5 py-4 min-w-[220px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white/80 flex items-center gap-1.5">
                              {isCompleted ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="size-3.5" /> Concluído
                                </span>
                              ) : isCountdownPending ? (
                                <span className="text-amber-300 font-bold flex items-center gap-1 animate-pulse font-mono">
                                  <Clock className="size-3.5" /> Dispara em {cdMins}:{cdSecs}
                                </span>
                              ) : daysLeft === 0 ? (
                                <span className="text-amber-400 font-bold flex items-center gap-1 animate-pulse">
                                  <Clock className="size-3.5" /> 3 Semanas Atingidas
                                </span>
                              ) : (
                                <span className="text-blue-300 flex items-center gap-1">
                                  <RefreshCw className="size-3 animate-spin text-blue-400" /> Ciclo de 3 Semanas (faltam {daysLeft}d)
                                </span>
                              )}
                            </span>
                            <span className="font-mono font-bold text-white/60 text-xs">{progressPct}%</span>
                          </div>

                          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden border border-white/5">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                isCompleted 
                                  ? 'bg-emerald-400' 
                                  : isCountdownPending || daysLeft === 0 
                                  ? 'bg-amber-400' 
                                  : 'bg-gradient-to-r from-blue-500 via-emerald-500 to-emerald-400'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 3. Qual foi a Última Compra */}
                      <td className="px-5 py-4 text-xs min-w-[180px]">
                        <div className="font-bold text-white truncate max-w-[220px] flex items-center gap-1.5">
                          <Package className="size-3.5 text-emerald-400 flex-shrink-0" />
                          <span>{item.target_product || 'Pod Descartável'}</span>
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5 font-mono">
                          {item.target_flavor ? `Sabor: ${item.target_flavor}` : (item.reason_description ? item.reason_description.slice(0, 45) : 'Compra recente')}
                        </div>
                      </td>

                      {/* 4. Enviado e Não Enviado (Status do Disparo Automático) */}
                      <td className="px-5 py-4 text-center">
                        {(isCompleted || item.completed_at || item.last_sent_at) ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                              <Check className="size-3.5 stroke-[3]" />
                              Enviado
                            </span>
                            {(item.last_sent_at || item.completed_at) && (
                              <span className="text-[10px] text-white/40 font-mono">
                                {formatFollowUpSentLabel(item.last_sent_at || item.completed_at)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-white/5 text-white/50 border border-white/10 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                            <Clock className="size-3.5 text-white/40" />
                            Não Enviado
                          </span>
                        )}
                      </td>

                      {/* 5. Ação WhatsApp (Enviar Manualmente ou Disparo Automático) */}
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* Botão Ver/Editar Mensagem de Envio */}
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setEditedMessage(item.whatsappMessage || generateFollowUpMessage(item));
                              const currentIdx = (item.send_count || 0) % REPLENISHMENT_COPY_VARIATIONS.length;
                              setSelectedVariationIdx(currentIdx);
                            }}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors cursor-pointer"
                            title="Ver ou Editar Mensagem / Escolher Variação"
                          >
                            <Edit3 className="size-4" />
                          </button>

                          {/* Botão Testar Disparo em 1 Minuto (60s) */}
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => void handleScheduleOneMinuteTest(item)}
                              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 transition-all cursor-pointer"
                              title="Testar Disparo em 1 Minuto (Inicia contagem regressiva de 60s ao vivo)"
                            >
                              <Clock className="size-4" />
                            </button>
                          )}

                          {/* Botão Forçar Disparo Automático (Disparo da IA em 1 clique direto pelo motor) */}
                          {!isCompleted && !isCancelled && (
                            <button
                              onClick={() => handleForceAutomaticSend(item)}
                              disabled={sendingId === item.id}
                              className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50"
                              title="Forçar Disparo Automático via Motor (Sem abrir WhatsApp)"
                            >
                              {sendingId === item.id ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin" />
                                  <span>Enviando...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="size-3.5" />
                                  <span>Forçar Envio</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Botão Manual WhatsApp: Só o ícone de mensagem */}
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-white/5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 transition-all cursor-pointer inline-flex items-center justify-center"
                            title="Enviar Manualmente no WhatsApp Web / App"
                          >
                            <MessageSquare className="size-4" />
                          </a>

                          {/* Excluir da esteira com confirmação inline sem bloquear popup */}
                          {confirmDeleteId === item.id ? (
                            <div className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded-xl p-1">
                              <button
                                type="button"
                                disabled={deletingId === item.id}
                                onClick={() => void handleDelete(item)}
                                className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white text-[10px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-50"
                              >
                                {deletingId === item.id ? 'Removendo...' : 'Excluir'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-bold cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                              title="Remover da esteira"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


            {/* Modal de Personalização e Troca de Variação da Mensagem */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0e10] border border-white/10 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Personalizar Mensagem de Disparo</h3>
                  <p className="text-xs text-white/50">
                    Cliente: <strong>{editingItem.client_name}</strong> • Último Pod: <strong>{editingItem.target_product || 'Pod Descartável'}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Seletor das 5 Variações Inteligentes */}
              <div className="space-y-1.5">
                <label className="text-white/70 font-bold uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Alternar entre as 5 Copies Humanizadas:</span>
                  <span className="text-emerald-400 font-mono text-[10px]">Anti-Ban WhatsApp</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                  {REPLENISHMENT_COPY_VARIATIONS.map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariationIdx(i);
                        const newText = v.template
                          .replace(/{{nome}}/gi, (editingItem.client_name || 'Cliente').trim().split(' ')[0])
                          .replace(/{{produto}}/gi, editingItem.target_product || 'pod');
                        setEditedMessage(newText);
                      }}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedVariationIdx === i
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold'
                          : 'bg-[#141414] border-white/5 text-white/50 hover:text-white hover:border-white/10'
                      }`}
                    >
                      <div className="text-[10px] font-bold">Variação {i + 1}</div>
                      <div className="text-[9px] text-white/40 truncate">{v.title.split(':')[1]?.trim() || v.title}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Caixa de Edição da Mensagem */}
              <div className="space-y-1.5">
                <label className="text-white/70 font-bold uppercase tracking-wider text-[11px]">
                  Texto que será enviado no WhatsApp:
                </label>
                <textarea
                  rows={8}
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  placeholder="Edite o texto da mensagem aqui..."
                  className="w-full bg-[#141414] border border-white/10 rounded-xl p-3.5 text-xs text-white leading-relaxed focus:outline-none focus:border-emerald-500 resize-none font-sans"
                />
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5 gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2">
                  {/* Salvar na Esteira */}
                  {/* Testar em 1 Minuto */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editingItem) return;
                      const target = editingItem;
                      setEditingItem(null);
                      await handleScheduleOneMinuteTest(target);
                    }}
                    className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Simular conclusão das 3 semanas em 60 segundos com contagem regressiva na tela"
                  >
                    <Clock className="size-3.5" />
                    <span>Testar 1 Minuto</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!editingItem) return;
                      const targetCompanyId = company?.id || DEFAULT_COMPANY_ID;
                      const cleaned = editedMessage.trim();
                      await updateFollowUp(editingItem.id, {
                        custom_message: cleaned || null
                      }, targetCompanyId);
                      const updatedList = followUps.map(f => {
                        if (f.id !== editingItem.id) return f;
                        const updatedMsg = cleaned || generateFollowUpMessage({ ...f, custom_message: null });
                        const phoneClean = normalizeFollowUpPhone(f.client_phone);
                        return {
                          ...f,
                          custom_message: cleaned || null,
                          whatsappMessage: updatedMsg,
                          whatsappUrl: `https://wa.me/${phoneClean}?text=${encodeURIComponent(updatedMsg)}`
                        };
                      });
                      setFollowUps(updatedList);
                      setEditingItem(null);
                      await syncFollowUpsWithBackend(updatedList, targetCompanyId);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Salvar Texto
                  </button>

                  {/* Enviar Agora com o Texto Editado */}
                  <button
                    type="button"
                    disabled={sendingId === editingItem.id}
                    onClick={async () => {
                      if (!editingItem) return;
                      const target = editingItem;
                      setEditingItem(null);
                      await handleForceAutomaticSend(target, editedMessage);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50"
                  >
                    <Send className="size-3.5" />
                    <span>Enviar Agora</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}


      {/* Modal de Criação */}
      <NewFollowUpModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFollowUpCreated={loadData}
        initialClient={null}
      />

      {/* Modal de Relatório de Validação do Bloco 9 */}
      {testReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0e10] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${testReport.allPassed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Relatório de Validação — Bloco 9 (Follow-ups)</h2>
                  <p className="text-xs text-white/50">
                    {testReport.passedTests} de {testReport.totalTests} testes aprovados ({testReport.allPassed ? '100% Sucesso' : 'Com ressalvas'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTestReport(null)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Itens da Bateria Controlada</h3>
                <div className="space-y-1.5">
                  {testReport.results.map(r => (
                    <div
                      key={r.id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                        r.passed ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' : 'bg-red-500/5 border-red-500/20 text-red-300'
                      }`}
                    >
                      <span className="font-bold text-[11px] min-w-[20px]">{r.id}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[11px] flex items-center justify-between">
                          <span>{r.description}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {r.passed ? 'APROVADO' : 'FALHA'}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/60 mt-0.5">{r.details}</p>
                        {r.error && <p className="text-[10px] text-red-400 mt-0.5">Erro: {r.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
