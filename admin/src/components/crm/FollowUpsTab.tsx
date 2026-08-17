import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, CheckCircle2, AlertTriangle, MessageSquare, 
  Plus, Search, Filter, Trash2, Edit3, ArrowRight, Phone,
  Sparkles, Check, DollarSign, Package, RefreshCw, Layers
} from 'lucide-react';
import { 
  fetchFollowUps, 
  completeFollowUp, 
  deleteFollowUp, 
  FOLLOWUP_CATEGORIES, 
  type FollowUpItem, 
  type FollowUpReasonCategory 
} from '@/lib/followUps';
import { useAuth } from '@/contexts/AuthContext';
import { NewFollowUpModal } from './NewFollowUpModal';
import { supabase } from '@/lib/supabase';

export function FollowUpsTab() {
  const { company } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClientForModal, setSelectedClientForModal] = useState<any | null>(null);

  // Filtros
  const [tabFilter, setTabFilter] = useState<'today' | 'overdue' | 'upcoming' | 'all' | 'completed'>('today');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      const data = await fetchFollowUps(company?.id);
      setFollowUps(data);
    } catch (e) {
      console.error("Erro ao carregar follow-ups:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('follow_ups_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_follow_ups' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  // Ações
  const handleComplete = async (id: string) => {
    await completeFollowUp(id);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este agendamento de follow-up?')) {
      await deleteFollowUp(id);
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
      
      {/* 1. Header com Métricas & Botão de Criação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card Hoje */}
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
              Follow-ups de Hoje
            </span>
            <span className="size-2 rounded-full bg-amber-400 animate-ping" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{todayList.length}</div>
          <p className="text-[11px] text-white/50 mt-1">Clientes para contatar hoje no WhatsApp.</p>
        </div>

        {/* Card Atrasados */}
        <div 
          onClick={() => setTabFilter('overdue')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            tabFilter === 'overdue'
              ? 'bg-red-500/15 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
              : 'bg-card border-border hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              Atrasados / Urgentes
            </span>
            {overdueList.length > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                Ação
              </span>
            )}
          </div>
          <div className="text-3xl font-extrabold text-red-400 font-mono">{overdueList.length}</div>
          <p className="text-[11px] text-white/50 mt-1">Passaram da data combinada e não compraram.</p>
        </div>

        {/* Card Futuros */}
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
              Próximos Agendados
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{upcomingList.length}</div>
          <p className="text-[11px] text-white/50 mt-1">Marcados para os próximos dias/salário.</p>
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
              Vendas Concluídas
            </span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">{completedList.length}</div>
          <p className="text-[11px] text-white/50 mt-1">Follow-ups que fecharam em Pix.</p>
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

        {/* Filtro por Categoria + Botão de Criar */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#141414] border border-white/10 text-white text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-amber-500"
          >
            <option value="all">📂 Todos os Motivos</option>
            <option value="sem_dinheiro_salario">💰 Salário / Dia 05</option>
            <option value="pix_pendente">⚡ Pix Pendente</option>
            <option value="espera_sabor">📦 Espera de Sabor</option>
            <option value="negociacao_frete">🛵 Frete / Entrega</option>
            <option value="recompra_futura">💨 Recompra Marcada</option>
            <option value="outro">📝 Outros</option>
          </select>

          <button
            onClick={() => {
              setSelectedClientForModal(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] cursor-pointer"
          >
            <Plus className="size-4 stroke-[3]" />
            <span>+ Novo Follow-up</span>
          </button>

        </div>
      </div>

      {/* 3. Lista de Cards de Follow-up */}
      {loading ? (
        <div className="p-12 text-center text-white/50">Carregando agendamentos...</div>
      ) : filteredFollowUps.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 text-center text-white/40 space-y-3">
          <Calendar className="size-10 text-white/20 mx-auto" />
          <p className="text-sm font-semibold text-white">Nenhum follow-up encontrado nesta categoria.</p>
          <p className="text-xs max-w-md mx-auto">
            Quando um cliente não puder comprar agora ou prometer comprar no dia do salário, registre aqui para não esquecer!
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="size-4" /> Registrar Primeiro Follow-up
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFollowUps.map(item => {
            const cat = FOLLOWUP_CATEGORIES[item.reason_category] || FOLLOWUP_CATEGORIES.outro;
            const isOverdue = (item.daysDiff || 0) < 0 && item.status === 'pendente';
            const isToday = (item.daysDiff || 0) === 0 && item.status === 'pendente';
            const isCompleted = item.status === 'concluido';

            return (
              <div 
                key={item.id}
                className={`bg-[#0c0c0c] border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-md ${
                  isOverdue 
                    ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.08)]' 
                    : isToday 
                    ? 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                    : isCompleted
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="space-y-3">
                  
                  {/* Top Header do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cat.icon}</span>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          {item.client_name}
                        </h4>
                        <div className="text-[11px] text-white/50 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="size-3 text-white/40" />
                          {item.client_phone}
                        </div>
                      </div>
                    </div>

                    {/* Badge de Status / Data */}
                    <div>
                      {isCompleted ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Venda Fechada
                        </span>
                      ) : isOverdue ? (
                        <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase animate-pulse flex items-center gap-1">
                          <AlertTriangle className="size-3" /> Atrasado há {Math.abs(item.daysDiff || 0)}d
                        </span>
                      ) : isToday ? (
                        <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase flex items-center gap-1">
                          <Clock className="size-3" /> Disparar Hoje
                        </span>
                      ) : (
                        <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                          <Calendar className="size-3" /> Em {item.daysDiff} dias ({item.scheduled_date})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Motivo Comercial & Nota Combinada */}
                  <div className="p-3 bg-[#141414] rounded-xl border border-white/5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-white/60">
                      <span className="text-[11px] font-bold text-amber-400/90">{cat.label}</span>
                      <span className="text-[10px] text-white/40 font-mono">Data marcada: {item.scheduled_date}</span>
                    </div>

                    {item.reason_description ? (
                      <p className="text-xs text-white/80 font-medium">
                        "{item.reason_description}"
                      </p>
                    ) : (
                      <p className="text-xs text-white/40 italic">Sem anotação adicional.</p>
                    )}

                    {item.target_product && (
                      <div className="text-[11px] text-emerald-400 font-mono pt-1 border-t border-white/5">
                        🎯 Pod de Interesse: {item.target_product}
                      </div>
                    )}
                  </div>

                </div>

                {/* Ações do Card */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                    title="Excluir Follow-up"
                  >
                    <Trash2 className="size-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    {!isCompleted && (
                      <button
                        onClick={() => handleComplete(item.id)}
                        className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Marcar como Venda Fechada"
                      >
                        <Check className="size-3.5 stroke-[3]" />
                        <span>Venda Fechada</span>
                      </button>
                    )}

                    <a
                      href={item.whatsappUrl || `https://wa.me/${String(item.client_phone).replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer"
                    >
                      <MessageSquare className="size-3.5" />
                      <span>Chamar no Zap</span>
                    </a>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação */}
      <NewFollowUpModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFollowUpCreated={loadData}
        initialClient={selectedClientForModal}
      />

    </div>
  );
}
