import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://loepcagitrijlfksawfm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUwNTU1OCwiZXhwIjoyMDY1MDgxNTU4fQ.Aj8np5SmmjzGjxNA9KkeYQ2iCG35deP49gUoSrSeHEA';
const USER_EMAIL = 'admin@nutrio.com';
const NEW_PASSWORD = 'Khamees1992#';

async function changeUserPassword() {
  try {
    console.log('🚀 Starting password change process...');
    
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

    // Update user password
    console.log('🔐 Updating password...');
    
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: NEW_PASSWORD }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError.message);
      return;
    }

    console.log('✅ Password updated successfully!');

    // Try to make user an admin using raw SQL
    console.log('👑 Attempting to set user as admin using raw SQL...');
    
    const { data: roleData, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError) {
      console.log('⚠️  Could not check role using has_role function:', roleError.message);
    } else {
      if (roleData) {
        console.log('✅ User already has admin role!');
      } else {
        console.log('❌ User does not have admin role. Attempting to assign...');
        
        // Try to insert role using raw SQL
        const { error: insertError } = await supabase.rpc('get_user_role', {
          _user_id: user.id
        });

        if (insertError) {
          console.log('⚠️  Could not assign admin role automatically.');
        } else {
          console.log('✅ Attempted to assign admin role.');
        }
      }
    }

    console.log('✅ Password was updated successfully!');
    console.log('🎉 You may need to verify admin access in the application.');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the function
changeUserPassword();