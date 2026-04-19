"""Phase 1: Dashboard reconnaissance - screenshots, DOM inspection, element discovery"""
from playwright.sync_api import sync_playwright
import json, time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})  # iPhone 14
    
    # Collect console messages and network requests
    console_msgs = []
    network_requests = []
    js_errors = []
    
    page.on("console", lambda msg: console_msgs.append({"type": msg.type, "text": msg.text}))
    page.on("pageerror", lambda err: js_errors.append(str(err)))
    page.on("request", lambda req: network_requests.append({"url": req.url, "method": req.method}))
    page.on("response", lambda resp: network_requests.append({"url": resp.url, "status": resp.status, "body_size": resp.headers.get("content-length", "?")}) if resp.url.startswith("http") else None)
    
    # Navigate to dashboard
    start = time.time()
    page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    load_time = time.time() - start
    
    # Wait for content to render
    page.wait_for_timeout(3000)
    
    # Screenshot - full page and viewport
    page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/dashboard_full.png", full_page=True)
    page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/dashboard_viewport.png", full_page=False)
    
    # Get page content
    content = page.content()
    with open("C:/Users/khamis/Documents/nutrio/audit_screenshots/dashboard_html.html", "w", encoding="utf-8") as f:
        f.write(content)
    
    # Element discovery
    elements = {
        "buttons": [el.inner_text() or el.get_attribute("aria-label") or "icon-only" for el in page.locator("button").all()],
        "links": [{"text": el.inner_text(), "href": el.get_attribute("href")} for el in page.locator("a[href]").all()],
        "inputs": [{"type": el.get_attribute("type"), "placeholder": el.get_attribute("placeholder"), "aria_label": el.get_attribute("aria-label")} for el in page.locator("input").all()],
        "images": [{"src": el.get_attribute("src"), "alt": el.get_attribute("alt")} for el in page.locator("img").all()],
        "badges": [el.inner_text() for el in page.locator("[class*='badge'], [class*='Badge']").all()],
        "aria_live": [el.get_attribute("aria-live") for el in page.locator("[aria-live]").all()],
    }
    
    with open("C:/Users/khamis/Documents/nutrio/audit_screenshots/elements.json", "w", encoding="utf-8") as f:
        json.dump(elements, f, indent=2, ensure_ascii=False)
    
    # Check for auth redirect
    current_url = page.url
    
    # Performance metrics
    perf = page.evaluate("() => { const p = performance.getEntriesByType('navigation')[0]; return { domContentLoaded: p.domContentLoadedEventEnd - p.domContentLoadedEventStart, loadComplete: p.loadEventEnd - p.loadEventStart, domInteractive: p.domInteractive, transferSize: p.transferSize, decodedBodySize: p.decodedBodySize }; }")
    
    # Memory usage
    try:
        mem = page.evaluate("() => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null")
    except:
        mem = None
    
    # Count DOM nodes
    dom_nodes = page.evaluate("() => document.querySelectorAll('*').length")
    
    # Accessibility: check for alt text on images
    img_alt_issues = page.evaluate("""() => {
        const imgs = document.querySelectorAll('img');
        return Array.from(imgs).filter(i => !i.alt || i.alt.trim() === '').map(i => ({src: i.src, hasAlt: i.hasAttribute('alt')}));
    }""")
    
    # Check color contrast (simplified)
    contrast_issues = page.evaluate("""() => {
        const textEls = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a, button, label');
        const issues = [];
        textEls.forEach(el => {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            if (fontSize < 11) issues.push({text: el.textContent?.slice(0,30), fontSize, element: el.tagName});
        });
        return issues.slice(0, 20);
    }""")
    
    # Check for hardcoded English text that should be i18n'd
    # Already covered in code review
    
    results = {
        "current_url": current_url,
        "load_time_seconds": round(load_time, 2),
        "performance": perf,
        "memory": mem,
        "dom_node_count": dom_nodes,
        "console_messages": console_msgs[-50:],
        "js_errors": js_errors,
        "img_alt_issues": img_alt_issues,
        "small_font_issues": contrast_issues,
        "api_calls": [r for r in network_requests if "supabase" in r.get("url", "") or "api" in r.get("url", "")],
        "total_network_requests": len(network_requests),
    }
    
    with open("C:/Users/khamis/Documents/nutrio/audit_screenshots/recon_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)
    
    print(json.dumps(results, indent=2, default=str))
    
    browser.close()