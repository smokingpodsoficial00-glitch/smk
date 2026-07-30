-- ============================================================================
-- 003_fix_rls_all_tables.sql
-- Desabilita RLS nas tabelas existentes para permitir que pedidos do WhatsApp
-- e Chatbot funcionem sem erros de permissão (code 42501)
-- ============================================================================

ALTER TABLE IF EXISTS public.smoking_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.smoking_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.smoking_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.company_users DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.smoking_orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.smoking_clients TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.smoking_products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.store_config TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.companies TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.company_users TO anon, authenticated, service_role;
