// Check auth.users - this should work with anon key for some queries
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://loepcagitrijlfksawfm.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MDU1NTgsImV4cCI6MjA2NTA4MTU1OH0.jFMchnyd3pSUmJRusi_3dNqOG_lR3sphsv3Knnefvpk';

const supabase = createClient(supabaseUrl, anonKey);

async function checkAuth() {
  console.log('Checking auth.users with anon key...');
  
  // This won't work - auth.users requires service role key
  const { data, error } = await supabase
    .from('auth.users')
    .select('id, email')
    .limit(5);
    
  console.log('Result:', data);
  console.log('Error:', error?.message || error);
}

checkAuth();
