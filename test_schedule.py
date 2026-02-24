from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Capture console logs
    logs = []
    page.on("console", lambda msg: logs.append(f"{msg.type}: {msg.text}"))
    
    # Capture errors
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    
    print("Navigating to /schedule...")
    page.goto('http://localhost:8080/schedule')
    page.wait_for_load_state('networkidle', timeout=10000)
    
    # Wait a bit more for any async loading
    page.wait_for_timeout(2000)
    
    # Take screenshot
    page.screenshot(path='schedule_debug.png', full_page=True)
    print("Screenshot saved to schedule_debug.png")
    
    # Get current URL
    print(f"\nCurrent URL: {page.url}")
    
    # Print console logs
    if logs:
        print("\n--- Console Logs ---")
        for log in logs:
            print(log)
    
    # Print errors
    if errors:
        print("\n--- JavaScript Errors ---")
        for err in errors:
            print(err)
    
    # Get page title
    title = page.title()
    print(f"\nPage title: {title}")
    
    # Check if redirected to auth page
    if '/auth' in page.url:
        print("\n⚠️  Page redirected to /auth - user needs to be logged in")
    elif '404' in title.lower() or page.locator('text=404').count() > 0:
        print("\n⚠️  Page not found (404)")
    else:
        print("\n✓ Page loaded successfully")
    
    browser.close()
