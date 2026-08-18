import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, DollarSign, ArrowUpDown, PieChart, ShieldCheck,
  TrendingUp, Box, Plus, Trash2, Edit3, Sparkles,
  AlertTriangle, CheckCircle2, Calculator, Landmark,
  Wallet, Scale, Info, Search, ArrowDownRight, ArrowUpRight,
  AlertCircle, X, Percent, Zap
} from 'lucide-react';
import { formatBRL } from '@/lib/cart';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProductCostsMap } from '@/lib/productCosts';
import {
  fetchPartners,
  fetchPartnerTransactions,
  deletePartnerTransaction,
  calculatePartnersFinancials,
  type Partner,
  type PartnerTransaction,
  type CompanyFinancialOverview
} from '@/lib/partners';

import { NewPartnerModal } from './partners/NewPartnerModal';
import { NewTransactionModal } from './partners/NewTransactionModal';
import { EditPartnerModal } from './partners/EditPartnerModal';
import { DilutionSimulatorModal } from './partners/DilutionSimulatorModal';

export function PartnersDashboard() {
  const { company } = useAuth();
  const targetCompanyId = company?.id || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

  // Data states
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [persistedCosts, setPersistedCosts] = useState<Record<string, number>>({});
  const [operationalExpenses, setOperationalExpenses] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [showNewPartnerModal, setShowNewPartnerModal] = useState<boolean>(false);
  const [showNewTxModal, setShowNewTxModal] = useState<boolean>(false);
  const [newTxDefaultType, setNewTxDefaultType] = useState<'APORTE' | 'RETIRADA_CAPITAL'>('APORTE');
  const [newTxDefaultPartnerId, setNewTxDefaultPartnerId] = useState<string | undefined>(undefined);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [showDilutionModal, setShowDilutionModal] = useState<boolean>(false);
  const [txToDelete, setTxToDelete] = useState<PartnerTransaction | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState<boolean>(false);

  // Table filter states
  const [txFilterType, setTxFilterType] = useState<string>('TODOS');
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');

  // 1. Carregar todos os dados reais integrados da empresa (Apenas Leitura)
  const loadAllData = async () => {
    try {
      setLoading(true);

      // A. Mapa de custos de produtos
      const costs = await fetchProductCostsMap(targetCompanyId).catch(() => ({}));
      setPersistedCosts(costs);

      // B. Sócios e Transações Societárias
      const [partnersData, txData] = await Promise.all([
        fetchPartners(targetCompanyId),
        fetchPartnerTransactions(targetCompanyId)
      ]);
      setPartners(partnersData);
      setTransactions(txData);

      // C. Pedidos Reais de Venda
      const { data: rawOrders } = await supabase
        .from("smoking_orders")
        .select("*")
        .or("company_id.eq." + targetCompanyId + ",company_id.is.null")
        .neq("delivery_status", "CANCELADO");
      setOrders(rawOrders || []);

      // D. Produtos Ativos em Estoque
      const { data: rawProducts } = await supabase
        .from("smoking_products")
        .select("*")
        .or("company_id.eq." + targetCompanyId + ",company_id.is.null")
        .eq("is_active", true);
      setProducts(rawProducts || []);

      // E. Despesas salvas em localStorage (Marketing / Meta Ads)
      try {
        const mkt = parseFloat(localStorage.getItem("smk_mkt_investment") || "0") || 0;
        setOperationalExpenses(mkt);
      } catch (e) {}

    } catch (err) {
      console.error("Erro ao carregar dados do módulo de sócios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // Supabase Realtime Channels para sincronização instantânea
    const subOrders = supabase
      .channel(`partners_orders_${targetCompanyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_orders" }, () => loadAllData())
      .subscribe();

    const subProducts = supabase
      .channel(`partners_products_${targetCompanyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_products" }, () => loadAllData())
      .subscribe();

    const subPartners = supabase
      .channel(`partners_partners_${targetCompanyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_partners" }, () => loadAllData())
      .subscribe();

    const subTx = supabase
      .channel(`partners_tx_${targetCompanyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_partner_transactions" }, () => loadAllData())
      .subscribe();

    return () => {
      supabase.removeChannel(subOrders);
      supabase.removeChannel(subProducts);
      supabase.removeChannel(subPartners);
      supabase.removeChannel(subTx);
    };
  }, [targetCompanyId]);

  // 2. Motor de Cálculo Societário com Projeção Automática de Lucro por Margem Oficial
  const financials: CompanyFinancialOverview = useMemo(() => {
    return calculatePartnersFinancials({
      partners,
      transactions,
      orders,
      products,
      persistedCosts,
      operationalExpenses
    });
  }, [partners, transactions, orders, products, persistedCosts, operationalExpenses]);

  // 3. Filtragem de Transações
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (txFilterType === 'APORTE' && tx.type !== 'APORTE') return false;
      if (txFilterType === 'RETIRADA_CAPITAL' && tx.type !== 'RETIRADA_CAPITAL') return false;
      if (txSearchQuery.trim()) {
        const q = txSearchQuery.toLowerCase();
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const partnerMatch = (tx.partner_name || '').toLowerCase().includes(q);
        if (!descMatch && !partnerMatch) return false;
      }
      return true;
    });
  }, [transactions, txFilterType, txSearchQuery]);

  const handleOpenAporte = (partnerId?: string) => {
    setNewTxDefaultType('APORTE');
    setNewTxDefaultPartnerId(partnerId);
    setShowNewTxModal(true);
  };

  const handleConfirmDeleteTransaction = async () => {
    if (!txToDelete) return;
    setIsDeletingTx(true);
    try {
      const updatedTx = await deletePartnerTransaction(txToDelete.id);
      setTransactions(updatedTx);
      setTxToDelete(null);
    } catch (err) {
      console.error("Erro ao excluir movimentação:", err);
    } finally {
      setIsDeletingTx(false);
      loadAllData();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 space-y-6 text-white custom-scrollbar">
      {/* ━━━ CABEÇALHO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Scale className="size-6 text-emerald-400" />
              <span>Sócios & Gestão de Equity</span>
            </h1>
            <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Zap className="size-3" />
              Margem Ativa: {financials.officialProfitMarginPct.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Projeção automática de lucro sobre aportes de capital baseada na margem oficial do financeiro.
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowDilutionModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
          >
            <Calculator className="size-3.5 text-purple-400" />
            <span>Simulador de Aportes</span>
          </button>

          <button
            onClick={() => setShowNewPartnerModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-[#141416] hover:bg-[#1a1a1d] border border-white/10 text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
          >
            <UserPlus className="size-3.5 text-emerald-400" />
            <span>Cadastrar Sócio</span>
          </button>

          <button
            onClick={() => handleOpenAporte()}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-emerald-500/20"
          >
            <Plus className="size-3.5" />
            <span>Novo Aporte / Retirada</span>
          </button>
        </div>
      </header>

      {/* ━━━ BARRA DE COMPOSIÇÃO SOCIETÁRIA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="size-4 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Composição Societária por Capital
            </span>
          </div>

          <div>
            {financials.hasDefinedCapital ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="size-3" />
                <span>100.00%</span>
              </span>
            ) : (
              <span className="text-[11px] text-white/50">Sem aportes registrados</span>
            )}
          </div>
        </div>

        {/* Barra Visual Proporcional */}
        <div className="h-3.5 w-full bg-[#161618] rounded-full overflow-hidden flex p-0.5 border border-white/5">
          {financials.hasDefinedCapital ? (
            financials.partnerMetrics.map((pm) => (
              <div
                key={pm.partner.id}
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(1, pm.equityPercentage)}%`,
                  backgroundColor: pm.partner.avatar_color || '#10b981'
                }}
                title={`${pm.partner.name}: ${pm.equityPercentage.toFixed(2)}%`}
              />
            ))
          ) : (
            <div className="h-full w-full bg-white/5 rounded-full" />
          )}
        </div>

        {/* Legenda de Sócios */}
        <div className="flex flex-wrap items-center gap-4 pt-0.5 text-xs">
          {financials.partnerMetrics.map((pm) => (
            <div key={pm.partner.id} className="flex items-center gap-2">
              <div 
                className="size-2 rounded-full shrink-0" 
                style={{ backgroundColor: pm.partner.avatar_color || '#10b981' }} 
              />
              <span className="font-semibold text-white/90">{pm.partner.name}:</span>
              <span className="font-mono font-bold text-emerald-400">
                {financials.hasDefinedCapital ? `${pm.equityPercentage.toFixed(2)}%` : '0,00%'}
              </span>
              <span className="text-[11px] text-white/40 font-mono">
                ({formatBRL(pm.netCapitalInvested)} investidos)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ━━━ 4 CARDS CENTRAIS (COM PROJEÇÃO DE LUCRO E MARGEM ATUAL) ━━━━━━━ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Patrimônio Econômico Projetado Total */}
        <div className="bg-[#0e0e10] border border-emerald-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden shadow-lg bg-gradient-to-b from-emerald-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              Patrimônio Projetado
            </span>
            <Landmark className="size-4 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono tracking-tight">
            {formatBRL(financials.companyTotalProjectedEquity)}
          </div>
          <p className="text-[10px] text-white/50">
            Capital ({formatBRL(financials.totalNetCapitalInvested)}) + Lucro Projetado (+{formatBRL(financials.companyTotalProjectedProfit)})
          </p>
        </div>

        {/* 2. Capital Investido Total */}
        <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
              Capital Investido Total
            </span>
            <Wallet className="size-4 text-white/40" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono tracking-tight">
            {formatBRL(financials.totalNetCapitalInvested)}
          </div>
          <p className="text-[10px] text-white/50">
            Total aportado pelos sócios
          </p>
        </div>

        {/* 3. Lucro Projetado Total (com Margem Oficial) */}
        <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
              Lucro Projetado Total
            </span>
            <Sparkles className="size-4 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-emerald-400 font-mono tracking-tight">
            +{formatBRL(financials.companyTotalProjectedProfit)}
          </div>
          <p className="text-[10px] text-white/50">
            Potencial de retorno na margem de {financials.officialProfitMarginPct.toFixed(1)}%
          </p>
        </div>

        {/* 4. Patrimônio Real Oficial da Loja */}
        <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
              Patrimônio Real da Loja
            </span>
            <Box className="size-4 text-blue-400" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono tracking-tight">
            {formatBRL(financials.companyEconomicEquity)}
          </div>
          <p className="text-[10px] text-white/50">
            Caixa ({formatBRL(financials.grossRevenue)}) + Estoque a Venda ({formatBRL(financials.stockAssetRetail)})
          </p>
        </div>
      </div>

      {/* ━━━ CARDS INDIVIDUAIS DOS SÓCIOS (COM PROJEÇÃO DE LUCRO AUTOMÁTICA) ━ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="size-4 text-emerald-400" />
            <span>Fatia Individual dos Sócios</span>
          </h2>
          <span className="text-xs text-muted-foreground">
            {financials.partnerMetrics.length} sócios cadastrados | Projeção via margem oficial de {financials.officialProfitMarginPct.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {financials.partnerMetrics.map((pm) => {
            return (
              <div
                key={pm.partner.id}
                className="bg-[#0e0e10] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl hover:border-white/25 transition-all relative flex flex-col justify-between"
              >
                {/* Faixa superior do Sócio */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="size-10 rounded-xl border flex items-center justify-center font-extrabold text-sm text-white shadow-md"
                      style={{
                        backgroundColor: `${pm.partner.avatar_color || '#10b981'}20`,
                        borderColor: `${pm.partner.avatar_color || '#10b981'}50`
                      }}
                    >
                      {pm.partner.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                        {pm.partner.name}
                        {pm.partner.is_active === false && (
                          <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
                            Inativo
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">Sócio</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span 
                      className="px-2.5 py-1 rounded-xl text-xs font-mono font-extrabold border shadow-sm"
                      style={{
                        backgroundColor: `${pm.partner.avatar_color || '#10b981'}15`,
                        color: pm.partner.avatar_color || '#10b981',
                        borderColor: `${pm.partner.avatar_color || '#10b981'}40`
                      }}
                    >
                      {financials.hasDefinedCapital ? `${pm.equityPercentage.toFixed(2)}%` : '0,00%'}
                    </span>
                    <button
                      onClick={() => setEditingPartner(pm.partner)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
                      title="Editar Nome do Sócio"
                    >
                      <Edit3 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Patrimônio Econômico Projetado (Capital + Lucro Projetado) */}
                <div className="bg-[#141416] p-4 rounded-xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">
                      Patrimônio Econômico Projetado
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      {pm.equityPercentage.toFixed(2)}% da empresa
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
                    {formatBRL(pm.projectedEconomicEquity)}
                  </div>

                  {/* Lucro Projetado & ROI Projetado */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-xs">
                    <span className="text-white/50 text-[11px]">Lucro Projetado:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-emerald-400">
                        +{formatBRL(pm.projectedProfit)}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {pm.projectedROI.toFixed(1)}% ROI Projetado
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid de Detalhamento Individual */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Capital Investido */}
                  <div className="bg-[#141416] p-3 rounded-xl border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-white/40 uppercase font-bold block">Capital Investido</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {formatBRL(pm.netCapitalInvested)}
                    </span>
                    <span className="text-[9px] text-white/40 block">
                      Aporte Líquido
                    </span>
                  </div>

                  {/* Margem Atual Utilizada */}
                  <div className="bg-[#141416] p-3 rounded-xl border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-white/40 uppercase font-bold block">Margem Atual</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {financials.officialProfitMarginPct.toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-white/40 block">
                      Financeiro Oficial
                    </span>
                  </div>

                  {/* Fatia de Estoque a Custo e Equivalência */}
                  <div className="col-span-2 bg-[#141416] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-white/40 uppercase font-bold block">Fatia do Estoque a Custo</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {formatBRL(pm.stockCostShare)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] bg-blue-500/15 text-blue-300 border border-blue-500/25 px-1.5 py-0.5 rounded font-bold uppercase">
                        Equivalência Econômica
                      </span>
                      <span className="text-[10px] text-blue-300/90 font-mono block mt-0.5">
                        ≈ {pm.stockPodUnitsEquivalent.toFixed(2)} pods
                      </span>
                    </div>
                  </div>
                </div>

                {/* Linha Informativa de Resultado Real das Vendas (se houver) */}
                <div className="px-3 py-2 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between text-[11px] text-white/60">
                  <span>Fatia no Lucro Realizado:</span>
                  <span className="font-mono font-bold text-white/90">
                    {formatBRL(pm.economicProfitShare)}
                  </span>
                </div>

                {/* Botão de Ação Rápida de Aporte no Card */}
                <div className="pt-1">
                  <button
                    onClick={() => handleOpenAporte(pm.partner.id)}
                    className="w-full py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Plus className="size-3 text-emerald-400" />
                    <span>Lançar Aporte / Retirada</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ━━━ EXTRATO DE MOVIMENTAÇÕES SOCIETÁRIAS ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ArrowUpDown className="size-4 text-emerald-400" />
              <span>Extrato de Movimentações Societárias</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Histórico de entradas e retiradas de capital dos sócios.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={txSearchQuery}
                onChange={(e) => setTxSearchQuery(e.target.value)}
                placeholder="Buscar sócio..."
                className="bg-[#161618] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all w-36 sm:w-44"
              />
            </div>

            <select
              value={txFilterType}
              onChange={(e) => setTxFilterType(e.target.value)}
              className="bg-[#161618] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
            >
              <option value="TODOS">Todas as Movimentações</option>
              <option value="APORTE">Apenas Entradas (Aportes)</option>
              <option value="RETIRADA_CAPITAL">Apenas Saídas (Retiradas)</option>
            </select>
          </div>
        </div>

        {/* Tabela de Transações */}
        <div className="border border-white/10 rounded-xl overflow-hidden bg-[#141416]">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
              <p>Nenhum lançamento encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 text-[10px] uppercase font-bold bg-[#18181b]">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Sócio</th>
                    <th className="py-3 px-4 text-right">Valor (R$)</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransactions.map((tx) => {
                    const isEntry = tx.type === 'APORTE';

                    return (
                      <tr key={tx.id} className="hover:bg-white/5 transition-all">
                        <td className="py-3 px-4 font-mono text-white/60 whitespace-nowrap">
                          {tx.date.split('-').reverse().join('/')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            isEntry 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {isEntry ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
                            {isEntry ? 'Entrada (Aporte)' : 'Saída (Retirada)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                          {tx.partner_name || 'Sócio'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span className={isEntry ? 'text-emerald-400' : 'text-rose-400'}>
                            {isEntry ? '+' : '-'}{formatBRL(tx.amount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => setTxToDelete(tx)}
                            className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ━━━ MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE MOVIMENTAÇÃO ━━━━━━━━━━━━━━ */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#0e0e10] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-red-400">
                <div className="size-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Excluir esta movimentação?</h3>
                  <p className="text-[11px] text-muted-foreground">Confirmação de exclusão financeira</p>
                </div>
              </div>
              <button
                onClick={() => setTxToDelete(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-all cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Detalhes do Lançamento */}
            <div className="bg-[#141416] p-4 rounded-xl border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/50">Sócio:</span>
                <span className="font-bold text-white">{txToDelete.partner_name || 'Sócio Geral'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Tipo:</span>
                <span className={`font-bold ${txToDelete.type === 'APORTE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {txToDelete.type === 'APORTE' ? 'Entrada (Aporte)' : 'Saída (Retirada)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Valor:</span>
                <span className="font-mono font-extrabold text-white">{formatBRL(txToDelete.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Data:</span>
                <span className="font-mono text-white/70">{txToDelete.date.split('-').reverse().join('/')}</span>
              </div>
            </div>

            <p className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
              ⚠️ Esta ação recalculará automaticamente a participação societária e todas as projeções de lucro.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTransaction}
                disabled={isDeletingTx}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingTx ? 'Excluindo...' : 'Excluir Movimentação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ MODAIS FLUTUANTES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showNewPartnerModal && (
        <NewPartnerModal
          isOpen={showNewPartnerModal}
          onClose={() => setShowNewPartnerModal(false)}
          onPartnerCreated={() => loadAllData()}
          companyId={targetCompanyId}
          currentTotalNetCapital={financials.totalNetCapitalInvested}
        />
      )}

      {showNewTxModal && (
        <NewTransactionModal
          isOpen={showNewTxModal}
          onClose={() => setShowNewTxModal(false)}
          onTransactionCreated={() => loadAllData()}
          partners={partners}
          companyId={targetCompanyId}
          defaultType={newTxDefaultType}
          defaultPartnerId={newTxDefaultPartnerId}
        />
      )}

      {editingPartner && (
        <EditPartnerModal
          isOpen={!!editingPartner}
          onClose={() => setEditingPartner(null)}
          onPartnerUpdated={() => loadAllData()}
          partner={editingPartner}
          currentEquityPercentage={
            financials.partnerMetrics.find(m => m.partner.id === editingPartner.id)?.equityPercentage || 0
          }
          currentNetCapitalInvested={
            financials.partnerMetrics.find(m => m.partner.id === editingPartner.id)?.netCapitalInvested || 0
          }
        />
      )}

      {showDilutionModal && (
        <DilutionSimulatorModal
          isOpen={showDilutionModal}
          onClose={() => setShowDilutionModal(false)}
          currentOverview={financials}
          existingPartners={partners}
        />
      )}
    </div>
  );
}
