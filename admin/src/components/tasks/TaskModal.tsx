import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, CheckCircle2, AlertTriangle, Sparkles, 
  Calendar, User, CheckSquare, Bug, Package, DollarSign, Target, Clock
} from 'lucide-react';
import type { 
  CompanyTask, 
  TaskCategory, 
  TaskPriority, 
  TaskStatus, 
  TaskSubtask,
} from '@/lib/companyTasks';
import { 
  TASK_CATEGORY_CONFIG, 
  TASK_PRIORITY_CONFIG 
} from '@/lib/companyTasks';

interface TaskModalProps {
  isOpen: boolean;
  taskToEdit?: CompanyTask | null;
  defaultStatus?: TaskStatus;
  onClose: () => void;
  onSave: (taskData: Omit<CompanyTask, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

export function TaskModal({
  isOpen,
  taskToEdit,
  defaultStatus = 'PENDENTE',
  onClose,
  onSave
}: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('GERAL');
  const [priority, setPriority] = useState<TaskPriority>('MEDIA');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [assignedTo, setAssignedTo] = useState<string>('Ambos');
  const [createdByName, setCreatedByName] = useState<string>('Eduardo');
  const [dueDate, setDueDate] = useState<string>('');
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setCategory(taskToEdit.category);
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setAssignedTo(taskToEdit.assigned_to || 'Ambos');
      setCreatedByName(taskToEdit.created_by_name || 'Eduardo');
      setDueDate(taskToEdit.due_date || '');
      setSubtasks(taskToEdit.subtasks || []);
    } else {
      setTitle('');
      setDescription('');
      setCategory('GERAL');
      setPriority('MEDIA');
      setStatus(defaultStatus);
      setAssignedTo('Ambos');
      setCreatedByName('Eduardo');
      setDueDate('');
      setSubtasks([]);
    }
  }, [taskToEdit, defaultStatus, isOpen]);

  if (!isOpen) return null;

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const item: TaskSubtask = {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      title: newSubtaskTitle.trim(),
      completed: false
    };
    setSubtasks([...subtasks, item]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Por favor, informe um título objetivo para a tarefa.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        company_id: taskToEdit?.company_id || '',
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status,
        assigned_to: assignedTo,
        assigned_name: assignedTo,
        created_by_name: createdByName,
        due_date: dueDate || null,
        subtasks
      });
      onClose();
    } catch (err: any) {
      alert('Erro ao salvar tarefa: ' + (err?.message || 'Falha de comunicação'));
    } finally {
      setSaving(false);
    }
  };

  const categories: Array<{ id: TaskCategory; label: string; icon: any }> = [
    { id: 'BUG', label: '🐛 Bug / Erro', icon: Bug },
    { id: 'MELHORIA', label: '🚀 Melhoria', icon: Sparkles },
    { id: 'OPERACIONAL', label: '📦 Estoque / Operação', icon: Package },
    { id: 'FINANCEIRO', label: '💰 Financeiro', icon: DollarSign },
    { id: 'GERAL', label: '🎯 Geral', icon: Target },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#0e0e10] border border-white/15 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-[#141416]/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckSquare className="size-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {taskToEdit ? 'Editar Tarefa' : 'Nova Tarefa da Empresa'}
              </h3>
              <p className="text-xs text-white/50">
                Alinhamento entre sócios · Sincronização em tempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Formulário com Scroll Suave */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
              <span>Título da Tarefa</span>
              <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Corrigir erro no cálculo de frete ou Planejar compra de pods..."
              className="w-full bg-[#161618] border border-white/10 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none transition-all"
            />
          </div>

          {/* Categoria (Seleção Visual) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/80 uppercase tracking-wider">
              Categoria / Tipo de Tarefa
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((cat) => {
                const isSelected = category === cat.id;
                const cfg = TASK_CATEGORY_CONFIG[cat.id];
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                      isSelected
                        ? `${cfg.badge} shadow-md shadow-emerald-500/10 scale-[1.02]`
                        : 'bg-[#141416] border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prioridade & Responsável (Linha Dupla) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Prioridade */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/80 uppercase tracking-wider">
                Prioridade
              </label>
              <div className="flex items-center gap-2">
                {(['BAIXA', 'MEDIA', 'URGENTE'] as TaskPriority[]).map((p) => {
                  const isSelected = priority === p;
                  const cfg = TASK_PRIORITY_CONFIG[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? `${cfg.badge} shadow-sm`
                          : 'bg-[#141416] border-white/5 text-white/50 hover:text-white'
                      }`}
                    >
                      <div className={`size-2 rounded-full ${cfg.dotColor}`} />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Atribuído a (Sócio) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                <User className="size-3.5 text-white/50" />
                <span>Responsável</span>
              </label>
              <div className="flex items-center gap-2">
                {[
                  { id: 'Eduardo', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                  { id: 'Gabriel', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
                  { id: 'Ambos', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
                ].map((resp) => {
                  const isSelected = assignedTo === resp.id;
                  return (
                    <button
                      key={resp.id}
                      type="button"
                      onClick={() => setAssignedTo(resp.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? `${resp.color} font-black shadow-sm`
                          : 'bg-[#141416] border-white/5 text-white/50 hover:text-white'
                      }`}
                    >
                      {resp.id}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Status Inicial & Prazo Opcional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/80 uppercase tracking-wider">
                Status / Fase
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-[#161618] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              >
                <option value="PENDENTE">📋 A Fazer (Pendente)</option>
                <option value="EM_ANDAMENTO">⚡ Em Andamento</option>
                <option value="REVISAO">⏳ Em Revisão / Teste</option>
                <option value="CONCLUIDO">✅ Concluído</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="size-3.5 text-white/50" />
                <span>Prazo / Data Limite (Opcional)</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#161618] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
              >
              </input>
            </div>
          </div>

          {/* Descrição Detalhada */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/80 uppercase tracking-wider">
              Descrição e Contexto da Tarefa
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva detalhadamente o que precisa ser feito, o erro encontrado, ou as decisões alinhadas com o sócio..."
              className="w-full bg-[#161618] border border-white/10 focus:border-emerald-500/50 rounded-xl p-3.5 text-xs text-white placeholder:text-white/30 focus:outline-none transition-all leading-relaxed custom-scrollbar"
            />
          </div>

          {/* Checklist de Subtarefas */}
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="size-3.5 text-emerald-400" />
                <span>Checklist de Subtarefas ({subtasks.filter(s => s.completed).length}/{subtasks.length})</span>
              </label>
            </div>

            {/* Input para adicionar nova subtarefa */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="Adicionar passo ou checklist (ex: Testar no mobile)..."
                className="flex-1 bg-[#161618] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="size-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            {/* Lista de subtarefas criadas */}
            {subtasks.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pt-1">
                {subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#141416] border border-white/5 group hover:border-white/10 transition-all"
                  >
                    <div 
                      onClick={() => handleToggleSubtask(sub.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                    >
                      <div className={`size-4 rounded border flex items-center justify-center transition-colors ${
                        sub.completed ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/30 bg-transparent'
                      }`}>
                        {sub.completed && <CheckCircle2 className="size-3.5 stroke-[3]" />}
                      </div>
                      <span className={`text-xs truncate ${sub.completed ? 'line-through text-white/40' : 'text-white/80'}`}>
                        {sub.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(sub.id)}
                      className="text-white/30 hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer com Ações */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-[#141416]/70 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <span>Salvando...</span>
            ) : (
              <>
                <CheckSquare className="size-4 stroke-[2.5]" />
                <span>{taskToEdit ? 'Salvar Alterações' : 'Criar Tarefa'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
