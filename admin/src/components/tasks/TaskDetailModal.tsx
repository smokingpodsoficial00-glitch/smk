import React from 'react';
import { 
  X, CheckCircle2, Clock, Calendar, User, Edit3, Trash2, 
  ArrowRight, ArrowLeft, CheckSquare, Sparkles, AlertCircle
} from 'lucide-react';
import type { 
  CompanyTask, 
  TaskStatus, 
} from '@/lib/companyTasks';
import { 
  TASK_CATEGORY_CONFIG, 
  TASK_PRIORITY_CONFIG, 
  TASK_STATUS_COLUMNS 
} from '@/lib/companyTasks';

interface TaskDetailModalProps {
  task: CompanyTask | null;
  onClose: () => void;
  onEdit: (task: CompanyTask) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

export function TaskDetailModal({
  task,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleSubtask
}: TaskDetailModalProps) {
  if (!task) return null;

  const catConfig = TASK_CATEGORY_CONFIG[task.category];
  const prioConfig = TASK_PRIORITY_CONFIG[task.priority];
  const currentStatusCol = TASK_STATUS_COLUMNS.find(c => c.id === task.status);

  const completedSubtasksCount = task.subtasks.filter(s => s.completed).length;
  const totalSubtasks = task.subtasks.length;
  const progressPercent = totalSubtasks > 0 
    ? Math.round((completedSubtasksCount / totalSubtasks) * 100) 
    : 0;

  const partnerBadgeColor = 
    task.assigned_to === 'Eduardo' 
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : task.assigned_to === 'Gabriel'
      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
      : 'bg-purple-500/20 text-purple-300 border-purple-500/40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#0e0e10] border border-white/15 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com Badges e Ações Rápidas */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-4 bg-[#141416]/60 shrink-0">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* Badge de Categoria */}
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${catConfig.badge}`}>
                {catConfig.icon} {catConfig.label}
              </span>

              {/* Badge de Prioridade */}
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${prioConfig.badge}`}>
                <div className={`size-1.5 rounded-full ${prioConfig.dotColor}`} />
                <span>{prioConfig.label}</span>
              </span>

              {/* Badge de Responsável */}
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${partnerBadgeColor}`}>
                <User className="size-3" />
                <span>{task.assigned_to}</span>
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
              {task.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="size-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Corpo com Informações e Checklist */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
          {/* Seletor Rápido de Status (Fases) */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
              Movimentar Fase da Tarefa
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TASK_STATUS_COLUMNS.map((col) => {
                const isActive = task.status === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => onStatusChange(task.id, col.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? `${col.badgeBg} border-emerald-500/50 shadow-md shadow-emerald-500/10 scale-[1.02]`
                        : 'bg-[#141416] border-white/5 text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{col.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descrição Completa */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
              Descrição e Detalhes
            </label>
            <div className="bg-[#141416] border border-white/10 rounded-2xl p-4 text-xs sm:text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
              {task.description ? (
                task.description
              ) : (
                <span className="text-white/30 italic">Nenhuma descrição detalhada informada.</span>
              )}
            </div>
          </div>

          {/* Checklist de Subtarefas com Progresso */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="size-3.5 text-emerald-400" />
                <span>Checklist de Resolução</span>
              </label>
              {totalSubtasks > 0 && (
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {completedSubtasksCount} de {totalSubtasks} ({progressPercent}%)
                </span>
              )}
            </div>

            {totalSubtasks > 0 ? (
              <div className="space-y-2">
                {/* Barra de Progresso Visual */}
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Lista de Itens do Checklist */}
                <div className="space-y-1.5 pt-1">
                  {task.subtasks.map((sub) => (
                    <div
                      key={sub.id}
                      onClick={() => onToggleSubtask(task.id, sub.id)}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-[#141416] border border-white/5 hover:border-white/15 cursor-pointer transition-all"
                    >
                      <div className={`size-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                        sub.completed ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/30 bg-transparent'
                      }`}>
                        {sub.completed && <CheckCircle2 className="size-3.5 stroke-[3]" />}
                      </div>
                      <span className={`text-xs sm:text-sm ${sub.completed ? 'line-through text-white/40' : 'text-white/90'}`}>
                        {sub.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-white/30 italic p-3 bg-[#141416]/50 rounded-xl border border-white/5">
                Nenhuma subtarefa no checklist.
              </div>
            )}
          </div>

          {/* Metadados: Prazo e Datas de Criação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs text-white/50">
            <div className="flex items-center gap-2">
              <Calendar className="size-3.5 text-white/40" />
              <span>Prazo de conclusão:</span>
              <span className="font-bold text-white/80 font-mono">
                {task.due_date ? task.due_date.split('-').reverse().join('/') : 'Sem prazo definido'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-white/40" />
              <span>Cadastrado por:</span>
              <span className="font-bold text-white/80">
                {task.created_by_name || 'Sócio'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer com Botões de Editar e Excluir */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-[#141416]/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Deseja realmente excluir a tarefa "${task.title}"?`)) {
                onDelete(task.id);
                onClose();
              }
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="size-3.5" />
            <span>Excluir</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onEdit(task);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="size-3.5" />
              <span>Editar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-xs font-bold transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
