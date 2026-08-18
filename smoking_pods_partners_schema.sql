-- ============================================================
-- SCRIPT DE INFRAESTRUTURA: MÓDULO SÓCIOS & GESTÃO DE EQUITY
-- EMPRESA: SMOKING PODS
-- ============================================================

-- 1. Tabela de Sócios
CREATE TABLE IF NOT EXISTS public.smoking_partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT DEFAULT 'Sócio-Fundador',
    avatar_color TEXT DEFAULT '#10b981',
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela de Transações Societárias & Fluxo de Caixa
CREATE TABLE IF NOT EXISTS public.smoking_partner_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID,
    partner_id UUID REFERENCES public.smoking_partners(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN (
        'APORTE',
        'RETIRADA_CAPITAL',
        'DISTRIBUICAO_LUCRO',
        'PRO_LABORE',
        'COMPRA_ESTOQUE',
        'DESPESA_OPERACIONAL',
        'REINVESTIMENTO_LUCRO'
    )),
    amount DECIMAL(12,2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    destination_category TEXT DEFAULT 'ESTOQUE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.smoking_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_partner_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Total para a Aplicação
DROP POLICY IF EXISTS "Acesso total para Sócios" ON public.smoking_partners;
CREATE POLICY "Acesso total para Sócios" ON public.smoking_partners 
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total para Transações de Sócios" ON public.smoking_partner_transactions;
CREATE POLICY "Acesso total para Transações de Sócios" ON public.smoking_partner_transactions 
    FOR ALL USING (true) WITH CHECK (true);
