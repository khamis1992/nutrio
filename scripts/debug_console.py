#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def debug_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console logs
        def handle_console(msg):
            print(f"Console: {msg.type}: {msg.text}")
        
        page.on('console', handle_console)
        
        print("Navigating to dashboard...")
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
