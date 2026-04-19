import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.on('console', lambda msg: print(f"[{msg.type}] {msg.text}"))
    page.goto('http://localhost:5173/nutrio/dashboard')
    page.wait_for_load_state('networkidle')
    time.sleep(5)
    
    browser.close()
