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

/**
 * Normaliza o telefone para armazenamento padronizado em smoking_clients
 */
export function normalizePhoneForStorage(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;

  // Preservar identificadores especiais de Instagram ou sem WhatsApp
  if (trimmed.startsWith('INSTA_') || trimmed.startsWith('SEM_WPP_') || trimmed.toLowerCase().includes('instagram') || trimmed.toLowerCase() === 'status') {
    return trimmed;
  }

  const cleanDigits = trimmed.replace(/\D/g, '');
  if (!cleanDigits) return null;

  // Se tiver 10 ou 11 dígitos (DDD + número), prefixa com 55 (padrão Brasil)
  if (cleanDigits.length === 10 || cleanDigits.length === 11) {
    return `55${cleanDigits}`;
  }

  // Se já tiver 12 ou 13 dígitos começando com 55, mantém
  if ((cleanDigits.length === 12 || cleanDigits.length === 13) && cleanDigits.startsWith('55')) {
    return cleanDigits;
  }

  return cleanDigits;
}

// Helper para salvar edições de CRM do cliente no Supabase EXCLUSIVAMENTE pelo ID (customer.id)
export async function updateClientCrmProfile(
  clientId: string, 
  updates: {
    name?: string;
    phone?: string | null;
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
    if (!clientId) {
      console.error("Identificador de cliente (ID) obrigatório para atualizar perfil.");
      return false;
    }

    const dbPayload: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) dbPayload.name = updates.name.trim();
    if (updates.phone !== undefined) dbPayload.phone = normalizePhoneForStorage(updates.phone);
    if (updates.address !== undefined) dbPayload.address = updates.address;
    if (updates.flavorProfile !== undefined) dbPayload.flavor_profile = updates.flavorProfile;
    if (updates.favoriteBrand !== undefined) dbPayload.favorite_brand = updates.favoriteBrand;
    if (updates.inVipGroup !== undefined) dbPayload.in_vip_group = updates.inVipGroup;
    if (updates.prospectingStatus !== undefined) dbPayload.prospecting_status = updates.prospectingStatus;
    if (updates.customNotes !== undefined) dbPayload.custom_notes = updates.customNotes;

    let query = supabase
      .from('smoking_clients')
      .update(dbPayload)
      .eq('id', clientId);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { error } = await query;

    if (error) {
      console.warn("Aviso ao salvar em smoking_clients por ID:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro ao atualizar perfil do CRM:", err);
    return false;
  }
}

/**
 * Normaliza o nome do cliente para comparações insensíveis a acentos e maiúsculas
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Valida compatibilidade estrita entre o nome do pedido e o cliente.
 * NUNCA mescla nomes incompatíveis.
 */
export function isNameCompatible(orderName: string | null | undefined, clientName: string | null | undefined): boolean {
  if (!orderName || !orderName.trim()) return true; // Pedido sem nome não gera conflito impeditivo
  if (!clientName || !clientName.trim()) return true; // Cliente sem nome não gera conflito impeditivo
  const nO = normalizeName(orderName);
  const nC = normalizeName(clientName);
  if (!nO || !nC) return true;
  // Match exato ou contenção direta de nome
  if (nO === nC || nO.includes(nC) || nC.includes(nO)) return true;
  // Equivalência fonética brasileira direta (w <-> u, y <-> i)
  const pO = nO.replace(/w/g, 'u').replace(/y/g, 'i');
  const pC = nC.replace(/w/g, 'u').replace(/y/g, 'i');
  if (pO === pC || pO.includes(pC) || pC.includes(pO)) return true;
  return false;
}

/**
 * Valida compatibilidade de telefone entre o pedido e o cliente.
 */
export function isPhoneCompatible(orderPhone: string | null | undefined, clientPhone: string | null | undefined): boolean {
  if (!orderPhone || !orderPhone.trim()) return true; // Pedido sem telefone não gera conflito impeditivo
  if (!clientPhone || !clientPhone.trim()) return true; // Cliente sem telefone não gera conflito impeditivo
  const cleanO = orderPhone.replace(/\D/g, '');
  const cleanC = clientPhone.replace(/\D/g, '');
  if (!cleanO || !cleanC) return true;
  const keyO = cleanO.length === 10 || cleanO.length === 11 ? `55${cleanO}` : cleanO;
  const keyC = cleanC.length === 10 || cleanC.length === 11 ? `55${cleanC}` : cleanC;
  return keyO === keyC;
}

/**
 * Distância de Levenshtein simples para comparação de digitação em buscas
 */
function levenshteinDist(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Matcher visual resiliente exclusivo para busca e filtros de interface.
 * Tolera grafias fonéticas comuns (w <-> u, y <-> i) e pequenos erros de digitação (distância <= 1).
 * ATENÇÃO: NUNCA USAR PARA MERGE OU ASSOCIAÇÃO DE PEDIDOS NO BACKEND.
 */
export function matchesVisualSearch(targetText: string | null | undefined, query: string | null | undefined): boolean {
  if (!query || !query.trim()) return true;
  if (!targetText || !targetText.trim()) return false;

  const normTarget = normalizeName(targetText);
  const normQuery = normalizeName(query);

  // 1. Substring direta e exata
  if (normTarget.includes(normQuery)) return true;

  // 2. Normalização fonética comum em nomes brasileiros (w <-> u, y <-> i)
  const phoneticTarget = normTarget.replace(/w/g, 'u').replace(/y/g, 'i');
  const phoneticQuery = normQuery.replace(/w/g, 'u').replace(/y/g, 'i');
  if (phoneticTarget.includes(phoneticQuery)) return true;

  // 3. Comparação palavra a palavra (tokenizada) com tolerância de 1 caractere para palavras >= 4 letras
  const qWords = normQuery.split(' ').filter(Boolean);
  const tWords = normTarget.split(' ').filter(Boolean);

  const allWordsMatch = qWords.every(qWord => {
    return tWords.some(tWord => {
      if (tWord.includes(qWord) || qWord.includes(tWord)) return true;
      const pQ = qWord.replace(/w/g, 'u').replace(/y/g, 'i');
      const pT = tWord.replace(/w/g, 'u').replace(/y/g, 'i');
      if (pT.includes(pQ) || pQ.includes(pT)) return true;
      if (qWord.length >= 4 && tWord.length >= 4) {
        return levenshteinDist(pQ, pT) <= 1;
      }
      return false;
    });
  });

  return allWordsMatch;
}

/**
 * Formata telefone para exibição amigável
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return 'Sem telefone';
  const trimmed = String(phone).trim();
  if (trimmed.startsWith('INSTA_') || trimmed.startsWith('SEM_WPP_') || trimmed.toLowerCase().includes('instagram')) {
    return 'Sem WhatsApp (Instagram)';
  }
  const clean = trimmed.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`;
  }
  if (clean.length === 13 && clean.startsWith('55')) {
    return `+55 (${clean.substring(2, 4)}) ${clean.substring(4, 9)}-${clean.substring(9)}`;
  }
  if (clean.length === 12 && clean.startsWith('55')) {
    return `+55 (${clean.substring(2, 4)}) ${clean.substring(4, 8)}-${clean.substring(8)}`;
  }
  return trimmed;
}

export interface UpdateBasicClientDataParams {
  clientId: string;
  name: string;
  phone: string | null;
  companyId?: string;
}

/**
 * Atualiza dados cadastrais básicos (nome e telefone) do cliente
 * EXCLUSIVAMENTE pelo seu ID primário (customer.id).
 * Não faz merge, não move pedidos, não altera históricos.
 */
export async function updateBasicClientData({
  clientId,
  name,
  phone,
  companyId,
}: UpdateBasicClientDataParams): Promise<{ 
  success: boolean; 
  error?: string;
  savedPhone?: string | null;
  savedName?: string;
}> {
  try {
    const trimmedName = name ? name.trim() : '';
    if (!trimmedName) {
      return { success: false, error: 'O nome do cliente não pode ficar em branco.' };
    }

    if (!clientId) {
      return { success: false, error: 'Identificador (ID) do cliente não informado.' };
    }

    const finalPhone = normalizePhoneForStorage(phone);

    // UPDATE estrito baseado EXCLUSIVAMENTE no ID do cliente (customer.id)
    let updateQuery = supabase
      .from('smoking_clients')
      .update({
        name: trimmedName,
        phone: finalPhone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (companyId) {
      updateQuery = updateQuery.eq('company_id', companyId);
    }

    const { error } = await updateQuery;

    if (error) {
      console.error('Erro ao atualizar dados básicos do cliente por ID:', error);
      if (error.code === '23505') {
        return { 
          success: false, 
          error: 'Já existe outro cliente cadastrado no banco com este número de telefone (restrição de telefone único).' 
        };
      }
      return { success: false, error: error.message || 'Erro ao atualizar dados do cliente.' };
    }

    return { 
      success: true, 
      savedName: trimmedName, 
      savedPhone: finalPhone 
    };
  } catch (err: any) {
    console.error('Exceção ao atualizar dados do cliente:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao salvar alterações.' };
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

    // 2. Indexação de Clientes em smoking_clients (FONTE PRIMÁRIA)
    const clientsData = clientsRes.data || [];
    const clientById = new Map<string, any>();
    const clientsByPhone = new Map<string, any[]>();
    const clientsByName = new Map<string, any[]>();

    for (const client of clientsData) {
      if (!client || !client.id) continue;
      const cId = String(client.id);
      clientById.set(cId, client);

      const rawPhone = client.phone ? String(client.phone).trim() : '';
      if (rawPhone) {
        let phoneKey = '';
        if (rawPhone.startsWith('INSTA_') || rawPhone.startsWith('SEM_WPP_') || rawPhone.includes('Instagram')) {
          phoneKey = rawPhone;
        } else {
          const clean = rawPhone.replace(/\D/g, '');
          if (clean) {
            phoneKey = clean.length === 10 || clean.length === 11 ? `55${clean}` : clean;
          }
        }
        if (phoneKey) {
          if (!clientsByPhone.has(phoneKey)) clientsByPhone.set(phoneKey, []);
          clientsByPhone.get(phoneKey)!.push(client);
        }
      }

      const normN = normalizeName(client.name);
      if (normN) {
        if (!clientsByName.has(normN)) clientsByName.set(normN, []);
        clientsByName.get(normN)!.push(client);
      }
    }

    // 3. Resolução Determinística de Identidade: 1 PEDIDO = 1 CLIENTE NO MÁXIMO
    // Mapeamento estrito: orderAssignment (orderId -> clientId)
    const orderAssignment = new Map<string, string>();
    const unlinkedLegacyOrders: { order: any; reason: string }[] = [];

    for (const ord of orders) {
      if (!ord || !ord.id) continue;
      const ordId = String(ord.id);

      // REGRA ABSOLUTA (Prioridade 1): customer_id direto do banco
      if (ord.customer_id) {
        const targetClientId = String(ord.customer_id);
        // Validar integridade referencial com os clientes do tenant atual
        if (clientById.has(targetClientId)) {
          orderAssignment.set(ordId, targetClientId);
        } else {
          unlinkedLegacyOrders.push({
            order: ord,
            reason: 'customer_id aponta para cliente inexistente ou não autorizado neste tenant'
          });
        }
        continue;
      }

      // REGRA PARA PEDIDOS LEGADOS SEM customer_id:
      // Avaliar correspondência estrita por telefone e nome
      let phoneMatching: any[] = [];
      const ordRawPhone = String(ord.client_phone || ord.customer_phone || ord.phone || '').trim();
      if (ordRawPhone) {
        let pKey = '';
        if (ordRawPhone.startsWith('INSTA_') || ordRawPhone.startsWith('SEM_WPP_') || ordRawPhone.includes('Instagram')) {
          pKey = ordRawPhone;
        } else {
          const clean = ordRawPhone.replace(/\D/g, '');
          if (clean) {
            pKey = clean.length === 10 || clean.length === 11 ? `55${clean}` : clean;
          }
        }
        if (pKey && clientsByPhone.has(pKey)) {
          phoneMatching = clientsByPhone.get(pKey)!;
        }
      }

      let nameMatching: any[] = [];
      const ordNormName = normalizeName(ord.client_name);
      if (ordNormName && clientsByName.has(ordNormName)) {
        nameMatching = clientsByName.get(ordNormName)!;
      }

      // Casos de ambiguidade com múltiplos clientes
      if (phoneMatching.length > 1 || nameMatching.length > 1) {
        unlinkedLegacyOrders.push({
          order: ord,
          reason: 'Ambiguidade: telefone ou nome corresponde a múltiplos clientes'
        });
        continue;
      }

      const phoneClient = phoneMatching.length === 1 ? phoneMatching[0] : null;
      const nameClient = nameMatching.length === 1 ? nameMatching[0] : null;

      if (phoneClient && nameClient) {
        if (String(phoneClient.id) === String(nameClient.id)) {
          // Telefone e Nome apontam exatamente para o mesmo cliente
          orderAssignment.set(ordId, String(phoneClient.id));
        } else {
          // CONFLITO CRUZADO (Caso C): Telefone aponta para A e Nome aponta para B
          // AMBIGUIDADE: Não atribuir automaticamente a nenhum dos dois!
          unlinkedLegacyOrders.push({
            order: ord,
            reason: `Conflito cruzado: Telefone aponta para [${phoneClient.name}] mas Nome aponta para [${nameClient.name}]`
          });
        }
      } else if (phoneClient) {
        // Caso A: Telefone corresponde a UM cliente.
        // Só atribui se o nome do pedido não conflitar com outro cliente
        if (isNameCompatible(ord.client_name, phoneClient.name)) {
          orderAssignment.set(ordId, String(phoneClient.id));
        } else {
          unlinkedLegacyOrders.push({
            order: ord,
            reason: `Incompatibilidade de nome no pedido com o titular da linha [${phoneClient.name}]`
          });
        }
      } else if (nameClient) {
        // Caso B: Nome corresponde a UM único cliente cadastrado.
        // Só atribui se o telefone não pertencer a OUTRO cliente cadastrado.
        // Se o telefone do pedido for genérico/antigo e não pertencer a ninguém na base, o histórico permanece com o titular.
        const phoneBelongsToOtherClient = phoneMatching.length > 0 && phoneMatching.some(c => String(c.id) !== String(nameClient.id));
        if (!phoneBelongsToOtherClient) {
          orderAssignment.set(ordId, String(nameClient.id));
        } else {
          unlinkedLegacyOrders.push({
            order: ord,
            reason: `Conflito: Telefone no pedido pertence a outro cliente cadastrado no sistema`
          });
        }
      } else {
        // Caso F: Pedido sem correspondência em smoking_clients
        unlinkedLegacyOrders.push({
          order: ord,
          reason: 'Pedido sem cliente correspondente em smoking_clients'
        });
      }
    }

    const result: RealClient[] = [];
    const now = new Date().getTime();

    // 4. Montar a lista oficial de clientes do CRM (Apenas clientes reais de smoking_clients)
    for (const client of clientsData) {
      if (!client || !client.id) continue;
      const clientId = String(client.id);

      // Obter pedidos atribuídos EXCLUSIVAMENTE a este cliente
      const clientOrders = orders.filter(o => orderAssignment.get(String(o.id)) === clientId);
      clientOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      const latestOrder = clientOrders[0] || null;
      const rawPhone = client.phone ? String(client.phone).trim() : '';
      const isInsta = rawPhone.startsWith('INSTA_') || rawPhone.startsWith('SEM_WPP_') || rawPhone.includes('Instagram');
      const phoneClean = isInsta ? '' : rawPhone.replace(/\D/g, '');

      // Formatação de telefone para exibição
      let displayPhone = rawPhone;
      if (!rawPhone) {
        displayPhone = 'Sem telefone';
      } else if (isInsta) {
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

      const name = String(client.name || latestOrder?.client_name || (phoneClean ? `Cliente ${phoneClean.slice(-4)}` : 'Cliente')).trim();
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
          id: clientId,
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
          id: clientId,
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

    // 5. Ordenação Definitiva do CRM (Bloco 37):
    // 1. data/hora do último pedido do cliente (lastActivityTimestamp);
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

/**
 * Consulta pedidos legados que não possuem customer_id e que não puderam ser
 * vinculados deterministicamente a nenhum cliente cadastrado devido a ambiguidade ou ausência de cadastro.
 */
export async function fetchUnlinkedLegacyOrders(companyId?: string): Promise<{ order: any; reason: string }[]> {
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

    const [ordersRes, clientsRes] = await Promise.all([ordersQuery, clientsQuery]);
    const rawOrders = ordersRes.data || [];
    const orders = rawOrders.filter(
      (o: any) => o.client_phone !== '__SYSTEM_SMK_BEST_SELLERS__' && (!o.client_phone || !o.client_phone.startsWith('__SYSTEM_'))
    );
    const clientsData = clientsRes.data || [];

    const clientById = new Map<string, any>();
    const clientsByPhone = new Map<string, any[]>();
    const clientsByName = new Map<string, any[]>();

    for (const client of clientsData) {
      if (!client || !client.id) continue;
      const cId = String(client.id);
      clientById.set(cId, client);

      const rawPhone = client.phone ? String(client.phone).trim() : '';
      if (rawPhone) {
        let phoneKey = '';
        if (rawPhone.startsWith('INSTA_') || rawPhone.startsWith('SEM_WPP_') || rawPhone.includes('Instagram')) {
          phoneKey = rawPhone;
        } else {
          const clean = rawPhone.replace(/\D/g, '');
          if (clean) {
            phoneKey = clean.length === 10 || clean.length === 11 ? `55${clean}` : clean;
          }
        }
        if (phoneKey) {
          if (!clientsByPhone.has(phoneKey)) clientsByPhone.set(phoneKey, []);
          clientsByPhone.get(phoneKey)!.push(client);
        }
      }

      const normN = normalizeName(client.name);
      if (normN) {
        if (!clientsByName.has(normN)) clientsByName.set(normN, []);
        clientsByName.get(normN)!.push(client);
      }
    }

    const unlinked: { order: any; reason: string }[] = [];

    for (const ord of orders) {
      if (!ord || !ord.id) continue;

      if (ord.customer_id) {
        if (!clientById.has(String(ord.customer_id))) {
          unlinked.push({ order: ord, reason: 'customer_id não encontrado no tenant' });
        }
        continue;
      }

      let phoneMatching: any[] = [];
      const ordRawPhone = String(ord.client_phone || ord.customer_phone || ord.phone || '').trim();
      if (ordRawPhone) {
        let pKey = '';
        if (ordRawPhone.startsWith('INSTA_') || ordRawPhone.startsWith('SEM_WPP_') || ordRawPhone.includes('Instagram')) {
          pKey = ordRawPhone;
        } else {
          const clean = ordRawPhone.replace(/\D/g, '');
          if (clean) {
            pKey = clean.length === 10 || clean.length === 11 ? `55${clean}` : clean;
          }
        }
        if (pKey && clientsByPhone.has(pKey)) {
          phoneMatching = clientsByPhone.get(pKey)!;
        }
      }

      let nameMatching: any[] = [];
      const ordNormName = normalizeName(ord.client_name);
      if (ordNormName && clientsByName.has(ordNormName)) {
        nameMatching = clientsByName.get(ordNormName)!;
      }

      if (phoneMatching.length > 1 || nameMatching.length > 1) {
        unlinked.push({ order: ord, reason: 'Ambiguidade: telefone ou nome coincide com múltiplos clientes' });
        continue;
      }

      const phoneClient = phoneMatching.length === 1 ? phoneMatching[0] : null;
      const nameClient = nameMatching.length === 1 ? nameMatching[0] : null;

      if (phoneClient && nameClient) {
        if (String(phoneClient.id) !== String(nameClient.id)) {
          unlinked.push({
            order: ord,
            reason: `Conflito cruzado: Telefone aponta para [${phoneClient.name}] mas Nome aponta para [${nameClient.name}]`
          });
        }
      } else if (phoneClient) {
        if (!isNameCompatible(ord.client_name, phoneClient.name)) {
          unlinked.push({
            order: ord,
            reason: `Incompatibilidade de nome no pedido com o titular da linha [${phoneClient.name}]`
          });
        }
      } else if (nameClient) {
        const phoneBelongsToOtherClient = phoneMatching.length > 0 && phoneMatching.some(c => String(c.id) !== String(nameClient.id));
        if (phoneBelongsToOtherClient) {
          unlinked.push({
            order: ord,
            reason: `Conflito: Telefone no pedido pertence a outro cliente cadastrado no sistema`
          });
        }
      } else {
        unlinked.push({
          order: ord,
          reason: 'Pedido sem correspondência em smoking_clients'
        });
      }
    }

    return unlinked;
  } catch (e) {
    console.error('Erro ao buscar pedidos legados não vinculados:', e);
    return [];
  }
}

