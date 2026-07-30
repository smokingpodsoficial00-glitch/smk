-- ============================================================================
-- 003_fix_rls_all_tables.sql
-- Desabilita RLS em todas as tabelas operacionais do SaaS para permitir
-- que pedidos do WhatsApp, Chatbot e Cadastro funcionem sem erro 42501 (Unauthorized)
-- ============================================================================

ALTER TABLE public.smoking_orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.smoking_orders ADD COLUMN IF NOT EXISTS requested_discount BOOLEAN DEFAULT false;

ALTER TABLE public.smoking_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users DISABLE ROW LEVEL SECURITY;

-- Garantir acesso total (SELECT, INSERT, UPDATE, DELETE) para roles do Supabase
GRANT ALL ON public.smoking_orders TO anon, authenticated, service_role;
GRANT ALL ON public.smoking_clients TO anon, authenticated, service_role;
GRANT ALL ON public.smoking_customers TO anon, authenticated, service_role;
GRANT ALL ON public.smoking_products TO anon, authenticated, service_role;
GRANT ALL ON public.store_config TO anon, authenticated, service_role;
GRANT ALL ON public.companies TO anon, authenticated, service_role;
GRANT ALL ON public.company_users TO anon, authenticated, service_role;

-- Criar políticas permissivas caso RLS seja reativado por engano no painel do Supabase
DROP POLICY IF EXISTS "Allow all on smoking_orders" ON public.smoking_orders;
CREATE POLICY "Allow all on smoking_orders" ON public.smoking_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on smoking_clients" ON public.smoking_clients;
CREATE POLICY "Allow all on smoking_clients" ON public.smoking_clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on smoking_products" ON public.smoking_products;
CREATE POLICY "Allow all on smoking_products" ON public.smoking_products FOR ALL USING (true) WITH CHECK (true);
