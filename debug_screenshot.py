"""Take screenshot of page2"""
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:4173"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    
    print("1. Login as admin...")
    page.goto(f"{BASE_URL}/auth", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    
    page.locator('button:has-text("Sign in")').first.click()
    page.wait_for_timeout(3000)
    
    page.locator('#si-email').fill("khamis-1992@hotmail.com")
    page.locator('#si-password').fill("Khamees1992#")
    page.locator('button:has-text("Sign in"):not(:has-text("up"))').first.click()
    page.wait_for_timeout(8000)
    
    print(f"   Logged in, URL: {page.url}")
    
    print("\n2. Open fresh page to admin/users...")
    page2 = context.new_page()
    
    page2.goto(f"{BASE_URL}/admin/users", wait_until="domcontentloaded")
    page2.wait_for_timeout(5000)
    
    print(f"   page2 URL: {page2.url}")
    
    # Take screenshot
    page2.screenshot(path="page2_screenshot.png", full_page=True)
    print("   Screenshot saved to page2_screenshot.png")
    
    # Get page content
    title = page2.title()
    print(f"   Page title: {title}")
    
    # Get visible text
    body_text = page2.locator("body").inner_text()
    print(f"   Body text (first 200): {body_text[:200]}")
    
    browser.close()
