#!/usr/bin/env python3
"""
Final verification of data-testid attributes in source files
"""

import re

files_to_check = [
    ('src/components/layout/BottomTabBar.tsx', 'bottom-tab-bar'),
    ('src/pages/Dashboard.tsx', 'user-avatar-image'),
    ('src/pages/Dashboard.tsx', 'log-meal-button'),
    ('src/pages/Dashboard.tsx', 'quick-actions-grid'),
]

print("Data-testid Attribute Verification")
print("="*60)
print()

all_found = True

for filepath, expected in files_to_check:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Find data-testid with the expected value
        pattern = f'data-testid="{expected}"'
        if pattern in content:
            # Find line number
            lines = content.split('\n')
            for i, line in enumerate(lines, 1):
                if pattern in line:
                    print(f"FOUND: {expected:25} in {filepath:40} Line {i}")
                    break
        else:
            print(f"MISSING: {expected:25} in {filepath}")
            all_found = False
    except FileNotFoundError:
        print(f"ERROR: {expected:25} FILE NOT FOUND: {filepath}")
        all_found = False

print()
print("="*60)
if all_found:
    print("ALL DATA-TESID ATTRIBUTES FOUND")
else:
    print("SOME TEST IDS ARE MISSING")
print("="*60)
