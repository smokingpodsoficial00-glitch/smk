const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectTriggersAndSchema() {
  console.log("=== 1. VERIFICANDO PEDIDOS MANUAIS JÁ EXISTENTES EM SMOKING_ORDERS ===");

  const { data: orders, error } = await supabase
    .from("smoking_orders")
    .select("id, client_name, client_phone, shipping_address, delivery_status, payment_status, payment_method, total_amount, shipping_fee, created_at, items")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao consultar smoking_orders:", error);
    return;
  }

  console.log(`Total de pedidos na base: ${orders.length}`);

  const manualOrders = [];
  const whatsappOrders = [];

  orders.forEach(o => {
    const isManual = (o.shipping_address || '').includes('Balcão') || (o.shipping_address || '').includes('Balcao') || o.delivery_status === 'CONCLUIDO' || o.delivery_status === 'ENTREGUE';
    const entry = {
      shortId: o.id.substring(0, 8).toUpperCase(),
      clientName: o.client_name,
      phone: o.client_phone,
      address: o.shipping_address,
      delivery_status: o.delivery_status,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      total_amount: o.total_amount,
      shipping_fee: o.shipping_fee,
      itemsCount: Array.isArray(o.items) ? o.items.length : 0,
      createdAt: o.created_at
    };

    if (isManual) {
      manualOrders.push(entry);
    } else {
      whatsappOrders.push(entry);
    }
  });

  console.log("\n--- DETALHAMENTO DE TODOS OS PEDIDOS DO BANCO ---");
  orders.forEach((o, idx) => {
    console.log(`[#${idx + 1}] ID: #${o.id.substring(0, 8).toUpperCase()} | Cliente: ${o.client_name} | Tel: ${o.client_phone} | Endereço: "${o.shipping_address}" | Status Delivery: ${o.delivery_status} | Status Pag: ${o.payment_status} | Total: R$ ${o.total_amount}`);
  });
}

inspectTriggersAndSchema();
