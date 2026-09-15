import React, { useState } from 'react';
import { 
  CheckCircle2, Circle, Clock, Trash2, ChevronDown, 
  ChevronUp, User, Tag, Calendar, AlertCircle
} from 'lucide-react';
import type { PartnerTask, TaskCategory, TaskPriority } from '../../lib/tasks';

interface TaskCardProps {
  task: PartnerTask;
  category?: TaskCategory;
  creatorName?: string;
  assignedName?: string;
  onToggleStatus: (task: PartnerTask) => void;
  onDelete: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  category,
  creatorName,
  assignedName,
  onToggleStatus,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isCompleted = task.status === 'CONCLUIDA';
  const isInProgress = task.status === 'EM_ANDAMENTO';

  // Badge de Prioridade
  const priorityConfig: Record<TaskPriority, { label: string; badgeClass: string }> = {
    ALTA: {
      label: 'Prioridade Alta',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    },
    MEDIA: {
      label: 'Média',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    },
    BAIXA: {
      label: 'Baixa',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    }
  };

  const currentPriority = priorityConfig[task.priority] || priorityConfig.MEDIA;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Deseja realmente excluir a tarefa "${task.title}"?`)) {
      setIsDeleting(true);
      onDelete(task.id);
    }
  };

  return (
    <div 
      className={`group rounded-2xl border transition-all duration-200 ${
        isCompleted 
          ? 'bg-black/20 border-white/5 opacity-60' 
          : isInProgress
          ? 'bg-white/[0.04] border-cyan-500/30 shadow-lg shadow-cyan-950/20'
          : 'bg-[#111113] border-white/10 hover:border-white/20 shadow-md'
      } p-4 sm:p-5`}
    >
      {/* Linha Superior: Checkbox, Título, Prioridade e Ações */}
      <div className="flex items-start gap-3.5">
        {/* Botão de Status / Checkbox */}
        <button
          type="button"
          onClick={() => onToggleStatus(task)}
          className="mt-0.5 shrink-0 text-white/40 hover:text-emerald-400 transition-colors cursor-pointer"
          title={isCompleted ? "Reabrir tarefa" : isInProgress ? "Marcar como Concluída" : "Iniciar tarefa (Em Andamento)"}
        >
          {isCompleted ? (
            <CheckCircle2 className="size-5 text-emerald-400 fill-emerald-500/20" />
          ) : isInProgress ? (
            <Clock className="size-5 text-cyan-400 animate-pulse" />
          ) : (
            <Circle className="size-5 hover:border-emerald-400" />
          )}
        </button>

        {/* Título e Tags */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {/* Tag da Categoria / Setor */}
            {category && (
              <span 
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border"
                style={{
                  backgroundColor: `${category.color}15`,
                  color: category.color,
                  borderColor: `${category.color}40`
                }}
              >
                <Tag className="size-2.5" />
                {category.name}
              </span>
            )}

            {/* Badge de Prioridade */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase border ${currentPriority.badgeClass}`}>
              <AlertCircle className="size-2.5" />
              {currentPriority.label}
            </span>

            {/* Status Atual */}
            {isInProgress && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase tracking-wide">
                <Clock className="size-2.5" /> Em Andamento
              </span>
            )}
          </div>

          {/* Título Principal da Tarefa */}
          <h4 
            onClick={() => setExpanded(!expanded)}
            className={`text-sm sm:text-base font-bold leading-snug cursor-pointer transition-colors ${
              isCompleted 
                ? 'line-through text-white/40' 
                : 'text-white/95 group-hover:text-emerald-300'
            }`}
          >
            {task.title}
          </h4>

          {/* Delegação / Criador */}
          {creatorName && creatorName !== assignedName && (
            <p className="text-[11px] text-white/40 mt-1 flex items-center gap-1">
              <User className="size-3 text-white/30" />
              <span>Delegado por <strong className="text-white/70 font-semibold">{creatorName}</strong></span>
            </p>
          )}
        </div>

        {/* Botão de Excluir */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="shrink-0 p-1.5 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Excluir tarefa"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Descrição Detalhada (Espaçamento Generoso com Formatação Preservada) */}
      {task.description && (
        <div className="mt-3.5 pl-8.5">
          <div 
            onClick={() => setExpanded(!expanded)}
            className={`text-xs sm:text-sm text-white/70 leading-relaxed font-normal whitespace-pre-wrap rounded-xl p-3 bg-black/30 border border-white/5 cursor-pointer hover:border-white/10 transition-colors ${
              !expanded ? 'line-clamp-2' : ''
            }`}
          >
            {task.description}
          </div>

          {/* Botão Ver Mais / Ver Menos */}
          {task.description.length > 90 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-white/40 hover:text-white/80 transition-colors cursor-pointer"
            >
              {expanded ? (
                <>Recolher detalhes <ChevronUp className="size-3" /></>
              ) : (
                <>Ver descrição completa <ChevronDown className="size-3" /></>
              )}
            </button>
          )}
        </div>
      )}

      {/* Rodapé do Card: Data e Prazo */}
      <div className="mt-3.5 pl-8.5 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
        <span className="flex items-center gap-1">
          <Calendar className="size-3 text-white/30" />
          <span>Criada em {new Date(task.created_at).toLocaleDateString('pt-BR')}</span>
        </span>

        {task.due_date && (
          <span className="font-mono text-amber-400/80 font-semibold">
            Prazo: {new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
          </span>
        )}

        {isCompleted && task.completed_at && (
          <span className="text-emerald-400/80 font-medium">
            Concluída em {new Date(task.completed_at).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  );
};
