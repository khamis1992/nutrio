from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173/nutrio/meals')
    page.wait_for_load_state('networkidle')
    
    # Find the search input
    search_input = page.locator('input[placeholder*="Search"]')
    print('Search input count:', search_input.count())
    if search_input.count() > 0:
        print('Placeholder:', search_input.get_attribute('placeholder'))
        print('Value:', search_input.input_value())
    
    # Also check for any input in the page
    all_inputs = page.locator('input').all()
    print('\nAll inputs on page:')
    for inp in all_inputs:
        placeholder = inp.get_attribute('placeholder')
        if placeholder:
            print(' - placeholder:', placeholder)
    
    browser.close()
