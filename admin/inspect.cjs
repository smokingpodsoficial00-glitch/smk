const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function printAuditDetails() {
  console.log("=================== AUDITORIA DO BANCO DE DADOS ===================");

  // 1. Pedido do Stanley / #FE0A3FCE
  const { data: orders } = await supabase
    .from('smoking_orders')
    .select('*')
    .or('client_name.ilike.%Stanley%,client_phone.ilike.%5511956179842%,id.ilike.%FE0A3FCE%');

  console.log("\n--- RECORD ORIGINAL EM `smoking_orders` ---");
  if (orders && orders.length > 0) {
    orders.forEach(o => {
      console.log(`ID Completo (PK UUID): ${o.id}`);
      console.log(`ID Curto no Painel: ${o.id.substring(0, 8).toUpperCase()}`);
      console.log(`Cliente: ${o.client_name} (${o.client_phone})`);
      console.log(`Endereço: ${o.shipping_address}`);
      console.log(`Itens (raw JSON):`, JSON.stringify(o.items, null, 2));
      console.log(`total_amount no banco: R$ ${o.total_amount}`);
      console.log(`shipping_fee no banco: R$ ${o.shipping_fee}`);
      console.log(`payment_method no banco: ${o.payment_method}`);
      console.log(`delivery_status: ${o.delivery_status}`);
      console.log(`receipt_url: ${o.receipt_url}`);
      console.log(`created_at: ${o.created_at}`);
    });
  } else {
    console.log("Nenhum pedido encontrado exatamente com esse filtro. Buscando últimos 10 pedidos...");
    const { data: recent } = await supabase
      .from('smoking_orders')
      .select('id, client_name, client_phone, items, total_amount, shipping_fee, payment_method, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    console.log("Últimos pedidos:", JSON.stringify(recent, null, 2));
  }

  // 2. Preço cadastrado do Pineapple Ice 50K em `smoking_products`
  console.log("\n--- PREÇO EM `smoking_products` PARA PINEAPPLE ICE / 50K ---");
  const { data: products } = await supabase
    .from('smoking_products')
    .select('*')
    .or('flavor.ilike.%Pineapple%,name.ilike.%50K%');

  if (products && products.length > 0) {
    products.forEach(p => {
      console.log(`Produto ID: ${p.id} | Marca: ${p.brand} | Modelo: ${p.name} | Sabor: ${p.flavor}`);
      console.log(`Price no banco: R$ ${p.price} | Cost Price: R$ ${p.cost_price} | Stock: ${p.stock}`);
    });
  }
}

printAuditDetails();
