from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:8080/auth")
    page.wait_for_timeout(3000)
    page.screenshot(path="debug_auth.png")
    
    # Try clicking sign in
    btns = page.locator("button").all()
    for b in btns:
        if "sign" in b.inner_text().lower() or "log" in b.inner_text().lower():
            b.click()
            break
            
    page.wait_for_timeout(2000)
    page.screenshot(path="debug_auth_after_click.png")
    
    # Check inputs
    print("Inputs:")
    for inp in page.locator("input").all():
        print(inp.get_attribute("id"), inp.get_attribute("type"))
        
    browser.close()