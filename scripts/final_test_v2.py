#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        regressions = []
        
        # Test 1: Bottom tab bar
        bottom_nav = page.locator('[data-testid="bottom-tab-bar"]').first
        if bottom_nav.count() > 0:
            print("PASS: Bottom tab bar")
        else:
            regressions.append("CRITICAL: Bottom tab bar not visible")
            print("FAIL: Bottom tab bar MISSING")
        
        # Test 2: User avatar
        avatar = page.locator('[data-testid="user-avatar-image"]').first
        if avatar.count() > 0:
            print("PASS: User avatar")
        else:
            regressions.append("User avatar not visible")
            print("FAIL: User avatar MISSING")
        
        # Test 3: Log Meal button
        log_meal = page.locator('[data-testid="log-meal-button"]').first
        if log_meal.count() > 0:
            print("PASS: Log Meal button")
        else:
            regressions.append("Log Meal button missing")
            print("FAIL: Log Meal button MISSING")
        
        # Test 4: Quick actions (check for the container and at least one action)
        quick_actions = page.locator('[data-testid="quick-actions-grid"] a').all()
        if len(quick_actions) >= 1:
            print(f"PASS: Quick actions ({len(quick_actions)} found)")
        else:
            regressions.append("Quick actions missing")
            print("FAIL: Quick actions MISSING")
        
        # Check specific action by text
        tracker_action = page.locator('a[href="/nutrio/tracker"]').first
        if tracker_action.count() > 0:
            print("PASS: Tracker link exists")
        else:
            regressions.append("Tracker link missing")
            print("FAIL: Tracker link MISSING")
        
        print("\n" + "="*60)
        if len(regressions) == 0:
            print("ALL TESTS PASSED - No regressions detected")
        else:
            print(f"FOUND {len(regressions)} REGRESSION(S):")
            for reg in regressions:
                print(f"  - {reg}")
        print("="*60)
        
        browser.close()
        return len(regressions)

if __name__ == "__main__":
    exit(run_tests())
