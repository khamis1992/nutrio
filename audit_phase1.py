"""Phase 1: Page Reconnaissance - Screenshots, DOM, Network, Console"""
import json, time
from playwright.sync_api import sync_playwright

RESULTS = {}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    # ============ DESKTOP CHROME ============
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    )
    page = context.new_page()
    
    # Capture console logs & network
    console_logs = []
    console_errors = []
    network_requests = []
    network_responses = []
    
    page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text[:500]}) if msg.type == "log" else console_errors.append({"type": msg.type, "text": msg.text[:500]}))
    page.on("request", lambda req: network_requests.append({"url": req.url[:200], "method": req.method, "resource_type": req.resource_type}))
    page.on("response", lambda res: network_responses.append({"url": res.url[:200], "status": res.status, "status_text": res.status_text}))
    
    start = time.time()
    page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    load_time = time.time() - start
    
    # Wait for React to render
    page.wait_for_timeout(3000)
    
    # Desktop screenshot
    page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/desktop_dashboard.png", full_page=True)
    
    # Get page content & DOM structure
    page_content = page.content()
    
    # Get all interactive elements
    buttons = page.query_selector_all("button")
    links = page.query_selector_all("a")
    inputs = page.query_selector_all("input, select, textarea")
    
    interactive_elements = {
        "buttons": [{"text": b.inner_text()[:100], "aria_label": b.get_attribute("aria-label") or "", "disabled": b.is_disabled(), "visible": b.is_visible()} for b in buttons],
        "links": [{"text": l.inner_text()[:100], "href": l.get_attribute("href") or "", "visible": l.is_visible()} for l in links],
        "inputs": [{"type": i.get_attribute("type") or "text", "name": i.get_attribute("name") or "", "visible": i.is_visible()} for i in inputs],
    }
    
    # Get all text content for analyzing what's rendered
    body_text = page.inner_text("body")[:5000]
    
    # Check for auth redirect
    current_url = page.url
    
    # Check for error states / loading indicators
    loading_indicators = page.query_selector_all("[class*='animate-spin'], [class*='loading'], [class*='skeleton']")
    error_elements = page.query_selector_all("[class*='error'], [class*='Error']")
    
    # Performance metrics
    perf_metrics = page.evaluate("""() => {
        const entries = performance.getEntriesByType('navigation');
        if (entries.length === 0) return { hasNavigation: false };
        const nav = entries[0];
        return {
            hasNavigation: true,
            dns: nav.domainLookupEnd - nav.domainLookupStart,
            tcp: nav.connectEnd - nav.connectStart,
            ttfb: nav.responseStart - nav.requestStart,
            download: nav.responseEnd - nav.responseStart,
            domInteractive: nav.domInteractive - nav.startTime,
            domComplete: nav.domComplete - nav.startTime,
            loadEvent: nav.loadEventEnd - nav.startTime,
            transferSize: nav.transferSize,
            encodedBodySize: nav.encodedBodySize,
        };
    }""")
    
    # Count resource sizes
    resource_counts = {}
    for req in network_requests:
        rt = req["resource_type"]
        resource_counts[rt] = resource_counts.get(rt, 0) + 1
    
    api_calls = [r for r in network_requests if "supabase" in r["url"] or "/api/" in r["url"]]
    api_responses = [r for r in network_responses if "supabase" in r["url"] or "/api/" in r["url"]]
    failed_requests = [r for r in network_responses if r["status"] >= 400]
    
    # Local storage scan
    local_storage = page.evaluate("""() => {
        const items = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key);
            items[key] = val.substring(0, 200);
        }
        return items;
    }""")
    
    # Session storage scan
    session_storage = page.evaluate("""() => {
        const items = {};
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            const val = sessionStorage.getItem(key);
            items[key] = val.substring(0, 200);
        }
        return items;
    }""")
    
    RESULTS["desktop"] = {
        "load_time_seconds": round(load_time, 2),
        "current_url": current_url,
        "body_text_preview": body_text[:3000],
        "interactive_elements_count": {
            "buttons": len(buttons),
            "links": len(links),
            "inputs": len(inputs)
        },
        "interactive_elements": interactive_elements,
        "loading_indicators_count": len(loading_indicators),
        "error_elements_count": len(error_elements),
        "performance_metrics": perf_metrics,
        "resource_counts": resource_counts,
        "api_calls_count": len(api_calls),
        "api_responses": api_responses[:30],
        "failed_requests": failed_requests,
        "console_errors_count": len(console_errors),
        "console_errors": console_errors[:20],
        "console_logs_sample": console_logs[:10],
        "local_storage_keys": list(local_storage.keys()),
        "local_storage": local_storage,
        "session_storage": session_storage,
        "network_requests_total": len(network_requests),
    }
    
    # ============ MOBILE iPHONE 14 Pro ============
    mobile_ctx = browser.new_context(
        viewport={"width": 393, "height": 852},
        device_scale_factor=3,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        has_touch=True,
    )
    mobile_page = mobile_ctx.new_page()
    start_mobile = time.time()
    mobile_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    mobile_load = time.time() - start_mobile
    mobile_page.wait_for_timeout(3000)
    mobile_page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/mobile_iphone14_dashboard.png", full_page=True)
    
    mobile_body = mobile_page.inner_text("body")[:3000]
    mobile_links = mobile_page.query_selector_all("a")
    mobile_buttons = mobile_page.query_selector_all("button")
    
    # Check responsive layout issues
    mobile_overflow = mobile_page.evaluate("""() => {
        const el = document.elementFromPoint(window.innerWidth / 2, 100);
        const allEls = document.querySelectorAll('*');
        let overflowEls = [];
        for (const el of allEls) {
            const rect = el.getBoundingClientRect();
            if (rect.right > window.innerWidth + 2 && rect.width < window.innerWidth * 2) {
                overflowEls.push({
                    tag: el.tagName,
                    class: el.className?.toString().substring(0, 100),
                    right: rect.right,
                    width: rect.width
                });
            }
        }
        return overflowEls.slice(0, 10);
    }""")
    
    RESULTS["mobile_iphone14"] = {
        "load_time_seconds": round(mobile_load, 2),
        "body_text_preview": mobile_body[:2000],
        "links_count": len(mobile_links),
        "buttons_count": len(mobile_buttons),
        "overflow_elements": mobile_overflow,
        "viewport_width": 393,
    }
    
    # ============ iPad ============
    ipad_ctx = browser.new_context(
        viewport={"width": 1024, "height": 1366},
        device_scale_factor=2,
        user_agent="Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1",
    )
    ipad_page = ipad_ctx.new_page()
    ipad_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    ipad_page.wait_for_timeout(2000)
    ipad_page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/ipad_dashboard.png", full_page=True)
    RESULTS["ipad"] = {"viewport": "1024x1366"}
    
    # ============ ANDROID ============
    android_ctx = browser.new_context(
        viewport={"width": 360, "height": 800},
        device_scale_factor=3,
        user_agent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
        has_touch=True,
    )
    android_page = android_ctx.new_page()
    android_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    android_page.wait_for_timeout(2000)
    android_page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/android_pixel8_dashboard.png", full_page=True)
    
    android_overflow = android_page.evaluate("""() => {
        const allEls = document.querySelectorAll('*');
        let issues = [];
        for (const el of allEls) {
            const rect = el.getBoundingClientRect();
            if (rect.right > window.innerWidth + 2 && rect.width < window.innerWidth * 2) {
                issues.push({tag: el.tagName, class: el.className?.toString().substring(0, 80)});
            }
        }
        return issues.slice(0, 10);
    }""")
    RESULTS["android"] = {"viewport": "360x800", "overflow_issues": android_overflow}
    
    # ============ SMALL DEVICE ============
    small_ctx = browser.new_context(viewport={"width": 320, "height": 568}, has_touch=True)
    small_page = small_ctx.new_page()
    small_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    small_page.wait_for_timeout(2000)
    small_page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/small_device_dashboard.png", full_page=True)
    RESULTS["small_device"] = {"viewport": "320x568"}
    
    # ============ LANDSCAPE ============
    landscape_ctx = browser.new_context(viewport={"width": 852, "height": 393}, has_touch=True)
    landscape_page = landscape_ctx.new_page()
    landscape_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    landscape_page.wait_for_timeout(2000)
    landscape_page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/landscape_dashboard.png", full_page=True)
    RESULTS["landscape"] = {"viewport": "852x393"}
    
    # ============ SECURITY: Try accessing admin/driver routes ============
    security_results = {}
    
    # Try admin route
    admin_page = context.new_page()
    admin_page.goto("http://localhost:5173/nutrio/admin", wait_until="networkidle", timeout=10000)
    admin_page.wait_for_timeout(2000)
    admin_url = admin_page.url
    security_results["admin_redirect"] = admin_url
    
    # Try driver route
    driver_page = context.new_page()
    driver_page.goto("http://localhost:5173/nutrio/driver", wait_until="networkidle", timeout=10000)
    driver_page.wait_for_timeout(2000)
    driver_url = driver_page.url
    security_results["driver_redirect"] = driver_url
    
    # Try partner route
    partner_page = context.new_page()
    partner_page.goto("http://localhost:5173/nutrio/partner", wait_until="networkidle", timeout=10000)
    partner_page.wait_for_timeout(2000)
    partner_url = partner_page.url
    security_results["partner_redirect"] = partner_url
    
    # Try wallet route
    wallet_page = context.new_page()
    wallet_page.goto("http://localhost:5173/nutrio/wallet", wait_until="networkidle", timeout=10000)
    wallet_page.wait_for_timeout(2000)
    wallet_url = wallet_page.url
    security_results["wallet_redirect"] = wallet_url
    
    RESULTS["security"] = security_results
    
    # ============ XSS Test ============
    xss_page = context.new_page()
    xss_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=10000)
    xss_page.wait_for_timeout(2000)
    # Try to find and inject via URL params
    xss_results = xss_page.evaluate("""() => {
        // Check for dangerous patterns
        const html = document.documentElement.innerHTML;
        const hasInlineScripts = html.includes('<script');
        const hasJavascriptUrls = html.includes('javascript:');
        const hasVBindHtml = html.includes('v-html');
        
        // Check meta tags
        const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return {
            inlineScripts: hasInlineScripts,
            javascriptUrls: hasJavascriptUrls,
            cspPresent: !!csp,
            cspContent: csp ? csp.getAttribute('content') : null
        };
    }""")
    RESULTS["xss_check"] = xss_results
    
    # ============ Accessibility Check ============
    a11y_results = page.evaluate("""() => {
        const imgNoAlt = Array.from(document.querySelectorAll('img:not([alt])')).length;
        const imgEmptyAlt = Array.from(document.querySelectorAll('img[alt=""]')).length;
        const buttonsNoLabel = Array.from(document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])')).filter(b => b.innerText.trim() === '').length;
        const linksNoText = Array.from(document.querySelectorAll('a:not([aria-label])')).filter(a => a.innerText.trim() === '' && !a.querySelector('img[alt]')).length;
        const colorContrast = {}; // Would need visual tool
        
        // Check for focus indicators
        const focusableElements = document.querySelectorAll('a, button, input, select, textarea, [tabindex]');
        const noFocusIndicator = [];
        focusableElements.forEach(el => {
            const style = window.getComputedStyle(el, ':focus');
            if (!style.outline || style.outline === 'none') {
                // Check if there's a custom focus ring via box-shadow or border
                const bs = style.boxShadow;
                if (!bs || bs === 'none') {
                    noFocusIndicator.push(el.tagName);
                }
            }
        });
        
        // Check heading hierarchy
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const headingLevels = headings.map(h => parseInt(h.tagName[1]));
        let headingSkips = false;
        if (headingLevels.length > 0) {
            for (let i = 1; i < headingLevels.length; i++) {
                if (headingLevels[i] > headingLevels[i-1] + 1) {
                    headingSkips = true;
                    break;
                }
            }
        }
        
        return {
            imgNoAlt,
            imgEmptyAlt,
            buttonsNoLabel,
            linksNoText,
            focusableCount: focusableElements.length,
            noFocusIndicatorCount: noFocusIndicator.length,
            headingLevels,
            headingSkips,
            headingsCount: headings.length,
            hasLangAttribute: !!document.documentElement.getAttribute('lang'),
        };
    }""")
    RESULTS["accessibility"] = a11y_results
    
    # ============ Memory & Performance Deep ============
    mem_results = page.evaluate("""() => {
        const mem = performance.memory || {};
        return {
            jsHeapSizeLimit: mem.jsHeapSizeLimit,
            totalJSHeapSize: mem.totalJSHeapSize,
            usedJSHeapSize: mem.usedJSHeapSize,
            resourceCount: performance.getEntriesByType('resource').length,
            longTasks: 0, // Can't easily measure in page context
        };
    }""")
    RESULTS["memory"] = mem_results
    
    browser.close()

with open("C:/Users/khamis/Documents/nutrio/audit_results_phase1.json", "w") as f:
    json.dump(RESULTS, f, indent=2, default=str)

print("Phase 1 audit complete. Results saved.")