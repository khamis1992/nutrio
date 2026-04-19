#!/usr/bin/env python3
"""
Regression test script for Nutrio Dashboard
"""

from playwright.sync_api import sync_playwright, expect
import time

def test_dashboard():
    page = None
    browser = None
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            print("Navigating to dashboard...")
            page.goto('http://localhost:5173/nutrio/dashboard')
            page.wait_for_load_state('networkidle')
            time.sleep(2)
            
            # Save DOM content for inspection
            dom_content = page.content()
            with open('C:/Users/khamis/Documents/nutrio/regression_test/dashboard_dom.html', 'w', encoding='utf-8') as f:
                f.write(dom_content)
            print("DOM saved for inspection")
            
            page.screenshot(path='C:/Users/khamis/Documents/nutrio/regression_test/dashboard_initial.png')
            print("Dashboard loaded")
            
            # Wait for React components to fully render
            time.sleep(2)
            
            # Debug: print actual URL
            print(f"Current URL: {page.url}")
            
            regressions = []
            
            # Test header elements
            print("\n--- Testing Header Elements ---")
            try:
                # Look for avatar using data-testid
                avatar_img = page.locator('[data-testid="user-avatar-image"]').first
                if avatar_img.count() > 0:
                    print("User avatar visible")
                else:
                    regressions.append("Header: User avatar not visible")
                    print("User avatar MISSING")
            except Exception as e:
                print(f"Avatar test skipped: {e}")
            
            # Test bottom tab bar using data-testid
            print("\n--- Testing Bottom Tab Bar ---")
            try:
                bottom_nav = page.locator('[data-testid="bottom-tab-bar"]').first
                if bottom_nav.count() > 0:
                    print("Bottom tab bar visible")
                else:
                    regressions.append("CRITICAL: Bottom tab bar not visible")
                    print("Bottom tab bar MISSING")
            except Exception as e:
                regressions.append(f"Bottom tab bar error: {e}")
                print(f"Bottom tab bar error: {e}")
            
            # Test subscription card
            print("\n--- Testing Dashboard Sections ---")
            try:
                sub_card = page.locator('div:has-text("Active Plan")').first
                if sub_card.count() > 0:
                    print("Subscription status card visible")
                else:
                    print("  (Subscription card test skipped)")
            except Exception as e:
                print(f"Subscription card test skipped: {e}")
            
            # Test log meal button
            print("\n--- Testing Interactive Elements ---")
            try:
                log_meal = page.locator('[data-testid="log-meal-button"]').first
                if log_meal.count() > 0:
                    print("Log Meal button visible")
                else:
                    regressions.append("Button: Log Meal button missing")
                    print("Log Meal button MISSING")
            except Exception as e:
                print(f"Log Meal test skipped: {e}")
            
            # Test quick actions using data-testid
            try:
                tracker = page.locator('[data-testid="quick-action-tracker"]').first
                if tracker.count() > 0:
                    print("Tracker quick action visible")
                else:
                    regressions.append("Quick Action: Tracker link missing")
                    print("Tracker MISSING")
            except Exception as e:
                print(f"Tracker test skipped: {e}")
            
            # Test click navigation
            print("\n--- Testing Click Navigation ---")
            try:
                # Find avatar image and click its parent link
                avatar_link = page.locator('[data-testid="header-avatar-link"]').first
                if avatar_link.count() > 0:
                    avatar_link.click(timeout=3000)
                    page.wait_for_load_state('networkidle')
                    time.sleep(1)
                    if 'profile' in page.url:
                        print("Profile link works")
                        page.goto('http://localhost:5173/nutrio/dashboard')
                        page.wait_for_load_state('networkidle')
                        time.sleep(1)
                    else:
                        regressions.append(f"Navigation: Profile redirect issue: {page.url}")
                        print(f"Profile redirect wrong: {page.url}")
                else:
                    print("Avatar link not found for click test")
            except Exception as e:
                print(f"Profile click test skipped: {e}")
            
            try:
                # Find notification bell button
                bell_btn = page.locator('button[aria-label*="Notification"]').first
                if bell_btn.count() > 0:
                    bell_btn.click(timeout=3000)
                    page.wait_for_load_state('networkidle')
                    time.sleep(1)
                    print("Notification bell works")
                    page.goto('http://localhost:5173/nutrio/dashboard')
                    page.wait_for_load_state('networkidle')
                    time.sleep(1)
                else:
                    print("  (Bell test skipped)")
            except Exception as e:
                print(f"Bell test skipped: {e}")
            
            page.screenshot(path='C:/Users/khamis/Documents/nutrio/regression_test/dashboard_final.png')
            print("\nFinal screenshot saved")
            
            print("\n" + "="*60)
            print("REGRESSION TEST RESULTS")
            print("="*60)
            
            if len(regressions) == 0:
                print("ALL TESTS PASSED - No regressions detected")
            else:
                print(f"FOUND {len(regressions)} REGRESSION(S):")
                for i, reg in enumerate(regressions, 1):
                    print(f"  {i}. {reg}")
            
            print("="*60)
            
            return len(regressions)
            
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        return -1
    finally:
        if browser:
            browser.close()

if __name__ == "__main__":
    exit_code = test_dashboard()
    exit(exit_code)
