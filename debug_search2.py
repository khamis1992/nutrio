from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173/nutrio/meals')
    page.wait_for_load_state('networkidle')
    
    # Find the search input and get details
    search_input = page.locator('input[placeholder*="search"]')
    print('Search input count:', search_input.count())
    if search_input.count() > 0:
        print('Placeholder:', repr(search_input.get_attribute('placeholder')))
        print('Value:', repr(search_input.input_value()))
    
    # Take screenshot
    page.screenshot(path='C:/Users/khamis/Documents/nutrio/search_screenshot.png', full_page=True)
    print('\nScreenshot saved')
    
    # Get the outer HTML of the search input's parent
    if search_input.count() > 0:
        parent = search_input.locator("..").locator("..")
        print('\nParent structure:')
    
    browser.close()
