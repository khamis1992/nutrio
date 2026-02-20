import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://loepcagitrijlfksawfm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUwNTU1OCwiZXhwIjoyMDY1MDgxNTU4fQ.Aj8np5SmmjzGjxNA9KkeYQ2iCG35deP49gUoSrSeHEA';

async function checkTables() {
  try {
    console.log('🔍 Checking database tables...');
    
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Try to query the user_roles table
    console.log('🔍 Checking if user_roles table exists...');
    
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .limit(1);

    if (rolesError) {
      console.log('❌ user_roles table does not exist or is inaccessible:', rolesError.message);
    } else {
      console.log('✅ user_roles table exists');
    }

    // Try to query the profiles table
    console.log('🔍 Checking if profiles table exists...');
    
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (profilesError) {
      console.log('❌ profiles table does not exist or is inaccessible:', profilesError.message);
    } else {
      console.log('✅ profiles table exists');
    }

    // Try to query a simple auth.users table
    console.log('🔍 Checking if auth.users table is accessible...');
    
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (usersError) {
      console.log('❌ auth.users table is not accessible:', usersError.message);
    } else {
      console.log('✅ auth.users table is accessible');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the function
checkTables();