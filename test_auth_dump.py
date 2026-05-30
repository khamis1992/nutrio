from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 430, "height": 932})
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto("http://localhost:5173/nutrio/schedule", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=30000)
    time.sleep(3)
    
    # Gather all text and input info
    text = page.inner_text("body")
    with open("auth_body.txt", "w", encoding="utf-8") as f:
        f.write(text[:5000])
    
    # Find all labels, placeholders, and input types
    labels = page.locator("label").all()
    for i, lbl in enumerate(labels):
        try:
            print(f"Label {i}: '{lbl.inner_text()}'")
        except:
            pass
    
    inputs = page.locator("input").all()
    for i, inp in enumerate(inputs):
        attrs = inp.evaluate("el => ({type: el.type, name: el.name, id: el.id, placeholder: el.placeholder})")
        print(f"Input {i}: {attrs}")
    
    buttons = page.locator("button").all()
    for i, btn in enumerate(buttons):
        try:
            print(f"Button {i}: '{btn.inner_text()[:80]}'")
        except:
            pass
    
    browser.close()
