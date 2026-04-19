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
        
        # Get full page content
        html = page.content()
        
        # Check for customer layout
        if 'customer-layout' in html:
            print("customer-layout FOUND in HTML!")
        else:
            print("customer-layout NOT in HTML")
        
        # Check for bottom-tab-bar
        if 'bottom-tab-bar' in html:
            print("bottom-tab-bar FOUND in HTML!")
        else:
            print("bottom-tab-bar NOT in HTML")
        
        # Check for log-meal-button
        if 'log-meal-button' in html:
            print("log-meal-button FOUND in HTML!")
        else:
            print("log-meal-button NOT in HTML")
        
        # Check for nav
        if '<nav' in html:
            print("nav tag FOUND in HTML!")
        else:
            print("nav tag NOT in HTML")
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
