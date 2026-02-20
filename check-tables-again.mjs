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

    // Try to get table information from Supabase
    console.log('🔍 Getting table information...');
    
    // This is a workaround to check if tables exist
    const tableNames = ['user_roles', 'profiles', 'blocked_ips', 'user_ip_logs'];
    
    for (const tableName of tableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
          
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: Table exists and is accessible`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the function
checkTables();