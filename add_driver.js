// Script to add driver@nutriofuel.com to the drivers table
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://loepcagitrijlfksawfm.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsImtpZCI6ImNsWWdvbUc3L1UyZ0pxN2MiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2xvZXBjYWdpdHJpamxma3Nhd2ZtLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlNmEwYjVjYy1jOTNlLTQ2YjAtOTFmYy0xYzA0YzA2ZGVlMTMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzczOTgzNzc5LCJpYXQiOjE3NzM5ODAxNzksImVtYWlsIjoia2hhbWlzLTE5OTJAaG90bWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoia2hhbWlzLTE5OTJAaG90bWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiJlNmEwYjVjYy1jOTNlLTQ2YjAtOTFmYy0xYzA0YzA2ZGVlMTMifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3Mzk4MDE3OX1dLCJzZXNzaW9uX2lkIjoiMjBjOWQwYTAtNzBjOS00NmRlLWI1MjQtNDNhNzI5ZDMyYTUyIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.9mkQUSYIo82Oqya3c9fro6Nht_ThxmREBHoltVRlpf4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addDriver() {
  console.log('Looking for driver@nutriofuel.com...');
  
  // First find the user
  const { data: user, error: userError } = await supabase
    .from('auth.users')
    .select('id, email')
    .eq('email', 'driver@nutriofuel.com')
    .single();
  
  if (userError) {
    console.error('Error finding user:', userError);
    return;
  }
  
  if (!user) {
    console.error('User driver@nutriofuel.com not found');
    return;
  }
  
  console.log('Found user:', user.id, user.email);
  
  // Check if already a driver
  const { data: existingDriver, error: checkError } = await supabase
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  if (existingDriver) {
    console.log('User is already a driver with ID:', existingDriver.id);
    return;
  }
  
  // Insert driver record
  const { data: newDriver, error: insertError } = await supabase
    .from('drivers')
    .insert({
      user_id: user.id,
      approval_status: 'approved',
      is_online: false,
      is_active: true,
      name: 'Test Driver',
      phone: '+97400000000',
      vehicle_type: 'car',
      vehicle_plate: 'XXX-0000'
    })
    .select()
    .single();
  
  if (insertError) {
    console.error('Error creating driver:', insertError);
    return;
  }
  
  console.log('Successfully added driver:', newDriver);
}

addDriver();
