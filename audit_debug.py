"""Debug: Check why SPA isn't rendering"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    messages = []
    page.on("console", lambda msg: messages.append(f"[{msg.type}] {msg.text}"))

    page.goto("http://localhost:5173/nutrio/dashboard", timeout=30000)
    page.wait_for_timeout(8000)

    print("URL:", page.url)
    print("Title:", page.title())

    root_html = page.evaluate("""() => {
        const root = document.getElementById('root');
        return root ? root.innerHTML.substring(0, 500) : 'NO ROOT DIV';
    }""")
    print("Root div:", root_html)

    print("\nConsole messages:")
    for m in messages[:20]:
        if "error" in m.lower() or "warning" in m.lower():
            print(m[:200])

    # Try the root URL
    page.goto("http://localhost:5173/", timeout=15000)
    page.wait_for_timeout(3000)
    print("\nRoot URL:", page.url)
    print("Root URL title:", page.title())
    text2 = page.locator("body").inner_text()[:300]
    print("Root body text:", text2)

    # Try /dashboard without base path
    page.goto("http://localhost:5173/dashboard", timeout=15000)
    page.wait_for_timeout(3000)
    print("\n/dashboard URL:", page.url)
    text3 = page.locator("body").inner_text()[:300]
    print("/dashboard body text:", text3)

    browser.close()