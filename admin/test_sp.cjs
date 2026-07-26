const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
  console.log("--- CONSULTA DE PRODUTOS ---");
  const { data: activeData, error: activeErr } = await supabase
    .from("smoking_products")
    .select("*")
    .eq("is_active", true);

  console.log("Erro activeData:", activeErr);
  console.log("Qtd produtos com is_active=true:", activeData ? activeData.length : 0);
  if (activeData) {
    console.log("Produtos ativos:", activeData.map(p => `${p.brand} ${p.name} (${p.flavor})`));
  }

  const { data: allData, error: allErr } = await supabase
    .from("smoking_products")
    .select("*");

  console.log("\nErro allData:", allErr);
  console.log("Qtd total no banco:", allData ? allData.length : 0);
}

testFetch();
