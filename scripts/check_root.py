from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.goto('http://localhost:5173/nutrio/dashboard')
    page.wait_for_load_state('networkidle')
    
    root = page.locator('#root').first
    if root.count() > 0:
        html = root.inner_html()
        # Find all classes
        import re
        classes = re.findall(r'class="(.*?)"', html)
        print("Classes found in root:")
        for cls in set(classes):
            print(f"  {cls}")
        
        # Find all divs
        divs = re.findall(r'<div([^>]*?)>', html)
        print(f"\nTotal divs in root: {len(divs)}")
        
    browser.close()
