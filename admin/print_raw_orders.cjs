const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function printCleanOrders() {
  const { data: orders, error } = await supabase
    .from('smoking_orders')
    .select('id, client_name, client_phone, shipping_address, items, total_amount, shipping_fee, delivery_status, payment_status, payment_method, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Erro:", error);
    return;
  }

  console.log(`TOTAL PEDIDOS ENCONTRADOS: ${orders.length}\n`);

  orders.forEach((o, index) => {
    const itemsSummary = (Array.isArray(o.items) ? o.items : []).map(i => `${i.quantity || 1}x ${i.name || i.flavor || 'Pod'} (R$ ${i.price || i.unit_price || 0})`).join(', ');
    console.log(`ORDER #${index + 1}: ID=${o.id.substring(0,8).toUpperCase()} | Client=${o.client_name} (${o.client_phone}) | Status=${o.delivery_status}`);
    console.log(`   Items: ${itemsSummary}`);
    console.log(`   Frete: R$ ${o.shipping_fee} | Total Salvo DB: R$ ${o.total_amount}`);
    console.log(`--------------------------------------------------------------------------------`);
  });
}

printCleanOrders();
