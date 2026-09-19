import React, { useState, useEffect } from 'react';
import { X, CheckSquare, AlertCircle, Calendar, User, Tag, AlignLeft } from 'lucide-react';
import { createPartnerTask, type PartnerTask, type TaskCategory, type TaskPriority } from '../../lib/tasks';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  partners: { id: string; name: string }[];
  categories: TaskCategory[];
  defaultAssignedPartnerId?: string;
  defaultCategoryId?: string;
  onTaskCreated: (task: PartnerTask) => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  companyId,
  partners,
  categories,
  defaultAssignedPartnerId,
  defaultCategoryId,
  onTaskCreated,
}) => {
  const [assignedPartnerId, setAssignedPartnerId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIA');
  const [createdByPartnerId, setCreatedByPartnerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initialPartner = defaultAssignedPartnerId || partners[0]?.id || '';
      setAssignedPartnerId(initialPartner);
      setCategoryId(defaultCategoryId || '');
      setCreatedByPartnerId(partners[0]?.id || '');
      setTitle('');
      setDescription('');
      setPriority('MEDIA');
      setDueDate('');
      setErrorMsg(null);
    }
  }, [isOpen, defaultAssignedPartnerId, defaultCategoryId, partners]);

  if (!isOpen) return null;

  // Filtrar categorias pertencentes ao sócio atualmente selecionado
  const partnerCategories = categories.filter(c => c.partner_id === assignedPartnerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Por favor, informe o título da tarefa.');
      return;
    }
    if (!assignedPartnerId) {
      setErrorMsg('Selecione o sócio responsável.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const created = await createPartnerTask({
        companyId,
        assignedPartnerId,
        categoryId: categoryId || null,
        title,
        description,
        priority,
        createdByPartnerId: createdByPartnerId || null,
        dueDate: dueDate || null,
      });

      onTaskCreated(created);
      onClose();
    } catch (err: any) {
      console.error('Erro ao criar tarefa:', err);
      setErrorMsg(err.message || 'Erro ao salvar a tarefa. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0e0e10] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#141416]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckSquare className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Nova Tarefa</h3>
              <p className="text-xs text-white/50">Adicione uma demanda para você ou seu sócio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quem vai executar & Quem está criando */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2 flex items-center gap-1.5">
                <User className="size-3.5 text-emerald-400" />
                <span>Responsável</span>
              </label>
              <select
                value={assignedPartnerId}
                onChange={(e) => {
                  setAssignedPartnerId(e.target.value);
                  setCategoryId(''); // Reseta categoria ao trocar sócio
                }}
                className="w-full bg-[#161619] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer font-medium"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2 flex items-center gap-1.5">
                <Tag className="size-3.5 text-purple-400" />
                <span>Bloco / Setor</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-[#161619] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 cursor-pointer font-medium"
              >
                <option value="">Sem bloco (Geral)</option>
                {partnerCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    📁 {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Título da Tarefa */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
              O que precisa ser feito? *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Subir criativos novos de Melancia no Meta Ads"
              className="w-full bg-[#161619] border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 font-medium"
              autoFocus
            />
          </div>

          {/* Seletor de Prioridade */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
              Nível de Prioridade
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['BAIXA', 'MEDIA', 'ALTA'] as TaskPriority[]).map((lvl) => {
                const isSelected = priority === lvl;
                const colors = {
                  ALTA: isSelected ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold' : 'bg-black/30 border-white/10 text-white/60 hover:border-white/20',
                  MEDIA: isSelected ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold' : 'bg-black/30 border-white/10 text-white/60 hover:border-white/20',
                  BAIXA: isSelected ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold' : 'bg-black/30 border-white/10 text-white/60 hover:border-white/20',
                };
                const labels = {
                  ALTA: '🔴 Alta',
                  MEDIA: '🟡 Média',
                  BAIXA: '🟢 Baixa',
                };

                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setPriority(lvl)}
                    className={`py-2.5 px-3 rounded-xl border text-xs text-center transition-all cursor-pointer ${colors[lvl]}`}
                  >
                    {labels[lvl]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descrição Detalhada com Espaço Amplo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlignLeft className="size-3.5 text-white/50" />
                <span>Descrição & Instruções Detalhadas</span>
              </span>
              <span className="text-[10px] text-white/30 lowercase">opcional</span>
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o passo a passo, links úteis, referências ou detalhes que seu sócio precisa saber para executar essa tarefa com perfeição..."
              className="w-full bg-[#161619] border border-white/15 rounded-xl p-4 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/50 leading-relaxed custom-scrollbar font-normal"
            />
          </div>

          {/* Quem está criando & Prazo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                Criado por
              </label>
              <select
                value={createdByPartnerId}
                onChange={(e) => setCreatedByPartnerId(e.target.value)}
                className="w-full bg-[#161619] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-white/30 cursor-pointer"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2 flex items-center gap-1">
                <Calendar className="size-3 text-white/40" />
                <span>Prazo Estimado</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#161619] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-white/30 cursor-pointer"
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Adicionar Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
