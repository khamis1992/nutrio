"""Quick verification of direct navigation fix"""
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:4173"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
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
    
    print("\n2. Test direct navigation to protected routes...")
    
    routes_to_test = [
        "/admin/users",
        "/admin/restaurants", 
        "/admin/orders",
        "/admin/drivers",
        "/dashboard",
        "/partner",
        "/driver",
        "/fleet"
    ]
    
    for route in routes_to_test:
        page2 = context.new_page()
        page2.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
        page2.wait_for_timeout(3000)
        
        root_html = page2.evaluate("() => document.getElementById('root')?.innerHTML?.length || 0")
        url = page2.url
        
        if root_html > 1000:
            print(f"   [PASS] {route} - rendered ({root_html} chars)")
        else:
            print(f"   [WARN] {route} - low content ({root_html} chars) at {url}")
        
        page2.close()
    
    print("\n3. Test clicking internal links...")
    page.goto(f"{BASE_URL}/admin", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    
    users_link = page.locator('a:has-text("Users")')
    if users_link.count() > 0:
        users_link.first.click()
        page.wait_for_timeout(3000)
        print(f"   [PASS] Clicked Users link, now at: {page.url}")
    
    browser.close()
    print("\nDone!")
