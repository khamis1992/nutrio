#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def debug_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        page.screenshot(path='C:/Users/khamis/Documents/nutrio/regression_test/dashboard_debug.png')
        print("Screenshot saved")
        
        nav_locator = page.locator('nav').first
        if nav_locator.count() > 0:
            print("Found nav element")
            links = page.locator('nav a').all()
            print(f"Found {len(links)} nav links")
            for i, link in enumerate(links[:5]):
                href = link.get_attribute('href')
                print(f"  Link {i+1}: {href}")
        else:
            print("No nav element found")
        
        bottom_tabs = page.locator('[class*="bottom-tab"]').first
        if bottom_tabs.count() > 0:
            print("Found bottom-tab wrapper")
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
