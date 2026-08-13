const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSqlUpdate() {
  console.log("=== APLICANDO E TESTANDO ATUALIZAÇÃO DE SCHEMA E TRIGGER NO SUPABASE ===");

  // 1. Tentar chamar RPC ou testar se alteração de coluna/constraint funciona
  console.log("📌 1. Testando atualização de delivery_status para CONCLUIDO no banco...");

  // Selecionar um dos 4 pedidos para testar update de status
  const targetId = "fe0a3fce-fbeb-46b7-ad09-8a93c315f8a2"; // Pedido Stanley

  const { data, error } = await supabase
    .from("smoking_orders")
    .update({ delivery_status: "CONCLUIDO" })
    .eq("id", targetId)
    .select();

  if (error) {
    console.log(`❌ Update rejeitado: ${error.message}`);
    console.log("Precisa remover a constraint de check antiga no Supabase SQL.");
  } else {
    console.log(`✅ Update para CONCLUIDO ACEITO com sucesso pelo banco!`, data);
  }
}

testSqlUpdate();
