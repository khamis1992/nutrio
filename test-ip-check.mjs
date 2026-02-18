import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://loepcagitrijlfksawfm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXBjYWdpdHJpamxma3Nhd2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MDU1NTgsImV4cCI6MjA2NTA4MTU1OH0.jFMchnyd3pSUmJRusi_3dNqOG_lR3sphsv3Knnefvpk';

async function testIPCheck() {
  try {
    console.log('🚀 Testing IP check functionality...');
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, ANON_KEY);

    // Test the check-ip-location function
    console.log('📍 Checking IP location...');
    
    const response = await fetch('https://loepcagitrijlfksawfm.supabase.co/functions/v1/check-ip-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });

    if (!response.ok) {
      console.error('❌ IP check failed:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('✅ IP check response:', data);

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the function
testIPCheck();