import { supabase } from "@/lib/supabase";
import { legacyFetch, isLegacyBackendAllowed } from "@/lib/backend";

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
  last_sent_at?: string | null;
  send_count?: number;
  custom_message?: string | null;
  created_at: string;
  updated_at?: string | null;
  whatsappUrl?: string;
  whatsappMessage?: string;
  daysDiff?: number; // < 0 atrasado, 0 hoje, > 0 futuro
}

const FU_JSON_PREFIX = '__SMK_FU_V2__:';

export function toLocalDateString(date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export function normalizeFollowUpPhone(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export const OFFICIAL_CATALOG_URL = 'https://smokingproject01.vercel.app/?src=followup21d';
// DATA DE CORTE OFICIAL: 23/11/2026 (Hoje)
// Regra Estrita: A esteira de recompra automática SÓ dispara para compras concluídas a partir de HOJE (23/11/2026).
// NENHUM cliente histórico anterior a essa data receberá disparos de recompra automática.
export const FOLLOWUP_CUTOFF_DATE_STR = '2026-11-23';
export const FOLLOWUP_CUTOFF_TIMESTAMP = new Date('2026-11-23T00:00:00-03:00').getTime();
export const REPLENISHMENT_CYCLE_DAYS = 21; // Ciclo Oficial de Recompra (3 Semanas / 21 dias)
export const SAFE_DISPATCH_WINDOW = { startHour: 10, endHour: 22 }; // 10:00 às 22:00 (Janela estendida)

// 5 Variações Curtas, Diretas e Informais de Copy de Recompra (Anti-Ban WhatsApp & Rotação Inteligente)
export const REPLENISHMENT_COPY_VARIATIONS = [
  {
    id: 'var_a',
    title: 'Variação 1: Direta',
    template: `Salve, {{nome}}, tudo bem? Eu vi que faz um tempo desde a sua última compra do seu {{produto}}. Gostaria de já ir separando o seu?

${OFFICIAL_CATALOG_URL}`
  },
  {
    id: 'var_b',
    title: 'Variação 2: Rápida',
    template: `Opa, {{nome}}, beleza? Vi aqui sua última compra do seu {{produto}}. Quer que eu já deixe o seu próximo separado?

${OFFICIAL_CATALOG_URL}`
  },
  {
    id: 'var_c',
    title: 'Variação 3: Simples',
    template: `Fala, {{nome}}, tudo certo? Já faz um tempo que você pegou seu {{produto}}. Quer dar uma olhada no catálogo pra gente separar o próximo?

${OFFICIAL_CATALOG_URL}`
  },
  {
    id: 'var_d',
    title: 'Variação 4: Objetiva',
    template: `E aí, {{nome}}, tranquilo? Passando pra ver se já quer ir separando seu próximo pod depois do {{produto}}.

${OFFICIAL_CATALOG_URL}`
  },
  {
    id: 'var_e',
    title: 'Variação 5: Direta VIP',
    template: `Salve, {{nome}}, tudo em paz? Faz um tempo da sua última compra do {{produto}}. Posso já ir separando um novo pra você?

${OFFICIAL_CATALOG_URL}`
  }
];


export function getReplenishmentCopy(clientName: string, variationIndex = 0, productName = 'pod'): string {
  const safeIdx = Math.abs(variationIndex) % REPLENISHMENT_COPY_VARIATIONS.length;
  const variation = REPLENISHMENT_COPY_VARIATIONS[safeIdx];
  const firstName = (clientName || 'Cliente').trim().split(' ')[0] || 'Cliente';
  const cleanProduct = productName || 'pod';
  return variation.template
    .replace(/{{nome}}/gi, firstName)
    .replace(/{{produto}}/gi, cleanProduct);
}

export function isWithinSafeDispatchWindow(date = new Date()): { inWindow: boolean; currentHour: number; message: string } {
  // Horário de Brasília
  const spTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hour = spTime.getHours();
  const inWindow = hour >= SAFE_DISPATCH_WINDOW.startHour && hour < SAFE_DISPATCH_WINDOW.endHour;

  let message = `Dentro da janela segura de disparo (${SAFE_DISPATCH_WINDOW.startHour}h às ${SAFE_DISPATCH_WINDOW.endHour}h).`;
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
  if (item.custom_message && item.custom_message.trim().length > 0) {
    return item.custom_message;
  }

  if (item.reason_category === 'recompra_futura') {
    const baseIdx = (item.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const idx = variationIndex !== undefined
      ? variationIndex
      : ((baseIdx + (Number(item.send_count) || 0)) % REPLENISHMENT_COPY_VARIATIONS.length);
    const prod = item.target_product || 'pod';
    return getReplenishmentCopy(item.client_name || 'Cliente', idx, prod);
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
  const todayStr = toLocalDateString(new Date());
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = scheduledDateStr.split('-').map(Number);
  if (!year || !month || !day) return 0;
  const targetDate = new Date(year, month - 1, day);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Helpers de serialização compatíveis com o schema real de smoking_crm_follow_ups (id, company_id, client_id, scheduled_at, note, status, created_at)
function hydrateFollowUpRow(raw: any): FollowUpItem {
  let meta: Record<string, any> = {};
  if (typeof raw?.note === 'string' && raw.note.startsWith(FU_JSON_PREFIX)) {
    try {
      meta = JSON.parse(raw.note.slice(FU_JSON_PREFIX.length)) || {};
    } catch {
      meta = {};
    }
  } else if (typeof raw?.note === 'string' && raw.note.trim()) {
    meta = { reason_description: raw.note.trim() };
  }

  let fallbackDate = '';
  let fallbackTime = '';
  if (raw?.scheduled_at && !meta.scheduled_date) {
    const parsed = new Date(raw.scheduled_at);
    if (!isNaN(parsed.getTime())) {
      fallbackDate = toLocalDateString(parsed);
      const spParts = parsed.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      fallbackTime = spParts;
    }
  }

  const rawPhone = raw?.client_phone || meta.client_phone || '';
  const formattedPhone = normalizeFollowUpPhone(rawPhone);

  return {
    id: raw.id,
    company_id: raw.company_id || meta.company_id || DEFAULT_COMPANY_ID,
    client_id: raw.client_id ?? meta.client_id ?? null,
    client_phone: formattedPhone || rawPhone,
    client_name: raw.client_name || meta.client_name || 'Cliente',
    reason_category: (raw.reason_category || meta.reason_category || 'recompra_futura') as FollowUpReasonCategory,
    reason_description: raw.reason_description ?? meta.reason_description ?? '',
    target_product: raw.target_product ?? meta.target_product ?? null,
    target_flavor: raw.target_flavor ?? meta.target_flavor ?? null,
    target_puffs: raw.target_puffs ?? meta.target_puffs ?? null,
    scheduled_date: raw.scheduled_date || meta.scheduled_date || fallbackDate || toLocalDateString(new Date()),
    scheduled_time: raw.scheduled_time || meta.scheduled_time || fallbackTime || '15:00',
    status: (raw.status || meta.status || 'pendente') as FollowUpStatus,
    order_id: raw.order_id ?? meta.order_id ?? null,
    completed_at: raw.completed_at ?? meta.completed_at ?? null,
    last_sent_at: raw.last_sent_at ?? meta.last_sent_at ?? raw.completed_at ?? meta.completed_at ?? null,
    send_count: Number(raw.send_count ?? meta.send_count ?? (raw.completed_at || meta.completed_at ? 1 : 0)) || 0,
    custom_message: raw.custom_message ?? meta.custom_message ?? null,
    created_at: raw.created_at || meta.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || meta.updated_at || raw.created_at || new Date().toISOString(),
  };
}

function serializeFollowUpToDbRow(item: Partial<FollowUpItem>, companyId: string) {
  const scheduledDate = item.scheduled_date || toLocalDateString(new Date());
  const scheduledTime = item.scheduled_time || '15:00';
  const safeTime = /^\d{2}:\d{2}$/.test(scheduledTime) ? scheduledTime : '15:00';
  const scheduledAtIso = `${scheduledDate}T${safeTime}:00-03:00`;

  const meta = {
    client_phone: normalizeFollowUpPhone(item.client_phone) || item.client_phone || '',
    client_name: (item.client_name || 'Cliente').trim(),
    reason_category: item.reason_category || 'outro',
    reason_description: (item.reason_description || '').trim(),
    target_product: item.target_product ?? null,
    target_flavor: item.target_flavor ?? null,
    target_puffs: item.target_puffs ?? null,
    scheduled_date: scheduledDate,
    scheduled_time: safeTime,
    order_id: item.order_id ?? null,
    completed_at: item.completed_at ?? null,
    last_sent_at: item.last_sent_at ?? item.completed_at ?? null,
    send_count: Number(item.send_count || 0),
    custom_message: item.custom_message ?? null,
    updated_at: item.updated_at || new Date().toISOString(),
  };

  return {
    company_id: companyId,
    client_id: item.client_id || null,
    scheduled_at: scheduledAtIso,
    status: item.status || 'pendente',
    note: `${FU_JSON_PREFIX}${JSON.stringify(meta)}`,
  };
}

// Helpers seguros para LocalStorage (Fallback / Cache Secundário)
export function getLocalFollowUps(companyId?: string): FollowUpItem[] {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const key = `${targetCompanyId}_${LOCAL_STORAGE_KEY}`;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(hydrateFollowUpRow) : [];
  } catch (e) {
    console.warn('[FollowUps] Erro ao ler fallback LocalStorage:', e);
    return [];
  }
}

export function saveLocalFollowUps(items: FollowUpItem[], companyId?: string): void {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const key = `${targetCompanyId}_${LOCAL_STORAGE_KEY}`;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(items));
    }
  } catch (e) {
    console.warn('[FollowUps] Erro ao gravar cache secundário no LocalStorage:', e);
  }
}

function addLocalFollowUp(item: FollowUpItem, companyId?: string): void {
  const targetCompanyId = companyId || item.company_id || DEFAULT_COMPANY_ID;
  try {
    const current = getLocalFollowUps(targetCompanyId);
    const updated = [item, ...current.filter(i => i.id !== item.id)];
    saveLocalFollowUps(updated, targetCompanyId);
  } catch (e) {
    console.warn('[FollowUps] Erro ao adicionar item no cache local:', e);
  }
}

function updateLocalFollowUp(id: string, updates: Partial<FollowUpItem>, companyId?: string): void {
  const targetCompanyId = companyId || updates.company_id || DEFAULT_COMPANY_ID;
  try {
    const current = getLocalFollowUps(targetCompanyId);
    const exists = current.some(item => item.id === id);
    const updated = exists
      ? current.map(item => (item.id === id ? { ...item, ...updates } : item))
      : [{ ...(updates as FollowUpItem), id }, ...current];
    saveLocalFollowUps(updated, targetCompanyId);
  } catch (e) {
    console.warn('[FollowUps] Erro ao atualizar item no cache local:', e);
  }
}

function getDeletedFollowUpIds(companyId: string): Set<string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(`${companyId}_${LOCAL_STORAGE_KEY}_deleted`) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function markLocalFollowUpDeleted(id: string, companyId: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const set = getDeletedFollowUpIds(companyId);
    set.add(id);
    const trimmed = Array.from(set).slice(-200);
    localStorage.setItem(`${companyId}_${LOCAL_STORAGE_KEY}_deleted`, JSON.stringify(trimmed));
  } catch {}
}

function deleteLocalFollowUp(id: string, companyId?: string): void {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  markLocalFollowUpDeleted(id, targetCompanyId);
  try {
    const current = getLocalFollowUps(targetCompanyId);
    const updated = current.filter(item => item.id !== id);
    saveLocalFollowUps(updated, targetCompanyId);
  } catch (e) {
    console.warn('[FollowUps] Erro ao remover item do cache local:', e);
  }
}

function deduplicateReplenishments(items: FollowUpItem[]): FollowUpItem[] {
  const seenReplenishPhones = new Map<string, number>();
  const result: FollowUpItem[] = [];

  for (const item of items) {
    if (item.reason_category !== 'recompra_futura' || item.status === 'cancelado') {
      result.push(item);
      continue;
    }
    const phoneKey = normalizeFollowUpPhone(item.client_phone);
    if (!phoneKey) {
      result.push(item);
      continue;
    }
    const existingIdx = seenReplenishPhones.get(phoneKey);
    if (existingIdx === undefined) {
      seenReplenishPhones.set(phoneKey, result.length);
      result.push(item);
    } else {
      const prev = result[existingIdx];
      const prevTime = Math.max(
        prev.last_sent_at ? new Date(prev.last_sent_at).getTime() : 0,
        prev.completed_at ? new Date(prev.completed_at).getTime() : 0,
        prev.updated_at ? new Date(prev.updated_at).getTime() : 0
      );
      const currTime = Math.max(
        item.last_sent_at ? new Date(item.last_sent_at).getTime() : 0,
        item.completed_at ? new Date(item.completed_at).getTime() : 0,
        item.updated_at ? new Date(item.updated_at).getTime() : 0
      );
      if (currTime > prevTime) {
        result[existingIdx] = item;
      }
    }
  }

  return result;
}

// Enriquecer items com helpers calculados (WhatsApp url, dias de diferença, cópias formatadas)
export function enrichFollowUps(items: any[]): FollowUpItem[] {
  return items.map(raw => {
    const item = hydrateFollowUpRow(raw);
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
      scheduled_date: item.scheduled_date || toLocalDateString(new Date()),
      scheduled_time: item.scheduled_time || '15:00',
      daysDiff,
      whatsappMessage: msg,
      whatsappUrl,
    };
  });
}

// 1. Buscar todos os follow-ups — SUPABASE COMO FONTE PRIMÁRIA + MERGE LOCAL RESILIENTE
export async function fetchFollowUps(companyId?: string): Promise<FollowUpItem[]> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const localItems = getLocalFollowUps(targetCompanyId);

  try {
    const { data, error } = await supabase
      .from('smoking_crm_follow_ups')
      .select('*')
      .eq('company_id', targetCompanyId)
      .order('scheduled_at', { ascending: true });

    if (!error && Array.isArray(data)) {
      const deletedSet = getDeletedFollowUpIds(targetCompanyId);
      const remoteItems = data.map(hydrateFollowUpRow).filter(r => !deletedSet.has(r.id));
      const mergedMap = new Map<string, FollowUpItem>();

      for (const r of remoteItems) {
        mergedMap.set(r.id, r);
      }
      // Preserva itens locais mais recentes ou ainda não sincronizados no remoto (ex: RLS/client_id null)
      for (const l of localItems) {
        if (!l?.id || deletedSet.has(l.id)) continue;
        const remoteMatch = mergedMap.get(l.id);
        if (!remoteMatch) {
          mergedMap.set(l.id, l);
        } else {
          const lTime = new Date(l.updated_at || l.created_at || 0).getTime();
          const rTime = new Date(remoteMatch.updated_at || remoteMatch.created_at || 0).getTime();
          if (lTime > rTime) {
            mergedMap.set(l.id, l);
          }
        }
      }

      const merged = deduplicateReplenishments(Array.from(mergedMap.values()));
      saveLocalFollowUps(merged, targetCompanyId);
      return enrichFollowUps(merged);
    }

    if (error) {
      console.warn('[FollowUps] Erro ao buscar no Supabase (ativando fallback local):', error.message);
    }
  } catch (err: any) {
    console.warn('[FollowUps] Exceção ao consultar Supabase (ativando fallback local):', err?.message || err);
  }

  const dedupedLocal = deduplicateReplenishments(localItems);
  if (dedupedLocal.length !== localItems.length) {
    saveLocalFollowUps(dedupedLocal, targetCompanyId);
  }
  console.info('[FollowUps] Consumindo cache secundário local:', dedupedLocal.length, 'itens.');
  return enrichFollowUps(dedupedLocal);
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
  const formattedPhone = normalizeFollowUpPhone(item.client_phone) || String(item.client_phone || '').replace(/\D/g, '');
  const nowIso = new Date().toISOString();

  const fullItem: Omit<FollowUpItem, 'id'> = {
    company_id: targetCompanyId,
    client_id: item.client_id || null,
    client_phone: formattedPhone,
    client_name: item.client_name.trim() || 'Cliente',
    reason_category: item.reason_category || 'outro',
    reason_description: (item.reason_description || '').trim(),
    target_product: item.target_product || null,
    target_flavor: item.target_flavor || null,
    target_puffs: item.target_puffs ? Number(item.target_puffs) : null,
    scheduled_date: item.scheduled_date || toLocalDateString(new Date()),
    scheduled_time: item.scheduled_time || '15:00',
    status: 'pendente' as FollowUpStatus,
    order_id: item.order_id || null,
    completed_at: null,
    last_sent_at: null,
    send_count: 0,
    custom_message: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  try {
    const dbRow = serializeFollowUpToDbRow(fullItem, targetCompanyId);
    const { data, error } = await supabase
      .from('smoking_crm_follow_ups')
      .insert(dbRow)
      .select()
      .single();

    if (!error && data) {
      const hydrated = hydrateFollowUpRow(data);
      addLocalFollowUp(hydrated, targetCompanyId);
      return enrichFollowUps([hydrated])[0];
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
    ...fullItem,
    id: localId,
  };
  addLocalFollowUp(localItem, targetCompanyId);
  return enrichFollowUps([localItem])[0];
}

// 3. Atualizar Follow-up (Data, Notas, etc.) — SUPABASE PRIMÁRIO + CACHE CONSISTENTE
export async function updateFollowUp(
  id: string, 
  updates: Partial<FollowUpItem>, 
  companyId?: string
): Promise<boolean> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const nowIso = new Date().toISOString();

  const cleanUpdates: Partial<FollowUpItem> = { ...updates };
  delete cleanUpdates.whatsappUrl;
  delete cleanUpdates.whatsappMessage;
  delete cleanUpdates.daysDiff;
  cleanUpdates.updated_at = nowIso;

  // Mescla com o item existente no cache local para preservar todos os metadados no campo `note`
  const currentLocal = getLocalFollowUps(targetCompanyId);
  const existing = currentLocal.find(i => i.id === id) || ({ id, company_id: targetCompanyId } as FollowUpItem);
  const merged: FollowUpItem = {
    ...existing,
    ...cleanUpdates,
    id,
    company_id: targetCompanyId,
    updated_at: nowIso,
  };

  // Atualiza cache local imediatamente para UI nunca perder estado
  updateLocalFollowUp(id, merged, targetCompanyId);

  try {
    const dbRow = serializeFollowUpToDbRow(merged, targetCompanyId);
    const { error } = await supabase
      .from('smoking_crm_follow_ups')
      .update(dbRow)
      .eq('id', id)
      .eq('company_id', targetCompanyId);

    if (!error) {
      return true;
    }

    console.warn('[FollowUps] Erro ao atualizar no Supabase (mantido em cache local):', error.message);
  } catch (err: any) {
    console.warn('[FollowUps] Exceção ao atualizar no Supabase (mantido em cache local):', err?.message || err);
  }

  return true;
}

// 4. Marcar Follow-up como Concluído (Venda Fechada)
export async function completeFollowUp(id: string, companyId?: string, orderId?: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  return updateFollowUp(id, {
    status: 'concluido',
    completed_at: nowIso,
    last_sent_at: nowIso,
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

// 6. Excluir Follow-up — SUPABASE PRIMÁRIO + BACKEND
export async function deleteFollowUp(id: string, companyId?: string): Promise<boolean> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  deleteLocalFollowUp(id, targetCompanyId);

  if (typeof window !== 'undefined' && isLegacyBackendAllowed(targetCompanyId)) {
    legacyFetch(`/api/marketing/followups/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  }

  try {
    const { error } = await supabase
      .from('smoking_crm_follow_ups')
      .delete()
      .eq('id', id)
      .eq('company_id', targetCompanyId);

    if (!error) {
      return true;
    }

    console.warn('[FollowUps] Erro ao excluir no Supabase (removido localmente):', error.message);
  } catch (err: any) {
    console.warn('[FollowUps] Exceção ao excluir no Supabase (removido localmente):', err?.message || err);
  }

  return true;
}

export interface SyncBackendFollowUpsResult {
  serverAutoDispatchActive: boolean;
  items: FollowUpItem[];
}

/**
 * Sincroniza a esteira com o backend Node.js 24/7 (mesma arquitetura das Campanhas).
 * - Se o servidor backend estiver atualizado (/api/marketing/followups/sync retornar 200),
 *   o servidor assume o disparo automático em background (60s) e devolve o estado mais recente.
 * - Se o servidor backend remoto ainda estiver em versão anterior (404), devolve serverAutoDispatchActive=false
 *   para o frontend assumir o disparo automático com trava anti-duplicidade.
 */
export async function syncFollowUpsWithBackend(
  localOrMergedItems: FollowUpItem[],
  companyId?: string
): Promise<SyncBackendFollowUpsResult> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  if (typeof window === 'undefined' || !isLegacyBackendAllowed(targetCompanyId)) {
    return { serverAutoDispatchActive: false, items: localOrMergedItems };
  }

  try {
    const deletedIds = Array.from(getDeletedFollowUpIds(targetCompanyId));
    const res = await legacyFetch('/api/marketing/followups/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: targetCompanyId,
        followUps: localOrMergedItems,
        deletedIds,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.success && data?.serverAutoDispatchActive && Array.isArray(data.followUps)) {
        const deletedSet = getDeletedFollowUpIds(targetCompanyId);
        const serverHydrated = data.followUps
          .map(hydrateFollowUpRow)
          .filter((item: FollowUpItem) => !deletedSet.has(item.id));
        const deduped = deduplicateReplenishments(serverHydrated);
        saveLocalFollowUps(deduped, targetCompanyId);
        return {
          serverAutoDispatchActive: true,
          items: enrichFollowUps(deduped),
        };
      }
    }
  } catch (err) {
    console.warn('[FollowUps] Aviso ao sincronizar esteira com backend Node:', err);
  }

  return { serverAutoDispatchActive: false, items: localOrMergedItems };
}

export async function notifyBackendFollowUpSent(
  item: Partial<FollowUpItem> & { id: string },
  companyId?: string
): Promise<void> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  if (typeof window === 'undefined' || !isLegacyBackendAllowed(targetCompanyId)) return;
  try {
    await legacyFetch('/api/marketing/followups/mark-sent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: targetCompanyId,
        id: item.id,
        scheduled_date: item.scheduled_date,
        completed_at: item.completed_at,
        last_sent_at: item.last_sent_at,
        send_count: item.send_count,
        custom_message: item.custom_message,
        reason_description: item.reason_description,
      }),
    });
  } catch {}
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
 * - Trava Anti-Mico / Anti-Spam: se comprou a menos de 21 dias (e não teve ciclo recém-reiniciado por disparo),
 *   reprograma para última_compra + 21 dias.
 */
export async function sync21DaysReplenishmentFollowUps(
  clients: any[],
  companyId?: string
): Promise<SyncReplenishmentResult> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const currentFollowUps = await fetchFollowUps(targetCompanyId);
  const activeReplenishments = currentFollowUps.filter(
    f => f.reason_category === 'recompra_futura' && f.status !== 'cancelado'
  );

  let createdCount = 0;
  let updatedCount = 0;
  let cancelledRecentBuyerCount = 0;

  const nowDate = new Date();
  const todayStr = toLocalDateString(nowDate);
  const nowMidnight = new Date(todayStr + 'T00:00:00-03:00').getTime();

  for (const client of clients) {
    if (!client) continue;

    const rawPhone = client.phone || client.cleanPhone;
    if (!rawPhone) continue;
    const formattedPhone = normalizeFollowUpPhone(rawPhone);
    if (!formattedPhone) continue;

    const daysSince = Number(client.daysSinceLastOrder);
    if (isNaN(daysSince)) continue;

    // Encontra follow-up de recompra existente para este telefone (ou client_id)
    const existing = activeReplenishments.find(f => {
      const fPhone = normalizeFollowUpPhone(f.client_phone);
      return (fPhone && fPhone === formattedPhone) || (f.client_id && client.id && f.client_id === client.id);
    });

    // REGRA DE CORTE: Compras concluídas a partir de HOJE ou pedido de teste do Eduardo
    const lastOrderTimestamp = client.lastOrderTimestamp || (client.latestOrder?.created_at ? new Date(client.latestOrder.created_at).getTime() : 0);
    const clientNameLower = (client.name || '').toLowerCase();
    const isEduardoPitzke = clientNameLower.includes('eduardo') || clientNameLower.includes('pitzke') || formattedPhone.includes('951741181') || formattedPhone.includes('988887777');
    const isOrderFromTodayOnwards = lastOrderTimestamp >= FOLLOWUP_CUTOFF_TIMESTAMP || isEduardoPitzke;

    if (!isOrderFromTodayOnwards) {
      // Não cria novos follow-ups automáticos para compras antigas pré-corte,
      // mas NUNCA apaga ou cancela um follow-up que já teve envio registrado ou criação manual.
      continue;
    }

    // Proteção de ciclo já disparado/reiniciado: se já foi enviado após a última compra, não sobrescrever a data!
    if (existing) {
      const lastSentTs = existing.last_sent_at
        ? new Date(existing.last_sent_at).getTime()
        : (existing.completed_at ? new Date(existing.completed_at).getTime() : 0);
      if (lastSentTs > 0 && lastSentTs >= lastOrderTimestamp) {
        updatedCount++;
        continue;
      }
    }

    // 2. Trava Anti-Mico: Cliente comprou a menos de 21 dias!
    // Exceção de teste para Eduardo Pitzke: mantém o agendamento atual dele sem sobrescrever
    if (daysSince < REPLENISHMENT_CYCLE_DAYS && !isEduardoPitzke) {
      const targetDays = REPLENISHMENT_CYCLE_DAYS - daysSince;
      const baseTs = lastOrderTimestamp > 0 ? lastOrderTimestamp : nowMidnight;
      const targetDateObj = new Date(baseTs + (REPLENISHMENT_CYCLE_DAYS * 24 * 60 * 60 * 1000));
      const newScheduledDate = toLocalDateString(targetDateObj);

      if (!existing) {
        const created = await createFollowUp({
          company_id: targetCompanyId,
          client_id: client.id || null,
          client_name: client.name || 'Cliente',
          client_phone: formattedPhone,
          reason_category: 'recompra_futura',
          reason_description: `Agendado automaticamente para 3 semanas após a compra (${client.lastProduct || 'Pod'}). Faltam ${targetDays} dias.`,
          target_product: client.lastProduct || null,
          target_flavor: client.lastFlavor || null,
          target_puffs: client.lastPuffs || null,
          scheduled_date: newScheduledDate,
          scheduled_time: '15:00'
        });
        if (created) activeReplenishments.push(created);
        createdCount++;
      } else if (existing.scheduled_date !== newScheduledDate) {
        await updateFollowUp(existing.id, {
          scheduled_date: newScheduledDate,
          target_product: client.lastProduct || existing.target_product,
          reason_description: `Reprogramado automaticamente: compra recente há ${daysSince}d (trava anti-spam de 3 semanas).`
        }, targetCompanyId);
        cancelledRecentBuyerCount++;
      }
      continue;
    }

    // 1. Ciclo de 21 dias atingido (ou cliente Eduardo para teste):
    if (!existing) {
      const created = await createFollowUp({
        company_id: targetCompanyId,
        client_id: client.id || null,
        client_name: client.name || 'Cliente',
        client_phone: formattedPhone,
        reason_category: 'recompra_futura',
        reason_description: `Ciclo de 3 semanas completo (${client.lastProduct || 'Pod'}). Pronto para disparo.`,
        target_product: client.lastProduct || null,
        target_flavor: client.lastFlavor || null,
        target_puffs: client.lastPuffs || null,
        scheduled_date: todayStr,
        scheduled_time: '15:00'
      });
      if (created) activeReplenishments.push(created);
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

  const formattedPhone = normalizeFollowUpPhone(rawPhone);
  if (!formattedPhone) return null;
  const clientName = (order.client_name || order.customer_name || 'Cliente').trim();

  // Extrai primeiro produto/sabor do pedido
  const items = Array.isArray(order.items) ? order.items : [];
  const firstItem = items.length > 0 ? items[0] : null;
  const targetProduct = firstItem ? `${firstItem.name || firstItem.model || 'Pod'} ${firstItem.flavor || ''}`.trim() : (order.product_name || 'Pod');
  const targetFlavor = firstItem?.flavor || null;
  const targetPuffs = Number(firstItem?.puffs) || undefined;

  // Data de agendamento: exatamente 21 dias a partir de hoje no fuso local
  const now = new Date();
  const targetDate = new Date(now.getTime() + (REPLENISHMENT_CYCLE_DAYS * 24 * 60 * 60 * 1000));
  const scheduledDate = toLocalDateString(targetDate);

  // Busca se já existe um follow-up de recompra ativo para este cliente
  const allFollowUps = await fetchFollowUps(targetCompanyId);
  const existing = allFollowUps.find(f => {
    const fPhone = normalizeFollowUpPhone(f.client_phone);
    return f.status !== 'cancelado' && f.reason_category === 'recompra_futura' && fPhone === formattedPhone;
  });

  if (existing) {
    // Trava Anti-Mico: o cliente acabou de comprar! Reinicia o contador de 3 semanas
    await updateFollowUp(existing.id, {
      status: 'pendente',
      scheduled_date: scheduledDate,
      order_id: order.id || existing.order_id,
      target_product: targetProduct,
      target_flavor: targetFlavor,
      target_puffs: targetPuffs || null,
      reason_description: `Contador reiniciado: compra concluída hoje (${targetProduct}). 3 semanas de contagem regressiva.`,
      updated_at: new Date().toISOString()
    }, targetCompanyId);
    const syncedList = await fetchFollowUps(targetCompanyId);
    void syncFollowUpsWithBackend(syncedList, targetCompanyId);
    return existing;
  }

  // Cria novo agendamento com o loading de 3 semanas
  const created = await createFollowUp({
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
  if (created) {
    const syncedList = await fetchFollowUps(targetCompanyId);
    void syncFollowUpsWithBackend(syncedList, targetCompanyId);
  }
  return created;
}
