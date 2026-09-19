import { supabase } from "@/lib/supabase";
import { getBackendUrl } from "@/lib/backend";

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

async function syncListsWithBackend(lists: BroadcastList[]): Promise<void> {
  try {
    await fetch(`${getBackendUrl()}/api/marketing/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lists })
    });
  } catch (e) {
    console.warn('[MarketingLists] Falha ao sincronizar listas com backend Node:', e);
  }
}

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
      console.warn('[MarketingLists] Supabase indisponível/sem tabela de listas. Consultando backend Node:', error.message);
      try {
        const res = await fetch(`${getBackendUrl()}/api/marketing/lists`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.lists) && data.lists.length > 0) {
            const local = getOfflineListsCache();
            const merged = [...data.lists];
            local.forEach((ll: BroadcastList) => {
              if (!merged.some(ml => ml.id === ll.id)) {
                merged.push(ll);
              }
            });
            saveOfflineListsCache(merged);
            return merged;
          }
        }
      } catch (beErr) {}
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

    // Cache local de leitura rápida
    saveOfflineListsCache(mappedLists);
    syncListsWithBackend(mappedLists);

    return mappedLists;
  } catch (err: any) {
    console.warn('[MarketingLists] Exceção ao consultar Supabase (usando fallback backend + offline):', err?.message || err);
    try {
      const res = await fetch(`${getBackendUrl()}/api/marketing/lists`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.lists) && data.lists.length > 0) {
          const local = getOfflineListsCache();
          const merged = [...data.lists];
          local.forEach((ll: BroadcastList) => {
            if (!merged.some(ml => ml.id === ll.id)) {
              merged.push(ll);
            }
          });
          saveOfflineListsCache(merged);
          return merged;
        }
      }
    } catch (beErr) {}
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

  try {
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
        console.warn('[MarketingLists] Falha ao inserir contatos. Executando compensação segura da lista:', createdList.id);
        await supabase
          .from('smoking_marketing_lists')
          .delete()
          .eq('id', createdList.id)
          .eq('company_id', companyId);

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

    const newList: BroadcastList = {
      id: createdList.id,
      name: createdList.name,
      description: createdList.description || '',
      color: createdList.color || '#10b981',
      createdAt: createdList.created_at,
      updatedAt: createdList.updated_at,
      contacts: insertedContacts
    };

    const currentAll = getOfflineListsCache();
    const newAll = [...currentAll.filter(l => l.id !== newList.id), newList];
    saveOfflineListsCache(newAll);
    syncListsWithBackend(newAll);

    return newList;
  } catch (err: any) {
    console.warn('[MarketingLists] Supabase falhou ao criar lista. Utilizando fallback local + backend:', err?.message || err);
    const fallbackList: BroadcastList = {
      id: `list_${Date.now()}`,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      color: data.color || '#10b981',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contacts: (data.contacts || []).map((c, i) => ({
        id: c.id || `c_${Date.now()}_${i}`,
        name: c.name,
        phone: c.phone,
        cleanPhone: normalizeCleanPhone(c.cleanPhone || c.phone),
        isSaved: !!c.isSaved,
        clientId: c.clientId || null
      }))
    };

    const currentAll = getOfflineListsCache();
    const newAll = [...currentAll, fallbackList];
    saveOfflineListsCache(newAll);
    syncListsWithBackend(newAll);

    return fallbackList;
  }
}

/**
 * Atualiza uma lista existente com resiliência total (Supabase com fallback no backend Node + cache local).
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

  try {
    // 1. Atualizar campos da lista principal se fornecidos
    const listPatch: any = {};
    if (updates.name !== undefined) listPatch.name = updates.name.trim();
    if (updates.description !== undefined) listPatch.description = updates.description.trim() || null;
    if (updates.color !== undefined) listPatch.color = updates.color;

    if (Object.keys(listPatch).length > 0) {
      await supabase
        .from('smoking_marketing_lists')
        .update(listPatch)
        .eq('id', listId)
        .eq('company_id', companyId);
    }

    // 2. Se contatos foram informados, efetuar DIFF cirúrgico
    if (updates.contacts !== undefined) {
      const { data: currentContacts, error: fetchErr } = await supabase
        .from('smoking_marketing_list_contacts')
        .select('id, clean_phone, name, phone, is_saved, client_id')
        .eq('list_id', listId)
        .eq('company_id', companyId);

      if (!fetchErr) {
        const currentMap = new Map<string, any>();
        (currentContacts || []).forEach(c => currentMap.set(c.clean_phone, c));

        const newMap = new Map<string, ContactItem>();
        updates.contacts.forEach(c => {
          const clean = normalizeCleanPhone(c.cleanPhone || c.phone);
          if (clean && !newMap.has(clean)) {
            newMap.set(clean, c);
          }
        });

        const toDeleteIds: string[] = [];
        currentMap.forEach((curr, clean) => {
          if (!newMap.has(clean)) {
            toDeleteIds.push(curr.id);
          }
        });

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

        if (toDeleteIds.length > 0) {
          await supabase
            .from('smoking_marketing_list_contacts')
            .delete()
            .eq('company_id', companyId)
            .in('id', toDeleteIds);
        }

        if (toInsertPayload.length > 0) {
          await supabase
            .from('smoking_marketing_list_contacts')
            .insert(toInsertPayload);
        }
      }
    }

    const lists = await fetchMarketingLists(companyId);
    const updated = lists.find(l => l.id === listId);
    if (updated) {
      const currentAll = getOfflineListsCache().map(l => l.id === listId ? updated : l);
      saveOfflineListsCache(currentAll);
      syncListsWithBackend(currentAll);
      return updated;
    }
  } catch (err: any) {
    console.warn('[MarketingLists] Supabase falhou na atualização. Utilizando fallback local + backend:', err?.message || err);
  }

  // Fallback local garantido
  const currentAll = getOfflineListsCache();
  const existing = currentAll.find(l => l.id === listId);
  const updatedList: BroadcastList = {
    ...(existing || {
      id: listId,
      name: updates.name || 'Lista',
      description: updates.description || '',
      color: updates.color || '#10b981',
      createdAt: new Date().toISOString(),
      contacts: []
    }),
    ...updates,
    updatedAt: new Date().toISOString(),
    contacts: updates.contacts !== undefined ? updates.contacts : (existing?.contacts || [])
  };

  const newAll = currentAll.some(l => l.id === listId)
    ? currentAll.map(l => l.id === listId ? updatedList : l)
    : [...currentAll, updatedList];

  saveOfflineListsCache(newAll);
  syncListsWithBackend(newAll);

  return updatedList;
}

/**
 * Exclui uma lista.
 */
export async function deleteMarketingList(companyId: string, listId: string): Promise<void> {
  if (!companyId || !listId) {
    throw new Error("companyId e listId são obrigatórios para excluir uma lista.");
  }

  try {
    await supabase
      .from('smoking_marketing_lists')
      .delete()
      .eq('id', listId)
      .eq('company_id', companyId);
  } catch (e) {}

  const currentAll = getOfflineListsCache().filter(l => l.id !== listId);
  saveOfflineListsCache(currentAll);
  syncListsWithBackend(currentAll);
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

// Helpers de cache local
export function getOfflineListsCache(): BroadcastList[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_LISTS) : null;
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveOfflineListsCache(lists: BroadcastList[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_LISTS, JSON.stringify(lists));
    }
  } catch (e) {}
}

/**
 * Adiciona ou atualiza automaticamente um cliente comprador na "LISTA CLIENTES COMPRADORES".
 * Operação idempotente e multi-camadas (LocalStorage -> Supabase -> Backend API).
 */
export async function ensureBuyerInBroadcastList(params: {
  companyId?: string;
  clientName: string;
  clientPhone: string;
  clientId?: string | null;
}): Promise<{ success: boolean; listName: string; isNew: boolean }> {
  const { companyId, clientName, clientPhone, clientId } = params;
  if (!clientPhone) return { success: false, listName: '', isNew: false };

  const clean = normalizeCleanPhone(clientPhone);
  if (!clean) return { success: false, listName: '', isNew: false };

  const targetListName = 'LISTA CLIENTES COMPRADORES';
  let isNewContact = false;

  // 1. Atualizar no Cache Local (localStorage) para reflexo imediato no navegador
  try {
    const cachedLists = getOfflineListsCache();
    let buyersList = cachedLists.find(l => 
      l.name.trim().toLowerCase() === targetListName.toLowerCase() ||
      l.id === 'list_1786989733027' ||
      l.name.toLowerCase().includes('comprador')
    );

    if (!buyersList) {
      buyersList = {
        id: 'list_1786989733027',
        name: targetListName,
        description: 'Lista de transmissão automática de clientes compradores',
        contacts: [],
        color: '#10b981',
        createdAt: new Date().toISOString()
      };
      cachedLists.unshift(buyersList);
    }

    const existingIndex = buyersList.contacts.findIndex(c => c.cleanPhone === clean);
    if (existingIndex >= 0) {
      if (clientName && clientName.trim() && clientName.trim() !== buyersList.contacts[existingIndex].name) {
        buyersList.contacts[existingIndex].name = clientName.trim();
      }
      if (clientId) {
        buyersList.contacts[existingIndex].clientId = clientId;
      }
    } else {
      buyersList.contacts.push({
        id: `contact_sale_${Date.now()}_${clean.slice(-4)}`,
        name: clientName?.trim() || `Cliente ${clean.slice(-4)}`,
        phone: clientPhone.trim(),
        cleanPhone: clean,
        isSaved: true,
        clientId: clientId || null
      });
      isNewContact = true;
    }

    buyersList.updatedAt = new Date().toISOString();
    saveOfflineListsCache(cachedLists);
  } catch (localErr) {
    console.warn('[MarketingLists] Erro ao atualizar cache local:', localErr);
  }

  // 2. Tentar persistência no Supabase (se as tabelas já existirem)
  if (companyId) {
    try {
      const { data: dbLists } = await supabase
        .from('smoking_marketing_lists')
        .select('id, name')
        .eq('company_id', companyId);

      let targetDbList: { id: any; name: any; } | null | undefined = (dbLists || []).find((l: any) => 
        l.name.trim().toLowerCase() === targetListName.toLowerCase() ||
        l.name.toLowerCase().includes('comprador')
      );

      if (!targetDbList) {
        const { data: created } = await supabase
          .from('smoking_marketing_lists')
          .insert({
            company_id: companyId,
            name: targetListName,
            description: 'Lista de transmissão automática de clientes compradores',
            color: '#10b981'
          })
          .select('id, name')
          .single();
        targetDbList = created;
      }

      if (targetDbList) {
        await supabase
          .from('smoking_marketing_list_contacts')
          .upsert({
            company_id: companyId,
            list_id: targetDbList.id,
            name: clientName?.trim() || `Cliente ${clean.slice(-4)}`,
            phone: clientPhone.trim(),
            clean_phone: clean,
            is_saved: true,
            client_id: clientId || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'list_id,clean_phone' });
      }
    } catch (supabaseErr) {
      // Fallback gracioso caso a migration ainda não tenha sido executada
      console.info('[MarketingLists] Persistência em nuvem Supabase em fallback.');
    }
  }

  return { success: true, listName: targetListName, isNew: isNewContact };
}
