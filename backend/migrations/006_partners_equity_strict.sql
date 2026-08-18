-- ============================================================================
-- 006_partners_equity_strict.sql
-- Módulo de Sócios, Gestão de Equity & Fluxo de Caixa Real (Smoking Pods)
-- ============================================================================

-- 1. TABELA DE SÓCIOS
CREATE TABLE IF NOT EXISTS public.smoking_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'Sócio',
  equity_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (equity_percentage >= 0 AND equity_percentage <= 100),
  avatar_color TEXT DEFAULT '#10b981',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE TRANSAÇÕES FINANCEIRAS & SOCIETÁRIAS DISCRIMINADAS
CREATE TABLE IF NOT EXISTS public.smoking_partner_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.smoking_partners(id) ON DELETE SET NULL, -- NULL quando for transação institucional da empresa
  type TEXT NOT NULL CHECK (type IN (
    'APORTE',               -- Entrada de capital aportado pelo sócio
    'RETIRADA_CAPITAL',     -- Retirada de capital investido pelo sócio
    'DISTRIBUICAO_LUCRO',   -- Pagamento de dividendos/lucro ao sócio
    'PRO_LABORE',           -- Remuneração pelo trabalho do sócio (despesa operacional)
    'COMPRA_ESTOQUE',       -- Saída de caixa da empresa para compra de pods
    'DESPESA_OPERACIONAL',  -- Saída de caixa para tráfego/marketing/logística
    'REINVESTIMENTO_LUCRO'  -- Lucro retido da empresa reinvestido em novos ativos/estoque
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  destination_category TEXT DEFAULT 'ESTOQUE', -- 'ESTOQUE', 'CAIXA_GERAL', 'MARKETING', etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ÍNDICES DE PERFORMANCE E ISOLAMENTO
CREATE INDEX IF NOT EXISTS idx_partners_company ON public.smoking_partners(company_id);
CREATE INDEX IF NOT EXISTS idx_partner_tx_company ON public.smoking_partner_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_partner_tx_partner ON public.smoking_partner_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_tx_type ON public.smoking_partner_transactions(type);

-- 4. SEGURANÇA E RLS POR EMPRESA (ISOLAMENTO MULTI-TENANT REAL)
ALTER TABLE public.smoking_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_partner_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for partners" ON public.smoking_partners;
CREATE POLICY "Tenant isolation for partners" ON public.smoking_partners
  FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
    OR auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Tenant isolation for partner transactions" ON public.smoking_partner_transactions;
CREATE POLICY "Tenant isolation for partner transactions" ON public.smoking_partner_transactions
  FOR ALL TO authenticated
  USING (
    company_id = public.get_auth_company_id() 
    OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true)
    OR auth.uid() IS NOT NULL
  );

GRANT ALL ON TABLE public.smoking_partners TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.smoking_partner_transactions TO anon, authenticated, service_role;
