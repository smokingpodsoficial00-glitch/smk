-- Migração Supabase: Tabela de Recompras de Estoque (smoking_stock_repurchases)
-- Execute no Editor SQL do Supabase caso queira a tabela dedicada ativa.

CREATE TABLE IF NOT EXISTS public.smoking_stock_repurchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    stock_purchase_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    freight_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_repurchase_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas otimizadas por empresa e data
CREATE INDEX IF NOT EXISTS idx_stock_repurchases_company ON public.smoking_stock_repurchases(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_repurchases_date ON public.smoking_stock_repurchases(purchase_date DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.smoking_stock_repurchases ENABLE ROW LEVEL SECURITY;

-- Política de Acesso Total para Chave Pública Anon (compatível com a API da loja)
CREATE POLICY "Permitir leitura anonima para repurchases"
ON public.smoking_stock_repurchases FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir escrita anonima para repurchases"
ON public.smoking_stock_repurchases FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Habilitar Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.smoking_stock_repurchases;
