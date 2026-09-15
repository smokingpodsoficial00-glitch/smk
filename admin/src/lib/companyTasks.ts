import { supabase } from '@/lib/supabase';

export type TaskCategory = 'BUG' | 'MELHORIA' | 'OPERACIONAL' | 'FINANCEIRO' | 'GERAL';
export type TaskPriority = 'URGENTE' | 'MEDIA' | 'BAIXA';
export type TaskStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'REVISAO' | 'CONCLUIDO';

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface CompanyTask {
  id: string;
  company_id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string; // 'Eduardo' | 'Gabriel' | 'Ambos'
  assigned_name: string;
  created_by_name: string;
  due_date: string | null;
  subtasks: TaskSubtask[];
  created_at: string;
  updated_at: string;
}

export const DEFAULT_COMPANY_ID = 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
const LOCAL_STORAGE_KEY = 'smoking_company_tasks_cache_v1';

export const TASK_CATEGORY_CONFIG: Record<TaskCategory, {
  label: string;
  badge: string;
  color: string;
  icon: string;
}> = {
  BUG: {
    label: 'Bug / Erro',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    color: 'text-rose-400',
    icon: '🐛'
  },
  MELHORIA: {
    label: 'Melhoria',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    color: 'text-cyan-400',
    icon: '🚀'
  },
  OPERACIONAL: {
    label: 'Operacional',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    color: 'text-amber-400',
    icon: '📦'
  },
  FINANCEIRO: {
    label: 'Financeiro',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    color: 'text-emerald-400',
    icon: '💰'
  },
  GERAL: {
    label: 'Geral',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    color: 'text-purple-400',
    icon: '🎯'
  }
};

export const TASK_PRIORITY_CONFIG: Record<TaskPriority, {
  label: string;
  badge: string;
  dotColor: string;
}> = {
  URGENTE: {
    label: 'Urgente',
    badge: 'bg-red-500/20 text-red-300 border border-red-500/40 font-bold',
    dotColor: 'bg-red-400 animate-pulse'
  },
  MEDIA: {
    label: 'Média',
    badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    dotColor: 'bg-amber-400'
  },
  BAIXA: {
    label: 'Baixa',
    badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    dotColor: 'bg-emerald-400'
  }
};

export const TASK_STATUS_COLUMNS: Array<{
  id: TaskStatus;
  title: string;
  description: string;
  color: string;
  borderColor: string;
  badgeBg: string;
}> = [
  {
    id: 'PENDENTE',
    title: 'A Fazer',
    description: 'Pendências e itens anotados',
    color: 'text-zinc-300',
    borderColor: 'border-zinc-800',
    badgeBg: 'bg-zinc-800/80 text-zinc-300'
  },
  {
    id: 'EM_ANDAMENTO',
    title: 'Em Andamento',
    description: 'Sendo executado no momento',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/20 text-amber-300'
  },
  {
    id: 'REVISAO',
    title: 'Em Revisão / Teste',
    description: 'Pronto para teste ou validação',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    badgeBg: 'bg-blue-500/20 text-blue-300'
  },
  {
    id: 'CONCLUIDO',
    title: 'Concluído',
    description: 'Tarefas resolvidas com sucesso',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    badgeBg: 'bg-emerald-500/20 text-emerald-300'
  }
];

// Helper para ler cache local de contingência
function getLocalTasksCache(): CompanyTask[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Helper para salvar cache local de contingência
function saveLocalTasksCache(tasks: CompanyTask[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
  } catch {}
}

/**
 * Busca todas as tarefas da empresa
 */
export async function fetchCompanyTasks(companyId: string): Promise<CompanyTask[]> {
  const targetId = companyId || DEFAULT_COMPANY_ID;
  
  try {
    const { data, error } = await supabase
      .from('smoking_company_tasks')
      .select('*')
      .eq('company_id', targetId)
      .order('created_at', { ascending: false });

    if (error) {
      // Se a tabela ainda não existir no Supabase, retorna o cache local sem quebrar a UI
      console.warn('[companyTasks] Supabase query notice, using local cache:', error.message);
      return getLocalTasksCache();
    }

    if (Array.isArray(data)) {
      const normalized: CompanyTask[] = data.map((row: any) => ({
        id: row.id,
        company_id: row.company_id || targetId,
        title: row.title || 'Sem título',
        description: row.description || '',
        category: (row.category || 'GERAL') as TaskCategory,
        priority: (row.priority || 'MEDIA') as TaskPriority,
        status: (row.status || 'PENDENTE') as TaskStatus,
        assigned_to: row.assigned_to || 'Ambos',
        assigned_name: row.assigned_name || row.assigned_to || 'Ambos',
        created_by_name: row.created_by_name || 'Sócio',
        due_date: row.due_date || null,
        subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString()
      }));

      saveLocalTasksCache(normalized);
      return normalized;
    }

    return getLocalTasksCache();
  } catch (err: any) {
    console.warn('[companyTasks] Network error, fallback to cache:', err.message);
    return getLocalTasksCache();
  }
}

/**
 * Cria uma nova tarefa na empresa
 */
export async function createCompanyTask(
  taskInput: Omit<CompanyTask, 'id' | 'created_at' | 'updated_at'>
): Promise<CompanyTask> {
  const companyId = taskInput.company_id || DEFAULT_COMPANY_ID;
  const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'task_' + Date.now();
  const now = new Date().toISOString();

  const newTask: CompanyTask = {
    ...taskInput,
    id: tempId,
    company_id: companyId,
    created_at: now,
    updated_at: now
  };

  // Salva no cache imediatamente (Optimistic)
  const currentCache = getLocalTasksCache();
  saveLocalTasksCache([newTask, ...currentCache]);

  try {
    const payload = {
      company_id: companyId,
      title: taskInput.title.trim(),
      description: taskInput.description ? taskInput.description.trim() : '',
      category: taskInput.category,
      priority: taskInput.priority,
      status: taskInput.status,
      assigned_to: taskInput.assigned_to,
      assigned_name: taskInput.assigned_name,
      created_by_name: taskInput.created_by_name,
      due_date: taskInput.due_date || null,
      subtasks: taskInput.subtasks || []
    };

    const { data, error } = await supabase
      .from('smoking_company_tasks')
      .insert([payload])
      .select()
      .single();

    if (!error && data) {
      const persisted: CompanyTask = {
        id: data.id,
        company_id: data.company_id,
        title: data.title,
        description: data.description || '',
        category: data.category as TaskCategory,
        priority: data.priority as TaskPriority,
        status: data.status as TaskStatus,
        assigned_to: data.assigned_to,
        assigned_name: data.assigned_name || data.assigned_to,
        created_by_name: data.created_by_name,
        due_date: data.due_date,
        subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      // Atualiza o ID no cache com o UUID real do Supabase
      const updatedCache = getLocalTasksCache().map(t => t.id === tempId ? persisted : t);
      saveLocalTasksCache(updatedCache);
      return persisted;
    }
  } catch (err: any) {
    console.warn('[companyTasks] Supabase insert failed, kept in local cache:', err.message);
  }

  return newTask;
}

/**
 * Atualiza campos de uma tarefa existente
 */
export async function updateCompanyTask(
  taskId: string,
  updates: Partial<Omit<CompanyTask, 'id' | 'created_at'>>
): Promise<boolean> {
  const now = new Date().toISOString();
  
  // Atualiza cache otimisticamente
  const currentCache = getLocalTasksCache();
  const updatedCache = currentCache.map(task => {
    if (task.id === taskId) {
      return {
        ...task,
        ...updates,
        updated_at: now
      };
    }
    return task;
  });
  saveLocalTasksCache(updatedCache);

  try {
    const payload: any = {
      ...updates,
      updated_at: now
    };

    const { error } = await supabase
      .from('smoking_company_tasks')
      .update(payload)
      .eq('id', taskId);

    if (error) {
      console.warn('[companyTasks] Update notice on Supabase:', error.message);
    }
    return true;
  } catch (err: any) {
    console.warn('[companyTasks] Error updating task:', err.message);
    return true;
  }
}

/**
 * Exclui uma tarefa
 */
export async function deleteCompanyTask(taskId: string): Promise<boolean> {
  // Remove do cache otimisticamente
  const currentCache = getLocalTasksCache();
  saveLocalTasksCache(currentCache.filter(t => t.id !== taskId));

  try {
    const { error } = await supabase
      .from('smoking_company_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.warn('[companyTasks] Delete notice on Supabase:', error.message);
    }
    return true;
  } catch (err: any) {
    console.warn('[companyTasks] Error deleting task:', err.message);
    return true;
  }
}

/**
 * Sincronização em tempo real via Supabase Realtime
 * Dispara callback sempre que um sócio inserir, alterar ou deletar uma tarefa
 */
export function subscribeToCompanyTasks(
  companyId: string,
  onRemoteChange: (payload: { eventType: string; new?: any; old?: any }) => void
): () => void {
  const targetId = companyId || DEFAULT_COMPANY_ID;
  const channelName = `company_tasks_changes_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'smoking_company_tasks',
        filter: `company_id=eq.${targetId}`
      },
      (payload) => {
        onRemoteChange({
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
