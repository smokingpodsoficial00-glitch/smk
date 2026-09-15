import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CheckSquare, Plus, Search, Filter, Bug, Sparkles, Package, 
  DollarSign, Target, User, Calendar, CheckCircle2, Clock, 
  ChevronRight, ChevronLeft, LayoutGrid, List, AlertTriangle, 
  Trash2, Edit3, ArrowRight, RefreshCw, Zap, BellRing
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { 
  CompanyTask, 
  TaskCategory, 
  TaskPriority, 
  TaskStatus, 
} from '@/lib/companyTasks';
import {
  TASK_CATEGORY_CONFIG, 
  TASK_PRIORITY_CONFIG, 
  TASK_STATUS_COLUMNS,
  DEFAULT_COMPANY_ID,
  fetchCompanyTasks, 
  createCompanyTask, 
  updateCompanyTask, 
  deleteCompanyTask, 
  subscribeToCompanyTasks 
} from '@/lib/companyTasks';
import { TaskModal } from './tasks/TaskModal';
import { TaskDetailModal } from './tasks/TaskDetailModal';

export default function CompanyTasksPage() {
  const { company, user } = useAuth();
  const companyId = company?.id || DEFAULT_COMPANY_ID;

  // Estado das tarefas
  const [tasks, setTasks] = useState<CompanyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);

  // Filtros e visualização
  const [activeView, setActiveView] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');
  const [assignedFilter, setAssignedFilter] = useState<string>('TODOS');
  const [priorityFilter, setPriorityFilter] = useState<string>('TODAS');

  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CompanyTask | null>(null);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<CompanyTask | null>(null);
  const [defaultStatusForNewTask, setDefaultStatusForNewTask] = useState<TaskStatus>('PENDENTE');

  // Toast de notificação em tempo real
  const [realtimeToast, setRealtimeToast] = useState<{ message: string; title: string } | null>(null);

  // Carrega as tarefas
  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchCompanyTasks(companyId);
      setTasks(data);
    } catch (err) {
      console.warn('Erro ao carregar tarefas da empresa:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Inicia ouvinte Supabase Realtime para sincronização imediata entre os sócios
  useEffect(() => {
    const unsubscribe = subscribeToCompanyTasks(companyId, (payload) => {
      setIsRealtimeActive(true);
      loadTasks();

      if (payload.eventType === 'INSERT' && payload.new?.title) {
        setRealtimeToast({
          message: 'Nova tarefa adicionada pelo sócio!',
          title: payload.new.title
        });
        setTimeout(() => setRealtimeToast(null), 5000);
      } else if (payload.eventType === 'UPDATE' && payload.new?.title) {
        setRealtimeToast({
          message: 'Tarefa atualizada pelo sócio!',
          title: payload.new.title
        });
        setTimeout(() => setRealtimeToast(null), 4000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [companyId, loadTasks]);

  // Ações CRUD
  const handleCreateTask = async (taskInput: Omit<CompanyTask, 'id' | 'created_at' | 'updated_at'>) => {
    const created = await createCompanyTask({
      ...taskInput,
      company_id: companyId
    });
    setTasks(prev => [created, ...prev]);
  };

  const handleUpdateTask = async (taskInput: Omit<CompanyTask, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editingTask) return;
    await updateCompanyTask(editingTask.id, taskInput);
    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskInput } : t));
    setEditingTask(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteCompanyTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (selectedTaskForDetail?.id === taskId) {
      setSelectedTaskForDetail(null);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    await updateCompanyTask(taskId, { status: newStatus });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    if (selectedTaskForDetail?.id === taskId) {
      setSelectedTaskForDetail(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const updatedSubtasks = targetTask.subtasks.map(s => 
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );

    await updateCompanyTask(taskId, { subtasks: updatedSubtasks });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t));
    if (selectedTaskForDetail?.id === taskId) {
      setSelectedTaskForDetail(prev => prev ? { ...prev, subtasks: updatedSubtasks } : null);
    }
  };

  // Filtragem de Tarefas
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = (task.description || '').toLowerCase().includes(q);
        const matchesSubtask = task.subtasks.some(s => s.title.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesSubtask) return false;
      }

      // Categoria
      if (categoryFilter !== 'TODAS' && task.category !== categoryFilter) {
        return false;
      }

      // Responsável
      if (assignedFilter !== 'TODOS' && task.assigned_to !== assignedFilter) {
        return false;
      }

      // Prioridade
      if (priorityFilter !== 'TODAS' && task.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, categoryFilter, assignedFilter, priorityFilter]);

  // KPIs Macro
  const totalCount = tasks.length;
  const pendingCount = tasks.filter(t => t.status === 'PENDENTE').length;
  const inProgressCount = tasks.filter(t => t.status === 'EM_ANDAMENTO').length;
  const inReviewCount = tasks.filter(t => t.status === 'REVISAO').length;
  const completedCount = tasks.filter(t => t.status === 'CONCLUIDO').length;
  const bugsCount = tasks.filter(t => t.category === 'BUG' && t.status !== 'CONCLUIDO').length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 space-y-6 text-white custom-scrollbar">
      
      {/* Toast Notificação de Tempo Real entre Sócios */}
      {realtimeToast && (
        <div 
          onClick={() => setRealtimeToast(null)}
          className="fixed top-6 right-6 z-50 bg-[#0e0e10]/95 backdrop-blur-md border border-emerald-500/40 text-white p-4 rounded-2xl shadow-[0_10px_35px_rgba(16,185,129,0.2)] flex items-center gap-3.5 animate-in slide-in-from-top-4 duration-300 cursor-pointer hover:border-emerald-400 transition-all max-w-sm"
        >
          <div className="size-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
            <BellRing className="size-4 animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">{realtimeToast.message}</p>
            <p className="text-xs font-semibold text-white truncate mt-0.5">{realtimeToast.title}</p>
          </div>
        </div>
      )}

      {/* ━━━ CABEÇALHO DO MÓDULO (DESIGN SYSTEM ALINHADO) ━━━━━━━━━━━ */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <CheckSquare className="size-6 text-emerald-400 shrink-0" />
              <span>Tarefas da Empresa</span>
            </h1>
            <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Tempo Real Ativo</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Alinhamento e acompanhamento de tarefas, bugs e melhorias entre sócios (Eduardo & Gabriel).
          </p>
        </div>

        {/* Ações do Header */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {/* Alternador de Visão (Quadro vs Lista) */}
          <div className="flex items-center bg-[#141416] p-1 rounded-xl border border-white/10 gap-1">
            <button
              type="button"
              onClick={() => setActiveView('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'kanban'
                  ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <LayoutGrid className="size-3.5" />
              <span>Quadro</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'list'
                  ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <List className="size-3.5" />
              <span>Lista</span>
            </button>
          </div>

          {/* Botão Principal Nova Tarefa */}
          <button
            type="button"
            onClick={() => {
              setDefaultStatusForNewTask('PENDENTE');
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 select-none"
          >
            <Plus className="size-4 stroke-[3]" />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </header>

      {/* ━━━ VISÃO MACRO: 5 CARDS SUPERIORES DE INDICADORES ━━━━━━━━━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* 1. Total */}
        <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 flex flex-col justify-between space-y-1.5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Total Tarefas</span>
            <Target className="size-4 text-white/40" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">{totalCount}</div>
            <span className="text-[10px] text-white/40">registradas no sistema</span>
          </div>
        </div>

        {/* 2. A Fazer */}
        <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 flex flex-col justify-between space-y-1.5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">A Fazer</span>
            <Clock className="size-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">{pendingCount}</div>
            <span className="text-[10px] text-zinc-400">pendentes para iniciar</span>
          </div>
        </div>

        {/* 3. Em Andamento */}
        <div className="bg-[#0e0e10] border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-1.5 shadow-md bg-gradient-to-b from-amber-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Em Andamento</span>
            <Sparkles className="size-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400 font-mono">{inProgressCount}</div>
            <span className="text-[10px] text-amber-400/70">sendo executadas</span>
          </div>
        </div>

        {/* 4. Bugs & Falhas */}
        <div className={`bg-[#0e0e10] border rounded-2xl p-4 flex flex-col justify-between space-y-1.5 shadow-md ${
          bugsCount > 0 ? 'border-rose-500/40 bg-gradient-to-b from-rose-500/10 to-transparent' : 'border-white/10'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Bugs / Erros</span>
            <Bug className={`size-4 text-rose-400 ${bugsCount > 0 ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-400 font-mono">{bugsCount}</div>
            <span className="text-[10px] text-rose-400/70">aguardando correção</span>
          </div>
        </div>

        {/* 5. Concluídas */}
        <div className="bg-[#0e0e10] border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-1.5 shadow-md bg-gradient-to-b from-emerald-500/5 to-transparent col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Concluídas</span>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">{completedCount}</div>
            <span className="text-[10px] text-emerald-400/70">resolvidas com sucesso</span>
          </div>
        </div>
      </div>

      {/* ━━━ BARRA DE BUSCA E FILTROS RÁPIDOS ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0e0e10] p-3 rounded-2xl border border-white/10">
        {/* Campo de Busca */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, descrição ou checklist..."
            className="w-full bg-[#161618] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Filtros em Linha */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Categoria */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#161618] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
          >
            <option value="TODAS">Todas Categorias</option>
            <option value="BUG">🐛 Bugs / Erros</option>
            <option value="MELHORIA">🚀 Melhorias</option>
            <option value="OPERACIONAL">📦 Operacional / Estoque</option>
            <option value="FINANCEIRO">💰 Financeiro</option>
            <option value="GERAL">🎯 Geral</option>
          </select>

          {/* Responsável */}
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="bg-[#161618] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
          >
            <option value="TODOS">Todos Responsáveis</option>
            <option value="Eduardo">Eduardo</option>
            <option value="Gabriel">Gabriel</option>
            <option value="Ambos">Ambos</option>
          </select>

          {/* Prioridade */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-[#161618] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
          >
            <option value="TODAS">Todas Prioridades</option>
            <option value="URGENTE">🔴 Urgentes</option>
            <option value="MEDIA">🟡 Médias</option>
            <option value="BAIXA">🟢 Baixas</option>
          </select>
        </div>
      </div>

      {/* ━━━ CONTEÚDO PRINCIPAL: MODO QUADRO KANBAN ━━━━━━━━━━━━━━━━━━━━ */}
      {activeView === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {TASK_STATUS_COLUMNS.map((col) => {
            const columnTasks = filteredTasks.filter(t => t.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 min-h-[400px] shadow-lg"
              >
                {/* Header da Coluna */}
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${col.color}`}>
                      {col.title}
                    </span>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/60">
                      {columnTasks.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDefaultStatusForNewTask(col.id);
                      setIsCreateModalOpen(true);
                    }}
                    title="Adicionar tarefa nesta coluna"
                    className="size-6 rounded-lg bg-white/5 hover:bg-white/15 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar max-h-[calc(100vh-360px)]">
                  {columnTasks.length === 0 ? (
                    <div className="py-8 text-center text-white/30 text-xs italic">
                      Nenhuma tarefa {col.title.toLowerCase()}
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const catCfg = TASK_CATEGORY_CONFIG[task.category];
                      const prioCfg = TASK_PRIORITY_CONFIG[task.priority];
                      const totalSub = task.subtasks.length;
                      const doneSub = task.subtasks.filter(s => s.completed).length;

                      const partnerTagColor = 
                        task.assigned_to === 'Eduardo' 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : task.assigned_to === 'Gabriel'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : 'bg-purple-500/20 text-purple-300 border-purple-500/30';

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskForDetail(task)}
                          className="bg-[#121214] border border-white/10 hover:border-white/25 rounded-xl p-3.5 space-y-2.5 transition-all cursor-pointer shadow-md hover:shadow-lg group"
                        >
                          {/* Tags Topo: Categoria + Prioridade */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catCfg.badge}`}>
                              {catCfg.icon} {catCfg.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <div className={`size-1.5 rounded-full ${prioCfg.dotColor}`} />
                              <span className="text-[10px] font-bold text-white/60 font-mono">
                                {prioCfg.label}
                              </span>
                            </div>
                          </div>

                          {/* Título */}
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug">
                            {task.title}
                          </h4>

                          {/* Preview da Descrição (se houver) */}
                          {task.description && (
                            <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Barra de Checklist (se houver subtarefas) */}
                          {totalSub > 0 && (
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[10px] text-white/50 font-mono">
                                <span className="flex items-center gap-1">
                                  <CheckSquare className="size-3 text-emerald-400" />
                                  <span>Checklist</span>
                                </span>
                                <span>{doneSub}/{totalSub}</span>
                              </div>
                              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-400 rounded-full"
                                  style={{ width: `${Math.round((doneSub / totalSub) * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Rodapé do Card: Responsável + Data + Movimentação Rápida */}
                          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                            {/* Responsável */}
                            <span className={`px-2 py-0.5 rounded-full border font-bold ${partnerTagColor}`}>
                              {task.assigned_to}
                            </span>

                            {/* Ações Rápidas de Movimentação de Status */}
                            <div 
                              onClick={(e) => e.stopPropagation()} 
                              className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
                            >
                              {col.id !== 'PENDENTE' && (
                                <button
                                  type="button"
                                  title="Voltar status anterior"
                                  onClick={() => {
                                    const prevStatus: Record<TaskStatus, TaskStatus> = {
                                      CONCLUIDO: 'REVISAO',
                                      REVISAO: 'EM_ANDAMENTO',
                                      EM_ANDAMENTO: 'PENDENTE',
                                      PENDENTE: 'PENDENTE'
                                    };
                                    handleStatusChange(task.id, prevStatus[col.id]);
                                  }}
                                  className="p-1 rounded bg-white/5 hover:bg-white/15 text-white/60 hover:text-white"
                                >
                                  <ChevronLeft className="size-3" />
                                </button>
                              )}

                              {col.id !== 'CONCLUIDO' && (
                                <button
                                  type="button"
                                  title="Avançar próximo status"
                                  onClick={() => {
                                    const nextStatus: Record<TaskStatus, TaskStatus> = {
                                      PENDENTE: 'EM_ANDAMENTO',
                                      EM_ANDAMENTO: 'REVISAO',
                                      REVISAO: 'CONCLUIDO',
                                      CONCLUIDO: 'CONCLUIDO'
                                    };
                                    handleStatusChange(task.id, nextStatus[col.id]);
                                  }}
                                  className="p-1 rounded bg-white/5 hover:bg-white/15 text-white/60 hover:text-white"
                                >
                                  <ChevronRight className="size-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ━━━ CONTEÚDO PRINCIPAL: MODO LISTA / TABELA EXECUTIVA ━━━━━━━━━ */}
      {activeView === 'list' && (
        <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#121214] text-white/50 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Prioridade</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Título & Descrição</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4">Checklist</th>
                  <th className="py-3 px-4">Prazo</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-white/30 italic">
                      Nenhuma tarefa encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const catCfg = TASK_CATEGORY_CONFIG[task.category];
                    const prioCfg = TASK_PRIORITY_CONFIG[task.priority];
                    const colCfg = TASK_STATUS_COLUMNS.find(c => c.id === task.status);
                    const totalSub = task.subtasks.length;
                    const doneSub = task.subtasks.filter(s => s.completed).length;

                    return (
                      <tr 
                        key={task.id}
                        onClick={() => setSelectedTaskForDetail(task)}
                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        {/* Status */}
                        <td className="py-3 px-4 shrink-0">
                          <span className={`font-bold px-2 py-1 rounded-lg text-[10px] ${colCfg?.badgeBg}`}>
                            {colCfg?.title}
                          </span>
                        </td>

                        {/* Prioridade */}
                        <td className="py-3 px-4 shrink-0">
                          <span className="font-bold flex items-center gap-1 text-[10px]">
                            <div className={`size-1.5 rounded-full ${prioCfg.dotColor}`} />
                            <span className="text-white/70">{prioCfg.label}</span>
                          </span>
                        </td>

                        {/* Categoria */}
                        <td className="py-3 px-4 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] border font-bold ${catCfg.badge}`}>
                            {catCfg.icon} {catCfg.label}
                          </span>
                        </td>

                        {/* Título */}
                        <td className="py-3 px-4 min-w-[220px]">
                          <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-[11px] text-white/50 truncate max-w-md">
                              {task.description}
                            </div>
                          )}
                        </td>

                        {/* Responsável */}
                        <td className="py-3 px-4 shrink-0">
                          <span className="font-semibold text-white/80">
                            {task.assigned_to}
                          </span>
                        </td>

                        {/* Checklist */}
                        <td className="py-3 px-4 shrink-0 font-mono text-[11px] text-white/60">
                          {totalSub > 0 ? `${doneSub}/${totalSub}` : '—'}
                        </td>

                        {/* Prazo */}
                        <td className="py-3 px-4 shrink-0 font-mono text-[11px] text-white/50">
                          {task.due_date ? task.due_date.split('-').reverse().join('/') : '—'}
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-4 text-right shrink-0" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingTask(task)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors"
                              title="Editar Tarefa"
                            >
                              <Edit3 className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Excluir a tarefa "${task.title}"?`)) {
                                  handleDeleteTask(task.id);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
                              title="Excluir Tarefa"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Criação */}
      <TaskModal
        isOpen={isCreateModalOpen}
        defaultStatus={defaultStatusForNewTask}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateTask}
      />

      {/* Modal de Edição */}
      {editingTask && (
        <TaskModal
          isOpen={true}
          taskToEdit={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleUpdateTask}
        />
      )}

      {/* Modal 360 de Detalhes da Tarefa */}
      {selectedTaskForDetail && (
        <TaskDetailModal
          task={selectedTaskForDetail}
          onClose={() => setSelectedTaskForDetail(null)}
          onEdit={(task) => {
            setSelectedTaskForDetail(null);
            setEditingTask(task);
          }}
          onDelete={handleDeleteTask}
          onStatusChange={handleStatusChange}
          onToggleSubtask={handleToggleSubtask}
        />
      )}
    </div>
  );
}
