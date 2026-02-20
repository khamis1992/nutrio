from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    
    # Try with stored session if any
    page.goto('http://localhost:8080/admin', timeout=30000)
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(2000)
    
    print(f"URL: {page.url}")
    
    # Get all visible text
    text_content = page.locator('body').inner_text()
    print("\nVisible text on page:")
    print("-" * 60)
    
    # Look for "0" specifically
    lines = text_content.split('\n')
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if line_stripped and ('0' in line_stripped or 'zero' in line_stripped.lower()):
            print(f"Line {i}: {line_stripped[:100]}")
    
    # Check for stats patterns
    print("\n" + "-" * 60)
    print("Checking for stats patterns:")
    
    stats_patterns = [
        'Active Restaurants',
        'Total Users', 
        'Today',
        'Orders',
        'Revenue',
        'Pending'
    ]
    
    for pattern in stats_patterns:
        elements = page.locator(f'text=/{pattern}/i').all()
        if elements:
            for el in elements[:2]:
                try:
                    text = el.inner_text()
                    print(f"  Found: {text[:80]}")
                except:
                    pass
    
    # Screenshot
    page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/what_you_see.png', full_page=True)
    print("\nScreenshot saved: what_you_see.png")
    
    browser.close()
