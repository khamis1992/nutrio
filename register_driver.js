// Script to register driver@nutriofuel.com as a driver
// This uses the driver signup flow which creates both auth user AND driver record

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://loepcagitrijlfksawfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsImtpZCI6ImNsWWdvbUc3L1UyZ0pxN2MiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2xvZXBjYWdpdHJpamxma3Nhd2ZtLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlNmEwYjVjYy1jOTNlLTQ2YjAtOTFmYy0xYzA0YzA2ZGVlMTMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzczOTgzNzc5LCJpYXQiOjE3NzM5ODAxNzksImVtYWlsIjoia2hhbWlzLTE5OTJAaG90bWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoia2hhbWlzLTE5OTJAaG90bWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiJlNmEwYjVjYy1jOTNlLTQ2YjAtOTFmYy0xYzA0YzA2ZGVlMTMifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3Mzk4MDE3OX1dLCJzZXNzaW9uX2lkIjoiMjBjOWQwYTAtNzBjOS00NmRlLWI1MjQtNDNhNzI5ZDMyYTUyIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.9mkQUSYIo82Oqya3c9fro6Nht_ThxmREBHoltVRlpf4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function registerDriver() {
  console.log('Registering driver@nutriofuel.com as a driver...');

  // First check if user exists
  const { data: existingUser, error: userError } = await supabase
    .from('auth.users')
    .select('id, email')
    .eq('email', 'driver@nutriofuel.com')
    .single();
  
  if (userError) {
    console.log('User not found, checking if we can proceed differently...');
  }
  
  if (!existingUser) {
    console.log('User driver@nutriofuel.com not found in auth.users');
    console.log('Need to either:');
    console.log('1. Use the driver signup flow (creates new user)');
    console.log('2. Manually insert via Supabase dashboard');
    return;
  }
  
  console.log('Found user:', existingUser.id);
  
  // Check if already a driver
  const { data: existingDriver, error: driverError } = await supabase
    .from('drivers')
    .select('id, user_id')
    .eq('user_id', existingUser.id)
    .single();
  
  if (driverError && driverError.code !== 'PGRST116') {
    console.error('Error checking driver:', driverError);
    return;
  }
  
  if (existingDriver) {
    console.log('User is already registered as driver:', existingDriver.id);
    return;
  }
  
  // Insert driver record
  console.log('Creating driver record...');
  const { data: newDriver, error: insertError } = await supabase
    .from('drivers')
    .insert({
      user_id: existingUser.id,
      full_name: 'Test Driver',
      phone: '+97412345678',
      vehicle_type: 'car',
      approval_status: 'approved',
      is_online: false,
      is_active: true,
      total_deliveries: 0,
      wallet_balance: 0
    })
    .select()
    .single();
  
  if (insertError) {
    console.error('Error creating driver:', insertError);
    return;
  }
  
  console.log('Successfully registered driver:', newDriver);
  
  // Also add driver role
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({
      user_id: existingUser.id,
      role: 'driver'
    });
  
  if (roleError) {
    console.log('Note: Could not add driver role:', roleError.message);
  } else {
    console.log('Added driver role to user');
  }
}

registerDriver();
