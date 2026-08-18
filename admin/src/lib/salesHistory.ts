import { supabase } from "@/lib/supabase";

export interface SaleItem {
  name: string;
  flavor?: string;
  brand?: string;
  puffs?: number;
  quantity: number;
  price: number;
  cost?: number;
}

export interface DetailedSale {
  id: string;
  company_id?: string;
  client_name: string;
  client_phone: string;
  clean_phone: string;
  address: string;
  total_amount: number;
  items: SaleItem[];
  delivery_status: string;
  payment_status: string;
  created_at: string;
  source?: string;
  notes?: string;
  // Campos cruzados de CRM
  client_total_orders?: number;
  client_ltv?: number;
  is_vip?: boolean;
}

export interface SalesMacroMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  uniqueClientsCount: number;
  repurchaseRate: number; // %
  ltvAnnual: number; // Média de faturamento por cliente nos últimos 12 meses
  ltvSemiannual: number; // Média de faturamento por cliente nos últimos 6 meses
  ltvOverall: number; // LTV geral histórico
  revenueAnnual: number;
  revenueSemiannual: number;
  topFlavors: { flavor: string; count: number }[];
  topProducts: { name: string; count: number }[];
  topPuffs: { puffs: string; count: number }[];
}

export async function fetchSalesHistory(companyId?: string): Promise<{ sales: DetailedSale[]; metrics: SalesMacroMetrics }> {
  if (!companyId) {
    return {
      sales: [],
      metrics: {
        totalRevenue: 0,
        totalOrders: 0,
        averageTicket: 0,
        uniqueClientsCount: 0,
        repurchaseRate: 0,
        ltvAnnual: 0,
        ltvSemiannual: 0,
        ltvOverall: 0,
        revenueAnnual: 0,
        revenueSemiannual: 0,
        topFlavors: [],
        topProducts: [],
        topPuffs: [],
      }
    };
  }

  try {
    // 1. Buscar Pedidos
    const { data: rawOrders, error: ordersErr } = await supabase
      .from('smoking_orders')
      .select('*')
      .neq('client_phone', '__SYSTEM_SMK_BEST_SELLERS__')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (ordersErr) {
      console.error("Erro ao buscar smoking_orders para histórico:", ordersErr);
    }

    const validOrders = (rawOrders || []).filter(
      (o: any) => o.client_phone !== '__SYSTEM_SMK_BEST_SELLERS__' && (!o.client_phone || !o.client_phone.startsWith('__SYSTEM_'))
    );

    // 2. Buscar Clientes Mestre para LTV e status VIP
    let clientsMap = new Map<string, any>();
    try {
      const { data: clientsData } = await supabase.from('smoking_clients').select('*');
      if (clientsData && Array.isArray(clientsData)) {
        for (const c of clientsData) {
          if (c && c.phone) {
            const clean = String(c.phone).replace(/\D/g, '');
            if (clean) clientsMap.set(clean, c);
          }
        }
      }
    } catch (e) {}

    // 3. Processar Vendas
    const clientAggregates = new Map<string, { totalSpent: number; orderCount: number; orders12m: number; orders6m: number; spent12m: number; spent6m: number }>();
    const now = new Date().getTime();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;

    let totalRevenue = 0;
    let totalOrders = 0;
    let revenueAnnual = 0;
    let revenueSemiannual = 0;

    const flavorCounts = new Map<string, number>();
    const productCounts = new Map<string, number>();
    const puffsCounts = new Map<string, number>();

    const sales: DetailedSale[] = validOrders.map((o: any) => {
      const cleanPhone = String(o.client_phone || '').replace(/\D/g, '');
      const orderAmount = parseFloat(o.total_amount || 0);
      const orderTime = new Date(o.created_at).getTime();
      const isCompleted = o.delivery_status !== 'CANCELADO';

      if (isCompleted) {
        totalRevenue += orderAmount;
        totalOrders += 1;

        if (orderTime >= oneYearAgo) {
          revenueAnnual += orderAmount;
        }
        if (orderTime >= sixMonthsAgo) {
          revenueSemiannual += orderAmount;
        }

        // Agregação por cliente
        const currentAgg = clientAggregates.get(cleanPhone) || {
          totalSpent: 0,
          orderCount: 0,
          orders12m: 0,
          orders6m: 0,
          spent12m: 0,
          spent6m: 0
        };

        currentAgg.totalSpent += orderAmount;
        currentAgg.orderCount += 1;

        if (orderTime >= oneYearAgo) {
          currentAgg.orders12m += 1;
          currentAgg.spent12m += orderAmount;
        }
        if (orderTime >= sixMonthsAgo) {
          currentAgg.orders6m += 1;
          currentAgg.spent6m += orderAmount;
        }

        clientAggregates.set(cleanPhone, currentAgg);

        // Itens
        const itemsArr: SaleItem[] = Array.isArray(o.items) ? o.items : [];
        itemsArr.forEach(item => {
          const qty = item.quantity || 1;
          if (item.flavor) {
            flavorCounts.set(item.flavor, (flavorCounts.get(item.flavor) || 0) + qty);
          }
          if (item.name) {
            productCounts.set(item.name, (productCounts.get(item.name) || 0) + qty);
          }
          if (item.puffs) {
            const pKey = `${item.puffs} puffs`;
            puffsCounts.set(pKey, (puffsCounts.get(pKey) || 0) + qty);
          }
        });
      }

      const clientInfo = clientsMap.get(cleanPhone);
      const agg = clientAggregates.get(cleanPhone);

      return {
        id: o.id,
        company_id: o.company_id,
        client_name: o.client_name || clientInfo?.name || 'Cliente',
        client_phone: o.client_phone || '',
        clean_phone: cleanPhone,
        address: o.address || clientInfo?.address || 'Endereço não informado',
        total_amount: orderAmount,
        items: Array.isArray(o.items) ? o.items : [],
        delivery_status: o.delivery_status || 'CONCLUIDO',
        payment_status: o.payment_status || 'PAGO',
        created_at: o.created_at,
        source: o.source || 'whatsapp',
        notes: o.notes || '',
        client_total_orders: agg?.orderCount || 1,
        client_ltv: agg?.totalSpent || orderAmount,
        is_vip: clientInfo?.in_vip_group || (agg ? agg.totalSpent >= 400 : false),
      };
    });

    // 4. Calcular Métricas Macro
    const uniqueClientsCount = clientAggregates.size;
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Taxa de Recompra: Clientes com mais de 1 pedido / Total de Clientes
    let recurringClientsCount = 0;
    let sumSpent12m = 0;
    let countClients12m = 0;
    let sumSpent6m = 0;
    let countClients6m = 0;

    clientAggregates.forEach(agg => {
      if (agg.orderCount > 1) {
        recurringClientsCount += 1;
      }
      if (agg.orders12m > 0) {
        sumSpent12m += agg.spent12m;
        countClients12m += 1;
      }
      if (agg.orders6m > 0) {
        sumSpent6m += agg.spent6m;
        countClients6m += 1;
      }
    });

    const repurchaseRate = uniqueClientsCount > 0 ? (recurringClientsCount / uniqueClientsCount) * 100 : 0;
    const ltvOverall = uniqueClientsCount > 0 ? totalRevenue / uniqueClientsCount : 0;
    const ltvAnnual = countClients12m > 0 ? sumSpent12m / countClients12m : 0;
    const ltvSemiannual = countClients6m > 0 ? sumSpent6m / countClients6m : 0;

    // Top Flavors
    const topFlavors = Array.from(flavorCounts.entries())
      .map(([flavor, count]) => ({ flavor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top Products
    const topProducts = Array.from(productCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top Puffs
    const topPuffs = Array.from(puffsCounts.entries())
      .map(([puffs, count]) => ({ puffs, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      sales,
      metrics: {
        totalRevenue,
        totalOrders,
        averageTicket,
        uniqueClientsCount,
        repurchaseRate,
        ltvAnnual,
        ltvSemiannual,
        ltvOverall,
        revenueAnnual,
        revenueSemiannual,
        topFlavors,
        topProducts,
        topPuffs,
      }
    };
  } catch (err) {
    console.error("Erro no processamento de vendas macro:", err);
    return {
      sales: [],
      metrics: {
        totalRevenue: 0,
        totalOrders: 0,
        averageTicket: 0,
        uniqueClientsCount: 0,
        repurchaseRate: 0,
        ltvAnnual: 0,
        ltvSemiannual: 0,
        ltvOverall: 0,
        revenueAnnual: 0,
        revenueSemiannual: 0,
        topFlavors: [],
        topProducts: [],
        topPuffs: [],
      }
    };
  }
}
