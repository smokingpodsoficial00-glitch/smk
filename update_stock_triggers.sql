-- ============================================================
-- SCRIPT DE AUTOMAÇÃO DE ESTOQUE (SMOKING PODS)
-- Copie TODO este arquivo (do topo ao fim) e cole no SQL Editor
-- ============================================================

-- 1. LIMPEZA PREVENTIVA DE TRIGGERS E FUNÇÕES ANTIGAS
DROP TRIGGER IF EXISTS trg_decrement_stock_on_payment ON public.smoking_orders;
DROP TRIGGER IF EXISTS trg_stock_on_order_insert ON public.smoking_orders;
DROP TRIGGER IF EXISTS trg_stock_on_order_delete ON public.smoking_orders;

DROP FUNCTION IF EXISTS public.decrement_stock_on_payment();
DROP FUNCTION IF EXISTS public.handle_stock_on_order_insert();
DROP FUNCTION IF EXISTS public.handle_stock_on_order_delete();

-- 2. FUNÇÃO E TRIGGER PARA DESCONTO AUTOMÁTICO NO ESTOQUE (NOVO PEDIDO / INSERT)
CREATE OR REPLACE FUNCTION public.handle_stock_on_order_insert()
RETURNS TRIGGER AS $$
DECLARE
    item_record RECORD;
BEGIN
    FOR item_record IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(product_id UUID, name TEXT, flavor TEXT, quantity INTEGER) LOOP
        -- Tenta dar baixa pelo ID do produto, senão busca por Modelo + Sabor
        IF item_record.product_id IS NOT NULL THEN
            UPDATE public.smoking_products
            SET stock = GREATEST(0, stock - COALESCE(item_record.quantity, 1))
            WHERE id = item_record.product_id;
        ELSE
            UPDATE public.smoking_products
            SET stock = GREATEST(0, stock - COALESCE(item_record.quantity, 1))
            WHERE LOWER(name) = LOWER(item_record.name) AND LOWER(flavor) = LOWER(item_record.flavor);
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_on_order_insert
AFTER INSERT ON public.smoking_orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_on_order_insert();

-- 3. FUNÇÃO E TRIGGER PARA DEVOLUÇÃO AUTOMÁTICA AO ESTOQUE (CANCELAMENTO / DELETE)
CREATE OR REPLACE FUNCTION public.handle_stock_on_order_delete()
RETURNS TRIGGER AS $$
DECLARE
    item_record RECORD;
BEGIN
    -- Devolve o estoque se o pedido cancelado/excluído não foi entregue
    IF OLD.delivery_status IS NULL OR (OLD.delivery_status != 'ENTREGUE' AND OLD.delivery_status != 'CONCLUIDO') THEN
        FOR item_record IN SELECT * FROM jsonb_to_recordset(OLD.items) AS x(product_id UUID, name TEXT, flavor TEXT, quantity INTEGER) LOOP
            IF item_record.product_id IS NOT NULL THEN
                UPDATE public.smoking_products
                SET stock = stock + COALESCE(item_record.quantity, 1)
                WHERE id = item_record.product_id;
            ELSE
                UPDATE public.smoking_products
                SET stock = stock + COALESCE(item_record.quantity, 1)
                WHERE LOWER(name) = LOWER(item_record.name) AND LOWER(flavor) = LOWER(item_record.flavor);
            END IF;
        END LOOP;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_on_order_delete
AFTER DELETE ON public.smoking_orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_on_order_delete();
