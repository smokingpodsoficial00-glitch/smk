-- ============================================================================
-- 010_partners_security_and_idempotency.sql
-- Módulo de Sócios: Idempotência de Transações e Isolamento Multi-Tenant Estrito
-- ============================================================================
-- ATENÇÃO: Esta migration deve ser executada no SQL Editor do Console Supabase
-- do projeto correspondente (Dashboard Supabase -> SQL Editor -> Nova Query -> Run).
-- ============================================================================

-- 1. ADICIONAR COLUNA idempotency_key EM public.smoking_partner_transactions
-- Totalmente aditiva e retrocompatível com registros históricos (que permanecem NULL)
ALTER TABLE IF EXISTS public.smoking_partner_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. ÍNDICE ÚNICO PARCIAL MULTI-TENANT POR EMPRESA
-- Impede duplicidade da mesma chave de idempotência na mesma empresa.
-- Como é parcial (WHERE idempotency_key IS NOT NULL), não afeta nem bloqueia
-- registros históricos ou transações sem chave explícita.
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_tx_company_idempotency
ON public.smoking_partner_transactions (company_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 3. FORTALECIMENTO DE ROW LEVEL SECURITY (RLS) MULTI-TENANT
-- Garante que cada empresa acesse e manipule apenas suas próprias transações e sócios.
-- A cláusula permissiva 'OR auth.uid() IS NOT NULL' das políticas legadas é revogada,
-- exigindo que o usuário pertença à empresa via public.get_auth_company_id() ou seja super_admin.

ALTER TABLE public.smoking_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_partner_transactions ENABLE ROW LEVEL SECURITY;

-- 3.1 POLÍTICAS PARA public.smoking_partners
DROP POLICY IF EXISTS "Tenant isolation for partners" ON public.smoking_partners;
DROP POLICY IF EXISTS "Authenticated users can read partners" ON public.smoking_partners;
DROP POLICY IF EXISTS "Authenticated users can insert partners" ON public.smoking_partners;
DROP POLICY IF EXISTS "Authenticated users can update partners" ON public.smoking_partners;
DROP POLICY IF EXISTS "Authenticated users can delete partners" ON public.smoking_partners;
DROP POLICY IF EXISTS "Strict tenant isolation for partners select" ON public.smoking_partners;
DROP POLICY IF EXISTS "Strict tenant isolation for partners insert" ON public.smoking_partners;
DROP POLICY IF EXISTS "Strict tenant isolation for partners update" ON public.smoking_partners;
DROP POLICY IF EXISTS "Strict tenant isolation for partners delete" ON public.smoking_partners;

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

-- 3.2 POLÍTICAS PARA public.smoking_partner_transactions
DROP POLICY IF EXISTS "Tenant isolation for partner transactions" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Authenticated users can read partner transactions" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert partner transactions" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Authenticated users can update partner transactions" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Authenticated users can delete partner transactions" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Strict tenant isolation for partner transactions select" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Strict tenant isolation for partner transactions insert" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Strict tenant isolation for partner transactions update" ON public.smoking_partner_transactions;
DROP POLICY IF EXISTS "Strict tenant isolation for partner transactions delete" ON public.smoking_partner_transactions;

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

-- 4. PERMISSÕES EXPLÍCITAS E REVOGAÇÃO DO ACESSO PÚBLICO
REVOKE ALL ON TABLE public.smoking_partners FROM anon, public;
REVOKE ALL ON TABLE public.smoking_partner_transactions FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.smoking_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.smoking_partner_transactions TO authenticated;
GRANT ALL ON TABLE public.smoking_partners TO service_role;
GRANT ALL ON TABLE public.smoking_partner_transactions TO service_role;
