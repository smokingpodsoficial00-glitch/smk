const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectItemJson() {
  const { data: rawOrders } = await supabase
    .from("smoking_orders")
    .select("*")
    .neq("delivery_status", "CANCELADO");

  const validOrders = (rawOrders || []).filter(
    (o) =>
      o.client_phone !== "__SYSTEM_SMK_BEST_SELLERS__" &&
      (!o.client_phone || !o.client_phone.startsWith("__SYSTEM_")) &&
      (!o.client_name || !o.client_name.toLowerCase().includes("system config"))
  );

  validOrders.forEach((o) => {
    console.log(`\n============================================================`);
    console.log(`PEDIDO #${o.id.substring(0,8).toUpperCase()} (${o.client_name})`);
    console.log(`raw items JSON:`, JSON.stringify(o.items, null, 2));
  });
}

inspectItemJson();
