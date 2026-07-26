const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Variáveis de ambiente do Supabase não configuradas no backend.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
