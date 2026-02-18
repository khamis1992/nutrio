#!/usr/bin/env node

// Production Deployment Script
// Run this script to deploy your app to production

import fs from 'fs';
import path from 'path';

console.log('🚀 Starting Production Deployment...\n');

// Step 1: Check environment variables
console.log('1. Checking environment variables...');
const envPath = path.join(import.meta.dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const criticalVars = [
  'RESEND_API_KEY',
  'VITE_SENTRY_DSN', 
  'VITE_POSTHOG_KEY',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN'
];

let hasEmptyValues = false;
criticalVars.forEach(varName => {
  const regex = new RegExp(`${varName}=""`);
  if (regex.test(envContent)) {
    hasEmptyValues = true;
  }
});

if (hasEmptyValues) {
  console.log('❌ CRITICAL: Environment variables are not configured!');
  console.log('Please configure your .env file before deployment.\n');
  process.exit(1);
}

console.log('✅ Environment variables configured\n');

// Step 2: Run tests
console.log('2. Running tests...');
const { spawn } = await import('child_process');
const test = spawn('npm', ['run', 'test:run']);

test.stdout.on('data', (data) => {
  console.log(data.toString());
});

test.stderr.on('data', (data) => {
  console.error(data.toString());
});

test.on('close', (code) => {
  if (code !== 0) {
    console.log('❌ Tests failed! Fix tests before deployment.');
    process.exit(1);
  }
  
  console.log('✅ Tests passed\n');
  
  // Step 3: Build application
  console.log('3. Building application...');
  const build = spawn('npm', ['run', 'build']);
  
  build.stdout.on('data', (data) => {
    console.log(data.toString());
  });
  
  build.stderr.on('data', (data) => {
    console.error(data.toString());
  });
  
  build.on('close', (code) => {
    if (code !== 0) {
      console.log('❌ Build failed! Fix build issues before deployment.');
      process.exit(1);
    }
    
    console.log('✅ Build successful\n');
    console.log('🎉 Production deployment ready!');
    console.log('\nNext steps:');
    console.log('1. Run: supabase db push');
    console.log('2. Run: supabase functions deploy send-email');
    console.log('3. Upgrade Supabase to Pro tier');
    console.log('4. Deploy to Vercel');
    process.exit(0);
  });
});
