import { supabase } from './supabase';

export type TaskPriority = 'ALTA' | 'MEDIA' | 'BAIXA';
export type TaskStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA';

export interface TaskCategory {
  id: string;
  company_id: string;
  partner_id: string; // ID do sócio dono deste bloco
  name: string;
  color: string;
  order_index: number;
  created_at?: string;
}

export interface PartnerTask {
  id: string;
  company_id: string;
  assigned_partner_id: string; // Sócio responsável
  category_id?: string | null;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  created_by_partner_id?: string | null; // Sócio que criou
  due_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

const STORAGE_KEY_CATEGORIES = 'smoking_task_categories_cache';
const STORAGE_KEY_TASKS = 'smoking_partner_tasks_cache';

// Categorias padrão inteligentes caso a base esteja 100% vazia
export function getDefaultCategories(companyId: string, partners: { id: string; name: string }[]): TaskCategory[] {
  const categories: TaskCategory[] = [];
  const gabriel = partners.find(p => p.name.toLowerCase().includes('gabriel'));
  const eduardo = partners.find(p => p.name.toLowerCase().includes('eduardo'));

  if (gabriel) {
    categories.push(
      { id: `cat-gab-1`, company_id: companyId, partner_id: gabriel.id, name: 'Marketing & Vendas', color: '#8b5cf6', order_index: 0 },
      { id: `cat-gab-2`, company_id: companyId, partner_id: gabriel.id, name: 'Tráfego Pago & Campanhas', color: '#ec4899', order_index: 1 },
      { id: `cat-gab-3`, company_id: companyId, partner_id: gabriel.id, name: 'Parcerias & Clientes VIP', color: '#3b82f6', order_index: 2 }
    );
  }

  if (eduardo) {
    categories.push(
      { id: `cat-edu-1`, company_id: companyId, partner_id: eduardo.id, name: 'Construção do Sistema', color: '#10b981', order_index: 0 },
      { id: `cat-edu-2`, company_id: companyId, partner_id: eduardo.id, name: 'Infraestrutura & Back-end', color: '#06b6d4', order_index: 1 },
      { id: `cat-edu-3`, company_id: companyId, partner_id: eduardo.id, name: 'Operações & Logística', color: '#f59e0b', order_index: 2 }
    );
  }

  return categories;
}

// ── CRUD: BLOCOS / CATEGORIAS ──

export async function fetchTaskCategories(companyId: string, partnersFallback: { id: string; name: string }[] = []): Promise<TaskCategory[]> {
  try {
    const { data, error } = await supabase
      .from('smoking_task_categories')
      .select('*')
      .eq('company_id', companyId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${companyId}`, JSON.stringify(data));
      return data as TaskCategory[];
    }
  } catch (err) {
    console.warn('[tasks.ts] Falha ao consultar Supabase smoking_task_categories, acionando fallback local:', err);
  }

  // Fallback Local Storage
  const cached = localStorage.getItem(`${STORAGE_KEY_CATEGORIES}_${companyId}`);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  // Gera categorias padrão caso não haja nada salvo ainda
  const defaults = getDefaultCategories(companyId, partnersFallback);
  if (defaults.length > 0) {
    localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${companyId}`, JSON.stringify(defaults));
  }
  return defaults;
}

export async function createTaskCategory(payload: {
  companyId: string;
  partnerId: string;
  name: string;
  color?: string;
}): Promise<TaskCategory> {
  const newCat: TaskCategory = {
    id: crypto.randomUUID(),
    company_id: payload.companyId,
    partner_id: payload.partnerId,
    name: payload.name.trim(),
    color: payload.color || '#10b981',
    order_index: Date.now(),
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('smoking_task_categories')
      .insert({
        id: newCat.id,
        company_id: newCat.company_id,
        partner_id: newCat.partner_id,
        name: newCat.name,
        color: newCat.color,
        order_index: newCat.order_index
      })
      .select()
      .single();

    if (!error && data) {
      newCat.id = data.id;
    }
  } catch (err) {
    console.warn('[tasks.ts] Erro ao salvar categoria no Supabase, salvando localmente:', err);
  }

  // Atualizar cache local
  const cached = localStorage.getItem(`${STORAGE_KEY_CATEGORIES}_${payload.companyId}`);
  const list: TaskCategory[] = cached ? JSON.parse(cached) : [];
  list.push(newCat);
  localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${payload.companyId}`, JSON.stringify(list));

  return newCat;
}

export async function deleteTaskCategory(categoryId: string, companyId: string): Promise<boolean> {
  try {
    await supabase
      .from('smoking_task_categories')
      .delete()
      .eq('id', categoryId)
      .eq('company_id', companyId);
  } catch (err) {
    console.warn('[tasks.ts] Erro ao deletar categoria no Supabase:', err);
  }

  const cached = localStorage.getItem(`${STORAGE_KEY_CATEGORIES}_${companyId}`);
  if (cached) {
    try {
      const list: TaskCategory[] = JSON.parse(cached);
      const filtered = list.filter(c => c.id !== categoryId);
      localStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${companyId}`, JSON.stringify(filtered));
    } catch {}
  }
  return true;
}

// ── CRUD: TAREFAS DOS SÓCIOS ──

export async function fetchPartnerTasks(companyId: string): Promise<PartnerTask[]> {
  try {
    const { data, error } = await supabase
      .from('smoking_partner_tasks')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (data) {
      localStorage.setItem(`${STORAGE_KEY_TASKS}_${companyId}`, JSON.stringify(data));
      return data as PartnerTask[];
    }
  } catch (err) {
    console.warn('[tasks.ts] Falha ao consultar Supabase smoking_partner_tasks, acionando fallback local:', err);
  }

  // Fallback Local Storage
  const cached = localStorage.getItem(`${STORAGE_KEY_TASKS}_${companyId}`);
  if (cached) {
    try {
      return JSON.parse(cached) as PartnerTask[];
    } catch {}
  }

  return [];
}

export async function createPartnerTask(payload: {
  companyId: string;
  assignedPartnerId: string;
  categoryId?: string | null;
  title: string;
  description?: string;
  priority?: TaskPriority;
  createdByPartnerId?: string | null;
  dueDate?: string | null;
}): Promise<PartnerTask> {
  const newTask: PartnerTask = {
    id: crypto.randomUUID(),
    company_id: payload.companyId,
    assigned_partner_id: payload.assignedPartnerId,
    category_id: payload.categoryId || null,
    title: payload.title.trim(),
    description: payload.description?.trim() || '',
    priority: payload.priority || 'MEDIA',
    status: 'PENDENTE',
    created_by_partner_id: payload.createdByPartnerId || null,
    due_date: payload.dueDate || null,
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('smoking_partner_tasks')
      .insert({
        id: newTask.id,
        company_id: newTask.company_id,
        assigned_partner_id: newTask.assigned_partner_id,
        category_id: newTask.category_id,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        status: newTask.status,
        created_by_partner_id: newTask.created_by_partner_id,
        due_date: newTask.due_date
      })
      .select()
      .single();

    if (!error && data) {
      newTask.id = data.id;
    }
  } catch (err) {
    console.warn('[tasks.ts] Erro ao salvar tarefa no Supabase, salvando localmente:', err);
  }

  // Atualizar cache local
  const cached = localStorage.getItem(`${STORAGE_KEY_TASKS}_${payload.companyId}`);
  const list: PartnerTask[] = cached ? JSON.parse(cached) : [];
  list.unshift(newTask);
  localStorage.setItem(`${STORAGE_KEY_TASKS}_${payload.companyId}`, JSON.stringify(list));

  return newTask;
}

export async function updatePartnerTask(
  taskId: string,
  companyId: string,
  updates: Partial<PartnerTask>
): Promise<boolean> {
  try {
    await supabase
      .from('smoking_partner_tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .eq('company_id', companyId);
  } catch (err) {
    console.warn('[tasks.ts] Erro ao atualizar tarefa no Supabase:', err);
  }

  const cached = localStorage.getItem(`${STORAGE_KEY_TASKS}_${companyId}`);
  if (cached) {
    try {
      const list: PartnerTask[] = JSON.parse(cached);
      const updated = list.map(t => t.id === taskId ? { ...t, ...updates, updated_at: new Date().toISOString() } : t);
      localStorage.setItem(`${STORAGE_KEY_TASKS}_${companyId}`, JSON.stringify(updated));
    } catch {}
  }

  return true;
}

export async function deletePartnerTask(taskId: string, companyId: string): Promise<boolean> {
  try {
    await supabase
      .from('smoking_partner_tasks')
      .delete()
      .eq('id', taskId)
      .eq('company_id', companyId);
  } catch (err) {
    console.warn('[tasks.ts] Erro ao excluir tarefa no Supabase:', err);
  }

  const cached = localStorage.getItem(`${STORAGE_KEY_TASKS}_${companyId}`);
  if (cached) {
    try {
      const list: PartnerTask[] = JSON.parse(cached);
      const filtered = list.filter(t => t.id !== taskId);
      localStorage.setItem(`${STORAGE_KEY_TASKS}_${companyId}`, JSON.stringify(filtered));
    } catch {}
  }

  return true;
}

export async function toggleTaskStatus(task: PartnerTask, companyId: string): Promise<PartnerTask> {
  let nextStatus: TaskStatus = 'PENDENTE';
  let completedAt: string | null = null;

  if (task.status === 'PENDENTE') {
    nextStatus = 'EM_ANDAMENTO';
  } else if (task.status === 'EM_ANDAMENTO') {
    nextStatus = 'CONCLUIDA';
    completedAt = new Date().toISOString();
  } else {
    nextStatus = 'PENDENTE';
    completedAt = null;
  }

  const updates = {
    status: nextStatus,
    completed_at: completedAt
  };

  await updatePartnerTask(task.id, companyId, updates);
  return { ...task, ...updates };
}
