#!/usr/bin/env python3
"""
Update test files to use authenticated fixtures
Changes imports and page parameter to use the appropriate authenticated fixture
"""

import os
import re
from pathlib import Path

E2E_DIR = Path(__file__).parent.parent / 'e2e'

def update_test_file(file_path: Path) -> bool:
    """Update a test file to use authenticated fixtures."""

    # Determine which fixture to use based on file path
    fixture_name = None
    if '/admin/' in str(file_path).replace('\\', '/') or '\\admin\\' in str(file_path):
        fixture_name = 'authenticatedAdminPage'
    elif '/partner/' in str(file_path).replace('\\', '/') or '\\partner\\' in str(file_path):
        fixture_name = 'authenticatedPartnerPage'
    elif '/driver/' in str(file_path).replace('\\', '/') or '\\driver\\' in str(file_path):
        fixture_name = 'authenticatedDriverPage'
    elif '/customer/' in str(file_path).replace('\\', '/') or '\\customer\\' in str(file_path):
        fixture_name = 'authenticatedCustomerPage'
    else:
        # System or other tests - skip for now
        return False

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Skip if already updated
    if 'from \'../fixtures/test\'' in content or 'from "../fixtures/test"' in content:
        return False

    # Update import statement
    content = re.sub(
        r"import\s*{\s*test\s*,\s*expect\s*}\s*from\s*['\"]@playwright/test['\"];?",
        "import { test, expect } from '../fixtures/test';",
        content
    )

    # Update test function signature: async ({ page }) -> async ({ fixture_name })
    # Pattern matches test('name', async ({ page }) => { or test('name', {tag}, async ({ page }) => {
    def replace_page_param(match):
        prefix = match.group(1)  # Everything before 'page'
        suffix = match.group(2)  # Everything after 'page'
        return f"{prefix}{fixture_name}{suffix}"

    content = re.sub(
        r"(test\([^)]+async\s*\(\{\s*)page(\s*\}\)\s*=>\s*\{)",
        replace_page_param,
        content
    )

    # Also handle test.describe patterns
    content = re.sub(
        r"(test\(['\"][^'\"]+['\"]\s*,\s*async\s*\(\{\s*)page(\s*\}\)\s*=>\s*\{)",
        replace_page_param,
        content
    )

    # Update page references inside test functions to use the fixture name
    # But be careful not to replace 'page' in comments or strings

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[UPDATED] {file_path.name} -> using {fixture_name}")
        return True

    return False

def main():
    """Update all test files."""
    files_updated = 0
    files_skipped = 0

    for test_file in E2E_DIR.rglob('*.spec.ts'):
        # Skip the auth-fixed file which is already working
        if 'auth-fixed' in str(test_file):
            files_skipped += 1
            continue

        if update_test_file(test_file):
            files_updated += 1
        else:
            files_skipped += 1

    print(f"\n{'='*60}")
    print(f"Fixture Update Summary")
    print(f"{'='*60}")
    print(f"Files updated: {files_updated}")
    print(f"Files skipped: {files_skipped}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
