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
        
        # Check for customer layout
        layout = page.locator('[data-testid="customer-layout"]').first
        if layout.count() > 0:
            print("CustomerLayout found!")
            print(f"  Child divs: {layout.locator('div').count()}")
        else:
            print("CustomerLayout NOT found - React components may not be rendering")
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
