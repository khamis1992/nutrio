from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    
    # Navigate to the meal detail page
    page.goto('http://localhost:8080/meals/6ea47018-5400-4c29-80e6-257eb6d2e45e')
    
    # Wait for page to fully load
    page.wait_for_load_state('networkidle')
    time.sleep(2)  # Additional wait for animations
    
    # Take full page screenshot
    page.screenshot(path='C:\\Users\\khamis\\Documents\\nutrio-fuel-new\\meal_detail_analysis.png', full_page=True)
    
    # Get page dimensions and scroll position
    dimensions = page.evaluate('''() => {
        return {
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
        }
    }''')
    
    print("Page Dimensions:")
    print(f"  Scroll Width: {dimensions['width']}px")
    print(f"  Scroll Height: {dimensions['height']}px")
    print(f"  Viewport Width: {dimensions['viewportWidth']}px")
    print(f"  Viewport Height: {dimensions['viewportHeight']}px")
    
    # Analyze fixed elements (buttons, nav bars, etc.)
    fixed_elements = page.locator('[style*="fixed"], .fixed, [class*="fixed"]').all()
    print(f"\nFixed Position Elements Found: {len(fixed_elements)}")
    
    for i, elem in enumerate(fixed_elements[:10]):  # Limit to first 10
        try:
            bbox = elem.bounding_box()
            if bbox:
                print(f"  Element {i+1}: position=({bbox['x']:.0f}, {bbox['y']:.0f}), size=({bbox['width']:.0f}x{bbox['height']:.0f})")
        except:
            pass
    
    # Check for bottom nav/dock
    bottom_elements = page.locator('[class*="bottom"], [style*="bottom:"]').all()
    print(f"\nBottom-positioned Elements: {len(bottom_elements)}")
    
    # Get all buttons on the page
    buttons = page.locator('button').all()
    print(f"\nTotal Buttons: {len(buttons)}")
    
    for i, btn in enumerate(buttons):
        try:
            text = btn.inner_text().strip()[:30]  # First 30 chars
            bbox = btn.bounding_box()
            if bbox:
                print(f"  Button {i+1}: '{text}' at ({bbox['x']:.0f}, {bbox['y']:.0f})")
        except:
            pass
    
    browser.close()
    print("\n✓ Screenshot saved to: meal_detail_analysis.png")
