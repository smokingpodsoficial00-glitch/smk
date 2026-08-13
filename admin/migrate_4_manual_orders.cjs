const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrate4ManualOrders() {
  console.log("=== MIGRANDO OS 4 PEDIDOS MANUAIS EXISTENTES NO SUPABASE ===");

  const manualOrderIds = [
    "fe0a3fce-fbeb-46b7-ad09-8a93c315f8a2", // Stanley
    "9b81b0af-6146-457b-9bc3-9409ddc75834", // Bia Akira 1
    "94921f15-30ee-405e-98c0-7bf809138d1f", // Bia Akira 2
    "acd0c638-43e4-4d84-b027-8f963c21a0ab"  // Samuel
  ];

  for (const id of manualOrderIds) {
    // 1. Ler os valores antes da alteração
    const { data: beforeOrder } = await supabase
      .from("smoking_orders")
      .select("id, client_name, total_amount, shipping_fee, delivery_status, payment_status")
      .eq("id", id)
      .single();

    console.log(`\n📌 Pedido #${id.substring(0,8).toUpperCase()} (${beforeOrder.client_name}):`);
    console.log(`   Status Antes: delivery_status="${beforeOrder.delivery_status}"`);
    console.log(`   Valores: total_amount=R$ ${beforeOrder.total_amount} | shipping_fee=R$ ${beforeOrder.shipping_fee}`);

    // Tentar atualizar delivery_status para CONCLUIDO
    const updatePayload = {
      delivery_status: "CONCLUIDO"
    };

    const { data: updated, error: err } = await supabase
      .from("smoking_orders")
      .update(updatePayload)
      .eq("id", id)
      .select();

    if (err) {
      console.log(`   ❌ Erro ao atualizar delivery_status: ${err.message}`);
    } else {
      console.log(`   ✅ Sucesso! Novo status: delivery_status="CONCLUIDO"`);
    }
  }
}

migrate4ManualOrders();
