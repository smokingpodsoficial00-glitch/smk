import { useState, useEffect } from "react";
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle, PackageCheck, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface OrderItem {
  product_id?: string;
  name?: string;
  flavor?: string;
  quantity?: number;
  price?: number;
}

export function FinanceDashboard() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);

  // Financial Metrics State
  const [grossRevenue, setGrossRevenue] = useState(0);
  const [cmv, setCmv] = useState(0);
  const [logisticsSubsidy, setLogisticsSubsidy] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [profitMargin, setProfitMargin] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPodsSold, setTotalPodsSold] = useState(0);

  // Stock Asset State
  const [stockAssetCost, setStockAssetCost] = useState(0);
  const [stockAssetRetail, setStockAssetRetail] = useState(0);

  const fetchFinanceData = async () => {
    if (!company?.id) {
      setGrossRevenue(0); setCmv(0); setLogisticsSubsidy(0);
      setNetProfit(0); setProfitMargin(0); setTotalOrders(0); setTotalPodsSold(0);
      setStockAssetCost(0); setStockAssetRetail(0);
      setLoading(false);
      return;
    }
    try {
      const { data: rawOrders } = await supabase
        .from('smoking_orders')
        .select('*')
        .neq('client_phone', '__SYSTEM_SMK_BEST_SELLERS__')
        .eq('company_id', company.id);

      const ordersData = (rawOrders || []).filter(o => o.client_phone !== '__SYSTEM_SMK_BEST_SELLERS__' && (!o.client_phone || !o.client_phone.startsWith('__SYSTEM_')));

      const { data: productsData } = await supabase
        .from('smoking_products')
        .select('*')
        .eq('company_id', company.id);

      // Create product cost map by id and by name/brand
      const costMap = new Map<string, number>();
      let totalStockCost = 0;
      let totalStockRetail = 0;

      if (productsData) {
        for (const p of productsData) {
          const cost = p.cost_price ? parseFloat(p.cost_price) : 0;
          const price = p.price ? parseFloat(p.price) : 0;
          const stock = p.stock || 0;

          costMap.set(p.id, cost);
          costMap.set(`${p.brand}-${p.flavor}`.toLowerCase(), cost);
          costMap.set(p.flavor.toLowerCase(), cost);

          if (p.is_active !== false) {
            totalStockCost += stock * cost;
            totalStockRetail += stock * price;
          }
        }
      }

      setStockAssetCost(totalStockCost);
      setStockAssetRetail(totalStockRetail);

      // 3. Process Orders for Financial metrics
      if (ordersData) {
        // Consider paid/completed orders or active valid sales
        const validOrders = ordersData.filter(o => 
          o.payment_status === 'PAGO' || 
          ['PREPARANDO', 'EM_ROTA', 'ENTREGUE', 'CONCLUIDO'].includes(o.delivery_status)
        );

        let revenueSum = 0;
        let cmvSum = 0;
        let shippingCollectedSum = 0;
        let estimatedShippingExpenseSum = 0;
        let podsSoldSum = 0;

        for (const order of validOrders) {
          const orderTotal = parseFloat(order.total_amount || 0);
          const shippingFee = parseFloat(order.shipping_fee || 0);
          revenueSum += orderTotal;
          shippingCollectedSum += shippingFee;

          // Estimated logistics expense per order: R$ 15.00 or shippingFee
          estimatedShippingExpenseSum += Math.max(15, shippingFee);

          const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
          for (const item of items) {
            const qty = item.quantity || 1;
            const cost = (item.product_id && costMap.get(item.product_id)) ||
                         (item.flavor && costMap.get(item.flavor.toLowerCase())) || 0;

            cmvSum += qty * cost;
            podsSoldSum += qty;
          }
        }

        const subsidy = Math.max(0, estimatedShippingExpenseSum - shippingCollectedSum);
        const net = revenueSum - cmvSum - subsidy;
        const margin = revenueSum > 0 ? (net / revenueSum) * 100 : 0;

        setGrossRevenue(revenueSum);
        setCmv(cmvSum);
        setLogisticsSubsidy(subsidy);
        setNetProfit(net);
        setProfitMargin(parseFloat(margin.toFixed(1)));
        setTotalOrders(validOrders.length);
        setTotalPodsSold(podsSoldSum);
      }
    } catch (err) {
      console.error("Erro ao calcular dados financeiros do Supabase:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();

    // Supabase Realtime Subscriptions
    const subOrders = supabase
      .channel('finance_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_orders' }, fetchFinanceData)
      .subscribe();

    const subProducts = supabase
      .channel('finance_products_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_products' }, fetchFinanceData)
      .subscribe();

    return () => {
      supabase.removeChannel(subOrders);
      supabase.removeChannel(subProducts);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <Loader2 className="size-8 text-primary animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Calculando DRE e métricas em tempo real...</p>
      </div>
    );
  }

  const cmvPct = grossRevenue > 0 ? ((cmv / grossRevenue) * 100).toFixed(1) : "0.0";
  const subsidyPct = grossRevenue > 0 ? ((logisticsSubsidy / grossRevenue) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-silver">Inteligência Financeira</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Demonstrativo de Resultado (DRE) em Tempo Real (Proteção contra Ilusão de Lucro).
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <div className="size-2 rounded-full bg-emerald-400 animate-ping" />
          Conectado ao Supabase Realtime
        </span>
      </header>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard 
          title="Faturamento Bruto Real" 
          value={formatBRL(grossRevenue)} 
          icon={<DollarSign className="size-5 text-emerald-400" />} 
          description={`${totalOrders} pedidos (${totalPodsSold} pods vendidos)`} 
        />
        <KPICard 
          title="Custo Reposição (CMV)" 
          value={formatBRL(cmv)} 
          icon={<TrendingDown className="size-5 text-red-400" />} 
          description={`${cmvPct}% do faturamento em reposição`} 
          negative
        />
        <KPICard 
          title="Subsídio de Frete" 
          value={formatBRL(logisticsSubsidy)} 
          icon={<AlertTriangle className="size-5 text-orange-400" />} 
          description={`${subsidyPct}% investidos cobrindo logística`} 
          negative
        />
        <KPICard 
          title="Lucro Líquido Real" 
          value={formatBRL(netProfit)} 
          icon={<TrendingUp className="size-5 text-primary" />} 
          description={`Margem Líquida: ${profitMargin}%`} 
          highlight
        />
      </div>

      {/* Grid Secundário: DRE + Patrimônio em Estoque */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* DRE Simplificado - Visual */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6">Detalhamento de Margem DRE (Real)</h3>
          
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="w-48 text-sm text-muted-foreground">Faturamento Bruto (100%)</div>
              <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/80 w-full rounded-full" />
              </div>
              <div className="w-28 text-right font-medium">{formatBRL(grossRevenue)}</div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-48 text-sm text-muted-foreground">Custo Reposição ({cmvPct}%)</div>
              <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden relative">
                <div 
                  className="h-full bg-red-500/80 rounded-full relative transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(5, parseFloat(cmvPct)))}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 to-red-400/30" />
                </div>
              </div>
              <div className="w-28 text-right font-medium text-red-400">-{formatBRL(cmv)}</div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-48 text-sm text-muted-foreground">Logística / Frete ({subsidyPct}%)</div>
              <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden relative">
                <div 
                  className="h-full bg-orange-500/80 rounded-full relative transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, parseFloat(subsidyPct)))}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 to-orange-400/30" />
                </div>
              </div>
              <div className="w-28 text-right font-medium text-orange-400">-{formatBRL(logisticsSubsidy)}</div>
            </div>

            <div className="h-px bg-border my-1" />

            <div className="flex items-center gap-4">
              <div className="w-48 font-semibold text-silver">Lucro Líquido ({profitMargin}%)</div>
              <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden relative">
                <div 
                  className="h-full bg-primary rounded-full relative transition-all duration-500 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                  style={{ width: `${Math.min(100, Math.max(5, profitMargin))}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20" />
                </div>
              </div>
              <div className="w-28 text-right font-bold text-silver">{formatBRL(netProfit)}</div>
            </div>
          </div>
        </div>

        {/* Card de Patrimônio Imobilizado em Estoque */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-silver font-semibold mb-4">
              <PackageCheck className="size-5 text-emerald-400" />
              Patrimônio em Estoque
            </div>
            
            <div className="flex flex-col gap-4 mt-2">
              <div className="bg-elevated/60 border border-border rounded-xl p-4">
                <span className="text-xs text-muted-foreground font-semibold uppercase">Valor a Custo de Reposição</span>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                  {formatBRL(stockAssetCost)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Capital imobilizado no estoque atual.
                </p>
              </div>

              <div className="bg-elevated/60 border border-border rounded-xl p-4">
                <span className="text-xs text-muted-foreground font-semibold uppercase">Valor Potencial de Venda</span>
                <div className="text-2xl font-bold text-silver font-mono mt-1">
                  {formatBRL(stockAssetRetail)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Faturamento bruto total se todo o estoque for vendido.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-4 text-xs text-muted-foreground font-mono flex items-center justify-between">
            <span>Margem Estoque Estimada</span>
            <span className="text-emerald-400 font-bold">
              {stockAssetCost > 0 ? `${(((stockAssetRetail - stockAssetCost) / stockAssetRetail) * 100).toFixed(1)}%` : '0.0%'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

function KPICard({ title, value, icon, description, negative, highlight }: { title: string, value: string, icon: React.ReactNode, description: string, negative?: boolean, highlight?: boolean }) {
  return (
    <div className={`p-5 rounded-2xl border transition-colors ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-card border-border hover:border-white/10'}`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className={`p-2 rounded-lg ${highlight ? 'bg-primary/20' : 'bg-elevated'}`}>
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-bold tracking-tight mb-1 ${negative ? 'text-red-400' : 'text-white'}`}>
        {value}
      </div>
      <p className={`text-xs ${highlight ? 'text-primary' : 'text-muted-foreground'}`}>{description}</p>
    </div>
  );
}
