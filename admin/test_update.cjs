const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpdate() {
  console.log("=== TESTE DE UPDATE NO SUPABASE ===");
  
  // 1. Busca primeiro produto
  const { data: prods, error: selectErr } = await supabase
    .from("smoking_products")
    .select("*")
    .limit(1);

  if (selectErr || !prods || prods.length === 0) {
    console.error("Erro na busca inicial:", selectErr);
    return;
  }

  const target = prods[0];
  console.log("Produto alvo:", target.id, target.name, target.flavor);

  // 2. Tenta atualizar image_url
  const testUrl = "https://placehold.co/400x500/121212/ffffff.jpg?text=TestImage";
  const { data: updateRes, error: updateErr } = await supabase
    .from("smoking_products")
    .update({ image_url: testUrl })
    .eq("id", target.id)
    .select();

  console.log("Resultado do Update:", updateRes);
  console.log("Erro no Update:", updateErr);
}

testUpdate();
