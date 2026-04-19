"""Debug driver registration"""
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:4173"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    
    console_messages = []
    page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))
    
    print("1. Navigate to driver auth page...")
    page.goto(f"{BASE_URL}/driver/auth", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    
    print("\n2. Check current state...")
    print(f"   URL: {page.url}")
    
    # List all buttons
    print("\n   Buttons:")
    for btn in page.locator('button').all():
        try:
            text = btn.inner_text().strip()
            print(f"   - '{text}'")
        except:
            pass
    
    # List all inputs
    print("\n   Inputs:")
    for inp in page.locator('input').all():
        try:
            inp_id = inp.get_attribute('id')
            inp_type = inp.get_attribute('type')
            print(f"   - id={inp_id}, type={inp_type}")
        except:
            pass
    
    print("\n3. Click 'Become a Driver' toggle if exists...")
    become_driver = page.locator('button:has-text("Become a Driver")')
    if become_driver.count() > 0:
        become_driver.first.click()
        page.wait_for_timeout(2000)
        print("   Clicked 'Become a Driver'")
    
    print("\n4. Fill form with new unique email...")
    unique_email = f"driver{int(time.time())}@nutriofuel.com"
    print(f"   Using email: {unique_email}")
    
    # Try to find form fields
    fullname_input = page.locator('input[id="fullName"], input[placeholder*="Name"]')
    phone_input = page.locator('input[type="tel"]')
    email_input = page.locator('input[type="email"]')
    password_input = page.locator('input[type="password"]')
    
    if fullname_input.count() > 0:
        fullname_input.first.fill("Test Driver")
        print("   Filled fullName")
    else:
        print("   No fullName input found")
    
    if phone_input.count() > 0:
        phone_input.first.fill("+97412345678")
        print("   Filled phone")
    
    if email_input.count() > 0:
        email_input.first.fill(unique_email)
        print("   Filled email")
    
    if password_input.count() > 0:
        password_input.first.fill("123456789")
        print("   Filled password")
    
    page.wait_for_timeout(1000)
    
    print("\n5. Submit form...")
    submit = page.locator('button[type="submit"]')
    if submit.count() > 0:
        submit.first.click()
        print("   Clicked submit")
    else:
        print("   No submit button found!")
    
    print("\n6. Wait for response...")
    page.wait_for_timeout(8000)
    
    print(f"\n   Final URL: {page.url}")
    
    print("\n7. Console messages:")
    for msg in console_messages[:10]:
        print(f"   {msg}")
    
    browser.close()
