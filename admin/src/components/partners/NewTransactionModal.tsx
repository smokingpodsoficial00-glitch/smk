import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  DollarSign,
  Calendar,
  AlertCircle,
  FileText
} from 'lucide-react';
import { createPartnerTransaction, type Partner, type PartnerTransactionType } from '@/lib/partners';
import { filterRealHumanPartners, type PartnerPayrollItem } from '@/lib/partnerPayroll';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionCreated: () => void;
  partners: Partner[];
  companyId?: string;
  defaultType?: PartnerTransactionType;
  defaultPartnerId?: string;
  defaultAmount?: number;
  payrollItems?: PartnerPayrollItem[];
}

export function NewTransactionModal({
  isOpen,
  onClose,
  onTransactionCreated,
  partners,
  companyId,
  defaultType = 'DESPESA_OPERACIONAL',
  defaultPartnerId,
  defaultAmount,
  payrollItems = []
}: NewTransactionModalProps) {
  const humanPartners = filterRealHumanPartners(partners);

  // 3 Tipos solicitados: 'Custo da empresa' | 'Salário' | 'Retirada de sócio' (com suporte interno a APORTE se chamado por atalhos prévios)
  const [selectedType, setSelectedType] = useState<'DESPESA_OPERACIONAL' | 'PRO_LABORE' | 'RETIRADA_CAPITAL'>(
    defaultType === 'PRO_LABORE'
      ? 'PRO_LABORE'
      : defaultType === 'RETIRADA_CAPITAL'
      ? 'RETIRADA_CAPITAL'
      : 'DESPESA_OPERACIONAL'
  );

  const [partnerId, setPartnerId] = useState<string>(defaultPartnerId || humanPartners[0]?.id || '');
  const [amount, setAmount] = useState<string>(
    defaultAmount && defaultAmount > 0 ? defaultAmount.toFixed(2).replace('.', ',') : ''
  );
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      if (defaultType === 'PRO_LABORE') {
        setSelectedType('PRO_LABORE');
      } else if (defaultType === 'RETIRADA_CAPITAL') {
        setSelectedType('RETIRADA_CAPITAL');
      } else {
        setSelectedType('DESPESA_OPERACIONAL');
      }

      setPartnerId(defaultPartnerId || humanPartners[0]?.id || '');
      setAmount(
        defaultAmount && defaultAmount > 0 ? defaultAmount.toFixed(2).replace('.', ',') : ''
      );
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setErrorMsg(null);
      idempotencyKeyRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }, [isOpen, defaultType, defaultPartnerId, defaultAmount, partners.length]);

  if (!isOpen) return null;

  const isCompanyExpense = selectedType === 'DESPESA_OPERACIONAL';
  const selectedPartner = humanPartners.find((p) => p.id === partnerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.')) || parseFloat(amount.replace(',', '.')) || 0;
    if (numAmount <= 0) {
      setErrorMsg('O valor deve ser maior que zero.');
      return;
    }

    if (!isCompanyExpense && !partnerId) {
      setErrorMsg('Por favor, selecione o sócio.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    let defaultDesc = '';
    if (selectedType === 'PRO_LABORE') {
      defaultDesc = `Salário / Pró-labore - ${selectedPartner?.name || 'Sócio'}`;
    } else if (selectedType === 'DESPESA_OPERACIONAL') {
      defaultDesc = 'Custo da empresa';
    } else {
      defaultDesc = `Retirada de sócio - ${selectedPartner?.name || 'Sócio'}`;
    }

    const finalDesc = description.trim() ? description.trim() : defaultDesc;
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    const clientSubmissionId = idempotencyKeyRef.current;

    try {
      await createPartnerTransaction({
        companyId,
        partnerId: isCompanyExpense ? null : partnerId,
        partnerName: isCompanyExpense ? 'Empresa (Smoking Pods)' : selectedPartner?.name || null,
        type: selectedType,
        amount: numAmount,
        date,
        description: finalDesc,
        destinationCategory: 'CAIXA_GERAL',
        idempotencyKey: clientSubmissionId
      });

      onTransactionCreated();
      onClose();
    } catch (err: any) {
      console.error('Erro ao registrar transação:', err);
      setErrorMsg(err?.message || 'Ocorreu um erro ao salvar o lançamento no banco de dados. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm sm:max-w-md bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header Ultra Minimalista */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#0e0e11]">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white tracking-tight truncate">
              Lançar Custo / Despesa
            </h2>
            <p className="text-[10px] text-white/40 truncate">
              Integrado ao Caixa Real e Financeiro
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body - Ultra Direto, Limpo e Sem Nenhuma Explicação */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar text-white">
          {errorMsg && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="leading-tight">{errorMsg}</span>
            </div>
          )}

          {/* Segmented Control de 3 opções: [ Custo da empresa ] [ Salário ] [ Retirada de sócio ] */}
          <div className="grid grid-cols-3 p-1 bg-black/60 border border-white/10 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setSelectedType('DESPESA_OPERACIONAL')}
              className={`py-2 px-1 text-center rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer truncate ${
                selectedType === 'DESPESA_OPERACIONAL'
                  ? 'bg-white text-black font-extrabold shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Custo da empresa
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('PRO_LABORE')}
              className={`py-2 px-1 text-center rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer truncate ${
                selectedType === 'PRO_LABORE'
                  ? 'bg-white text-black font-extrabold shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Salário
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('RETIRADA_CAPITAL')}
              className={`py-2 px-1 text-center rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer truncate ${
                selectedType === 'RETIRADA_CAPITAL'
                  ? 'bg-white text-black font-extrabold shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Retirada de sócio
            </button>
          </div>

          {/* Campo Sócio (somente quando for Salário ou Retirada de sócio) */}
          {!isCompanyExpense && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
                Sócio
              </label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full bg-[#121215] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30 transition-all cursor-pointer"
              >
                {humanPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Valor */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
              Valor (R$)
            </label>
            <div className="relative">
              <DollarSign className="size-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="R$ 0,00"
                className="w-full bg-[#121215] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
              Data
            </label>
            <div className="relative">
              <Calendar className="size-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#121215] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
              Descrição {isCompanyExpense ? '*' : ''}
            </label>
            <div className="relative">
              <FileText className="size-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required={isCompanyExpense}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isCompanyExpense
                    ? "Ex: Sacolas, embalagem, sistema, transporte..."
                    : "Ex: Observação..."
                }
                className="w-full bg-[#121215] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
          </div>

          {/* Botão Principal: [ Lançar ] */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 sm:py-3 px-4 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/10 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? 'Lançando...' : 'Lançar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
