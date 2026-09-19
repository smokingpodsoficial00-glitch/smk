import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Tag, User } from 'lucide-react';
import { createTaskCategory, type TaskCategory } from '../../lib/tasks';

interface NewCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  partners: { id: string; name: string }[];
  defaultPartnerId?: string;
  onCategoryCreated: (cat: TaskCategory) => void;
}

const COLOR_PALETTE = [
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Roxo / Violeta', hex: '#8b5cf6' },
  { name: 'Azul Elétrico', hex: '#3b82f6' },
  { name: 'Rosa Neon', hex: '#ec4899' },
  { name: 'Âmbar / Laranja', hex: '#f59e0b' },
  { name: 'Ciano', hex: '#06b6d4' },
  { name: 'Índigo', hex: '#6366f1' },
];

export const NewCategoryModal: React.FC<NewCategoryModalProps> = ({
  isOpen,
  onClose,
  companyId,
  partners,
  defaultPartnerId,
  onCategoryCreated,
}) => {
  const [partnerId, setPartnerId] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#8b5cf6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPartnerId(defaultPartnerId || partners[0]?.id || '');
      setName('');
      setColor('#8b5cf6');
      setErrorMsg(null);
    }
  }, [isOpen, defaultPartnerId, partners]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome do bloco/setor.');
      return;
    }
    if (!partnerId) {
      setErrorMsg('Selecione o sócio deste bloco.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const created = await createTaskCategory({
        companyId,
        partnerId,
        name: name.trim(),
        color,
      });

      onCategoryCreated(created);
      onClose();
    } catch (err: any) {
      console.error('Erro ao criar categoria:', err);
      setErrorMsg(err.message || 'Erro ao criar o bloco.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0e0e10] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#141416]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <FolderPlus className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Novo Bloco de Setor</h3>
              <p className="text-xs text-white/50">Crie uma área de atuação personalizada</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Sócio Dono do Bloco */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2 flex items-center gap-1.5">
              <User className="size-3.5 text-emerald-400" />
              <span>Para qual sócio pertence este bloco?</span>
            </label>
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="w-full bg-[#161619] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer font-medium"
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  👤 {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Nome do Bloco */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2 flex items-center gap-1.5">
              <Tag className="size-3.5 text-purple-400" />
              <span>Nome do Bloco / Área</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Tráfego Pago, Construção do Sistema, Fornecedores..."
              className="w-full bg-[#161619] border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 font-medium"
              autoFocus
            />
          </div>

          {/* Escolha da Cor */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
              Cor do Bloco
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              {COLOR_PALETTE.map((c) => {
                const isSelected = color === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    className={`size-8 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                      isSelected ? 'border-white scale-110 shadow-lg' : 'border-white/20 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {isSelected && <div className="size-2 rounded-full bg-white shadow-sm" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
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
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs transition-all shadow-lg shadow-purple-600/20 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Criando...' : 'Criar Bloco'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
