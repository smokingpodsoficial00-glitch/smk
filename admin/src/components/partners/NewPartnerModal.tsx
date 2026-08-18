import React, { useState } from 'react';
import { X, UserPlus, DollarSign, AlertCircle, Sparkles } from 'lucide-react';
import { formatBRL } from '@/lib/cart';
import { createPartner } from '@/lib/partners';

interface NewPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPartnerCreated: () => void;
  companyId?: string;
  currentTotalNetCapital: number;
}

export function NewPartnerModal({
  isOpen,
  onClose,
  onPartnerCreated,
  companyId,
  currentTotalNetCapital
}: NewPartnerModalProps) {
  const [name, setName] = useState('');
  const [initialInvestment, setInitialInvestment] = useState<string>('500');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const numInvestment = parseFloat(initialInvestment.replace(',', '.')) || 0;
  const simulatedNewTotalCapital = currentTotalNetCapital + numInvestment;
  const estimatedEquityPct = simulatedNewTotalCapital > 0 
    ? (numInvestment / simulatedNewTotalCapital) * 100 
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome do sócio.');
      return;
    }

    if (numInvestment < 0) {
      setErrorMsg('O aporte de capital inicial não pode ser negativo.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await createPartner({
        companyId,
        name: name.trim(),
        role: 'Sócio',
        initialInvestment: numInvestment > 0 ? numInvestment : undefined
      });

      onPartnerCreated();
      onClose();
    } catch (err: any) {
      console.error('Erro ao cadastrar sócio:', err);
      setErrorMsg('Ocorreu um erro ao salvar o sócio. Tente novamente.');
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
            <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <UserPlus className="size-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Cadastrar Novo Sócio</h2>
              <p className="text-[11px] text-muted-foreground">Informe o nome e o capital investido</p>
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
              placeholder="Ex: Eduardo / Gabriel"
              className="w-full bg-[#161618] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          {/* Aporte de Capital Inicial */}
          <div>
            <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
              Aporte Inicial (R$) *
            </label>
            <div className="relative">
              <DollarSign className="size-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={initialInvestment}
                onChange={(e) => setInitialInvestment(e.target.value)}
                placeholder="Ex: 500,00"
                className="w-full bg-[#161618] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>

          {/* Prévia de Cálculo Automático */}
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-300 font-semibold flex items-center gap-1.5 text-xs">
                <Sparkles className="size-3.5" />
                Participação Resultante:
              </span>
              <span className="font-mono font-extrabold text-emerald-400 text-sm">
                {estimatedEquityPct.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/50 pt-1 border-t border-white/10">
              <span>Capital Total Atual: {formatBRL(currentTotalNetCapital)}</span>
              <span>Novo Total: {formatBRL(simulatedNewTotalCapital)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Confirmar Sócio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
