-- ============================================================================
-- 001_saas_foundation.sql (100% AUTO-CONTIDO E À PROVA DE ERROS)
-- Transformação do Smoking Pods em SaaS Multi-Tenant Professional
-- ============================================================================

-- 1. TABELA DE TEMPLATES DE NEGÓCIO (Multi-nicho)
CREATE TABLE IF NOT EXISTS public.business_templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  icon            TEXT,
  categories      JSONB DEFAULT '[]'::jsonb,
  product_fields  JSONB DEFAULT '[]'::jsonb,
  ai_config       JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.business_templates (id, name, icon, categories, product_fields) 
VALUES (
  'pods', 
  'Pods & Vapes', 
  '💨', 
  '["Descartáveis", "Recarregáveis", "Juice", "Acessórios"]'::jsonb,
  '["puffs", "flavor", "brand"]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 2. TABELA DE EMPRESAS (Companies / Tenants)
CREATE TABLE IF NOT EXISTS public.companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  logo_url        TEXT,
  instagram       TEXT,
  business_hours  TEXT,
  delivery_fee    DECIMAL(10,2) DEFAULT 0.00,
  delivery_radius DECIMAL(10,2) DEFAULT 10.00,
  pix_key         TEXT,
  payment_gateway JSONB DEFAULT '{}'::jsonb,
  template_type   TEXT DEFAULT 'pods' REFERENCES public.business_templates(id),
  onboarding_done BOOLEAN DEFAULT false,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA DE USUÁRIOS DA EMPRESA (Company Users & Roles)
CREATE TABLE IF NOT EXISTS public.company_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  auth_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin'
                CHECK (role IN ('admin', 'gerente', 'atendente', 'financeiro', 'estoquista')),
  is_super_admin BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, auth_user_id)
);

-- 4. GARANTIR QUE TODAS AS TABELAS DO SISTEMA EXISTEM
CREATE TABLE IF NOT EXISTS public.store_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT DEFAULT 'Minha Loja',
  store_slug TEXT DEFAULT 'minha-loja',
  logo_url TEXT,
  whatsapp_number TEXT,
  pix_key TEXT,
  address TEXT,
  instagram_url TEXT,
  description TEXT,
  base_fare DECIMAL(10,2) DEFAULT 8.50,
  included_km DECIMAL(10,2) DEFAULT 3.00,
  extra_km_fee DECIMAL(10,2) DEFAULT 1.40,
  origin_cep TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipping_config (
  id SERIAL PRIMARY KEY,
  base_fare DECIMAL(10,2) DEFAULT 8.50,
  included_km DECIMAL(10,2) DEFAULT 3.00,
  extra_km_fee DECIMAL(10,2) DEFAULT 1.40,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.smoking_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  puffs INTEGER DEFAULT 5000,
  flavor TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2) DEFAULT 35.00,
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.smoking_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.smoking_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_phone TEXT NOT NULL,
  client_name TEXT,
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  shipping_fee DECIMAL(10,2) DEFAULT 0.00,
  shipping_address TEXT NOT NULL,
  payment_status TEXT DEFAULT 'PENDENTE',
  delivery_status TEXT DEFAULT 'AGUARDANDO_PAGAMENTO',
  payment_method TEXT DEFAULT 'PIX',
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ADICIONAR COLUNA company_id EM TODAS AS TABELAS
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_products' AND column_name='company_id') THEN
    ALTER TABLE public.smoking_products ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_orders' AND column_name='company_id') THEN
    ALTER TABLE public.smoking_orders ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_clients' AND column_name='company_id') THEN
    ALTER TABLE public.smoking_clients ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_config' AND column_name='company_id') THEN
    ALTER TABLE public.store_config ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_config' AND column_name='company_id') THEN
    ALTER TABLE public.shipping_config ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ÍNDICES DE PERFORMANCE PARA TENANT ISOLATION
CREATE INDEX IF NOT EXISTS idx_products_company  ON public.smoking_products(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company    ON public.smoking_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company   ON public.smoking_clients(company_id);
CREATE INDEX IF NOT EXISTS idx_config_company    ON public.store_config(company_id);
CREATE INDEX IF NOT EXISTS idx_comp_users_auth   ON public.company_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_comp_users_comp   ON public.company_users(company_id);

-- 6. CRIAR EMPRESA PADRÃO E VINCULAR DADOS EXISTENTES (MIGRAÇÃO)
DO $$
DECLARE
  v_default_company_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies) THEN
    INSERT INTO public.companies (name, email, onboarding_done)
    VALUES ('Smoking Pods Matrix', 'contato@smokingpods.com', true)
    RETURNING id INTO v_default_company_id;

    UPDATE public.smoking_products SET company_id = v_default_company_id WHERE company_id IS NULL;
    UPDATE public.smoking_orders SET company_id = v_default_company_id WHERE company_id IS NULL;
    UPDATE public.smoking_clients SET company_id = v_default_company_id WHERE company_id IS NULL;
    UPDATE public.store_config SET company_id = v_default_company_id WHERE company_id IS NULL;
    UPDATE public.shipping_config SET company_id = v_default_company_id WHERE company_id IS NULL;
  END IF;
END $$;

-- 7. FUNÇÃO HELPER PARA BUSCAR O company_id DO USUÁRIO AUTENTICADO
CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.company_users 
  WHERE auth_user_id = auth.uid() 
  AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 8. CONFIGURAÇÃO DE ROW LEVEL SECURITY (RLS) MULTI-TENANT
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smoking_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_config ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS COMPANIES
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
CREATE POLICY "Users can view their own company"
  ON public.companies FOR SELECT
  USING (id = public.get_auth_company_id() OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true));

DROP POLICY IF EXISTS "Admins can update their own company" ON public.companies;
CREATE POLICY "Admins can update their own company"
  ON public.companies FOR UPDATE
  USING (id = public.get_auth_company_id() OR EXISTS (SELECT 1 FROM public.company_users WHERE auth_user_id = auth.uid() AND is_super_admin = true));

-- POLÍTICAS COMPANY_USERS
DROP POLICY IF EXISTS "Users can view members of their company" ON public.company_users;
CREATE POLICY "Users can view members of their company"
  ON public.company_users FOR SELECT
  USING (company_id = public.get_auth_company_id() OR auth_user_id = auth.uid() OR is_super_admin = true);

-- POLÍTICAS PRODUCTS
DROP POLICY IF EXISTS "Acesso total para Produtos" ON public.smoking_products;
DROP POLICY IF EXISTS "Tenant isolation select products" ON public.smoking_products;
CREATE POLICY "Tenant isolation select products" ON public.smoking_products FOR SELECT USING (company_id = public.get_auth_company_id() OR company_id IS NULL);

DROP POLICY IF EXISTS "Tenant isolation insert products" ON public.smoking_products;
CREATE POLICY "Tenant isolation insert products" ON public.smoking_products FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation update products" ON public.smoking_products;
CREATE POLICY "Tenant isolation update products" ON public.smoking_products FOR UPDATE USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation delete products" ON public.smoking_products;
CREATE POLICY "Tenant isolation delete products" ON public.smoking_products FOR DELETE USING (company_id = public.get_auth_company_id());

-- POLÍTICAS ORDERS
DROP POLICY IF EXISTS "Acesso total Service Role para Pedidos" ON public.smoking_orders;
DROP POLICY IF EXISTS "Tenant isolation select orders" ON public.smoking_orders;
CREATE POLICY "Tenant isolation select orders" ON public.smoking_orders FOR SELECT USING (company_id = public.get_auth_company_id() OR company_id IS NULL);

DROP POLICY IF EXISTS "Tenant isolation insert orders" ON public.smoking_orders;
CREATE POLICY "Tenant isolation insert orders" ON public.smoking_orders FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation update orders" ON public.smoking_orders;
CREATE POLICY "Tenant isolation update orders" ON public.smoking_orders FOR UPDATE USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation delete orders" ON public.smoking_orders;
CREATE POLICY "Tenant isolation delete orders" ON public.smoking_orders FOR DELETE USING (company_id = public.get_auth_company_id());

-- POLÍTICAS CLIENTS
DROP POLICY IF EXISTS "Acesso total Service Role para Clientes" ON public.smoking_clients;
DROP POLICY IF EXISTS "Tenant isolation select clients" ON public.smoking_clients;
CREATE POLICY "Tenant isolation select clients" ON public.smoking_clients FOR SELECT USING (company_id = public.get_auth_company_id() OR company_id IS NULL);

DROP POLICY IF EXISTS "Tenant isolation insert clients" ON public.smoking_clients;
CREATE POLICY "Tenant isolation insert clients" ON public.smoking_clients FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation update clients" ON public.smoking_clients;
CREATE POLICY "Tenant isolation update clients" ON public.smoking_clients FOR UPDATE USING (company_id = public.get_auth_company_id());

-- POLÍTICAS STORE_CONFIG
DROP POLICY IF EXISTS "Qualquer um pode ler" ON public.store_config;
DROP POLICY IF EXISTS "Qualquer um pode atualizar" ON public.store_config;
DROP POLICY IF EXISTS "Qualquer um pode inserir" ON public.store_config;
DROP POLICY IF EXISTS "Tenant isolation select store_config" ON public.store_config;
CREATE POLICY "Tenant isolation select store_config" ON public.store_config FOR SELECT USING (company_id = public.get_auth_company_id() OR company_id IS NULL);

DROP POLICY IF EXISTS "Tenant isolation update store_config" ON public.store_config;
CREATE POLICY "Tenant isolation update store_config" ON public.store_config FOR UPDATE USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation insert store_config" ON public.store_config;
CREATE POLICY "Tenant isolation insert store_config" ON public.store_config FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
