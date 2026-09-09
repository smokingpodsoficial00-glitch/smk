-- ==========================================
-- SCHEMA COMPLETO - SMOKING PODS (SUPABASE)
-- Execute este script no SQL Editor do seu novo Supabase
-- ==========================================

create extension if not exists "uuid-ossp";

-- 1. Tabela de Empresas (Companies)
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  address text,
  logo_url text,
  instagram text,
  business_hours text,
  delivery_fee numeric default 0,
  delivery_radius numeric default 10,
  pix_key text,
  payment_gateway jsonb default '{}'::jsonb,
  template_type text default 'pods',
  onboarding_done boolean default true,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. Tabela de Configuração da Loja (Store Config)
create table if not exists public.store_config (
  id uuid primary key default gen_random_uuid(),
  store_name text default 'Smoking Pods',
  store_slug text default 'minha-loja',
  logo_url text,
  whatsapp_number text,
  pix_key text,
  address text,
  instagram_url text,
  description text,
  base_fare numeric default 8.5,
  included_km numeric default 3.0,
  extra_km_fee numeric default 1.4,
  origin_cep text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  company_id uuid
);

-- 3. Tabela de Produtos / Sabores (Smoking Products)
create table if not exists public.smoking_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  puffs numeric default 0,
  flavor text default 'Padrão',
  price numeric not null default 0,
  stock integer default 0,
  image_url text default '',
  is_active boolean default true,
  created_at timestamptz default now(),
  company_id uuid
);

-- 4. Tabela de Pedidos e Metadados do Sistema (Smoking Orders)
create table if not exists public.smoking_orders (
  id uuid primary key default gen_random_uuid(),
  client_phone text,
  client_name text,
  items jsonb default '[]'::jsonb,
  total_amount numeric default 0,
  shipping_fee numeric default 0,
  shipping_address text,
  payment_status text default 'PENDENTE',
  delivery_status text default 'PREPARANDO',
  payment_method text default 'PIX',
  receipt_url text,
  created_at timestamptz default now(),
  company_id uuid
);

-- 5. Tabela de Clientes do CRM (Smoking Clients)
create table if not exists public.smoking_clients (
  id uuid primary key default gen_random_uuid(),
  phone text,
  name text,
  address text,
  created_at timestamptz default now(),
  company_id uuid
);

-- ==========================================
-- Habilitar Políticas de Acesso RLS (Permissivo para Anon)
-- ==========================================
alter table public.companies enable row level security;
alter table public.store_config enable row level security;
alter table public.smoking_products enable row level security;
alter table public.smoking_orders enable row level security;
alter table public.smoking_clients enable row level security;

drop policy if exists "Allow all on companies" on public.companies;
create policy "Allow all on companies" on public.companies for all using (true) with check (true);

drop policy if exists "Allow all on store_config" on public.store_config;
create policy "Allow all on store_config" on public.store_config for all using (true) with check (true);

drop policy if exists "Allow all on smoking_products" on public.smoking_products;
create policy "Allow all on smoking_products" on public.smoking_products for all using (true) with check (true);

drop policy if exists "Allow all on smoking_orders" on public.smoking_orders;
create policy "Allow all on smoking_orders" on public.smoking_orders for all using (true) with check (true);

drop policy if exists "Allow all on smoking_clients" on public.smoking_clients;
create policy "Allow all on smoking_clients" on public.smoking_clients for all using (true) with check (true);

-- ==========================================
-- Habilitar Supabase Realtime para Sincronização ao Vivo
-- ==========================================
do $$
begin
  alter publication supabase_realtime add table public.companies;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.store_config;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.smoking_products;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.smoking_orders;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.smoking_clients;
exception when others then null;
end $$;
