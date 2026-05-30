from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 430, "height": 932})
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto("http://localhost:5173/nutrio/schedule", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=30000)
    time.sleep(2)
    
    if page.locator('button:has-text("Sign In")').count() > 0:
        page.locator('button:has-text("Sign In")').first.click()
        time.sleep(2)
        page.locator('input[placeholder="Email"]').fill("eng.aljabor@gmail.com")
        page.locator('input[placeholder="Password"]').fill("123456789")
        time.sleep(0.5)
        # Click the Sign In button that's inside the form (not the landing page one)
        page.locator('button:has-text("Sign In")').last.click()
        time.sleep(6)
    
    print(f"URL: {page.url}")
    # Dump visible text to check for errors
    txt = page.inner_text("body")[:2000]
    print("Body text:", txt)
    page.screenshot(path="schedule-final-verify.png", full_page=True)
    print("Screenshot saved")
    browser.close()
