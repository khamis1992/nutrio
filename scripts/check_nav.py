#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def debug_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        # Get all nav elements
        navs = page.locator('nav').all()
        print(f"Found {len(navs)} nav elements")
        for i, nav in enumerate(navs):
            print(f"  Nav {i+1}:")
            print(f"    class: {nav.get_attribute('class')}")
            print(f"    style: {nav.get_attribute('style')}")
        
        # Check for outlet container
        outlet = page.locator('.min-h-screen').first
        if outlet.count() > 0:
            print("Found CustomerLayout container")
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
