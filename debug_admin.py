"""Debug admin portal after login"""
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:4173"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    
    print("1. Navigate to auth...")
    page.goto(f"{BASE_URL}/auth", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    
    print("2. Click Sign in button...")
    signin_btn = page.locator('button:has-text("Sign in")')
    if signin_btn.count() > 0:
        signin_btn.first.click()
        page.wait_for_timeout(2000)
    
    print("3. Fill and submit...")
    page.locator('#si-email').fill("khamis-1992@hotmail.com")
    page.locator('#si-password').fill("Khamees1992#")
    page.locator('button:has-text("Sign in"):not(:has-text("up"))').first.click()
    
    print("4. Wait for navigation...")
    page.wait_for_timeout(8000)
    
    print(f"\n5. URL after login: {page.url}")
    print(f"   Title: {page.title()}")
    
    print("\n6. Check root element...")
    root_html = page.evaluate("() => document.getElementById('root')?.innerHTML?.substring(0, 1000)")
    print(f"   Root HTML length: {len(root_html) if root_html else 0}")
    if root_html:
        print(f"   First 500 chars: {root_html[:500]}")
    
    print("\n7. Check all buttons...")
    buttons = page.locator('button').all()
    print(f"   Found {len(buttons)} buttons")
    for btn in buttons[:5]:
        try:
            text = btn.inner_text().strip()
            print(f"   - '{text}'")
        except:
            print("   - (no text)")
    
    browser.close()
