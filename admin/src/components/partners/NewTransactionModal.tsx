import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { createPartnerTransaction, type Partner } from '@/lib/partners';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionCreated: () => void;
  partners: Partner[];
  companyId?: string;
  defaultType?: 'APORTE' | 'RETIRADA_CAPITAL';
  defaultPartnerId?: string;
}

export function NewTransactionModal({
  isOpen,
  onClose,
  onTransactionCreated,
  partners,
  companyId,
  defaultType = 'APORTE',
  defaultPartnerId
}: NewTransactionModalProps) {
  const activePartners = partners.filter(p => p.is_active !== false);
  const [type, setType] = useState<'APORTE' | 'RETIRADA_CAPITAL'>(defaultType);
  const [partnerId, setPartnerId] = useState<string>(defaultPartnerId || activePartners[0]?.id || '');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(',', '.')) || 0;
    if (numAmount <= 0) {
      setErrorMsg('O valor deve ser maior que zero.');
      return;
    }

    if (!partnerId) {
      setErrorMsg('Por favor, selecione o sócio.');
      return;
    }

    const selectedPartner = activePartners.find(p => p.id === partnerId);

    setSubmitting(true);
    setErrorMsg(null);

    const desc = type === 'APORTE' 
      ? `Aporte de capital - ${selectedPartner?.name || 'Sócio'}` 
      : `Retirada de capital - ${selectedPartner?.name || 'Sócio'}`;

    try {
      await createPartnerTransaction({
        companyId,
        partnerId,
        partnerName: selectedPartner?.name || null,
        type,
        amount: numAmount,
        date,
        description: desc,
        destinationCategory: 'CAIXA_GERAL'
      });

      onTransactionCreated();
      onClose();
    } catch (err: any) {
      console.error('Erro ao registrar transação:', err);
      setErrorMsg('Ocorreu um erro ao salvar o lançamento. Tente novamente.');
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
            <div className={`size-9 rounded-xl flex items-center justify-center border ${
              type === 'APORTE' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {type === 'APORTE' ? <ArrowDownRight className="size-5" /> : <ArrowUpRight className="size-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {type === 'APORTE' ? 'Novo Aporte (Entrada)' : 'Retirada de Capital (Saída)'}
              </h2>
              <p className="text-[11px] text-muted-foreground">Movimentação de capital societário</p>
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

          {/* Tipo de Operação: Entrada vs Retirada */}
          <div>
            <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-2">
              Tipo de Movimentação *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('APORTE')}
                className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  type === 'APORTE'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm'
                    : 'bg-[#141416] border-white/10 text-white/50 hover:text-white'
                }`}
              >
                <ArrowDownRight className="size-4 text-emerald-400" />
                <span>Entrada (Aporte)</span>
              </button>

              <button
                type="button"
                onClick={() => setType('RETIRADA_CAPITAL')}
                className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  type === 'RETIRADA_CAPITAL'
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-sm'
                    : 'bg-[#141416] border-white/10 text-white/50 hover:text-white'
                }`}
              >
                <ArrowUpRight className="size-4 text-rose-400" />
                <span>Saída (Retirada)</span>
              </button>
            </div>
          </div>

          {/* Sócio Vinculado */}
          <div>
            <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
              Sócio Vinculado *
            </label>
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="w-full bg-[#161618] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
            >
              {activePartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                Valor (R$) *
              </label>
              <div className="relative">
                <DollarSign className="size-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex: 500,00"
                  className="w-full bg-[#161618] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                Data do Registro
              </label>
              <div className="relative">
                <Calendar className="size-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#161618] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
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
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 ${
                type === 'APORTE' 
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' 
                  : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
              }`}
            >
              {submitting ? 'Gravando...' : type === 'APORTE' ? 'Confirmar Entrada' : 'Confirmar Retirada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
