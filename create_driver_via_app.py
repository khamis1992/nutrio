"""Create driver account via the app's registration flow"""
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:4173"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    
    print("1. Navigate to driver auth page...")
    page.goto(f"{BASE_URL}/driver/auth", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    
    print("2. Check for registration toggle...")
    # Look for "Don't have a driver account? Register now" link
    register_link = page.locator('button:has-text("Register now"), button:has-text("register now")')
    if register_link.count() > 0:
        register_link.first.click()
        page.wait_for_timeout(2000)
        print("   Toggled to registration mode")
    else:
        print("   Already on registration mode")
    
    print("3. Fill registration form...")
    # The registration form has: fullName, phone, email, password
    page.locator('#fullName').fill("Test Driver")
    page.locator('input[type="tel"]').fill("+97412345678")
    page.locator('#email').fill("driver@nutriofuel.com")
    page.locator('#password').fill("123456789")
    
    page.wait_for_timeout(1000)
    
    print("4. Submit registration...")
    submit_btn = page.locator('button[type="submit"]')
    submit_btn.first.click()
    
    print("5. Wait for response...")
    page.wait_for_timeout(8000)
    
    print(f"   Final URL: {page.url}")
    
    # Check if redirected to onboarding (expected) or error
    if "onboarding" in page.url:
        print("   [SUCCESS] Redirected to onboarding!")
    elif "register" in page.url:
        print("   [WARN] Still on register page - may have error")
    else:
        print(f"   [INFO] Redirected to: {page.url}")
    
    # Check for error messages
    error_toast = page.locator('[class*="toast"], [class*="destructive"]')
    if error_toast.count() > 0:
        print(f"   Error displayed: {error_toast.first.inner_text()}")
    
    browser.close()
    print("\nDone!")
