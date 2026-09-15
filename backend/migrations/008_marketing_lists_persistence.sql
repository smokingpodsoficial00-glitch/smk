-- ============================================================================
-- 008_marketing_lists_persistence.sql
-- Tabelas Canônicas de Listas de Transmissão e Contatos de Marketing
-- ============================================================================

-- 1. TABELA DE LISTAS DE MARKETING
CREATE TABLE IF NOT EXISTS public.smoking_marketing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  legacy_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE CONTATOS DA LISTA DE MARKETING
CREATE TABLE IF NOT EXISTS public.smoking_marketing_list_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.smoking_marketing_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  clean_phone TEXT NOT NULL,
  is_saved BOOLEAN DEFAULT true,
  client_id UUID REFERENCES public.smoking_clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_list_clean_phone UNIQUE (list_id, clean_phone)
);

-- 3. ÍNDICES DE BUSCA E PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_marketing_lists_company ON public.smoking_marketing_lists(company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_list_contacts_list ON public.smoking_marketing_list_contacts(list_id);
CREATE INDEX IF NOT EXISTS idx_marketing_list_contacts_clean_phone ON public.smoking_marketing_list_contacts(clean_phone);
CREATE INDEX IF NOT EXISTS idx_marketing_list_contacts_company ON public.smoking_marketing_list_contacts(company_id);

-- 4. SEGURANÇA E RLS
ALTER TABLE public.smoking_marketing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_marketing_list_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for marketing lists" ON public.smoking_marketing_lists;
CREATE POLICY "Tenant isolation for marketing lists" ON public.smoking_marketing_lists
  FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
    OR auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Tenant isolation for marketing list contacts" ON public.smoking_marketing_list_contacts;
CREATE POLICY "Tenant isolation for marketing list contacts" ON public.smoking_marketing_list_contacts
  FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
    OR auth.uid() IS NOT NULL
  );
