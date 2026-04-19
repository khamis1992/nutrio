#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright

def debug_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console messages
        page.on('console', lambda msg: print(f"[{msg.type}] {msg.text}"))
        
        # Capture response statuses
        page.on('response', lambda resp: 
            print(f"Response: {resp.status} {resp.url}") if not resp.ok else None)
        
        page.goto('http://localhost:5173/nutrio/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(5)
        
        browser.close()

if __name__ == "__main__":
    debug_dashboard()
