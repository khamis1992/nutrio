"""Full Audit Script - Complete Enterprise Audit of Dashboard"""
import json
from playwright.sync_api import sync_playwright
import time

RESULTS = []

def add(cat, test, status, details="", severity="Low"):
    RESULTS.append({"category": cat, "test": test, "status": status, "details": str(details)[:300], "severity": severity})

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ==================== SECTION 1: PAGE LOAD & AUTH ====================
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()

    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))
    network_errors = []
    page.on("response", lambda res: network_errors.append(f"{res.status} {res.url[:120]}") if res.status >= 400 else None)
    requests = []
    page.on("request", lambda req: requests.append(f"{req.method} {req.url[:120]}") if "supabase" in req.url else None)

    add("Functional", "Init Page Load", "INFO", "Navigating to /nutrio/dashboard")

    try:
        page.goto("http://localhost:5173/nutrio/dashboard", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(10000)  # Wait for React hydration
    except Exception as e:
        add("Functional", "Page Load Error", "FAIL", str(e)[:200], "Critical")

    current_url = page.url
    try:
        page.screenshot(timeout=10000, path="audit_01_initial.png")
    except:
        page.screenshot(timeout=10000, path="audit_01_initial.png")

    body_text = ""
    try:
        body_text = page.locator("body").inner_text()
    except:
        pass

    add("Functional", "Page URL", "INFO", f"URL: {current_url}")
    add("Functional", "Page Renders Content", "PASS" if len(body_text) > 50 else "FAIL",
        f"Body text length: {len(body_text)}", "Critical" if len(body_text) < 50 else "Low")

    if len(body_text) < 50:
        # Page didn't render - likely auth redirect or JS error
        add("Functional", "Page Content Empty", "FAIL",
            f"Page body empty. Console errors: {[m[:150] for m in console_msgs if 'error' in m.lower()][:5]}", "Critical")

        # Check if it's a Vite dep optimization issue
        has_504 = any("504" in e for e in network_errors)
        if has_504:
            add("Functional", "Vite Dependency Cache Error", "FAIL",
                "504 Outdated Optimize Dep errors - need to clear node_modules/.vite and restart", "Critical")

        browser.close()

        with open("audit_full_results.json", "w") as f:
            json.dump(RESULTS, f, indent=2)
        print(f"Audit incomplete. {len(RESULTS)} findings. Page did not render.")
        for r in RESULTS:
            print(f"  [{r['status']}] [{r['severity']}] {r['test']}: {r['details'][:120]}")
        exit(0)

    # ==================== SECTION 2: AUTH REDIRECT CHECK ====================
    if "/auth" in current_url:
        add("Functional", "Auth Redirect", "PASS", "Unauthenticated users redirected to /auth")

        # Check auth page elements
        inputs = page.locator("input")
        add("Functional", "Auth - Input Fields", "PASS" if inputs.count() >= 2 else "FAIL",
            f"Found {inputs.count()} inputs")

        buttons = page.locator("button")
        add("Functional", "Auth - Buttons", "PASS" if buttons.count() >= 1 else "FAIL",
            f"Found {buttons.count()} buttons")

        for i in range(min(inputs.count(), 5)):
            inp = inputs.nth(i)
            try:
                itype = inp.get_attribute("type") or "text"
                placeholder = inp.get_attribute("placeholder") or ""
                add("Functional", f"Auth Input #{i+1}", "INFO",
                    f"type={itype}, placeholder={placeholder}")
            except:
                pass

        page.screenshot(timeout=10000, path="audit_02_auth_page.png", full_page=True)

    else:
        # ==================== SECTION 3: DASHBOARD FUNCTIONAL TESTING ====================
        add("Functional", "Dashboard Renders", "PASS", "Dashboard page rendered successfully")

        # Check key dashboard sections
        sections_to_check = {
            "Greeting": ["good morning", "good afternoon", "good evening", "hello", "hey", "welcome"],
            "Subscription": ["meals left", "remaining", "plan", "vip", "unlimited", "subscription", "meals remaining"],
            "Nutrition": ["calorie", "protein", "carbs", "fat", "kcal", "nutrition", "macro"],
            "Log Meal CTA": ["log meal", "log your meal", "track meal"],
            "Quick Actions": ["tracker", "subscription", "favorites", "progress"],
            "Streak": ["streak", "day streak", "consecutive"],
            "AI Features": ["prediction", "insight", "adaptive", "goal", "ai"],
            "Order Tracking": ["order", "delivery", "on the way", "preparing"],
            "Featured Restaurants": ["restaurant", "top rated", "featured"],
        }

        for section, keywords in sections_to_check.items():
            found = any(kw in body_text.lower() for kw in keywords)
            add("Functional", f"Section: {section}", "PASS" if found else "WARN",
                f"Keywords found: {found}. Looking for: {keywords}", "Medium" if not found else "Low")

        # Count interactive elements
        links = page.locator("a")
        buttons = page.locator("button")
        inputs_els = page.locator("input")
        add("Functional", "Interactive Elements", "INFO",
            f"Links: {links.count()}, Buttons: {buttons.count()}, Inputs: {inputs_els.count()}")

        # Check bottom navigation
        nav_links = page.locator("nav a, [class*='bottom'] a, [class*='tab'] a")
        add("Functional", "Navigation Links", "PASS" if nav_links.count() >= 3 else "WARN",
            f"Found {nav_links.count()} nav links")

        # Screenshot each major state
        page.screenshot(timeout=10000, path="audit_03_dashboard_full.png", full_page=True)

        # Test Log Meal dialog
        log_btn = page.locator("button:has-text('Log'), button:has-text('log')")
        if log_btn.count() > 0:
            log_btn.first.click()
            page.wait_for_timeout(1500)
            page.screenshot(timeout=10000, path="audit_04_log_meal.png", full_page=True)
            dialog = page.locator("[role='dialog'], [data-state='open']")
            add("Functional", "Log Meal Dialog Opens", "PASS" if dialog.count() > 0 else "FAIL",
                f"Dialog elements: {dialog.count()}")
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        else:
            add("Functional", "Log Meal Button", "WARN", "No 'Log' button found", "Medium")

        # Test navigation
        for route in ["/meals", "/schedule", "/profile"]:
            nav = page.locator(f"a[href*='{route}']")
            if nav.count() > 0:
                nav.first.click()
                page.wait_for_timeout(2000)
                nav_url = page.url
                add("Functional", f"Navigation to {route}", "PASS" if route in nav_url else "FAIL",
                    f"Navigated to: {nav_url}")
                page.go_back()
                page.wait_for_timeout(1000)

        # ==================== SECTION 4: RESPONSIVE TESTING ====================
        VIEWPORTS = [
            ("iPhone SE", 375, 667),
            ("iPhone 14", 390, 844),
            ("iPhone 14 Pro Max", 430, 932),
            ("Android", 360, 800),
            ("iPad Mini", 768, 1024),
            ("Desktop", 1440, 900),
            ("Landscape Mobile", 844, 390),
        ]

        for name, w, h in VIEWPORTS:
            ctx = browser.new_context(viewport={"width": w, "height": h})
            pg = ctx.new_page()
            pg.goto("http://localhost:5173/nutrio/dashboard", timeout=15000)
            pg.wait_for_load_state("networkidle")
            pg.wait_for_timeout(3000)

            safe_name = name.replace(" ", "_").lower()
            pg.screenshot(timeout=10000, path=f"audit_responsive_{safe_name}.png", full_page=True)

            # Check horizontal overflow
            overflow = pg.evaluate("""() => {
                return {
                    scrollW: document.documentElement.scrollWidth,
                    clientW: document.documentElement.clientWidth,
                    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 10
                };
            }""")

            add("Responsive", f"Overflow: {name} ({w}x{h})",
                "FAIL" if overflow["overflow"] else "PASS",
                f"scrollW={overflow['scrollW']}, clientW={overflow['clientW']}, overflow={overflow['overflow']}",
                "High" if overflow["overflow"] else "Low")

            # Check touch targets
            small_targets = pg.evaluate("""() => {
                const small = [];
                document.querySelectorAll('button, a, [role="button"], [tabindex]:not([tabindex="-1"])').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
                        small.push({tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), text: el.textContent?.substring(0, 20)});
                    }
                });
                return small.slice(0, 10);
            }""")

            if small_targets:
                add("Responsive", f"Small Touch Targets: {name}", "WARN",
                    f"{len(small_targets)} targets < 44px. Examples: {small_targets[:5]}", "Medium")

            ctx.close()

        # ==================== SECTION 5: ACCESSIBILITY ====================
        ctx_a11y = browser.new_context(viewport={"width": 390, "height": 844})
        page_a11y = ctx_a11y.new_page()
        page_a11y.goto("http://localhost:5173/nutrio/dashboard", timeout=15000)
        page_a11y.wait_for_load_state("networkidle")
        page_a11y.wait_for_timeout(3000)

        # Images without alt
        img_issues = page_a11y.evaluate("""() => {
            const issues = [];
            document.querySelectorAll('img').forEach(img => {
                if (!img.alt || img.alt.trim() === '') {
                    issues.push({src: (img.src || '').substring(0, 80), alt: img.alt});
                }
            });
            return issues;
        }""")
        add("Accessibility", "Images Without Alt Text", "WARN" if img_issues else "PASS",
            f"{len(img_issues)} images missing alt text", "Medium")

        # Inputs without labels
        label_issues = page_a11y.evaluate("""() => {
            const issues = [];
            document.querySelectorAll('input, select, textarea').forEach(el => {
                if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') &&
                    !el.id && !el.closest('label')) {
                    issues.push({type: el.type || el.tagName, name: el.name || ''});
                }
            });
            return issues;
        }""")
        add("Accessibility", "Inputs Without Labels", "WARN" if label_issues else "PASS",
            f"{len(label_issues)} inputs without labels", "Medium")

        # Heading hierarchy
        headings = page_a11y.evaluate("""() => {
            return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
                level: parseInt(h.tagName[1]), text: h.textContent?.trim().substring(0, 40)
            }));
        }""")
        add("Accessibility", "Heading Hierarchy", "INFO", f"Headings: {headings}")

        # ARIA landmarks
        landmarks = page_a11y.evaluate("""() => {
            const roles = ['main', 'nav', 'banner', 'contentinfo', 'complementary', 'form', 'search'];
            return roles.map(r => ({role: r, count: document.querySelectorAll(`[role="${r}"], ${r === 'main' ? 'main' : r === 'nav' ? 'nav' : ''}`).length}));
        }""")
        add("Accessibility", "ARIA Landmarks", "INFO",
            f"Landmarks: {[(l['role'] + ': ' + str(l['count'])) for l in landmarks]}")

        # Viewport meta
        viewport = page_a11y.evaluate("""() => {
            const meta = document.querySelector('meta[name="viewport"]');
            return meta ? meta.getAttribute('content') : null;
        }""")
        add("Accessibility", "Viewport Meta", "PASS" if viewport else "FAIL",
            f"Content: {viewport}", "High" if not viewport else "Low")

        # Safe area handling
        safe_area = page_a11y.evaluate("""() => {
            try {
                const sheets = Array.from(document.styleSheets);
                let hasSafeArea = false;
                for (const sheet of sheets) {
                    try {
                        for (const rule of sheet.cssRules) {
                            if (rule.cssText && rule.cssText.includes('env(safe-area')) {
                                hasSafeArea = true;
                                break;
                            }
                        }
                    } catch(e) {}
                    if (hasSafeArea) break;
                }
                return hasSafeArea;
            } catch(e) { return false; }
        }""")
        add("Mobile", "Safe AreaInsets CSS", "WARN" if not safe_area else "PASS",
            f"Has safe-area CSS: {safe_area}", "Medium")

        ctx_a11y.close()

        # ==================== SECTION 6: PERFORMANCE ====================
        perf = page.evaluate("""() => {
            try {
                const nav = performance.getEntriesByType('navigation')[0];
                const resources = performance.getEntriesByType('resource');
                const paint = performance.getEntriesByType('paint');
                const fcp = paint.find(p => p.name === 'first-contentful-paint');
                const lcp = paint.find(p => p.name === 'largest-contentful-paint');
                const totalSize = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
                const slowRes = resources.filter(r => r.duration > 1000).map(r => r.name.substring(0, 80));
                return {
                    domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
                    load: Math.round(nav.loadEventEnd - nav.startTime),
                    fcp: fcp ? Math.round(fcp.startTime) : null,
                    resourceCount: resources.length,
                    totalKB: Math.round(totalSize / 1024),
                    slowResources: slowRes,
                    jsFiles: resources.filter(r => r.name.includes('.js')).length,
                    cssFiles: resources.filter(r => r.name.includes('.css')).length,
                };
            } catch(e) { return {error: e.message}; }
        }""")
        add("Performance", "Page Load Metrics", "INFO",
            f"DOM: {perf.get('domContentLoaded')}ms, Load: {perf.get('load')}ms, FCP: {perf.get('fcp')}ms")
        add("Performance", "Resource Audit", "INFO",
            f"Resources: {perf.get('resourceCount')}, Size: {perf.get('totalKB')}KB, JS: {perf.get('jsFiles')}, CSS: {perf.get('cssFiles')}")
        if perf.get('slowResources'):
            add("Performance", "Slow Resources", "WARN",
                f"Slow (>1s): {perf.get('slowResources')}", "Medium")

        # CLS proxy
        cls_check = page.evaluate("""() => {
            let cls = 0;
            try {
                const entries = performance.getEntriesByType('layout-shift');
                entries.forEach(e => { if (!e.hadRecentInput) cls += e.value; });
            } catch(e) {}
            return cls;
        }""")
        add("Performance", "Cumulative Layout Shift", "PASS" if cls_check < 0.1 else "WARN",
            f"CLS: {cls_check:.4f}", "Medium" if cls_check >= 0.1 else "Low")

        # ==================== SECTION 7: SECURITY ====================
        # LocalStorage
        storage_audit = page.evaluate("""() => {
            const items = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                const isSensitive = /token|secret|password|key|credential|auth/i.test(key);
                items.push({
                    key: key,
                    size: value ? value.length : 0,
                    isSensitive: isSensitive,
                });
            }
            return items;
        }""")
        sensitive_items = [s for s in storage_audit if s["isSensitive"]]
        add("Security", "LocalStorage Sensitive Data", "WARN" if sensitive_items else "PASS",
            f"Sensitive keys: {[(s['key'] + ': ' + str(s['size']) + ' chars') for s in sensitive_items]}", "High")
        add("Security", "LocalStorage Total", "INFO",
            f"Total items: {len(storage_audit)}. All keys: {[s['key'] for s in storage_audit]}")

        # Inline scripts with sensitive data
        inline_scripts = page.evaluate("""() => {
            const scripts = document.querySelectorAll('script:not([src])');
            let issues = 0;
            scripts.forEach(s => {
                const t = s.textContent || '';
                if (/api_key|secret|token|password/i.test(t) && !/localStorage|sessionStorage/.test(t)) {
                    issues++;
                }
            });
            return {total: scripts.length, suspicious: issues};
        }""")
        add("Security", "Inline Scripts", "PASS" if inline_scripts["suspicious"] == 0 else "WARN",
            f"Total inline scripts: {inline_scripts['total']}, Suspicious: {inline_scripts['suspicious']}", "Medium")

        # javascript: URLs
        js_urls = page.evaluate("""() => {
            const links = [];
            document.querySelectorAll('a[href^="javascript:"]').forEach(a => {
                links.push(a.href.substring(0, 50));
            });
            return links;
        }""")
        add("Security", "XSS - javascript: URLs", "PASS" if not js_urls else "FAIL",
            f"Found {len(js_urls)} javascript: URLs", "Critical")

        # External resources
        external_res = page.evaluate("""() => {
            return Array.from(document.querySelectorAll('script[src], link[href]')).map(el => {
                const src = el.src || el.href || '';
                return src;
            }).filter(src => src && !src.includes('localhost') && !src.startsWith('data:'));
        }""")
        add("Security", "External Resources", "INFO", f"External: {external_res}")

        # Meta tags / CSP
        meta_audit = page.evaluate("""() => {
            const metas = {};
            document.querySelectorAll('meta').forEach(m => {
                const name = m.getAttribute('name') || m.getAttribute('http-equiv') || m.getAttribute('property');
                if (name) metas[name] = (m.getAttribute('content') || '').substring(0, 100);
            });
            return metas;
        }""")
        has_csp = 'content-security-policy' in str(meta_audit).lower()
        add("Security", "Content Security Policy", "WARN" if not has_csp else "PASS",
            f"CSP in meta: {has_csp}. Meta tags: {list(meta_audit.keys())[:10]}", "Medium")

        # Cross-portal data leakage
        portal_data = page.evaluate("""() => {
            const html = document.body.innerHTML.toLowerCase();
            return {
                adminData: html.includes('admin dashboard') || html.includes('admin panel'),
                partnerData: html.includes('restaurant dashboard') || html.includes('partner portal'),
                driverData: html.includes('driver dashboard') || html.includes('driver portal'),
                revenueData: html.includes('total revenue') || html.includes('earnings summary'),
            };
        }""")
        has_leak = any(portal_data.values())
        add("Security", "Cross-Portal Data Leakage", "FAIL" if has_leak else "PASS",
            f"Portal data exposed: {portal_data}", "Critical" if has_leak else "Low")

        # Password field autocomplete
        pw_fields = page.evaluate("""() => {
            return Array.from(document.querySelectorAll('input[type="password"]')).map(el => ({
                autocomplete: el.getAttribute('autocomplete'),
                name: el.name,
            }));
        }""")
        un_safe_autocomplete = [p for p in pw_fields if p.get("autocomplete") not in ["off", "new-password", "current-password", None]]
        add("Security", "Password Field Autocomplete", "WARN" if un_safe_autocomplete else "PASS",
            f"Unsafe autocomplete: {un_safe_autocomplete}", "Low")

        # ==================== SECTION 8: CONSOLE ERRORS ====================
        errors = [m for m in console_msgs if "[error]" in m]
        warnings = [m for m in console_msgs if "[warning]" in m]
        add("Functional", "Console Errors", "WARN" if errors else "PASS",
            f"Errors: {len(errors)}, Warnings: {len(warnings)}. First 3: {[e[:150] for e in errors[:3]]}", "Medium")

        add("API", "Network Errors", "WARN" if network_errors else "PASS",
            f"Failed requests: {len(network_errors)}. Errors: {network_errors[:5]}", "High" if network_errors else "Low")

        add("API", "Supabase Requests", "INFO",
            f"Total Supabase requests: {len(requests)}")

    # ==================== SECTION 9: PROTECTED ROUTES ====================
    for route, desc in [("/admin", "Admin"), ("/partner", "Partner"), ("/driver", "Driver"), ("/fleet", "Fleet")]:
        pg = browser.new_context(viewport={"width": 390, "height": 844}).new_page()
        try:
            pg.goto(f"http://localhost:5173/nutrio{route}")
            pg.wait_for_timeout(2000)
            end_url = pg.url
            is_protected = route not in end_url or "/auth" in end_url or "/login" in end_url
            add("Security", f"Route Protection: {desc}", "PASS" if is_protected else "FAIL",
                f"Direct access to {route} -> {end_url}", "Critical" if not is_protected else "Low")
        except:
            add("Security", f"Route Protection: {desc}", "WARN", f"Timeout accessing {route}")
        finally:
            pg.context.close()

    # ==================== SECTION 10: 404 ====================
    pg404 = browser.new_context(viewport={"width": 390, "height": 844}).new_page()
    try:
        pg404.goto("http://localhost:5173/nutrio/nonexistent-page-xyz123")
        pg404.wait_for_timeout(2000)
        pg404.screenshot(timeout=10000, path="audit_404.png")
        add("Functional", "404 Page Handling", "INFO", f"URL: {pg404.url}")
    except:
        add("Functional", "404 Page Handling", "WARN", "Timeout on 404 page")
    finally:
        pg404.context.close()

    # ==================== SECTION 11: NETWORK OFFLINE ====================
    ctx_off = browser.new_context(viewport={"width": 390, "height": 844})
    pg_off = ctx_off.new_page()
    pg_off.goto("http://localhost:5173/nutrio/dashboard", timeout=15000)
    pg_off.wait_for_load_state("networkidle")
    pg_off.wait_for_timeout(2000)
    ctx_off.set_offline(True)
    try:
        pg_off.reload(timeout=10000)
    except:
        pass
    pg_off.wait_for_timeout(3000)
    pg_off.screenshot(timeout=10000, path="audit_offline.png")
    add("Edge Case", "Offline Behavior", "INFO", "Offline reload tested")
    ctx_off.close()

    # ==================== SECTION 12: DUPLICATE API CALLS (N+1) ====================
    if requests:
        from collections import Counter
        url_counts = Counter(r.split("?")[0].split(" ")[-1][:80] for r in requests)
        dupes = {k: v for k, v in url_counts.items() if v > 2}
        add("Performance", "Duplicate API Calls", "WARN" if dupes else "PASS",
            f"Duplicated (>2x): {dupes}", "Medium" if dupes else "Low")

    browser.close()

with open("audit_full_results.json", "w") as f:
    json.dump(RESULTS, f, indent=2)

print(f"\n{'='*60}")
print(f"AUDIT COMPLETE: {len(RESULTS)} findings")
print(f"{'='*60}")
for r in RESULTS:
    if r["status"] in ["FAIL", "WARN"]:
        print(f"  [{r['status']}] [{r['severity']}] {r['test']}: {r['details'][:120]}")