#!/usr/bin/env python3
"""
Test the Nutrio dashboard using Playwright.
This script is designed to be run with the dev server already running.
"""
import subprocess
import time
import sys
from playwright.sync_api import sync_playwright, expect

def run_tests():
    # Start dev server in background
    print("Starting dev server...")
    server_proc = subprocess.Popen(
        ["cmd", "/c", "npm", "run", "dev"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=r"C:\Users\khamis\Documents\nutrio",
        shell=True
    )
    
    print("Waiting for server to start...")
    time.sleep(8)
    
    regressions = []
    browser = None
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            print("Navigating to dashboard...")
            page.goto('http://localhost:5173/nutrio/dashboard')
            page.wait_for_load_state('networkidle')
            time.sleep(3)
            
            page.screenshot(path='C:/Users/khamis/Documents/nutrio/regression_test/dashboard_test.png')
            print("Dashboard loaded")
            
            # Test 1: Bottom tab bar
            bottom_nav = page.locator('[data-testid="bottom-tab-bar"]').first
            if bottom_nav.count() > 0:
                print("✓ Bottom tab bar visible")
            else:
                regressions.append("CRITICAL: Bottom tab bar not visible")
                print("✗ Bottom tab bar MISSING")
            
            # Test 2: User avatar
            avatar = page.locator('[data-testid="user-avatar-image"]').first
            if avatar.count() > 0:
                print("✓ User avatar visible")
            else:
                regressions.append("Header: User avatar not visible")
                print("✗ User avatar MISSING")
            
            # Test 3: Log Meal button
            log_meal = page.locator('[data-testid="log-meal-button"]').first
            if log_meal.count() > 0:
                print("✓ Log Meal button visible")
            else:
                regressions.append("Button: Log Meal button missing")
                print("✗ Log Meal button MISSING")
            
            # Test 4: Tracker quick action
            tracker = page.locator('[data-testid="quick-action-tracker"]').first
            if tracker.count() > 0:
                print("✓ Tracker quick action visible")
            else:
                regressions.append("Quick Action: Tracker link missing")
                print("✗ Tracker MISSING")
            
            # Test 5: Navigation links
            nav_links = page.locator('[data-testid="bottom-tab-bar"] a').all()
            print(f"Found {len(nav_links)} nav links")
            
            # Test 6: Quick actions grid
            quick_actions = page.locator('[data-testid="quick-actions-grid"] a').all()
            print(f"Found {len(quick_actions)} quick actions")
            
            print("\n" + "="*60)
            if len(regressions) == 0:
                print("ALL TESTS PASSED - No regressions detected")
            else:
                print(f"FOUND {len(regressions)} REGRESSION(S):")
                for reg in regressions:
                    print(f"  - {reg}")
            print("="*60)
            
            return len(regressions)
            
    except Exception as e:
        print(f"ERROR: {e}")
        return -1
    finally:
        if browser:
            browser.close()
        server_proc.terminate()

if __name__ == "__main__":
    exit(run_tests())
