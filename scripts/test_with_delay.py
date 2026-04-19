#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def test_with_delay():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        print("Navigating to dashboard...")
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(5)
        
        page.screenshot(path='C:/Users/khamis/Documents/nutrio/regression_test/test_final.png')
        print("Screenshot saved")
        
        bottom_nav = page.locator('[data-testid="bottom-tab-bar"]').first
        if bottom_nav.count() > 0:
            print("Bottom tab bar found!")
            links = page.locator('[data-testid="bottom-tab-bar"] a').all()
            print(f"Found {len(links)} nav links")
        else:
            print("Bottom tab bar NOT found")
        
        avatar = page.locator('[data-testid="user-avatar-image"]').first
        if avatar.count() > 0:
            print("Avatar found")
        else:
            print("Avatar NOT found")
        
        log_meal = page.locator('[data-testid="log-meal-button"]').first
        if log_meal.count() > 0:
            print("Log Meal button found")
        else:
            print("Log Meal button NOT found")
        
        tracker = page.locator('[data-testid="quick-action-tracker"]').first
        if tracker.count() > 0:
            print("Tracker link found")
        else:
            print("Tracker link NOT found")
        
        browser.close()

if __name__ == "__main__":
    test_with_delay()
