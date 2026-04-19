"""Minimal debug test with relaxed timing"""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    
    msgs = []
    page.on("console", lambda msg: msgs.append(f"[{msg.type}] {msg.text[:200]}"))
    net_errors = []
    page.on("response", lambda res: net_errors.append(f"{res.status} {res.url[:120]}") if res.status >= 400 else None)
    page.on("requestfailed", lambda req: net_errors.append(f"FAILED {req.url[:120]}"))
    
    print("Navigating to dashboard (domcontentloaded)...")
    try:
        page.goto("http://localhost:5173/nutrio/dashboard", wait_until="domcontentloaded", timeout=30000)
    except Exception as e:
        print(f"Navigation error: {e}")
        try:
            page.goto("http://localhost:5173/nutrio/dashboard", wait_until="commit", timeout=15000)
        except Exception as e2:
            print(f"Commit error: {e2}")
    
    # Wait for JS to execute
    print("Waiting 12 seconds for React hydration...")
    time.sleep(12)
    
    url = page.url
    print(f"URL: {url}")
    
    body_length = 0
    try:
        body_length = page.evaluate("() => document.body?.innerText?.length || 0")
    except:
        pass
    print(f"Body text length: {body_length}")
    
    if body_length > 10:
        body_text = page.evaluate("() => document.body.innerText.substring(0, 800)")
        print(f"Body text: {body_text}")
    
    # Check React root
    root_info = page.evaluate("""() => {
        const root = document.getElementById('root');
        if (!root) return {exists: false};
        return {
            exists: true,
            hasChildren: root.children.length > 0,
            htmlLen: root.innerHTML.length,
            firstChild: root.children[0]?.tagName || 'none',
            textPrev: root.innerText?.substring(0, 200) || ''
        };
    }""")
    print(f"Root info: {root_info}")
    
    # Check for Vite error overlay
    vite_overlay = page.evaluate("""() => {
        const overlay = document.querySelector('vite-error-overlay');
        const errorEl = document.querySelector('[class*="error"]');
        return {
            hasViteOverlay: !!overlay,
            hasErrorEl: errorEl ? errorEl.innerText.substring(0, 200) : null,
            title: document.title,
        };
    }""")
    print(f"Vite/error: {vite_overlay}")
    
    errors = [m for m in msgs if "[error]" in m]
    print(f"\nConsole errors ({len(errors)}):")
    for e in errors[:10]:
        print(f"  {e}")
    
    print(f"\nNetwork errors ({len(net_errors)}):")
    for e in net_errors[:10]:
        print(f"  {e}")
    
    page.screenshot(path="audit_debug_final.png")
    print("Screenshot saved")
    
    browser.close()