-- ============================================================
-- ATUALIZAÇÃO DOS TRIGGERS DE ESTOQUE (SMOKING PODS)
-- Execute este script no SQL Editor do seu painel do Supabase.
-- ============================================================

-- 1. Remove o antigo trigger que descontava apenas na confirmação de pagamento
DROP TRIGGER IF EXISTS trg_decrement_stock_on_payment ON public.smoking_orders;
DROP FUNCTION IF EXISTS public.decrement_stock_on_payment();

-- 2. Cria a nova função para decrementar o estoque assim que o pedido for inserido (no painel)
CREATE OR REPLACE FUNCTION public.handle_stock_on_order_insert()
RETURNS TRIGGER AS $$
DECLARE
    item_record RECORD;
BEGIN
    FOR item_record IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(product_id UUID, name TEXT, flavor TEXT, quantity INTEGER) LOOP
        -- Tenta atualizar pelo ID do produto, senão busca por Modelo + Sabor
        IF item_record.product_id IS NOT NULL THEN
            UPDATE public.smoking_products
            SET stock = GREATEST(0, stock - item_record.quantity)
            WHERE id = item_record.product_id;
        ELSE
            UPDATE public.smoking_products
            SET stock = GREATEST(0, stock - item_record.quantity)
            WHERE LOWER(name) = LOWER(item_record.name) AND LOWER(flavor) = LOWER(item_record.flavor);
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para execução no INSERT
DROP TRIGGER IF EXISTS trg_stock_on_order_insert ON public.smoking_orders;
CREATE TRIGGER trg_stock_on_order_insert
AFTER INSERT ON public.smoking_orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_on_order_insert();

-- 3. Cria a função para devolver o estoque quando o pedido for cancelado ou excluído do painel
CREATE OR REPLACE FUNCTION public.handle_stock_on_order_delete()
RETURNS TRIGGER AS $$
DECLARE
    item_record RECORD;
BEGIN
    -- Só devolve se o pedido não estava em status "ENTREGUE" ou "CONCLUIDO" para evitar fraude
    IF OLD.delivery_status != 'ENTREGUE' AND OLD.delivery_status != 'CONCLUIDO' THEN
        FOR item_record IN SELECT * FROM jsonb_to_recordset(OLD.items) AS x(product_id UUID, name TEXT, flavor TEXT, quantity INTEGER) LOOP
            -- Tenta atualizar pelo ID do produto, senão busca por Modelo + Sabor
            IF item_record.product_id IS NOT NULL THEN
                UPDATE public.smoking_products
                SET stock = stock + item_record.quantity
                WHERE id = item_record.product_id;
            ELSE
                UPDATE public.smoking_products
                SET stock = stock + item_record.quantity
                WHERE LOWER(name) = LOWER(item_record.name) AND LOWER(flavor) = LOWER(item_record.flavor);
            END IF;
        END LOOP;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger para execução no DELETE
DROP TRIGGER IF EXISTS trg_stock_on_order_delete ON public.smoking_orders;
CREATE TRIGGER trg_stock_on_order_delete
AFTER DELETE ON public.smoking_orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_on_order_delete();
