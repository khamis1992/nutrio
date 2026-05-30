from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 430, "height": 932})
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto("http://localhost:5173/nutrio/schedule", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=30000)
    time.sleep(2)
    
    if page.locator('button:has-text("Sign In")').count() > 0:
        page.locator('button:has-text("Sign In")').first.click()
        print("Clicked Sign In")
        time.sleep(2)
        inputs = page.locator("input").all()
        for i, inp in enumerate(inputs):
            attrs = inp.evaluate("el => ({type: el.type, placeholder: el.placeholder})")
            print(f"  Input {i}: {attrs}")
        if len(inputs) > 0:
            inputs[0].fill("eng.aljabor@gmail.com")
            print("Filled email")
        if len(inputs) > 1:
            inputs[1].fill("123456789")
            print("Filled password")
        time.sleep(1)
        buttons = page.locator("button").all()
        for b in buttons:
            try:
                txt = b.inner_text()
                if txt in ["Sign In", "Login", "Submit"]:
                    b.click()
                    print(f"Clicked: {txt}")
                    break
            except:
                pass
        time.sleep(5)
    
    print(f"Final URL: {page.url}")
    page.screenshot(path="schedule-final-verify.png", full_page=True)
    print("Screenshot saved")
    print(f"JS errors: {len(errors)}")
    browser.close()
