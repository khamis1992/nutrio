"""Detailed page rendering investigation"""
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:4173"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
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
    
    print("\n2. Check admin pages rendering...")
    
    pages = [
        ("/admin", "Admin Home"),
        ("/admin/users", "Admin Users"),
        ("/admin/restaurants", "Admin Restaurants"),
        ("/admin/orders", "Admin Orders"),
        ("/admin/drivers", "Admin Drivers"),
    ]
    
    for path, name in pages:
        print(f"\n   Testing {name} ({path})...")
        page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
        
        # Wait for React to render
        page.wait_for_timeout(5000)
        
        # Check root element content
        root_html = page.evaluate("() => document.getElementById('root')?.innerHTML?.length || 0")
        print(f"   Root HTML length: {root_html}")
        
        # Check for specific elements
        buttons = page.locator('button').all()
        links = page.locator('a').all()
        inputs = page.locator('input').all()
        divs = page.locator('div').all()
        
        print(f"   Elements: {len(buttons)} buttons, {len(links)} links, {len(inputs)} inputs, {len(divs)} divs")
        
        # Try to get some link text
        if links:
            link_texts = [l.inner_text().strip()[:30] for l in links[:5] if l.inner_text().strip()]
            print(f"   Sample links: {link_texts}")
    
    print("\n3. Check if SPA routing is working...")
    
    # Navigate to admin home
    page.goto(f"{BASE_URL}/admin", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    print(f"   Current URL: {page.url}")
    
    # Click on users link if it exists
    users_link = page.locator('a:has-text("Users")')
    if users_link.count() > 0:
        print(f"   Found Users link, clicking...")
        users_link.first.click()
        page.wait_for_timeout(3000)
        print(f"   After click URL: {page.url}")
    else:
        print("   No Users link found")
    
    browser.close()
