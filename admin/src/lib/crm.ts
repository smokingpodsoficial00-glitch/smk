import { supabase } from "@/lib/supabase";

export type RealClient = {
  id: string;
  phone: string;
  cleanPhone: string;
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
  estimatedDaysLeft: number;
  isEndingSoon: boolean;
  whatsappMessage: string;
  whatsappUrl: string;
  segment: 'champion' | 'loyal' | 'new' | 'at_risk';
  orders: any[];
};

// Exportacao de tempo de execucao para evitar qualquer erro no Vite
export const RealClient = {};

export async function fetchLiveClients(companyId?: string): Promise<RealClient[]> {
  if (!companyId) return [];
  try {
    const { data: orders, error: ordersErr } = await supabase
      .from('smoking_orders')
      .select('*')
      .eq('company_id', companyId)
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

    // Agrupar pedidos por cliente por número de WhatsApp único
    const clientGroups = new Map<string, any[]>();

    for (const order of orders) {
      if (!order) continue;
      const phoneRaw = String(order.client_phone || order.customer_phone || order.phone || '5511999999999');
      const phoneClean = phoneRaw.replace(/\D/g, '') || '5511999999999';
      const clientName = String(order.client_name || order.customer_name || '').trim().toLowerCase();

      // Se for número de teste genérico do emulador (ex: 11988887777 ou 5511999999999),
      // agrupa pelo NOME para diferenciar clientes fictícios de teste
      const isTestPhone = phoneClean === '11988887777' || phoneClean === '5511999999999' || phoneClean === '5511988887777';
      const groupKey = (isTestPhone && clientName) ? `test_${clientName}` : phoneClean;

      if (!clientGroups.has(groupKey)) {
        clientGroups.set(groupKey, []);
      }
      clientGroups.get(groupKey)!.push(order);
    }

    const result: RealClient[] = [];
    const now = new Date().getTime();

    for (const [phone, clientOrders] of clientGroups.entries()) {
      if (!clientOrders || clientOrders.length === 0) continue;

      // Ordenar por data (mais recente primeiro)
      clientOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      const latestOrder = clientOrders[0] || {};
      const registeredCustomer = customerMap.get(phone);

      const rawPhone = latestOrder.client_phone || latestOrder.customer_phone || phone || '5511999999999';
      const cleanPhone = String(rawPhone).replace(/\D/g, '');

      const name = registeredCustomer?.name || latestOrder.client_name || latestOrder.customer_name || `Cliente ${cleanPhone.slice(-4)}`;
      const address = registeredCustomer?.address || latestOrder.shipping_address || latestOrder.delivery_address || 'Endereço não informado';

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
      const lastProduct = firstItem ? `${firstItem.name || 'Pod'} ${firstItem.flavor || ''}` : 'Ignite V50';
      const lastFlavor = firstItem?.flavor || 'Frutado';
      const lastPuffs = firstItem?.puffs || 5000;

      // Estimar ciclo de duração do pod
      let expectedCycleDays = 14;
      if (lastPuffs >= 15000) {
        expectedCycleDays = 30;
      } else if (lastPuffs >= 10000) {
        expectedCycleDays = 22;
      } else if (lastPuffs >= 8000) {
        expectedCycleDays = 18;
      } else {
        expectedCycleDays = 12;
      }

      const estimatedDaysLeft = Math.max(0, expectedCycleDays - daysSinceLastOrder);
      const isEndingSoon = estimatedDaysLeft <= 4 || daysSinceLastOrder >= expectedCycleDays;

      // Mensagem personalizada de recompra no WhatsApp
      const whatsappMessage = `E aí ${name}! Tudo certo? 💨 Vi que já faz um tempinho desde a sua última compra do ${lastProduct}. Seu pod já tá na final? Já quer ir garantindo o próximo para não ficar na mão? Me avisa aqui!`;
      const whatsappUrl = `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;

      // Calcular Categorização de Fidelidade
      let segment: 'champion' | 'loyal' | 'new' | 'at_risk' = 'new';
      if (daysSinceLastOrder > 25) {
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
        cleanPhone,
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
        estimatedDaysLeft,
        isEndingSoon,
        whatsappMessage,
        whatsappUrl,
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
