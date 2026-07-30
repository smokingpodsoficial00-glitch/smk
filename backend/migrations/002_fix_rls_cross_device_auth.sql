-- ============================================================================
-- 002_fix_rls_cross_device_auth.sql
-- Libera inserção e consulta pública de empresas para cadastro e login cross-device
-- ============================================================================

-- 1. ADICIONAR COLUNAS SUPORTE A AUTH CROSS-DEVICE
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS auth_password TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS manager_name TEXT;
ALTER TABLE public.company_users ADD COLUMN IF NOT EXISTS auth_password TEXT;

-- 2. DESABILITAR RLS NAS TABELAS DE AUTENTICAÇÃO E EMPRESAS (PARA PERMITIR ACESSO EM QUALQUER DISPOSITIVO)
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users DISABLE ROW LEVEL SECURITY;

-- 3. GARANTIR POLÍTICAS PERMISSIVAS CASO RLS SEJA REATIVADO
DROP POLICY IF EXISTS "Allow public select companies" ON public.companies;
CREATE POLICY "Allow public select companies" ON public.companies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert companies" ON public.companies;
CREATE POLICY "Allow public insert companies" ON public.companies FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update companies" ON public.companies;
CREATE POLICY "Allow public update companies" ON public.companies FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public select company_users" ON public.company_users;
CREATE POLICY "Allow public select company_users" ON public.company_users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert company_users" ON public.company_users;
CREATE POLICY "Allow public insert company_users" ON public.company_users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update company_users" ON public.company_users;
CREATE POLICY "Allow public update company_users" ON public.company_users FOR UPDATE USING (true);
