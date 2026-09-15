import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, Clock, Circle, Calendar, User, 
  Tag, AlertCircle, Trash2, Edit3, Save, ArrowRight
} from 'lucide-react';
import type { PartnerTask, TaskCategory, TaskPriority, TaskStatus } from '../../lib/tasks';

interface TaskDetailModalProps {
  task: PartnerTask | null;
  isOpen: boolean;
  onClose: () => void;
  category?: TaskCategory;
  assignedPartnerName?: string;
  creatorPartnerName?: string;
  onToggleStatus: (task: PartnerTask) => void;
  onUpdateTask: (taskId: string, updates: Partial<PartnerTask>) => void;
  onDeleteTask: (taskId: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  category,
  assignedPartnerName,
  creatorPartnerName,
  onToggleStatus,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIA');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'MEDIA');
      setDueDate(task.due_date || '');
      setIsEditing(false);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    onUpdateTask(task.id, {
      title: title.trim(),
      description: description.trim(),
      priority,
      due_date: dueDate || null,
    });
    setIsEditing(false);
  };

  const isCompleted = task.status === 'CONCLUIDA';
  const isInProgress = task.status === 'EM_ANDAMENTO';

  const priorityConfig: Record<TaskPriority, { label: string; badgeClass: string; dotClass: string }> = {
    ALTA: { label: 'Prioridade Alta', badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30', dotClass: 'bg-rose-500' },
    MEDIA: { label: 'Prioridade Média', badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dotClass: 'bg-amber-500' },
    BAIXA: { label: 'Prioridade Baixa', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dotClass: 'bg-emerald-500' },
  };

  const currPriority = priorityConfig[task.priority] || priorityConfig.MEDIA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#111114] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#16161a]">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Tag Categoria */}
            {category && (
              <span 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border"
                style={{
                  backgroundColor: `${category.color}18`,
                  color: category.color,
                  borderColor: `${category.color}40`,
                }}
              >
                <Tag className="size-3" />
                {category.name}
              </span>
            )}

            {/* Tag Prioridade */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${currPriority.badgeClass}`}>
              <div className={`size-1.5 rounded-full ${currPriority.dotClass} animate-pulse`} />
              {currPriority.label}
            </span>

            {/* Status Atual */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
              isCompleted 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : isInProgress
                ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                : 'bg-white/10 text-white/70 border-white/15'
            }`}>
              {isCompleted ? '✓ Concluída' : isInProgress ? '⏳ Em Andamento' : '⚪ Pendente'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isEditing 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                  : 'text-white/40 hover:text-white border-transparent hover:bg-white/5'
              }`}
              title={isEditing ? 'Cancelar edição' : 'Editar tarefa'}
            >
              <Edit3 className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo Principal do Modal */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Título */}
          {isEditing ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                Título da Tarefa
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#18181c] border border-white/20 rounded-xl px-4 py-3 text-base text-white font-bold focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          ) : (
            <div className="flex items-start gap-4">
              {/* Botão de Status Rápido */}
              <button
                onClick={() => onToggleStatus(task)}
                className="mt-1 shrink-0 p-1 text-white/40 hover:text-emerald-400 transition-colors cursor-pointer"
                title="Avançar status da tarefa"
              >
                {isCompleted ? (
                  <CheckCircle2 className="size-6 text-emerald-400 fill-emerald-500/20" />
                ) : isInProgress ? (
                  <Clock className="size-6 text-cyan-400 animate-pulse" />
                ) : (
                  <Circle className="size-6 hover:text-emerald-400" />
                )}
              </button>
              
              <div className="flex-1 min-w-0">
                <h2 className={`text-xl sm:text-2xl font-extrabold leading-snug break-words ${
                  isCompleted ? 'line-through text-white/40' : 'text-white'
                }`}>
                  {task.title}
                </h2>
              </div>
            </div>
          )}

          {/* Linha de Metadados: Responsável, Criador e Prazo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-black/40 border border-white/5 text-xs">
            <div>
              <span className="text-white/40 block mb-1 font-medium">Responsável:</span>
              <span className="text-white font-bold flex items-center gap-1.5">
                <User className="size-3.5 text-emerald-400" />
                {assignedPartnerName || 'Sócio'}
              </span>
            </div>

            <div>
              <span className="text-white/40 block mb-1 font-medium">Criado por:</span>
              <span className="text-white/80 font-semibold">
                {creatorPartnerName || 'Não especificado'}
              </span>
            </div>

            <div>
              <span className="text-white/40 block mb-1 font-medium">Prazo Estimado:</span>
              <span className="font-mono text-amber-400/90 font-bold flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem prazo definido'}
              </span>
            </div>
          </div>

          {/* Edição de Prioridade e Prazo se estiver em modo de edição */}
          {isEditing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                  Prioridade
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full bg-[#18181c] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="ALTA">🔴 Prioridade Alta</option>
                  <option value="MEDIA">🟡 Prioridade Média</option>
                  <option value="BAIXA">🟢 Prioridade Baixa</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                  Data Limite (Prazo)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-[#18181c] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          )}

          {/* Descrição Ampla com Word-Break e Formatação Rica */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white/60 flex items-center justify-between">
              <span>Descrição & Instruções da Tarefa</span>
              <span className="text-[11px] text-white/30 font-normal">Quebras de linha e links preservados</span>
            </label>

            {isEditing ? (
              <textarea
                rows={8}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#18181c] border border-white/20 rounded-2xl p-4 text-sm text-white font-normal leading-relaxed focus:outline-none focus:border-emerald-500/50 custom-scrollbar"
                placeholder="Insira as instruções detalhadas, referências ou links..."
              />
            ) : (
              <div className="p-5 sm:p-6 rounded-2xl bg-black/50 border border-white/10 text-sm text-white/90 leading-relaxed font-normal whitespace-pre-wrap break-words overflow-x-hidden min-h-[140px]">
                {task.description ? (
                  task.description
                ) : (
                  <span className="text-white/30 italic">Nenhuma descrição detalhada informada para esta tarefa.</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-t border-white/10 bg-[#16161a]">
          <button
            type="button"
            onClick={() => {
              if (confirm('Deseja realmente excluir esta tarefa permanentemente?')) {
                onDeleteTask(task.id);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
          >
            <Trash2 className="size-4" />
            <span>Excluir Tarefa</span>
          </button>

          <div className="flex items-center gap-3">
            {isEditing ? (
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-6 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <Save className="size-4" />
                <span>Salvar Alterações</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggleStatus(task)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg ${
                  isCompleted 
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                    : isInProgress
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold shadow-emerald-500/20'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold shadow-cyan-500/20'
                }`}
              >
                {isCompleted ? (
                  <>Reabrir Demanda</>
                ) : isInProgress ? (
                  <>Concluir Tarefa ✓</>
                ) : (
                  <>Iniciar Tarefa (Em Andamento) <ArrowRight className="size-4" /></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
