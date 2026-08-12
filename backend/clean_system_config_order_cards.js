const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ocbgqflkhevrbvyjxzes.supabase.co/',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M'
);

async function cleanSystemConfigOrderCards() {
  console.log('Cleaning up system config order cards from Kanban...');

  // Deletar qualquer pedido cujo client_phone seja __SYSTEM_SMK_BEST_SELLERS__ ou comece com __SYSTEM_
  const { data, error } = await supabase
    .from('smoking_orders')
    .delete()
    .or('client_phone.eq.__SYSTEM_SMK_BEST_SELLERS__,client_phone.like.__SYSTEM_%');

  if (error) {
    console.error('❌ Error cleaning up:', error);
  } else {
    console.log('✅ System config orders cleaned up from smoking_orders table!');
  }
}

cleanSystemConfigOrderCards().catch(console.error);
