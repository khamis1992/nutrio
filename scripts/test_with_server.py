from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Navigate to dashboard
    page.goto('http://localhost:5173/nutrio/dashboard')
    page.wait_for_load_state('networkidle')
    
    # Take screenshot for inspection
    page.screenshot(path='C:/Users/khamis/Documents/nutrio/regression_test/test.png')
    print("Screenshot saved")
    
    # Count elements
    all_divs = page.locator('div').all()
    print(f"Total divs: {len(all_divs)}")
    
    # Check for data-testid
    all_testids = page.locator('[data-testid]').all()
    print(f"Elements with data-testid: {len(all_testids)}")
    for el in all_testids:
        tid = el.get_attribute('data-testid')
        print(f"  - {tid}")
    
    browser.close()
