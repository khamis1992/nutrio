#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the current .env file
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Check for empty critical values
const criticalVars = [
  'RESEND_API_KEY',
  'VITE_SENTRY_DSN',
  'VITE_POSTHOG_KEY',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN'
];

let hasEmptyValues = false;
const missingValues = [];

criticalVars.forEach(varName => {
  const regex = new RegExp(`${varName}=""`);
  if (regex.test(envContent)) {
    hasEmptyValues = true;
    missingValues.push(varName);
  }
});

if (hasEmptyValues) {
  console.log('❌ CRITICAL: Missing environment variables detected!');
  console.log('The following variables are empty and must be configured for production:');
  console.log();
  missingValues.forEach(varName => {
    console.log(`  - ${varName}`);
  });
  console.log();
  console.log('📝 Please follow these steps:');
  console.log('1. Create accounts at:');
  console.log('   - https://resend.com (for email)');
  console.log('   - https://sentry.io (for error tracking)');
  console.log('   - https://posthog.com (for analytics)');
  console.log('2. Copy your API keys into the .env file');
  console.log('3. Run this script again to verify');
  console.log();
  console.log('💡 Template file created: .env.production.template');
  process.exit(1);
} else {
  console.log('✅ All critical environment variables are configured!');
  console.log('✅ Ready for production deployment!');
  process.exit(0);
}
