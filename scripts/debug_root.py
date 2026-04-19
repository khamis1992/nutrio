#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def debug_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        page.on('pageerror', lambda e: print(f"PAGE ERROR: {e}"))
        
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('domcontentloaded')
        
        # Wait longer for React to render
        time.sleep(10)
        
        # Take screenshot
        page.screenshot(path='C:/Users/khamis/Documents/nutrio/regression_test/after_load.png')
        
        # Check for root div
        root = page.locator('#root').first
        if root.count() > 0:
            content = root.inner_html()
            print("Root content length:", len(content))
            if len(content) > 0:
                print("Root has content!")
                print(content[:500])
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
