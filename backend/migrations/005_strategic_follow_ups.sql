-- ============================================================================
-- 005_strategic_follow_ups.sql
-- Tabela de Follow-ups Estratégicos de Vendas & Negociação (Smoking Pods)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.smoking_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  client_name TEXT NOT NULL,
  reason_category TEXT NOT NULL DEFAULT 'sem_dinheiro_salario',
  reason_description TEXT DEFAULT '',
  target_product TEXT,
  target_flavor TEXT,
  target_puffs INTEGER,
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scheduled_time TEXT DEFAULT '10:00',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'cancelado')),
  order_id UUID REFERENCES public.smoking_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_followups_company ON public.smoking_follow_ups(company_id);
CREATE INDEX IF NOT EXISTS idx_followups_date_status ON public.smoking_follow_ups(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_followups_phone ON public.smoking_follow_ups(client_phone);

-- Desabilitar RLS ou dar permissões amplas para service_role e anon se aplicável
ALTER TABLE IF EXISTS public.smoking_follow_ups DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.smoking_follow_ups TO anon, authenticated, service_role;
