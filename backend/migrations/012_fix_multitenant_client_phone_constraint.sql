-- ==============================================================================
-- MIGRAÇÃO CRÍTICA MULTITENANT: ISOLAMENTO DE TELEFONE DE CLIENTES POR EMPRESA
-- ==============================================================================
-- PROBLEMA IDENTIFICADO:
-- A tabela public.smoking_clients possuía a constraint original única global:
-- "smoking_clients_phone_key" em (phone).
-- Isso impedia que uma pessoa (ex: o dono da loja ou um cliente real) comprasse
-- em mais de uma loja do sistema, gerando o erro:
-- "duplicate key value violates unique constraint smoking_clients_phone_key".
--
-- SOLUÇÃO:
-- 1. Garante que registros legados sem company_id pertençam à Smoking Pods oficial.
-- 2. Remove a constraint global que bloqueava o cadastro em lojas secundárias.
-- 3. Cria a restrição correta por empresa: UNIQUE (company_id, phone),
--    permitindo que cada loja do SaaS tenha sua própria carteira de clientes,
--    mesmo que o mesmo cliente compre em várias lojas diferentes.
-- ==============================================================================

-- 1. Atribuir clientes legados sem tenant para a Smoking Pods oficial
UPDATE public.smoking_clients 
SET company_id = 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5' 
WHERE company_id IS NULL;

-- 2. Remover a constraint global única antiga
ALTER TABLE public.smoking_clients 
DROP CONSTRAINT IF EXISTS smoking_clients_phone_key;

-- 3. Criar a constraint única correta de multitenant isolada por loja
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_company_client_phone'
  ) THEN
    ALTER TABLE public.smoking_clients 
    ADD CONSTRAINT uq_company_client_phone UNIQUE (company_id, phone);
  END IF;
END $$;

-- 4. Notificar sucesso no log do banco
DO $$
BEGIN
  RAISE NOTICE 'Constraint smoking_clients_phone_key removida com sucesso e uq_company_client_phone ativa!';
END $$;
