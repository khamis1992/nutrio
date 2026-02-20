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

// Only check for critical variables that are absolutely required
const criticalVars = [
  'RESEND_API_KEY'
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

// Warn about optional variables
const optionalVars = [
  'VITE_SENTRY_DSN', 
  'VITE_POSTHOG_KEY',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN'
];

let hasEmptyOptionalVars = false;
optionalVars.forEach(varName => {
  const regex = new RegExp(`${varName}=""`);
  if (regex.test(envContent)) {
    hasEmptyOptionalVars = true;
  }
});

if (hasEmptyOptionalVars) {
  console.log('⚠️  WARNING: Optional environment variables (Sentry, PostHog) are not configured.');
  console.log('The app will work but without error tracking and analytics.\n');
}

console.log('✅ Environment variables configured\n');

// Step 2: Run tests
console.log('2. Running tests...');
try {
  const { execSync } = await import('child_process');
  const output = execSync('npm run test:run', { encoding: 'utf8' });
  console.log(output);
  console.log('✅ Tests passed\n');
} catch (error) {
  console.log('❌ Tests failed! Fix tests before deployment.');
  console.log('Error:', error.message);
  process.exit(1);
}

// Step 3: Build application
console.log('3. Building application...');
try {
  const { execSync } = await import('child_process');
  const output = execSync('npm run build', { encoding: 'utf8' });
  console.log(output);
  console.log('✅ Build successful\n');
  console.log('🎉 Production deployment ready!');
  console.log('\nNext steps:');
  console.log('1. Run: supabase db push');
  console.log('2. Run: supabase functions deploy send-email');
  console.log('3. Upgrade Supabase to Pro tier');
  console.log('4. Deploy to Vercel');
  process.exit(0);
} catch (error) {
  console.log('❌ Build failed! Fix build issues before deployment.');
  console.log('Error:', error.message);
  process.exit(1);
}
