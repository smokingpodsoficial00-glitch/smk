import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users, UserPlus, DollarSign, ArrowUpDown, PieChart, ShieldCheck,
  TrendingUp, Box, Plus, Trash2, Edit3, Sparkles,
  AlertTriangle, CheckCircle2, Calculator, Landmark,
  Wallet, Scale, Info, Search, ArrowDownRight, ArrowUpRight,
  AlertCircle, X, Percent, Zap, Settings2, Building2, Banknote
} from 'lucide-react';
import { formatBRL } from '@/lib/cart';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProductCostsMap } from '@/lib/productCosts';
import {
  fetchPartners,
  fetchPartnerTransactions,
  deletePartnerTransaction,
  updatePartnerTransaction,
  calculatePartnersFinancials,
  type Partner,
  type PartnerTransaction,
  type PartnerTransactionType,
  type CompanyFinancialOverview
} from '@/lib/partners';
import {
  getCurrentCycle,
  calculateMetricsForCycle
} from '@/lib/financialCycles';
import {
  loadLocalPayrollConfig,
  fetchPayrollConfigFromSupabase,
  syncPayrollConfigFromOrders,
  savePayrollConfigToSupabase,
  calculatePayrollOverview,
  isCompanyExpenseTransaction,
  type PayrollConfig
} from '@/lib/partnerPayroll';
import { runPartnersValidationSuite, type PartnersTestSuiteReport } from '@/lib/partnersTester';

import { NewPartnerModal } from './partners/NewPartnerModal';
import { NewTransactionModal } from './partners/NewTransactionModal';
import { EditPartnerModal } from './partners/EditPartnerModal';
import { DilutionSimulatorModal } from './partners/DilutionSimulatorModal';
import { PayrollConfigModal } from './partners/PayrollConfigModal';

export default function PartnersDashboard() {
  const { company } = useAuth();
  const targetCompanyId = company?.id || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

  // Data states
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [testReport, setTestReport] = useState<PartnersTestSuiteReport | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [persistedCosts, setPersistedCosts] = useState<Record<string, number>>({});
  const [operationalExpenses, setOperationalExpenses] = useState<number>(0);
  const [repurchases, setRepurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Payroll Config state
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig>(() =>
    loadLocalPayrollConfig(targetCompanyId, [])
  );
  const [showPayrollConfigModal, setShowPayrollConfigModal] = useState<boolean>(false);

  // Modals
  const [showNewPartnerModal, setShowNewPartnerModal] = useState<boolean>(false);
  const [showNewTxModal, setShowNewTxModal] = useState<boolean>(false);
  const [newTxDefaultType, setNewTxDefaultType] = useState<PartnerTransactionType>('APORTE');
  const [newTxDefaultPartnerId, setNewTxDefaultPartnerId] = useState<string | undefined>(undefined);
  const [newTxDefaultAmount, setNewTxDefaultAmount] = useState<number | undefined>(undefined);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [showDilutionModal, setShowDilutionModal] = useState<boolean>(false);
  const [txToDelete, setTxToDelete] = useState<PartnerTransaction | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState<boolean>(false);
  const [updatingTxId, setUpdatingTxId] = useState<string | null>(null);

  // Table filter states
  const [txFilterType, setTxFilterType] = useState<string>('TODOS');
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');

  // Performance & Debounce refs
  const realtimeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const hasPendingFetchRef = useRef(false);

  // 1. Carregar todos os dados reais integrados da empresa
  const loadAllData = async (silent = false) => {
    if (isFetchingRef.current) {
      hasPendingFetchRef.current = true;
      return;
    }
    isFetchingRef.current = true;

    try {
      if (!silent) setLoading(true);

      const [
        costs,
        partnersData,
        txData,
        { data: rawOrders },
        { data: rawProducts },
        { data: rawRepurchases }
      ] = await Promise.all([
        fetchProductCostsMap(targetCompanyId).catch(() => ({})),
        fetchPartners(targetCompanyId),
        fetchPartnerTransactions(targetCompanyId),
        supabase
          .from("smoking_orders")
          .select("*")
          .eq("company_id", targetCompanyId)
          .neq("delivery_status", "CANCELADO"),
        supabase
          .from("smoking_products")
          .select("*")
          .eq("company_id", targetCompanyId)
          .eq("is_active", true),
        supabase
          .from("smoking_stock_repurchases")
          .select("*")
          .eq("company_id", targetCompanyId)
      ]);

      try {
        const mkt = parseFloat(localStorage.getItem("smk_mkt_investment") || "0") || 0;
        setOperationalExpenses(mkt);
      } catch (e) {}

      // Carrega configuração de folha prioritariamente da tabela companies (isolada por tenant)
      const syncedPayrollCfg = await fetchPayrollConfigFromSupabase(
        targetCompanyId,
        partnersData
      );

      setPersistedCosts(costs as Record<string, number>);
      setPartners(partnersData);
      setTransactions(txData);
      setOrders(rawOrders || []);
      setProducts(rawProducts || []);
      setRepurchases(rawRepurchases || []);
      setPayrollConfig(syncedPayrollCfg);

    } catch (err) {
      console.error("Erro ao carregar dados do módulo de sócios:", err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      if (hasPendingFetchRef.current) {
        hasPendingFetchRef.current = false;
        loadAllData(true);
      }
    }
  };

  useEffect(() => {
    loadAllData(false);

    const debouncedReload = () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
      realtimeDebounceTimerRef.current = setTimeout(() => {
        loadAllData(true);
      }, 500);
    };

    const partnersChannel = supabase
      .channel(`partners_realtime_${targetCompanyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_orders" }, () => debouncedReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_products" }, () => debouncedReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_partners" }, () => debouncedReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_partner_transactions" }, () => debouncedReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_stock_repurchases" }, () => debouncedReload())
      .subscribe();

    return () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
      supabase.removeChannel(partnersChannel);
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
      operationalExpenses,
      repurchases
    });
  }, [partners, transactions, orders, products, persistedCosts, operationalExpenses, repurchases]);

  // 2.1 Métricas do Ciclo Mensal Atual (14->13) para base de salários
  const currentCycleMetrics = useMemo(() => {
    const cycle = getCurrentCycle();
    return calculateMetricsForCycle(
      cycle,
      orders,
      repurchases,
      persistedCosts,
      transactions,
      partners
    );
  }, [orders, repurchases, persistedCosts, transactions, partners]);

  // 2.2 Visão Consolidada de Salários & Reinvestimento
  const payrollOverview = useMemo(() => {
    return calculatePayrollOverview({
      partners,
      transactions,
      config: payrollConfig,
      cycleNetProfit: currentCycleMetrics.netProfit,
      allTimeNetProfit: financials.netProfitRealized,
      currentCycleId: currentCycleMetrics.cycle.id
    });
  }, [partners, transactions, payrollConfig, currentCycleMetrics.netProfit, financials.netProfitRealized, currentCycleMetrics.cycle.id]);

  const handleSavePayrollConfig = async (newConfig: PayrollConfig) => {
    setPayrollConfig(newConfig);
    await savePayrollConfigToSupabase(newConfig, targetCompanyId);
  };

  const handleTogglePeriodMode = async (mode: "CYCLE" | "ALL_TIME") => {
    const updated: PayrollConfig = {
      ...payrollConfig,
      periodMode: mode,
      updatedAt: new Date().toISOString()
    };
    setPayrollConfig(updated);
    await savePayrollConfigToSupabase(updated, targetCompanyId);
  };

  // 3. Resolução e Filtragem de Transações
  const getPartnerName = (tx: PartnerTransaction) => {
    if (isCompanyExpenseTransaction(tx, partners)) {
      return 'Empresa (Smoking Pods)';
    }
    if (tx.partner_name && tx.partner_name !== 'Sócio') return tx.partner_name;
    if (tx.partner_id) {
      const found = partners.find(p => p.id === tx.partner_id);
      if (found?.name) return found.name;
      if (tx.partner_id === 'p1-eduardo') return 'Eduardo';
      if (tx.partner_id === 'p2-gabriel') return 'Gabriel';
    }
    if (tx.description && tx.description.includes(' - ')) {
      const parts = tx.description.split(' - ');
      if (parts[1]) {
        const n = parts[1].trim();
        if (n.toLowerCase().includes('smolking') || n.toLowerCase().includes('smoking')) {
          return 'Empresa (Smoking Pods)';
        }
        return n;
      }
    }
    return 'Sócio';
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const isCompExpense = isCompanyExpenseTransaction(tx, partners);
      const isSalary = tx.type === 'PRO_LABORE' || tx.type === 'DISTRIBUICAO_LUCRO';

      if (txFilterType === 'APORTE' && tx.type !== 'APORTE') return false;
      if (txFilterType === 'PRO_LABORE' && !isSalary) return false;
      if (txFilterType === 'DESPESA_OPERACIONAL' && !isCompExpense) return false;
      if (
        txFilterType === 'RETIRADA_CAPITAL' &&
        (tx.type !== 'RETIRADA_CAPITAL' || isCompExpense)
      ) {
        return false;
      }

      if (txSearchQuery.trim()) {
        const q = txSearchQuery.toLowerCase();
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const partnerMatch = getPartnerName(tx).toLowerCase().includes(q);
        if (!descMatch && !partnerMatch) return false;
      }
      return true;
    });
  }, [transactions, txFilterType, txSearchQuery, partners]);

  const handleOpenTransactionModal = (
    type: PartnerTransactionType = 'APORTE',
    partnerId?: string,
    amount?: number
  ) => {
    setNewTxDefaultType(type);
    setNewTxDefaultPartnerId(partnerId);
    setNewTxDefaultAmount(amount);
    setShowNewTxModal(true);
  };

  const handleReclassifyTransaction = async (
    tx: PartnerTransaction,
    newType: PartnerTransactionType
  ) => {
    setUpdatingTxId(tx.id);
    try {
      const partnerName = getPartnerName(tx);
      let newDesc = tx.description;
      if (newType === 'PRO_LABORE') {
        newDesc = `Retirada de Salário / Lucro - ${partnerName}`;
      } else if (newType === 'DESPESA_OPERACIONAL') {
        newDesc = tx.description?.includes('Retirada de capital')
          ? 'Custo operacional da empresa'
          : tx.description;
      } else if (newType === 'RETIRADA_CAPITAL') {
        newDesc = `Retirada de capital - ${partnerName}`;
      }

      await updatePartnerTransaction(
        tx.id,
        {
          type: newType,
          description: newDesc
        },
        targetCompanyId
      );
      await loadAllData(true);
    } catch (err) {
      console.error('Erro ao reclassificar movimentação:', err);
    } finally {
      setUpdatingTxId(null);
    }
  };

  const handleConfirmDeleteTransaction = async () => {
    if (!txToDelete) return;
    setIsDeletingTx(true);
    try {
      const updatedTx = await deletePartnerTransaction(txToDelete.id, targetCompanyId);
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
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden bg-background p-4 sm:p-6 lg:p-8 space-y-6 text-white custom-scrollbar">
      {/* ━━━ CABEÇALHO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Scale className="size-5 text-emerald-400 shrink-0" />
              <span>Sócios & Gestão de Equity</span>
            </h1>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
              <Zap className="size-3" />
              Margem Ativa: {financials.officialProfitMarginPct.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Gestão integrada de capital societário, salários sobre o lucro e composição de equity.
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              setIsValidating(true);
              try {
                const rep = await runPartnersValidationSuite();
                setTestReport(rep);
              } finally {
                setIsValidating(false);
                loadAllData();
              }
            }}
            disabled={isValidating}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Executar bateria controlada de testes"
          >
            <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{isValidating ? 'Validando...' : 'Validar Sociedade'}</span>
          </button>

          <button
            onClick={() => setShowDilutionModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Calculator className="size-3.5 text-white/60 shrink-0" />
            <span className="truncate">Simulador Aportes</span>
          </button>

          <button
            onClick={() => setShowNewPartnerModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="size-3.5 text-white/60 shrink-0" />
            <span className="truncate">Cadastrar Sócio</span>
          </button>

          <button
            onClick={() => handleOpenTransactionModal('DESPESA_OPERACIONAL')}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Building2 className="size-3.5 text-white/60 shrink-0" />
            <span className="truncate">Custo da Empresa</span>
          </button>

          <button
            onClick={() => handleOpenTransactionModal('APORTE')}
            className="col-span-2 sm:col-span-1 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="size-3.5 stroke-[2.5] shrink-0" />
            <span>Novo Aporte / Retirada</span>
          </button>
        </div>
      </header>


      {/* ━━━ CARDS CENTRAIS DE CAPITAL, LUCRO E PATRIMÔNIO REAL ━━━━━━━━━━━ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* 1. Capital Investido Total */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
              Capital Investido Total
            </span>
            <Wallet className="size-4 text-white/40" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            {formatBRL(financials.totalNetCapitalInvested)}
          </div>
          <p className="text-[10px] text-white/40">
            Total aportado pelos sócios
          </p>
        </div>

        {/* 3. Lucro Projetado Total (com Margem Oficial) */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
              Lucro Projetado Total
            </span>
            <Sparkles className="size-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 tracking-tight">
            +{formatBRL(financials.companyTotalProjectedProfit)}
          </div>
          <p className="text-[10px] text-white/40">
            Margem oficial de {financials.officialProfitMarginPct.toFixed(1)}%
          </p>
        </div>

        {/* 4. Patrimônio Real Oficial da Loja */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 space-y-1 relative group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
              Patrimônio Real da Loja
              <Info className="size-3 text-white/30 cursor-help" />
            </span>
            <Box className="size-4 text-white/40" />
          </div>
          
          {/* Tooltip Hover */}
          <div className="absolute top-10 right-0 w-48 p-2.5 bg-[#141414] border border-white/10 rounded-xl text-[10px] text-white/70 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
            Valor em caixa somado à mercadoria em estoque a preço de venda.
          </div>

          <div className="text-xl font-bold text-white tracking-tight">
            {formatBRL(financials.companyEconomicEquity)}
          </div>
          <p className="text-[10px] text-white/40 truncate">
            Caixa ({formatBRL(financials.realCash)}) + Estoque ({formatBRL(financials.stockAssetRetail)})
          </p>
        </div>
      </div>

      {/* ━━━ SETOR DE PAGAMENTOS, SALÁRIOS & REINVESTIMENTO ━━━━━━━━━━━━━━━━ */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Banknote className="size-4" />
              </div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Pagamentos, Salários & Reinvestimento
              </h2>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10">
                {payrollOverview.reinvestmentPct}% Loja · {payrollOverview.totalPartnersPct}% Sócios
              </span>
            </div>
            <p className="text-xs text-white/50">
              Divisão automática do Lucro Líquido Real ({formatBRL(payrollOverview.baseNetProfit)}) entre reinvestimento da loja e pró-labore de cada sócio.
            </p>
          </div>

          {/* Controles de Período e Configuração */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-white/5 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => handleTogglePeriodMode("CYCLE")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  payrollOverview.periodMode === "CYCLE"
                    ? "bg-white/10 text-white font-semibold"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Ciclo Atual ({currentCycleMetrics.cycle.monthName})
              </button>
              <button
                type="button"
                onClick={() => handleTogglePeriodMode("ALL_TIME")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  payrollOverview.periodMode === "ALL_TIME"
                    ? "bg-white/10 text-white font-semibold"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Acumulado Geral
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowPayrollConfigModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Settings2 className="size-3.5" />
              <span>Configurar % (Salários & Reinvestimento)</span>
            </button>
          </div>
        </div>

        {/* Barra Visual da Regra de Divisão do Lucro */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>
              Base de Lucro Líquido ({payrollOverview.periodMode === "CYCLE" ? `Ciclo ${currentCycleMetrics.cycle.label}` : "Histórico Completo"}):{" "}
              <strong className="text-emerald-400 font-medium">{formatBRL(payrollOverview.baseNetProfit)}</strong>
            </span>
            <span className="text-white/40">100% Distribuído</span>
          </div>

          <div className="h-2.5 w-full bg-[#141414] rounded-full overflow-hidden flex p-0.5 border border-white/5 gap-0.5">
            {/* Fatia da Loja */}
            <div
              className="h-full rounded-l-full bg-emerald-500 transition-all"
              style={{ width: `${Math.max(2, payrollOverview.reinvestmentPct)}%` }}
              title={`Reinvestimento da Loja: ${payrollOverview.reinvestmentPct}% (${formatBRL(payrollOverview.reinvestmentAmount)})`}
            />
            {/* Fatias de Salário dos Sócios */}
            {payrollOverview.partnerItems.map((item) => (
              <div
                key={item.partner.id}
                className="h-full transition-all last:rounded-r-full"
                style={{
                  width: `${Math.max(2, item.salaryPct)}%`,
                  backgroundColor: item.partner.avatar_color || "#10b981"
                }}
                title={`Salário ${item.partner.name}: ${item.salaryPct}% (${formatBRL(item.grossSalaryGenerated)})`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span className="text-white/70">Reinvestimento Loja:</span>
              <span className="font-semibold text-emerald-400">{payrollOverview.reinvestmentPct}%</span>
              <span className="text-white/40">({formatBRL(payrollOverview.reinvestmentAmount)})</span>
            </div>
            {payrollOverview.partnerItems.map((item) => (
              <div key={item.partner.id} className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: item.partner.avatar_color || "#10b981" }}
                />
                <span className="text-white/70">Salário {item.partner.name}:</span>
                <span className="font-semibold text-white">{item.salaryPct}%</span>
                <span className="text-white/40">({formatBRL(item.grossSalaryGenerated)})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid: Card de Reinvestimento + Cards de Salário de cada Sócio */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Reinvestimento Obrigatório da Loja */}
          <div className="bg-[#050505] border border-white/5 rounded-2xl p-4 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/10">
                  Fatia da Empresa · {payrollOverview.reinvestmentPct}%
                </span>
                <TrendingUp className="size-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Fundo de Reinvestimento</h3>
                <p className="text-[11px] text-white/40">
                  Lucro retido no caixa para reposição de estoque e expansão
                </p>
              </div>
              <div className="text-2xl font-bold text-white pt-1">
                {formatBRL(payrollOverview.reinvestmentAmount)}
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/50">
              <span>Status do Reinvestimento:</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Retido no Caixa Real
              </span>
            </div>
          </div>

          {/* Cards de Salário Individual de Cada Sócio */}
          {payrollOverview.partnerItems.map((item) => (
            <div
              key={item.partner.id}
              className="bg-[#050505] border border-white/5 hover:border-white/10 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: item.partner.avatar_color || "#10b981" }}
                    >
                      {item.partner.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white leading-tight">
                        Salário · {item.partner.name}
                      </h3>
                      <span className="text-[10px] text-white/40">
                        Pró-Labore: <strong className="text-white/70 font-medium">{item.salaryPct}% do lucro</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Valores: Gerado, Já Recebido e Disponível */}
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#0a0a0a] border border-white/5">
                    <span className="text-[10px] text-white/40 block">
                      Gerado ({item.salaryPct}%)
                    </span>
                    <span className="font-semibold text-white">
                      {formatBRL(item.grossSalaryGenerated)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0a0a0a] border border-white/5">
                    <span className="text-[10px] text-white/40 block">
                      Já Recebido
                    </span>
                    <span className="font-semibold text-white/70">
                      {formatBRL(item.salaryPaidInPeriod)}
                    </span>
                  </div>
                </div>

                {/* Saldo Disponível para Sacar */}
                <div className="p-3 rounded-xl bg-[#0a0a0a] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-white/40 block">
                      Disponível para Receber
                    </span>
                    <span className="text-lg font-bold text-emerald-400">
                      {formatBRL(item.availableToReceive)}
                    </span>
                  </div>
                  <Wallet className="size-4 text-emerald-400" />
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleOpenTransactionModal(
                    'PRO_LABORE',
                    item.partner.id,
                    item.availableToReceive > 0 ? item.availableToReceive : undefined
                  )
                }
                className="w-full py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Banknote className="size-3.5" />
                <span>Receber / Sacar Salário</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ━━━ CARDS INDIVIDUAIS DOS SÓCIOS (COM PROJEÇÃO DE LUCRO AUTOMÁTICA) ━ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="size-4 text-emerald-400" />
            <span>Fatia Individual dos Sócios</span>
          </h2>
          <span className="text-xs text-white/40">
            {financials.partnerMetrics.length} sócios ativos · Margem oficial {financials.officialProfitMarginPct.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {financials.partnerMetrics.map((pm) => {
            return (
              <div
                key={pm.partner.id}
                className="bg-[#0a0a0a] border border-white/10 hover:border-white/20 rounded-2xl p-5 space-y-4 transition-all relative flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  {/* 1. Primeira Linha: Nome do Sócio + Equity */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="size-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0"
                        style={{ backgroundColor: pm.partner.avatar_color || '#10b981' }}
                      >
                        {pm.partner.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
                          {pm.partner.name}
                          {pm.partner.is_active === false && (
                            <span className="text-[10px] text-white/40 border border-white/10 px-1.5 py-0.2 rounded-full">
                              Inativo
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] text-white/40">Sócio Cotista</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {financials.hasDefinedCapital && pm.netCapitalInvested >= 0 ? (
                        <span className="text-xs font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          {pm.equityPercentage.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-rose-400 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center gap-1">
                          <AlertTriangle className="size-3" />
                          <span>Não calculável</span>
                        </span>
                      )}
                      <button
                        onClick={() => setEditingPartner(pm.partner)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
                        title="Editar Sócio"
                      >
                        <Edit3 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 2. Informação Principal: Patrimônio Econômico Real */}
                  <div className="bg-[#050505] p-3.5 rounded-xl border border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/40">Patrimônio Econômico:</span>
                      <span className="text-white/60">
                        {financials.hasDefinedCapital && pm.netCapitalInvested >= 0 ? (
                          `${pm.equityPercentage.toFixed(2)}% da empresa`
                        ) : (
                          <span className="text-rose-400 font-medium">Não calculável</span>
                        )}
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">
                      {financials.hasDefinedCapital && pm.netCapitalInvested >= 0 ? (
                        formatBRL(pm.partnerEconomicEquity)
                      ) : (
                        <span className="text-sm font-medium text-white/40">Não aplicável</span>
                      )}
                    </div>

                    {/* Rendimento Operacional Atribuído (Lucro das Vendas) */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-xs">
                      <span className="text-white/40 text-[11px]">Rendimento Operacional:</span>
                      {financials.hasDefinedCapital && pm.netCapitalInvested >= 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`font-medium ${pm.economicProfitShare >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pm.economicProfitShare >= 0 ? '+' : ''}{formatBRL(pm.economicProfitShare)}
                          </span>
                          <span className="text-[10px] text-white/50">
                            ({pm.simplifiedROI.toFixed(1)}% ROI)
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-white/40 font-medium">Não aplicável</span>
                      )}
                    </div>
                  </div>

                  {/* 3. Informações Secundárias Úteis */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#050505] p-2.5 rounded-xl border border-white/5 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/40 block">Capital Investido</span>
                        {pm.netCapitalInvested < 0 && (
                          <span className="text-[9px] text-rose-400 font-bold bg-rose-500/10 px-1 rounded">Devedor</span>
                        )}
                      </div>
                      <span className={`font-semibold ${pm.netCapitalInvested < 0 ? 'text-rose-400 font-mono' : 'text-white'}`}>
                        {formatBRL(pm.netCapitalInvested)}
                      </span>
                    </div>

                    <div className="bg-[#050505] p-2.5 rounded-xl border border-white/5 space-y-0.5">
                      <span className="text-[10px] text-white/40 block">Salários Sacados</span>
                      <span className="font-semibold text-white/70">
                        {formatBRL(pm.proLaboreReceived + pm.dividendsReceived)}
                      </span>
                    </div>

                    <div className="col-span-2 bg-[#050505] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-white/40 block">Estoque a Custo</span>
                        <span className="font-semibold text-white">
                          {formatBRL(pm.stockCostShare)}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40">
                        ≈ {pm.stockPodUnitsEquivalent.toFixed(0)} pods
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Ações */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleOpenTransactionModal('APORTE', pm.partner.id)}
                    className="py-2 px-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="size-3.5 stroke-[2.5]" />
                    <span>Novo Aporte</span>
                  </button>
                  <button
                    onClick={() => handleOpenTransactionModal('PRO_LABORE', pm.partner.id)}
                    className="py-2 px-2.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Banknote className="size-3.5 text-emerald-400" />
                    <span>Sacar Salário</span>
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
              <span>Extrato de Movimentações (Aportes, Salários & Custos)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Histórico completo integrado. Você também pode alterar a categoria de qualquer saída diretamente na tabela.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={txSearchQuery}
                onChange={(e) => setTxSearchQuery(e.target.value)}
                placeholder="Buscar sócio ou custo..."
                className="bg-[#161618] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all w-40 sm:w-48"
              />
            </div>

            <select
              value={txFilterType}
              onChange={(e) => setTxFilterType(e.target.value)}
              className="bg-[#161618] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
            >
              <option value="TODOS">Todas as Movimentações</option>
              <option value="APORTE">🟢 Entradas (Aportes)</option>
              <option value="PRO_LABORE">💸 Salários / Pró-Labore</option>
              <option value="DESPESA_OPERACIONAL">🏢 Custos da Empresa</option>
              <option value="RETIRADA_CAPITAL">📉 Retiradas de Capital</option>
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
                    <th className="py-3 px-4">Categoria / Tipo</th>
                    <th className="py-3 px-4">Sócio / Origem</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4 text-right">Valor (R$)</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransactions.map((tx) => {
                    const isEntry = tx.type === 'APORTE';
                    const isCompExpense = isCompanyExpenseTransaction(tx, partners);
                    const isSalary = tx.type === 'PRO_LABORE' || tx.type === 'DISTRIBUICAO_LUCRO';

                    const currentSelectValue: PartnerTransactionType = isEntry
                      ? 'APORTE'
                      : isCompExpense
                      ? 'DESPESA_OPERACIONAL'
                      : isSalary
                      ? 'PRO_LABORE'
                      : 'RETIRADA_CAPITAL';

                    return (
                      <tr key={tx.id} className="hover:bg-white/5 transition-all">
                        <td className="py-3 px-4 font-mono text-white/60 whitespace-nowrap">
                          {tx.date.split('-').reverse().join('/')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isEntry ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              <ArrowDownRight className="size-3" />
                              Entrada (Aporte)
                            </span>
                          ) : (
                            <select
                              disabled={updatingTxId === tx.id}
                              value={currentSelectValue}
                              onChange={(e) =>
                                handleReclassifyTransaction(tx, e.target.value as PartnerTransactionType)
                              }
                              title="Clique para alterar a classificação desta saída"
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-md border cursor-pointer focus:outline-none transition-all ${
                                currentSelectValue === 'PRO_LABORE'
                                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                  : currentSelectValue === 'DESPESA_OPERACIONAL'
                                  ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              <option value="PRO_LABORE" className="bg-[#141416] text-purple-300">
                                💸 Salário / Lucro
                              </option>
                              <option value="DESPESA_OPERACIONAL" className="bg-[#141416] text-orange-300">
                                🏢 Custo da Empresa
                              </option>
                              <option value="RETIRADA_CAPITAL" className="bg-[#141416] text-rose-300">
                                📉 Retirada de Capital
                              </option>
                            </select>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-white font-medium">
                            <span
                              className={`size-1.5 rounded-full ${
                                isCompExpense ? 'bg-orange-400' : isSalary ? 'bg-purple-400' : 'bg-emerald-400'
                              }`}
                            />
                            {getPartnerName(tx)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white/60 max-w-[220px] truncate" title={tx.description}>
                          {tx.description || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              isEntry
                                ? 'text-emerald-400'
                                : isCompExpense
                                ? 'text-orange-400'
                                : isSalary
                                ? 'text-purple-300'
                                : 'text-rose-400'
                            }
                          >
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
                <span className="text-white/50">Sócio / Origem:</span>
                <span className="font-bold text-white">{getPartnerName(txToDelete)}</span>
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
              ⚠️ Esta ação atualizará imediatamente os saldos de salários, Caixa Real e Patrimônio.
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
      {showPayrollConfigModal && (
        <PayrollConfigModal
          isOpen={showPayrollConfigModal}
          onClose={() => setShowPayrollConfigModal(false)}
          partners={partners}
          currentConfig={payrollConfig}
          cycleNetProfit={currentCycleMetrics.netProfit}
          allTimeNetProfit={financials.netProfitRealized}
          onSave={handleSavePayrollConfig}
        />
      )}

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
          defaultAmount={newTxDefaultAmount}
          payrollItems={payrollOverview.partnerItems}
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

      {/* Modal de Relatório de Validação do Bloco 8 */}
      {testReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0e10] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${testReport.allPassed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Relatório de Validação — Bloco 8</h2>
                  <p className="text-xs text-muted-foreground">
                    {testReport.passedTests} de {testReport.totalTests} testes aprovados ({testReport.allPassed ? '100% Sucesso' : 'Com ressalvas'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTestReport(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Capital Total</span>
                  <p className="text-sm font-bold text-white mt-1">R$ {testReport.capTable.totalCapital.toFixed(2)}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Eduardo</span>
                  <p className="text-sm font-bold text-emerald-400 mt-1">R$ {testReport.capTable.eduardoCapital.toFixed(2)} ({testReport.capTable.eduardoEquityPct})</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Gabriel</span>
                  <p className="text-sm font-bold text-blue-400 mt-1">R$ {testReport.capTable.gabrielCapital.toFixed(2)} ({testReport.capTable.gabrielEquityPct})</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Cap Table</span>
                  <p className="text-sm font-bold text-emerald-400 mt-1">{testReport.capTable.isBalanced ? '100% Equilibrado' : 'Desbalanceado'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Itens da Bateria Controlada</h3>
                <div className="space-y-1.5">
                  {testReport.results.map(r => (
                    <div
                      key={r.id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                        r.passed ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' : 'bg-red-500/5 border-red-500/20 text-red-300'
                      }`}
                    >
                      <span className="font-bold text-[11px] min-w-[20px]">{r.id}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[11px] flex items-center justify-between">
                          <span>{r.description}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {r.passed ? 'APROVADO' : 'FALHA'}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{r.details}</p>
                        {r.error && <p className="text-[10px] text-red-400 mt-0.5">Erro: {r.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setTestReport(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
