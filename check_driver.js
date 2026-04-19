// Check driver user and try to link
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://loepcagitrijlfksawfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsImtpZCI6ImNsWWdvbUc3L1UyZ0pxN2MiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2xvZXBjYWdpdHJpamxma3Nhd2ZtLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlNmEwYjVjYy1jOTNlLTQ2YjAtOTFmYy0xYzA0YzA2ZGVlMTMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzczOTgzNzc5LCJpYXQiOjE3NzM5ODAxNzksImVtYWlsIjoia2hhbWlzLTE5OTJAaG90bWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoia2hhbWlzLTE5OTJAaG90bWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiJlNmEwYjVjYy1jOTNlLTQ2YjAtOTFmYy0xYzA0YzA2ZGVlMTMifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWExIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3Mzk4MDE3OX1dLCJzZXNzaW9uX2lkIjoiMjBjOWQwYTAtNzBjOS00NmRlLWI1MjQtNDNhNzI5ZDMyYTUyIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.9mkQUSYIo82Oqya3c9fro6Nht_ThxmREBHoltVRlpf4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndLinkDriver() {
  console.log('Checking for driver@nutriofuel.com...');
  
  // Try to sign in to check if user exists (won't create session)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'driver@nutriofuel.com',
    password: '123456789'
  });
  
  if (error) {
    console.log('Sign in failed:', error.message);
    console.log('\nDriver account needs to be created manually:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to Authentication > Users');
    console.log('4. Click "Add User" > "Create user"');
    console.log('5. Enter: driver@nutriofuel.com / 123456789');
    console.log('6. Email confirm: OFF (for testing)');
    console.log('\nOR use the app:');
    console.log('1. Go to http://localhost:4173/driver/auth');
    console.log('2. Register as a new driver');
    return;
  }
  
  console.log('User found:', data.user?.id);
  
  // Check if driver record exists
  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', data.user?.id)
    .single();
    
  if (driver) {
    console.log('Driver record exists:', driver.id);
  } else {
    console.log('No driver record - needs to be linked');
  }
}

checkAndLinkDriver();
