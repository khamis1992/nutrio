from playwright.sync_api import sync_playwright, Page, Browser
import json
import time
from datetime import datetime

class DashboardAuditor:
    def __init__(self):
        self.findings = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": [],
            "ux_opportunities": [],
            "security": [],
            "performance": [],
            "missing_coverage": []
        }
        self.console_logs = {"errors": [], "warnings": [], "info": []}
        self.network_requests = []
        self.screenshots_taken = []
        
    def capture_console(self, page: Page):
        def handle_console(msg):
            level = msg.type
            text = msg.text
            if level == "error":
                self.console_logs["errors"].append(text)
            elif level == "warning":
                self.console_logs["warnings"].append(text)
            else:
                self.console_logs["info"].append(text)
        
        page.on("console", handle_console)
        
    def capture_network(self, page: Page):
        def handle_request(request):
            self.network_requests.append({
                "url": request.url,
                "method": request.method,
                "status": request.method,
                "timestamp": datetime.now().isoformat()
            })
            
        def handle_response(response):
            for req in self.network_requests:
                if req["url"] == response.url:
                    req["status"] = response.status
                    
        page.on("request", handle_request)
        page.on("response", handle_response)
        
    def take_screenshot(self, page: Page, name: str):
        path = f"/tmp/audit_{name}_{int(time.time())}.png"
        page.screenshot(path=path, full_page=True)
        self.screenshots_taken.append(path)
        print(f"    Screenshot: {path}")
        return path
    
    def add_finding(self, severity: str, category: str, finding: dict):
        finding["severity"] = severity
        finding["category"] = category
        finding["timestamp"] = datetime.now().isoformat()
        
        if severity == "critical":
            self.findings["critical"].append(finding)
        elif severity == "high":
            self.findings["high"].append(finding)
        elif severity == "medium":
            self.findings["medium"].append(finding)
        elif severity == "low":
            self.findings["low"].append(finding)
            
        if category == "ux":
            self.findings["ux_opportunities"].append(finding)
        elif category == "security":
            self.findings["security"].append(finding)
        elif category == "performance":
            self.findings["performance"].append(finding)
        elif category == "coverage":
            self.findings["missing_coverage"].append(finding)
    
    def safe_locator_all(self, page: Page, selector: str):
        try:
            return page.locator(selector).all()
        except:
            return []
    
    def safe_locator_count(self, page: Page, selector: str):
        try:
            return page.locator(selector).count()
        except:
            return 0
    
    def get_page_text(self, page: Page) -> str:
        try:
            return page.inner_text("body")
        except:
            return ""
    
    def audit_functional(self, page: Page):
        print("  [1/18] Auditing Functional Testing...")
        
        buttons = self.safe_locator_all(page, "button")
        print(f"    Found {len(buttons)} buttons")
        
        links = self.safe_locator_all(page, "a")
        print(f"    Found {len(links)} links")
        
        cards = self.safe_locator_all(page, "[class*='card'], [class*='Card']")
        print(f"    Found {len(cards)} card elements")
        
        inputs = self.safe_locator_all(page, "input, select, textarea")
        print(f"    Found {len(inputs)} input elements")
        
        loading = self.safe_locator_all(page, "[class*='loading'], [class*='skeleton'], [class*='spinner']")
        print(f"    Found {len(loading)} loading indicators")
        
        empty_states = self.safe_locator_all(page, "[class*='empty'], [class*='Empty']")
        print(f"    Found {len(empty_states)} empty state elements")
        
        # Get page text to understand what's rendered
        page_text = self.get_page_text(page)[:500]
        print(f"    Page preview: {page_text[:200]}...")
        
    def audit_e2e(self, page: Page):
        print("  [2/18] Auditing E2E Journeys...")
        
        nav_links = self.safe_locator_all(page, "nav a, header a")
        print(f"    Found {len(nav_links)} navigation links")
        
        ctas = page.locator("button").all()
        cta_texts = []
        for cta in ctas:
            try:
                cta_texts.append(cta.inner_text().strip()[:50])
            except:
                pass
        print(f"    CTA texts: {cta_texts}")
        
    def audit_rollback(self, page: Page):
        print("  [3/18] Auditing Rollback/Cancel Flows...")
        
        back_buttons = self.safe_locator_all(page, "[aria-label*='ack'], [aria-label*='ancel']")
        print(f"    Found {len(back_buttons)} back/cancel buttons")
        
    def audit_integration(self, page: Page):
        print("  [4/18] Auditing Integrations...")
        
        api_requests = [r for r in self.network_requests if any(x in r["url"].lower() for x in ["/rest/", "/api/", "supabase", "functions"])]
        print(f"    Found {len(api_requests)} API requests")
        
        for req in api_requests[:5]:
            print(f"      - {req['method']} {req['url'][:80]} ({req.get('status', 'pending')})")
        
    def audit_unit_tests(self, page: Page):
        print("  [5/18] Auditing Unit Test Coverage...")
        
        import os
        test_dirs = []
        src_path = "src"
        if os.path.exists(src_path):
            for root, dirs, files in os.walk(src_path):
                for f in files:
                    if "test" in f.lower() or "spec" in f.lower():
                        test_dirs.append(os.path.join(root, f))
                        
        print(f"    Found {len(test_dirs)} test files")
        
    def audit_regression(self, page: Page):
        print("  [6/18] Auditing Regression Issues...")
        
        broken_images = []
        for img in self.safe_locator_all(page, "img"):
            try:
                src = img.get_attribute("src")
                if src and "placeholder" in src.lower():
                    broken_images.append(src)
            except:
                pass
        print(f"    Found {len(broken_images)} broken images")
        
    def audit_permissions(self, page: Page):
        print("  [7/18] Auditing Permission/Role Testing...")
        
        sensitive_keywords = ["admin", "partner", "driver", "fleet", "internal", "debug"]
        page_html = page.content().lower() if page.content() else ""
        
        for keyword in sensitive_keywords:
            count = page_html.count(keyword)
            if count > 0:
                print(f"    '{keyword}' appears {count} times in page")
                
    def audit_edge_cases(self, page: Page):
        print("  [8/18] Auditing Edge Cases...")
        
        error_elements = self.safe_locator_all(page, "[class*='error'], [class*='Error']")
        print(f"    Found {len(error_elements)} error elements")
        
        disabled_elements = self.safe_locator_all(page, "[disabled]")
        print(f"    Found {len(disabled_elements)} disabled elements")
        
    def audit_data_integrity(self, page: Page):
        print("  [9/18] Auditing Data Integrity...")
        
        price_elements = self.safe_locator_all(page, "[class*='price'], [class*='Price']")
        print(f"    Found {len(price_elements)} price elements")
        
    def audit_financial(self, page: Page):
        print("  [10/18] Auditing Financial Elements...")
        
        wallet_elements = self.safe_locator_all(page, "[class*='wallet'], [class*='Wallet']")
        print(f"    Found {len(wallet_elements)} wallet elements")
        
        balance_elements = self.safe_locator_all(page, "[class*='balance'], [class*='Balance']")
        print(f"    Found {len(balance_elements)} balance elements")
        
    def audit_performance(self, page: Page):
        print("  [11/18] Auditing Performance...")
        
        metrics = page.evaluate("""
            () => {
                const timing = performance.getEntriesByType('navigation')[0];
                const paint = performance.getEntriesByType('paint');
                return {
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.startTime,
                    loadComplete: timing.loadEventEnd - timing.startTime,
                    firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                    firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
                };
            }
        """)
        
        print(f"    DOM Content Loaded: {metrics['domContentLoaded']:.2f}ms")
        print(f"    Load Complete: {metrics['loadComplete']:.2f}ms")
        print(f"    First Paint: {metrics['firstPaint']:.2f}ms")
        print(f"    First Contentful Paint: {metrics['firstContentfulPaint']:.2f}ms")
        
        if metrics['loadComplete'] > 3000:
            self.add_finding("high", "performance", {
                "description": "Page load time exceeds 3 seconds",
                "actual": f"{metrics['loadComplete']:.2f}ms",
                "expected": "<3000ms"
            })
        
        large_images = page.evaluate("""
            () => Array.from(document.images)
                .filter(img => img.naturalWidth > 1920 || img.naturalHeight > 1080)
                .map(img => ({src: img.src.substring(0, 100), w: img.naturalWidth, h: img.naturalHeight}))
        """)
        if large_images:
            print(f"    Found {len(large_images)} large images")
            
    def audit_security(self, page: Page):
        print("  [12/18] Auditing Security...")
        
        storage_keys = page.evaluate("""
            () => {
                const keys = [];
                try { 
                    for (let i = 0; i < localStorage.length; i++) {
                        keys.push({key: localStorage.key(i), type: 'localStorage'});
                    }
                } catch(e) {}
                try {
                    for (let i = 0; i < sessionStorage.length; i++) {
                        keys.push({key: sessionStorage.key(i), type: 'sessionStorage'});
                    }
                } catch(e) {}
                return keys;
            }
        """)
        
        print(f"    Found {len(storage_keys)} items in storage")
        
        sensitive_keys = ["token", "key", "secret", "password", "auth", "credential"]
        for item in storage_keys:
            for sk in sensitive_keys:
                if sk in item["key"].lower():
                    self.add_finding("high", "security", {
                        "description": f"Sensitive data potentially stored in {item['type']}",
                        "key": item["key"],
                        "type": item["type"]
                    })
        
        insecure_resources = [r for r in self.network_requests if r["url"].startswith("http://")]
        if insecure_resources:
            self.add_finding("medium", "security", {
                "description": "Insecure HTTP resources loaded",
                "count": len(insecure_resources)
            })
        
    def audit_ui_ux(self, page: Page):
        print("  [13/18] Auditing UI/UX...")
        
        buttons_without_aria = 0
        for btn in self.safe_locator_all(page, "button"):
            try:
                if not btn.get_attribute("aria-label") and not btn.inner_text().strip():
                    buttons_without_aria += 1
            except:
                pass
                
        images_without_alt = 0
        for img in self.safe_locator_all(page, "img"):
            try:
                if not img.get_attribute("alt"):
                    images_without_alt += 1
            except:
                pass
        
        print(f"    Buttons without aria-label: {buttons_without_aria}")
        print(f"    Images without alt text: {images_without_alt}")
        
        if images_without_alt > 0:
            self.add_finding("medium", "ux", {
                "description": f"{images_without_alt} images missing alt text"
            })
            
    def audit_mobile(self, page: Page):
        print("  [14/18] Auditing Mobile Responsiveness...")
        
        viewports = [
            ("iPhone 12 Pro", 390, 844),
            ("iPad Pro", 1024, 1366),
            ("Small Android", 360, 640),
        ]
        
        for name, width, height in viewports:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(300)
            
            scroll_width = page.evaluate("() => document.body.scrollWidth")
            if scroll_width > width:
                self.add_finding("medium", "ux", {
                    "description": f"Horizontal overflow on {name}",
                    "viewport": f"{width}x{height}",
                    "scrollWidth": scroll_width
                })
        
        page.set_viewport_size({"width": 1280, "height": 720})
        
    def audit_browser_compat(self, page: Page):
        print("  [15/18] Auditing Browser Compatibility...")
        
        prefixed_css = page.evaluate("""
            () => {
                let count = 0;
                document.querySelectorAll('style').forEach(s => {
                    if (s.textContent.includes('-webkit-') || s.textContent.includes('-moz-')) {
                        count++;
                    }
                });
                return count;
            }
        """)
        print(f"    Found {prefixed_css} vendor-prefixed style blocks")
        
    def audit_api(self, page: Page):
        print("  [16/18] Auditing API Calls...")
        
        api_calls = [r for r in self.network_requests if any(x in r["url"].lower() for x in ["/rest/", "/api/", "supabase", "functions"])]
        print(f"    Total API calls: {len(api_calls)}")
        
        failed = [r for r in api_calls if r.get("status") and isinstance(r.get("status"), int) and r["status"] >= 400]
        if failed:
            print(f"    Failed requests: {len(failed)}")
            
    def audit_database(self, page: Page):
        print("  [17/18] Auditing Database Dependencies...")
        
        db_elements = self.safe_locator_all(page, "[class*='database'], [class*='DB']")
        print(f"    DB-related elements: {len(db_elements)}")
        
    def audit_monitoring(self, page: Page):
        print("  [18/18] Auditing Monitoring/Logging...")
        
        error_count = len(self.console_logs["errors"])
        print(f"    Console errors: {error_count}")
        
        if error_count > 0:
            for err in self.console_logs["errors"][:3]:
                print(f"      - {err[:100]}")
            self.add_finding("medium", "performance", {
                "description": f"{error_count} console errors detected",
                "errors": self.console_logs["errors"][:5]
            })
            
    def generate_report(self) -> dict:
        return {
            "findings": self.findings,
            "console_logs": self.console_logs,
            "network_requests": len(self.network_requests),
            "screenshots": self.screenshots_taken
        }


def main():
    print("=" * 60)
    print("NUTRIO CUSTOMER DASHBOARD - ENTERPRISE AUDIT")
    print("=" * 60)
    print()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            locale="en-US"
        )
        page = context.new_page()
        
        auditor = DashboardAuditor()
        auditor.capture_console(page)
        auditor.capture_network(page)
        
        print("[START] Navigating to dashboard...")
        start_time = time.time()
        
        try:
            response = page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=45000)
            load_time = time.time() - start_time
            print(f"[OK] Page loaded in {load_time:.2f}s, Status: {response.status}")
            print(f"[INFO] Current URL: {page.url}")
        except Exception as e:
            print(f"[ERROR] Failed to load page: {e}")
            auditor.add_finding("critical", "general", {
                "description": "Page failed to load",
                "error": str(e)
            })
            browser.close()
            return
        
        auditor.take_screenshot(page, "initial")
        
        page.wait_for_timeout(3000)
        
        print()
        print("[AUDIT] Starting comprehensive audit...")
        print()
        
        auditor.audit_functional(page)
        auditor.audit_e2e(page)
        auditor.audit_rollback(page)
        auditor.audit_integration(page)
        auditor.audit_unit_tests(page)
        auditor.audit_regression(page)
        auditor.audit_permissions(page)
        auditor.audit_edge_cases(page)
        auditor.audit_data_integrity(page)
        auditor.audit_financial(page)
        auditor.audit_performance(page)
        auditor.take_screenshot(page, "post_functional")
        
        auditor.audit_security(page)
        auditor.audit_ui_ux(page)
        auditor.audit_mobile(page)
        auditor.audit_browser_compat(page)
        auditor.audit_api(page)
        auditor.audit_database(page)
        auditor.audit_monitoring(page)
        
        auditor.take_screenshot(page, "final")
        
        print()
        print("[COMPLETE] Generating report...")
        
        report = auditor.generate_report()
        
        total_issues = (
            len(report["findings"]["critical"]) +
            len(report["findings"]["high"]) +
            len(report["findings"]["medium"]) +
            len(report["findings"]["low"])
        )
        
        print()
        print("=" * 60)
        print("AUDIT SUMMARY")
        print("=" * 60)
        print(f"  Critical Issues: {len(report['findings']['critical'])}")
        print(f"  High Issues:     {len(report['findings']['high'])}")
        print(f"  Medium Issues:   {len(report['findings']['medium'])}")
        print(f"  Low Issues:      {len(report['findings']['low'])}")
        print(f"  Console Errors:  {len(report['console_logs']['errors'])}")
        print(f"  Network Requests: {report['network_requests']}")
        print(f"  Screenshots:     {len(report['screenshots'])}")
        print()
        
        with open("C:/tmp/dashboard_audit_report.json", "w") as f:
            json.dump(report, f, indent=2, default=str)
        print("Report saved to C:/tmp/dashboard_audit_report.json")
        
        browser.close()


if __name__ == "__main__":
    main()
