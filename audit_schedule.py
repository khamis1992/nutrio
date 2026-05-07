from playwright.sync_api import sync_playwright
import json
import time

ERRORS = []
WARNINGS = []
FINDINGS = []

def log_error(category, desc, severity="Critical"):
    ERRORS.append({"category": category, "description": desc, "severity": severity})
    print(f"[ERROR][{severity}] {category}: {desc}")

def log_warning(category, desc):
    WARNINGS.append({"category": category, "description": desc})
    print(f"[WARN] {category}: {desc}")

def log_info(category, desc):
    FINDINGS.append({"category": category, "description": desc})
    print(f"[INFO] {category}: {desc}")

def audit_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Capture console logs
        console_messages = []
        page.on("console", lambda msg: console_messages.append({
            "type": msg.type,
            "text": msg.text
        }) if msg.type == "error" else None)

        # Capture network requests
        network_requests = []
        page.on("request", lambda req: network_requests.append({
            "url": req.url,
            "method": req.method,
            "resource_type": req.resource_type
        }))

        # Capture failed requests
        failed_requests = []
        page.on("requestfailed", lambda req: failed_requests.append({
            "url": req.url,
            "failure": req.failure,
            "resource_type": req.resource_type
        }))

        # Navigate to page
        print("=" * 80)
        print("NAVIGATING TO: http://localhost:5173/nutrio/schedule")
        print("=" * 80)

        try:
            page.goto("http://localhost:5173/nutrio/schedule", wait_until="networkidle", timeout=30000)
            time.sleep(3)  # Allow dynamic content
        except Exception as e:
            log_error("Navigation", f"Failed to load page: {str(e)}")
            browser.close()
            return

        # Take screenshot
        try:
            page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_schedule.png", full_page=True)
            print("[INFO] Screenshot saved to audit_schedule.png")
        except Exception as e:
            log_warning("Screenshot", f"Could not capture screenshot: {e}")

        # Get page title
        try:
            title = page.title()
            log_info("Page", f"Title: {title}")
        except Exception as e:
            log_error("Page", f"Could not get title: {e}")

        # Inspect DOM structure
        print("\n" + "=" * 80)
        print("DOM STRUCTURE ANALYSIS")
        print("=" * 80)

        # Check for main containers
        selectors_to_check = [
            ("main", "Main content area"),
            ("header", "Header"),
            ("nav", "Navigation"),
            ("footer", "Footer"),
            ("button", "Buttons"),
            ("a", "Links"),
            ("input", "Input fields"),
            ("select", "Select dropdowns"),
            ("form", "Forms"),
            ("[role=\"button\"]", "Role buttons"),
            ("[role=\"navigation\"]", "Navigation landmarks"),
            ("[role=\"main\"]", "Main landmarks"),
        ]

        for selector, description in selectors_to_check:
            try:
                elements = page.locator(selector).all()
                count = len(elements)
                if count > 0:
                    log_info(f"DOM - {description}", f"Found {count} {selector} elements")
            except Exception as e:
                log_warning(f"DOM - {description}", f"Error checking {selector}: {e}")

        # Check for loading states
        print("\n" + "=" * 80)
        print("LOADING STATE CHECK")
        print("=" * 80)

        loading_selectors = [
            "[class*='skeleton']",
            "[class*='loading']",
            "[class*='spinner']",
            "[role='progressbar']",
            "[aria-busy='true']"
        ]

        for selector in loading_selectors:
            try:
                elements = page.locator(selector).all()
                if elements:
                    log_warning("Loading State", f"Still loading: {selector} found")
            except:
                pass

        # Check for error states
        print("\n" + "=" * 80)
        print("ERROR STATE CHECK")
        print("=" * 80)

        error_selectors = [
            "[class*='error']",
            "[class*='failed']",
            "[role='alert']",
            "[aria-invalid='true']"
        ]

        for selector in error_selectors:
            try:
                elements = page.locator(selector).all()
                if elements:
                    for el in elements:
                        text = el.inner_text()[:100] if el.inner_text() else ""
                        log_warning("Error State", f"Found error element: {text}")
            except:
                pass

        # Check for empty states
        print("\n" + "=" * 80)
        print("EMPTY STATE CHECK")
        print("=" * 80)

        empty_selectors = [
            "[class*='empty']",
            "[class*='no-data']",
            "[class*='no-results']"
        ]

        for selector in empty_selectors:
            try:
                elements = page.locator(selector).all()
                if elements:
                    for el in elements:
                        text = el.inner_text()[:100] if el.inner_text() else ""
                        log_info("Empty State", f"Empty state found: {text}")
            except:
                pass

        # Check for cards/widgets
        print("\n" + "=" * 80)
        print("WIDGET/CARD ANALYSIS")
        print("=" * 80)

        card_selectors = [
            ("[class*='card']", "Cards"),
            ("[class*='widget']", "Widgets"),
            ("[class*='tile']", "Tiles"),
            ("[class*='meal']", "Meal items"),
            ("[class*='plan']", "Plan items"),
        ]

        for selector, name in card_selectors:
            try:
                elements = page.locator(selector).all()
                if elements:
                    log_info(f"UI - {name}", f"Found {len(elements)} {name}")
            except:
                pass

        # Test interactive elements
        print("\n" + "=" * 80)
        print("INTERACTIVE ELEMENTS TEST")
        print("=" * 80)

        buttons = page.locator("button").all()
        log_info("Interactive", f"Found {len(buttons)} buttons")

        for i, btn in enumerate(buttons[:10]):  # Test first 10
            try:
                btn_text = btn.inner_text()[:50] if btn.inner_text() else ""
                is_disabled = btn.is_disabled()
                is_visible = btn.is_visible()
                log_info(f"Button {i+1}", f"'{btn_text[:30]}' - disabled:{is_disabled}, visible:{is_visible}")
            except Exception as e:
                log_warning(f"Button {i+1}", f"Could not inspect: {e}")

        # Test form inputs
        inputs = page.locator("input").all()
        log_info("Interactive", f"Found {len(inputs)} input fields")

        for i, inp in enumerate(inputs[:5]):  # Test first 5
            try:
                inp_type = inp.get_attribute("type") or "text"
                inp_name = inp.get_attribute("name") or ""
                inp_placeholder = inp.get_attribute("placeholder") or ""
                is_disabled = inp.is_disabled()
                log_info(f"Input {i+1}", f"type:{inp_type}, name:{inp_name}, placeholder:{inp_placeholder}, disabled:{is_disabled}")
            except Exception as e:
                log_warning(f"Input {i+1}", f"Could not inspect: {e}")

        # Test dropdowns
        selects = page.locator("select").all()
        log_info("Interactive", f"Found {len(selects)} select dropdowns")

        # Analyze links
        print("\n" + "=" * 80)
        print("LINK ANALYSIS")
        print("=" * 80)

        links = page.locator("a").all()
        log_info("Navigation", f"Found {len(links)} links")

        hrefs = []
        for link in links[:20]:  # First 20
            try:
                href = link.get_attribute("href")
                text = link.inner_text()[:40]
                if href:
                    hrefs.append(href)
                    log_info(f"Link", f"'{text}' -> {href}")
            except:
                pass

        # Check for broken images
        print("\n" + "=" * 80)
        print("RESOURCE VALIDATION")
        print("=" * 80)

        images = page.locator("img").all()
        log_info("Resources", f"Found {len(images)} images")

        # Network analysis
        print("\n" + "=" * 80)
        print("NETWORK REQUEST ANALYSIS")
        print("=" * 80)

        # Group by type
        api_calls = [r for r in network_requests if "api" in r["url"].lower() or "supabase" in r["url"].lower()]
        static_resources = [r for r in network_requests if r["resource_type"] in ["script", "stylesheet", "image", "font"]]

        log_info("Network", f"Total requests: {len(network_requests)}")
        log_info("Network", f"API calls: {len(api_calls)}")
        log_info("Network", f"Static resources: {len(static_resources)}")

        if failed_requests:
            log_warning("Network", f"Failed requests: {len(failed_requests)}")
            for req in failed_requests[:5]:
                log_warning("Network", f"  FAILED: {req['url']} - {req['failure']}")

        # Check for console errors
        print("\n" + "=" * 80)
        print("CONSOLE ERROR ANALYSIS")
        print("=" * 80)

        errors_only = [m for m in console_messages if m["type"] == "error"]
        if errors_only:
            log_error("Console", f"Found {len(errors_only)} console errors")
            for err in errors_only[:10]:
                log_error("Console", f"  {err['text'][:200]}")
        else:
            log_info("Console", "No console errors detected")

        # Check accessibility basics
        print("\n" + "=" * 80)
        print("ACCESSIBILITY BASICS")
        print("=" * 80)

        # Check for aria labels on buttons without text
        buttons_no_text = []
        for btn in page.locator("button").all():
            try:
                has_text = bool(btn.inner_text().strip())
                has_aria = bool(btn.get_attribute("aria-label"))
                if not has_text and not has_aria:
                    buttons_no_text.append(btn)
            except:
                pass

        if buttons_no_text:
            log_warning("Accessibility", f"Found {len(buttons_no_text)} buttons without text or aria-label")

        # Check for images without alt
        images_no_alt = []
        for img in page.locator("img").all():
            try:
                alt = img.get_attribute("alt")
                if alt is None:
                    images_no_alt.append(img)
            except:
                pass

        if images_no_alt:
            log_warning("Accessibility", f"Found {len(images_no_alt)} images without alt text")

        # Check for form labels
        inputs_no_label = []
        for inp in page.locator("input").all():
            try:
                has_label = bool(inp.get_attribute("aria-label") or inp.get_attribute("aria-labelledby") or page.locator(f"label[for='{inp.get_attribute('id')}']").count() > 0)
                if not has_label:
                    inputs_no_label.append(inp)
            except:
                pass

        if inputs_no_label:
            log_warning("Accessibility", f"Found {len(inputs_no_label)} inputs without labels")

        # Check viewport responsiveness
        print("\n" + "=" * 80)
        print("RESPONSIVENESS CHECK")
        print("=" * 80)

        viewports = [
            {"width": 375, "height": 667, "name": "iPhone SE"},
            {"width": 390, "height": 844, "name": "iPhone 12"},
            {"width": 768, "height": 1024, "name": "iPad"},
            {"width": 1024, "height": 768, "name": "iPad Landscape"},
        ]

        for vp in viewports:
            page.set_viewport_size(vp)
            time.sleep(0.5)
            # Check horizontal scroll
            scroll_width = page.evaluate("document.documentElement.scrollWidth")
            viewport_width = vp["width"]
            if scroll_width > viewport_width:
                log_warning("Responsive", f"{vp['name']}: Content overflows ({scroll_width}px > {viewport_width}px)")
            else:
                log_info("Responsive", f"{vp['name']}: No overflow detected")

        # Reset viewport
        page.set_viewport_size({"width": 1440, "height": 900})

        # Check for security issues
        print("\n" + "=" * 80)
        print("SECURITY CHECKS")
        print("=" * 80)

        # Check for localStorage/sessionStorage usage
        storage_code = page.evaluate("""
            () => {
                const checks = [];
                try {
                    localStorage.setItem('test', 'test');
                    localStorage.removeItem('test');
                    checks.push('localStorage accessible');
                } catch(e) {
                    checks.push('localStorage blocked: ' + e.message);
                }
                try {
                    sessionStorage.setItem('test', 'test');
                    sessionStorage.removeItem('test');
                    checks.push('sessionStorage accessible');
                } catch(e) {
                    checks.push('sessionStorage blocked: ' + e.message);
                }
                return checks;
            }
        """)
        for check in storage_code:
            log_info("Security", f"Storage: {check}")

        # Check for sensitive data in DOM
        sensitive_patterns = ["password", "secret", "token", "key", "api_key", "apikey", "authorization"]
        dom_text = page.content()
        for pattern in sensitive_patterns:
            if pattern.lower() in dom_text.lower():
                log_warning("Security", f"Potentially sensitive pattern '{pattern}' found in DOM")

        # Final screenshot
        page.screenshot(path="C:/Users/khamis/Documents/nutrio/audit_schedule_final.png", full_page=True)

        browser.close()

        # Generate report
        print("\n" + "=" * 80)
        print("AUDIT COMPLETE - SUMMARY")
        print("=" * 80)
        print(f"Total Errors: {len(ERRORS)}")
        print(f"Total Warnings: {len(WARNINGS)}")
        print(f"Total Findings: {len(FINDINGS)}")

        return {
            "errors": ERRORS,
            "warnings": WARNINGS,
            "findings": FINDINGS
        }

if __name__ == "__main__":
    results = audit_page()
    with open("C:/Users/khamis/Documents/nutrio/audit_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\n[INFO] Results saved to audit_results.json")