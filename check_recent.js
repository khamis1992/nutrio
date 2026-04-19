// Check if driver signup actually created something
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://loepcagitrijlfksawfm.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MDU1NTgsImV4cCI6MjA2NTA4MTU1OH0.jFMchnyd3pSUmJRusi_3dNqOG_lR3sphsv3Knnefvpk';

const supabase = createClient(supabaseUrl, anonKey);

async function check() {
  // Check profiles table for the new user
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Recent profiles:', profiles);
  
  // Check drivers table
  const { data: drivers } = await supabase
    .from('drivers')
    .select('user_id, full_name')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Recent drivers:', drivers);
  
  // Check user_roles table
  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Recent roles:', roles);
}

check();
