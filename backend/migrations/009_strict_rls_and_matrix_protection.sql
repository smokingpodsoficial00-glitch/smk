-- ============================================================================
-- 009_strict_rls_and_matrix_protection.sql
-- Blindagem Definitiva da Loja Matriz (Smoking Pods) & Isolamento Multi-Tenant
-- ============================================================================

-- 1. TRIGGER DE PROTEÇÃO ABSOLUTA DA LOJA MATRIZ CONTRA DELEÇÃO
CREATE OR REPLACE FUNCTION public.protect_matrix_integrity()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.id = 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5'::uuid OR OLD.name ILIKE '%Smoking Pods%' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'AÇÃO BLOQUEADA: A empresa Smoking Pods Matrix é a conta oficial do sistema e é protegida contra exclusão.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_matrix_integrity ON public.companies;
CREATE TRIGGER trg_protect_matrix_integrity
BEFORE DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.protect_matrix_integrity();

-- 2. FUNÇÃO HELPER PARA BUSCA DO COMPANY_ID DO USUÁRIO LOGADO
CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.company_users 
  WHERE auth_user_id = auth.uid()::text 
  AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. FUNÇÃO HELPER PARA VERIFICAR SE É SUPER ADMIN
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((
    SELECT is_super_admin FROM public.company_users 
    WHERE auth_user_id = auth.uid()::text 
    AND is_active = true 
    LIMIT 1
  ), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. ATUALIZAR CONSTRAINT DE TELEFONE EM SMOKING_CLIENTS
-- Permite que o mesmo número de cliente compre em lojas diferentes sem conflito
DO $$
BEGIN
  ALTER TABLE public.smoking_clients DROP CONSTRAINT IF EXISTS smoking_clients_phone_key;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_company_client_phone'
  ) THEN
    ALTER TABLE public.smoking_clients ADD CONSTRAINT uq_company_client_phone UNIQUE (company_id, phone);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint de telefone já ajustada ou tratada: %', SQLERRM;
END $$;

-- 5. ATIVAÇÃO DE RLS COM REGRAS ESTRITAS DE ISOLAMENTO
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_partner_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_marketing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_marketing_list_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_stock_repurchases ENABLE ROW LEVEL SECURITY;

-- 6. POLÍTICAS DE ACESSO

-- COMPANIES
DROP POLICY IF EXISTS "Tenant view companies" ON public.companies;
CREATE POLICY "Tenant view companies" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.get_auth_company_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant update own company" ON public.companies;
CREATE POLICY "Tenant update own company" ON public.companies
  FOR UPDATE TO authenticated
  USING (id = public.get_auth_company_id() OR public.is_super_admin())
  WITH CHECK (id = public.get_auth_company_id() OR public.is_super_admin());

-- SMOKING_PRODUCTS
-- Cardápio Público precisa ler produtos ativos da empresa
DROP POLICY IF EXISTS "Public view active products" ON public.smoking_products;
CREATE POLICY "Public view active products" ON public.smoking_products
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR company_id = public.get_auth_company_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant manage own products" ON public.smoking_products;
CREATE POLICY "Tenant manage own products" ON public.smoking_products
  FOR ALL TO authenticated
  USING (company_id = public.get_auth_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.get_auth_company_id() OR public.is_super_admin());

-- SMOKING_ORDERS
DROP POLICY IF EXISTS "Tenant manage own orders" ON public.smoking_orders;
CREATE POLICY "Tenant manage own orders" ON public.smoking_orders
  FOR ALL TO authenticated
  USING (company_id = public.get_auth_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.get_auth_company_id() OR public.is_super_admin());

-- SMOKING_CLIENTS
DROP POLICY IF EXISTS "Tenant manage own clients" ON public.smoking_clients;
CREATE POLICY "Tenant manage own clients" ON public.smoking_clients
  FOR ALL TO authenticated
  USING (company_id = public.get_auth_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.get_auth_company_id() OR public.is_super_admin());

-- SMOKING_PARTNERS
DROP POLICY IF EXISTS "Tenant manage own partners" ON public.smoking_partners;
CREATE POLICY "Tenant manage own partners" ON public.smoking_partners
  FOR ALL TO authenticated
  USING (company_id = public.get_auth_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.get_auth_company_id() OR public.is_super_admin());

-- SMOKING_PARTNER_TRANSACTIONS
DROP POLICY IF EXISTS "Tenant manage own partner transactions" ON public.smoking_partner_transactions;
CREATE POLICY "Tenant manage own partner transactions" ON public.smoking_partner_transactions
  FOR ALL TO authenticated
  USING (company_id = public.get_auth_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.get_auth_company_id() OR public.is_super_admin());

-- SMOKING_STOCK_REPURCHASES
DROP POLICY IF EXISTS "Tenant manage own stock repurchases" ON public.smoking_stock_repurchases;
CREATE POLICY "Tenant manage own stock repurchases" ON public.smoking_stock_repurchases
  FOR ALL TO authenticated
  USING (company_id = public.get_auth_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.get_auth_company_id() OR public.is_super_admin());

-- SMOKING_MARKETING_LISTS
DROP POLICY IF EXISTS "Tenant manage own marketing lists" ON public.smoking_marketing_lists;
CREATE POLICY "Tenant manage own marketing lists" ON public.smoking_marketing_lists
  FOR ALL TO authenticated
  USING (company_id = public.get_auth_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.get_auth_company_id() OR public.is_super_admin());

-- SMOKING_MARKETING_LIST_CONTACTS
DROP POLICY IF EXISTS "Tenant manage own marketing contacts" ON public.smoking_marketing_list_contacts;
CREATE POLICY "Tenant manage own marketing contacts" ON public.smoking_marketing_list_contacts
  FOR ALL TO authenticated
  USING (company_id = public.get_auth_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.get_auth_company_id() OR public.is_super_admin());

-- Permissão Service Role Total para Scripts e Webhooks do Servidor
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
