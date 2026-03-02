#!/usr/bin/env python3
"""
Fix Routes and Selectors in E2E Tests
Updates all test files to match actual app structure
"""

import os
import re
import glob

# Route mappings from Excel/incorrect -> actual correct routes
ROUTE_MAPPINGS = {
    # Admin routes
    '/admin/ai-monitor': '/admin/analytics',
    '/admin/retention-analytics': '/admin/analytics',
    '/admin/affiliate-milestones': '/admin/milestones',
    '/admin/streak-rewards': '/admin/milestones',
    '/admin/ai': '/admin/analytics',
    
    # Partner routes  
    '/partner/earnings-dashboard': '/partner/earnings',
    '/partner/ai-insights': '/partner/analytics',
    
    # Customer routes
    '/meal-plans': '/subscription',
    '/meal-plan': '/subscription',
    '/progress/body': '/progress',
    '/dashboard/nutrition': '/dashboard',
    '/goals': '/progress',
}

# Common selector fixes
SELECTOR_FIXES = [
    # Auth page
    ("text=Create Account", "text=Sign up"),
    ("text=Sign In", "text=Sign in"),
    ("'Create Account'", "'Sign up'"),
    ("'Sign In'", "'Sign in'"),
    
    # Buttons
    ("'Submit'", "'Sign in'"),
    ("'Login'", "'Sign in'"),
    
    # Navigation
    ("'View Orders'", "text=Orders"),
    ("'View Menu'", "text=Menu"),
]

def fix_file(filepath):
    """Fix routes and selectors in a single test file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Fix routes
        for old_route, new_route in ROUTE_MAPPINGS.items():
            content = content.replace(old_route, new_route)
        
        # Fix selectors
        for old_selector, new_selector in SELECTOR_FIXES:
            content = content.replace(old_selector, new_selector)
        
        # Fix common issues
        content = re.sub(r"BASE_URL \+ 'https://nutrio\.me", "BASE_URL + '", content)
        content = content.replace("https://nutrio.me", "")
        
        # Only write if changed
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    
    except Exception as e:
        print(f"Error fixing {filepath}: {e}")
        return False

def main():
    print("=" * 80)
    print("FIXING ROUTES AND SELECTORS")
    print("=" * 80)
    print()
    
    e2e_dir = r'C:\Users\khamis\Documents\nutrio-fuel-new\e2e'
    test_files = glob.glob(os.path.join(e2e_dir, '**/*.spec.ts'), recursive=True)
    
    fixed_count = 0
    
    for filepath in test_files:
        if fix_file(filepath):
            fixed_count += 1
            print(f"✅ Fixed: {os.path.basename(filepath)}")
    
    print()
    print("=" * 80)
    print(f"FIXED {fixed_count} FILES")
    print("=" * 80)
    print()
    print("Route Mappings Applied:")
    for old, new in ROUTE_MAPPINGS.items():
        print(f"  {old} -> {new}")
    print()
    print("Selector Fixes Applied:")
    for old, new in SELECTOR_FIXES[:5]:
        print(f"  {old} -> {new}")

if __name__ == '__main__':
    main()
