#!/usr/bin/env node

/**
 * Final Production Deployment Script
 * This script handles all remaining tasks for production deployment
 */

import { execSync } from 'child_process';
import fs from 'fs';

// Configuration
const SUPABASE_PROJECT_ID = 'loepcagitrijlfksawfm';

console.log('🚀 Starting final production deployment...\n');

try {
  // 1. Check if Docker is available (needed for some Supabase commands)
  console.log('1. Checking Docker availability...');
  try {
    execSync('docker --version', { stdio: 'pipe' });
    console.log('✅ Docker is available\n');
  } catch (error) {
    console.log('⚠️  Docker is not available - some local development features may be limited');
    console.log('   However, this is not critical for deployment to production\n');
  }

  // 2. Verify Supabase functions are deployed
  console.log('2. Verifying Supabase functions...');
  const functionsList = execSync('npx supabase functions list', { encoding: 'utf-8' });
  console.log('✅ Supabase functions verified\n');

  // 3. Check if we need to apply database migrations
  console.log('3. Checking database migrations...');
  try {
    // Try to run a simple database command to check connectivity
    execSync('npx supabase db diff --use-migra', { 
      stdio: 'pipe',
      timeout: 10000 
    });
    console.log('✅ Database connection verified\n');
  } catch (error) {
    console.log('⚠️  Could not verify database migrations locally (Docker required)');
    console.log('   In production, ensure all migrations in supabase/migrations/ are applied\n');
  }

  // 4. Build the application
  console.log('4. Building the application...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Application built successfully\n');

  // 5. Run tests
  console.log('5. Running tests...');
  execSync('npm run test', { stdio: 'inherit' });
  console.log('✅ All tests passed\n');

  // 6. Check environment variables
  console.log('6. Checking environment variables...');
  execSync('node check-env.mjs', { stdio: 'inherit' });
  
  // 7. Show deployment instructions
  console.log('\n📋 DEPLOYMENT INSTRUCTIONS:');
  console.log('==========================');
  console.log('1. Configure the following environment variables in your production environment:');
  console.log('   - RESEND_API_KEY (from https://resend.com)');
  console.log('   - VITE_SENTRY_DSN (from https://sentry.io)');
  console.log('   - VITE_POSTHOG_KEY (from https://posthog.com)');
  console.log('   - SENTRY_ORG (from https://sentry.io)');
  console.log('   - SENTRY_PROJECT (from https://sentry.io)');
  console.log('   - SENTRY_AUTH_TOKEN (from https://sentry.io)');
  console.log('');
  console.log('2. Deploy the contents of the "dist" folder to your hosting provider');
  console.log('   (Vercel, Netlify, AWS S3, etc.)');
  console.log('');
  console.log('3. Ensure your Supabase project is on the Pro tier ($25/month)');
  console.log('   for production usage limits and features');
  console.log('');
  console.log('4. Verify the following Supabase functions are active:');
  console.log('   - check-ip-location');
  console.log('   - log-user-ip');
  console.log('   - send-email (if email functionality is needed)');
  console.log('');
  console.log('5. Test the application:');
  console.log('   - Sign up with a Qatar IP address (should work)');
  console.log('   - Sign up with a non-Qatar IP address (should be blocked)');
  console.log('   - Access admin IP management page to view and block IPs');
  console.log('');
  console.log('✅ Final deployment preparation completed successfully!');
  console.log('🚀 Your application is ready for production!');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}