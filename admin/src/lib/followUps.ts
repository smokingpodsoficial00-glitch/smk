import { supabase } from "@/lib/supabase";

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
  company_id?: string | null;
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
  created_at: string;
  completed_at?: string | null;
  whatsappUrl?: string;
  whatsappMessage?: string;
  daysDiff?: number; // < 0 atrasado, 0 hoje, > 0 futuro
}

const LOCAL_STORAGE_KEY = 'smoking_strategic_followups_v1';

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

// Buscar todos os follow-ups
export async function fetchFollowUps(companyId?: string): Promise<FollowUpItem[]> {
  try {
    let query = supabase
      .from('smoking_follow_ups')
      .select('*')
      .order('scheduled_date', { ascending: true });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error || !data) {
      // Fallback para LocalStorage se tabela ainda não estiver criada
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      const localItems: FollowUpItem[] = saved ? JSON.parse(saved) : [];
      return enrichFollowUps(localItems);
    }

    return enrichFollowUps(data);
  } catch (err) {
    console.warn("Aviso ao buscar follow-ups no Supabase, usando LocalStorage:", err);
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return enrichFollowUps(saved ? JSON.parse(saved) : []);
  }
}

// Enriquecer items com helpers calculados
function enrichFollowUps(items: any[]): FollowUpItem[] {
  return items.map(item => {
    const cleanPhone = String(item.client_phone || '').replace(/\D/g, '');
    const waNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const daysDiff = calculateDaysDiff(item.scheduled_date);
    const msg = generateFollowUpMessage(item);
    const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;

    return {
      ...item,
      client_phone: item.client_phone || cleanPhone,
      client_name: item.client_name || 'Cliente',
      reason_category: item.reason_category || 'outro',
      reason_description: item.reason_description || '',
      status: item.status || 'pendente',
      scheduled_date: item.scheduled_date || new Date().toISOString().split('T')[0],
      daysDiff,
      whatsappMessage: msg,
      whatsappUrl,
    };
  });
}

// Criar novo Follow-up
export async function createFollowUp(item: {
  company_id?: string;
  client_phone: string;
  client_name: string;
  reason_category: FollowUpReasonCategory;
  reason_description?: string;
  target_product?: string;
  target_flavor?: string;
  target_puffs?: number;
  scheduled_date: string;
  scheduled_time?: string;
}): Promise<FollowUpItem | null> {
  const cleanPhone = String(item.client_phone).replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  const payload = {
    company_id: item.company_id,
    client_phone: formattedPhone,
    client_name: item.client_name.trim() || 'Cliente',
    reason_category: item.reason_category,
    reason_description: (item.reason_description || '').trim(),
    target_product: item.target_product || null,
    target_flavor: item.target_flavor || null,
    target_puffs: item.target_puffs || null,
    scheduled_date: item.scheduled_date,
    scheduled_time: item.scheduled_time || '10:00',
    status: 'pendente' as FollowUpStatus,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('smoking_follow_ups')
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      return enrichFollowUps([data])[0];
    }
  } catch (e) {}

  // Fallback LocalStorage
  const localId = `fu_${Date.now()}`;
  const localItem: FollowUpItem = {
    ...payload,
    id: localId,
    created_at: new Date().toISOString()
  };

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list = saved ? JSON.parse(saved) : [];
    list.unshift(localItem);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}

  return enrichFollowUps([localItem])[0];
}

// Marcar Follow-up como Concluído (Venda Fechada)
export async function completeFollowUp(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('smoking_follow_ups')
      .update({
        status: 'concluido',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (!error) return true;
  } catch (e) {}

  // LocalStorage update
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const list = JSON.parse(saved).map((item: any) => 
        item.id === id ? { ...item, status: 'concluido', completed_at: new Date().toISOString() } : item
      );
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      return true;
    }
  } catch (e) {}

  return true;
}

// Reagendar ou Atualizar Follow-up
export async function updateFollowUp(id: string, updates: Partial<FollowUpItem>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('smoking_follow_ups')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (!error) return true;
  } catch (e) {}

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const list = JSON.parse(saved).map((item: any) => 
        item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
      );
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      return true;
    }
  } catch (e) {}

  return true;
}

// Excluir Follow-up
export async function deleteFollowUp(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('smoking_follow_ups')
      .delete()
      .eq('id', id);

    if (!error) return true;
  } catch (e) {}

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const list = JSON.parse(saved).filter((item: any) => item.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      return true;
    }
  } catch (e) {}

  return true;
}
