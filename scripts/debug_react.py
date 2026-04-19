#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def debug_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('domcontentloaded')
        time.sleep(5)
        
        # Get errors
        errors = page.evaluate("() => window.__errors || []")
        print("Errors:", errors)
        
        # Try evaluating to see if React is working
        result = page.evaluate("() => document.querySelector('.min-h-screen')")
        if result:
            print("Found .min-h-screen")
        else:
            print("No .min-h-screen found - React not rendering")
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
