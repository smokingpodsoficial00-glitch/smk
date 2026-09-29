import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zhlcuhvigfxedafqkwac.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpobGN1aHZpZ2Z4ZWRhZnFrd2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2ODQzNDgsImV4cCI6MjEwNTI2MDM0OH0.jI1a3dAbQS4oo3vTntCT59Qck8moZlGxsmyU175RN1A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
