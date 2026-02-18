const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://loepcagitrijlfksawfm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUwNTU1OCwiZXhwIjoyMDY1MDgxNTU4fQ.Aj8np5SmmjzGjxNA9KkeYQ2iCG35deP49gUoSrSeHEA';
const USER_EMAIL = 'khamis-1992@hotmail.com';
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
    console.log('🎉 User can now log in with the new password.');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the function
changeUserPassword();