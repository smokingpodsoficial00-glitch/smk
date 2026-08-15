-- ============================================================================
-- 004_crm_intelligence_fields.sql
-- Enriquecimento da tabela smoking_clients com campos de CRM e Inteligência
-- ============================================================================

DO $$ 
BEGIN
  -- 1. Perfil de Sabor Predominante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_clients' AND column_name='flavor_profile') THEN
    ALTER TABLE public.smoking_clients ADD COLUMN flavor_profile TEXT DEFAULT 'Não especificado';
  END IF;

  -- 2. Marca Favorita
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_clients' AND column_name='favorite_brand') THEN
    ALTER TABLE public.smoking_clients ADD COLUMN favorite_brand TEXT DEFAULT 'Ignite';
  END IF;

  -- 3. Participação no Grupo VIP do WhatsApp (Inbound Voluntário)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_clients' AND column_name='in_vip_group') THEN
    ALTER TABLE public.smoking_clients ADD COLUMN in_vip_group BOOLEAN DEFAULT false;
  END IF;

  -- 4. Status de Prospecção / Funil
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_clients' AND column_name='prospecting_status') THEN
    ALTER TABLE public.smoking_clients ADD COLUMN prospecting_status TEXT DEFAULT 'base_antiga';
  END IF;

  -- 5. Anotações Internas do Atendente / CRM
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_clients' AND column_name='custom_notes') THEN
    ALTER TABLE public.smoking_clients ADD COLUMN custom_notes TEXT DEFAULT '';
  END IF;

  -- 6. Data de Nascimento / Aniversário
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_clients' AND column_name='birth_date') THEN
    ALTER TABLE public.smoking_clients ADD COLUMN birth_date DATE;
  END IF;

  -- 7. Registro do Último Alerta Preventivo de Recompra Disparado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_clients' AND column_name='last_replenishment_alert_at') THEN
    ALTER TABLE public.smoking_clients ADD COLUMN last_replenishment_alert_at TIMESTAMPTZ;
  END IF;

  -- 8. Data de Atualização
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smoking_clients' AND column_name='updated_at') THEN
    ALTER TABLE public.smoking_clients ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_smoking_clients_phone ON public.smoking_clients(phone);
CREATE INDEX IF NOT EXISTS idx_smoking_clients_flavor ON public.smoking_clients(flavor_profile);
CREATE INDEX IF NOT EXISTS idx_smoking_clients_vip ON public.smoking_clients(in_vip_group);
