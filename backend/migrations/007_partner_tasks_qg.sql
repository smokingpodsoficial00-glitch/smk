-- ============================================================================
-- 007_partner_tasks_qg.sql
-- Módulo de Tarefas dos Sócios & QG de Produtividade (Smoking Pods)
-- ============================================================================

-- 1. TABELA DE BLOCOS / SETORES DINÂMICOS
CREATE TABLE IF NOT EXISTS public.smoking_task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.smoking_partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#10b981',
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE TAREFAS DOS SÓCIOS
CREATE TABLE IF NOT EXISTS public.smoking_partner_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assigned_partner_id UUID NOT NULL REFERENCES public.smoking_partners(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.smoking_task_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIA' CHECK (priority IN ('ALTA', 'MEDIA', 'BAIXA')),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA')),
  created_by_partner_id UUID REFERENCES public.smoking_partners(id) ON DELETE SET NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ÍNDICES DE PERFORMANCE E CONSULTAS RÁPIDAS
CREATE INDEX IF NOT EXISTS idx_task_categories_company ON public.smoking_task_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_partner ON public.smoking_task_categories(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_tasks_company ON public.smoking_partner_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_partner_tasks_assigned ON public.smoking_partner_tasks(assigned_partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_tasks_category ON public.smoking_partner_tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_partner_tasks_status ON public.smoking_partner_tasks(status);

-- 4. SEGURANÇA E RLS POR TENANT
ALTER TABLE public.smoking_task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_partner_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for task categories" ON public.smoking_task_categories;
CREATE POLICY "Tenant isolation for task categories" ON public.smoking_task_categories
  FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
    OR auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Tenant isolation for partner tasks" ON public.smoking_partner_tasks;
CREATE POLICY "Tenant isolation for partner tasks" ON public.smoking_partner_tasks
  FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
    OR auth.uid() IS NOT NULL
  );

GRANT ALL ON TABLE public.smoking_task_categories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.smoking_partner_tasks TO anon, authenticated, service_role;
