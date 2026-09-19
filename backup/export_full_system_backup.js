const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'admin', 'node_modules', '@supabase', 'supabase-js'));

const supabaseUrl = 'https://zhlcuhvigfxedafqkwac.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpobGN1aHZpZ2Z4ZWRhZnFrd2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2ODQzNDgsImV4cCI6MjEwNTI2MDM0OH0.jI1a3dAbQS4oo3vTntCT59Qck8moZlGxsmyU175RN1A';

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = [
  'companies',
  'company_users',
  'store_config',
  'shipping_config',
  'smoking_products',
  'smoking_orders',
  'smoking_clients',
  'smoking_partners',
  'smoking_partner_transactions',
  'smoking_marketing_lists',
  'smoking_marketing_list_contacts',
  'smoking_stock_repurchases',
  'smoking_crm_follow_ups',
  'smoking_partner_tasks',
  'business_templates'
];

async function exportFullBackup() {
  console.log('🛡️ Iniciando Backup Completo e Seguro de Todas as Informações...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupData = {
    exported_at: new Date().toISOString(),
    supabase_url: supabaseUrl,
    tables: {}
  };

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`⚠️ [${table}] Aviso ao consultar:`, error.message);
        backupData.tables[table] = { status: 'error', message: error.message, count: 0, data: [] };
      } else {
        backupData.tables[table] = { status: 'success', count: data ? data.length : 0, data: data || [] };
        console.log(`✅ [${table}] ${data ? data.length : 0} registros salvos.`);
      }
    } catch (e) {
      console.error(`❌ [${table}] Falha crítica:`, e.message);
      backupData.tables[table] = { status: 'fatal_error', message: e.message, count: 0, data: [] };
    }
  }

  const filename = `full_system_backup_${timestamp}.json`;
  const latestFilename = `full_system_backup_LATEST.json`;
  const outPath = path.join(__dirname, filename);
  const latestPath = path.join(__dirname, latestFilename);

  fs.writeFileSync(outPath, JSON.stringify(backupData, null, 2), 'utf8');
  fs.writeFileSync(latestPath, JSON.stringify(backupData, null, 2), 'utf8');

  console.log(`\n🎉 Backup concluído com sucesso absoluto!`);
  console.log(`📁 Arquivo salvo em: ${outPath}`);
  console.log(`📁 Snapshot LATEST salvo em: ${latestPath}`);
}

exportFullBackup();
