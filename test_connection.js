// Debug Supabase connection
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://loepcagitrijlfksawfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MDU1NTgsImV4cCI6MjA2NTA4MTU1OH0.jFMchnyd3pSUmJRusi_3dNqOG_lR3sphsv3Knnefvpk';

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey.length);

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // Test connection by fetching something simple
  const { data, error } = await supabase
    .from('drivers')
    .select('id')
    .limit(1);
    
  console.log('Drivers query result:');
  console.log('Data:', data);
  console.log('Error:', error);
  
  if (error) {
    console.log('\nConnection issue:', error.message);
  }
}

test();
