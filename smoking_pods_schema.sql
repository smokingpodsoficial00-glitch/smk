-- ============================================================
-- SCRIPT DE CRIAÇÃO DA INFRAESTRUTURA DE BANCO DE DADOS
-- EMPRESA: SMOKING PODS (Vape Shop Autônoma)
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- 1. Tabela de Clientes (Smoking Pods)
CREATE TABLE IF NOT EXISTS public.smoking_clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL, -- Número do WhatsApp formatado (ex: 5511999999999)
    name TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Catálogo de Produtos e Estoque (Smoking Pods)
CREATE TABLE IF NOT EXISTS public.smoking_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,          -- Ex: Ignite V50, Elf Bar BC5000
    brand TEXT NOT NULL,         -- Ex: Ignite, Elf Bar, Lost Mary
    puffs INTEGER DEFAULT 5000,  -- Quantidade de puxadas
    flavor TEXT NOT NULL,        -- Ex: Watermelon Ice, Blue Razz Ice
    price DECIMAL(10,2) NOT NULL, -- Preço de venda em BRL (Ex: 90.00)
    stock INTEGER DEFAULT 0,     -- Quantidade em estoque
    image_url TEXT,              -- URL da imagem do produto
    is_active BOOLEAN DEFAULT true, -- Ativo no cardápio
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Pedidos e Vendas (Smoking Pods)
CREATE TABLE IF NOT EXISTS public.smoking_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_phone TEXT NOT NULL,  -- Vinculado ao phone de smoking_clients
    client_name TEXT,            -- Nome do comprador (para agilidade do motoboy)
    items JSONB NOT NULL,        -- Lista de itens comprados ex: [{"product_id": "...", "name": "Ignite V50", "flavor": "Menthol", "quantity": 1, "price": 90.00}]
    total_amount DECIMAL(10,2) NOT NULL, -- Valor total em BRL
    shipping_fee DECIMAL(10,2) DEFAULT 0.00, -- Valor do frete por Km
    shipping_address TEXT NOT NULL, -- Endereço completo para o motoboy
    payment_status TEXT DEFAULT 'PENDENTE' CHECK (payment_status IN ('PENDENTE', 'PAGO', 'REJEITADO')),
    delivery_status TEXT DEFAULT 'AGUARDANDO_PAGAMENTO' CHECK (delivery_status IN ('AGUARDANDO_PAGAMENTO', 'PREPARANDO', 'EM_ROTA', 'ENTREGUE', 'CONCLUIDO', 'CANCELADO')),
    payment_method TEXT DEFAULT 'PIX' CHECK (payment_method IN ('PIX', 'CREDITO_LINK')),
    receipt_url TEXT, -- Link da imagem do comprovante Pix
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Segurança de Nível de Linha (RLS)
ALTER TABLE public.smoking_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_orders ENABLE ROW LEVEL SECURITY;

-- Políticas Públicas e Acesso Total do Cardápio / Admin
DROP POLICY IF EXISTS "Leitura livre de produtos ativos" ON public.smoking_products;
DROP POLICY IF EXISTS "Acesso total para Produtos" ON public.smoking_products;
CREATE POLICY "Acesso total para Produtos" ON public.smoking_products 
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para Criação/Edição do Bot
DROP POLICY IF EXISTS "Acesso total Service Role para Clientes" ON public.smoking_clients;
CREATE POLICY "Acesso total Service Role para Clientes" ON public.smoking_clients 
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total Service Role para Pedidos" ON public.smoking_orders;
CREATE POLICY "Acesso total Service Role para Pedidos" ON public.smoking_orders 
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- INSERÇÃO DE DADOS DE TESTE (Carga Inicial do Catálogo)
-- ============================================================
INSERT INTO public.smoking_products (name, brand, puffs, flavor, price, stock) VALUES
('Ignite V50', 'Ignite', 5000, 'Watermelon Ice', 90.00, 15),
('Ignite V50', 'Ignite', 5000, 'Blueberry Ice', 90.00, 10),
('Ignite V50', 'Ignite', 5000, 'Strawberry Mango', 90.00, 8),
('Ignite V50', 'Ignite', 5000, 'Menthol', 90.00, 20),
('Elf Bar BC5000', 'Elf Bar', 5000, 'Blue Razz Ice', 85.00, 12),
('Elf Bar BC5000', 'Elf Bar', 5000, 'Strawberry Kiwi', 85.00, 14),
('Lost Mary OS5000', 'Lost Mary', 5000, 'Grape Ice', 95.00, 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- AUTOMATIZAÇÕES E VIEWS DE ANÁLISE (ESTOQUE & VENDAS)
-- ============================================================

-- 4. Trigger de baixa automática de estoque ao confirmar pagamento (PAGO)
CREATE OR REPLACE FUNCTION public.decrement_stock_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    item_record RECORD;
BEGIN
    IF NEW.payment_status = 'PAGO' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'PAGO') THEN
        FOR item_record IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(product_id UUID, quantity INTEGER) LOOP
            UPDATE public.smoking_products
            SET stock = GREATEST(0, stock - item_record.quantity)
            WHERE id = item_record.product_id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_decrement_stock_on_payment ON public.smoking_orders;
CREATE OR REPLACE TRIGGER trg_decrement_stock_on_payment
AFTER UPDATE OF payment_status ON public.smoking_orders
FOR EACH ROW
EXECUTE FUNCTION public.decrement_stock_on_payment();

-- 5. View para consolidação de sabores/peças mais vendidos
CREATE OR REPLACE VIEW public.vw_top_selling_flavors AS
SELECT 
    (item->>'product_id')::uuid AS product_id,
    (item->>'name')::text AS product_name,
    (item->>'flavor')::text AS flavor,
    SUM((item->>'quantity')::int) AS total_sold
FROM public.smoking_orders,
LATERAL jsonb_array_elements(items) AS item
WHERE payment_status = 'PAGO'
GROUP BY product_id, product_name, flavor
ORDER BY total_sold DESC;
