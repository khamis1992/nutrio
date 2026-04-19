from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173/nutrio/meals')
    page.wait_for_load_state('networkidle')
    
    # Try to find ANY input
    all_inputs = page.locator('input').all()
    print('Total inputs:', len(all_inputs))
    for i, inp in enumerate(all_inputs):
        placeholder = inp.get_attribute('placeholder')
        print(f'Input {i}: placeholder={repr(placeholder)}')
    
    # Try screenshot to see what's on screen
    page.screenshot(path='C:/Users/khamis/Documents/nutrio/search_screenshot.png')
    print('\nScreenshot saved to search_screenshot.png')
    
    browser.close()
