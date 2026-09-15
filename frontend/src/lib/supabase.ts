import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hzzzuzrcaesvdfsdhdfx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6enp1enJjYWVzdmRmc2RoZGZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzUyMTcsImV4cCI6MjEwNDExMTIxN30.W_UOTQNTASaPzXJAowDloEp5zyg_djxlVaiEdxbJW7s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
