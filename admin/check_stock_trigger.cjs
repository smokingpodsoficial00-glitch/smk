const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStockTriggers() {
  console.log("=== VERIFICANDO ESTRUTURA DE ESTOQUE E TRIGGER DE BANCO ===");

  // Testar leitura de um produto para verificar estoque atual
  const { data: prods } = await supabase
    .from("smoking_products")
    .select("id, brand, name, flavor, stock, price, cost_price")
    .gt("stock", 0)
    .limit(5);

  console.log("Exemplo de Produtos em Estoque:", JSON.stringify(prods, null, 2));
}

checkStockTriggers();
