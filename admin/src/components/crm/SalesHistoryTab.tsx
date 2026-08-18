import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, Filter, Calendar, DollarSign, 
  TrendingUp, Users, RefreshCw, Eye, ArrowUpRight, 
  ChevronRight, Phone, MapPin, Tag, Download, Sparkles,
  CheckCircle2, Clock, AlertTriangle, X, Receipt, CreditCard
} from 'lucide-react';
import { formatBRL } from '@/lib/cart';
import { 
  fetchSalesHistory, 
  type DetailedSale, 
  type SalesMacroMetrics 
} from '@/lib/salesHistory';
import { useAuth } from '@/contexts/AuthContext';
import { SaleDetailModal } from './SaleDetailModal';
import { supabase } from '@/lib/supabase';

export function SalesHistoryTab() {
  const { company } = useAuth();
  const [sales, setSales] = useState<DetailedSale[]>([]);
  const [metrics, setMetrics] = useState<SalesMacroMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7d' | '30d' | '3m' | '6m' | '12m'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal de Detalhe da Venda
  const [selectedSale, setSelectedSale] = useState<DetailedSale | null>(null);

  const loadData = async () => {
    if (!company?.id) return;
    try {
      const data = await fetchSalesHistory(company.id);
      setSales(data.sales);
      setMetrics(data.metrics);
    } catch (e) {
      console.error("Erro ao carregar histórico de vendas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('sales_history_realtime_trans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_orders' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  // Filtragem de Vendas por Transação
  const now = new Date().getTime();
  const filteredSales = sales.filter(sale => {
    const saleTime = new Date(sale.created_at).getTime();

    // 1. Filtro de Período
    if (periodFilter === 'today') {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      if (saleTime < todayStart) return false;
    } else if (periodFilter === '7d') {
      if (saleTime < now - 7 * 24 * 60 * 60 * 1000) return false;
    } else if (periodFilter === '30d') {
      if (saleTime < now - 30 * 24 * 60 * 60 * 1000) return false;
    } else if (periodFilter === '3m') {
      if (saleTime < now - 90 * 24 * 60 * 60 * 1000) return false;
    } else if (periodFilter === '6m') {
      if (saleTime < now - 180 * 24 * 60 * 60 * 1000) return false;
    } else if (periodFilter === '12m') {
      if (saleTime < now - 365 * 24 * 60 * 60 * 1000) return false;
    }

    // 2. Filtro de Status
    if (statusFilter !== 'all' && sale.delivery_status !== statusFilter) return false;

    // 3. Filtro de Busca (ID da Venda, Cliente, Telefone, Sabor, Endereço)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = (sale.order_code || '').toLowerCase().includes(q) || sale.id.toLowerCase().includes(q);
      const matchName = sale.client_name.toLowerCase().includes(q);
      const matchPhone = sale.clean_phone.includes(q) || sale.client_phone.includes(q);
      const matchAddr = (sale.address || '').toLowerCase().includes(q);
      const matchItems = sale.items.some(i => 
        (i.name || '').toLowerCase().includes(q) || 
        (i.flavor || '').toLowerCase().includes(q)
      );

      if (!matchId && !matchName && !matchPhone && !matchAddr && !matchItems) return false;
    }

    return true;
  });

  // Exportar CSV de Transações
  const exportToCSV = () => {
    if (filteredSales.length === 0) {
      alert('Nenhuma venda para exportar.');
      return;
    }

    const headers = ['Codigo Venda', 'Data e Hora', 'Comprador', 'WhatsApp', 'Itens e Sabores', 'Valor Total (R$)', 'Pagamento', 'Status Entrega', 'Endereco Destino'];
    const rows = filteredSales.map(s => [
      s.order_code || s.id,
      new Date(s.created_at).toLocaleString('pt-BR'),
      `"${s.client_name}"`,
      s.client_phone,
      `"${s.items.map(i => `${i.quantity}x ${i.name} ${i.flavor || ''}`).join(' | ')}"`,
      s.total_amount.toFixed(2),
      s.payment_status,
      s.delivery_status,
      `"${s.address}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mural_vendas_detalhado_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. MURAL MACRO: FATURAMENTO ANUAL, SEMESTRAL, TRIMESTRAL E MENSAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Faturamento Anual (12M) */}
        <div className="bg-gradient-to-br from-[#121212] to-[#0a0a0a] border border-amber-500/20 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <TrendingUp className="size-3.5" />
              Faturamento Anual (12M)
            </span>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold">
              12 Meses
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
            {formatBRL(metrics?.revenueAnnual || 0)}
          </div>
          <div className="text-[11px] text-white/50 mt-1.5 flex items-center justify-between border-t border-white/5 pt-1.5">
            <span>{metrics?.ordersAnnual || 0} vendas</span>
            <span className="text-amber-400 font-mono font-bold">LTV: {formatBRL(metrics?.ltvAnnual || 0)}</span>
          </div>
        </div>

        {/* Card 2: Faturamento Semestral (6M) */}
        <div className="bg-gradient-to-br from-[#121212] to-[#0a0a0a] border border-blue-500/20 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              Faturamento Semestral (6M)
            </span>
            <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold">
              6 Meses
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
            {formatBRL(metrics?.revenueSemiannual || 0)}
          </div>
          <div className="text-[11px] text-white/50 mt-1.5 flex items-center justify-between border-t border-white/5 pt-1.5">
            <span>{metrics?.ordersSemiannual || 0} vendas</span>
            <span className="text-blue-400 font-mono font-bold">LTV: {formatBRL(metrics?.ltvSemiannual || 0)}</span>
          </div>
        </div>

        {/* Card 3: Faturamento Trimestral (3M) */}
        <div className="bg-gradient-to-br from-[#121212] to-[#0a0a0a] border border-purple-500/20 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Faturamento Trimestral (3M)
            </span>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 font-bold">
              3 Meses
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
            {formatBRL(metrics?.revenueQuarterly || 0)}
          </div>
          <div className="text-[11px] text-white/50 mt-1.5 flex items-center justify-between border-t border-white/5 pt-1.5">
            <span>{metrics?.ordersQuarterly || 0} vendas</span>
            <span className="text-purple-400 font-mono font-bold">LTV: {formatBRL(metrics?.ltvQuarterly || 0)}</span>
          </div>
        </div>

        {/* Card 4: Faturamento Mensal & Ticket Médio */}
        <div className="bg-gradient-to-br from-[#121212] to-[#0a0a0a] border border-emerald-500/20 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <ShoppingBag className="size-3.5" />
              Faturamento do Mês (30D)
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
              30 Dias
            </span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono tracking-tight">
            {formatBRL(metrics?.revenueMonthly || 0)}
          </div>
          <div className="text-[11px] text-white/50 mt-1.5 flex items-center justify-between border-t border-white/5 pt-1.5">
            <span>{metrics?.ordersMonthly || 0} vendas</span>
            <span className="text-emerald-400 font-mono font-bold">Ticket: {formatBRL(metrics?.averageTicket || 0)}</span>
          </div>
        </div>

      </div>

      {/* 2. Top Sabores & Puffs Mais Pedidos */}
      {metrics && (metrics.topFlavors.length > 0 || metrics.topPuffs.length > 0) && (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
              🔥 Sabores Campeões de Venda:
            </span>
            {metrics.topFlavors.map((item, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center gap-1.5 bg-[#141414] border border-white/10 text-white text-xs px-2.5 py-1 rounded-xl font-medium"
              >
                <span className="size-1.5 rounded-full bg-amber-400" />
                {item.flavor} <strong className="text-amber-400 font-mono">({item.count} un)</strong>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">
              ⚡ Modelos / Puffs:
            </span>
            {metrics.topPuffs.map((item, idx) => (
              <span 
                key={idx}
                className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-xl font-mono font-bold"
              >
                {item.puffs} ({item.count} un)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. BARRA DE CONTROLES: Busca de Vendas, Período, Status & Exportação */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        
        {/* Campo de Busca por Venda */}
        <div className="relative w-full md:w-96">
          <Search className="size-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código #SMK, cliente, sabor, WhatsApp ou endereço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141414] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-amber-500 font-sans"
          />
        </div>

        {/* Filtros de Janela Temporal e Status da Venda */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="bg-[#141414] border border-white/10 text-white text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="all">📅 Todas as Vendas</option>
            <option value="today">⚡ Vendas de Hoje</option>
            <option value="7d">🗓️ Últimos 7 Dias</option>
            <option value="30d">📆 Últimos 30 Dias</option>
            <option value="3m">📊 Trimestral (3 Meses)</option>
            <option value="6m">📈 Semestral (6 Meses)</option>
            <option value="12m">🏆 Anual (12 Meses)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#141414] border border-white/10 text-white text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="all">🚚 Todos os Status</option>
            <option value="CONCLUIDO">✅ Entregue / Concluído</option>
            <option value="A_CAMINHO">🛵 A Caminho (Uber/Motoboy)</option>
            <option value="PREPARANDO">⏳ Preparando</option>
            <option value="PENDENTE">🟡 Pendente</option>
            <option value="CANCELADO">❌ Cancelado</option>
          </select>

          <button
            onClick={exportToCSV}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar dados para planilha CSV"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Exportar Vendas</span>
          </button>

        </div>
      </div>

      {/* 4. MURAL TRANSACIONAL DE VENDAS (Feed Detalhado de Cada Venda) */}
      {loading ? (
        <div className="p-12 text-center text-white/50">Carregando histórico de vendas...</div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 text-center text-white/40 space-y-3">
          <Receipt className="size-10 text-white/20 mx-auto" />
          <p className="text-sm font-semibold text-white">Nenhuma venda encontrada para os filtros selecionados.</p>
          <p className="text-xs max-w-md mx-auto">
            Tente ajustar o termo de busca ou a janela temporal selecionada.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSales.map(sale => {
            const orderDate = new Date(sale.created_at).toLocaleDateString('pt-BR');
            const orderTime = new Date(sale.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const waNumber = sale.clean_phone.startsWith('55') ? sale.clean_phone : ('55' + sale.clean_phone);
            const totalUnits = sale.items.reduce((acc, i) => acc + (i.quantity || 1), 0);

            return (
              <div
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className="bg-[#0c0c0c] hover:bg-[#111111] border border-white/10 hover:border-white/20 rounded-2xl p-4 sm:p-5 transition-all shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer group"
              >
                {/* Bloco 1: Identificação da Venda & Horário */}
                <div className="flex items-start gap-3.5 min-w-[220px]">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold flex items-center justify-center text-xs shrink-0 font-mono">
                    <Receipt className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-extrabold text-white group-hover:text-emerald-400 transition-colors">
                        {sale.order_code}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full uppercase bg-white/5 text-white/60 border border-white/5">
                        {sale.source || 'WhatsApp'}
                      </span>
                    </div>
                    <div className="text-xs text-white/50 flex items-center gap-1.5 mt-1 font-mono">
                      <Calendar className="size-3 text-white/40" />
                      <span>{orderDate} às {orderTime}</span>
                    </div>
                  </div>
                </div>

                {/* Bloco 2: Itens Comprados & Sabores Específicos */}
                <div className="flex-1 max-w-lg">
                  <div className="flex flex-wrap gap-1.5">
                    {sale.items.map((item, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center gap-1 bg-[#181818] border border-white/10 text-xs px-2.5 py-1 rounded-xl text-white font-medium shadow-sm"
                      >
                        <strong className="text-emerald-400 font-mono">{item.quantity}x</strong>
                        <span>{item.name || 'Pod'}</span>
                        {item.flavor && (
                          <span className="text-amber-300 font-semibold text-[11px]">
                            • {item.flavor}
                          </span>
                        )}
                        {item.puffs && (
                          <span className="text-white/40 text-[10px] font-mono">
                            ({item.puffs}p)
                          </span>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="text-[11px] text-white/40 flex items-center gap-1.5 mt-1.5">
                    <MapPin className="size-3 text-white/30 shrink-0" />
                    <span className="truncate max-w-sm">{sale.address}</span>
                  </div>
                </div>

                {/* Bloco 3: Comprador & Contato */}
                <div className="min-w-[170px]">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-bold text-white truncate max-w-[140px]">
                      {sale.client_name}
                    </div>
                    {sale.is_vip && (
                      <span className="text-[9px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded-full uppercase">
                        VIP
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/50 font-mono flex items-center gap-1 mt-0.5">
                    <Phone className="size-2.5" />
                    {sale.client_phone}
                  </div>
                </div>

                {/* Bloco 4: Total Pago, Status & Ação Raio-X */}
                <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                  <div className="text-left md:text-right">
                    <div className="text-sm font-extrabold text-emerald-400 font-mono">
                      {formatBRL(sale.total_amount)}
                    </div>
                    <div className="text-[10px] text-white/40 font-mono flex items-center md:justify-end gap-1">
                      <CreditCard className="size-2.5" />
                      <span>{sale.payment_method || 'PIX'} • {sale.payment_status}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                      sale.delivery_status === 'CONCLUIDO'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : sale.delivery_status === 'A_CAMINHO'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : sale.delivery_status === 'CANCELADO'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {sale.delivery_status}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSale(sale);
                      }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 transition-all"
                      title="Ver Raio-X da Venda"
                    >
                      <Eye className="size-4" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalhe da Venda */}
      <SaleDetailModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
      />

    </div>
  );
}
