-- ============================================================================
-- MIGRAÇÃO: ADIÇÃO DA COLUNA customer_id EM smoking_orders
-- Permite vínculo relacional definitivo e persistente entre pedidos e clientes
-- ============================================================================

-- 1. Adicionar coluna customer_id com chave estrangeira para smoking_clients (apenas se não existir)
ALTER TABLE public.smoking_orders 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.smoking_clients(id) ON DELETE SET NULL;

-- 2. Criar índice para buscas ultrarrápidas por cliente no CRM
CREATE INDEX IF NOT EXISTS idx_smoking_orders_customer_id 
ON public.smoking_orders (customer_id);

-- 3. Vincular CIRURGICAMENTE E EXCLUSIVAMENTE o pedido histórico do cliente Kawa Leme
-- Sem alterar NENHUM outro campo (client_name, client_phone, items, valor, status e data permanecem intocados)
UPDATE public.smoking_orders 
SET customer_id = '88a9d1b3-70ad-4fcc-ae67-91b4096ea64a'
WHERE id = 'c6d1db5b-5986-45df-815e-3d09faa86c91'
  AND customer_id IS NULL;
