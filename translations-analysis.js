// Script to extract all t() calls from pages and components
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

// Function to extract t() calls from a file
function extractTCalls(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tCalls = [];
  
  // Match t("key") or t('key')
  const pattern = /t\(['"]([^'"]+)['"]\)/g;
  let m;
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineMatches = [];
    while ((m = pattern.exec(line)) !== null) {
      lineMatches.push({
        key: m[1],
        line: index + 1,
        fullMatch: m[0]
      });
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
  
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (file.endsWith('.tsx')) {
      const filePath = path.join(dir, file);
      const calls = extractTCalls(filePath);
      if (calls.length > 0) {
        allTCalls.push({
          file: filePath,
          calls: calls
        });
      }
    }
  });
});

// Check for missing keys
const missingKeys = [];
const foundKeys = [];

allTCalls.forEach(({ file, calls }) => {
  calls.forEach(({ key, line, fullMatch }) => {
    const exists = definedKeys.has(key);
    const entry = {
      file: file.replace(__dirname + '\\', ''),
      line,
      key,
      exists
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
console.log('='.repeat(80));
console.log('MISSING TRANSLATION KEYS\n');
console.log('='.repeat(80));

if (missingKeys.length === 0) {
  console.log('✅ No missing keys found!\n');
} else {
  console.log(`Found ${missingKeys.length} potentially missing keys:\n`);
  
  let currentFile = '';
  missingKeys.forEach(({ file, line, key }) => {
    if (file !== currentFile) {
      console.log(`\n📁 ${file}`);
      currentFile = file;
    }
    console.log(`   Line ${line}: "${key}"`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('SUMMARY\n');
console.log('='.repeat(80));
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
  
  console.log('\nMissing keys by frequency:');
  Object.entries(keyCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => {
      console.log(`  - ${key}: ${count} occurrence(s)`);
    });
}
