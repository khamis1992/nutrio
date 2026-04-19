"""Debug what's happening on new page"""
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
    
    print("\n2. Now open a fresh page and navigate to protected route...")
    page2 = context.new_page()
    
    # Check localStorage in the context before navigation
    print(f"   Context storage state: {page2.context.storage_state()}")
    
    page2.goto(f"{BASE_URL}/admin/users", wait_until="domcontentloaded")
    page2.wait_for_timeout(5000)
    
    print(f"   page2 URL: {page2.url}")
    
    # Get the root HTML
    root_html = page2.evaluate("() => document.getElementById('root')?.innerHTML?.substring(0, 500)")
    print(f"   Root HTML (first 500 chars): {root_html}")
    
    # Check what's in the body
    body_html = page2.evaluate("() => document.body?.innerHTML?.substring(0, 500)")
    print(f"   Body HTML (first 500 chars): {body_html}")
    
    # Wait longer and check again
    page2.wait_for_timeout(10000)
    root_html2 = page2.evaluate("() => document.getElementById('root')?.innerHTML?.length || 0")
    print(f"\n   After 10s wait - Root HTML length: {root_html2}")
    
    browser.close()
