import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://loepcagitrijlfksawfm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MDU1NTgsImV4cCI6MjA2NTA4MTU1OH0.jFMchnyd3pSUmJRusi_3dNqOG_lR3sphsv3Knnefvpk';
const TEST_EMAIL = 'khamis-1992@hotmail.com';
const TEST_PASSWORD = 'Khamees1992#';

async function testLogin() {
  try {
    console.log('🚀 Testing login process...');
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, ANON_KEY);

    // Attempt to sign in
    console.log(`🔐 Attempting to sign in as: ${TEST_EMAIL}`);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (error) {
      console.error('❌ Login failed:', error.message);
      return;
    }

    console.log('✅ Login successful!');
    console.log('User ID:', data.user.id);
    console.log('User email:', data.user.email);

    // Sign out
    await supabase.auth.signOut();
    console.log('👋 Signed out successfully');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the function
testLogin();