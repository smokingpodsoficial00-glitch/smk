import React, { useState } from 'react';
import { X, Calculator, Sparkles, DollarSign, Info, Zap } from 'lucide-react';
import { formatBRL } from '@/lib/cart';
import { simulatePartnerAporte, type Partner, type CompanyFinancialOverview } from '@/lib/partners';

interface DilutionSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOverview: CompanyFinancialOverview;
  existingPartners: Partner[];
}

export function DilutionSimulatorModal({
  isOpen,
  onClose,
  currentOverview,
  existingPartners
}: DilutionSimulatorModalProps) {
  const activePartners = existingPartners.filter(p => p.is_active !== false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | 'NEW'>(activePartners[0]?.id || 'NEW');
  const [newPartnerName, setNewPartnerName] = useState('Novo Sócio Investidor');
  const [aporteInput, setAporteInput] = useState<string>('1000');

  if (!isOpen) return null;

  const numAporte = parseFloat(aporteInput.replace(',', '.')) || 0;

  const simulation = simulatePartnerAporte({
    targetPartnerId: selectedPartnerId,
    newPartnerName,
    aporteAmount: numAporte,
    currentOverview,
    existingPartners: activePartners
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0e0e10] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141416]">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Calculator className="size-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Simulador de Aportes & Projeção Societária
                <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Zap className="size-2.5" />
                  Margem: {simulation.officialMarginPct.toFixed(1)}%
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground">Previsão automática de novo capital, recalibração de cotas e lucros projetados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-all cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Inputs de Simulação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#141416] p-4 rounded-2xl border border-white/10">
            <div>
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                Quem fará o novo aporte?
              </label>
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="w-full bg-[#1c1c1f] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50 transition-all cursor-pointer"
              >
                {activePartners.map((p) => {
                  const m = currentOverview.partnerMetrics.find(metric => metric.partner.id === p.id);
                  const currentPct = m ? m.equityPercentage.toFixed(2) : '0.00';
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} (Atual: {currentPct}%)
                    </option>
                  );
                })}
                <option value="NEW">+ Simular Novo Sócio Entrante</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                Valor do Aporte Simulado (R$)
              </label>
              <div className="relative">
                <DollarSign className="size-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={aporteInput}
                  onChange={(e) => setAporteInput(e.target.value)}
                  placeholder="Ex: 1000,00"
                  className="w-full bg-[#1c1c1f] border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-all"
                />
              </div>
            </div>

            {selectedPartnerId === 'NEW' && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
                  Nome do Novo Sócio Simulado
                </label>
                <input
                  type="text"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  placeholder="Ex: Terceiro Sócio"
                  className="w-full bg-[#1c1c1f] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-all"
                />
              </div>
            )}
          </div>

          {/* Cards de Comparativo de Capital e Lucro Projetado do Aporte */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#141416] border border-white/10 p-3.5 rounded-xl text-center space-y-1">
              <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Capital Total Atual</span>
              <div className="text-sm sm:text-base font-extrabold text-white font-mono">
                {formatBRL(simulation.totalNetCapitalBefore)}
              </div>
              <span className="text-[9px] text-white/40 block">Soma dos Aportes</span>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-center space-y-1">
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">+ Novo Aporte</span>
              <div className="text-sm sm:text-base font-extrabold text-emerald-300 font-mono">
                {formatBRL(simulation.aporteAmount)}
              </div>
              <span className="text-[9px] text-emerald-400/80 block font-mono">
                Lucro Projetado: +{formatBRL(simulation.projectedProfitOnNewAporte)}
              </span>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 p-3.5 rounded-xl text-center space-y-1">
              <span className="text-[10px] text-purple-300 uppercase font-bold tracking-wider">= Novo Capital Total</span>
              <div className="text-sm sm:text-base font-extrabold text-purple-200 font-mono">
                {formatBRL(simulation.totalNetCapitalAfter)}
              </div>
              <span className="text-[9px] text-purple-300/70 block">Base de Recalibração</span>
            </div>
          </div>

          {/* Tabela de Recalibração Automática de Cotas e Lucros */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="size-3.5 text-purple-400" />
                <span>Nova Composição & Projeções por Sócio</span>
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono">Soma: 100.00%</span>
            </div>

            <div className="border border-white/10 rounded-xl overflow-hidden bg-[#141416]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 text-[10px] uppercase font-bold bg-[#18181b]">
                    <th className="py-2.5 px-3">Sócio</th>
                    <th className="py-2.5 px-3 text-right">Novo Capital</th>
                    <th className="py-2.5 px-3 text-center">Nova Cota (%)</th>
                    <th className="py-2.5 px-3 text-right">Lucro Projetado</th>
                    <th className="py-2.5 px-3 text-right">Patrimônio Projetado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {simulation.partnersSimulated.map((p) => {
                    const diffPct = p.equityPctAfter - p.equityPctBefore;
                    return (
                      <tr 
                        key={p.partnerId} 
                        className={`transition-all ${p.isTarget ? 'bg-purple-500/10 font-bold' : 'hover:bg-white/5'}`}
                      >
                        <td className="py-2.5 px-3 text-white flex items-center gap-1.5">
                          {p.isTarget && <span className="size-1.5 rounded-full bg-purple-400" />}
                          <span>{p.name}</span>
                          {p.isTarget && (
                            <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1 py-0.2 rounded border border-purple-500/30">
                              Aporte
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-white">
                          {formatBRL(p.capitalAfter)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          <span className={p.isTarget ? 'text-emerald-400' : 'text-amber-400'}>
                            {p.equityPctAfter.toFixed(2)}%
                          </span>
                          {diffPct !== 0 && (
                            <span className={`text-[9px] ml-1 ${diffPct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(2)}%)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">
                          +{formatBRL(p.projectedProfitAfter)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-white font-bold">
                          {formatBRL(p.projectedEquityAfter)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Informação da Simulação */}
          <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl text-[11px] text-white/70 space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Info className="size-3.5 text-purple-400" />
              <span>Simulação Dinâmica com Margem de {simulation.officialMarginPct.toFixed(1)}%</span>
            </div>
            <p className="leading-relaxed">
              O lucro projetado e o patrimônio econômico futuro são calculados automaticamente sobre o novo capital usando a margem oficial da loja. Nenhuma alteração é salva no banco de dados até que um aporte real seja registrado.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-white/10 bg-[#141416]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
          >
            Fechar Simulador
          </button>
        </div>
      </div>
    </div>
  );
}
