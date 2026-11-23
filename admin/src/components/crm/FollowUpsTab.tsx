import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, CheckCircle2, AlertTriangle, MessageSquare, 
  Plus, Search, Filter, Trash2, Edit3, ArrowRight, Phone,
  Sparkles, Check, DollarSign, Package, RefreshCw, Layers, XCircle,
  ShieldCheck, X, Zap, Send, Loader2
} from 'lucide-react';
import { 
  fetchFollowUps, 
  completeFollowUp, 
  cancelFollowUp,
  deleteFollowUp, 
  createFollowUp, 
  FOLLOWUP_CATEGORIES, 
  isWithinSafeDispatchWindow,
  sync21DaysReplenishmentFollowUps,
  REPLENISHMENT_CYCLE_DAYS,
  REPLENISHMENT_COPY_VARIATIONS,
  type FollowUpItem, 
  type FollowUpReasonCategory 
} from '@/lib/followUps';
import { fetchLiveClients } from '@/lib/crm';
import { runFollowUpsValidationSuite, type FollowUpsTestSuiteReport } from '@/lib/followUpsTester';
import { useAuth } from '@/contexts/AuthContext';
import { NewFollowUpModal } from './NewFollowUpModal';
import { supabase } from '@/lib/supabase';
import { legacyFetch } from '@/lib/backend';

export function FollowUpsTab() {
  const { company } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncingEngine, setIsSyncingEngine] = useState(false);
  const [syncEngineFeedback, setSyncEngineFeedback] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedClientForModal, setSelectedClientForModal] = useState<any | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [testReport, setTestReport] = useState<FollowUpsTestSuiteReport | null>(null);

  const windowCheck = isWithinSafeDispatchWindow();

  // Filtros
  const [tabFilter, setTabFilter] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      const liveClients = await fetchLiveClients(company?.id);
      // Sincroniza automaticamente a esteira para garantir que pedidos concluídos já estejam agendados
      await sync21DaysReplenishmentFollowUps(liveClients, company?.id);
      let data = await fetchFollowUps(company?.id);

      // Garante que o cliente de teste Eduardo Pitzke esteja registrado na esteira
      const hasEduardo = data.some(f => (f.client_name || '').toLowerCase().includes('eduardo') || (f.client_name || '').toLowerCase().includes('pitzke'));
      if (!hasEduardo) {
        const eduardoClient = liveClients.find(c => (c.name || '').toLowerCase().includes('eduardo') || (c.name || '').toLowerCase().includes('pitzke'));
        const eduardoPhone = eduardoClient?.phone || '5511951741181';
        const eduardoProduct = eduardoClient?.lastProduct || 'Pod Descartável 20k Puffs';
        const eduardoFlavor = eduardoClient?.lastFlavor || 'Ice';
        const targetDays = 21;
        const now = new Date();
        const scheduledDate = new Date(now.getTime() + (targetDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

        const createdEduardo = await createFollowUp({
          company_id: company?.id,
          client_id: eduardoClient?.id || null,
          client_name: 'Eduardo Pitzke',
          client_phone: eduardoPhone,
          reason_category: 'recompra_futura',
          reason_description: 'Pedido concluído. Contagem de 3 semanas (21 dias) iniciada para teste oficial da esteira.',
          target_product: eduardoProduct,
          target_flavor: eduardoFlavor,
          target_puffs: 20000,
          scheduled_date: scheduledDate,
          scheduled_time: '15:00'
        });

        if (createdEduardo) {
          data = [createdEduardo, ...data];
        }
      }
      setFollowUps(data);
    } catch (e) {
      console.error("Erro ao carregar follow-ups:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const targetCompanyId = company?.id || 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
    let debounceTimer: any = null;
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
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            loadData();
          }, 300);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  // Ações
  const handleSync21DaysEngine = async () => {
    setIsSyncingEngine(true);
    setSyncEngineFeedback(null);
    try {
      const liveClients = await fetchLiveClients(company?.id);
      const res = await sync21DaysReplenishmentFollowUps(liveClients, company?.id);
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

  const handleForceAutomaticSend = async (item: FollowUpItem) => {
    const rawPhone = item.client_phone;
    if (!rawPhone) {
      alert('Telefone do cliente não encontrado.');
      return;
    }
    const cleanPhone = String(rawPhone).replace(/\D/g, '');
    const phoneFormatted = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const msg = item.whatsappMessage || `Fala, ${item.client_name}! Tranquilo? Passando pra ver como tá seu pod!`;

    setSendingId(item.id);
    try {
      // Tenta disparo automático direto via motor Baileys do backend
      let sentViaBackend = false;
      try {
        const res = await legacyFetch('/api/marketing/send-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: phoneFormatted,
            text: msg,
            companyId: company?.id
          })
        });
        if (res.ok) {
          const resData = await res.json().catch(() => ({}));
          if (resData.success) {
            sentViaBackend = true;
          }
        }
      } catch (backendErr) {
        console.warn('Backend offline ou túnel indisponível para envio automático:', backendErr);
      }

      if (sentViaBackend) {
        await completeFollowUp(item.id, company?.id);
        await loadData();
        alert(`🚀 Disparo automático enviado com sucesso para ${item.client_name} (${phoneFormatted})!\n\nStatus atualizado para: ENVIADO.`);
      } else {
        // Fallback assistido: abre o WhatsApp com a mensagem pronta e já marca como enviado
        const waUrl = `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
        await completeFollowUp(item.id, company?.id);
        await loadData();
      }
    } catch (err: any) {
      alert(`Erro ao processar disparo: ${err.message || err}`);
    } finally {
      setSendingId(null);
    }
  };

  const handleComplete = async (id: string) => {
    await completeFollowUp(id, company?.id);
    await loadData();
  };

  const handleCancel = async (id: string) => {
    if (confirm('Deseja realmente cancelar este agendamento de follow-up?')) {
      await cancelFollowUp(id, company?.id);
      await loadData();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este agendamento de follow-up?')) {
      await deleteFollowUp(id, company?.id);
      await loadData();
    }
  };

  // Métricas
  const overdueList = followUps.filter(f => f.status === 'pendente' && (f.daysDiff || 0) < 0);
  const todayList = followUps.filter(f => f.status === 'pendente' && (f.daysDiff || 0) === 0);
  const upcomingList = followUps.filter(f => f.status === 'pendente' && (f.daysDiff || 0) > 0);
  const completedList = followUps.filter(f => f.status === 'concluido');

  // Filtragem da Lista
  const filteredFollowUps = followUps.filter(item => {
    // 1. Filtro de Aba
    if (tabFilter === 'today' && (item.status !== 'pendente' || item.daysDiff !== 0)) return false;
    if (tabFilter === 'overdue' && (item.status !== 'pendente' || (item.daysDiff || 0) >= 0)) return false;
    if (tabFilter === 'upcoming' && (item.status !== 'pendente' || (item.daysDiff || 0) <= 0)) return false;
    if (tabFilter === 'completed' && item.status !== 'concluido') return false;
    if (tabFilter === 'all' && item.status === 'concluido') return false;

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
                {windowCheck.inWindow ? '🟢 Janela Segura Aberta (14h-19h)' : '🌙 Fora da Janela (14h-19h)'}
              </span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed max-w-2xl">
              Gatilho de 21 dias (momento em que o pod de 20k-40k puffs começa a queimar). Com <strong>trava anti-spam</strong> que cancela se o cliente comprou recentemente e <strong>rotação de 3 copies humanizadas</strong>.
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
          <p className="text-[11px] text-white/50 mt-1">Atingiram 3 semanas exatas hoje.</p>
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
                  const isOverdue = (item.daysDiff || 0) < 0 && item.status === 'pendente';
                  const isToday = (item.daysDiff || 0) === 0 && item.status === 'pendente';

                  // Cálculo do progresso no ciclo de 3 Semanas (21 dias)
                  const totalDays = 21;
                  const daysLeft = Math.max(0, item.daysDiff ?? 0);
                  const elapsedDays = Math.max(0, Math.min(totalDays, totalDays - daysLeft));
                  const progressPct = isCompleted ? 100 : Math.round((elapsedDays / totalDays) * 100);

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
                                  : daysLeft === 0 
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
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                            <Check className="size-3.5 stroke-[3]" />
                            Enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-white/5 text-white/50 border border-white/10 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                            <Clock className="size-3.5 text-white/40" />
                            Não Enviado
                          </span>
                        )}
                      </td>

                      {/* 5. Ação WhatsApp (Enviar Manualmente em 1 Clique) */}
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Botão Forçar Disparo Automático Agora */}
                          {!isCompleted && !isCancelled && (
                            <button
                              onClick={() => handleForceAutomaticSend(item)}
                              disabled={sendingId === item.id}
                              className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50"
                              title="Forçar Disparo Automático Imediato"
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

                          {/* Botão Enviar Manualmente no WhatsApp */}
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer"
                            title="Enviar Mensagem Manualmente no WhatsApp"
                          >
                            <MessageSquare className="size-3.5 text-emerald-400" />
                            <span>Manual (Zap)</span>
                          </a>


                          {/* Excluir da esteira */}
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                            title="Remover da esteira"
                          >
                            <Trash2 className="size-4" />
                          </button>
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


      {/* Modal de Criação */}
      <NewFollowUpModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFollowUpCreated={loadData}
        initialClient={selectedClientForModal}
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
