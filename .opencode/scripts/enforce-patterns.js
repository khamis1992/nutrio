#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class NutrioDevEnforcer {
  constructor() {
    this.patterns = {
      badRelativeImport: /\.\.\/\.\.\//g,
      supabaseCall: /supabase\./g,
      missingErrorHandler: /supabase\.[^(]*\([^)]*\)(?![\s\S]*if\s*\(\s*error\s*\))/g
    };
  }

  enforcePatterns(files) {
    const issues = [];
    
    files.forEach(file => {
      if (!fs.existsSync(file)) return;
      
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for bad relative imports
      const badRelativeMatches = content.match(this.patterns.badRelativeImport);
      if (badRelativeMatches && badRelativeMatches.length > 2) {
        issues.push({
          file: file,
          issue: "Uses too many relative imports. Use @/ path aliases instead.",
          severity: "warning"
        });
      }
      
      // Check Supabase error handling
      if (content.includes('supabase.') && !this.hasErrorHandling(content)) {
        issues.push({
          file: file,
          issue: "Missing Supabase error handling. Add: if (error) throw error;",
          severity: "error"
        });
      }
    });
    
    return issues;
  }

  hasErrorHandling(content) {
    // Simple check for error handling patterns
    return content.includes('if (error)') || 
           content.includes('if(error)') ||
           content.includes('.catch(');
  }

  runChecks() {
    console.log('🔧 Running Nutrio Development Pattern Checks...\n');
    
    // Run TypeScript check
    try {
      execSync('npm run typecheck', { stdio: 'pipe' });
      console.log('✅ TypeScript check passed');
    } catch (error) {
      console.log('❌ TypeScript errors found:');
      try {
        console.log(error.stdout.toString());
      } catch (e) {
        console.log("See detailed errors above");
      }
    }
    
    // Run linting
    try {
      execSync('npm run lint', { stdio: 'pipe' });
      console.log('✅ Linting check passed');
    } catch (error) {
      console.log('❌ Linting errors found');
    }
    
    console.log('\n📝 Remember to always:');
    console.log('1. Check existing patterns in src/');
    console.log('2. Use @/ imports instead of relative paths');
    console.log('3. Handle Supabase errors');
    console.log('4. Run checks before committing\n');
  }
}

// Run the enforcer if called directly
if (require.main === module) {
  const enforcer = new NutrioDevEnforcer();
  enforcer.runChecks();
}

module.exports = NutrioDevEnforcer;