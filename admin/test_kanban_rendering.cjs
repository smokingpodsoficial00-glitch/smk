const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function formatBRL(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// Simulador idêntico ao KanbanBoard.tsx atualizado
function mapKanbanOrder(o) {
  return {
    id: o.id.substring(0, 8).toUpperCase(),
    clientName: o.client_name || 'Cliente Sem Nome',
    phone: o.client_phone,
    address: o.shipping_address,
    items: Array.isArray(o.items) ? o.items.map((i) => ({
      model: i.name || i.model || '',
      flavor: i.flavor || '',
      quantity: i.quantity || 1,
      price: i.price ? parseFloat(i.price) : (i.unit_price ? parseFloat(i.unit_price) : 0)
    })) : [],
    totalAmount: parseFloat(o.total_amount || 0),
    shippingFee: parseFloat(o.shipping_fee || 0),
    paymentMethod: o.payment_method,
    status: o.delivery_status
  };
}

async function verifyKanbanDisplay() {
  const { data: rawOrders } = await supabase
    .from('smoking_orders')
    .select('*')
    .filter('client_phone', 'not.like', '__SYSTEM_%')
    .order('created_at', { ascending: false });

  console.log("==========================================================================");
  console.log("🖥️ VALIDAÇÃO DE EXIBIÇÃO EM TEMPO REAL DO KANBAN BOARD (PÓS-CORREÇÃO)");
  console.log("==========================================================================\n");

  rawOrders.forEach(raw => {
    const card = mapKanbanOrder(raw);
    const subtotal = card.items.reduce((sum, i) => sum + (i.quantity * i.price), 0);

    console.log(`📌 PEDIDO #${card.id} - ${card.clientName}`);
    console.log(`   Itens:`);
    card.items.forEach(i => {
      const itemSub = i.quantity * i.price;
      console.log(`     - ${i.quantity}x ${i.flavor} (${i.model}): ${formatBRL(itemSub)} (${formatBRL(i.price)} cada)`);
    });
    console.log(`   Subtotal dos Itens: ${formatBRL(subtotal)}`);
    console.log(`   Taxa de Entrega:    ${formatBRL(card.shippingFee)}`);
    console.log(`   ---------------------------------------------`);
    console.log(`   TOTAL EXIBIDO NO PAINEL: ${formatBRL(card.totalAmount)} (${card.paymentMethod})`);

    const isMathValid = Math.abs(card.totalAmount - (subtotal + card.shippingFee)) < 0.01;
    console.log(`   Validação Matemática: ${isMathValid ? '✅ PERFEITA' : '❌ ERRO'}`);
    console.log("==========================================================================\n");
  });
}

verifyKanbanDisplay();
