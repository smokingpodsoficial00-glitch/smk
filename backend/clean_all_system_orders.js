const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ocbgqflkhevrbvyjxzes.supabase.co/',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M'
);

async function cleanAllSystemOrders() {
  console.log('Cleaning all system config rows from smoking_orders table...');

  const { data, error } = await supabase
    .from('smoking_orders')
    .delete()
    .or('client_phone.eq.__SYSTEM_SMK_BEST_SELLERS__,client_phone.like.__SYSTEM_%');

  if (error) {
    console.error('❌ Error cleaning:', error);
  } else {
    console.log('✅ ALL system config orders deleted from smoking_orders table!');
  }

  // Verificar se sobrou algum
  const { data: remaining } = await supabase
    .from('smoking_orders')
    .select('id, client_name, client_phone')
    .or('client_phone.eq.__SYSTEM_SMK_BEST_SELLERS__,client_phone.like.__SYSTEM_%');

  console.log('Remaining system rows count:', remaining ? remaining.length : 0);
}

cleanAllSystemOrders().catch(console.error);
