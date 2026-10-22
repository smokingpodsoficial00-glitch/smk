-- ============================================================================
-- 011_fix_marketing_lists_permissions.sql
-- Liberação de Permissões e Políticas RLS para Listas de Transmissão de Marketing
-- ============================================================================

-- 1. Garante privilégios de acesso às tabelas para anon, authenticated e service_role
GRANT ALL ON TABLE public.smoking_marketing_lists TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.smoking_marketing_list_contacts TO anon, authenticated, service_role;

-- 2. Permite acesso para anon e authenticated operarem as listas
DROP POLICY IF EXISTS "Allow anon and auth full access to marketing lists" ON public.smoking_marketing_lists;
CREATE POLICY "Allow anon and auth full access to marketing lists" ON public.smoking_marketing_lists
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Permite acesso para anon e authenticated operarem os contatos das listas
DROP POLICY IF EXISTS "Allow anon and auth full access to marketing contacts" ON public.smoking_marketing_list_contacts;
CREATE POLICY "Allow anon and auth full access to marketing contacts" ON public.smoking_marketing_list_contacts
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
