import time
from playwright.sync_api import sync_playwright

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        # Go to login page first
        print("Navigating to login page...")
        page.goto('http://localhost:5173/nutrio/auth')
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        # Login
        print("Logging in as eng.aljabor@gmail.com...")
        page.fill('input[type="email"]', 'eng.aljabor@gmail.com')
        page.fill('input[type="password"]', '123456789')
        page.click('button:has-text("Sign In")')
        
        page.wait_for_load_state('networkidle')
        time.sleep(5)
        
        # Now test dashboard
        print("\n--- Testing Dashboard ---")
        regressions = []
        
        # Check URL
        print(f"Current URL: {page.url}")
        
        # Take screenshot
        page.screenshot(path='C:/Users/khamis/Documents/nutrio/regression_test/login_and_dashboard.png')
        print("Screenshot saved")
        
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
            regressions.append("FAIL: User avatar not visible")
            print("FAIL: User avatar MISSING")
        
        # Test 3: Log Meal button
        log_meal = page.locator('[data-testid="log-meal-button"]').first
        if log_meal.count() > 0:
            print("PASS: Log Meal button")
        else:
            regressions.append("FAIL: Log Meal button missing")
            print("FAIL: Log Meal button MISSING")
        
        # Test 4: Quick actions
        quick_actions = page.locator('[data-testid="quick-actions-grid"]').first
        if quick_actions.count() > 0:
            links = page.locator('[data-testid="quick-actions-grid"] a').all()
            print(f"PASS: Quick actions ({len(links)} links)")
        else:
            regressions.append("FAIL: Quick actions container missing")
            print("FAIL: Quick actions MISSING")
        
        # Test 5: Tracker link
        tracker = page.locator('a[href="/nutrio/tracker"]').first
        if tracker.count() > 0:
            print("PASS: Tracker link")
        else:
            regressions.append("FAIL: Tracker link missing")
            print("FAIL: Tracker link MISSING")
        
        # Test 6: Navigation links
        nav_links = page.locator('[data-testid="bottom-tab-bar"] a').all()
        print(f"INFO: Bottom nav has {len(nav_links)} links")
        
        browser.close()
        
        print("\n" + "="*60)
        if len(regressions) == 0:
            print("RESULT: ALL TESTS PASSED - No regressions detected")
            return 0
        else:
            print(f"RESULT: FOUND {len(regressions)} REGRESSION(S):")
            for reg in regressions:
                print(f"  - {reg}")
            print("="*60)
            return len(regressions)

if __name__ == "__main__":
    exit(run_tests())
