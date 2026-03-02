#!/usr/bin/env python3
"""
Fix test files to use authenticated fixture properly
- Replace 'page' parameter with the fixture name
- Remove hardcoded login steps
- Update all page references to use the fixture
"""

import re
from pathlib import Path

E2E_DIR = Path(__file__).parent.parent / 'e2e'

def fix_test_file(file_path: Path) -> bool:
    """Fix a test file to use authenticated fixture properly."""

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Skip if not using fixtures
    if 'from \'../fixtures/test\'' not in content and 'from "../fixtures/test"' not in content:
        return False

    # Determine fixture name from file path
    fixture_name = None
    if '/admin/' in str(file_path).replace('\\', '/'):
        fixture_name = 'authenticatedAdminPage'
    elif '/partner/' in str(file_path).replace('\\', '/'):
        fixture_name = 'authenticatedPartnerPage'
    elif '/driver/' in str(file_path).replace('\\', '/'):
        fixture_name = 'authenticatedDriverPage'
    elif '/customer/' in str(file_path).replace('\\', '/'):
        fixture_name = 'authenticatedCustomerPage'
    else:
        return False

    # Remove hardcoded login blocks (common patterns in generated tests)
    # Pattern 1: Login via UI with email/password
    login_patterns = [
        # Pattern: // Login first followed by goto auth and fill credentials
        r"\s*// Login first\s*\n\s*await page\.goto\([^)]+\);\s*\n\s*await page\.fill\([^)]+\);\s*\n\s*await page\.fill\([^)]+\);\s*\n\s*await page\.click\([^)]+\);\s*\n\s*await waitForNetworkIdle\(page\);",
        # Pattern: // Login first with email/password (3 lines version)
        r"\s*// Login first\s*\n\s*await page\.goto\(BASE_URL \+ '/auth'\);\s*\n\s*await page\.fill\('input#email',[^)]+\);\s*\n\s*await page\.fill\('input#password',[^)]+\);\s*\n\s*await page\.click\('button\[type=\"submit\"\]'\);\s*\n\s*await waitForNetworkIdle\(page\);",
    ]

    for pattern in login_patterns:
        content = re.sub(pattern, '', content, flags=re.MULTILINE)

    # Replace all 'page.' with '{fixture_name}.'
    # But be careful not to replace 'page' in comments or strings
    # Use a word boundary to match 'page.' only when it's a variable reference
    content = re.sub(r'\bpage\.', f'{fixture_name}.', content)

    # Replace 'page)' in waitForNetworkIdle calls
    content = re.sub(r'waitForNetworkIdle\(page\)', f'waitForNetworkIdle({fixture_name})', content)

    # Replace '(page)' in locators
    content = re.sub(r"page\.locator", f"{fixture_name}.locator", content)

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[FIXED] {file_path.name}")
        return True

    return False

def main():
    """Fix all test files."""
    files_fixed = 0
    files_skipped = 0

    for test_file in E2E_DIR.rglob('*.spec.ts'):
        # Skip the auth-fixed file
        if 'auth-fixed' in str(test_file):
            files_skipped += 1
            continue

        if fix_test_file(test_file):
            files_fixed += 1
        else:
            files_skipped += 1

    print(f"\n{'='*60}")
    print(f"Test Fix Summary")
    print(f"{'='*60}")
    print(f"Files fixed: {files_fixed}")
    print(f"Files skipped: {files_skipped}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
