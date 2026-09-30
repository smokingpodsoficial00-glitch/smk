-- ============================================================================
-- 009_replenishment_alerts.sql
-- Histórico e Auditoria de Avisos de Recompra Disparados no CRM
-- ============================================================================

-- 1. TABELA DE EVENTOS DE ALERTA DE RECOMPRA (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS public.smoking_replenishment_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.smoking_clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT DEFAULT ''
);

-- 2. ÍNDICES DE PERFORMANCE E AUDITORIA
CREATE INDEX IF NOT EXISTS idx_replenishment_alerts_customer 
  ON public.smoking_replenishment_alerts(customer_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_replenishment_alerts_company 
  ON public.smoking_replenishment_alerts(company_id);

-- 3. PERMISSÕES E SEGURANÇA
ALTER TABLE public.smoking_replenishment_alerts DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.smoking_replenishment_alerts TO anon, authenticated, service_role;
