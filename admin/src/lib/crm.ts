import { supabase } from "@/lib/supabase";

export type FlavorProfileType = 'ice' | 'fruity' | 'tobacco' | 'dessert' | 'other';
export type ProspectingStatusType = 'base_antiga' | 'contatado' | 'reativado' | 'vip_recorrente';

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
  flavorProfile: FlavorProfileType;
  flavorProfileLabel: string;
  favoriteBrand: string;
  inVipGroup: boolean;
  prospectingStatus: ProspectingStatusType;
  prospectingStatusLabel: string;
  customNotes: string;
  urgencyLevel: 'urgent' | 'warning' | 'ok';
  nextReplenishmentDate: string;
  orders: any[];
  lastOrderTimestamp?: number;
  lastActivityTimestamp?: number;
  clientCreatedAt?: string;
};

// Exportação de tempo de execução para compatibilidade
export const RealClient = {};

// Helper para detectar perfil de sabor a partir do nome/sabor
export function detectFlavorProfile(text: string = ''): { type: FlavorProfileType; label: string } {
  const lower = text.toLowerCase();
  if (/(ice|menthol|mint|menta|polar|cold|cool|frozen|spearmint|chill)/i.test(lower)) {
    return { type: 'ice', label: 'Mentolado / Ice' };
  }
  if (/(tobacco|tabaco|cigar|charuto|coffee|caf[eé]|latte|cuban)/i.test(lower)) {
    return { type: 'tobacco', label: 'Atabacado / Intenso' };
  }
  if (/(vanilla|baunilha|custard|caramel|cookie|biscuit|cake|bolo|pie|torta|cream|creme)/i.test(lower)) {
    return { type: 'dessert', label: 'Sobremesa / Doce' };
  }
  if (/(grape|uva|watermelon|melancia|strawberry|morango|mango|manga|peach|p[eê]ssego|banana|apple|ma[çc][aã]|lemon|lim[aã]o|cherry|cereja|passion|maracuj[aá]|berry|blueberry|abacaxi|pineapple|orange|laranja|guava|goiaba|kiwi|fruit|mel[aã]o|melon)/i.test(lower)) {
    return { type: 'fruity', label: 'Frutado / Doce' };
  }
  return { type: 'fruity', label: 'Frutado / Doce' };
}

// Helper para salvar edições de CRM do cliente no Supabase
export async function updateClientCrmProfile(
  phone: string, 
  updates: {
    name?: string;
    flavorProfile?: FlavorProfileType;
    favoriteBrand?: string;
    inVipGroup?: boolean;
    prospectingStatus?: ProspectingStatusType;
    customNotes?: string;
    address?: string;
  },
  companyId?: string
): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const dbPayload: any = {
      phone: formattedPhone,
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.address !== undefined) dbPayload.address = updates.address;
    if (updates.flavorProfile !== undefined) dbPayload.flavor_profile = updates.flavorProfile;
    if (updates.favoriteBrand !== undefined) dbPayload.favorite_brand = updates.favoriteBrand;
    if (updates.inVipGroup !== undefined) dbPayload.in_vip_group = updates.inVipGroup;
    if (updates.prospectingStatus !== undefined) dbPayload.prospecting_status = updates.prospectingStatus;
    if (updates.customNotes !== undefined) dbPayload.custom_notes = updates.customNotes;
    if (companyId) dbPayload.company_id = companyId;

    const { error } = await supabase
      .from('smoking_clients')
      .upsert(dbPayload, { onConflict: 'phone' });

    if (error) {
      console.warn("Aviso ao salvar em smoking_clients:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro ao atualizar perfil do CRM:", err);
    return false;
  }
}

export async function fetchLiveClients(companyId?: string): Promise<RealClient[]> {
  if (!companyId) return [];
  try {
    const isOfficialStore = companyId === 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';

    let ordersQuery = supabase
      .from('smoking_orders')
      .select('*')
      .neq('client_phone', '__SYSTEM_SMK_BEST_SELLERS__')
      .order('created_at', { ascending: false });

    if (isOfficialStore) {
      ordersQuery = ordersQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    } else {
      ordersQuery = ordersQuery.eq('company_id', companyId);
    }

    let clientsQuery = supabase
      .from('smoking_clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (isOfficialStore) {
      clientsQuery = clientsQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    } else {
      clientsQuery = clientsQuery.eq('company_id', companyId);
    }

    let prodsQuery = supabase
      .from('smoking_products')
      .select('id, name, flavor, brand, puffs');

    if (isOfficialStore) {
      prodsQuery = prodsQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    } else {
      prodsQuery = prodsQuery.eq('company_id', companyId);
    }

    // Executa as 3 consultas ao Supabase em paralelo para carregamento ultrarrápido do CRM
    const [ordersRes, clientsRes, productsRes] = await Promise.all([
      ordersQuery,
      clientsQuery,
      prodsQuery
    ]);

    const rawOrders = ordersRes.data || [];
    if (ordersRes.error) {
      console.error("Erro ao buscar smoking_orders:", ordersRes.error);
    }

    const orders = rawOrders.filter(
      (o: any) => o.client_phone !== '__SYSTEM_SMK_BEST_SELLERS__' && (!o.client_phone || !o.client_phone.startsWith('__SYSTEM_'))
    );

    // 1. Montar Cadastro Mestre de Produtos (Estoque) para pegar Puffs exatos
    const productsMap = new Map<string, any>();
    const productsData = productsRes.data;
    if (productsData && Array.isArray(productsData)) {
      for (const p of productsData) {
        if (p.id) productsMap.set(String(p.id), p);
        if (p.name && p.flavor) {
          const key = `${String(p.name).toLowerCase()}_${String(p.flavor).toLowerCase()}`;
          productsMap.set(key, p);
        }
      }
    }

    // 2. Agrupar Pedidos por Telefone Normalizado (ou Chave Exclusiva de Instagram)
    const ordersByPhone = new Map<string, any[]>();
    for (const order of orders) {
      if (!order) continue;
      const phoneRaw = String(order.client_phone || order.customer_phone || order.phone || '').trim();
      let lookupKey = '';
      if (phoneRaw.startsWith('INSTA_') || phoneRaw.startsWith('SEM_WPP_') || phoneRaw.includes('Instagram')) {
        lookupKey = phoneRaw;
      } else {
        const phoneClean = phoneRaw.replace(/\D/g, '');
        if (!phoneClean) continue;
        lookupKey = phoneClean.length === 10 || phoneClean.length === 11 ? `55${phoneClean}` : phoneClean;
      }

      if (!ordersByPhone.has(lookupKey)) {
        ordersByPhone.set(lookupKey, []);
      }
      ordersByPhone.get(lookupKey)!.push(order);
    }

    const result: RealClient[] = [];
    const processedPhones = new Set<string>();
    const now = new Date().getTime();

    // 3. Processar smoking_clients como FONTE PRIMÁRIA
    const clientsData = clientsRes.data || [];
    for (const client of clientsData) {
      if (!client || !client.phone) continue;
      const rawPhone = String(client.phone).trim();
      let lookupKey = '';
      let phoneClean = '';
      const isInsta = rawPhone.startsWith('INSTA_') || rawPhone.startsWith('SEM_WPP_') || rawPhone.includes('Instagram');
      
      if (isInsta) {
        lookupKey = rawPhone;
        phoneClean = '';
      } else {
        phoneClean = rawPhone.replace(/\D/g, '');
        lookupKey = phoneClean.length === 10 || phoneClean.length === 11 ? `55${phoneClean}` : phoneClean;
      }
      
      processedPhones.add(lookupKey);
      if (phoneClean) processedPhones.add(phoneClean);

      // Buscar pedidos associados a este cliente
      const clientOrders = ordersByPhone.get(lookupKey) || (phoneClean ? ordersByPhone.get(phoneClean) : []) || [];
      clientOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      const latestOrder = clientOrders[0] || null;

      // Formatação de telefone para exibição
      let displayPhone = rawPhone;
      if (isInsta) {
        displayPhone = 'Sem WhatsApp (Instagram)';
      } else if (phoneClean.length === 11) {
        displayPhone = `(${phoneClean.substring(0, 2)}) ${phoneClean.substring(2, 7)}-${phoneClean.substring(7)}`;
      } else if (phoneClean.length === 10) {
        displayPhone = `(${phoneClean.substring(0, 2)}) ${phoneClean.substring(2, 6)}-${phoneClean.substring(6)}`;
      } else if (phoneClean.length === 13 && phoneClean.startsWith('55')) {
        displayPhone = `+55 (${phoneClean.substring(2, 4)}) ${phoneClean.substring(4, 9)}-${phoneClean.substring(9)}`;
      } else if (phoneClean.length === 12 && phoneClean.startsWith('55')) {
        displayPhone = `+55 (${phoneClean.substring(2, 4)}) ${phoneClean.substring(4, 8)}-${phoneClean.substring(8)}`;
      } else {
        displayPhone = rawPhone;
      }

      const name = String(client.name || latestOrder?.client_name || `Cliente ${phoneClean.slice(-4)}`).trim();
      const address = String(client.address || latestOrder?.shipping_address || 'Atendimento Balcão / WhatsApp').trim();

      if (clientOrders.length > 0 && latestOrder) {
        // --- CLIENTE COM COMPRAS HISTÓRICAS ---
        const validOrders = clientOrders.filter(o => o && o.delivery_status !== 'CANCELADO');
        const spent = validOrders.reduce((sum, o) => {
          const total = parseFloat(o.total_amount || 0);
          return sum + (isNaN(total) ? 0 : total);
        }, 0);
        const ordersCount = clientOrders.length;

        const lastOrderDateStr = latestOrder.created_at ? new Date(latestOrder.created_at).toLocaleDateString('pt-BR') : 'Hoje';
        const lastOrderTimestamp = latestOrder.created_at ? new Date(latestOrder.created_at).getTime() : now;
        const daysSinceLastOrder = Math.max(0, Math.floor((now - lastOrderTimestamp) / (1000 * 60 * 60 * 24)));

        // Extrair último pod, modelo, sabor e marca
        const itemsList = Array.isArray(latestOrder.items) ? latestOrder.items : [];
        const firstItem = itemsList.length > 0 ? itemsList[0] : null;

        let lastProduct = firstItem ? `${firstItem.name || 'Pod'} ${firstItem.flavor || ''}` : 'Ignite V50';
        let lastFlavor = firstItem?.flavor || 'Frutado';
        let lastPuffs = Number(firstItem?.puffs) || 5000;
        let favoriteBrand = client.favorite_brand || firstItem?.brand || 'Ignite';

        if (firstItem) {
          let matchedProduct = null;
          if (firstItem.id && productsMap.has(String(firstItem.id))) {
            matchedProduct = productsMap.get(String(firstItem.id));
          } else if (firstItem.product_id && productsMap.has(String(firstItem.product_id))) {
            matchedProduct = productsMap.get(String(firstItem.product_id));
          } else {
            const nameFlavorKey = `${String(firstItem.name || '').toLowerCase()}_${String(firstItem.flavor || '').toLowerCase()}`;
            if (productsMap.has(nameFlavorKey)) {
              matchedProduct = productsMap.get(nameFlavorKey);
            }
          }

          if (matchedProduct) {
            if (matchedProduct.puffs) lastPuffs = Number(matchedProduct.puffs);
            if (matchedProduct.brand && !client.favorite_brand) favoriteBrand = matchedProduct.brand;
          } else if (!firstItem.puffs && firstItem.name) {
            const match = firstItem.name.match(/(\d+)k?/i);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num >= 1000) lastPuffs = num;
              else if (num === 50) lastPuffs = 5000;
              else if (num === 80) lastPuffs = 8000;
              else if (num === 10) lastPuffs = 10000;
            }
          }
        }

        const detectedFlavor = detectFlavorProfile(`${lastProduct} ${lastFlavor}`);
        const flavorProfile: FlavorProfileType = client.flavor_profile || detectedFlavor.type;
        const flavorProfileLabel = client.flavor_profile 
          ? (flavorProfile === 'ice' ? 'Mentolado / Ice' : flavorProfile === 'tobacco' ? 'Atabacado / Intenso' : flavorProfile === 'dessert' ? 'Sobremesa / Doce' : 'Frutado / Doce')
          : detectedFlavor.label;

        let expectedCycleDays = 5;
        if (lastPuffs > 50000) expectedCycleDays = 30;
        else if (lastPuffs >= 30000) expectedCycleDays = 27;
        else if (lastPuffs >= 25000) expectedCycleDays = 23;
        else if (lastPuffs >= 20000) expectedCycleDays = 20;
        else if (lastPuffs >= 15000) expectedCycleDays = 17;
        else if (lastPuffs >= 10000) expectedCycleDays = 10;
        else if (lastPuffs >= 6000) expectedCycleDays = 7;
        else expectedCycleDays = 5;

        const estimatedDaysLeft = Math.max(0, expectedCycleDays - daysSinceLastOrder);
        const isEndingSoon = estimatedDaysLeft <= 4 || daysSinceLastOrder >= expectedCycleDays;

        let urgencyLevel: 'urgent' | 'warning' | 'ok' = 'ok';
        if (daysSinceLastOrder >= expectedCycleDays) urgencyLevel = 'urgent';
        else if (estimatedDaysLeft <= 4) urgencyLevel = 'warning';

        const nextReplenishTimestamp = lastOrderTimestamp + (expectedCycleDays * 24 * 60 * 60 * 1000);
        const nextReplenishmentDate = new Date(nextReplenishTimestamp).toLocaleDateString('pt-BR');
        const inVipGroup = Boolean(client.in_vip_group);

        let segment: 'champion' | 'loyal' | 'new' | 'at_risk' = 'new';
        if (ordersCount >= 3 || spent >= 280 || (ordersCount >= 2 && daysSinceLastOrder <= 15)) {
          segment = 'champion';
        } else if (ordersCount >= 2 && daysSinceLastOrder <= 35) {
          segment = 'loyal';
        } else if (daysSinceLastOrder > 35) {
          segment = 'at_risk';
        } else {
          segment = 'new';
        }

        let prospectingStatus: ProspectingStatusType = client.prospecting_status || 'base_antiga';
        if (!client.prospecting_status) {
          if (segment === 'champion') prospectingStatus = 'vip_recorrente';
          else if (segment === 'loyal' || segment === 'new') prospectingStatus = 'reativado';
          else prospectingStatus = 'base_antiga';
        }

        const prospectingStatusLabel = 
          prospectingStatus === 'vip_recorrente' ? 'VIP Recorrente' :
          prospectingStatus === 'reativado' ? 'Reativado (Ativo)' :
          prospectingStatus === 'contatado' ? 'Em Negociação' : 'Base Antiga';

        const waNumber = phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean;
        const whatsappMessage = `E aí ${name}! Tudo certo? 💨 Vi que já faz um tempinho desde o seu ${lastProduct}. Seu pod já tá nas últimas tragadas? Já quer garantir o próximo sabor pra não ficar na mão no fds? Me dá um toque por aqui!`;
        const whatsappUrl = phoneClean ? `https://wa.me/${waNumber}?text=${encodeURIComponent(whatsappMessage)}` : '';

        result.push({
          id: String(client.id || lookupKey),
          phone: String(displayPhone),
          cleanPhone: phoneClean,
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
          flavorProfile,
          flavorProfileLabel,
          favoriteBrand: String(favoriteBrand),
          inVipGroup,
          prospectingStatus,
          prospectingStatusLabel,
          customNotes: client.custom_notes || '',
          urgencyLevel,
          nextReplenishmentDate,
          orders: clientOrders,
          lastOrderTimestamp,
          lastActivityTimestamp: lastOrderTimestamp,
          clientCreatedAt: client.created_at,
        });
      } else {
        // --- CLIENTE NOVO CADASTRADO (0 COMPRAS) ---
        const flavorProfile: FlavorProfileType = client.flavor_profile || 'fruity';
        const flavorProfileLabel = client.flavor_profile 
          ? (flavorProfile === 'ice' ? 'Mentolado / Ice' : flavorProfile === 'tobacco' ? 'Atabacado / Intenso' : flavorProfile === 'dessert' ? 'Sobremesa / Doce' : 'Frutado / Doce')
          : 'Não especificado';

        const waNumber = phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean;
        const whatsappMessage = `Oii ${name}! Tudo bem? Seja bem-vindo à Smoking Pods! 💨 Como posso te ajudar a escolher o pod ideal hoje?`;
        const whatsappUrl = phoneClean ? `https://wa.me/${waNumber}?text=${encodeURIComponent(whatsappMessage)}` : '';

        result.push({
          id: String(client.id || lookupKey),
          phone: String(displayPhone),
          cleanPhone: phoneClean,
          name: String(name),
          address: String(address),
          spent: 0,
          ordersCount: 0,
          lastOrderDate: 'Nunca comprou',
          daysSinceLastOrder: 0,
          lastProduct: 'Nenhum pod ainda',
          lastFlavor: 'Não especificado',
          lastPuffs: 0,
          expectedCycleDays: 20,
          estimatedDaysLeft: 20,
          isEndingSoon: false,
          whatsappMessage,
          whatsappUrl,
          segment: 'new',
          flavorProfile,
          flavorProfileLabel,
          favoriteBrand: client.favorite_brand || 'Ignite',
          inVipGroup: Boolean(client.in_vip_group),
          prospectingStatus: client.prospecting_status || 'base_antiga',
          prospectingStatusLabel: client.prospecting_status ? (
            client.prospecting_status === 'vip_recorrente' ? 'VIP Recorrente' :
            client.prospecting_status === 'reativado' ? 'Reativado (Ativo)' :
            client.prospecting_status === 'contatado' ? 'Em Negociação' : 'Base Antiga'
          ) : 'Novo / 0 compras',
          customNotes: client.custom_notes || '',
          urgencyLevel: 'ok',
          nextReplenishmentDate: '-',
          orders: [],
          lastOrderTimestamp: 0,
          lastActivityTimestamp: client.created_at ? new Date(client.created_at).getTime() : 0,
          clientCreatedAt: client.created_at,
        });
      }
    }

    // 4. Fallback de Segurança: Compradores em orders mas que ainda não estavam em smoking_clients
    for (const [phoneKey, clientOrders] of ordersByPhone.entries()) {
      if (processedPhones.has(phoneKey)) continue;
      clientOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      const latestOrder = clientOrders[0] || {};
      const rawPhone = latestOrder.client_phone || phoneKey;
      const isInsta = String(rawPhone).startsWith('INSTA_') || String(rawPhone).startsWith('SEM_WPP_') || String(rawPhone).includes('Instagram');
      const cleanPhone = isInsta ? '' : phoneKey.replace(/\D/g, '');
      const displayPhone = isInsta ? 'Sem WhatsApp (Instagram)' : rawPhone;
      const name = String(latestOrder.client_name || (cleanPhone ? `Cliente ${cleanPhone.slice(-4)}` : 'Cliente Instagram')).trim();
      const address = String(latestOrder.shipping_address || 'Atendimento Balcão / WhatsApp').trim();

      const validOrders = clientOrders.filter(o => o && o.delivery_status !== 'CANCELADO');
      const spent = validOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount || 0) || 0), 0);
      const ordersCount = clientOrders.length;
      const lastOrderDateStr = latestOrder.created_at ? new Date(latestOrder.created_at).toLocaleDateString('pt-BR') : 'Hoje';
      const lastOrderTimestamp = latestOrder.created_at ? new Date(latestOrder.created_at).getTime() : now;
      const daysSinceLastOrder = Math.max(0, Math.floor((now - lastOrderTimestamp) / (1000 * 60 * 60 * 24)));

      const waNumber = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
      const whatsappMessage = `E aí ${name}! Tudo certo?`;
      const whatsappUrl = cleanPhone ? `https://wa.me/${waNumber}?text=${encodeURIComponent(whatsappMessage)}` : '';

      result.push({
        id: phoneKey,
        phone: displayPhone,
        cleanPhone,
        name,
        address,
        spent,
        ordersCount,
        lastOrderDate: lastOrderDateStr,
        daysSinceLastOrder,
        lastProduct: 'Ignite V50',
        lastFlavor: 'Frutado',
        lastPuffs: 5000,
        expectedCycleDays: 20,
        estimatedDaysLeft: 20,
        isEndingSoon: false,
        whatsappMessage,
        whatsappUrl,
        segment: 'new',
        flavorProfile: 'fruity',
        flavorProfileLabel: 'Frutado / Doce',
        favoriteBrand: 'Ignite',
        inVipGroup: false,
        prospectingStatus: 'base_antiga',
        prospectingStatusLabel: 'Base Antiga',
        customNotes: '',
        urgencyLevel: 'ok',
        nextReplenishmentDate: '-',
        orders: clientOrders,
        lastOrderTimestamp,
        lastActivityTimestamp: lastOrderTimestamp,
        clientCreatedAt: latestOrder.created_at,
      });
    }

    // 5. Ordenação Definitiva do CRM (Bloco 37):
    // 1. data/hora do último pedido do cliente (latestOrder.created_at);
    // 2. se o cliente ainda não possuir pedido, usar created_at como fallback.
    result.sort((a, b) => {
      const timeA = a.lastActivityTimestamp || 0;
      const timeB = b.lastActivityTimestamp || 0;
      if (timeB !== timeA) return timeB - timeA;
      return (a.name || '').localeCompare(b.name || '');
    });

    return result;
  } catch (err) {
    console.error("Erro ao buscar clientes do Supabase:", err);
    return [];
  }
}

