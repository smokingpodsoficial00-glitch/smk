import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, Users, DollarSign, TrendingUp, ShoppingBag, ShieldCheck } from 'lucide-react';

export function AdminDashboard() {
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const { count: compCount } = await supabase.from('companies').select('*', { count: 'exact', head: true });
        const { count: userCount } = await supabase.from('company_users').select('*', { count: 'exact', head: true });
        const { count: orderCount } = await supabase.from('smoking_orders').select('*', { count: 'exact', head: true }).neq('client_phone', '__SYSTEM_SMK_BEST_SELLERS__');

        setTotalCompanies(compCount || 0);
        setTotalUsers(userCount || 0);
        setTotalOrders(orderCount || 0);
      } catch (err) {
        console.error('Erro ao carregar métricas admin:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>Visão Geral do SaaS</span>
            <ShieldCheck className="size-5 text-purple-400" />
          </h1>
          <p className="text-xs text-white/50 mt-1">Métricas em tempo real de todas as empresas e usuários da plataforma</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0c0914] border border-purple-500/20 p-5 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">Total de Empresas</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{loading ? '...' : totalCompanies}</div>
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
            <TrendingUp className="size-3" /> +100% ativas
          </span>
        </div>

        <div className="bg-[#0c0914] border border-purple-500/20 p-5 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">Usuários Ativos</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Users className="size-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{loading ? '...' : totalUsers}</div>
          <span className="text-[10px] text-white/40">Cadastrados nas empresas</span>
        </div>

        <div className="bg-[#0c0914] border border-purple-500/20 p-5 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">Pedidos Processados</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShoppingBag className="size-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{loading ? '...' : totalOrders}</div>
          <span className="text-[10px] text-emerald-400 font-semibold">Volume total na rede</span>
        </div>

        <div className="bg-[#0c0914] border border-purple-500/20 p-5 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">MRR Estimado</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            R$ {(totalCompanies * 299).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-white/40">Com base no plano Pro R$ 299/mês</span>
        </div>
      </div>
    </div>
  );
}
