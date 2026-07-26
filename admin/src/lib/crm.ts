import { supabase } from "@/lib/supabase";

export interface RealClient {
  id: string;
  phone: string;
  name: string;
  address: string;
  spent: number;
  ordersCount: number;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  lastProduct: string;
  lastFlavor: string;
  lastPuffs: number;
  expectedCycleDays: number;
  segment: 'champion' | 'loyal' | 'new' | 'at_risk';
  orders: any[];
}

export async function fetchLiveClients(): Promise<RealClient[]> {
  try {
    // 1. Buscar todos os pedidos do Supabase
    const { data: orders, error: ordersErr } = await supabase
      .from('smoking_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersErr) {
      console.error("Erro ao buscar smoking_orders:", ordersErr);
    }

    // 2. Buscar cadastro de clientes (se houver)
    const { data: customers } = await supabase
      .from('smoking_customers')
      .select('*');

    const customerMap = new Map<string, any>();
    if (customers && Array.isArray(customers)) {
      for (const c of customers) {
        if (c && c.phone) {
          const clean = String(c.phone).replace(/\D/g, '');
          if (clean) customerMap.set(clean, c);
        }
      }
    }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return [];
    }

    // Agrupar pedidos por número de telefone do cliente
    const clientGroups = new Map<string, any[]>();

    for (const order of orders) {
      if (!order) continue;
      const phoneRaw = String(order.client_phone || order.customer_phone || order.phone || '5511999999999');
      const phoneClean = phoneRaw.replace(/\D/g, '') || '5511999999999';

      if (!clientGroups.has(phoneClean)) {
        clientGroups.set(phoneClean, []);
      }
      clientGroups.get(phoneClean)!.push(order);
    }

    const result: RealClient[] = [];
    const now = new Date().getTime();

    for (const [phone, clientOrders] of clientGroups.entries()) {
      if (!clientOrders || clientOrders.length === 0) continue;

      // Ordenar por data (mais recente primeiro)
      clientOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      const latestOrder = clientOrders[0] || {};
      const registeredCustomer = customerMap.get(phone);

      const name = registeredCustomer?.name || latestOrder.client_name || latestOrder.customer_name || `Cliente ${phone.slice(-4)}`;
      const address = registeredCustomer?.address || latestOrder.shipping_address || latestOrder.delivery_address || 'Endereço não informado';
      const rawPhone = latestOrder.client_phone || latestOrder.customer_phone || phone || '5511999999999';

      // Calcular Gasto Total (LTV)
      const validOrders = clientOrders.filter(o => 
        o && (
          o.payment_status === 'PAGO' || 
          ['PREPARANDO', 'EM_ROTA', 'ENTREGUE', 'CONCLUIDO'].includes(o.delivery_status)
        )
      );

      const spent = validOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
      const ordersCount = validOrders.length > 0 ? validOrders.length : clientOrders.length;

      const lastOrderDateStr = latestOrder.created_at ? new Date(latestOrder.created_at).toLocaleDateString('pt-BR') : 'Hoje';
      const lastOrderTimestamp = latestOrder.created_at ? new Date(latestOrder.created_at).getTime() : now;
      const daysSinceLastOrder = Math.max(0, Math.floor((now - lastOrderTimestamp) / (1000 * 60 * 60 * 24)));

      // Extrair último pod comprado
      const itemsList = Array.isArray(latestOrder.items) ? latestOrder.items : [];
      const firstItem = itemsList.length > 0 ? itemsList[0] : null;
      const lastProduct = firstItem ? `${firstItem.name || 'Pod'} ${firstItem.flavor || ''}` : 'Vape Descartável';
      const lastFlavor = firstItem?.flavor || 'Frutado';
      const lastPuffs = firstItem?.puffs || 5000;

      // Estimar ciclo de secagem do vape (Puffs / consumo médio)
      const expectedCycleDays = lastPuffs >= 10000 ? 35 : lastPuffs >= 8000 ? 25 : 20;

      // Calcular Segmento RFM
      let segment: 'champion' | 'loyal' | 'new' | 'at_risk' = 'new';
      if (daysSinceLastOrder > 30) {
        segment = 'at_risk';
      } else if (spent >= 300 || ordersCount >= 3) {
        segment = 'champion';
      } else if (ordersCount >= 2) {
        segment = 'loyal';
      } else {
        segment = 'new';
      }

      result.push({
        id: phone,
        phone: String(rawPhone),
        name: String(name),
        address: String(address),
        spent: isNaN(spent) ? 0 : spent,
        ordersCount: isNaN(ordersCount) ? 1 : ordersCount,
        lastOrderDate: lastOrderDateStr,
        daysSinceLastOrder: isNaN(daysSinceLastOrder) ? 0 : daysSinceLastOrder,
        lastProduct: String(lastProduct),
        lastFlavor: String(lastFlavor),
        lastPuffs,
        expectedCycleDays,
        segment,
        orders: clientOrders,
      });
    }

    return result;
  } catch (err) {
    console.error("Erro ao buscar clientes do Supabase:", err);
    return [];
  }
}
