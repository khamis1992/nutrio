#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def debug_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture all page errors
        page.on('pageerror', lambda e: print(f"PAGE ERROR: {e}"))
        
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(5)
        
        # Check if document is fully loaded
        print("Document ready state:", page.evaluate("document.readyState"))
        
        # Try to find any elements
        all_divs = page.locator('div').count()
        print(f"Total divs in document: {all_divs}")
        
        # Check for body content
        body_text = page.locator('body').inner_text()
        print(f"Body text length: {len(body_text)}")
        
        # Check specific data-testid
        test_ids = page.locator('[data-testid]').count()
        print(f"Elements with data-testid: {test_ids}")
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
