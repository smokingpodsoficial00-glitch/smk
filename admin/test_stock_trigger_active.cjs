const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTriggerPresence() {
  console.log("=== TESTANDO SE TRIGGER DE ESTOQUE ESTÁ ATIVA NO SUPABASE ===");

  // 1. Pegar qualquer produto com estoque > 0
  const { data: prods } = await supabase
    .from("smoking_products")
    .select("id, brand, name, flavor, stock")
    .gt("stock", 0)
    .limit(1);

  if (!prods || prods.length === 0) {
    console.log("Nenhum produto com estoque > 0 encontrado.");
    return;
  }

  const testProd = prods[0];
  const initialStock = Number(testProd.stock);
  console.log(`Product: ${testProd.brand} ${testProd.name} (${testProd.flavor}) | ID: ${testProd.id} | Estoque Inicial: ${initialStock}`);

  // 2. Inserir um pedido de TESTE temporário com payment_status = 'PAGO'
  const testOrderPayload = {
    client_name: "__TEST_TRIGGER_CLIENT__",
    client_phone: "__SYSTEM_TEST_TRIGGER__",
    shipping_address: "Teste de Trigger SQL",
    items: [
      {
        product_id: testProd.id,
        name: testProd.name,
        brand: testProd.brand,
        flavor: testProd.flavor,
        quantity: 1,
        price: 90
      }
    ],
    total_amount: 90,
    shipping_fee: 0,
    payment_status: "PAGO",
    delivery_status: "CONCLUIDO",
    payment_method: "PIX"
  };

  const { data: insertedOrder, error: insertErr } = await supabase
    .from("smoking_orders")
    .insert(testOrderPayload)
    .select()
    .single();

  if (insertErr) {
    console.error("Erro inserção:", insertErr);
    return;
  }

  console.log(`Pedido de teste inserido com sucesso! ID: ${insertedOrder.id}`);

  // 3. Checar estoque após inserção (sem nenhuma chamada frontend de update stock)
  const { data: prodAfter } = await supabase
    .from("smoking_products")
    .select("stock")
    .eq("id", testProd.id)
    .single();

  const stockAfterInsert = Number(prodAfter.stock);
  console.log(`Estoque APÓS Inserção do Pedido: ${stockAfterInsert}`);

  const isTriggerActive = stockAfterInsert === (initialStock - 1);
  console.log(`Trigger SQL no Supabase está ATIVA? ${isTriggerActive ? 'YES! (Autobaias pelo banco)' : 'NO (O banco NÃO baixou o estoque sozinho)'}`);

  // 4. Limpar o pedido de teste inserido
  await supabase
    .from("smoking_orders")
    .delete()
    .eq("id", insertedOrder.id);

  // Re-checar estoque pós limpeza
  const { data: prodFinal } = await supabase
    .from("smoking_products")
    .select("stock")
    .eq("id", testProd.id)
    .single();

  console.log(`Estoque final limpo: ${prodFinal.stock}`);
}

testTriggerPresence();
