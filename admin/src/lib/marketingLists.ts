import { supabase } from "@/lib/supabase";

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  cleanPhone: string;
  isSaved?: boolean;
  clientId?: string | null;
}

export interface BroadcastList {
  id: string;
  name: string;
  description: string;
  contacts: ContactItem[];
  color: string;
  createdAt: string;
  updatedAt?: string;
  legacyId?: string;
}

const LOCAL_STORAGE_LISTS = 'smoking_broadcast_lists_v1';

export function normalizeCleanPhone(phone: string): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

/**
 * Busca todas as listas de transmissão da empresa ativa no Supabase.
 * Carrega os contatos relacionados de forma aninhada.
 * Salva cache no localStorage de forma estritamente READ-ONLY.
 */
export async function fetchMarketingLists(companyId: string): Promise<BroadcastList[]> {
  if (!companyId) {
    throw new Error("companyId é obrigatório para consultar listas de marketing.");
  }

  try {
    const { data, error } = await supabase
      .from('smoking_marketing_lists')
      .select(`
        id,
        company_id,
        legacy_id,
        name,
        description,
        color,
        created_at,
        updated_at,
        contacts:smoking_marketing_list_contacts (
          id,
          name,
          phone,
          clean_phone,
          is_saved,
          client_id
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[MarketingLists] Erro ao buscar listas no Supabase (usando fallback offline):', error.message);
      return getOfflineListsCache();
    }

    const mappedLists: BroadcastList[] = (data || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      description: l.description || '',
      color: l.color || '#10b981',
      createdAt: l.created_at,
      updatedAt: l.updated_at,
      legacyId: l.legacy_id || undefined,
      contacts: (l.contacts || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        cleanPhone: c.clean_phone,
        isSaved: !!c.is_saved,
        clientId: c.client_id || null
      }))
    }));

    // Cache local de leitura rápida (estritamente READ-ONLY)
    saveOfflineListsCache(mappedLists);

    return mappedLists;
  } catch (err: any) {
    console.warn('[MarketingLists] Exceção ao consultar Supabase (usando fallback offline):', err?.message || err);
    return getOfflineListsCache();
  }
}

/**
 * Cria uma nova lista no Supabase com compensação segura:
 * 1. Insere a lista em smoking_marketing_lists.
 * 2. Insere os contatos (se fornecidos).
 * 3. Caso a inserção dos contatos falhe, executa compensação removendo a lista recém-criada.
 */
export async function createMarketingList(
  companyId: string,
  data: {
    name: string;
    description?: string;
    color?: string;
    contacts?: ContactItem[];
  }
): Promise<BroadcastList> {
  if (!companyId) {
    throw new Error("companyId é obrigatório para criar uma lista.");
  }

  // 1. Criar registro da lista
  const { data: createdList, error: listError } = await supabase
    .from('smoking_marketing_lists')
    .insert({
      company_id: companyId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      color: data.color || '#10b981'
    })
    .select('id, name, description, color, created_at, updated_at')
    .single();

  if (listError || !createdList) {
    throw new Error(`Falha ao criar lista no Supabase: ${listError?.message || 'Erro desconhecido'}`);
  }

  let insertedContacts: ContactItem[] = [];

  // 2. Inserir contatos se houver
  if (data.contacts && data.contacts.length > 0) {
    const contactsPayload = data.contacts.map(c => {
      const clean = normalizeCleanPhone(c.cleanPhone || c.phone);
      return {
        company_id: companyId,
        list_id: createdList.id,
        name: c.name.trim() || `Cliente ${clean.slice(-4)}`,
        phone: String(c.phone).trim(),
        clean_phone: clean,
        is_saved: !!c.isSaved,
        client_id: c.clientId || null
      };
    });

    const { data: contactsResult, error: contactsError } = await supabase
      .from('smoking_marketing_list_contacts')
      .insert(contactsPayload)
      .select('id, name, phone, clean_phone, is_saved, client_id');

    if (contactsError) {
      // 🛡️ Compensação Segura: remove a lista criada para evitar estado parcial órfão
      console.warn('[MarketingLists] Falha ao inserir contatos. Executando compensação segura da lista:', createdList.id);
      const { error: rollbackError } = await supabase
        .from('smoking_marketing_lists')
        .delete()
        .eq('id', createdList.id)
        .eq('company_id', companyId);

      if (rollbackError) {
        throw new Error(
          `Falha ao inserir contatos (${contactsError.message}) e compensação da lista falhou (${rollbackError.message}). Operação incompleta.`
        );
      }

      throw new Error(`Falha ao inserir contatos da lista: ${contactsError.message}. A lista criada foi revertida com sucesso.`);
    }

    insertedContacts = (contactsResult || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      cleanPhone: c.clean_phone,
      isSaved: !!c.is_saved,
      clientId: c.client_id || null
    }));
  }

  return {
    id: createdList.id,
    name: createdList.name,
    description: createdList.description || '',
    color: createdList.color || '#10b981',
    createdAt: createdList.created_at,
    updatedAt: createdList.updated_at,
    contacts: insertedContacts
  };
}

/**
 * Atualiza uma lista existente no Supabase.
 * Se apenas metadados mudarem, atualiza somente smoking_marketing_lists.
 * Se contatos forem fornecidos, realiza DIFF cirúrgico (adiciona novos, remove excluídos, atualiza alterados).
 * NUNCA executa DELETE ALL + INSERT ALL.
 */
export async function updateMarketingList(
  companyId: string,
  listId: string,
  updates: {
    name?: string;
    description?: string;
    color?: string;
    contacts?: ContactItem[];
  }
): Promise<BroadcastList> {
  if (!companyId || !listId) {
    throw new Error("companyId e listId são obrigatórios para atualizar uma lista.");
  }

  // 1. Atualizar campos da lista principal se fornecidos
  const listPatch: any = {};
  if (updates.name !== undefined) listPatch.name = updates.name.trim();
  if (updates.description !== undefined) listPatch.description = updates.description.trim() || null;
  if (updates.color !== undefined) listPatch.color = updates.color;

  if (Object.keys(listPatch).length > 0) {
    const { error: updateListErr } = await supabase
      .from('smoking_marketing_lists')
      .update(listPatch)
      .eq('id', listId)
      .eq('company_id', companyId);

    if (updateListErr) {
      throw new Error(`Erro ao atualizar dados da lista: ${updateListErr.message}`);
    }
  }

  // 2. Se contatos foram informados, efetuar DIFF cirúrgico
  if (updates.contacts !== undefined) {
    // Buscar contatos atuais no Supabase
    const { data: currentContacts, error: fetchErr } = await supabase
      .from('smoking_marketing_list_contacts')
      .select('id, clean_phone, name, phone, is_saved, client_id')
      .eq('list_id', listId)
      .eq('company_id', companyId);

    if (fetchErr) {
      throw new Error(`Erro ao ler contatos atuais para diffing: ${fetchErr.message}`);
    }

    const currentMap = new Map<string, any>();
    (currentContacts || []).forEach(c => currentMap.set(c.clean_phone, c));

    const newMap = new Map<string, ContactItem>();
    updates.contacts.forEach(c => {
      const clean = normalizeCleanPhone(c.cleanPhone || c.phone);
      if (clean && !newMap.has(clean)) {
        newMap.set(clean, c);
      }
    });

    // Contatos para excluir (estavam no banco mas não estão na nova seleção)
    const toDeleteIds: string[] = [];
    currentMap.forEach((curr, clean) => {
      if (!newMap.has(clean)) {
        toDeleteIds.push(curr.id);
      }
    });

    // Contatos para inserir (estão na nova seleção mas não constam no banco)
    const toInsertPayload: any[] = [];
    newMap.forEach((newItem, clean) => {
      if (!currentMap.has(clean)) {
        toInsertPayload.push({
          company_id: companyId,
          list_id: listId,
          name: newItem.name.trim() || `Cliente ${clean.slice(-4)}`,
          phone: String(newItem.phone).trim(),
          clean_phone: clean,
          is_saved: !!newItem.isSaved,
          client_id: newItem.clientId || null
        });
      }
    });

    // Contatos para atualizar (já existem, mas nome ou is_saved mudou)
    const toUpdateItems: { id: string; name: string; is_saved: boolean }[] = [];
    newMap.forEach((newItem, clean) => {
      const curr = currentMap.get(clean);
      if (curr) {
        const nameChanged = newItem.name && newItem.name.trim() !== curr.name;
        const savedChanged = newItem.isSaved !== undefined && !!newItem.isSaved !== !!curr.is_saved;
        if (nameChanged || savedChanged) {
          toUpdateItems.push({
            id: curr.id,
            name: newItem.name.trim() || curr.name,
            is_saved: newItem.isSaved !== undefined ? !!newItem.isSaved : curr.is_saved
          });
        }
      }
    });

    // Execuções cirúrgicas
    if (toDeleteIds.length > 0) {
      const { error: delErr } = await supabase
        .from('smoking_marketing_list_contacts')
        .delete()
        .eq('company_id', companyId)
        .eq('list_id', listId)
        .in('id', toDeleteIds);

      if (delErr) {
        throw new Error(`Erro ao remover contatos desmarcados: ${delErr.message}`);
      }
    }

    if (toInsertPayload.length > 0) {
      const { error: insErr } = await supabase
        .from('smoking_marketing_list_contacts')
        .insert(toInsertPayload);

      if (insErr) {
        throw new Error(`Erro ao adicionar novos contatos na lista: ${insErr.message}`);
      }
    }

    for (const up of toUpdateItems) {
      await supabase
        .from('smoking_marketing_list_contacts')
        .update({ name: up.name, is_saved: up.is_saved })
        .eq('id', up.id)
        .eq('company_id', companyId);
    }
  }

  // 3. Recarrega a lista completa atualizada
  const lists = await fetchMarketingLists(companyId);
  const updated = lists.find(l => l.id === listId);
  if (!updated) {
    throw new Error("Lista atualizada não encontrada após reload.");
  }
  return updated;
}

/**
 * Exclui uma lista no Supabase.
 * A exclusão da lista aciona CASCADE automático em smoking_marketing_list_contacts
 * e em smoking_marketing_campaign_lists.
 */
export async function deleteMarketingList(companyId: string, listId: string): Promise<void> {
  if (!companyId || !listId) {
    throw new Error("companyId e listId são obrigatórios para excluir uma lista.");
  }

  const { error } = await supabase
    .from('smoking_marketing_lists')
    .delete()
    .eq('id', listId)
    .eq('company_id', companyId);

  if (error) {
    throw new Error(`Erro ao excluir lista no Supabase: ${error.message}`);
  }
}

/**
 * Adiciona cirurgicamente um contato individual a uma lista existente.
 */
export async function addContactToList(
  companyId: string,
  listId: string,
  contact: {
    name: string;
    phone: string;
    cleanPhone?: string;
    isSaved?: boolean;
    clientId?: string | null;
  }
): Promise<ContactItem> {
  if (!companyId || !listId) {
    throw new Error("companyId e listId são obrigatórios para adicionar contato.");
  }

  const clean = normalizeCleanPhone(contact.cleanPhone || contact.phone);
  if (!clean) {
    throw new Error("Número de telefone inválido.");
  }

  const { data, error } = await supabase
    .from('smoking_marketing_list_contacts')
    .insert({
      company_id: companyId,
      list_id: listId,
      name: contact.name.trim() || `Cliente ${clean.slice(-4)}`,
      phone: String(contact.phone).trim(),
      clean_phone: clean,
      is_saved: !!contact.isSaved,
      client_id: contact.clientId || null
    })
    .select('id, name, phone, clean_phone, is_saved, client_id')
    .single();

  if (error) {
    throw new Error(`Erro ao adicionar contato na lista: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    cleanPhone: data.clean_phone,
    isSaved: !!data.is_saved,
    clientId: data.client_id || null
  };
}

/**
 * Remove cirurgicamente um contato individual de uma lista.
 */
export async function removeContactFromList(companyId: string, listId: string, contactId: string): Promise<void> {
  if (!companyId || !listId || !contactId) {
    throw new Error("companyId, listId e contactId são obrigatórios para remover contato.");
  }

  const { error } = await supabase
    .from('smoking_marketing_list_contacts')
    .delete()
    .eq('id', contactId)
    .eq('list_id', listId)
    .eq('company_id', companyId);

  if (error) {
    throw new Error(`Erro ao remover contato: ${error.message}`);
  }
}

// Helpers de cache local (estritamente READ-ONLY)
function getOfflineListsCache(): BroadcastList[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_LISTS) : null;
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

function saveOfflineListsCache(lists: BroadcastList[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_LISTS, JSON.stringify(lists));
    }
  } catch (e) {}
}
