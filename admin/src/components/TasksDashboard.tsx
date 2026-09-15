import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, Plus, FolderPlus, Sparkles, Filter, 
  CheckCircle2, Clock, AlertCircle, RefreshCw, Layers,
  Trash2, User, ChevronRight, Inbox
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchPartners, type Partner } from '../lib/partners';
import { 
  fetchPartnerTasks, fetchTaskCategories, deleteTaskCategory, 
  deletePartnerTask, toggleTaskStatus,
  type PartnerTask, type TaskCategory 
} from '../lib/tasks';
import { TaskCard } from './tasks/TaskCard';
import { NewTaskModal } from './tasks/NewTaskModal';
import { NewCategoryModal } from './tasks/NewCategoryModal';

export default function TasksDashboard() {
  const { company } = useAuth();
  const companyId = company?.id || '';

  const [partners, setPartners] = useState<Partner[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [tasks, setTasks] = useState<PartnerTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filterMode, setFilterMode] = useState<'ATIVAS' | 'CONCLUIDAS' | 'TODAS'>('ATIVAS');

  // Modais
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [modalDefaultPartnerId, setModalDefaultPartnerId] = useState<string | undefined>(undefined);
  const [modalDefaultCategoryId, setModalDefaultCategoryId] = useState<string | undefined>(undefined);

  // Carregar Dados
  const loadAllData = async () => {
    if (!companyId) return;
    try {
      setLoading(true);

      // 1. Sócios
      const loadedPartners = await fetchPartners(companyId);
      const activePartners = loadedPartners.filter(p => p.is_active !== false);
      setPartners(activePartners);

      // 2. Categorias / Blocos
      const loadedCategories = await fetchTaskCategories(companyId, activePartners);
      setCategories(loadedCategories);

      // 3. Tarefas
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

  // Supabase Realtime Subscription para sincronia instantânea entre Gabriel e Eduardo
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

  // Identificar Sócios Específicos
  const gabrielPartner = useMemo(() => {
    return partners.find(p => p.name.toLowerCase().includes('gabriel')) || partners[0];
  }, [partners]);

  const eduardoPartner = useMemo(() => {
    return partners.find(p => p.name.toLowerCase().includes('eduardo')) || partners[1] || partners[0];
  }, [partners]);

  // Filtragem de Tarefas por Status
  const filteredTasks = useMemo(() => {
    if (filterMode === 'ATIVAS') {
      return tasks.filter(t => t.status !== 'CONCLUIDA');
    }
    if (filterMode === 'CONCLUIDAS') {
      return tasks.filter(t => t.status === 'CONCLUIDA');
    }
    return tasks;
  }, [tasks, filterMode]);

  // Handlers de Ações
  const handleToggleStatus = async (task: PartnerTask) => {
    const updated = await toggleTaskStatus(task, companyId);
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
  };

  const handleDeleteTask = async (taskId: string) => {
    await deletePartnerTask(taskId, companyId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (confirm(`Deseja realmente excluir o bloco "${categoryName}"? As tarefas vinculadas a ele ficarão na área Geral.`)) {
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

  // Contadores Rápidos
  const activeCountGabriel = tasks.filter(t => t.assigned_partner_id === gabrielPartner?.id && t.status !== 'CONCLUIDA').length;
  const activeCountEduardo = tasks.filter(t => t.assigned_partner_id === eduardoPartner?.id && t.status !== 'CONCLUIDA').length;
  const totalCompletedCount = tasks.filter(t => t.status === 'CONCLUIDA').length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 space-y-6 text-white custom-scrollbar">
      {/* ━━━ HEADER PRINCIPAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckSquare className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>QG de Tarefas & Operações</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                  SÓCIOS
                </span>
              </h1>
              <p className="text-xs text-white/50 mt-0.5">
                Painel espelhado de demandas operacionais, metas por setor e execução diária.
              </p>
            </div>
          </div>
        </div>

        {/* Ações Globais e Filtro */}
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          {/* Alternador de Filtro */}
          <div className="flex items-center bg-black/40 border border-white/15 rounded-xl p-1 text-xs">
            <button
              onClick={() => setFilterMode('ATIVAS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === 'ATIVAS' 
                  ? 'bg-white/15 text-white shadow-sm' 
                  : 'text-white/40 hover:text-white'
              }`}
            >
              Em Aberto
            </button>
            <button
              onClick={() => setFilterMode('CONCLUIDAS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === 'CONCLUIDAS' 
                  ? 'bg-white/15 text-emerald-300 shadow-sm' 
                  : 'text-white/40 hover:text-white'
              }`}
            >
              Concluídas ({totalCompletedCount})
            </button>
            <button
              onClick={() => setFilterMode('TODAS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
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
            className="inline-flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <FolderPlus className="size-4" />
            <span>+ Novo Bloco</span>
          </button>

          {/* Botão Nova Tarefa */}
          <button
            onClick={() => {
              setModalDefaultPartnerId(undefined);
              setModalDefaultCategoryId(undefined);
              setIsTaskModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="size-4 stroke-[3]" />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </header>

      {/* ━━━ VISÃO ESPELHO (LADO A LADO: GABRIEL VS EDUARDO) ━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 items-start">
        
        {/* 👤 COLUNA ESQUERDA: GABRIEL */}
        {gabrielPartner && (
          <PartnerColumn
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
          />
        )}

        {/* 👤 COLUNA DIREITA: EDUARDO */}
        {eduardoPartner && (
          <PartnerColumn
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
          />
        )}

      </div>

      {/* ━━━ MODAIS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
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

// ── SUB-COMPONENTE: COLUNA DO SÓCIO COM SEUS BLOCOS ──

interface PartnerColumnProps {
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
}

function PartnerColumn({
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
}: PartnerColumnProps) {
  // Tarefas sem categoria vinculada
  const unassignedCategoryTasks = tasks.filter(t => !t.category_id || !categories.some(c => c.id === t.category_id));

  return (
    <div className="bg-[#0b0b0d] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl">
      {/* Header do Sócio */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/15 flex items-center justify-center font-black text-lg text-white shadow-inner">
            {partner.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">{partner.name}</h2>
              <span className="text-[10px] bg-white/10 text-white/70 border border-white/15 px-2 py-0.5 rounded-full font-bold">
                {badgeArea}
              </span>
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              {activeTasksCount} {activeTasksCount === 1 ? 'demanda pendente' : 'demandas pendentes'}
            </p>
          </div>
        </div>

        {/* Botão Rápido de Adicionar Tarefa para Este Sócio */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAddTask()}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl border border-white/15 transition-all cursor-pointer"
            title={`Adicionar tarefa para ${partner.name}`}
          >
            <Plus className="size-3.5" />
            <span>+ Tarefa</span>
          </button>
        </div>
      </div>

      {/* Blocos de Setores do Sócio */}
      <div className="space-y-6">
        {categories.map((category) => {
          const categoryTasks = tasks.filter(t => t.category_id === category.id);

          return (
            <div 
              key={category.id} 
              className="bg-black/40 border border-white/5 rounded-2xl p-4 sm:p-5 space-y-4 hover:border-white/10 transition-colors"
            >
              {/* Header do Bloco / Setor */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="size-3.5 rounded-md" 
                    style={{ backgroundColor: category.color }} 
                  />
                  <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span>{category.name}</span>
                    <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full font-mono font-bold">
                      {categoryTasks.length}
                    </span>
                  </h3>
                </div>

                {/* Ações do Bloco */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onAddTask(category.id)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    title={`Adicionar tarefa em ${category.name}`}
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteCategory(category.id, category.name)}
                    className="p-1.5 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Excluir este bloco"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Lista de Tarefas do Bloco */}
              {categoryTasks.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-white/5 rounded-xl bg-black/20">
                  <p className="text-xs text-white/30 italic">Nenhuma tarefa pendente neste bloco.</p>
                  <button
                    onClick={() => onAddTask(category.id)}
                    className="mt-2 text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    + Adicionar a primeira tarefa
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {categoryTasks.map((task) => {
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
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Bloco: Geral / Sem Bloco Especificado */}
        {unassignedCategoryTasks.length > 0 && (
          <div className="bg-black/30 border border-dashed border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-white/40" />
                <h3 className="text-sm font-bold text-white/70">Demandas Gerais (Sem Bloco)</h3>
                <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full font-mono">
                  {unassignedCategoryTasks.length}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {unassignedCategoryTasks.map((task) => {
                const creator = allPartners.find(p => p.id === task.created_by_partner_id);
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    creatorName={creator?.name}
                    assignedName={partner.name}
                    onToggleStatus={onToggleStatus}
                    onDelete={onDeleteTask}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Botão de Rodapé para Criar Novo Bloco */}
        <button
          onClick={onAddCategory}
          className="w-full py-3.5 border border-dashed border-white/15 hover:border-purple-500/40 rounded-2xl text-xs font-bold text-white/50 hover:text-purple-300 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <FolderPlus className="size-4 text-purple-400" />
          <span>Criar Novo Bloco para {partner.name}</span>
        </button>
      </div>
    </div>
  );
}
