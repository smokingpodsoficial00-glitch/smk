import React from 'react';
import { DollarSign, TrendingUp, CreditCard, ArrowUpRight } from 'lucide-react';

export function AdminFinance() {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="size-6 text-purple-400" />
            <span>Financeiro do SaaS</span>
          </h1>
          <p className="text-xs text-white/50 mt-1">Faturamento com assinaturas das empresas clientes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0c0914] border border-purple-500/20 p-5 rounded-2xl">
          <span className="text-xs font-bold text-white/40 uppercase">MRR (Receita Recorrente)</span>
          <div className="text-3xl font-extrabold text-white font-mono mt-2">R$ 2.990,00</div>
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-2">
            <TrendingUp className="size-3" /> +15% esse mês
          </span>
        </div>

        <div className="bg-[#0c0914] border border-purple-500/20 p-5 rounded-2xl">
          <span className="text-xs font-bold text-white/40 uppercase">Assinaturas Ativas</span>
          <div className="text-3xl font-extrabold text-white font-mono mt-2">10</div>
          <span className="text-[10px] text-white/40 mt-2 block">100% Adimplentes</span>
        </div>

        <div className="bg-[#0c0914] border border-purple-500/20 p-5 rounded-2xl">
          <span className="text-xs font-bold text-white/40 uppercase">Ticket Médio por Empresa</span>
          <div className="text-3xl font-extrabold text-white font-mono mt-2">R$ 299,00</div>
          <span className="text-[10px] text-purple-300 mt-2 block">Plano Pro</span>
        </div>
      </div>
    </div>
  );
}
