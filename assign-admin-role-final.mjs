import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://loepcagitrijlfksawfm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUwNTU1OCwiZXhwIjoyMDY1MDgxNTU4fQ.Aj8np5SmmjzGjxNA9KkeYQ2iCG35deP49gUoSrSeHEA';
const USER_EMAIL = 'admin@nutrio.com';

async function assignAdminRole() {
  try {
    console.log('👑 Assigning admin role to user...');
    
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Find user by email
    console.log(`🔍 Searching for user with email: ${USER_EMAIL}`);
    
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', USER_EMAIL)
      .single();

    if (fetchError) {
      console.error('❌ Error finding user:', fetchError.message);
      return;
    }

    if (!user) {
      console.error('❌ User not found with email:', USER_EMAIL);
      return;
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);

    // Assign admin role
    console.log('🔧 Assigning admin role...');
    
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: 'admin' });

    if (roleError) {
      console.error('❌ Error assigning admin role:', roleError.message);
      return;
    }

    console.log('✅ Admin role assigned successfully!');
    console.log('🎉 User is now an admin and can access admin features.');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the function
assignAdminRole();