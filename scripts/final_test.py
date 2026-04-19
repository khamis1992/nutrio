#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def test_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("Navigating to dashboard...")
        try:
            page.goto('http://localhost:5173/nutrio/dashboard', timeout=30000)
        except:
            print("Timeout - server may not be responding")
            browser.close()
            return -1
            
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        regressions = []
        
        # Test 1: Bottom tab bar
        bottom_nav = page.locator('[data-testid="bottom-tab-bar"]').first
        if bottom_nav.count() > 0:
            print("PASS: Bottom tab bar visible")
        else:
            regressions.append("CRITICAL: Bottom tab bar not visible")
            print("FAIL: Bottom tab bar MISSING")
        
        # Test 2: User avatar
        avatar = page.locator('[data-testid="user-avatar-image"]').first
        if avatar.count() > 0:
            print("PASS: User avatar visible")
        else:
            regressions.append("Header: User avatar not visible")
            print("FAIL: User avatar MISSING")
        
        # Test 3: Log Meal button
        log_meal = page.locator('[data-testid="log-meal-button"]').first
        if log_meal.count() > 0:
            print("PASS: Log Meal button visible")
        else:
            regressions.append("Button: Log Meal button missing")
            print("FAIL: Log Meal button MISSING")
        
        # Test 4: Tracker quick action  
        tracker = page.locator('[data-testid="quick-action-tracker"]').first
        if tracker.count() > 0:
            print("PASS: Tracker quick action visible")
        else:
            regressions.append("Quick Action: Tracker link missing")
            print("FAIL: Tracker MISSING")
        
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
    exit(test_dashboard())
