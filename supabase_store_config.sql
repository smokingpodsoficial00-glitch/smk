-- =============================================
-- Script SQL: Tabela store_config
-- Execute no SQL Editor do Supabase Dashboard
-- =============================================

-- 1. Criar a tabela de configuração da loja (linha única)
CREATE TABLE IF NOT EXISTS store_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL DEFAULT 'Minha Loja',
  store_slug text NOT NULL DEFAULT 'minha-loja',
  logo_url text DEFAULT NULL,
  favicon_url text DEFAULT NULL,
  primary_color text DEFAULT '#8b5cf6',
  whatsapp_number text DEFAULT '',
  pix_key text DEFAULT '',
  pix_name text DEFAULT '',
  address text DEFAULT '',
  instagram_url text DEFAULT '',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Inserir configuração padrão
INSERT INTO store_config (store_name, store_slug, description)
VALUES ('Minha Loja', 'minha-loja', 'Configure sua loja nas configurações do painel admin.')
ON CONFLICT DO NOTHING;

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE store_config ENABLE ROW LEVEL SECURITY;

-- 4. Política: qualquer pessoa (anon) pode LER as configurações
CREATE POLICY "Qualquer um pode ler store_config"
  ON store_config
  FOR SELECT
  USING (true);

-- 5. Política: qualquer pessoa autenticada ou anon pode ATUALIZAR (para o admin funcionar sem auth por enquanto)
CREATE POLICY "Qualquer um pode atualizar store_config"
  ON store_config
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 6. Política: permitir INSERT para seed inicial
CREATE POLICY "Qualquer um pode inserir store_config"
  ON store_config
  FOR INSERT
  WITH CHECK (true);

-- 7. Criar bucket de storage para assets da loja (logo, favicon, etc.)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT DO NOTHING;

-- 8. Política de storage: qualquer um pode ler os assets
CREATE POLICY "Assets da loja são públicos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'store-assets');

-- 9. Política de storage: qualquer um pode fazer upload (para admin sem auth)
CREATE POLICY "Upload de assets da loja"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'store-assets');

-- 10. Política de storage: qualquer um pode atualizar assets
CREATE POLICY "Update de assets da loja"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'store-assets')
  WITH CHECK (bucket_id = 'store-assets');

-- 11. Política de storage: qualquer um pode deletar assets
CREATE POLICY "Delete de assets da loja"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'store-assets');

-- 12. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_store_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_store_config_updated_at ON store_config;
CREATE TRIGGER trigger_store_config_updated_at
  BEFORE UPDATE ON store_config
  FOR EACH ROW
  EXECUTE FUNCTION update_store_config_updated_at();
