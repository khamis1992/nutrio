import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.goto('http://localhost:5173/nutrio/dashboard')
    page.wait_for_load_state('networkidle')
    time.sleep(5)
    
    # Save full HTML
    full_html = page.content()
    with open('C:/Users/khamis/Documents/nutrio/regression_test/full_html.html', 'w', encoding='utf-8') as f:
        f.write(full_html)
    
    print(f"Saved HTML ({len(full_html)} chars)")
    
    # Check root div
    root = page.locator('#root').first
    if root.count() > 0:
        root_html = root.inner_html()
        print(f"Root has content: {len(root_html)} chars")
        if 'bottom-tab-bar' in root_html:
            print("bottom-tab-bar FOUND in root")
        else:
            print("bottom-tab-bar NOT found in root")
    
    browser.close()
