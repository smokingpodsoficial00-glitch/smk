-- ============================================================
-- SCRIPT DE CRIAÇÃO DA ESTRUTURA DE CATEGORIAS E DESTAQUES
-- EMPRESA: SMOKING PODS (Vape Shop Autônoma)
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- 1. Tabela de Categorias do Catálogo
CREATE TABLE IF NOT EXISTS public.smoking_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID, -- Nulo para categorias padrão globais ou ID da empresa para tenant
    name TEXT NOT NULL,          -- Ex: Mais Vendidos, Lançamentos, Destaques, Promoções
    slug TEXT NOT NULL,          -- Ex: mais-vendidos, lancamentos, destaques, promocoes
    badge_text TEXT,             -- Ex: ⭐ Mais vendido, ✦ Novo, Destaque, Oferta
    position INTEGER DEFAULT 0,  -- Ordem das abas de navegação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Relacionamento entre Produtos e Categorias (M:N)
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID,
    product_id UUID NOT NULL REFERENCES public.smoking_products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.smoking_categories(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0, -- Prioridade/ordenação manual do produto dentro da categoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_product_category UNIQUE (product_id, category_id)
);

-- 3. Habilitar Segurança de Nível de Linha (RLS)
ALTER TABLE public.smoking_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para Categorias
DROP POLICY IF EXISTS "Leitura livre de categorias" ON public.smoking_categories;
CREATE POLICY "Leitura livre de categorias" ON public.smoking_categories
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Acesso total para categorias" ON public.smoking_categories;
CREATE POLICY "Acesso total para categorias" ON public.smoking_categories
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Políticas RLS para Relacionamento de Produtos e Categorias
DROP POLICY IF EXISTS "Leitura livre de product_categories" ON public.product_categories;
CREATE POLICY "Leitura livre de product_categories" ON public.product_categories
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Acesso total para product_categories" ON public.product_categories;
CREATE POLICY "Acesso total para product_categories" ON public.product_categories
    FOR ALL USING (true) WITH CHECK (true);

-- 6. Inserção de Categorias Padrão
INSERT INTO public.smoking_categories (id, name, slug, badge_text, position) VALUES
('11111111-1111-4111-a111-111111111111', 'Mais Vendidos', 'mais-vendidos', '⭐ Mais vendido', 1),
('22222222-2222-4222-a222-222222222222', 'Lançamentos', 'lancamentos', '✦ Novo', 2),
('33333333-3333-4333-a333-333333333333', 'Destaques', 'destaques', 'Destaque', 3),
('44444444-4444-4444-a444-444444444444', 'Promoções', 'promocoes', 'Oferta', 4)
ON CONFLICT (id) DO NOTHING;
