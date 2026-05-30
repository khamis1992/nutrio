from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 430, "height": 932})
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto("http://localhost:5173/nutrio/schedule", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=30000)
    time.sleep(3)
    print(f"Current URL: {page.url}")
    if "/auth" in page.url:
        print("Login required. Trying selectors...")
        for sel in ['input[type="email"]', 'input[name="email"]', '#email', '[data-testid="email-input"]', 'input[placeholder*="mail"]', 'input[placeholder*="Email"]', 'input']:
            c = page.locator(sel).count()
            if c:
                print(f"  {sel}: {c}")
                page.fill(sel, "eng.aljabor@gmail.com")
                print(f"  -> filled {sel}")
                break
        for sel in ['input[type="password"]', 'input[name="password"]', '#password', 'input[placeholder*="pass"]', 'input[placeholder*="Pass"]']:
            c = page.locator(sel).count()
            if c:
                print(f"  {sel}: {c}")
                page.fill(sel, "123456789")
                print(f"  -> filled {sel}")
                break
        for sel in ['button:has-text("Sign In")', 'button:has-text("Login")', 'button[type="submit"]', 'button']:
            c = page.locator(sel).count()
            if c:
                print(f"  clicking {sel}")
                page.locator(sel).first.click()
                break
        page.wait_for_load_state("networkidle", timeout=30000)
        time.sleep(3)
        print(f"After login URL: {page.url}")
    page.screenshot(path="schedule-final-verify.png", full_page=True)
    print("Screenshot saved: schedule-final-verify.png")
    print(f"JS errors: {len(errors)}")
    for e in errors:
        print(f"  - {e}")
    browser.close()
