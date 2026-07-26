-- Execute este código no "SQL Editor" do seu painel do Supabase
-- Isso criará a tabela de configuração de frete para o Simulador Dinâmico

CREATE TABLE IF NOT EXISTS shipping_config (
    id SERIAL PRIMARY KEY,
    base_fare DECIMAL(10,2) NOT NULL DEFAULT 8.50,
    included_km DECIMAL(10,2) NOT NULL DEFAULT 3.00,
    extra_km_fee DECIMAL(10,2) NOT NULL DEFAULT 1.40,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insere os valores iniciais recomendados pela IA Especialista
INSERT INTO shipping_config (base_fare, included_km, extra_km_fee)
VALUES (8.50, 3.00, 1.40);
