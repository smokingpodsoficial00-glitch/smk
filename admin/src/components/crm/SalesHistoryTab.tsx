import React, { useState, useEffect } from 'react';
import { 
  Search, Calendar, Eye, Phone, MapPin, 
  Download, Receipt, CreditCard, Trash2 
} from 'lucide-react';
import { formatBRL } from '@/lib/cart';
import { fetchSalesHistory, type DetailedSale } from '@/lib/salesHistory';
import { useAuth } from '@/contexts/AuthContext';
import { SaleDetailModal } from './SaleDetailModal';
import { supabase } from '@/lib/supabase';
import { deleteOrderWithStockRestoration } from '@/lib/orders';

export function SalesHistoryTab() {
  const { company } = useAuth();
  const [sales, setSales] = useState<DetailedSale[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7d' | '30d' | '3m' | '6m' | '12m'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal de Detalhe da Venda
  const [selectedSale, setSelectedSale] = useState<DetailedSale | null>(null);

  const handleDeleteSale = async (sale: DetailedSale) => {
    if (confirm(`Deseja realmente excluir a venda #${sale.order_code || sale.id.slice(0, 8)} (${sale.client_name}) de ${formatBRL(sale.total_amount)}? O estoque dos produtos será restaurado.`)) {
      try {
        const res = await deleteOrderWithStockRestoration(sale.id, { restoreStock: true });
        if (res.success) {
          alert('✅ Venda excluída com sucesso e estoque devolvido.');
          loadData();
        } else {
          alert('Erro ao excluir venda: ' + (res.error || 'Erro desconhecido'));
        }
      } catch (err: any) {
        alert('Erro ao excluir venda: ' + err.message);
      }
    }
  };

  const loadData = async () => {
    if (!company?.id) return;
    try {
      const data = await fetchSalesHistory(company.id);
      // Garantir ordenação estritamente cronológica: mais recente -> mais antigo
      const sorted = (data.sales || []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setSales(sorted);
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
      const matchName = (sale.client_name || '').toLowerCase().includes(q);
      const matchPhone = (sale.clean_phone || '').includes(q) || (sale.client_phone || '').includes(q);
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
    link.setAttribute("download", `historico_vendas_detalhado_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* ━━━ 1. BARRA DE CONTROLES: Busca, Período, Status & Exportação ━━━ */}
      <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-lg">
        
        {/* Campo de Busca por Venda */}
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código #SMK, cliente, sabor, WhatsApp ou endereço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141418] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-all font-sans"
          />
        </div>

        {/* Filtros de Janela Temporal, Status e Botão de Exportação */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="bg-[#141418] border border-white/10 text-white text-xs rounded-xl px-3.5 py-2.5 cursor-pointer focus:outline-none focus:border-white/30 font-medium transition-all"
          >
            <option value="all">Todas as Vendas</option>
            <option value="today">Vendas de Hoje</option>
            <option value="7d">Últimos 7 Dias</option>
            <option value="30d">Últimos 30 Dias</option>
            <option value="3m">Trimestral (3 Meses)</option>
            <option value="6m">Semestral (6 Meses)</option>
            <option value="12m">Anual (12 Meses)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#141418] border border-white/10 text-white text-xs rounded-xl px-3.5 py-2.5 cursor-pointer focus:outline-none focus:border-white/30 font-medium transition-all"
          >
            <option value="all">Todos os Status</option>
            <option value="CONCLUIDO">Concluído / Entregue</option>
            <option value="A_CAMINHO">A Caminho (Motoboy)</option>
            <option value="PREPARANDO">Preparando</option>
            <option value="PENDENTE">Pendente</option>
            <option value="CANCELADO">Cancelado</option>
          </select>

          <button
            onClick={exportToCSV}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Exportar dados para planilha CSV"
          >
            <Download className="size-3.5" />
            <span>Exportar Vendas</span>
          </button>

        </div>
      </div>

      {/* ━━━ 2. HISTÓRICO DE VENDAS (FEED DETALHADO) ━━━ */}
      {loading ? (
        <div className="p-12 text-center text-white/50 text-xs font-mono">Carregando histórico de vendas...</div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-[#0e0e10] border border-white/15 rounded-2xl p-12 text-center text-white/40 space-y-3">
          <Receipt className="size-10 text-white/20 mx-auto" />
          <p className="text-sm font-semibold text-white">Nenhuma venda encontrada para os filtros selecionados.</p>
          <p className="text-xs max-w-md mx-auto text-muted-foreground">
            Tente ajustar o termo de busca ou a janela temporal selecionada.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSales.map(sale => {
            const orderDate = new Date(sale.created_at).toLocaleDateString('pt-BR');
            const orderTime = new Date(sale.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className="bg-[#0e0e10] hover:bg-[#141418] border border-white/15 hover:border-white/30 rounded-2xl p-4 sm:p-5 transition-all shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 cursor-pointer group"
              >
                {/* Bloco 1: Identificação da Venda & Horário */}
                <div className="flex items-start gap-3.5 min-w-[200px] shrink-0">
                  <div className="size-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Receipt className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {sale.order_code || `#${sale.id.slice(0, 8)}`}
                      </span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase bg-white/5 text-white/70 border border-white/10">
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
                <div className="flex-1 min-w-0 max-w-xl">
                  <div className="flex flex-wrap gap-1.5">
                    {sale.items.map((item, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-[#18181c] border border-white/10 text-xs px-3 py-1 rounded-xl text-white font-medium shadow-sm"
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

                  <div className="text-xs text-white/50 flex items-center gap-1.5 mt-2">
                    <MapPin className="size-3.5 text-white/40 shrink-0" />
                    <span>{sale.address || 'Endereço não informado'}</span>
                  </div>
                </div>

                {/* Bloco 3: Comprador & Contato */}
                <div className="min-w-[170px] shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs sm:text-sm font-bold text-white">
                      {sale.client_name || 'Cliente'}
                    </div>
                    {sale.is_vip && (
                      <span className="text-[9px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full uppercase">
                        VIP
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/50 font-mono flex items-center gap-1.5 mt-0.5">
                    <Phone className="size-3 text-white/40" />
                    <span>{sale.client_phone}</span>
                  </div>
                </div>

                {/* Bloco 4: Total Pago, Status & Ação Raio-X */}
                <div className="flex items-center justify-between lg:justify-end gap-4 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-white/5 shrink-0">
                  <div className="text-left lg:text-right">
                    <div className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono">
                      {formatBRL(sale.total_amount)}
                    </div>
                    <div className="text-[10px] text-white/40 font-mono flex items-center lg:justify-end gap-1.5 mt-0.5">
                      <CreditCard className="size-3 text-white/40" />
                      <span>{sale.payment_method || 'PIX'} • {sale.payment_status}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
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
                      className="size-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer"
                      title="Ver Raio-X da Venda"
                    >
                      <Eye className="size-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSale(sale);
                      }}
                      className="size-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center transition-all cursor-pointer"
                      title="Excluir Venda (Devolver ao Estoque)"
                    >
                      <Trash2 className="size-4" />
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
        onDeleteSale={() => loadData()}
      />

    </div>
  );
}
