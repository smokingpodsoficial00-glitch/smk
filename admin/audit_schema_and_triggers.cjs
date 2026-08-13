const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSchemaAndTriggerAudit() {
  console.log("==========================================================================");
  console.log("🔍 AUDITORIA DE SCHEMA, COLUNAS E TRIGGERS DO SUPABASE");
  console.log("==========================================================================\n");

  // 1. Testar se a coluna `order_source` já existe em `smoking_orders`
  console.log("📌 1. Testando existência da coluna `order_source` em `smoking_orders`...");
  const { data: sampleOrder, error: colError } = await supabase
    .from("smoking_orders")
    .select("id, order_source, delivery_status, payment_status, shipping_address")
    .limit(1);

  if (colError) {
    console.log("  ❌ A coluna `order_source` AINDA NÃO EXISTE em `smoking_orders` (Mensagem:", colError.message, ")");
  } else {
    console.log("  ✅ A coluna `order_source` JÁ EXISTE em `smoking_orders`!");
    console.log("  Amostra:", sampleOrder);
  }

  // 2. Verificar pedidos existentes e seus campos
  console.log("\n📌 2. Auditando os 4 pedidos de clientes reais em `smoking_orders`...");
  const { data: orders, error: ordErr } = await supabase
    .from("smoking_orders")
    .select("*")
    .neq("delivery_status", "CANCELADO")
    .filter("client_phone", "not.like", "__SYSTEM_%");

  if (ordErr) {
    console.error("Erro orders:", ordErr);
    return;
  }

  console.log(`Encontrados ${orders.length} pedidos de clientes reais:\n`);

  let allCalculationsCorrect = true;

  orders.forEach((o, index) => {
    const items = Array.isArray(o.items) ? o.items : [];
    let itemsSubtotal = 0;
    const itemDetails = items.map(i => {
      const q = Number(i.quantity) || 1;
      const p = Number(i.price || i.unit_price) || 0;
      const sub = q * p;
      itemsSubtotal += sub;
      return `${q}x ${i.name || i.flavor} (R$ ${p.toFixed(2)}) = R$ ${sub.toFixed(2)}`;
    }).join(", ");

    const shippingFee = Number(o.shipping_fee) || 0;
    const totalAmountDb = Number(o.total_amount) || 0;
    const expectedTotal = parseFloat((itemsSubtotal + shippingFee).toFixed(2));
    const isMathCorrect = Math.abs(totalAmountDb - expectedTotal) < 0.01;

    if (!isMathCorrect) allCalculationsCorrect = false;

    console.log(`[PEDIDO #${index + 1}] Short ID: #${o.id.substring(0,8).toUpperCase()} | UUID: ${o.id}`);
    console.log(`  Cliente: ${o.client_name} (${o.client_phone})`);
    console.log(`  Endereço: "${o.shipping_address}"`);
    console.log(`  Itens: ${itemDetails}`);
    console.log(`  Subtotal dos Itens: R$ ${itemsSubtotal.toFixed(2)}`);
    console.log(`  Frete (shipping_fee): R$ ${shippingFee.toFixed(2)}`);
    console.log(`  Total Salvo (total_amount): R$ ${totalAmountDb.toFixed(2)}`);
    console.log(`  Total Calculado (Subtotal + Frete): R$ ${expectedTotal.toFixed(2)}`);
    console.log(`  Status da Matemática: ${isMathCorrect ? '✅ CORRETO' : '❌ INCONSISTENTE'}`);
    console.log(`  delivery_status Atual: "${o.delivery_status}"`);
    console.log(`  payment_status Atual: "${o.payment_status}"`);
    console.log(`--------------------------------------------------------------------------`);
  });

  console.log(`\n📌 Resultado Global da Matemática dos 4 Pedidos: ${allCalculationsCorrect ? '✅ 100% CORRETOS' : '❌ EXISTEM DIVERGÊNCIAS'}`);
}

runSchemaAndTriggerAudit();
