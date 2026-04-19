"""Phase 2: Comprehensive dashboard testing - auth flow, navigation, responsive, accessibility, API, performance"""
from playwright.sync_api import sync_playwright
import json, time, os

OUT = "C:/Users/khamis/Documents/nutrio/audit_screenshots"
os.makedirs(OUT, exist_ok=True)

results = {
    "auth_redirect": {"current_url": None, "redirect_detected": False},
    "responsive": {},
    "accessibility": {},
    "navigation": {},
    "api_network": {},
    "performance": {},
    "security": {},
    "functional": {},
    "edge_cases": {},
    "errors": [],
}

with sync_playwright() as p:
    # ========== TEST 1: Auth Protection ==========
    browser = p.chromium.launch(headless=True)
    
    # Test unauthenticated access redirects to auth
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)
    
    results["auth_redirect"]["current_url"] = page.url
    results["auth_redirect"]["redirect_detected"] = "/auth" in page.url
    page.screenshot(path=f"{OUT}/auth_redirect.png", full_page=True)
    
    # Check auth page elements
    if "/auth" in page.url:
        auth_elements = {
            "has_login_form": page.locator("input[type='email'], input[name='email'], input[placeholder*='email']").count() > 0,
            "has_password_field": page.locator("input[type='password']").count() > 0,
            "has_submit_button": page.locator("button[type='submit'], button:has-text('Sign'), button:has-text('Log')").count() > 0,
        }
        results["auth_redirect"]["auth_page_elements"] = auth_elements
        
        # Check that direct URL to admin/partner/driver redirects
        for route in ["/admin", "/partner", "/driver", "/fleet"]:
            test_page = browser.new_page()
            test_page.goto(f"http://localhost:5173/nutrio{route}", wait_until="networkidle", timeout=15000)
            test_page.wait_for_timeout(2000)
            final_url = test_page.url
            # Non-auth users should NOT see these pages
            results["auth_redirect"][f"access_{route.strip('/')}"] = {
                "url": final_url,
                "accessible_without_auth": route in final_url and "/auth" not in final_url
            }
            test_page.close()
    
    # ========== TEST 2: Protected route access ==========
    # Try accessing admin/partner/driver URLs directly
    for route in ["/admin/dashboard", "/partner/dashboard", "/driver/dashboard", "/fleet/dashboard"]:
        test_page = browser.new_page()
        test_page.goto(f"http://localhost:5173/nutrio{route}", wait_until="networkidle", timeout=15000)
        test_page.wait_for_timeout(2000)
        results["security"][f"direct_url_{route.strip('/').replace('/', '_')}"] = {
            "resolved_url": test_page.url,
            "shows_unauthorized_content": route in test_page.url
        }
        test_page.close()
    
    # ========== TEST 3: Responsive Design ==========
    viewports = {
        "iphone_se": {"width": 375, "height": 667},
        "iphone_14": {"width": 390, "height": 844},
        "iphone_14_pro_max": {"width": 430, "height": 932},
        "android_medium": {"width": 412, "height": 915},
        "android_small": {"width": 360, "height": 640},
        "ipad_mini": {"width": 768, "height": 1024},
        "ipad_pro": {"width": 1024, "height": 1366},
        "desktop": {"width": 1920, "height": 1080},
    }
    
    # Use auth page for responsive test since no session
    for name, vp in viewports.items():
        test_page = browser.new_page(viewport=vp)
        test_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=15000)
        test_page.wait_for_timeout(2000)
        test_page.screenshot(path=f"{OUT}/responsive_{name}.png", full_page=True)
        
        # Check overflow
        overflow = test_page.evaluate("""() => {
            const el = document.documentElement;
            return {
                horizontalOverflow: el.scrollWidth > el.clientWidth,
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                hasHorizontalScrollbar: document.body.scrollWidth > window.innerWidth,
            };
        }""")
        results["responsive"][name] = {"viewport": vp, "overflow": overflow, "final_url": test_page.url}
        test_page.close()
    
    # ========== TEST 4: Landscape mode ==========
    test_page = browser.new_page(viewport={"width": 844, "height": 390})  # Landscape iPhone 14
    test_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=15000)
    test_page.wait_for_timeout(2000)
    test_page.screenshot(path=f"{OUT}/responsive_landscape.png", full_page=True)
    test_page.close()
    
    # ========== TEST 5: Browser Compatibility (engines) ==========
    # Note: Playwright chromium approximates Chrome/Edge. Safari requires webkit.
    for engine_name, engine_type in [("chromium", "chromium"), ("firefox", "firefox"), ("webkit", "webkit")]:
        try:
            eng_browser = getattr(p, engine_type).launch(headless=True)
            eng_page = eng_browser.new_page(viewport={"width": 390, "height": 844})
            eng_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=20000)
            eng_page.wait_for_timeout(3000)
            eng_page.screenshot(path=f"{OUT}/browser_{engine_name}.png", full_page=True)
            
            errors = []
            eng_page.on("pageerror", lambda err: errors.append(str(err)))
            
            results[f"browser_{engine_name}"] = {
                "loaded": True,
                "url": eng_page.url,
                "error_count": len(errors),
                "errors": errors[:5]
            }
            eng_browser.close()
        except Exception as e:
            results[f"browser_{engine_name}"] = {"loaded": False, "error": str(e)}
    
    # ========== TEST 6: Security Checks ==========
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    
    # Check localStorage/sessionStorage for sensitive data
    storage_checks = page.evaluate("""() => {
        const ls = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            ls[key] = localStorage.getItem(key)?.substring(0, 100);
        }
        const ss = {};
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            ss[key] = sessionStorage.getItem(key)?.substring(0, 100);
        }
        return { localStorage: ls, sessionStorage: ss };
    }""")
    results["security"]["storage_contents"] = storage_checks
    
    # Check for sensitive tokens in storage
    sensitive_patterns = ["token", "key", "secret", "password", "credential", "apikey", "api_key"]
    found_sensitive = {}
    for storage_type, items in storage_checks.items():
        for key, value in items.items():
            key_lower = key.lower()
            for pattern in sensitive_patterns:
                if pattern in key_lower:
                    found_sensitive[f"{storage_type}.{key}"] = value[:50] + "..." if value and len(value) > 50 else value
    results["security"]["sensitive_keys_found"] = found_sensitive
    
    # Check cookies
    cookies = page.context.cookies()
    results["security"]["cookies"] = [
        {"name": c["name"], "httpOnly": c.get("httpOnly", False), "secure": c.get("secure", False), "sameSite": c.get("sameSite", "")}
        for c in cookies
    ]
    
    # Check for XSS vectors (script injection points)
    xss_check = page.evaluate("""() => {
        const allElements = document.querySelectorAll('*');
        const vhtml = [];
        allElements.forEach(el => {
            if (el.__vue__ || el._reactRootContainer) vhtml.push(el.tagName);
        });
        
        // Check for dangerouslySetInnerHTML
        const dangerous = document.querySelectorAll('[dangerouslySetInnerHTML]');
        
        // Check meta tags
        const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return {
            hasCsp: !!csp,
            cspContent: csp?.content || null,
            dangerousInnerHTML_count: dangerous.length,
            reactRoots: vhtml.length
        };
    }""")
    results["security"]["xss_checks"] = xss_check
    
    # ========== TEST 7: Performance Audit ==========
    perf_page = browser.new_page(viewport={"width": 390, "height": 844})
    
    network_timings = []
    perf_page.on("request", lambda req: network_timings.append({"url": req.url, "start": time.time(), "method": req.method}))
    perf_page.on("response", lambda resp: None)
    
    start = time.time()
    perf_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=30000)
    perf_page.wait_for_timeout(3000)
    total_load = time.time() - start
    
    # LCP, FCP, CLS
    web_vitals = perf_page.evaluate("""() => {
        return new Promise(resolve => {
            const results = {};
            const observer = new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                    results[entry.name] = {
                        value: entry.value || entry.startTime,
                        rating: entry.rating || 'unknown'
                    };
                }
            });
            observer.observe({ type: 'largest-contentful-paint', buffered: true });
            observer.observe({ type: 'first-contentful-paint', buffered: true });
            observer.observe({ type: 'layout-shift', buffered: true });
            
            setTimeout(() => {
                observer.disconnect();
                
                // Fallback FCP
                const fcp = performance.getEntriesByName('first-contentful-paint')[0];
                if (fcp) results['FCP'] = { value: fcp.startTime };
                
                resolve(results);
            }, 2000);
        });
    }""")
    
    resource_count = perf_page.evaluate("() => performance.getEntriesByType('resource').length")
    total_transfer = perf_page.evaluate("() => performance.getEntriesByType('resource').reduce((sum, r) => sum + (r.transferSize || 0), 0)")
    
    results["performance"] = {
        "total_load_seconds": round(total_load, 2),
        "web_vitals": web_vitals,
        "resource_count": resource_count,
        "total_transfer_bytes": total_transfer,
        "dom_count": perf_page.evaluate("() => document.querySelectorAll('*').length"),
    }
    perf_page.close()
    
    # ========== TEST 8: API Network Analysis ==========
    api_page = browser.new_page(viewport={"width": 390, "height": 844})
    api_calls = []
    api_page.on("request", lambda req: api_calls.append({
        "url": req.url, "method": req.method, "headers": dict(req.headers)
    }) if "supabase" in req.url else None)
    api_page.on("response", lambda resp: None)
    
    api_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=20000)
    api_page.wait_for_timeout(5000)
    
    results["api_network"] = {
        "supabase_calls": [c for c in api_calls if "supabase" in c.get("url", "")],
        "total_calls": len(api_calls),
        "external_calls": [c["url"] for c in api_calls if not c["url"].startswith("http://localhost")],
    }
    api_page.close()
    
    # ========== TEST 9: Accessibility Audit ==========
    a11y_page = browser.new_page(viewport={"width": 390, "height": 844})
    a11y_page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=20000)
    a11y_page.wait_for_timeout(2000)
    
    a11y_results = a11y_page.evaluate("""() => {
        const issues = [];
        
        // Check images without alt
        document.querySelectorAll('img').forEach(img => {
            if (!img.alt || img.alt.trim() === '') {
                issues.push({type: 'img-no-alt', src: img.src.substring(0, 80)});
            }
        });
        
        // Check buttons without accessible names  
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent?.trim();
            const ariaLabel = btn.getAttribute('aria-label');
            const ariaLabelledBy = btn.getAttribute('aria-labelledby');
            const title = btn.getAttribute('title');
            const hasImgAlt = btn.querySelector('img[alt]');
            if (!text && !ariaLabel && !ariaLabelledBy && !title && !hasImgAlt) {
                issues.push({type: 'button-no-name', classes: btn.className.substring(0, 60)});
            }
        });
        
        // Check links without accessible names
        document.querySelectorAll('a').forEach(a => {
            const text = a.textContent?.trim();
            const ariaLabel = a.getAttribute('aria-label');
            if (!text && !ariaLabel) {
                issues.push({type: 'link-no-name', href: a.href?.substring(0, 80)});
            }
        });
        
        // Check color contrast (simplified - just font sizes)
        document.querySelectorAll('p, span, div, a, button, label').forEach(el => {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            if (fontSize > 0 && fontSize < 11) {
                issues.push({type: 'tiny-font', fontSize, text: el.textContent?.substring(0, 30)});
            }
        });
        
        // Check focus indicators
        const focusableCount = document.querySelectorAll('button, a, input, select, textarea, [tabindex]').length;
        
        // Check skip navigation
        const skipNav = document.querySelector('[href="#main"], [class*="skip"]');
        
        // Check heading hierarchy
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
            tag: h.tagName, text: h.textContent?.substring(0, 40)
        }));
        
        // Check ARIA roles
        const ariaRoles = document.querySelectorAll('[role]').length;
        
        return {
            issues,
            focusableCount,
            hasSkipNav: !!skipNav,
            headings,
            ariaRoleCount: ariaRoles,
            langAttr: document.documentElement.lang || 'missing',
        };
    }""")
    
    results["accessibility"] = a11y_results
    a11y_page.close()
    
    browser.close()

# Save all results
with open(f"{OUT}/comprehensive_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, default=str)

print(json.dumps(results, indent=2, default=str))