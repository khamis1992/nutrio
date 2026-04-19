import time

# Keep server running
import subprocess
server = subprocess.Popen(
    ["npm", "run", "dev"],
    cwd="C:\\Users\\khamis\\Documents\\nutrio",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    shell=True
)

# Wait for server to start
time.sleep(8)

# Now run the test
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
        
        browser.close()
        return len(regressions)

result = run_tests()

server.terminate()

if result == 0:
    print("\nALL TESTS PASSED - No regressions")
else:
    print(f"\n{result} REGRESSION(S) DETECTED")
    
exit(result)
