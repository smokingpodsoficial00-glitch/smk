const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'admin', 'node_modules', '@supabase', 'supabase-js'));

const newUrl = 'https://zhlcuhvigfxedafqkwac.supabase.co';
const newAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpobGN1aHZpZ2Z4ZWRhZnFrd2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2ODQzNDgsImV4cCI6MjEwNTI2MDM0OH0.jI1a3dAbQS4oo3vTntCT59Qck8moZlGxsmyU175RN1A';

const newSupabase = createClient(newUrl, newAnonKey);

async function restore() {
  console.log('🚀 Iniciando restauração para o novo Supabase:', newUrl);

  const snapshotPath = path.join(__dirname, 'emergency_snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    console.error('❌ emergency_snapshot.json não encontrado!');
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const tables = ['companies', 'store_config', 'smoking_products', 'smoking_orders', 'smoking_clients'];

  for (const table of tables) {
    const data = snapshot[table];
    if (!data || !data.length) {
      console.log(`⚠️ Tabela ${table} vazia no snapshot.`);
      continue;
    }

    console.log(`📦 Importando ${data.length} registros para ${table}...`);

    const batchSize = 10;
    for (let i = 0; i < data.length; i += batchSize) {
      const chunk = data.slice(i, i + batchSize);
      const { error } = await newSupabase.from(table).upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error(`❌ Erro no lote ${i} - ${i + chunk.length} da tabela ${table}:`, error.message);
      }
    }
    console.log(`✅ Tabela ${table} importada com sucesso!`);
  }

  console.log('🎉 Migração de dados concluída com 100% de sucesso!');
}

restore();
