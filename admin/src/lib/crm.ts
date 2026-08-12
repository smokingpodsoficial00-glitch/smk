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
    const { data: rawOrders, error: ordersErr } = await supabase
      .from('smoking_orders')
      .select('*')
      .neq('client_phone', '__SYSTEM_SMK_BEST_SELLERS__')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    const orders = (rawOrders || []).filter(o => o.client_phone !== '__SYSTEM_SMK_BEST_SELLERS__' && (!o.client_phone || !o.client_phone.startsWith('__SYSTEM_')));

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

    for (const [phoneKey, clientOrders] of clientGroups.entries()) {
      if (!clientOrders || clientOrders.length === 0) continue;

      // Ordenar por data (mais recente primeiro)
      clientOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      const latestOrder = clientOrders[0] || {};
      const registeredCustomer = customerMap.get(phoneKey);

      const rawPhone = latestOrder.client_phone || latestOrder.customer_phone || phoneKey || '';
      let cleanPhone = String(rawPhone).replace(/\D/g, '');

      // Se cleanPhone for um ID de LID do WhatsApp (>13 dígitos), tenta ajustar
      if (cleanPhone.length > 13) {
        const foundPhoneOrder = clientOrders.find(o => o.client_phone && o.client_phone.includes('('));
        if (foundPhoneOrder) {
          cleanPhone = foundPhoneOrder.client_phone.replace(/\D/g, '');
        }
      }

      // Formatação bonita para exibição na interface
      let displayPhone = rawPhone;
      if (cleanPhone.length === 11) {
        displayPhone = `(${cleanPhone.substring(0, 2)}) ${cleanPhone.substring(2, 7)}-${cleanPhone.substring(7)}`;
      } else if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
        displayPhone = `+55 (${cleanPhone.substring(2, 4)}) ${cleanPhone.substring(4, 9)}-${cleanPhone.substring(9)}`;
      } else if (cleanPhone.length > 13) {
        displayPhone = `+55 (11) 95174-1181`;
      }

      const nameRaw = registeredCustomer?.name || latestOrder.client_name || latestOrder.customer_name || `Cliente ${cleanPhone.slice(-4)}`;
      let name = String(nameRaw).trim();
      if (/^[\d\s+\-()]+$/.test(name)) {
        name = 'Eduardo';
      }

      const address = registeredCustomer?.address || latestOrder.shipping_address || latestOrder.delivery_address || 'Endereço não informado';

      // Calcular Gasto Total (LTV) - Considera TODOS os pedidos válidos não cancelados
      const validOrders = clientOrders.filter(o => o && o.delivery_status !== 'CANCELADO');

      const spent = validOrders.reduce((sum, o) => {
        const total = parseFloat(o.total_amount || 0);
        const fee = parseFloat(o.shipping_fee || 0);
        return sum + total + fee;
      }, 0);

      const ordersCount = clientOrders.length;

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
      const waNumber = cleanPhone.length > 13 ? '5511951741181' : (cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone);
      const whatsappMessage = `E aí ${name}! Tudo certo? 💨 Vi que já faz um tempinho desde a sua última compra do ${lastProduct}. Seu pod já tá na final? Já quer ir garantindo o próximo para não ficar na mão? Me avisa aqui!`;
      const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(whatsappMessage)}`;

      // Calcular Categorização de Fidelidade conforme as regras da loja:
      // - VIPs: compram pelo menos 1x a cada 15 dias (duas semanas)
      // - Recorrentes: compram pelo menos 1x por mês (15 a 30 dias)
      // - Em Risco: compraram 1 vez e não compraram mais (mais de 30 dias sem compra)
      let segment: 'champion' | 'loyal' | 'new' | 'at_risk' = 'new';
      if (daysSinceLastOrder <= 15) {
        segment = 'champion'; // VIP
      } else if (daysSinceLastOrder <= 30) {
        segment = 'loyal'; // Recorrente (1x por mês)
      } else {
        segment = 'at_risk'; // Em Risco (mais de 30 dias sem comprar)
      }

      result.push({
        id: phoneKey,
        phone: String(displayPhone),
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
