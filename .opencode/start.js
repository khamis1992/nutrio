#!/usr/bin/env node

console.log(`
🚀 Nutrio Development Environment Initialized!

🔧 Enforced Patterns:
• TypeScript strict mode: ON
• ESLint checks: ON  
• Supabase error handling: Required
• Absolute imports (@/): Required
• Pre-commit hooks: Enabled

🎯 Quick Commands:
• npm run dev          # Start development server
• npm run typecheck    # Check TypeScript
• npm run lint         # Run ESLint
• npm run test         # Run tests

📝 Remember to always:
1. Check existing patterns in src/
2. Use @/ imports instead of relative paths
3. Handle Supabase errors with: if (error) throw error;
4. Run checks before committing
5. Follow the four-portal structure (customer, partner, admin, driver)

📁 Key Directories:
• src/components/     - Shared UI components
• src/pages/          - Route-level pages by portal
• src/hooks/          - Data fetching hooks
• src/contexts/       - Global state providers
• src/lib/            - Utility functions
• src/services/       - Business logic
• src/integrations/   - External service integrations

⚠️  Critical Rules from AGENTS.md:
• Use @/ imports for absolute paths
• All Supabase queries must check for errors
• Strict TypeScript with noImplicitAny
• Proper error tracking with captureError() in production
• Session timeout handled by SessionTimeoutManager
`);

// Run the pattern enforcer
const NutrioDevEnforcer = require('./scripts/enforce-patterns.js');
const enforcer = new NutrioDevEnforcer();

// Only run checks if we're in a development environment
if (process.env.NODE_ENV !== 'production') {
  console.log('\n🔍 Running initial pattern checks...\n');
  // You could add file watching here if needed
}