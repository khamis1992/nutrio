#!/usr/bin/env python3
"""
Improved E2E Test Generator for Nutrio Fuel
Fixes duplicates, updates selectors, uses correct credentials
"""

import pandas as pd
import os
import re
from pathlib import Path

# Configuration
file_path = r'C:\Users\khamis\Documents\nutrio-fuel-new\docs\plans\Nutrio-Fuel-E2E-Test-Plan.xlsx'
output_dir = r'C:\Users\khamis\Documents\nutrio-fuel-new\e2e'

# Test credentials from user
TEST_USERS = {
    'customer': {
        'email': 'khamis--1992@hotmail.com',
        'password': 'Khamees1992#',
    },
    'admin': {
        'email': 'khamis--1992@hotmail.com',  # Same user with admin role
        'password': 'Khamees1992#',
    },
    'partner': {
        'email': 'partner@nutrio.com',
        'password': 'Partner123!',
    },
    'driver': {
        'email': 'driver@nutriofuel.com',
        'password': 'Driver123!',
    },
}

def sanitize_test_name(name):
    """Create valid test name from test case"""
    # Remove special characters and limit length
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'\s+', '_', name)
    return name[:80]  # Limit length

def generate_test_content(portal, module, tests_df):
    """Generate test file content with proper selectors"""
    
    # Track test names to avoid duplicates
    test_names = {}
    
    content = f'''import {{ test, expect }} from '@playwright/test';
import {{ waitForNetworkIdle }} from '../utils/helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('{portal} - {module}', () => {{
'''
    
    for idx, row in tests_df.iterrows():
        tc_id = str(row['TC ID'])
        feature = str(row['Feature'])
        test_case = str(row['Test Case'])
        url = str(row['Link / URL'])
        expected = str(row['Expected Result'])
        priority = str(row['Priority'])
        
        # Create unique test name
        base_name = sanitize_test_name(test_case)
        if base_name in test_names:
            test_names[base_name] += 1
            test_name = f"{tc_id}_{base_name}_{test_names[base_name]}"
        else:
            test_names[base_name] = 1
            test_name = f"{tc_id}_{base_name}"
        
        # Generate test steps based on feature
        test_body = generate_test_body(portal, module, feature, url, expected)
        
        content += f'''
  test('{test_name}', async ({{ page }}) => {{
    // Priority: {priority}
    // Feature: {feature}
    // Expected: {expected[:100]}...
    
    {test_body}
  }});
'''
    
    content += '});\n'
    return content

def generate_test_body(portal, module, feature, url, expected):
    """Generate appropriate test body based on feature type"""
    
    # Parse URL to get path
    if 'https://nutrio.me' in url:
        path = url.replace('https://nutrio.me', '')
    else:
        path = url
    
    # Auth module tests
    if module == 'Auth':
        if 'Login' in feature or 'Sign In' in feature:
            return f'''// Navigate to auth page
    await page.goto(BASE_URL + '{path}');
    await waitForNetworkIdle(page);
    
    // Fill login form using actual selectors from Auth.tsx
    await page.fill('input#email', '{TEST_USERS[portal.lower()]["email"]}');
    await page.fill('input#password', '{TEST_USERS[portal.lower()]["password"]}');
    
    // Click Sign In button
    await page.click('button[type="submit"]');
    await waitForNetworkIdle(page);
    
    // Verify successful login
    await expect(page).toHaveURL(/.*dashboard.*/);
    await expect(page.locator('body')).toContainText('Dashboard');'''
        
        elif 'Logout' in feature:
            return f'''// Login first
    await page.goto(BASE_URL + '/auth');
    await page.fill('input#email', '{TEST_USERS[portal.lower()]["email"]}');
    await page.fill('input#password', '{TEST_USERS[portal.lower()]["password"]}');
    await page.click('button[type="submit"]');
    await waitForNetworkIdle(page);
    
    // Verify logged in
    await expect(page).toHaveURL(/.*dashboard.*/);
    
    // Click logout
    await page.click('text=Logout');
    await waitForNetworkIdle(page);
    
    // Verify logged out
    await expect(page).toHaveURL(/.*auth.*/);'''
        
        elif 'Registration' in feature or 'Create Account' in feature:
            return f'''// Navigate to auth page
    await page.goto(BASE_URL + '/auth');
    await waitForNetworkIdle(page);
    
    // Click sign up toggle
    await page.click('text=Sign up');
    
    // Fill registration form
    const testEmail = `test${{Date.now()}}@example.com`;
    await page.fill('input#name', 'Test User');
    await page.fill('input#email', testEmail);
    await page.fill('input#password', 'TestPassword123!');
    
    // Submit
    await page.click('button[type="submit"]');
    await waitForNetworkIdle(page);
    
    // Verify success or onboarding
    await expect(page.locator('body')).toContainText(/verify|onboarding|success/i);'''
        
        elif 'Password Reset' in feature:
            return f'''// Navigate to auth page
    await page.goto(BASE_URL + '/auth');
    await waitForNetworkIdle(page);
    
    // Open forgot password dialog (if exists)
    await page.click('text=Forgot Password');
    
    // Fill email
    await page.fill('input#email', '{TEST_USERS[portal.lower()]["email"]}');
    await page.click('button[type="submit"]');
    await waitForNetworkIdle(page);
    
    // Verify reset message
    await expect(page.locator('body')).toContainText(/sent|email|reset/i);'''
        
        else:
            return f'''// Navigate to auth page
    await page.goto(BASE_URL + '{path}');
    await waitForNetworkIdle(page);
    
    // TODO: Implement specific auth test steps
    // Verify page loaded
    await expect(page.locator('body')).toBeVisible();'''
    
    # Dashboard tests
    elif module == 'Dashboard':
        return f'''// Login first
    await page.goto(BASE_URL + '/auth');
    await page.fill('input#email', '{TEST_USERS[portal.lower()]["email"]}');
    await page.fill('input#password', '{TEST_USERS[portal.lower()]["password"]}');
    await page.click('button[type="submit"]');
    await waitForNetworkIdle(page);
    
    // Navigate to dashboard
    await page.goto(BASE_URL + '{path}');
    await waitForNetworkIdle(page);
    
    // Verify dashboard loaded
    await expect(page.locator('body')).toContainText('Dashboard');'''
    
    # Default tests for other modules
    else:
        return f'''// Navigate to page
    await page.goto(BASE_URL + '{path}');
    await waitForNetworkIdle(page);
    
    // TODO: Implement specific test steps for {feature}
    // Verify page loaded
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText('{feature}');'''

def generate_portal_tests(portal_name):
    """Generate all test files for a portal"""
    try:
        df = pd.read_excel(file_path, sheet_name=f'{portal_name} Tests')
        print(f"\\nProcessing {portal_name}: {len(df)} tests")
        
        # Group by module
        modules = df.groupby('Module')
        
        for module, tests in modules:
            filename = f"{portal_name.lower()}/{module.lower().replace(' ', '_')}.spec.ts"
            filepath = os.path.join(output_dir, filename)
            
            content = generate_test_content(portal_name, module, tests)
            
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"  Generated: {filename} ({len(tests)} tests)")
    
    except Exception as e:
        print(f"  Error processing {portal_name}: {e}")

def main():
    print("=" * 80)
    print("IMPROVED E2E TEST GENERATOR")
    print("=" * 80)
    print("\\nFixes:")
    print("  - Duplicate test names (now unique)")
    print("  - Correct selectors (input#email, input#password, etc.)")
    print("  - Updated credentials")
    print("  - Better formatting")
    print()
    
    portals = ['Customer', 'Admin', 'Partner', 'Driver', 'System']
    
    for portal in portals:
        generate_portal_tests(portal)
    
    print("\\n" + "=" * 80)
    print("TEST GENERATION COMPLETE!")
    print("=" * 80)
    print("\\nNext steps:")
    print("  1. Review generated tests")
    print("  2. Run: npx playwright test")
    print("  3. Update any remaining TODO sections")

if __name__ == '__main__':
    main()
