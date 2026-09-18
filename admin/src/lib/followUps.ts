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
    label: '💨 Recompra Marcada (Pod Secando)',
    icon: '💨',
    defaultCopy: 'E aí [Nome], beleza? 💨 Passando conforme combinamos pra ver se seu pod já tá no finalzinho das puxadas! Quer garantir o próximo pro fds?'
  },
  outro: {
    label: '📝 Outro Motivo Comercial',
    icon: '📝',
    defaultCopy: 'Fala [Nome], tudo bem? Passando pra gente dar continuidade no seu atendimento da Smoking Pods! Como posso te ajudar hoje?'
  }
};

// Gera a mensagem personalizada de WhatsApp
export function generateFollowUpMessage(item: Partial<FollowUpItem>): string {
  const categoryConfig = FOLLOWUP_CATEGORIES[item.reason_category || 'outro'] || FOLLOWUP_CATEGORIES.outro;
  let baseCopy = categoryConfig.defaultCopy;

  const clientName = item.client_name || 'Cliente';
  let formatted = baseCopy.replace(/\[Nome\]/gi, clientName);

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
