from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 430, "height": 932})
    
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    
    print("Navigating to /nutrio/schedule...")
    page.goto("http://localhost:5173/nutrio/schedule", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=30000)
    time.sleep(2)
    
    # Handle auth redirect
    if "/auth" in page.url or page.locator('input[type="email"]').count() > 0:
        print("Login required — logging in...")
        page.fill('input[type="email"]', "eng.aljabor@gmail.com")
        page.fill('input[type="password"]', "123456789")
        page.locator('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]').first.click()
        page.wait_for_load_state("networkidle", timeout=30000)
        time.sleep(3)
    
    print(f"Current URL: {page.url}")
    
    # Take screenshot
    page.screenshot(path="schedule-final-verify.png", full_page=True)
    print("Screenshot saved: schedule-final-verify.png")
    
    # Print errors
    print(f"\nJS errors: {len(errors)}")
    for e in errors:
        print(f"  - {e}")
    
    browser.close()
