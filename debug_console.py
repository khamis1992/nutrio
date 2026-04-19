"""Debug console errors on new page"""
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:4173"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    
    console_messages = []
    page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))
    
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
    
    print("\n2. Open fresh page to admin/users and capture console...")
    page2 = context.new_page()
    
    # Capture console from page2
    page2_console = []
    page2.on("console", lambda msg: page2_console.append(f"[{msg.type}] {msg.text}"))
    page2.on("pageerror", lambda err: page2_console.append(f"[PAGE ERROR] {err}"))
    
    page2.goto(f"{BASE_URL}/admin/users", wait_until="domcontentloaded")
    page2.wait_for_timeout(10000)
    
    print(f"   page2 URL: {page2.url}")
    
    print(f"\n3. Console messages from page2 ({len(page2_console)} messages):")
    for msg in page2_console[:20]:
        print(f"   {msg}")
    
    browser.close()
