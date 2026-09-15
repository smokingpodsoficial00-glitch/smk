const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'admin', 'node_modules', '@supabase', 'supabase-js'));

const newUrl = 'https://hzzzuzrcaesvdfsdhdfx.supabase.co';
const newAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6enp1enJjYWVzdmRmc2RoZGZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzUyMTcsImV4cCI6MjEwNDExMTIxN30.W_UOTQNTASaPzXJAowDloEp5zyg_djxlVaiEdxbJW7s';

const newSupabase = createClient(newUrl, newAnonKey);

async function restore() {
  console.log('🚀 Iniciando restauração para o novo Supabase:', newUrl);

  const tables = ['companies', 'store_config', 'smoking_products', 'smoking_orders', 'smoking_clients'];

  for (const table of tables) {
    const filePath = path.join(__dirname, table + '.json');
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ Arquivo ${table}.json não encontrado.`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`📦 Importando ${data.length} registros para ${table}...`);

    const batchSize = 20;
    for (let i = 0; i < data.length; i += batchSize) {
      const chunk = data.slice(i, i + batchSize);
      const { error } = await newSupabase.from(table).upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error(`❌ Erro no lote ${i} - ${i + chunk.length} da tabela ${table}:`, error.message);
      }
    }
    console.log(`✅ Tabela ${table} importada com sucesso!`);
  }

  console.log('🎉 Migração de dados concluída!');
}

restore();
