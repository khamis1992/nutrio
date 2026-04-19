import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Wait for server to be ready
    print("Waiting for server...")
    retry = 0
    while retry < 10:
        try:
            page.goto('http://localhost:5173/nutrio/dashboard', wait_until='domcontentloaded', timeout=5000)
            break
        except:
            print(f"Waiting for server... retry {retry}")
            retry += 1
            time.sleep(2)
    
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    page.screenshot(path='C:/Users/khamis/Documents/nutrio/regression_test/test_manual.png')
    print("Screenshot saved")
    
    # Check for elements
    all_divs = page.locator('div').all()
    print(f"Total divs: {len(all_divs)}")
    
    all_testids = page.locator('[data-testid]').all()
    print(f"Data-testid elements: {len(all_testids)}")
    for el in all_testids:
        print(f"  - {el.get_attribute('data-testid')}")
    
    # Check for nav
    navs = page.locator('nav').all()
    print(f"Nav elements: {len(navs)}")
    
    browser.close()
