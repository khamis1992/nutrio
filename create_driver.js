// Script to create driver@nutriofuel.com and register them as a driver
// This uses signUp to create the auth user first

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://loepcagitrijlfksawfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsImtpZCI6ImNsWWdvbUc3L1UyZ0pxN2MiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2xvZXBjYWdpdHJpamxma3Nhd2ZtLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlNmEwYjVjYy1jOTNlLTQ2YjAtOTFmYy0xYzA0YzA2ZGVlMTMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzczOTgzNzc5LCJpYXQiOjE3NzM5ODAxNzksImVtYWlsIjoia2hhbWlzLTE5OTJAaG90bWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoia2hhbWlzLTE5OTJAaG90bWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiJlNmEwYjVjYy1jOTNlLTQ2YjAtOTFmYy0xYzA0YzA2ZGVlMTMifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3Mzk4MDE3OX1dLCJzZXNzaW9uX2lkIjoiMjBjOWQwYTAtNzBjOS00NmRlLWI1MjQtNDNhNzI5ZDMyYTUyIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.9mkQUSYIo82Oqya3c9fro6Nht_ThxmREBHoltVRlpf4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createDriverAccount() {
  console.log('Creating driver@nutriofuel.com...');

  // Sign up the driver
  const { data, error } = await supabase.auth.signUp({
    email: 'driver@nutriofuel.com',
    password: '123456789',
    options: {
      data: {
        full_name: 'Test Driver',
      }
    }
  });

  if (error) {
    console.error('Error creating user:', error.message);
    return;
  }

  console.log('User created:', data.user?.id);

  if (!data.user) {
    console.log('User may already exist or email needs confirmation');
    
    // Try to get existing user
    const { data: existingUser } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', 'driver@nutriofuel.com')
      .single();
    
    if (existingUser) {
      console.log('Found existing user:', existingUser.id);
    }
    return;
  }

  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: data.user.id,
      full_name: 'Test Driver',
    });

  if (profileError) {
    console.log('Profile creation note:', profileError.message);
  } else {
    console.log('Profile created');
  }

  // Create driver record
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .insert({
      user_id: data.user.id,
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

  if (driverError) {
    console.error('Driver creation error:', driverError.message);
    return;
  }

  console.log('Driver created:', driver);

  // Add driver role
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({
      user_id: data.user.id,
      role: 'driver'
    });

  if (roleError) {
    console.log('Role creation note:', roleError.message);
  } else {
    console.log('Driver role added');
  }

  console.log('\nDriver account ready:');
  console.log('  Email: driver@nutriofuel.com');
  console.log('  Password: 123456789');
}

createDriverAccount();
