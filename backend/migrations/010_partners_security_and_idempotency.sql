-- ============================================================================
-- 010_partners_security_and_idempotency.sql
-- Fortalecimento de Segurança Multi-Tenant e Integridade Societária
-- ============================================================================

-- 1. ADICIONAR COLUNA idempotency_key EM public.smoking_partner_transactions
-- Aditiva e totalmente compatível com dados existentes
ALTER TABLE IF EXISTS public.smoking_partner_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Índice para busca rápida e proteção única por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_tx_company_idempotency
ON public.smoking_partner_transactions (company_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 2. POLÍTICAS RLS ESTRITAS PARA SÓCIOS E TRANSAÇÕES
-- Garante que nenhum usuário autenticado acesse ou modifique dados de outra empresa
-- Regra estrita: O usuário deve pertencer à empresa (via company_users) ou ser super_admin.
-- A cláusula permissiva 'OR auth.uid() IS NOT NULL' foi formalmente removida.

ALTER TABLE public.smoking_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_partner_transactions ENABLE ROW LEVEL SECURITY;

-- 2.1 smoking_partners
DROP POLICY IF EXISTS "Tenant isolation for partners" ON public.smoking_partners;
DROP POLICY IF EXISTS "Authenticated users can read partners" ON public.smoking_partners;
DROP POLICY IF EXISTS "Authenticated users can insert partners" ON public.smoking_partners;
DROP POLICY IF EXISTS "Authenticated users can update partners" ON public.smoking_partners;
DROP POLICY IF EXISTS "Authenticated users can delete partners" ON public.smoking_partners;

CREATE POLICY "Strict tenant isolation for partners select" ON public.smoking_partners
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Strict tenant isolation for partners insert" ON public.smoking_partners
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Strict tenant isolation for partners update" ON public.smoking_partners
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Strict tenant isolation for partners delete" ON public.smoking_partners
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  );

-- 2.2 smoking_partner_transactions
DROP POLICY IF EXISTS "Tenant isolation for partner transactions" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Authenticated users can read partner transactions" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert partner transactions" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Authenticated users can update partner transactions" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Authenticated users can delete partner transactions" ON public.smoking_partner_transactions;

CREATE POLICY "Strict tenant isolation for partner transactions select" ON public.smoking_partner_transactions
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Strict tenant isolation for partner transactions insert" ON public.smoking_partner_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Strict tenant isolation for partner transactions update" ON public.smoking_partner_transactions
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Strict tenant isolation for partner transactions delete" ON public.smoking_partner_transactions
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
  );

-- 3. PERMISSÕES EXPLÍCITAS
REVOKE ALL ON TABLE public.smoking_partners FROM anon, public;
REVOKE ALL ON TABLE public.smoking_partner_transactions FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.smoking_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.smoking_partner_transactions TO authenticated;
GRANT ALL ON TABLE public.smoking_partners TO service_role;
GRANT ALL ON TABLE public.smoking_partner_transactions TO service_role;
