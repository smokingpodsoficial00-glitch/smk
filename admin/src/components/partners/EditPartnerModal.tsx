import React, { useState } from 'react';
import { X, Trash2, AlertCircle, Percent, Wallet } from 'lucide-react';
import { formatBRL } from '@/lib/cart';
import { updatePartner, deletePartner, type Partner } from '@/lib/partners';

interface EditPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPartnerUpdated: () => void;
  partner: Partner;
  currentEquityPercentage: number;
  currentNetCapitalInvested: number;
}

export function EditPartnerModal({
  isOpen,
  onClose,
  onPartnerUpdated,
  partner,
  currentEquityPercentage,
  currentNetCapitalInvested
}: EditPartnerModalProps) {
  const [name, setName] = useState(partner.name);
  const [isActive, setIsActive] = useState(partner.is_active !== false);

  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome do sócio.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await updatePartner(partner.id, {
        name: name.trim(),
        is_active: isActive
      });

      onPartnerUpdated();
      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar sócio:', err);
      setErrorMsg('Ocorreu um erro ao atualizar o sócio. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await deletePartner(partner.id);
      onPartnerUpdated();
      onClose();
    } catch (err) {
      console.error('Erro ao excluir sócio:', err);
      setErrorMsg('Erro ao excluir sócio.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0e0e10] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141416]">
          <div className="flex items-center gap-2.5">
            <div 
              className="size-9 rounded-xl border flex items-center justify-center font-bold text-sm text-white"
              style={{ backgroundColor: `${partner.avatar_color || '#10b981'}20`, borderColor: `${partner.avatar_color || '#10b981'}40` }}
            >
              {name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Editar Sócio</h2>
              <p className="text-[11px] text-muted-foreground">{partner.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-all cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-xs text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Resumo da Participação Atual */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#161618] border border-white/10 rounded-xl">
            <div>
              <span className="text-[10px] text-white/50 uppercase font-bold flex items-center gap-1">
                <Percent className="size-3 text-emerald-400" />
                Participação
              </span>
              <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                {currentEquityPercentage.toFixed(2)}%
              </div>
            </div>
            <div>
              <span className="text-[10px] text-white/50 uppercase font-bold flex items-center gap-1">
                <Wallet className="size-3 text-white/40" />
                Capital Investido
              </span>
              <div className="text-base font-extrabold text-white font-mono mt-0.5">
                {formatBRL(currentNetCapitalInvested)}
              </div>
            </div>
          </div>

          {/* Nome do Sócio */}
          <div>
            <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
              Nome do Sócio *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              className="w-full bg-[#161618] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          {/* Status na Sociedade */}
          <div>
            <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
              Status do Sócio
            </label>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                isActive
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-muted-foreground'
              }`}
            >
              <span>{isActive ? 'Sócio Ativo' : 'Sócio Inativo'}</span>
              <span className={`size-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-white/30'}`} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400 font-semibold">Excluir?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold cursor-pointer transition-all"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer transition-all"
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="size-3.5" />
                <span>Excluir</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
