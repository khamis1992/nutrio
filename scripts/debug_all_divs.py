#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def debug_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(5)
        
        # Check ALL divs in the page
        all_divs = page.locator('div').all()
        print(f"Total divs: {len(all_divs)}")
        
        # Find div with class containing 'min-h'
        for div in all_divs:
            cls = div.get_attribute('class')
            if cls and 'min-h' in cls:
                print(f"Found div with min-h class: {cls[:50]}...")
                print(f"  data-testid: {div.get_attribute('data-testid')}")
                break
        else:
            print("NO div with min-h class found")
        
        # Check for any data-testid
        test_ids = []
        for div in all_divs:
            tid = div.get_attribute('data-testid')
            if tid:
                test_ids.append(tid)
        print(f"All data-testid: {test_ids[:10]}")
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
