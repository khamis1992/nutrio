#!/usr/bin/env python3
"""
Final regression test script
Run this AFTER starting the dev server manually:
1. Start: npm run dev
2. Run this test in a new terminal
"""

import time
from playwright.sync_api import sync_playwright

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("Navigating to dashboard...")
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        regressions = []
        
        # Test 1: Bottom tab bar
        bottom_nav = page.locator('[data-testid="bottom-tab-bar"]').first
        if bottom_nav.count() > 0:
            print("TEST PASSED: Bottom tab bar exists")
        else:
            regressions.append("CRITICAL: Bottom tab bar not visible")
            print("TEST FAILED: Bottom tab bar MISSING")
        
        # Test 2: User avatar
        avatar = page.locator('[data-testid="user-avatar-image"]').first
        if avatar.count() > 0:
            print("TEST PASSED: User avatar exists")
        else:
            regressions.append("FAIL: User avatar not visible")
            print("TEST FAILED: User avatar MISSING")
        
        # Test 3: Log Meal button
        log_meal = page.locator('[data-testid="log-meal-button"]').first
        if log_meal.count() > 0:
            print("TEST PASSED: Log Meal button exists")
        else:
            regressions.append("FAIL: Log Meal button missing")
            print("TEST FAILED: Log Meal button MISSING")
        
        # Test 4: Quick actions container
        quick_actions = page.locator('[data-testid="quick-actions-grid"]').first
        if quick_actions.count() > 0:
            links = page.locator('[data-testid="quick-actions-grid"] a').all()
            print(f"TEST PASSED: Quick actions container exists ({len(links)} links)")
        else:
            regressions.append("FAIL: Quick actions container missing")
            print("TEST FAILED: Quick actions MISSING")
        
        # Test 5: Tracker link existence (by href)
        tracker = page.locator('a[href="/nutrio/tracker"]').first
        if tracker.count() > 0:
            print("TEST PASSED: Tracker link exists")
        else:
            regressions.append("FAIL: Tracker link missing")
            print("TEST FAILED: Tracker link MISSING")
        
        # Test 6: Navigation links (by href)
        nav_links = page.locator('[data-testid="bottom-tab-bar"] a').all()
        print(f"INFO: Bottom nav has {len(nav_links)} links")
        
        print("\n" + "="*60)
        if len(regressions) == 0:
            print("RESULT: ALL TESTS PASSED - No regressions detected")
        else:
            print(f"RESULT: FOUND {len(regressions)} REGRESSION(S):")
            for reg in regressions:
                print(f"  - {reg}")
        print("="*60)
        
        browser.close()
        return len(regressions)

if __name__ == "__main__":
    exit(run_tests())
