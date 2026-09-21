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
  order_code?: string;
  client_name: string;
  client_phone: string;
  clean_phone: string;
  address: string;
  total_amount: number;
  subtotal?: number;
  delivery_fee?: number;
  items: SaleItem[];
  delivery_status: string;
  payment_status: string;
  payment_method?: string;
  created_at: string;
  source?: string;
  notes?: string;
  // Contexto do comprador
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

  // Métricas Solicitadas: Anual, Semestral, Trimestral e Mensal
  revenueAnnual: number;
  ordersAnnual: number;
  ltvAnnual: number;

  revenueSemiannual: number;
  ordersSemiannual: number;
  ltvSemiannual: number;

  revenueQuarterly: number;
  ordersQuarterly: number;
  ltvQuarterly: number;

  revenueMonthly: number;
  ordersMonthly: number;

  topFlavors: { flavor: string; count: number }[];
  topProducts: { name: string; count: number }[];
  topPuffs: { puffs: string; count: number }[];
}

export async function fetchSalesHistory(companyId?: string): Promise<{ sales: DetailedSale[]; metrics: SalesMacroMetrics }> {
  try {
    // 1. Buscar Todas as Transações / Pedidos com suporte a company_id e orders legadas (company_id is null)
    let query = supabase
      .from('smoking_orders')
      .select('*')
      .neq('client_phone', '__SYSTEM_SMK_BEST_SELLERS__')
      .order('created_at', { ascending: false });

    const isOfficialStore = !companyId || companyId === 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';

    if (companyId) {
      if (isOfficialStore) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      } else {
        query = query.eq('company_id', companyId);
      }
    }

    const { data: rawOrders, error: ordersErr } = await query;

    if (ordersErr) {
      console.error("Erro ao buscar smoking_orders para histórico:", ordersErr);
    }

    const validOrders = (rawOrders || []).filter(
      (o: any) => o.client_phone !== '__SYSTEM_SMK_BEST_SELLERS__' && (!o.client_phone || !o.client_phone.startsWith('__SYSTEM_'))
    );

    // 2. Buscar Clientes Mestre para dados cadastrais, LTV e status VIP
    let clientsMap = new Map<string, any>();
    try {
      let clientsQuery = supabase.from('smoking_clients').select('*');
      if (companyId) {
        if (isOfficialStore) {
          clientsQuery = clientsQuery.or(`company_id.eq.${companyId},company_id.is.null`);
        } else {
          clientsQuery = clientsQuery.eq('company_id', companyId);
        }
      }
      const { data: clientsData } = await clientsQuery;
      if (clientsData && Array.isArray(clientsData)) {
        for (const c of clientsData) {
          if (c && c.phone) {
            const clean = String(c.phone).replace(/\D/g, '');
            if (clean) clientsMap.set(clean, c);
          }
        }
      }
    } catch (e) {
      console.error("Erro ao buscar smoking_clients:", e);
    }

    // 3. Processar Cada Venda e Janelas Temporais
    const now = new Date().getTime();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;
    const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    let totalRevenue = 0;
    let totalOrders = 0;

    let revenueAnnual = 0;
    let ordersAnnual = 0;

    let revenueSemiannual = 0;
    let ordersSemiannual = 0;

    let revenueQuarterly = 0;
    let ordersQuarterly = 0;

    let revenueMonthly = 0;
    let ordersMonthly = 0;

    const clientAggregates = new Map<string, { 
      totalSpent: number; 
      orderCount: number; 
      spent12m: number; 
      spent6m: number; 
      spent3m: number;
    }>();

    const flavorCounts = new Map<string, number>();
    const productCounts = new Map<string, number>();
    const puffsCounts = new Map<string, number>();

    const sales: DetailedSale[] = validOrders.map((o: any, idx: number) => {
      const cleanPhone = String(o.client_phone || '').replace(/\D/g, '');
      const orderAmount = parseFloat(o.total_amount || 0);
      const orderTime = new Date(o.created_at).getTime();
      const isCompleted = o.delivery_status !== 'CANCELADO';

      if (isCompleted) {
        totalRevenue += orderAmount;
        totalOrders += 1;

        if (orderTime >= oneYearAgo) {
          revenueAnnual += orderAmount;
          ordersAnnual += 1;
        }
        if (orderTime >= sixMonthsAgo) {
          revenueSemiannual += orderAmount;
          ordersSemiannual += 1;
        }
        if (orderTime >= threeMonthsAgo) {
          revenueQuarterly += orderAmount;
          ordersQuarterly += 1;
        }
        if (orderTime >= oneMonthAgo) {
          revenueMonthly += orderAmount;
          ordersMonthly += 1;
        }

        // Agregação por cliente
        const currentAgg = clientAggregates.get(cleanPhone) || {
          totalSpent: 0,
          orderCount: 0,
          spent12m: 0,
          spent6m: 0,
          spent3m: 0,
        };

        currentAgg.totalSpent += orderAmount;
        currentAgg.orderCount += 1;

        if (orderTime >= oneYearAgo) currentAgg.spent12m += orderAmount;
        if (orderTime >= sixMonthsAgo) currentAgg.spent6m += orderAmount;
        if (orderTime >= threeMonthsAgo) currentAgg.spent3m += orderAmount;

        clientAggregates.set(cleanPhone, currentAgg);

        // Itens
        const itemsArr: any[] = Array.isArray(o.items) ? o.items : [];
        itemsArr.forEach(item => {
          const qty = item.quantity || 1;
          const flavorName = item.flavor || '';
          const prodName = item.name || item.model || '';
          const puffsVal = item.puffs;

          if (flavorName) {
            flavorCounts.set(flavorName, (flavorCounts.get(flavorName) || 0) + qty);
          }
          if (prodName) {
            productCounts.set(prodName, (productCounts.get(prodName) || 0) + qty);
          }
          if (puffsVal) {
            const pKey = `${puffsVal} puffs`;
            puffsCounts.set(pKey, (puffsCounts.get(pKey) || 0) + qty);
          }
        });
      }

      const clientInfo = clientsMap.get(cleanPhone);
      const agg = clientAggregates.get(cleanPhone);
      const shortId = (o.id || `venda_${idx}`).slice(0, 8).toUpperCase();

      // Mapeamento minucioso do endereço (shipping_address, address, clientInfo.address)
      const resolvedAddress = (
        o.shipping_address || 
        o.address || 
        o.destination_address || 
        o.delivery_address || 
        clientInfo?.address || 
        'Endereço não informado'
      ).trim();

      // Mapeamento dos itens do pedido
      const mappedItems: SaleItem[] = Array.isArray(o.items) ? o.items.map((i: any) => ({
        name: i.name || i.model || 'Pod Descartável',
        flavor: i.flavor || '',
        brand: i.brand || '',
        puffs: i.puffs,
        quantity: i.quantity || 1,
        price: i.price ? parseFloat(i.price) : (i.unit_price ? parseFloat(i.unit_price) : 0),
        cost: i.cost_price || i.cost || 0
      })) : [];

      return {
        id: o.id,
        order_code: `#SMK-${shortId}`,
        company_id: o.company_id,
        client_name: o.client_name || clientInfo?.name || 'Cliente Sem Nome',
        client_phone: o.client_phone || clientInfo?.phone || '',
        clean_phone: cleanPhone,
        address: resolvedAddress,
        total_amount: orderAmount,
        subtotal: o.subtotal ? parseFloat(o.subtotal) : orderAmount,
        delivery_fee: o.shipping_fee ? parseFloat(o.shipping_fee) : (o.delivery_fee ? parseFloat(o.delivery_fee) : 0),
        items: mappedItems,
        delivery_status: o.delivery_status || 'CONCLUIDO',
        payment_status: o.payment_status || 'PAGO',
        payment_method: o.payment_method || 'PIX',
        created_at: o.created_at,
        source: o.source || 'WhatsApp',
        notes: o.notes || '',
        client_total_orders: agg?.orderCount || 1,
        client_ltv: agg?.totalSpent || orderAmount,
        is_vip: clientInfo?.in_vip_group || (agg ? agg.totalSpent >= 400 : false),
      };
    });

    // 4. Calcular Métricas de LTV por Período
    const uniqueClientsCount = clientAggregates.size;
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    let recurringClientsCount = 0;
    let sumSpent12m = 0;
    let countClients12m = 0;
    let sumSpent6m = 0;
    let countClients6m = 0;
    let sumSpent3m = 0;
    let countClients3m = 0;

    clientAggregates.forEach(agg => {
      if (agg.orderCount > 1) recurringClientsCount += 1;
      if (agg.spent12m > 0) {
        sumSpent12m += agg.spent12m;
        countClients12m += 1;
      }
      if (agg.spent6m > 0) {
        sumSpent6m += agg.spent6m;
        countClients6m += 1;
      }
      if (agg.spent3m > 0) {
        sumSpent3m += agg.spent3m;
        countClients3m += 1;
      }
    });

    const repurchaseRate = uniqueClientsCount > 0 ? (recurringClientsCount / uniqueClientsCount) * 100 : 0;
    const ltvAnnual = countClients12m > 0 ? sumSpent12m / countClients12m : 0;
    const ltvSemiannual = countClients6m > 0 ? sumSpent6m / countClients6m : 0;
    const ltvQuarterly = countClients3m > 0 ? sumSpent3m / countClients3m : 0;

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
        revenueAnnual,
        ordersAnnual,
        ltvAnnual,
        revenueSemiannual,
        ordersSemiannual,
        ltvSemiannual,
        revenueQuarterly,
        ordersQuarterly,
        ltvQuarterly,
        revenueMonthly,
        ordersMonthly,
        topFlavors,
        topProducts,
        topPuffs,
      }
    };
  } catch (error) {
    console.error("Erro geral em fetchSalesHistory:", error);
    return {
      sales: [],
      metrics: {
        totalRevenue: 0,
        totalOrders: 0,
        averageTicket: 0,
        uniqueClientsCount: 0,
        repurchaseRate: 0,
        revenueAnnual: 0,
        ordersAnnual: 0,
        ltvAnnual: 0,
        revenueSemiannual: 0,
        ordersSemiannual: 0,
        ltvSemiannual: 0,
        revenueQuarterly: 0,
        ordersQuarterly: 0,
        ltvQuarterly: 0,
        revenueMonthly: 0,
        ordersMonthly: 0,
        topFlavors: [],
        topProducts: [],
        topPuffs: [],
      }
    };
  }
}
