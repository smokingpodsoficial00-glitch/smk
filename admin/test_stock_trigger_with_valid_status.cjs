const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testStockTriggerWithValidStatus() {
  console.log("=== TESTANDO SE TRIGGER DE ESTOQUE EXISTE EM SMOKING_ORDERS ===");

  // 1. Pegar produto com estoque > 0
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
  console.log(`Produto: ${testProd.brand} ${testProd.name} (${testProd.flavor}) | ID: ${testProd.id} | Estoque Inicial: ${initialStock}`);

  // 2. Inserir pedido de teste com status válido "ENTREGUE" e payment_status = "PAGO"
  const testPayload = {
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
    delivery_status: "ENTREGUE",
    payment_method: "PIX"
  };

  const { data: insertedOrder, error: insertErr } = await supabase
    .from("smoking_orders")
    .insert(testPayload)
    .select()
    .single();

  if (insertErr) {
    console.error("Erro inserção:", insertErr);
    return;
  }

  console.log(`Pedido de teste inserido! ID: ${insertedOrder.id}`);

  // 3. Checar se o banco baixou o estoque automaticamente via Trigger SQL (SEM NENHUM UPDATE DO FRONTEND)
  const { data: prodAfter } = await supabase
    .from("smoking_products")
    .select("stock")
    .eq("id", testProd.id)
    .single();

  const stockAfterInsert = Number(prodAfter.stock);
  console.log(`Estoque APÓS Inserção no Supabase (Sem update no JS): ${stockAfterInsert}`);

  const isTriggerActive = stockAfterInsert === (initialStock - 1);
  console.log(`\n👉 Trigger SQL no Supabase está ATIVA? ${isTriggerActive ? '✅ SIM! (O banco baixou o estoque sozinho via Trigger SQL)' : '❌ NÃO (O banco NÃO baixou o estoque sozinho; a baixa é feita 100% pelo JavaScript do frontend)'}`);

  // 4. Deletar o pedido de teste
  await supabase.from("smoking_orders").delete().eq("id", insertedOrder.id);

  // 5. Se o estoque mudou na inserção, restaurar ao inicial
  if (isTriggerActive) {
    await supabase.from("smoking_products").update({ stock: initialStock }).eq("id", testProd.id);
  }
}

testStockTriggerWithValidStatus();
