import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, Filter, Calendar, DollarSign, 
  TrendingUp, Users, RefreshCw, Eye, ArrowUpRight, 
  ChevronRight, Phone, MapPin, Tag, Download, Sparkles,
  CheckCircle2, Clock, AlertTriangle, X
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
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7d' | 'month' | '6m' | 'year'>('all');
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
      .channel('sales_history_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_orders' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  // Filtragem de Vendas
  const now = new Date().getTime();
  const filteredSales = sales.filter(sale => {
    const saleTime = new Date(sale.created_at).getTime();

    // 1. Filtro de Período
    if (periodFilter === 'today') {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      if (saleTime < todayStart) return false;
    } else if (periodFilter === '7d') {
      if (saleTime < now - 7 * 24 * 60 * 60 * 1000) return false;
    } else if (periodFilter === 'month') {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      if (saleTime < monthStart) return false;
    } else if (periodFilter === '6m') {
      if (saleTime < now - 180 * 24 * 60 * 60 * 1000) return false;
    } else if (periodFilter === 'year') {
      if (saleTime < now - 365 * 24 * 60 * 60 * 1000) return false;
    }

    // 2. Filtro de Status
    if (statusFilter !== 'all' && sale.delivery_status !== statusFilter) return false;

    // 3. Filtro de Busca
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = sale.client_name.toLowerCase().includes(q);
      const matchPhone = sale.clean_phone.includes(q) || sale.client_phone.includes(q);
      const matchAddr = (sale.address || '').toLowerCase().includes(q);
      const matchId = sale.id.toLowerCase().includes(q);
      const matchItems = sale.items.some(i => 
        (i.name || '').toLowerCase().includes(q) || 
        (i.flavor || '').toLowerCase().includes(q)
      );

      if (!matchName && !matchPhone && !matchAddr && !matchId && !matchItems) return false;
    }

    return true;
  });

  // Exportar CSV
  const exportToCSV = () => {
    if (filteredSales.length === 0) {
      alert('Nenhuma venda para exportar.');
      return;
    }

    const headers = ['ID Pedido', 'Data', 'Cliente', 'Telefone', 'Itens', 'Total (R$)', 'Status Entrega', 'Endereco'];
    const rows = filteredSales.map(s => [
      s.id,
      new Date(s.created_at).toLocaleString('pt-BR'),
      `"${s.client_name}"`,
      s.client_phone,
      `"${s.items.map(i => `${i.quantity}x ${i.name} ${i.flavor || ''}`).join(' | ')}"`,
      s.total_amount.toFixed(2),
      s.delivery_status,
      `"${s.address}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `historico_vendas_smoking_pods_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. MURAL MACRO & MÉTRICAS TÉCNICAS (LTV Anual, Semestral, Faturamento) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Faturamento Histórico & Total de Vendas */}
        <div className="bg-gradient-to-br from-[#121212] to-[#0a0a0a] border border-white/10 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <ShoppingBag className="size-3.5" />
              Faturamento Concluído
            </span>
            <span className="size-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
            {formatBRL(metrics?.totalRevenue || 0)}
          </div>
          <div className="text-[11px] text-white/50 mt-1 flex items-center justify-between">
            <span>{metrics?.totalOrders || 0} pedidos fechados</span>
            <span className="text-emerald-400 font-bold font-mono">100% real</span>
          </div>
        </div>

        {/* Card 2: LTV Anual (12 Meses) */}
        <div className="bg-gradient-to-br from-[#121212] to-[#0a0a0a] border border-white/10 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <TrendingUp className="size-3.5" />
              LTV Anual (12 Meses)
            </span>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">
              12M
            </span>
          </div>
          <div className="text-2xl font-extrabold text-amber-400 font-mono tracking-tight">
            {formatBRL(metrics?.ltvAnnual || 0)}
          </div>
          <div className="text-[11px] text-white/50 mt-1">
            Gasto médio por cliente ativo no ano.
          </div>
        </div>

        {/* Card 3: LTV Semestral (6 Meses) */}
        <div className="bg-gradient-to-br from-[#121212] to-[#0a0a0a] border border-white/10 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              LTV Semestral (6 Meses)
            </span>
            <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">
              6M
            </span>
          </div>
          <div className="text-2xl font-extrabold text-blue-400 font-mono tracking-tight">
            {formatBRL(metrics?.ltvSemiannual || 0)}
          </div>
          <div className="text-[11px] text-white/50 mt-1">
            Gasto médio por cliente no último semestre.
          </div>
        </div>

        {/* Card 4: Ticket Médio & Recorrência */}
        <div className="bg-gradient-to-br from-[#121212] to-[#0a0a0a] border border-white/10 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <RefreshCw className="size-3.5" />
              Ticket Médio & Recompra
            </span>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-bold">
              AOV
            </span>
          </div>
          <div className="text-2xl font-extrabold text-purple-400 font-mono tracking-tight">
            {formatBRL(metrics?.averageTicket || 0)}
          </div>
          <div className="text-[11px] text-white/50 mt-1 flex items-center justify-between">
            <span>Recorrência: <strong className="text-white">{metrics?.repurchaseRate.toFixed(1) || 0}%</strong></span>
            <span>{metrics?.uniqueClientsCount || 0} clientes</span>
          </div>
        </div>

      </div>

      {/* 2. Top Produtos & Sabores Campeões */}
      {metrics && (metrics.topFlavors.length > 0 || metrics.topPuffs.length > 0) && (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
              🔥 Sabores Mais Vendidos:
            </span>
            {metrics.topFlavors.map((item, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center gap-1.5 bg-[#141414] border border-white/10 text-white text-xs px-2.5 py-1 rounded-xl font-medium"
              >
                <span className="size-1.5 rounded-full bg-amber-400" />
                {item.flavor} <strong className="text-amber-400 font-mono">({item.count})</strong>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">
              ⚡ Top Puffs:
            </span>
            {metrics.topPuffs.map((item, idx) => (
              <span 
                key={idx}
                className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-xl font-mono font-bold"
              >
                {item.puffs} ({item.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. BARRA DE CONTROLES: Busca, Período, Status & Exportação */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        
        {/* Campo de Busca */}
        <div className="relative w-full md:w-80">
          <Search className="size-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, sabor, WhatsApp ou endereço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141414] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filtros de Período e Status */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="bg-[#141414] border border-white/10 text-white text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-emerald-500"
          >
            <option value="all">📅 Todo o Histórico</option>
            <option value="today">⚡ Hoje</option>
            <option value="7d">🗓️ Últimos 7 Dias</option>
            <option value="month">📆 Este Mês</option>
            <option value="6m">📈 Últimos 6 Meses (Semestral)</option>
            <option value="year">🏆 Último Ano (12M)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#141414] border border-white/10 text-white text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-emerald-500"
          >
            <option value="all">🚚 Todos os Status</option>
            <option value="CONCLUIDO">✅ Concluído</option>
            <option value="A_CAMINHO">🛵 A Caminho</option>
            <option value="PREPARANDO">⏳ Preparando</option>
            <option value="PENDENTE">🟡 Pendente</option>
            <option value="CANCELADO">❌ Cancelado</option>
          </select>

          <button
            onClick={exportToCSV}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar dados para planilha Excel / CSV"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

        </div>
      </div>

      {/* 4. TABELA / MURAL DETALHADO DE VENDAS */}
      {loading ? (
        <div className="p-12 text-center text-white/50">Carregando histórico de vendas...</div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 text-center text-white/40 space-y-3">
          <ShoppingBag className="size-10 text-white/20 mx-auto" />
          <p className="text-sm font-semibold text-white">Nenhuma venda encontrada para os filtros selecionados.</p>
          <p className="text-xs max-w-md mx-auto">
            Tente ajustar o termo de busca ou o período selecionado.
          </p>
        </div>
      ) : (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-[#121212] text-[10px] font-extrabold uppercase tracking-wider text-white/50">
                  <th className="py-3.5 px-4">Data & Horário</th>
                  <th className="py-3.5 px-4">Cliente & WhatsApp</th>
                  <th className="py-3.5 px-4">Produtos / Sabores</th>
                  <th className="py-3.5 px-4">Destino / Endereço</th>
                  <th className="py-3.5 px-4 text-right">Valor Total</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-white">
                {filteredSales.map(sale => {
                  const orderDate = new Date(sale.created_at).toLocaleDateString('pt-BR');
                  const orderTime = new Date(sale.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const waNumber = sale.clean_phone.startsWith('55') ? sale.clean_phone : ('55' + sale.clean_phone);

                  return (
                    <tr 
                      key={sale.id}
                      className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      onClick={() => setSelectedSale(sale)}
                    >
                      {/* Data & Hora */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Calendar className="size-3 text-white/40" />
                          {orderDate}
                        </div>
                        <div className="text-[11px] text-white/40 font-mono mt-0.5">
                          {orderTime}
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-full bg-white/5 border border-white/10 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {sale.client_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {sale.client_name}
                              {sale.is_vip && (
                                <span className="text-[9px] font-extrabold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-full uppercase">
                                  VIP
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-white/40 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="size-2.5" />
                              {sale.client_phone}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Itens */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {sale.items.map((item, idx) => (
                            <span 
                              key={idx}
                              className="inline-flex items-center gap-1 bg-[#161616] border border-white/5 text-[11px] px-2 py-0.5 rounded-lg text-white/90"
                            >
                              <strong className="text-emerald-400">{item.quantity}x</strong>
                              <span className="truncate max-w-[120px]">{item.name || 'Pod'}</span>
                              {item.flavor && <span className="text-white/50 text-[10px]">({item.flavor})</span>}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Endereço */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="text-xs text-white/80 truncate" title={sale.address}>
                          {sale.address}
                        </div>
                        <div className="text-[10px] text-white/40 font-mono mt-0.5">
                          SBC / Grande ABC
                        </div>
                      </td>

                      {/* Valor Total */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-extrabold text-emerald-400 font-mono text-sm">
                          {formatBRL(sale.total_amount)}
                        </div>
                        <div className="text-[10px] text-white/40 font-mono">
                          {sale.payment_status}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
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
                      </td>

                      {/* Ação */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(sale);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-bold inline-flex items-center gap-1 transition-all border border-white/5 hover:border-white/20"
                        >
                          <Eye className="size-3.5" />
                          <span>Ver Raio-X</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
