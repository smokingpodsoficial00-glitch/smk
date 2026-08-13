const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMigration() {
  console.log("Checking if order_source or delivery_status update is possible...");

  // Try updating order_source on a record to check if Postgres has order_source column or if error occurs
  const { data, error } = await supabase
    .from("smoking_orders")
    .update({ order_source: "MANUAL" })
    .eq("id", "fe0a3fce-fbeb-46b7-ad09-8a93c315f8a2")
    .select();

  console.log("Result order_source update:", data, error?.message);
}

testMigration();
