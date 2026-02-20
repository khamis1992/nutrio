import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://loepcagitrijlfksawfm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUwNTU1OCwiZXhwIjoyMDY1MDgxNTU4fQ.Aj8np5SmmjzGjxNA9KkeYQ2iCG35deP49gUoSrSeHEA';
const USER_EMAIL = 'admin@nutrio.com';

async function setupAdminRole() {
  try {
    console.log('🚀 Setting up admin role...');
    
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

    // Create the user_roles table if it doesn't exist
    console.log('🔧 Creating user_roles table if it does not exist...');
    
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.user_roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          UNIQUE (user_id, role)
        );
        
        ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
      `
    });

    if (tableError) {
      console.log('⚠️  Could not create user_roles table:', tableError.message);
    } else {
      console.log('✅ user_roles table created or already exists');
    }

    // Create the app_role enum if it doesn't exist
    console.log('🔧 Creating app_role enum if it does not exist...');
    
    const { error: enumError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
            CREATE TYPE public.app_role AS ENUM ('user', 'partner', 'admin');
          END IF;
        END
        $$;
      `
    });

    if (enumError) {
      console.log('⚠️  Could not create app_role enum:', enumError.message);
    } else {
      console.log('✅ app_role enum created or already exists');
    }

    // Update the user_roles table to use the enum
    console.log('🔧 Updating user_roles table to use app_role enum...');
    
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.user_roles 
        ALTER COLUMN role TYPE public.app_role 
        USING role::public.app_role;
      `
    });

    if (alterError) {
      console.log('⚠️  Could not update user_roles table:', alterError.message);
    } else {
      console.log('✅ user_roles table updated to use app_role enum');
    }

    // Assign admin role to user
    console.log('👑 Assigning admin role to user...');
    
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id,role' });

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
setupAdminRole();