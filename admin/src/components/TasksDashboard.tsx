import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, Plus, FolderPlus, Filter, 
  CheckCircle2, Clock, AlertCircle, RefreshCw, Layers,
  Trash2, User, ChevronRight, Inbox, Sparkles, LayoutGrid
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchPartners, type Partner } from '../lib/partners';
import { 
  fetchPartnerTasks, fetchTaskCategories, deleteTaskCategory, 
  deletePartnerTask, toggleTaskStatus, updatePartnerTask,
  type PartnerTask, type TaskCategory 
} from '../lib/tasks';
import { TaskCard } from './tasks/TaskCard';
import { NewTaskModal } from './tasks/NewTaskModal';
import { NewCategoryModal } from './tasks/NewCategoryModal';
import { TaskDetailModal } from './tasks/TaskDetailModal';

export default function TasksDashboard() {
  const { company } = useAuth();
  const companyId = company?.id || '';

  const [partners, setPartners] = useState<Partner[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [tasks, setTasks] = useState<PartnerTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro
  const [filterMode, setFilterMode] = useState<'ATIVAS' | 'CONCLUIDAS' | 'TODAS'>('ATIVAS');

  // Modais
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<PartnerTask | null>(null);

  const [modalDefaultPartnerId, setModalDefaultPartnerId] = useState<string | undefined>(undefined);
  const [modalDefaultCategoryId, setModalDefaultCategoryId] = useState<string | undefined>(undefined);

  // Carregamento de Dados
  const loadAllData = async () => {
    if (!companyId) return;
    try {
      setLoading(true);

      const loadedPartners = await fetchPartners(companyId);
      const activePartners = loadedPartners.filter(p => p.is_active !== false);
      setPartners(activePartners);

      const loadedCategories = await fetchTaskCategories(companyId, activePartners);
      setCategories(loadedCategories);

      const loadedTasks = await fetchPartnerTasks(companyId);
      setTasks(loadedTasks);
    } catch (err) {
      console.error('[TasksDashboard] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [companyId]);

  // Realtime Supabase
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`tasks_realtime_${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_partner_tasks' }, () => {
        loadAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_task_categories' }, () => {
        loadAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  // Identificação dos Sócios
  const gabrielPartner = useMemo(() => {
    return partners.find(p => p.name.toLowerCase().includes('gabriel')) || partners[0];
  }, [partners]);

  const eduardoPartner = useMemo(() => {
    return partners.find(p => p.name.toLowerCase().includes('eduardo')) || partners[1] || partners[0];
  }, [partners]);

  // Filtragem de Tarefas
  const filteredTasks = useMemo(() => {
    if (filterMode === 'ATIVAS') {
      return tasks.filter(t => t.status !== 'CONCLUIDA');
    }
    if (filterMode === 'CONCLUIDAS') {
      return tasks.filter(t => t.status === 'CONCLUIDA');
    }
    return tasks;
  }, [tasks, filterMode]);

  // Ações de Tarefas
  const handleToggleStatus = async (task: PartnerTask) => {
    const updated = await toggleTaskStatus(task, companyId);
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    if (selectedTaskForDetail?.id === task.id) {
      setSelectedTaskForDetail(updated);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<PartnerTask>) => {
    await updatePartnerTask(taskId, companyId, updates);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    if (selectedTaskForDetail?.id === taskId) {
      setSelectedTaskForDetail(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await deletePartnerTask(taskId, companyId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (selectedTaskForDetail?.id === taskId) {
      setSelectedTaskForDetail(null);
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (confirm(`Deseja realmente excluir o setor "${categoryName}"? As tarefas vinculadas a ele ficarão na área Geral.`)) {
      await deleteTaskCategory(categoryId, companyId);
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      setTasks(prev => prev.map(t => t.category_id === categoryId ? { ...t, category_id: null } : t));
    }
  };

  const openNewTaskForPartner = (partnerId: string, categoryId?: string) => {
    setModalDefaultPartnerId(partnerId);
    setModalDefaultCategoryId(categoryId);
    setIsTaskModalOpen(true);
  };

  const openNewCategoryForPartner = (partnerId: string) => {
    setModalDefaultPartnerId(partnerId);
    setIsCategoryModalOpen(true);
  };

  // Contadores
  const totalCompletedCount = tasks.filter(t => t.status === 'CONCLUIDA').length;
  const activeCountGabriel = tasks.filter(t => t.assigned_partner_id === gabrielPartner?.id && t.status !== 'CONCLUIDA').length;
  const activeCountEduardo = tasks.filter(t => t.assigned_partner_id === eduardoPartner?.id && t.status !== 'CONCLUIDA').length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#08080a] p-4 sm:p-6 lg:p-8 space-y-7 text-white custom-scrollbar">
      
      {/* ━━━ CABEÇALHO MODERNO & RESPIRO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <CheckSquare className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                <span>QG de Tarefas & Operações</span>
                <span className="text-[10px] bg-white/10 text-white border border-white/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
                  SÓCIOS
                </span>
              </h1>
              <p className="text-xs text-white/50 mt-0.5 font-normal">
                Painel espelhado de execução diária, alinhamento estratégico e demandas dos sócios.
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          {/* Alternador de Filtro Limpo */}
          <div className="flex items-center bg-[#121216] border border-white/10 rounded-xl p-1 text-xs">
            <button
              onClick={() => setFilterMode('ATIVAS')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === 'ATIVAS' 
                  ? 'bg-white/15 text-white shadow-sm' 
                  : 'text-white/40 hover:text-white'
              }`}
            >
              Em Aberto
            </button>
            <button
              onClick={() => setFilterMode('CONCLUIDAS')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === 'CONCLUIDAS' 
                  ? 'bg-white/15 text-white shadow-sm' 
                  : 'text-white/40 hover:text-white'
              }`}
            >
              Concluídas ({totalCompletedCount})
            </button>
            <button
              onClick={() => setFilterMode('TODAS')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === 'TODAS' 
                  ? 'bg-white/15 text-white shadow-sm' 
                  : 'text-white/40 hover:text-white'
              }`}
            >
              Todas
            </button>
          </div>

          {/* Botão Novo Bloco */}
          <button
            onClick={() => {
              setModalDefaultPartnerId(undefined);
              setIsCategoryModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/15 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            <FolderPlus className="size-4 text-white/80" />
            <span>+ Novo Setor</span>
          </button>

          {/* Botão Nova Tarefa */}
          <button
            onClick={() => {
              setModalDefaultPartnerId(undefined);
              setModalDefaultCategoryId(undefined);
              setIsTaskModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-black font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.35)] active:scale-95 cursor-pointer"
          >
            <Plus className="size-4 stroke-[3]" />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </header>

      {/* ━━━ VISÃO ESPELHO RESPIRÁVEL (50% / 50%) ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 items-start">
        
        {/* 👤 COLUNA: GABRIEL */}
        {gabrielPartner && (
          <ModernPartnerColumn
            partner={gabrielPartner}
            badgeArea="Marketing & Vendas"
            activeTasksCount={activeCountGabriel}
            categories={categories.filter(c => c.partner_id === gabrielPartner.id)}
            tasks={filteredTasks.filter(t => t.assigned_partner_id === gabrielPartner.id)}
            allPartners={partners}
            allCategories={categories}
            onToggleStatus={handleToggleStatus}
            onDeleteTask={handleDeleteTask}
            onDeleteCategory={handleDeleteCategory}
            onAddTask={(catId) => openNewTaskForPartner(gabrielPartner.id, catId)}
            onAddCategory={() => openNewCategoryForPartner(gabrielPartner.id)}
            onOpenDetail={(task) => setSelectedTaskForDetail(task)}
          />
        )}

        {/* 👤 COLUNA: EDUARDO */}
        {eduardoPartner && (
          <ModernPartnerColumn
            partner={eduardoPartner}
            badgeArea="Construção do Sistema"
            activeTasksCount={activeCountEduardo}
            categories={categories.filter(c => c.partner_id === eduardoPartner.id)}
            tasks={filteredTasks.filter(t => t.assigned_partner_id === eduardoPartner.id)}
            allPartners={partners}
            allCategories={categories}
            onToggleStatus={handleToggleStatus}
            onDeleteTask={handleDeleteTask}
            onDeleteCategory={handleDeleteCategory}
            onAddTask={(catId) => openNewTaskForPartner(eduardoPartner.id, catId)}
            onAddCategory={() => openNewCategoryForPartner(eduardoPartner.id)}
            onOpenDetail={(task) => setSelectedTaskForDetail(task)}
          />
        )}

      </div>

      {/* ━━━ MODAIS DO SISTEMA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      
      {/* 1. Modal Detalhes & Descrição Completa */}
      <TaskDetailModal
        task={selectedTaskForDetail}
        isOpen={!!selectedTaskForDetail}
        onClose={() => setSelectedTaskForDetail(null)}
        category={categories.find(c => c.id === selectedTaskForDetail?.category_id)}
        assignedPartnerName={partners.find(p => p.id === selectedTaskForDetail?.assigned_partner_id)?.name}
        creatorPartnerName={partners.find(p => p.id === selectedTaskForDetail?.created_by_partner_id)?.name}
        onToggleStatus={handleToggleStatus}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />

      {/* 2. Modal Nova Tarefa */}
      <NewTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        companyId={companyId}
        partners={partners}
        categories={categories}
        defaultAssignedPartnerId={modalDefaultPartnerId}
        defaultCategoryId={modalDefaultCategoryId}
        onTaskCreated={(newTask) => setTasks(prev => [newTask, ...prev])}
      />

      {/* 3. Modal Novo Bloco / Setor */}
      <NewCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        companyId={companyId}
        partners={partners}
        defaultPartnerId={modalDefaultPartnerId}
        onCategoryCreated={(newCat) => setCategories(prev => [...prev, newCat])}
      />
    </div>
  );
}

// ── SUB-COMPONENTE: COLUNA DO SÓCIO COM DESIGN LIMPO & LEVE ──

interface ModernPartnerColumnProps {
  partner: Partner;
  badgeArea: string;
  activeTasksCount: number;
  categories: TaskCategory[];
  tasks: PartnerTask[];
  allPartners: Partner[];
  allCategories: TaskCategory[];
  onToggleStatus: (task: PartnerTask) => void;
  onDeleteTask: (taskId: string) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
  onAddTask: (categoryId?: string) => void;
  onAddCategory: () => void;
  onOpenDetail: (task: PartnerTask) => void;
}

function ModernPartnerColumn({
  partner,
  badgeArea,
  activeTasksCount,
  categories,
  tasks,
  allPartners,
  allCategories,
  onToggleStatus,
  onDeleteTask,
  onDeleteCategory,
  onAddTask,
  onAddCategory,
  onOpenDetail,
}: ModernPartnerColumnProps) {
  const unassignedTasks = tasks.filter(t => !t.category_id || !categories.some(c => c.id === t.category_id));

  return (
    <div className="space-y-6">
      {/* Card do Perfil do Sócio (Arejado e Elegante) */}
      <div className="bg-[#101014] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/15 flex items-center justify-center font-black text-xl text-white shadow-inner">
            {partner.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-white tracking-tight">{partner.name}</h2>
              <span className="text-[10px] bg-white/10 text-white/75 border border-white/15 px-2.5 py-0.5 rounded-full font-bold">
                {badgeArea}
              </span>
            </div>
            <p className="text-xs text-white/40 mt-1 font-medium">
              {activeTasksCount === 0 ? (
                <span className="text-emerald-400 font-semibold">Tudo zerado por aqui! 🎉</span>
              ) : (
                <span>{activeTasksCount} {activeTasksCount === 1 ? 'demanda pendente' : 'demandas pendentes'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Botão Rápido de Adicionar Tarefa */}
        <button
          onClick={() => onAddTask()}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl border border-white/15 transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          <Plus className="size-3.5 stroke-[3]" />
          <span>+ Tarefa</span>
        </button>
      </div>

      {/* Lista de Setores e Tarefas */}
      <div className="space-y-6">
        {categories.map((category) => {
          const catTasks = tasks.filter(t => t.category_id === category.id);

          return (
            <div key={category.id} className="space-y-3">
              {/* Header do Setor (Leve, sem caixas aninhadas pesadas) */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div 
                    className="size-2.5 rounded-full" 
                    style={{ backgroundColor: category.color }} 
                  />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">
                    {category.name}
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.2 rounded-md">
                    {catTasks.length}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onAddTask(category.id)}
                    className="p-1 rounded-lg text-white/40 hover:text-emerald-400 hover:bg-white/5 transition-colors cursor-pointer"
                    title={`Adicionar tarefa em ${category.name}`}
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteCategory(category.id, category.name)}
                    className="p-1 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Excluir este setor"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Lista de Cards da Categoria */}
              {catTasks.length > 0 ? (
                <div className="space-y-3">
                  {catTasks.map((task) => {
                    const creator = allPartners.find(p => p.id === task.created_by_partner_id);
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        category={category}
                        creatorName={creator?.name}
                        assignedName={partner.name}
                        onToggleStatus={onToggleStatus}
                        onDelete={onDeleteTask}
                        onOpenDetail={onOpenDetail}
                      />
                    );
                  })}
                </div>
              ) : (
                /* Item vazio sutil e discreto (sem caixa gigante agoniante) */
                <button
                  onClick={() => onAddTask(category.id)}
                  className="w-full py-2.5 px-4 rounded-xl border border-dashed border-white/5 hover:border-white/15 text-left text-xs text-white/30 hover:text-white/60 hover:bg-white/[0.02] transition-all flex items-center justify-between cursor-pointer"
                >
                  <span className="italic">Nenhuma tarefa pendente neste setor</span>
                  <span className="text-[11px] font-semibold text-emerald-400/80 hover:text-emerald-400">+ Adicionar</span>
                </button>
              )}
            </div>
          );
        })}

        {/* Tarefas Gerais (Sem Setor) */}
        {unassignedTasks.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 px-1">
              <Layers className="size-3.5 text-white/40" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                Geral / Outras Demandas
              </h3>
              <span className="text-[10px] font-mono font-bold text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.2 rounded-md">
                {unassignedTasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {unassignedTasks.map((task) => {
                const creator = allPartners.find(p => p.id === task.created_by_partner_id);
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    creatorName={creator?.name}
                    assignedName={partner.name}
                    onToggleStatus={onToggleStatus}
                    onDelete={onDeleteTask}
                    onOpenDetail={onOpenDetail}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Botão de Adicionar Novo Setor ao Sócio */}
        <button
          onClick={onAddCategory}
          className="w-full py-3 rounded-2xl border border-dashed border-white/10 hover:border-purple-500/40 text-xs font-bold text-white/40 hover:text-purple-300 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
        >
          <FolderPlus className="size-3.5 text-purple-400" />
          <span>Criar Novo Setor para {partner.name}</span>
        </button>
      </div>
    </div>
  );
}
