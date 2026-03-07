// Script to extract all t() calls from pages and components - refined version
const fs = require('fs');
const path = require('path');

// Read the translations file to extract all defined keys
const translationsPath = path.join(__dirname, 'src', 'contexts', 'LanguageContext.tsx');
const translationsContent = fs.readFileSync(translationsPath, 'utf-8');

// Extract all translation keys from the en section
const definedKeys = new Set();
const keyPattern = /^\s+(\w+):\s*"/gm;
let match;
while ((match = keyPattern.exec(translationsContent)) !== null) {
  definedKeys.add(match[1]);
}

console.log(`Found ${definedKeys.size} defined translation keys in LanguageContext.tsx\n`);

// Function to check if a "key" is actually a Supabase column name pattern
function isSupabaseColumn(key) {
  // Supabase column patterns: "id, name", "*, status", etc.
  const supabasePatterns = [
    /^\s*[*\w]+(\s*,\s*[\w_]+)+\s*$/,  // "id, name, status" or "*"
    /^\s*\w+\s*\(.*\)\s*$/,  // "meals(id, name)" or nested queries
    /\(.*\)/,  // Contains parentheses
  ];
  return supabasePatterns.some(p => p.test(key));
}

// Function to check if it's likely a false positive (not a translation key)
function isFalsePositive(key) {
  // Skip these patterns:
  // - CSS class names or styles
  // - Test data strings
  // - SQL-like patterns
  // - Very short single letters that aren't meaningful translation keys
  const falsePositivePatterns = [
    /^[T]$/,  // Single letter T (used for TypeScript generic)
    /^[*]+$/,  // Just asterisks
    /^\s*\.$/,  // Just a period
    /^\s*,\s*$/,  // Just a comma
    /^\s*@\s*$/,  // Just @
    /^\s*\s*$/,  // Just whitespace
    /\d+\s+(meal|meals)/,  // Test data like "2 meals"
    /Lose Weight|Build Muscle|Maintain/,  // Test data
    /Moderately committed|Just exploring|All in/,  // Test data
    /Best value|Wide restaurant|Premium experience/,  // Test data
    /Order Updates|Delivery Updates|Promotions|Meal Reminders/,  // Test data
    /Child content|Custom error|Healthy Bites|Reload Page|Something went wrong/,  // Test data
    /Unlock This Meal|Start Your Meal Plan|Track Your Progress|Recommended for You/,  // Test data
    /Basic|Standard|Premium|VIP|Select This Plan/,  // Test data
    /Push|Email|WhatsApp|Notification Preferences/,  // Test data
    /Choose how you want|Get notified when|Track your delivery|Special offers|Reminders to schedule/,  // Test data
    /Flexible weekly|Daily calorie|Schedule this meal|Track your nutrition|Get personalized/,  // Test data
    /1 meal|3 meals|Varies \/ Flexible|Very committed|Personal coaching/,  // Test data
    /Best for trying out|Most popular|Best value|Premium experience/,  // Test data
    /3 Meals Remaining|1 Meals Remaining|10 Meals Remaining|Meal Quota Exhausted|View Options|Upgrade Plan/,  // Test data
    /You were logged out|You chose to log out|Session expired/,  // Test data
  ];
  
  return falsePositivePatterns.some(p => p.test(key)) || isSupabaseColumn(key);
}

// Function to extract t() calls from a file
function extractTCalls(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tCalls = [];
  
  // Match t("key") or t('key') - but be smarter about it
  // Use a more specific pattern that captures the key inside quotes
  const pattern = /t\(\s*["']([^"']+)["']\s*\)/g;
  let m;
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineMatches = [];
    while ((m = pattern.exec(line)) !== null) {
      const key = m[1].trim();
      // Skip if it looks like a false positive
      if (!isFalsePositive(key)) {
        lineMatches.push({
          key: key,
          line: index + 1,
          fullMatch: m[0],
          context: line.trim()
        });
      }
    }
    if (lineMatches.length > 0) {
      tCalls.push(...lineMatches);
    }
  });
  
  return tCalls;
}

// Directories to search
const searchDirs = [
  path.join(__dirname, 'src', 'pages'),
  path.join(__dirname, 'src', 'components')
];

const allTCalls = [];

searchDirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  
  // Recursively get all .tsx files, excluding .test.tsx files
  function getTsxFiles(dirPath) {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    const tsxFiles = [];
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        tsxFiles.push(...getTsxFiles(fullPath));
      } else if (file.name.endsWith('.tsx') && !file.name.endsWith('.test.tsx')) {
        tsxFiles.push(fullPath);
      }
    }
    
    return tsxFiles;
  }
  
  const files = getTsxFiles(dir);
  files.forEach(filePath => {
    const calls = extractTCalls(filePath);
    if (calls.length > 0) {
      allTCalls.push({
        file: filePath,
        calls: calls
      });
    }
  });
});

// Check for missing keys
const missingKeys = [];
const foundKeys = [];

allTCalls.forEach(({ file, calls }) => {
  calls.forEach(({ key, line, fullMatch, context }) => {
    const exists = definedKeys.has(key);
    const entry = {
      file: file.replace(__dirname + '\\', ''),
      line,
      key,
      exists,
      context
    };
    
    if (exists) {
      foundKeys.push(entry);
    } else {
      missingKeys.push(entry);
    }
  });
});

// Sort by file and line
missingKeys.sort((a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  return a.line - b.line;
});

foundKeys.sort((a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  return a.line - b.line;
});

// Output results
console.log('='.repeat(100));
console.log('MISSING TRANSLATION KEYS (Refined Analysis)\n');
console.log('='.repeat(100));

if (missingKeys.length === 0) {
  console.log('✅ No missing translation keys found!\n');
} else {
  console.log(`Found ${missingKeys.length} potentially missing translation keys:\n`);
  
  let currentFile = '';
  missingKeys.forEach(({ file, line, key, context }) => {
    if (file !== currentFile) {
      console.log(`\n📁 ${file}`);
      currentFile = file;
    }
    console.log(`   Line ${line}: "${key}"`);
    if (context && context.length < 150) {
      console.log(`   Context: ${context}`);
    }
  });
}

console.log('\n' + '='.repeat(100));
console.log('SUMMARY\n');
console.log('='.repeat(100));
console.log(`Total defined keys: ${definedKeys.size}`);
console.log(`Total t() calls found: ${foundKeys.length + missingKeys.length}`);
console.log(`Keys that exist: ${foundKeys.length}`);
console.log(`Potentially missing keys: ${missingKeys.length}`);

// Group missing keys by key name
if (missingKeys.length > 0) {
  const keyCounts = {};
  missingKeys.forEach(({ key }) => {
    keyCounts[key] = (keyCounts[key] || 0) + 1;
  });
  
  console.log('\nMissing keys by frequency (top 50):');
  Object.entries(keyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .forEach(([key, count]) => {
      console.log(`  - "${key}": ${count} occurrence(s)`);
    });
  
  if (Object.keys(keyCounts).length > 50) {
    console.log(`  ... and ${Object.keys(keyCounts).length - 50} more unique keys`);
  }
}

// Show sample of defined keys for reference
console.log('\n' + '='.repeat(100));
console.log('SAMPLE OF DEFINED KEYS (first 20):\n');
console.log('='.repeat(100));
Array.from(definedKeys).slice(0, 20).forEach(key => {
  console.log(`  - ${key}`);
});
console.log(`  ... and ${definedKeys.size - 20} more`);
