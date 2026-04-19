#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def debug_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("Navigating to dashboard...")
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        html = page.content()
        with open('C:/Users/khamis/Documents/nutrio/regression_test/debug.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print("HTML saved. Check for bottom-tab-bar and other test IDs")
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
