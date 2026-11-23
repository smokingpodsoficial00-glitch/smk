import { supabase } from "@/lib/supabase";

export const DEFAULT_COMPANY_ID = 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
export const LOCAL_STORAGE_KEY = 'smoking_strategic_followups_v1';

export type FollowUpReasonCategory = 
  | 'sem_dinheiro_salario'
  | 'pix_pendente'
  | 'espera_sabor'
  | 'negociacao_frete'
  | 'recompra_futura'
  | 'outro';

export type FollowUpStatus = 'pendente' | 'concluido' | 'cancelado';

export interface FollowUpItem {
  id: string;
  company_id: string;
  client_id?: string | null;
  client_phone: string;
  client_name: string;
  reason_category: FollowUpReasonCategory;
  reason_description: string;
  target_product?: string | null;
  target_flavor?: string | null;
  target_puffs?: number | null;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time?: string | null; // HH:mm
  status: FollowUpStatus;
  order_id?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  whatsappUrl?: string;
  whatsappMessage?: string;
  daysDiff?: number; // < 0 atrasado, 0 hoje, > 0 futuro
}

export const OFFICIAL_CATALOG_URL = 'https://smokingproject01.vercel.app/?src=followup21d';
// DATA DE CORTE OFICIAL: 23/11/2026 (Hoje)
// Regra Estrita: A esteira de recompra automática SÓ dispara para compras concluídas a partir de HOJE (23/11/2026).
// NENHUM cliente histórico anterior a essa data receberá disparos de recompra automática.
export const FOLLOWUP_CUTOFF_DATE_STR = '2026-11-23';
export const FOLLOWUP_CUTOFF_TIMESTAMP = new Date('2026-11-23T00:00:00-03:00').getTime();
export const REPLENISHMENT_CYCLE_DAYS = 21; // Ciclo Oficial de Recompra (3 Semanas / 21 dias)
export const SAFE_DISPATCH_WINDOW = { startHour: 14, endHour: 19 }; // 14:00 às 19:00

// 3 Variações Humanizadas de Copy de Recompra (Anti-Ban WhatsApp)
export const REPLENISHMENT_COPY_VARIATIONS = [
  {
    id: 'var_a',
    title: 'Variação A (Natural/Amigável)',
    template: `Fala, {{nome}}! Tranquilo, irmão? 💨
Passando aqui porque já faz umas 3 semanas do seu último pedido... imaginei que seu pod já deve tá no fim ou piscando aí haha.
Chegou reposição de sabores essa semana na loja! Se quiser dar uma olhada no que tem a pronta entrega pra hoje no ABC, tá na mão:
📲 ${OFFICIAL_CATALOG_URL}
Se precisar de recomendação de sabor gelado, só me dar um alô!`
  },
  {
    id: 'var_b',
    title: 'Variação B (Novidades & Estoque)',
    template: `E aí, {{nome}}! Beleza? ✌️
Bateu 3 semanas do seu último pod com a gente e já viemos te salvar antes que você fique na mão no rolê!
O estoque foi renovado essa semana com novidades (inclusive modelos com tela digital e opções Ice). Quer garantir o seu antes que os sabores mais pedidos esgotem?
Dá uma olhada no cardápio de hoje:
🛒 ${OFFICIAL_CATALOG_URL}`
  },
  {
    id: 'var_c',
    title: 'Variação C (Curta/Consultiva)',
    template: `Salve, {{nome}}! Tudo em paz?
Seu pod ainda tá aguentando o tranco ou já tá pedindo arrego? 😂
Se já tiver precisando de reposição, hoje as entregas pelo Uber Direct tão saindo em menos de 30 minutos no ABC.
Tabela atualizada aqui: ${OFFICIAL_CATALOG_URL}
Qualquer coisa, só chamar!`
  }
];

/**
 * Retorna uma das 3 variações de copy de forma determinística ou rotacionada
 */
export function getReplenishmentCopy(clientName: string, variationIndex = 0): string {
  const safeIdx = Math.abs(variationIndex) % REPLENISHMENT_COPY_VARIATIONS.length;
  const variation = REPLENISHMENT_COPY_VARIATIONS[safeIdx];
  const firstName = (clientName || 'Cliente').trim().split(' ')[0] || 'Cliente';
  return variation.template.replace(/{{nome}}/gi, firstName);
}

/**
 * Verifica se o momento atual está dentro da Janela Segura de Disparo (14:00 - 19:00)
 */
export function isWithinSafeDispatchWindow(date = new Date()): { inWindow: boolean; currentHour: number; message: string } {
  // Horário de Brasília
  const spTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hour = spTime.getHours();
  const inWindow = hour >= SAFE_DISPATCH_WINDOW.startHour && hour < SAFE_DISPATCH_WINDOW.endHour;

  let message = 'Dentro da janela segura de disparo (14h às 19h).';
  if (hour < SAFE_DISPATCH_WINDOW.startHour) {
    message = `Fora da janela de disparo. Os envios abrem às ${SAFE_DISPATCH_WINDOW.startHour}:00 (evita manhãs/madrugadas).`;
  } else if (hour >= SAFE_DISPATCH_WINDOW.endHour) {
    message = `Janela de disparo encerrada hoje às ${SAFE_DISPATCH_WINDOW.endHour}:00. Retoma amanhã às ${SAFE_DISPATCH_WINDOW.startHour}:00.`;
  }

  return { inWindow, currentHour: hour, message };
}

export const FOLLOWUP_CATEGORIES: Record<FollowUpReasonCategory, { label: string; icon: string; defaultCopy: string }> = {
  sem_dinheiro_salario: {
    label: '💰 Pagamento / Salário (Dia 05 / 5º dia útil)',
    icon: '💰',
    defaultCopy: 'Opa [Nome], tudo bem? 💨 Você me pediu pra te dar um toque hoje pra gente já garantir seu pod! Separei os sabores mais pedidos aqui em SBC. Posso agilizar seu pedido pra entrega hoje?'
  },
  pix_pendente: {
    label: '⚡ Pix Pendente / Carrinho Aberto',
    icon: '⚡',
    defaultCopy: 'Oii [Nome], vi que seu pedido ficou em aberto aqui! Quer que eu já reserve seu sabor pro motoboy ou prefere trocar de modelo?'
  },
  espera_sabor: {
    label: '📦 Espera de Sabor / Marca Esgotada',
    icon: '📦',
    defaultCopy: 'Boas notícias, [Nome]! 🚀 Chegou reposição daquele sabor/modelo que você tava querendo! Tô te chamando antes de soltar pro catálogo geral pra você garantir o seu.'
  },
  negociacao_frete: {
    label: '🛵 Negociação de Frete / Localização',
    icon: '🛵',
    defaultCopy: 'Fala [Nome]! Consegui uma condição especial no motoboy aqui pra sua região em SBC hoje. Se quiser fechar seu pod agora, já consigo despachar!'
  },
  recompra_futura: {
    label: '💨 Esteira de Recompra (3 Semanas / 21 Dias)',
    icon: '💨',
    defaultCopy: REPLENISHMENT_COPY_VARIATIONS[0].template
  },
  outro: {
    label: '📝 Outro Motivo Comercial',
    icon: '📝',
    defaultCopy: 'Fala [Nome], tudo bem? Passando pra gente dar continuidade no seu atendimento da Smoking Pods! Como posso te ajudar hoje?'
  }
};

// Gera a mensagem personalizada de WhatsApp
export function generateFollowUpMessage(item: Partial<FollowUpItem>, variationIndex?: number): string {
  if (item.reason_category === 'recompra_futura') {
    const idx = variationIndex !== undefined 
      ? variationIndex 
      : ((item.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 3);
    return getReplenishmentCopy(item.client_name || 'Cliente', idx);
  }

  const categoryConfig = FOLLOWUP_CATEGORIES[item.reason_category || 'outro'] || FOLLOWUP_CATEGORIES.outro;
  let baseCopy = categoryConfig.defaultCopy;

  const clientName = (item.client_name || 'Cliente').trim().split(' ')[0] || 'Cliente';
  let formatted = baseCopy.replace(/\[Nome\]|{{nome}}/gi, clientName);

  if (item.target_product || item.target_flavor) {
    const prodDesc = [item.target_product, item.target_flavor].filter(Boolean).join(' - ');
    formatted += `\n\n(Referência: ${prodDesc})`;
  }

  if (item.reason_description && item.reason_description.trim()) {
    formatted += `\n*Nota combinada:* ${item.reason_description.trim()}`;
  }

  return formatted;
}

// Calcula a diferença em dias entre a data agendada e hoje
export function calculateDaysDiff(scheduledDateStr: string): number {
  if (!scheduledDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = scheduledDateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Helpers seguros para LocalStorage (Fallback / Cache Secundário)
export function getLocalFollowUps(companyId?: string): FollowUpItem[] {
  const key = companyId ? `${companyId}_${LOCAL_STORAGE_KEY}` : LOCAL_STORAGE_KEY;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[FollowUps] Erro ao ler fallback LocalStorage:', e);
    return [];
  }
}

export function saveLocalFollowUps(items: FollowUpItem[], companyId?: string): void {
  const key = companyId ? `${companyId}_${LOCAL_STORAGE_KEY}` : LOCAL_STORAGE_KEY;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(items));
    }
  } catch (e) {
    console.warn('[FollowUps] Erro ao gravar cache secundário no LocalStorage:', e);
  }
}

function addLocalFollowUp(item: FollowUpItem, companyId?: string): void {
  try {
    const current = getLocalFollowUps(companyId);
    const updated = [item, ...current.filter(i => i.id !== item.id)];
    saveLocalFollowUps(updated, companyId);
  } catch (e) {
    console.warn('[FollowUps] Erro ao adicionar item no cache local:', e);
  }
}

function updateLocalFollowUp(id: string, updates: Partial<FollowUpItem>, companyId?: string): void {
  try {
    const current = getLocalFollowUps(companyId);
    const updated = current.map(item => item.id === id ? { ...item, ...updates } : item);
    saveLocalFollowUps(updated, companyId);
  } catch (e) {
    console.warn('[FollowUps] Erro ao atualizar item no cache local:', e);
  }
}

function deleteLocalFollowUp(id: string, companyId?: string): void {
  try {
    const current = getLocalFollowUps(companyId);
    const updated = current.filter(item => item.id !== id);
    saveLocalFollowUps(updated, companyId);
  } catch (e) {
    console.warn('[FollowUps] Erro ao remover item do cache local:', e);
  }
}

// Enriquecer items com helpers calculados (WhatsApp url, dias de diferença, cópias formatadas)
export function enrichFollowUps(items: any[]): FollowUpItem[] {
  return items.map(item => {
    const cleanPhone = String(item.client_phone || '').replace(/\D/g, '');
    const waNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const daysDiff = calculateDaysDiff(item.scheduled_date);
    const msg = generateFollowUpMessage(item);
    const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;

    return {
      ...item,
      company_id: item.company_id || DEFAULT_COMPANY_ID,
      client_id: item.client_id || null,
      client_phone: item.client_phone || cleanPhone,
      client_name: item.client_name || 'Cliente',
      reason_category: (item.reason_category as FollowUpReasonCategory) || 'outro',
      reason_description: item.reason_description || '',
      status: (item.status as FollowUpStatus) || 'pendente',
      scheduled_date: item.scheduled_date || new Date().toISOString().split('T')[0],
      scheduled_time: item.scheduled_time || '10:00',
      daysDiff,
      whatsappMessage: msg,
      whatsappUrl,
    };
  });
}

// 1. Buscar todos os follow-ups — SUPABASE COMO FONTE PRIMÁRIA
export async function fetchFollowUps(companyId?: string): Promise<FollowUpItem[]> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  try {
    const { data, error } = await supabase
      .from('smoking_crm_follow_ups')
      .select('*')
      .eq('company_id', targetCompanyId)
      .order('scheduled_date', { ascending: true });

    if (!error && data) {
      const enriched = enrichFollowUps(data);
      // Sincroniza cache local com a resposta oficial do Supabase
      saveLocalFollowUps(data, targetCompanyId);
      return enriched;
    }

    if (error) {
      console.warn('[FollowUps] Erro ao buscar no Supabase (ativando fallback local):', error.message);
    }
  } catch (err: any) {
    console.warn('[FollowUps] Exceção ao consultar Supabase (ativando fallback local):', err?.message || err);
  }

  // Fallback seguro se Supabase indisponível
  const localItems = getLocalFollowUps(targetCompanyId);
  console.info('[FollowUps] Consumindo cache secundário local:', localItems.length, 'itens.');
  return enrichFollowUps(localItems);
}

// 2. Criar novo Follow-up — GRAVAÇÃO PRIMÁRIA NO SUPABASE
export async function createFollowUp(item: {
  company_id?: string;
  client_id?: string | null;
  client_phone: string;
  client_name: string;
  reason_category: FollowUpReasonCategory;
  reason_description?: string;
  target_product?: string;
  target_flavor?: string;
  target_puffs?: number;
  scheduled_date: string;
  scheduled_time?: string;
  order_id?: string | null;
}): Promise<FollowUpItem | null> {
  const targetCompanyId = item.company_id || DEFAULT_COMPANY_ID;
  const cleanPhone = String(item.client_phone).replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  const payload = {
    company_id: targetCompanyId,
    client_id: item.client_id || null,
    client_phone: formattedPhone,
    client_name: item.client_name.trim() || 'Cliente',
    reason_category: item.reason_category || 'outro',
    reason_description: (item.reason_description || '').trim(),
    target_product: item.target_product || null,
    target_flavor: item.target_flavor || null,
    target_puffs: item.target_puffs ? Number(item.target_puffs) : null,
    scheduled_date: item.scheduled_date || new Date().toISOString().split('T')[0],
    scheduled_time: item.scheduled_time || '10:00',
    status: 'pendente' as FollowUpStatus,
    order_id: item.order_id || null,
  };

  try {
    const { data, error } = await supabase
      .from('smoking_crm_follow_ups')
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      addLocalFollowUp(data);
      return enrichFollowUps([data])[0];
    }

    if (error) {
      console.warn('[FollowUps] Erro ao criar no Supabase (ativando fallback local):', error.message);
    }
  } catch (err: any) {
    console.warn('[FollowUps] Exceção ao criar no Supabase (ativando fallback local):', err?.message || err);
  }

  // Fallback LocalStorage seguro (sempre UUID válido para compatibilidade total)
  const localId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : '00000000-0000-4000-8000-' + String(Date.now()).padStart(12, '0').slice(-12);

  const localItem: FollowUpItem = {
    ...payload,
    id: localId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  addLocalFollowUp(localItem);
  return enrichFollowUps([localItem])[0];
}

// 3. Atualizar Follow-up (Data, Notas, etc.) — SUPABASE PRIMÁRIO
export async function updateFollowUp(
  id: string, 
  updates: Partial<FollowUpItem>, 
  companyId?: string
): Promise<boolean> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const dbUpdates: any = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  // Remove campos calculados e virtuais antes de gravar no banco
  delete dbUpdates.whatsappUrl;
  delete dbUpdates.whatsappMessage;
  delete dbUpdates.daysDiff;

  try {
    const { error } = await supabase
      .from('smoking_crm_follow_ups')
      .update(dbUpdates)
      .eq('id', id)
      .eq('company_id', targetCompanyId);

    if (!error) {
      updateLocalFollowUp(id, dbUpdates);
      return true;
    }

    console.warn('[FollowUps] Erro ao atualizar no Supabase (ativando fallback local):', error.message);
  } catch (err: any) {
    console.warn('[FollowUps] Exceção ao atualizar no Supabase (ativando fallback local):', err?.message || err);
  }

  updateLocalFollowUp(id, dbUpdates);
  return true;
}

// 4. Marcar Follow-up como Concluído (Venda Fechada)
export async function completeFollowUp(id: string, companyId?: string, orderId?: string): Promise<boolean> {
  return updateFollowUp(id, {
    status: 'concluido',
    completed_at: new Date().toISOString(),
    ...(orderId ? { order_id: orderId } : {})
  }, companyId);
}

// 5. Cancelar Follow-up
export async function cancelFollowUp(id: string, companyId?: string): Promise<boolean> {
  return updateFollowUp(id, {
    status: 'cancelado',
    updated_at: new Date().toISOString()
  }, companyId);
}

// 6. Excluir Follow-up — SUPABASE PRIMÁRIO
export async function deleteFollowUp(id: string, companyId?: string): Promise<boolean> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  try {
    const { error } = await supabase
      .from('smoking_crm_follow_ups')
      .delete()
      .eq('id', id)
      .eq('company_id', targetCompanyId);

    if (!error) {
      deleteLocalFollowUp(id);
      return true;
    }

    console.warn('[FollowUps] Erro ao excluir no Supabase (ativando fallback local):', error.message);
  } catch (err: any) {
    console.warn('[FollowUps] Exceção ao excluir no Supabase (ativando fallback local):', err?.message || err);
  }

  deleteLocalFollowUp(id);
  return true;
}

// 7. Sincronização Inteligente do Ciclo de Recompra (21 dias com Trava Anti-Spam)
export interface SyncReplenishmentResult {
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  cancelledRecentBuyerCount: number;
}

/**
 * Varre os clientes do CRM e sincroniza a esteira oficial de 21 dias:
 * - Gatilho: exatos 21 dias após a data da última compra concluída.
 * - Trava Anti-Mico / Anti-Spam: se comprou a menos de 21 dias, cancela qualquer agendamento pendente
 *   e reprograma para última_compra + 21 dias.
 */
export async function sync21DaysReplenishmentFollowUps(
  clients: any[],
  companyId?: string
): Promise<SyncReplenishmentResult> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const currentFollowUps = await fetchFollowUps(targetCompanyId);
  const pendingReplenishments = currentFollowUps.filter(
    f => f.reason_category === 'recompra_futura' && f.status === 'pendente'
  );

  let createdCount = 0;
  let updatedCount = 0;
  let cancelledRecentBuyerCount = 0;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const client of clients) {
    if (!client) continue;

    const rawPhone = client.phone || client.cleanPhone;
    if (!rawPhone) continue;
    const cleanPhone = String(rawPhone).replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const daysSince = Number(client.daysSinceLastOrder);
    if (isNaN(daysSince)) continue;

    // Encontra follow-up de recompra pendente existente para este telefone
    const existing = pendingReplenishments.find(f => {
      const fPhone = String(f.client_phone || '').replace(/\D/g, '');
      return fPhone === cleanPhone || (f.client_id && client.id && f.client_id === client.id);
    });

    // REGRA DE CORTE: Compras concluídas a partir de HOJE ou pedido recente de teste do Eduardo Pitzke
    const lastOrderTimestamp = client.lastOrderTimestamp || (client.latestOrder?.created_at ? new Date(client.latestOrder.created_at).getTime() : 0);
    const clientNameLower = (client.name || '').toLowerCase();
    const isEduardoPitzke = clientNameLower.includes('eduardo') || clientNameLower.includes('pitzke') || cleanPhone.includes('951741181') || cleanPhone.includes('988887777');
    const isOrderFromTodayOnwards = lastOrderTimestamp >= FOLLOWUP_CUTOFF_TIMESTAMP || isEduardoPitzke;

    if (!isOrderFromTodayOnwards) {
      // Compra histórica antiga anterior ao corte: se houver follow-up de recompra antigo, cancela
      if (existing) {
        await cancelFollowUp(existing.id, targetCompanyId);
        cancelledRecentBuyerCount++;
      }
      continue;
    }

    // 2. Trava Anti-Mico: Cliente comprou a menos de 21 dias!
    // Ele NUNCA pode receber cobrança de recompra se comprou recentemente.
    if (daysSince < REPLENISHMENT_CYCLE_DAYS) {
      const targetDays = REPLENISHMENT_CYCLE_DAYS - daysSince;
      const targetTimestamp = (lastOrderTimestamp > 0 ? lastOrderTimestamp : now.getTime()) + (REPLENISHMENT_CYCLE_DAYS * 24 * 60 * 60 * 1000);
      const newScheduledDate = new Date(targetTimestamp).toISOString().split('T')[0];

      if (!existing) {
        // Agenda para exatamente 3 semanas (21 dias) após a compra de hoje
        await createFollowUp({
          company_id: targetCompanyId,
          client_id: client.id || null,
          client_name: client.name || 'Cliente',
          client_phone: formattedPhone,
          reason_category: 'recompra_futura',
          reason_description: `Agendado automaticamente para 21 dias após a compra de hoje (${client.lastProduct || 'Pod'}). Faltam ${targetDays} dias.`,
          target_product: client.lastProduct || null,
          target_flavor: client.lastFlavor || null,
          target_puffs: client.lastPuffs || null,
          scheduled_date: newScheduledDate,
          scheduled_time: '15:00'
        });
        createdCount++;
      } else if (existing.scheduled_date !== newScheduledDate) {
        await updateFollowUp(existing.id, {
          scheduled_date: newScheduledDate,
          reason_description: `Reprogramado automaticamente: compra recente há ${daysSince}d (trava anti-spam de 21 dias).`
        }, targetCompanyId);
        cancelledRecentBuyerCount++;
      }
      continue;
    }

    // 1. Ciclo de 21 dias atingido a partir de compras novas:
    if (!existing) {
      const scheduledDate = now.toISOString().split('T')[0];
      await createFollowUp({
        company_id: targetCompanyId,
        client_id: client.id || null,
        client_name: client.name || 'Cliente',
        client_phone: formattedPhone,
        reason_category: 'recompra_futura',
        reason_description: `Disparo automático do ciclo de recompra de 21 dias (compra realizada a partir de 23/11).`,
        target_product: client.lastProduct || null,
        target_flavor: client.lastFlavor || null,
        target_puffs: client.lastPuffs || null,
        scheduled_date: scheduledDate,
        scheduled_time: '15:00' // Dentro da janela segura (14h - 19h)
      });
      createdCount++;
    } else {
      updatedCount++;
    }
  }

  return {
    totalProcessed: clients.length,
    createdCount,
    updatedCount,
    cancelledRecentBuyerCount
  };
}

/**
 * Registra ou atualiza imediatamente o Follow-up de 21 dias (3 Semanas)
 * sempre que um pedido for concluído/entregue no sistema.
 */
export async function scheduleOrderReplenishmentFollowUp(order: any, companyId?: string): Promise<FollowUpItem | null> {
  if (!order) return null;
  const targetCompanyId = companyId || order.company_id || DEFAULT_COMPANY_ID;

  const rawPhone = order.client_phone || order.phone;
  if (!rawPhone || String(rawPhone).startsWith('__SYSTEM_')) return null;

  const cleanPhone = String(rawPhone).replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  const clientName = (order.client_name || order.customer_name || 'Cliente').trim();

  // Extrai primeiro produto/sabor do pedido
  const items = Array.isArray(order.items) ? order.items : [];
  const firstItem = items.length > 0 ? items[0] : null;
  const targetProduct = firstItem ? `${firstItem.name || firstItem.model || 'Pod'} ${firstItem.flavor || ''}`.trim() : (order.product_name || 'Pod');
  const targetFlavor = firstItem?.flavor || null;
  const targetPuffs = Number(firstItem?.puffs) || undefined;

  // Data de agendamento: exatamente 21 dias a partir de hoje
  const now = new Date();
  const targetDate = new Date(now.getTime() + (REPLENISHMENT_CYCLE_DAYS * 24 * 60 * 60 * 1000));
  const scheduledDate = targetDate.toISOString().split('T')[0];

  // Busca se já existe um follow-up de recompra pendente para este cliente
  const allFollowUps = await fetchFollowUps(targetCompanyId);
  const existing = allFollowUps.find(f => {
    const fPhone = String(f.client_phone || '').replace(/\D/g, '');
    return f.status === 'pendente' && f.reason_category === 'recompra_futura' && fPhone === cleanPhone;
  });

  if (existing) {
    // Trava Anti-Mico: o cliente acabou de comprar! Reinicia o contador de 3 semanas
    await updateFollowUp(existing.id, {
      scheduled_date: scheduledDate,
      order_id: order.id || existing.order_id,
      target_product: targetProduct,
      target_flavor: targetFlavor,
      target_puffs: targetPuffs || null,
      reason_description: `Contador reiniciado: compra concluída hoje (${targetProduct}). 3 semanas de contagem regressiva.`,
      updated_at: new Date().toISOString()
    }, targetCompanyId);
    return existing;
  }

  // Cria novo agendamento com o loading de 3 semanas
  return await createFollowUp({
    company_id: targetCompanyId,
    client_id: order.client_id || order.customer_id || null,
    client_name: clientName,
    client_phone: formattedPhone,
    reason_category: 'recompra_futura',
    reason_description: `Compra concluída hoje (${targetProduct}). Aguardando ciclo de 3 semanas para disparo de recompra.`,
    target_product: targetProduct,
    target_flavor: targetFlavor,
    target_puffs: targetPuffs,
    scheduled_date: scheduledDate,
    scheduled_time: '15:00',
    order_id: order.id || null
  });
}
