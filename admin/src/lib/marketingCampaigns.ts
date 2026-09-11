import { supabase } from "@/lib/supabase";

export interface Campaign {
  id: string;
  name: string;
  message: string;
  variations?: string[];
  useVariations?: boolean;
  targetType: 'lists' | 'group' | 'all';
  selectedListIds: string[];
  targetGroupId?: string;
  targetGroupName?: string;
  frequencyDays: number;
  scheduledWeekday?: string;
  scheduledTime?: string;
  startDate?: string;
  batchSize: number;
  batchIntervalMinutes: number;
  status: 'active' | 'paused' | 'completed' | 'draft' | 'archived';
  lastRunDate?: string;
  totalRecipients: number;
  createdAt: string;
  updatedAt?: string;
  legacyId?: string;
  legacyMetadata?: Record<string, any>;
}

const LOCAL_STORAGE_CAMPAIGNS = 'smoking_marketing_campaigns_v1';

function mapDbRowToCampaign(row: any): Campaign {
  const selectedListIds: string[] = Array.isArray(row.campaign_lists)
    ? row.campaign_lists.map((cl: any) => cl.list_id).filter(Boolean)
    : [];

  // Converte time format (ex: "15:00:00" -> "15:00")
  let formattedTime = '15:00';
  if (row.scheduled_time) {
    const parts = String(row.scheduled_time).split(':');
    formattedTime = `${parts[0] || '15'}:${parts[1] || '00'}`;
  }

  // Converte last_run_at para string local de exibição se houver
  let lastRunDateStr: string | undefined = undefined;
  if (row.last_run_at) {
    try {
      lastRunDateStr = new Date(row.last_run_at).toLocaleDateString('pt-BR');
    } catch (e) {
      lastRunDateStr = String(row.last_run_at);
    }
  }

  return {
    id: row.id,
    name: row.name,
    message: row.message_template,
    variations: Array.isArray(row.variations) ? row.variations : [],
    useVariations: !!row.use_variations,
    targetType: row.target_type === 'group' ? 'group' : 'lists',
    selectedListIds,
    targetGroupId: row.target_group_id || undefined,
    targetGroupName: row.target_group_name || undefined,
    frequencyDays: Number(row.frequency_days) || 7,
    scheduledWeekday: row.scheduled_weekday || undefined,
    scheduledTime: formattedTime,
    startDate: row.start_date || undefined,
    batchSize: row.batch_size || 5,
    batchIntervalMinutes: row.batch_interval_minutes || 35,
    status: row.status as any,
    lastRunDate: lastRunDateStr,
    totalRecipients: row.total_recipients || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    legacyId: row.legacy_id || undefined,
    legacyMetadata: row.legacy_metadata || undefined
  };
}

/**
 * Busca todas as campanhas de marketing da empresa ativa no Supabase.
 * Inclui junção com smoking_marketing_campaign_lists para carregar selectedListIds.
 * Salva cache no localStorage de forma estritamente READ-ONLY.
 */
export async function fetchMarketingCampaigns(companyId: string): Promise<Campaign[]> {
  if (!companyId) {
    throw new Error("companyId é obrigatório para consultar campanhas.");
  }

  try {
    const { data, error } = await supabase
      .from('smoking_marketing_campaigns')
      .select(`
        id,
        company_id,
        legacy_id,
        name,
        status,
        target_type,
        target_group_id,
        target_group_name,
        message_template,
        variations,
        use_variations,
        frequency_days,
        schedule_type,
        scheduled_weekday,
        scheduled_time,
        start_date,
        batch_size,
        batch_interval_minutes,
        total_recipients,
        last_run_at,
        created_at,
        updated_at,
        legacy_metadata,
        campaign_lists:smoking_marketing_campaign_lists (
          list_id
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[MarketingCampaigns] Erro ao buscar campanhas no Supabase (usando fallback offline):', error.message);
      return getOfflineCampaignsCache();
    }

    const campaigns = (data || []).map(mapDbRowToCampaign);
    saveOfflineCampaignsCache(campaigns);
    return campaigns;
  } catch (err: any) {
    console.warn('[MarketingCampaigns] Exceção ao consultar Supabase (usando fallback offline):', err?.message || err);
    return getOfflineCampaignsCache();
  }
}

/**
 * Cria uma nova campanha no Supabase com compensação segura:
 * 1. Insere a campanha em smoking_marketing_campaigns com CHECK constraints anti-ban.
 * 2. Se targetType === 'lists', insere as associações em smoking_marketing_campaign_lists.
 * 3. Se a inserção das associações falhar, compensa removendo a campanha recém-criada.
 */
export async function createMarketingCampaign(
  companyId: string,
  data: {
    name: string;
    message: string;
    variations?: string[];
    useVariations?: boolean;
    targetType: 'lists' | 'group' | 'all';
    selectedListIds?: string[];
    targetGroupId?: string;
    targetGroupName?: string;
    frequencyDays?: number;
    scheduledWeekday?: string;
    scheduledTime?: string;
    startDate?: string;
    batchSize?: number;
    batchIntervalMinutes?: number;
    status?: 'active' | 'paused' | 'draft' | 'archived';
    totalRecipients?: number;
  }
): Promise<Campaign> {
  if (!companyId) {
    throw new Error("companyId é obrigatório para criar campanha.");
  }

  const freq = Number(data.frequencyDays) || 0;
  let schedType = 'weekly';
  if (freq === 0) schedType = 'one_time';
  else if (freq === 1) schedType = 'daily';
  else if (freq !== 7) schedType = 'interval';

  const batchSize = Math.min(5, Math.max(1, Number(data.batchSize) || 5));
  const batchInterval = Math.max(35, Number(data.batchIntervalMinutes) || 35);
  const targetType = data.targetType === 'group' ? 'group' : 'lists';

  // 1. Criar registro de campanha
  const { data: createdCamp, error: campErr } = await supabase
    .from('smoking_marketing_campaigns')
    .insert({
      company_id: companyId,
      name: data.name.trim(),
      message_template: data.message,
      variations: data.variations || [],
      use_variations: !!data.useVariations,
      target_type: targetType,
      target_group_id: targetType === 'group' ? (data.targetGroupId || null) : null,
      target_group_name: targetType === 'group' ? (data.targetGroupName || null) : null,
      frequency_days: freq,
      schedule_type: schedType,
      scheduled_weekday: freq === 7 ? (data.scheduledWeekday || null) : null,
      scheduled_time: data.scheduledTime || '15:00',
      start_date: data.startDate || null,
      batch_size: batchSize,
      batch_interval_minutes: batchInterval,
      total_recipients: data.totalRecipients || 0,
      status: data.status || 'active'
    })
    .select('*')
    .single();

  if (campErr || !createdCamp) {
    throw new Error(`Falha ao criar campanha no Supabase: ${campErr?.message || 'Erro desconhecido'}`);
  }

  // 2. Associar listas com compensação segura caso haja erro
  const validListIds = Array.from(new Set(data.selectedListIds || [])).filter(Boolean);

  if (targetType === 'lists' && validListIds.length > 0) {
    const associations = validListIds.map(listId => ({
      company_id: companyId,
      campaign_id: createdCamp.id,
      list_id: listId
    }));

    const { error: assocErr } = await supabase
      .from('smoking_marketing_campaign_lists')
      .insert(associations);

    if (assocErr) {
      // 🛡️ Compensação Segura: remove a campanha criada para evitar estado parcial inconsistente
      console.warn('[MarketingCampaigns] Falha ao associar listas. Executando compensação segura da campanha:', createdCamp.id);
      const { error: rollbackErr } = await supabase
        .from('smoking_marketing_campaigns')
        .delete()
        .eq('id', createdCamp.id)
        .eq('company_id', companyId);

      if (rollbackErr) {
        throw new Error(
          `Falha ao associar listas (${assocErr.message}) e compensação da campanha falhou (${rollbackErr.message}). Operação incompleta.`
        );
      }

      throw new Error(`Falha ao associar listas da campanha: ${assocErr.message}. A campanha criada foi revertida com sucesso.`);
    }
  }

  return mapDbRowToCampaign({
    ...createdCamp,
    campaign_lists: validListIds.map(lid => ({ list_id: lid }))
  });
}

/**
 * Atualiza uma campanha existente no Supabase utilizando Optimistic Locking mandatório:
 * 1. Executa a RPC update_marketing_campaign_optimistic no Supabase para validar expectedUpdatedAt.
 * 2. Se detectar conflito (concorrência com outra sessão), rejeita explicitamente com erro claro.
 * 3. Operação com compensação segura para associação campanha ↔ listas.
 */
export async function updateMarketingCampaign(
  companyId: string,
  campaignId: string,
  updates: Partial<Campaign>,
  expectedUpdatedAt: string
): Promise<Campaign> {
  if (!companyId || !campaignId) {
    throw new Error("companyId e campaignId são obrigatórios para atualizar campanha.");
  }
  if (!expectedUpdatedAt) {
    throw new Error("expectedUpdatedAt é obrigatório para edição segura de campanha com Optimistic Locking.");
  }

  const freq = updates.frequencyDays !== undefined ? Number(updates.frequencyDays) : undefined;
  let schedType: string | undefined = undefined;
  if (freq !== undefined) {
    if (freq === 0) schedType = 'one_time';
    else if (freq === 1) schedType = 'daily';
    else if (freq !== 7) schedType = 'interval';
    else schedType = 'weekly';
  }

  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.message !== undefined) payload.message_template = updates.message;
  if (updates.variations !== undefined) payload.variations = updates.variations;
  if (updates.useVariations !== undefined) payload.use_variations = updates.useVariations;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.targetType !== undefined) payload.target_type = updates.targetType === 'group' ? 'group' : 'lists';
  if (updates.targetGroupId !== undefined) payload.target_group_id = updates.targetGroupId || null;
  if (updates.targetGroupName !== undefined) payload.target_group_name = updates.targetGroupName || null;
  if (freq !== undefined) payload.frequency_days = freq;
  if (schedType !== undefined) payload.schedule_type = schedType;
  if (updates.scheduledWeekday !== undefined) payload.scheduled_weekday = updates.scheduledWeekday || null;
  if (updates.scheduledTime !== undefined) payload.scheduled_time = updates.scheduledTime;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate || null;
  if (updates.batchSize !== undefined) payload.batch_size = Math.min(5, Math.max(1, Number(updates.batchSize) || 5));
  if (updates.batchIntervalMinutes !== undefined) payload.batch_interval_minutes = Math.max(35, Number(updates.batchIntervalMinutes) || 35);

  // 1. Executa Optimistic Locking na campanha via RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc('update_marketing_campaign_optimistic', {
    p_campaign_id: campaignId,
    p_expected_updated_at: expectedUpdatedAt,
    p_payload: payload
  });

  if (rpcError) {
    throw new Error(`Erro ao salvar campanha via RPC: ${rpcError.message}`);
  }

  if (rpcResult && rpcResult.success === false) {
    if (rpcResult.error === 'CONFLICT_MODIFIED_BY_ANOTHER_USER') {
      const conflictErr: any = new Error(
        "CONFLITO DE EDIÇÃO: Esta campanha foi alterada por outro usuário ou sessão simultânea. Seus dados foram recarregados com a versão mais recente para evitar sobrescrita acidental."
      );
      conflictErr.isConflict = true;
      conflictErr.currentUpdatedAt = rpcResult.current_updated_at;
      throw conflictErr;
    }
    throw new Error(rpcResult.error || "Falha desconhecida na atualização otimista da campanha.");
  }

  // 2. Operação com Compensação Segura: Sincronização de Listas
  if (updates.selectedListIds !== undefined) {
    const targetLists = Array.from(new Set(updates.selectedListIds)).filter(Boolean);

    // Ler associações atuais da campanha
    const { data: currentAssocs, error: fetchAssocErr } = await supabase
      .from('smoking_marketing_campaign_lists')
      .select('list_id')
      .eq('campaign_id', campaignId)
      .eq('company_id', companyId);

    if (fetchAssocErr) {
      throw new Error(`Erro ao ler associações de listas da campanha: ${fetchAssocErr.message}`);
    }

    const currentListIds = (currentAssocs || []).map((a: any) => a.list_id);
    const toRemove = currentListIds.filter(lid => !targetLists.includes(lid));
    const toAdd = targetLists.filter(lid => !currentListIds.includes(lid));

    // Remover desmarcadas
    if (toRemove.length > 0) {
      const { error: removeErr } = await supabase
        .from('smoking_marketing_campaign_lists')
        .delete()
        .eq('campaign_id', campaignId)
        .eq('company_id', companyId)
        .in('list_id', toRemove);

      if (removeErr) {
        throw new Error(`Erro ao desvincular listas da campanha: ${removeErr.message}`);
      }
    }

    // Inserir novas
    if (toAdd.length > 0) {
      const addPayload = toAdd.map(lid => ({
        company_id: companyId,
        campaign_id: campaignId,
        list_id: lid
      }));

      const { error: addErr } = await supabase
        .from('smoking_marketing_campaign_lists')
        .insert(addPayload);

      if (addErr) {
        throw new Error(`Erro ao vincular novas listas na campanha: ${addErr.message}`);
      }
    }
  }

  // 3. Recarregar campanha atualizada do banco
  const campaigns = await fetchMarketingCampaigns(companyId);
  const reloaded = campaigns.find(c => c.id === campaignId);
  if (!reloaded) {
    throw new Error("Campanha atualizada não encontrada após recarregamento.");
  }
  return reloaded;
}

/**
 * Atualização rápida de status (active <-> paused).
 * Operação direta justificada para ações rápidas de play/pause no painel.
 */
export async function setMarketingCampaignStatus(
  companyId: string,
  campaignId: string,
  status: 'active' | 'paused'
): Promise<void> {
  if (!companyId || !campaignId) {
    throw new Error("companyId e campaignId são obrigatórios para alternar status.");
  }

  const { error } = await supabase
    .from('smoking_marketing_campaigns')
    .update({ status })
    .eq('id', campaignId)
    .eq('company_id', companyId);

  if (error) {
    throw new Error(`Erro ao alterar status da campanha: ${error.message}`);
  }
}

/**
 * Exclui uma campanha no Supabase.
 * Protegida por ON DELETE RESTRICT caso haja execuções (RUNs) registradas.
 */
export async function deleteMarketingCampaign(companyId: string, campaignId: string): Promise<void> {
  if (!companyId || !campaignId) {
    throw new Error("companyId e campaignId são obrigatórios para excluir campanha.");
  }

  const { error } = await supabase
    .from('smoking_marketing_campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('company_id', companyId);

  if (error) {
    if (error.code === '23503') {
      throw new Error("Esta campanha não pode ser excluída porque já possui execuções (RUNs) registradas no histórico.");
    }
    throw new Error(`Erro ao excluir campanha: ${error.message}`);
  }
}

// Helpers de cache local (estritamente READ-ONLY)
function getOfflineCampaignsCache(): Campaign[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_CAMPAIGNS) : null;
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

function saveOfflineCampaignsCache(camps: Campaign[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_CAMPAIGNS, JSON.stringify(camps));
    }
  } catch (e) {}
}
