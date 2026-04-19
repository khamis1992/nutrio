"""Re-audit: authenticated dashboard after all fixes"""
import json, time
from playwright.sync_api import sync_playwright

RESULTS = {}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 393, "height": 852})
    page = context.new_page()

    console_errors = []
    page.on("console", lambda msg: console_errors.append({"type": msg.type, "text": msg.text[:300]}) if msg.type in ("error", "warning") else None)

    # Try accessing dashboard (should redirect to auth since no session)
    start = time.time()
    page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(3000)
    load_time = time.time() - start

    current_url = page.url
    page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/recheck_desktop.png", full_page=True)

    # Check CSP meta tag
    csp_meta = page.evaluate("""() => {
        const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return meta ? meta.getAttribute('content') : null;
    }""")

    # Check aria-live attributes
    aria_live_count = page.evaluate("""() => {
        return document.querySelectorAll('[aria-live]').length;
    }""")

    # Check role=status attributes
    role_status_count = page.evaluate("""() => {
        return document.querySelectorAll('[role="status"]').length;
    }""")

    # Check localStorage for sensitive data
    ls_check = page.evaluate("""() => {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('adaptive_goals') || key.includes('recommendation')) {
                keys.push(key);
            }
        }
        return keys;
    }""")

    # Test protected routes (should redirect)
    protected_routes = {}
    for route in ["/admin", "/driver", "/partner", "/wallet", "/subscription"]:
        test_page = context.new_page()
        test_page.goto(f"http://localhost:5173/nutrio{route}", wait_until="networkidle", timeout=10000)
        test_page.wait_for_timeout(1500)
        protected_routes[route] = test_page.url
        test_page.close()

    # Mobile small device test
    small_ctx = browser.new_context(viewport={"width": 320, "height": 568}, has_touch=True)
    small_page = small_ctx.new_page()
    small_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=15000)
    small_page.wait_for_timeout(2000)
    overflow = small_page.evaluate("""() => {
        const allEls = document.querySelectorAll('*');
        let issues = [];
        for (const el of allEls) {
            const rect = el.getBoundingClientRect();
            if (rect.right > window.innerWidth + 2 && rect.width < window.innerWidth * 2) {
                issues.push({tag: el.tagName, class: el.className?.toString().substring(0, 80)});
            }
        }
        return issues.slice(0, 5);
    }""")
    small_page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/recheck_small.png", full_page=True)

    # Reduced motion check
    reduced_ctx = browser.new_context(
        viewport={"width": 393, "height": 852},
        reduced_motion="reduce"
    )
    reduced_page = reduced_ctx.new_page()
    reduced_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=15000)
    reduced_page.wait_for_timeout(2000)
    reduced_page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_screenshots/recheck_reduced_motion.png", full_page=True)

    RESULTS = {
        "load_time_seconds": round(load_time, 2),
        "current_url": current_url,
        "csp_meta_tag_present": csp_meta is not None,
        "csp_content_preview": (csp_meta or "")[:200],
        "aria_live_elements_count": aria_live_count,
        "role_status_elements_count": role_status_count,
        "localStorage_adaptive_keys": ls_check,
        "console_errors_sample": [e for e in console_errors if e["type"] == "error"][:10],
        "console_warnings_sample": [e for e in console_errors if e["type"] == "warning"][:5],
        "protected_routes": protected_routes,
        "mobile_320_overflow_issues": overflow,
        "reduced_motion_screenshot_taken": True,
    }

    browser.close()

with open("C:/Users/khamis/Documents/nutrio/audit_results_recheck.json", "w") as f:
    json.dump(RESULTS, f, indent=2, default=str)

print("Re-audit complete.")
for k, v in RESULTS.items():
    print(f"  {k}: {v}")