import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://loepcagitrijlfksawfm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUwNTU1OCwiZXhwIjoyMDY1MDgxNTU4fQ.Aj8np5SmmjzGjxNA9KkeYQ2iCG35deP49gUoSrSeHEA';

async function createMissingTables() {
  try {
    console.log('🔧 Creating missing tables...');
    
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Try to create a simple test record to see if the user_roles table exists
    console.log('🔧 Checking if user_roles table exists...');
    
    const { error: testError } = await supabase
      .from('user_roles')
      .insert({ user_id: '00000000-0000-0000-0000-000000000000', role: 'test' });

    if (testError) {
      if (testError.message && testError.message.includes('relation "public.user_roles" does not exist')) {
        console.log('❌ The user_roles table does not exist. Please run the following SQL in your Supabase SQL editor:');
        console.log('');
        console.log('-- Create app_role enum:');
        console.log("CREATE TYPE public.app_role AS ENUM ('user', 'partner', 'admin');");
        console.log('');
        console.log('-- Create user_roles table:');
        console.log(`
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
        `);
        console.log('');
        console.log('-- Create profiles table:');
        console.log(`
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  gender TEXT,
  age INTEGER CHECK (age >= 13 AND age <= 120),
  height_cm NUMERIC(5,2) CHECK (height_cm > 0 AND height_cm < 300),
  current_weight_kg NUMERIC(5,2) CHECK (current_weight_kg > 0 AND current_weight_kg < 500),
  target_weight_kg NUMERIC(5,2) CHECK (target_weight_kg > 0 AND target_weight_kg < 500),
  health_goal TEXT,
  activity_level TEXT,
  daily_calorie_target INTEGER,
  protein_target_g INTEGER,
  carbs_target_g INTEGER,
  fat_target_g INTEGER,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        `);
        console.log('');
        console.log('After running these commands, please run the admin role assignment script again.');
        return;
      } else {
        console.log('⚠️  user_roles table exists but has an issue:', testError.message);
      }
    } else {
      console.log('✅ user_roles table exists and is accessible');
      // Clean up test record
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', '00000000-0000-0000-0000-000000000000');
    }

    console.log('✅ Tables check completed');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the function
createMissingTables();