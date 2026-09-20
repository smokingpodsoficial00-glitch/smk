import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Crown, 
  Search, 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  ExternalLink, 
  MessageCircle, 
  Phone, 
  Mail, 
  Calendar, 
  RefreshCw, 
  Sparkles, 
  Copy, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ShoppingBag,
  Zap,
  Package,
  Trash2,
  CreditCard
} from 'lucide-react';

interface CompanyData {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  template_type?: string;
  onboarding_done?: boolean;
  is_active?: boolean;
  manager_name?: string;
  created_at?: string;
  payment_gateway?: any;
}

interface StoreStats {
  productsCount: number;
  ordersCount: number;
}

export function SaasManagementDashboard() {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [ordersByCompany, setOrdersByCompany] = useState<Record<string, number>>({});
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');

  // Modal de Confirmação de Bloqueio/Desbloqueio
  const [actionCompany, setActionCompany] = useState<CompanyData | null>(null);
  const [actionType, setActionType] = useState<'block' | 'unblock' | null>(null);
  const [processingAction, setProcessingAction] = useState(false);

  // Modal de Exclusão de Loja (Apenas para lojas de teste)
  const [companyToDelete, setCompanyToDelete] = useState<CompanyData | null>(null);
  const [deletingCompany, setDeletingCompany] = useState(false);

  // Modal de Detalhes da Loja
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState<CompanyData | null>(null);
  const [storeStats, setStoreStats] = useState<StoreStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Modal Gerador de Link de Ativação (Pix)
  const [showPixLinkModal, setShowPixLinkModal] = useState(false);
  const [pixStoreName, setPixStoreName] = useState('');
  const [pixManagerName, setPixManagerName] = useState('');
  const [pixPhone, setPixPhone] = useState('');
  const [pixEmail, setPixEmail] = useState('');
  const [pixPlan, setPixPlan] = useState<'gestao' | 'combo'>('combo');
  const [copiedLink, setCopiedLink] = useState(false);

  // Função Canônica para identificar a loja matriz oficial Smoking Pods
  const isOfficialStore = (c: CompanyData): boolean => {
    return (
      c.id === 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5' ||
      c.email?.toLowerCase().trim() === 'smokingpodsoficial00@gmail.com' ||
      c.name?.toLowerCase().includes('smoking pods 01') ||
      c.name?.toLowerCase().trim() === 'smoking pods'
    );
  };

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Carrega todas as empresas cadastradas
      const { data: companiesData, error: compErr } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (compErr) {
        console.error('Erro ao buscar empresas:', compErr);
      } else if (companiesData) {
        setCompanies(companiesData as CompanyData[]);
      }

      // 2. Carrega pedidos em lote agrupados por empresa para a coluna de métricas
      const { data: ordersData, error: ordersErr } = await supabase
        .from('smoking_orders')
        .select('company_id')
        .not('client_phone', 'like', '__SYSTEM_%');

      if (!ordersErr && ordersData) {
        setTotalOrders(ordersData.length);
        const map: Record<string, number> = {};
        ordersData.forEach(o => {
          if (o.company_id) {
            map[o.company_id] = (map[o.company_id] || 0) + 1;
          }
        });
        setOrdersByCompany(map);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do SaaS:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lojas de clientes parceiros (EXCLUI COMPULSORIAMENTE A SMOKING PODS MATRIZ DO MRR E MÉTRICAS DE CLIENTES)
  const partnerCompanies = useMemo(() => {
    return companies.filter(c => !isOfficialStore(c));
  }, [companies]);

  // Contagem de ativas vs bloqueadas (Apenas clientes pagantes)
  const activeCompanies = useMemo(() => {
    return partnerCompanies.filter(c => c.is_active !== false);
  }, [partnerCompanies]);

  const blockedCompanies = useMemo(() => {
    return partnerCompanies.filter(c => c.is_active === false);
  }, [partnerCompanies]);

  // Churn Rate
  const churnRate = useMemo(() => {
    if (partnerCompanies.length === 0) return 0;
    return ((blockedCompanies.length / partnerCompanies.length) * 100).toFixed(1);
  }, [partnerCompanies, blockedCompanies]);

  // Cálculo de MRR (ESTRITAMENTE CLIENTES PARCEIROS — A MATRIZ SMOKING PODS NÃO PAGA MENSALIDADE)
  const mrrData = useMemo(() => {
    let comboCount = 0;
    let gestaoCount = 0;
    let totalMrr = 0;

    activeCompanies.forEach(comp => {
      const isGestao = comp.template_type === 'gestao' || comp.payment_gateway?.plan === 'gestao';
      if (isGestao) {
        gestaoCount++;
        totalMrr += 89.90;
      } else {
        comboCount++;
        totalMrr += 119.90;
      }
    });

    return { comboCount, gestaoCount, totalMrr };
  }, [activeCompanies]);

  // Filtro de Busca e Status na Tabela
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      if (statusFilter === 'active' && c.is_active === false) return false;
      if (statusFilter === 'blocked' && c.is_active !== false) return false;

      const query = searchTerm.toLowerCase().trim();
      if (!query) return true;

      const nameMatch = c.name?.toLowerCase().includes(query);
      const emailMatch = c.email?.toLowerCase().includes(query);
      const phoneMatch = c.phone?.toLowerCase().includes(query);
      const managerMatch = c.manager_name?.toLowerCase().includes(query);

      return nameMatch || emailMatch || phoneMatch || managerMatch;
    });
  }, [companies, searchTerm, statusFilter]);

  // Ação de Bloqueio ou Desbloqueio
  const handleToggleStatus = async () => {
    if (!actionCompany || !actionType) return;
    if (isOfficialStore(actionCompany)) {
      alert('A loja matriz oficial não pode ser bloqueada.');
      return;
    }

    setProcessingAction(true);

    try {
      const newStatus = actionType === 'unblock';
      const { error } = await supabase
        .from('companies')
        .update({ is_active: newStatus })
        .eq('id', actionCompany.id);

      if (error) {
        alert('Erro ao atualizar status da loja: ' + error.message);
      } else {
        setCompanies(prev => prev.map(c => c.id === actionCompany.id ? { ...c, is_active: newStatus } : c));
        setActionCompany(null);
        setActionType(null);
      }
    } catch (err: any) {
      alert('Erro inesperado: ' + err.message);
    } finally {
      setProcessingAction(false);
    }
  };

  // Ação de Exclusão Definitiva de Loja (Com limpeza em cascata)
  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;
    if (isOfficialStore(companyToDelete)) {
      alert('A loja matriz oficial Smoking Pods não pode ser excluída sob nenhuma circunstância.');
      return;
    }

    setDeletingCompany(true);

    try {
      const targetId = companyToDelete.id;

      // 1. Limpeza em cascata de dados vinculados
      await supabase.from('smoking_orders').delete().eq('company_id', targetId);
      await supabase.from('smoking_products').delete().eq('company_id', targetId);
      await supabase.from('smoking_clients').delete().eq('company_id', targetId);
      await supabase.from('store_config').delete().eq('company_id', targetId);
      await supabase.from('shipping_config').delete().eq('company_id', targetId);
      await supabase.from('company_users').delete().eq('company_id', targetId);

      // 2. Exclusão da empresa
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', targetId);

      if (error) {
        alert('Erro ao excluir loja do banco: ' + error.message);
      } else {
        setCompanies(prev => prev.filter(c => c.id !== targetId));
        setCompanyToDelete(null);
      }
    } catch (err: any) {
      alert('Erro inesperado na exclusão: ' + err.message);
    } finally {
      setDeletingCompany(false);
    }
  };

  // Abrir detalhes de uma loja específica
  const handleOpenDetails = async (company: CompanyData) => {
    setSelectedCompanyDetails(company);
    setLoadingStats(true);
    try {
      const { count: prodCount } = await supabase
        .from('smoking_products')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id);

      const { count: ordCount } = await supabase
        .from('smoking_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id);

      setStoreStats({
        productsCount: prodCount || 0,
        ordersCount: ordCount || 0,
      });
    } catch (err) {
      console.error('Erro ao carregar estatísticas da loja:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Geração do Link de Ativação Inicial
  const generatedActivationLink = useMemo(() => {
    const params = new URLSearchParams();
    params.set('origem', 'pix');
    if (pixEmail) params.set('email', pixEmail.trim().toLowerCase());
    if (pixStoreName) params.set('loja', pixStoreName.trim());
    if (pixManagerName) params.set('nome', pixManagerName.trim());
    if (pixPhone) params.set('whatsapp', pixPhone.trim());
    params.set('plano', pixPlan);
    return `https://smk-system.vercel.app/ativar-conta?${params.toString()}`;
  }, [pixEmail, pixStoreName, pixManagerName, pixPhone, pixPlan]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedActivationLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const whatsappMessageLink = useMemo(() => {
    const text = `Olá${pixManagerName ? ` ${pixManagerName}` : ''}! 🎉 Confirmamos o seu pagamento da assinatura do *SMK System*!\n\n` +
      `Aqui está o seu link exclusivo para ativar a sua loja e cadastrar sua senha de acesso imediato:\n\n` +
      `🔗 ${generatedActivationLink}\n\n` +
      `Basta clicar no link acima, preencher sua senha e o seu sistema estará 100% liberado! 🚀`;
    const cleanNum = pixPhone.replace(/\D/g, '');
    return `https://wa.me/55${cleanNum}?text=${encodeURIComponent(text)}`;
  }, [pixManagerName, generatedActivationLink, pixPhone]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] text-white p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Crown className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Gestão & Vendas do SaaS
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider">
                  MASTER HQ
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                Controle soberano de faturamento, assinaturas e permissões das lojas clientes
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Atualizar dados agora"
          >
            <RefreshCw className={`size-3.5 text-white/60 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
          </button>

          <button
            onClick={() => setShowPixLinkModal(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.15)] active:scale-95"
          >
            <Sparkles className="size-3.5 text-amber-400" />
            <span>Gerar Link de Ativação (Pix)</span>
          </button>

          <a
            href="https://www.asaas.com/"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <DollarSign className="size-3.5 text-emerald-400" />
            <span>Painel Asaas</span>
            <ExternalLink className="size-3 text-white/40" />
          </a>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: MRR Ativo Real (Clientes Pagantes) */}
        <div className="bg-[#0b0b0b] border border-amber-500/30 p-5 rounded-2xl flex flex-col justify-between shadow-[0_0_30px_rgba(245,158,11,0.08)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">MRR Ativo (Mensal)</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <DollarSign className="size-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
              R$ {mrrData.totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1 mt-3">
            <TrendingUp className="size-3" />
            <span>{activeCompanies.length} lojas parceiras pagantes</span>
          </div>
        </div>

        {/* Card 2: Lojas Ativas */}
        <div className="bg-[#0b0b0b] border border-emerald-500/20 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">Lojas Clientes Ativas</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Building2 className="size-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
              {activeCompanies.length}
            </div>
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-3">
            <CheckCircle2 className="size-3" />
            <span>Assinaturas adimplentes</span>
          </div>
        </div>

        {/* Card 3: Lojas Bloqueadas / Churn */}
        <div className="bg-[#0b0b0b] border border-red-500/20 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">Bloqueadas / Churn</span>
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                <ShieldAlert className="size-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
              {blockedCompanies.length}
            </div>
          </div>
          <div className="text-[11px] text-red-400/90 font-medium flex items-center gap-1 mt-3">
            <AlertTriangle className="size-3" />
            <span>Taxa de Churn: {churnRate}%</span>
          </div>
        </div>

        {/* Card 4: Volume de Pedidos na Rede */}
        <div className="bg-[#0b0b0b] border border-white/10 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">Pedidos Processados</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <ShoppingBag className="size-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
              {totalOrders.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="text-[11px] text-white/40 font-medium mt-3">
            Volume total em todos os tenants
          </div>
        </div>

      </div>

      {/* Plan Distribution Breakdown Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Plano SMK Pro Combo */}
        <div className="bg-[#0b0b0b] border border-white/10 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">SMK Pro Combo</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  Mais Vendido
                </span>
              </div>
              <span className="text-xs text-white/40">R$ 119,90/mês (Sistema + Catálogo na Bio)</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-white font-mono">{mrrData.comboCount}</div>
            <span className="text-[10px] text-white/40">Lojas clientes</span>
          </div>
        </div>

        {/* Plano SMK Gestão */}
        <div className="bg-[#0b0b0b] border border-white/10 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70">
              <Package className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">SMK Gestão</span>
              </div>
              <span className="text-xs text-white/40">R$ 89,90/mês (ERP, Estoque & CRM Preditivo)</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-white font-mono">{mrrData.gestaoCount}</div>
            <span className="text-[10px] text-white/40">Lojas clientes</span>
          </div>
        </div>

      </div>

      {/* Lojas Clientes & Controles */}
      <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4">
        
        {/* Table Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="size-4 text-amber-400" />
              <span>Diretório de Lojas & Controle de Acesso</span>
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Audite métricas de vendas dos concorrentes, gerencie permissões ou exclua lojas de teste
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/40" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por loja, e-mail, telefone..."
                className="w-full bg-[#141414] border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex rounded-xl bg-[#141414] border border-white/10 p-0.5 text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white/15 text-white font-bold' : 'text-white/50 hover:text-white'
                }`}
              >
                Todas ({companies.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'active' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-white/50 hover:text-white'
                }`}
              >
                Ativas ({activeCompanies.length})
              </button>
              <button
                onClick={() => setStatusFilter('blocked')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'blocked' ? 'bg-red-500/20 text-red-300 font-bold' : 'text-white/50 hover:text-white'
                }`}
              >
                Bloqueadas ({blockedCompanies.length})
              </button>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="border border-white/10 rounded-xl overflow-hidden overflow-x-auto shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121212] text-white/50 uppercase tracking-wider font-mono border-b border-white/10 text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Empresa / Loja</th>
                <th className="px-5 py-3.5">Contato do Gestor</th>
                <th className="px-5 py-3.5">Plano</th>
                <th className="px-5 py-3.5">Cadastro</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Pedidos da Loja</th>
                <th className="px-5 py-3.5 text-right">Ações Soberanas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/80">
              {filteredCompanies.map((c) => {
                const isMasterStore = isOfficialStore(c);
                const isBlocked = c.is_active === false;
                const cleanPhone = (c.phone || '').replace(/\D/g, '');
                const createdDate = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : 'N/A';
                const storeOrdersCount = ordersByCompany[c.id] || 0;
                const planName = isMasterStore 
                  ? 'Matriz Oficial' 
                  : (c.template_type === 'gestao' ? 'SMK Gestão' : 'SMK Pro Combo');

                const renewalWhatsAppText = `Olá ${c.manager_name || c.name}! Identificamos que a assinatura do seu sistema *SMK System* está suspensa.\n\n` +
                  `Para regularizar seu acesso imediato:\n` +
                  `💳 *Cartão de Crédito com Desconto*: https://www.asaas.com/c/57rnm1clcavvd8nc\n` +
                  `📱 *Pix Chave*: cc0c1ec5-cf52-4481-ada0-af0a862a7462 (Eduardo de Oliveira Pizza)\n\n` +
                  `Basta responder aqui com o comprovante que desbloqueamos seu sistema na hora com todos os seus produtos salvos! 🚀`;

                return (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    
                    {/* Empresa / Loja */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-extrabold shrink-0 shadow-sm">
                          {c.logo_url ? (
                            <img src={c.logo_url} alt="" className="size-7 object-contain rounded-lg" />
                          ) : (
                            c.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                            <span>{c.name}</span>
                            {isMasterStore && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                MATRIZ (ISENTA)
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-white/40 font-mono">
                              ID: {c.id.slice(0, 8)}...
                            </span>
                            <a
                              href={`https://smoking-pods-catalogo.vercel.app/?loja=${c.name.toLowerCase().replace(/\s+/g, '-')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 font-semibold"
                            >
                              <span>Ver Catálogo</span>
                              <ExternalLink className="size-2.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contato do Gestor */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 text-[11px]">
                        <span className="font-semibold text-white/90">
                          {c.manager_name || 'Gestor da Loja'}
                        </span>
                        
                        {c.email && (
                          <span className="flex items-center gap-1.5 text-white/60">
                            <Mail className="size-3 text-white/40 shrink-0" /> {c.email}
                          </span>
                        )}

                        {c.phone && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1 text-white/50 font-mono text-[10px]">
                              <Phone className="size-3 text-white/30 shrink-0" /> {c.phone}
                            </span>
                            <a
                              href={`https://wa.me/55${cleanPhone}?text=Ol%C3%A1%20${encodeURIComponent(c.manager_name || c.name)}!%20Aqui%20%C3%A9%20do%20suporte%20executivo%20do%20SMK%20System.`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[10px] font-bold transition-colors"
                            >
                              <MessageCircle className="size-2.5 fill-[#25D366]" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Plano */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                          isMasterStore
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : planName === 'SMK Pro Combo'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                              : 'bg-white/10 text-white/80 border border-white/20'
                        }`}>
                          <Sparkles className="size-2.5" /> {planName}
                        </span>
                        <span className="text-[10px] text-white/40 font-mono">
                          {isMasterStore ? 'Isenta (Própria Loja)' : (planName === 'SMK Pro Combo' ? 'R$ 119,90/mês' : 'R$ 89,90/mês')}
                        </span>
                      </div>
                    </td>

                    {/* Data de Cadastro */}
                    <td className="px-5 py-4 font-mono text-[11px] text-white/60">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3 text-white/30" />
                        <span>{createdDate}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-[10px] font-black border border-red-500/30">
                          <span className="size-1.5 rounded-full bg-red-500" />
                          BLOQUEADA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ATIVA
                        </span>
                      )}
                    </td>

                    {/* Nova Coluna: Pedidos da Loja (Monitor de Desempenho) */}
                    <td className="px-5 py-4">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono text-[11px] font-bold">
                        <ShoppingBag className="size-3.5 text-blue-400" />
                        <span>{storeOrdersCount} {storeOrdersCount === 1 ? 'pedido' : 'pedidos'}</span>
                      </div>
                    </td>

                    {/* Ações Soberanas */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        
                        {/* Botão de Cobrança / Regularização no WhatsApp (Aparece se bloqueada) */}
                        {isBlocked && !isMasterStore && cleanPhone && (
                          <a
                            href={`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(renewalWhatsAppText)}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Enviar mensagem de regularização de assinatura no WhatsApp"
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[11px] font-bold transition-colors flex items-center gap-1"
                          >
                            <CreditCard className="size-3 text-amber-400" />
                            <span>Cobrar</span>
                          </a>
                        )}

                        {/* Botão Ver Detalhes */}
                        <button
                          onClick={() => handleOpenDetails(c)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Detalhes
                        </button>

                        {/* Botão Bloquear / Desbloquear (Matriz protegida) */}
                        {!isMasterStore && (
                          isBlocked ? (
                            <button
                              onClick={() => {
                                setActionCompany(c);
                                setActionType('unblock');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <Unlock className="size-3 text-emerald-400" />
                              <span>Desbloquear</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setActionCompany(c);
                                setActionType('block');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <Lock className="size-3 text-amber-400" />
                              <span>Bloquear</span>
                            </button>
                          )
                        )}

                        {/* Botão Excluir Loja de Teste (Matriz protegida rigorosamente) */}
                        {!isMasterStore && (
                          <button
                            onClick={() => setCompanyToDelete(c)}
                            title="Excluir loja de teste definitivamente"
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors cursor-pointer active:scale-95"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredCompanies.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-white/40">
                    {loading ? 'Carregando lojas...' : 'Nenhuma empresa encontrada com os filtros selecionados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CONFIRMAÇÃO DE BLOQUEIO / DESBLOQUEIO                            */}
      {/* ========================================================================= */}
      {actionCompany && actionType && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-white/15 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${
                  actionType === 'block' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {actionType === 'block' ? <Lock className="size-5" /> : <Unlock className="size-5" />}
                </div>
                <h3 className="text-base font-bold text-white">
                  {actionType === 'block' ? 'Bloquear Acesso da Loja' : 'Reativar / Desbloquear Loja'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setActionCompany(null);
                  setActionType(null);
                }}
                className="text-white/40 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="text-xs text-white/70 space-y-2 leading-relaxed bg-[#141414] p-4 rounded-xl border border-white/5">
              <p>
                Você está prestes a {actionType === 'block' ? <strong className="text-amber-400">BLOQUEAR</strong> : <strong className="text-emerald-400">DESBLOQUEAR</strong>} o sistema da loja <strong className="text-white">{actionCompany.name}</strong> ({actionCompany.email}).
              </p>
              {actionType === 'block' ? (
                <p className="text-white/50 text-[11px]">
                  ⚠️ O lojista e todos os atendentes desta loja serão impedidos de usar o painel e verão a tela de suspensão com botão para regularizar a assinatura via Cartão ou Pix.
                </p>
              ) : (
                <p className="text-white/50 text-[11px]">
                  ✅ O acesso ao painel do ERP e ao catálogo desta loja será restabelecido instantaneamente com todos os produtos preservados.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActionCompany(null);
                  setActionType(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={processingAction}
                onClick={handleToggleStatus}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-lg active:scale-95 disabled:opacity-50 ${
                  actionType === 'block'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
              >
                {processingAction ? (
                  <span>Processando...</span>
                ) : actionType === 'block' ? (
                  <>
                    <Lock className="size-3.5" />
                    <span>Confirmar Bloqueio</span>
                  </>
                ) : (
                  <>
                    <Unlock className="size-3.5" />
                    <span>Confirmar Desbloqueio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMAÇÃO DE EXCLUSÃO DEFINITIVA (LOJAS DE TESTE)              */}
      {/* ========================================================================= */}
      {companyToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-red-500/30 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
                  <Trash2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Excluir Loja Definitivamente</h3>
                  <span className="text-[10px] text-red-400 font-mono uppercase tracking-wider font-semibold">Ação Irreversível</span>
                </div>
              </div>
              <button
                onClick={() => setCompanyToDelete(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="text-xs text-white/80 space-y-2.5 leading-relaxed bg-red-950/20 p-4 rounded-xl border border-red-500/20">
              <p>
                Tem certeza que deseja apagar a loja <strong className="text-white underline">{companyToDelete.name}</strong> ({companyToDelete.email})?
              </p>
              <p className="text-white/60 text-[11px]">
                ⚠️ Todos os dados de pedidos, produtos, catálogo, usuários e configurações vinculadas a esta loja serão permanentemente excluídos do banco de dados.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={deletingCompany}
                onClick={handleDeleteCompany}
                className="px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-lg bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                <span>{deletingCompany ? 'Excluindo loja...' : 'Sim, Excluir Definitivamente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DETALHES COMPLETOS DA LOJA                                       */}
      {/* ========================================================================= */}
      {selectedCompanyDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold">
                  {selectedCompanyDetails.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedCompanyDetails.name}</h3>
                  <span className="text-[10px] font-mono text-white/40">ID: {selectedCompanyDetails.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCompanyDetails(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#141414] p-3.5 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono uppercase text-white/40 block">Produtos no Catálogo</span>
                <span className="text-xl font-black text-white font-mono mt-1 block">
                  {loadingStats ? '...' : (storeStats?.productsCount || 0)}
                </span>
              </div>

              <div className="bg-[#141414] p-3.5 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono uppercase text-white/40 block">Pedidos Recebidos</span>
                <span className="text-xl font-black text-white font-mono mt-1 block">
                  {loadingStats ? '...' : (storeStats?.ordersCount || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs bg-[#141414] p-4 rounded-xl border border-white/5 text-white/70">
              <div><strong>Responsável:</strong> {selectedCompanyDetails.manager_name || 'Não informado'}</div>
              <div><strong>E-mail:</strong> {selectedCompanyDetails.email || 'Não informado'}</div>
              <div><strong>WhatsApp:</strong> {selectedCompanyDetails.phone || 'Não informado'}</div>
              <div><strong>Chave Pix da Loja:</strong> {selectedCompanyDetails.payment_gateway?.pix_key || selectedCompanyDetails.address || 'Não configurada'}</div>
              <div><strong>Onboarding Concluído:</strong> {selectedCompanyDetails.onboarding_done ? 'Sim ✅' : 'Pendente ⏳'}</div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={`https://smoking-pods-catalogo.vercel.app/?loja=${selectedCompanyDetails.name.toLowerCase().replace(/\s+/g, '-')}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5"
              >
                <span>Visualizar Catálogo da Loja</span>
                <ExternalLink className="size-3.5" />
              </a>

              <button
                type="button"
                onClick={() => setSelectedCompanyDetails(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: GERADOR DE LINK DE ATIVAÇÃO MANUAL (PIX)                        */}
      {/* ========================================================================= */}
      {showPixLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-amber-500/30 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-in fade-in-50 duration-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Gerar Link de Ativação (Pix)</h3>
                  <p className="text-[11px] text-white/50">Crie o link de liberação para enviar ao novo cliente no WhatsApp</p>
                </div>
              </div>
              <button
                onClick={() => setShowPixLinkModal(false)}
                className="text-white/40 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-white/70 font-semibold mb-1">Nome da Loja do Cliente</label>
                <input
                  type="text"
                  value={pixStoreName}
                  onChange={(e) => setPixStoreName(e.target.value)}
                  placeholder="Ex: Prime Vape Lounge"
                  className="w-full bg-[#141414] border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/70 font-semibold mb-1">Nome do Responsável</label>
                  <input
                    type="text"
                    value={pixManagerName}
                    onChange={(e) => setPixManagerName(e.target.value)}
                    placeholder="Ex: Carlos"
                    className="w-full bg-[#141414] border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                <div>
                  <label className="block text-white/70 font-semibold mb-1">WhatsApp com DDD</label>
                  <input
                    type="text"
                    value={pixPhone}
                    onChange={(e) => setPixPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-[#141414] border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 font-semibold mb-1">E-mail do Cliente</label>
                <input
                  type="email"
                  value={pixEmail}
                  onChange={(e) => setPixEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full bg-[#141414] border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label className="block text-white/70 font-semibold mb-1">Plano Adquirido</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPixPlan('combo')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      pixPlan === 'combo'
                        ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                        : 'border-white/10 bg-[#141414] text-white/60'
                    }`}
                  >
                    SMK Pro Combo (R$ 119,90)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPixPlan('gestao')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      pixPlan === 'gestao'
                        ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                        : 'border-white/10 bg-[#141414] text-white/60'
                    }`}
                  >
                    SMK Gestão (R$ 89,90)
                  </button>
                </div>
              </div>

              {/* Link Gerado Preview */}
              <div className="pt-2">
                <label className="block text-white/50 text-[11px] mb-1 font-mono">Link de Ativação Pronto:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedActivationLink}
                    className="w-full bg-black/60 border border-white/10 rounded-xl py-2 px-3 text-[11px] text-white/60 font-mono truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-black font-extrabold text-xs shrink-0 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  >
                    {copiedLink ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

            </div>

            <div className="flex flex-col gap-2 pt-2">
              <a
                href={whatsappMessageLink}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-black text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,211,102,0.3)] active:scale-95 cursor-pointer text-center"
              >
                <MessageCircle className="size-4 fill-black" />
                <span>Enviar Link Formatado no WhatsApp do Cliente</span>
              </a>

              <button
                type="button"
                onClick={() => setShowPixLinkModal(false)}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-semibold transition-colors cursor-pointer"
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

export default SaasManagementDashboard;
