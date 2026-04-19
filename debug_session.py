"""Debug session persistence"""
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
    
    # Check localStorage for Supabase session
    print("\n2. Check localStorage for session...")
    session_data = page.evaluate("() => localStorage.getItem('supabase-auth-token')")
    if session_data:
        print(f"   Session found in localStorage: {len(session_data)} chars")
    else:
        print("   No session found in localStorage!")
    
    print("\n3. Try to get session directly...")
    page.evaluate("""
        async () => {
            const supabase = window.__SUPABASE_CLIENT__;
            if (supabase) {
                const { data } = await supabase.auth.getSession();
                console.log('Session:', JSON.stringify(data));
            } else {
                console.log('No supabase client found');
            }
        }
    """)
    page.wait_for_timeout(2000)
    
    print("\n4. Do full page reload and check...")
    page.reload()
    page.wait_for_timeout(8000)
    print(f"   After reload URL: {page.url}")
    
    root_html = page.evaluate("() => document.getElementById('root')?.innerHTML?.length || 0")
    print(f"   Root HTML length: {root_html}")
    
    print("\n5. Check localStorage after reload...")
    session_data_after = page.evaluate("() => localStorage.getItem('supabase-auth-token')")
    if session_data_after:
        print(f"   Session still in localStorage: {len(session_data_after)} chars")
    else:
        print("   Session LOST after reload!")
    
    browser.close()
