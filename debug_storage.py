"""Debug session storage"""
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
    
    print("\n2. Check ALL storage for session...")
    
    # Check localStorage
    local_keys = page.evaluate("() => Object.keys(localStorage).join(', ')")
    print(f"   localStorage keys: {local_keys}")
    
    # Check sessionStorage
    session_keys = page.evaluate("() => Object.keys(sessionStorage).join(', ')")
    print(f"   sessionStorage keys: {session_keys}")
    
    # Check cookies
    cookies = page.context.cookies()
    print(f"   Cookies: {[c['name'] for c in cookies]}")
    
    # Get supabase session from JS
    session = page.evaluate("() => JSON.stringify(localStorage).substring(0, 500)")
    print(f"   localStorage content (first 500): {session}")
    
    print("\n3. Now test page.goto() to protected route (fresh navigation)...")
    page2 = context.new_page()  # NEW page in same context
    
    page2.goto(f"{BASE_URL}/admin/users", wait_until="domcontentloaded")
    page2.wait_for_timeout(8000)
    
    print(f"   page2 URL: {page2.url}")
    root_html = page2.evaluate("() => document.getElementById('root')?.innerHTML?.length || 0")
    print(f"   page2 Root HTML length: {root_html}")
    
    # Check storage in page2
    local_keys2 = page2.evaluate("() => Object.keys(localStorage).join(', ')")
    print(f"   page2 localStorage keys: {local_keys2}")
    
    print("\n4. Check if there's a redirect happening...")
    page3 = context.new_page()  # Another new page
    
    page3.goto(f"{BASE_URL}/admin/users", wait_until="domcontentloaded")
    page3.wait_for_timeout(5000)
    print(f"   page3 URL: {page3.url}")
    
    browser.close()
