import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Calendar,
  AlertCircle,
  FileText,
  Sparkles
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

const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export function NewTransactionModal({
  isOpen,
  onClose,
  onTransactionCreated,
  partners,
  companyId,
  defaultType = 'APORTE',
  defaultPartnerId,
  defaultAmount,
  payrollItems = []
}: NewTransactionModalProps) {
  const humanPartners = filterRealHumanPartners(partners);

  const [flowDirection, setFlowDirection] = useState<'ENTRADA' | 'SAIDA'>(
    defaultType === 'APORTE' ? 'ENTRADA' : 'SAIDA'
  );
  const [outflowSubtype, setOutflowSubtype] = useState<'PRO_LABORE' | 'DESPESA_OPERACIONAL' | 'RETIRADA_CAPITAL'>(
    defaultType === 'DESPESA_OPERACIONAL'
      ? 'DESPESA_OPERACIONAL'
      : defaultType === 'RETIRADA_CAPITAL'
      ? 'RETIRADA_CAPITAL'
      : 'PRO_LABORE'
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
      if (defaultType === 'APORTE') {
        setFlowDirection('ENTRADA');
      } else {
        setFlowDirection('SAIDA');
        if (
          defaultType === 'PRO_LABORE' ||
          defaultType === 'DESPESA_OPERACIONAL' ||
          defaultType === 'RETIRADA_CAPITAL'
        ) {
          setOutflowSubtype(defaultType);
        } else {
          setOutflowSubtype('PRO_LABORE');
        }
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

  const effectiveType: PartnerTransactionType =
    flowDirection === 'ENTRADA' ? 'APORTE' : outflowSubtype;

  const isCompanyExpense = effectiveType === 'DESPESA_OPERACIONAL';
  const selectedPartner = humanPartners.find((p) => p.id === partnerId);
  const selectedPartnerPayroll = payrollItems.find((item) => item.partner.id === partnerId);

  const handleFillAvailableSalary = () => {
    if (selectedPartnerPayroll && selectedPartnerPayroll.availableToReceive > 0) {
      setAmount(selectedPartnerPayroll.availableToReceive.toFixed(2).replace('.', ','));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.')) || parseFloat(amount.replace(',', '.')) || 0;
    if (numAmount <= 0) {
      setErrorMsg('O valor deve ser maior que zero.');
      return;
    }

    if (!isCompanyExpense && !partnerId) {
      setErrorMsg('Por favor, selecione o sócio vinculado.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    let defaultDesc = '';
    if (effectiveType === 'APORTE') {
      defaultDesc = `Aporte de capital - ${selectedPartner?.name || 'Sócio'}`;
    } else if (effectiveType === 'PRO_LABORE') {
      defaultDesc = `Retirada de Salário / Lucro - ${selectedPartner?.name || 'Sócio'}`;
    } else if (effectiveType === 'DESPESA_OPERACIONAL') {
      defaultDesc = 'Custo operacional da empresa';
    } else {
      defaultDesc = `Retirada de capital investido - ${selectedPartner?.name || 'Sócio'}`;
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
        type: effectiveType,
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
      <div className="relative w-full max-w-md bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header Minimalista */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#0e0e11]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/80 shrink-0">
              {flowDirection === 'ENTRADA' ? (
                <ArrowDownRight className="size-4 text-emerald-400" />
              ) : (
                <ArrowUpRight className="size-4 text-white/70" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                Lançar Custo / Despesa da Empresa
              </h2>
              <p className="text-[10px] text-white/40 truncate">
                Integrado em tempo real com Caixa Real, Patrimônio e Financeiro
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body - Visual Limpo, Sem Textos Explicativos e Sem Cards Grandes */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar text-white">
          {errorMsg && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="leading-tight">{errorMsg}</span>
            </div>
          )}

          {/* 1. MOVIMENTAÇÃO (Segmented Control Minimalista) */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
              Movimentação
            </label>
            <div className="grid grid-cols-2 p-1 bg-black/60 border border-white/10 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setFlowDirection('ENTRADA')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  flowDirection === 'ENTRADA'
                    ? 'bg-emerald-500 text-black font-extrabold shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <ArrowDownRight className="size-3.5" />
                <span>Entrada (Aporte)</span>
              </button>

              <button
                type="button"
                onClick={() => setFlowDirection('SAIDA')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  flowDirection === 'SAIDA'
                    ? 'bg-white text-black font-extrabold shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <ArrowUpRight className="size-3.5" />
                <span>Saída</span>
              </button>
            </div>
          </div>

          {/* 2. TIPO (Lista Compacta Minimalista) */}
          {flowDirection === 'SAIDA' && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
                Tipo
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => setOutflowSubtype('PRO_LABORE')}
                  className={`w-full py-2.5 px-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                    outflowSubtype === 'PRO_LABORE'
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'bg-[#121215] border-white/5 text-white/60 hover:text-white hover:border-white/15'
                  }`}
                >
                  <span>Retirada de Salário / Lucro</span>
                  {outflowSubtype === 'PRO_LABORE' && (
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setOutflowSubtype('DESPESA_OPERACIONAL')}
                  className={`w-full py-2.5 px-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                    outflowSubtype === 'DESPESA_OPERACIONAL'
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'bg-[#121215] border-white/5 text-white/60 hover:text-white hover:border-white/15'
                  }`}
                >
                  <span>Custo / Despesa da Empresa</span>
                  {outflowSubtype === 'DESPESA_OPERACIONAL' && (
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setOutflowSubtype('RETIRADA_CAPITAL')}
                  className={`w-full py-2.5 px-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                    outflowSubtype === 'RETIRADA_CAPITAL'
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'bg-[#121215] border-white/5 text-white/60 hover:text-white hover:border-white/15'
                  }`}
                >
                  <span>Retirada de Capital Investido</span>
                  {outflowSubtype === 'RETIRADA_CAPITAL' && (
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Sócio Vinculado (quando não for Custo da Empresa) */}
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

              {effectiveType === 'PRO_LABORE' && selectedPartnerPayroll && (
                <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50">Disponível:</span>
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      {formatBRL(selectedPartnerPayroll.availableToReceive)}
                    </span>
                  </div>
                  {selectedPartnerPayroll.availableToReceive > 0 && (
                    <button
                      type="button"
                      onClick={handleFillAvailableSalary}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="size-2.5 text-emerald-400" />
                      Preencher
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VALOR E DATA */}
          <div className="grid grid-cols-2 gap-2.5">
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
                  placeholder="0,00"
                  className="w-full bg-[#121215] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all"
                />
              </div>
            </div>

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
          </div>

          {/* DESCRIÇÃO / OBSERVAÇÃO */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
              Descrição / Observação {isCompanyExpense ? '*' : ''}
            </label>
            <div className="relative">
              <FileText className="size-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required={isCompanyExpense}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isCompanyExpense ? "Ex: Embalagens, frete, sistema..." : "Opcional"}
                className="w-full bg-[#121215] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
          </div>

          {/* BOTÃO PRINCIPAL SIMPLES E DIRETO */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/10 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? 'Gravando...' : 'Lançar Custo / Despesa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
