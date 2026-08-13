const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCheckConstraints() {
  console.log("=== AUDITANDO CHECK CONSTRAINT DE DELIVERY_STATUS EM SMOKING_ORDERS ===");

  const statusesToTest = ['AGUARDANDO_PAGAMENTO', 'PREPARANDO', 'EM_ROTA', 'ENTREGUE', 'CONCLUIDO', 'CONCLUÍDO', 'CANCELADO', 'FINALIZADO'];

  for (const st of statusesToTest) {
    const testPayload = {
      client_name: "__TEST_CHECK__",
      client_phone: "__TEST__",
      shipping_address: "Teste",
      items: [{ quantity: 1, price: 10 }],
      total_amount: 10,
      shipping_fee: 0,
      payment_status: "PAGO",
      delivery_status: st,
      payment_method: "PIX"
    };

    const { data, error } = await supabase.from("smoking_orders").insert(testPayload).select().single();
    if (error) {
      console.log(`Status "${st}": ❌ REJEITADO PELO BANCO (${error.message})`);
    } else {
      console.log(`Status "${st}": ✅ ACEITO PELO BANCO! (ID: ${data.id})`);
      // Deletar a linha de teste
      await supabase.from("smoking_orders").delete().eq("id", data.id);
    }
  }
}

testCheckConstraints();
