import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Calendar,
  AlertCircle,
  Wallet,
  Building2,
  TrendingDown,
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

    try {
      await createPartnerTransaction({
        companyId,
        partnerId: isCompanyExpense ? null : partnerId,
        partnerName: isCompanyExpense ? 'Empresa (Smoking Pods)' : selectedPartner?.name || null,
        type: effectiveType,
        amount: numAmount,
        date,
        description: finalDesc,
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
      <div className="relative w-full max-w-lg bg-[#0e0e10] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141416]">
          <div className="flex items-center gap-2.5">
            <div
              className={`size-9 rounded-xl flex items-center justify-center border ${
                flowDirection === 'ENTRADA'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : effectiveType === 'PRO_LABORE'
                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                  : effectiveType === 'DESPESA_OPERACIONAL'
                  ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              {flowDirection === 'ENTRADA' ? (
                <ArrowDownRight className="size-5" />
              ) : (
                <ArrowUpRight className="size-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {flowDirection === 'ENTRADA'
                  ? 'Novo Aporte de Capital (Entrada)'
                  : effectiveType === 'PRO_LABORE'
                  ? 'Retirada de Salário / Pró-Labore'
                  : effectiveType === 'DESPESA_OPERACIONAL'
                  ? 'Lançar Custo / Despesa da Empresa'
                  : 'Retirada de Capital Investido'}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Integrado em tempo real com Caixa Real, Patrimônio e Financeiro
              </p>
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

          {/* 1. Direção: Entrada vs Saída */}
          <div>
            <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-2">
              1. Direção da Movimentação *
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFlowDirection('ENTRADA')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  flowDirection === 'ENTRADA'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm'
                    : 'bg-[#141416] border-white/10 text-white/50 hover:text-white'
                }`}
              >
                <ArrowDownRight className="size-4 text-emerald-400" />
                <span>Entrada (Aporte)</span>
              </button>

              <button
                type="button"
                onClick={() => setFlowDirection('SAIDA')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  flowDirection === 'SAIDA'
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-sm'
                    : 'bg-[#141416] border-white/10 text-white/50 hover:text-white'
                }`}
              >
                <ArrowUpRight className="size-4 text-rose-400" />
                <span>Saída (Salário / Custo)</span>
              </button>
            </div>
          </div>

          {/* 2. Subtipo de Saída (quando for SAIDA) */}
          {flowDirection === 'SAIDA' && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider">
                2. Qual é o tipo desta saída? *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {/* Opção A: Salário / Pró-Labore */}
                <button
                  type="button"
                  onClick={() => setOutflowSubtype('PRO_LABORE')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    outflowSubtype === 'PRO_LABORE'
                      ? 'bg-purple-500/15 border-purple-500/40 text-white'
                      : 'bg-[#141416] border-white/10 text-white/60 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400 shrink-0 mt-0.5">
                    <Wallet className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>💸 Retirada de Salário / Lucro (Pró-Labore)</span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">
                      Pagamento do salário do sócio. Desconta do saldo disponível do sócio e do Caixa Real, <strong>sem alterar</strong> o capital investido nem a % da sociedade.
                    </p>
                  </div>
                </button>

                {/* Opção B: Custo / Despesa da Empresa */}
                <button
                  type="button"
                  onClick={() => setOutflowSubtype('DESPESA_OPERACIONAL')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    outflowSubtype === 'DESPESA_OPERACIONAL'
                      ? 'bg-orange-500/15 border-orange-500/40 text-white'
                      : 'bg-[#141416] border-white/10 text-white/60 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400 shrink-0 mt-0.5">
                    <Building2 className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>🏢 Custo / Despesa da Empresa</span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">
                      Gasto direto da loja (embalagens, taxas, sistemas, tráfego) sem precisar de um 3º sócio. Atualiza o card <strong>Custos da Empresa</strong> no Financeiro.
                    </p>
                  </div>
                </button>

                {/* Opção C: Retirada de Capital Investido */}
                <button
                  type="button"
                  onClick={() => setOutflowSubtype('RETIRADA_CAPITAL')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    outflowSubtype === 'RETIRADA_CAPITAL'
                      ? 'bg-rose-500/15 border-rose-500/40 text-white'
                      : 'bg-[#141416] border-white/10 text-white/60 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400 shrink-0 mt-0.5">
                    <TrendingDown className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>📉 Retirada de Capital Investido</span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">
                      Devolução de aporte inicial. Reduz o Capital Investido do sócio e recalcula a % de participação societária.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 3. Sócio Vinculado (Oculto quando for Custo da Empresa) */}
          {!isCompanyExpense && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider">
                Sócio Vinculado *
              </label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full bg-[#161618] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
              >
                {humanPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Resumo de Saldo de Salário Disponível (quando for PRO_LABORE) */}
              {effectiveType === 'PRO_LABORE' && selectedPartnerPayroll && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-purple-300/80">
                      Disponível para {selectedPartnerPayroll.partner.name} receber ({selectedPartnerPayroll.salaryPct}%)
                    </div>
                    <div className="text-sm font-black text-purple-300 font-mono">
                      {formatBRL(selectedPartnerPayroll.availableToReceive)}
                    </div>
                  </div>
                  {selectedPartnerPayroll.availableToReceive > 0 && (
                    <button
                      type="button"
                      onClick={handleFillAvailableSalary}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-[11px] font-bold text-purple-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="size-3" />
                      Preencher Total
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. Valor e Data */}
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
                  placeholder="Ex: 50,00"
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

          {/* 5. Descrição / Motivo */}
          <div>
            <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
              Descrição / Observação {isCompanyExpense ? '*' : '(Opcional)'}
            </label>
            <div className="relative">
              <FileText className="size-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required={isCompanyExpense}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isCompanyExpense
                    ? 'Ex: Sacolas personalizadas, taxa de entrega, sistema...'
                    : effectiveType === 'PRO_LABORE'
                    ? 'Ex: Salário quinzenal / Pró-labore'
                    : 'Ex: Observação do lançamento'
                }
                className="w-full bg-[#161618] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
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
                flowDirection === 'ENTRADA'
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                  : effectiveType === 'PRO_LABORE'
                  ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/20'
                  : effectiveType === 'DESPESA_OPERACIONAL'
                  ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                  : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
              }`}
            >
              {submitting
                ? 'Gravando...'
                : flowDirection === 'ENTRADA'
                ? 'Confirmar Aporte'
                : effectiveType === 'PRO_LABORE'
                ? 'Confirmar Pagamento de Salário'
                : effectiveType === 'DESPESA_OPERACIONAL'
                ? 'Registrar Custo da Empresa'
                : 'Confirmar Retirada de Capital'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
