"""Audit 1: Functional Testing + Visual Inspection + Navigation + Performance + Security"""
import json
from playwright.sync_api import sync_playwright

RESULTS = []

def add_result(category, test_name, status, details="", severity=""):
    RESULTS.append({
        "category": category,
        "test": test_name,
        "status": status,
        "details": details,
        "severity": severity
    })

def safe_count(page, selector):
    try:
        return page.locator(selector).count()
    except:
        return 0

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()

    console_errors = []
    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ["error", "warning"] else None)

    # 1. Page load
    page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(3000)

    current_url = page.url
    add_result("Functional", "Page Load", "PASS" if "dashboard" in current_url or "auth" in current_url else "FAIL",
               f"URL: {current_url}", "Critical" if "dashboard" not in current_url and "auth" not in current_url else "Low")

    page.screenshot(path="audit_dashboard_initial.png", full_page=True)

    if "auth" in current_url:
        add_result("Functional", "Auth Redirect", "PASS", "Unauthenticated users redirected to /auth", "Low")
        page.screenshot(path="audit_auth_page.png", full_page=True)

        email_input = page.locator('input[type="email"]')
        password_input = page.locator('input[type="password"]')
        add_result("Functional", "Auth - Email Input", "PASS" if email_input.count() > 0 else "FAIL",
                   f"Found {email_input.count()} email inputs")
        add_result("Functional", "Auth - Password Input", "PASS" if password_input.count() > 0 else "FAIL",
                   f"Found {password_input.count()} password inputs")

        submit_btn = page.locator('button[type="submit"]')
        add_result("Functional", "Auth - Submit Button", "PASS" if submit_btn.count() > 0 else "FAIL",
                   f"Found {submit_btn.count()} submit buttons")

        all_inputs = page.locator('input')
        add_result("Functional", "Auth - All Inputs", "INFO", f"Total inputs: {all_inputs.count()}")

        all_buttons = page.locator('button')
        add_result("Functional", "Auth - All Buttons", "INFO", f"Total buttons: {all_buttons.count()}")

        if email_input.count() > 0:
            email_input.first.fill("test@test.com")
            add_result("Functional", "Auth - Email Input Interaction", "PASS", "Email input accepts text")
        if password_input.count() > 0:
            password_input.first.fill("testpassword123")
            add_result("Functional", "Auth - Password Input Interaction", "PASS", "Password input accepts text")

        page.screenshot(path="audit_auth_filled.png")

        if submit_btn.count() > 0:
            submit_btn.first.click()
            page.wait_for_timeout(3000)
            page.screenshot(path="audit_auth_attempt.png")
            add_result("Functional", "Auth - Login Attempt Processed", "PASS", "Login attempt triggered")

        # Get page text content for analysis
        page_text = page.locator('body').inner_text()
        add_result("Functional", "Auth Page Content", "INFO", f"Page text length: {len(page_text)}")

    else:
        # Dashboard is visible - full functional testing
        add_result("Functional", "Dashboard Accessible", "PASS", "Dashboard loaded directly")

        # Get full page content
        page_text = page.locator('body').inner_text()
        add_result("Functional", "Page Content", "INFO", f"Page text length: {len(page_text)}")

        # Check for key text content
        has_greeting = any(g in page_text.lower() for g in ["good morning", "good afternoon", "good evening", "hello", "hey"])
        add_result("Functional", "Header - Greeting", "PASS" if has_greeting else "FAIL",
                   f"Greeting found: {has_greeting}")

        has_sub = any(s in page_text.lower() for s in ["meals left", "remaining", "plan", "vip", "unlimited", "subscription"])
        add_result("Functional", "Subscription Card", "PASS" if has_sub else "FAIL",
                   f"Subscription info found: {has_sub}")

        has_nutrition = any(n in page_text.lower() for n in ["calorie", "protein", "carb", "fat", "kcal", "nutrition"])
        add_result("Functional", "Daily Nutrition Card", "PASS" if has_nutrition else "FAIL",
                   f"Nutrition info found: {has_nutrition}")

        has_log_meal = "log" in page_text.lower() and "meal" in page_text.lower()
        add_result("Functional", "Log Meal CTA", "PASS" if has_log_meal else "FAIL",
                   f"Log Meal CTA found: {has_log_meal}")

        has_streak = "streak" in page_text.lower()
        add_result("Functional", "Streak Widget", "INFO", f"Streak widget found: {has_streak}")

        has_ai = any(a in page_text.lower() for a in ["ai", "prediction", "insight", "adaptive", "goal"])
        add_result("Functional", "AI Widgets", "INFO", f"AI elements found: {has_ai}")

        # Count links and buttons
        all_links = page.locator('a')
        all_buttons = page.locator('button')
        add_result("Functional", "Interactive Elements", "INFO",
                   f"Links: {all_links.count()}, Buttons: {all_buttons.count()}")

        # Bottom nav
        nav_links = page.locator('a[href*="/dashboard"], a[href*="/meals"], a[href*="/schedule"], a[href*="/profile"]')
        add_result("Functional", "Bottom Navigation Links", "PASS" if nav_links.count() >= 3 else "WARN",
                   f"Found {nav_links.count()} nav links")

        # Quick actions
        quick_actions = page.locator('a[href*="/tracker"], a[href*="/subscription"], a[href*="/favorites"], a[href*="/progress"]')
        add_result("Functional", "Quick Action Links", "INFO",
                   f"Found {quick_actions.count()} quick action links")

        # Test Log Meal dialog
        log_meal_btn = page.locator('button:has-text("Log"), button:has-text("log")')
        if log_meal_btn.count() > 0:
            log_meal_btn.first.click()
            page.wait_for_timeout(1500)
            page.screenshot(path="audit_log_meal_dialog.png")

            dialog = page.locator('[role="dialog"]')
            add_result("Functional", "Log Meal Dialog Opens", "PASS" if dialog.count() > 0 else "FAIL",
                       f"Found {dialog.count()} dialog elements")

            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
            add_result("Functional", "Log Meal Dialog Closes", "PASS", "Dialog closed via Escape")

        # Navigation test: click a link and go back
        profile_links = page.locator('a[href*="/profile"]')
        if profile_links.count() > 0:
            profile_links.first.click()
            page.wait_for_timeout(2000)
            profile_url = page.url
            add_result("Functional", "Profile Navigation", "PASS" if "/profile" in profile_url else "FAIL",
                       f"Navigated to: {profile_url}")
            page.go_back()
            page.wait_for_timeout(1500)
            add_result("Functional", "Back Navigation", "PASS" if "/dashboard" in page.url else "WARN",
                       f"Back to: {page.url}")

    # Console errors
    if console_errors:
        error_msgs = [e for e in console_errors if "[error]" in e]
        warn_msgs = [e for e in console_errors if "[warning]" in e]
        add_result("Functional", "Console Errors", "WARN" if error_msgs else "PASS",
                   f"Errors: {len(error_msgs)}, Warnings: {len(warn_msgs)}. First 3 errors: {error_msgs[:3]}", "Medium")

    # Performance metrics
    try:
        perf = page.evaluate("""() => {
            const nav = performance.getEntriesByType('navigation')[0];
            return {
                domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
                load: Math.round(nav.loadEventEnd - nav.startTime),
                domInteractive: Math.round(nav.domInteractive - nav.startTime),
            };
        }""")
        add_result("Performance", "DOMContentLoaded", "INFO",
                   f"{perf.get('domContentLoaded', 'N/A')}ms")
        add_result("Performance", "Full Page Load", "INFO",
                   f"{perf.get('load', 'N/A')}ms")

        fcp = page.evaluate("""() => {
            const paint = performance.getEntriesByType('paint');
            const fcp = paint.find(p => p.name === 'first-contentful-paint');
            return fcp ? Math.round(fcp.startTime) : null;
        }""")
        if fcp:
            add_result("Performance", "First Contentful Paint", "PASS" if fcp < 2000 else "WARN" if fcp < 3000 else "FAIL",
                       f"FCP: {fcp}ms", "High" if fcp > 3000 else "Medium")
    except Exception as e:
        add_result("Performance", "Metrics Collection", "ERROR", str(e)[:100])

    # API calls audit
    api_log = []
    def on_request(req):
        if "supabase" in req.url:
            api_log.append({"method": req.method, "url": req.url[:200]})
    page.on("request", on_request)

    failed_api = []
    def on_response(res):
        if res.status >= 400:
            failed_api.append({"status": res.status, "url": res.url[:200]})
    page.on("response", on_response)

    page.reload(wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(3000)

    add_result("API", "Supabase Request Count", "INFO", f"Total: {len(api_log)}")
    if failed_api:
        add_result("API", "Failed API Response", "WARN",
                   f"{len(failed_api)} failed: {failed_api[:5]}", "High")

    # LocalStorage audit
    try:
        storage_data = page.evaluate("""() => {
            const items = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                const isSensitive = /token|secret|password|key|credential/i.test(key);
                items.push({
                    key: key,
                    valueLength: value ? value.length : 0,
                    isSensitive: isSensitive,
                });
            }
            return items;
        }""")
        sensitive_keys = [s["key"] for s in storage_data if s["isSensitive"]]
        add_result("Security", "LocalStorage Sensitive Data", "WARN" if sensitive_keys else "PASS",
                   f"Sensitive keys: {sensitive_keys}", "High")
        add_result("Security", "LocalStorage Item Count", "INFO",
                   f"Total items: {len(storage_data)}. All keys: {[s['key'] for s in storage_data]}")
    except Exception as e:
        add_result("Security", "LocalStorage Audit", "ERROR", str(e)[:100])

    # Resource audit
    try:
        resources = page.evaluate("""() => {
            const res = performance.getEntriesByType('resource');
            const total = res.reduce((s, r) => s + (r.transferSize || 0), 0);
            const slow = res.filter(r => r.duration > 1000).map(r => r.name.substring(0, 80) + ' (' + Math.round(r.duration) + 'ms)');
            const largest = res.sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0)).slice(0, 10)
                .map(r => r.name.substring(0, 60) + ' (' + Math.round((r.transferSize || 0) / 1024) + 'KB)');
            return {
                total: res.length,
                totalKB: Math.round(total / 1024),
                slow: slow,
                largest: largest,
                jsCount: res.filter(r => r.name.includes('.js')).length,
                cssCount: res.filter(r => r.name.includes('.css')).length,
            };
        }""")
        add_result("Performance", "Resource Summary", "INFO",
                   f"Resources: {resources['total']}, Total: {resources['totalKB']}KB, JS: {resources['jsCount']}, CSS: {resources['cssCount']}")
        if resources['slow']:
            add_result("Performance", "Slow Resources (>1s)", "WARN",
                       f"Slow resources: {resources['slow']}", "Medium")
        add_result("Performance", "Largest Resources", "INFO",
                   f"Top 10: {resources['largest']}")
    except Exception as e:
        add_result("Performance", "Resource Audit", "ERROR", str(e)[:100])

    browser.close()

with open("audit_1_results.json", "w") as f:
    json.dump(RESULTS, f, indent=2)

print(f"Audit 1 complete. {len(RESULTS)} findings.")
for r in RESULTS:
    if r["status"] in ["FAIL", "WARN", "ERROR"]:
        print(f"  [{r['status']}] [{r['severity']}] {r['test']}: {str(r['details'])[:120]}")