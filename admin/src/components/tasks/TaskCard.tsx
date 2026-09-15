import React from 'react';
import { 
  CheckCircle2, Circle, Clock, Trash2, User, 
  Tag, Calendar, AlertCircle, ArrowUpRight, ExternalLink
} from 'lucide-react';
import type { PartnerTask, TaskCategory, TaskPriority } from '../../lib/tasks';

interface TaskCardProps {
  task: PartnerTask;
  category?: TaskCategory;
  creatorName?: string;
  assignedName?: string;
  onToggleStatus: (task: PartnerTask) => void;
  onDelete: (taskId: string) => void;
  onOpenDetail: (task: PartnerTask) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  category,
  creatorName,
  assignedName,
  onToggleStatus,
  onDelete,
  onOpenDetail,
}) => {
  const isCompleted = task.status === 'CONCLUIDA';
  const isInProgress = task.status === 'EM_ANDAMENTO';

  // Badge de Prioridade
  const priorityConfig: Record<TaskPriority, { label: string; badgeClass: string; dotClass: string }> = {
    ALTA: {
      label: 'Alta',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      dotClass: 'bg-rose-500'
    },
    MEDIA: {
      label: 'Média',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-500'
    },
    BAIXA: {
      label: 'Baixa',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500'
    }
  };

  const currentPriority = priorityConfig[task.priority] || priorityConfig.MEDIA;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Deseja realmente excluir a tarefa "${task.title}"?`)) {
      onDelete(task.id);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStatus(task);
  };

  return (
    <div 
      onClick={() => onOpenDetail(task)}
      className={`group relative rounded-2xl border transition-all duration-200 cursor-pointer select-none p-4 sm:p-5 ${
        isCompleted 
          ? 'bg-black/25 border-white/5 opacity-55 hover:opacity-80' 
          : isInProgress
          ? 'bg-[#12131a] border-cyan-500/40 shadow-lg shadow-cyan-950/20 hover:border-cyan-500/60'
          : 'bg-[#121215] border-white/10 hover:border-white/25 hover:bg-[#17171c] shadow-md hover:shadow-xl'
      }`}
    >
      {/* Topo do Card: Categoria, Prioridade, Status e Ações */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {/* Tag de Categoria */}
          {category && (
            <span 
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border truncate"
              style={{
                backgroundColor: `${category.color}15`,
                color: category.color,
                borderColor: `${category.color}35`
              }}
            >
              <Tag className="size-2.5 shrink-0" />
              <span className="truncate max-w-[130px]">{category.name}</span>
            </span>
          )}

          {/* Prioridade */}
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase border ${currentPriority.badgeClass}`}>
            <span className={`size-1.5 rounded-full ${currentPriority.dotClass}`} />
            {currentPriority.label}
          </span>

          {/* Status Em Andamento */}
          {isInProgress && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-wide">
              <Clock className="size-2.5" /> Fazendo
            </span>
          )}
        </div>

        {/* Botão de Excluir */}
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 p-1.5 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Excluir tarefa"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Meio: Checkbox + Título */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={handleToggle}
          className="mt-0.5 shrink-0 text-white/40 hover:text-emerald-400 transition-colors cursor-pointer"
          title={isCompleted ? "Reabrir tarefa" : isInProgress ? "Concluir tarefa" : "Iniciar tarefa"}
        >
          {isCompleted ? (
            <CheckCircle2 className="size-5 text-emerald-400 fill-emerald-500/20" />
          ) : isInProgress ? (
            <Clock className="size-5 text-cyan-400 animate-pulse" />
          ) : (
            <Circle className="size-5 hover:border-emerald-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <h4 className={`text-sm sm:text-[15px] font-bold leading-snug break-words ${
            isCompleted ? 'line-through text-white/40' : 'text-white group-hover:text-emerald-300'
          }`}>
            {task.title}
          </h4>

          {/* Preview da Descrição com proteção anti-overflow (break-words + line-clamp) */}
          {task.description && (
            <p className="text-xs text-white/55 leading-relaxed mt-2 line-clamp-2 break-words overflow-hidden font-normal">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Rodapé do Card: Criador, Prazo e Link Ler Mais */}
      <div className="mt-3.5 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 gap-2">
        <div className="flex items-center gap-2 truncate">
          {creatorName && creatorName !== assignedName ? (
            <span className="flex items-center gap-1 truncate text-white/50">
              <User className="size-3 shrink-0 text-white/30" />
              <span className="truncate">Por <strong className="text-white/70 font-semibold">{creatorName}</strong></span>
            </span>
          ) : (
            <span className="text-white/30 truncate">
              {new Date(task.created_at).toLocaleDateString('pt-BR')}
            </span>
          )}

          {task.due_date && (
            <span className="font-mono text-amber-400/90 font-semibold flex items-center gap-1 shrink-0">
              <Calendar className="size-3" />
              {new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>

        {/* Botão sutil "Abrir / Ver detalhes" */}
        <span className="shrink-0 text-[11px] font-bold text-white/30 group-hover:text-emerald-400 transition-colors flex items-center gap-0.5">
          <span>Ver detalhes</span>
          <ArrowUpRight className="size-3" />
        </span>
      </div>
    </div>
  );
};
