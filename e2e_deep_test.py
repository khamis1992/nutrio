"""
Nutrio Fuel E2E Test Suite - Deep Interaction Testing
"""
import time
import json
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:4173"
ACCOUNTS = {
    "customer": {"email": "eng.aljabor@gmail.com", "password": "123456789"},
    "partner": {"email": "khamis4everever@gmail.com", "password": "123456789"},
    "admin": {"email": "khamis-1992@hotmail.com", "password": "Khamees1992#"},
    "driver": {"email": "driver@nutriofuel.com", "password": "123456789"},
    "fleet": {"email": "admin@nutrio.com", "password": "Khamees1992#"},
}

REPORT = {
    "execution_start": datetime.now().isoformat(),
    "tests": [],
    "bugs": [],
    "workflows": [],
    "ui_issues": [],
    "performance_issues": [],
}


def log_test(name, status, details=""):
    print(f"[{status}] {name}")
    if details:
        print(f"       {details}")
    REPORT["tests"].append({
        "name": name,
        "status": status,
        "details": details,
        "timestamp": datetime.now().isoformat()
    })


def log_bug(title, severity, steps, expected, actual, role=""):
    print(f"\nBUG [{severity}]: {title}")
    REPORT["bugs"].append({
        "title": title,
        "severity": severity,
        "steps": steps,
        "expected": expected,
        "actual": actual,
        "role": role,
        "timestamp": datetime.now().isoformat()
    })


def log_workflow(name, status, details=""):
    REPORT["workflows"].append({
        "name": name,
        "status": status,
        "details": details,
        "timestamp": datetime.now().isoformat()
    })


def log_ui_issue(description, location=""):
    REPORT["ui_issues"].append({
        "description": description,
        "location": location,
        "timestamp": datetime.now().isoformat()
    })


def log_performance(message, location=""):
    REPORT["performance_issues"].append({
        "message": message,
        "location": location,
        "timestamp": datetime.now().isoformat()
    })


def login(page, email, password, role):
    try:
        page.goto(f"{BASE_URL}/auth", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        
        signin_btn = page.locator('button:has-text("Sign in")')
        if signin_btn.count() > 0:
            signin_btn.first.click()
            page.wait_for_timeout(3000)
        
        email_input = page.locator('#si-email')
        if email_input.count() == 0:
            return False
        email_input.fill(email)
        
        password_input = page.locator('#si-password')
        password_input.fill(password)
        
        submit_btn = page.locator('button:has-text("Sign in"):not(:has-text("up"))')
        if submit_btn.count() > 0:
            submit_btn.first.click()
        else:
            page.locator('button[type="submit"]').first.click()
        
        page.wait_for_timeout(8000)
        
        if "auth" in page.url and page.url.endswith("auth"):
            log_test(f"{role} login", "FAIL", f"Still on auth page")
            return False
        
        log_test(f"{role} login", "PASS", f"Redirected to: {page.url}")
        return True
        
    except Exception as e:
        log_test(f"{role} login", "FAIL", str(e))
        return False


def click_all_buttons(page, role, page_name, max_clicks=20):
    clicked = 0
    errors = []
    
    try:
        buttons = page.locator('button').all()
        print(f"  Found {len(buttons)} buttons on {page_name}")
        
        for i, btn in enumerate(buttons[:max_clicks]):
            try:
                btn_text = btn.inner_text().strip()
                if btn_text and len(btn_text) < 100:
                    btn.click()
                    page.wait_for_timeout(500)
                    clicked += 1
            except Exception as e:
                errors.append(str(e)[:100])
                
    except Exception as e:
        log_ui_issue(f"Error clicking buttons on {page_name}", f"{role} - {page_name}")
    
    return clicked, errors


def test_customer_workflow(browser):
    print("\n" + "="*60)
    print("CUSTOMER PORTAL - DEEP TEST")
    print("="*60)
    
    context = browser.new_context()
    page = context.new_page()
    role = "customer"
    
    try:
        if not login(page, ACCOUNTS["customer"]["email"], ACCOUNTS["customer"]["password"], role):
            log_bug("Customer login failed", "Critical", ["Login attempt"], "Success", "Failed", role)
            return
        
        page.wait_for_timeout(3000)
        
        # Test dashboard
        print(f"\n  Testing customer dashboard...")
        clicked, errors = click_all_buttons(page, role, "dashboard")
        print(f"  Clicked {clicked} buttons")
        
        # Test meals page
        print(f"\n  Testing customer meals...")
        page.goto(f"{BASE_URL}/meals", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        clicked, errors = click_all_buttons(page, role, "meals")
        print(f"  Clicked {clicked} buttons")
        
        # Test orders page
        print(f"\n  Testing customer orders...")
        page.goto(f"{BASE_URL}/orders", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        clicked, errors = click_all_buttons(page, role, "orders")
        print(f"  Clicked {clicked} buttons")
        
        # Test wallet page
        print(f"\n  Testing customer wallet...")
        page.goto(f"{BASE_URL}/wallet", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        clicked, errors = click_all_buttons(page, role, "wallet")
        print(f"  Clicked {clicked} buttons")
        
        log_workflow("Customer workflow", "COMPLETED")
        
    except Exception as e:
        log_bug("Customer test error", "Critical", ["Test execution"], "Complete", str(e), role)
    finally:
        context.close()


def test_partner_workflow(browser):
    print("\n" + "="*60)
    print("PARTNER PORTAL - DEEP TEST")
    print("="*60)
    
    context = browser.new_context()
    page = context.new_page()
    role = "partner"
    
    try:
        if not login(page, ACCOUNTS["partner"]["email"], ACCOUNTS["partner"]["password"], role):
            log_bug("Partner login failed", "Critical", ["Login attempt"], "Success", "Failed", role)
            return
        
        page.wait_for_timeout(3000)
        
        pages_to_test = [
            ("/partner", "partner_home"),
            ("/partner/menu", "partner_menu"),
            ("/partner/orders", "partner_orders"),
            ("/partner/analytics", "partner_analytics"),
        ]
        
        for path, name in pages_to_test:
            print(f"\n  Testing {name}...")
            page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
            clicked, errors = click_all_buttons(page, role, name)
            print(f"  Clicked {clicked} buttons")
            if errors:
                print(f"  Errors: {len(errors)}")
        
        log_workflow("Partner workflow", "COMPLETED")
        
    except Exception as e:
        log_bug("Partner test error", "Critical", ["Test execution"], "Complete", str(e), role)
    finally:
        context.close()


def test_admin_workflow(browser):
    print("\n" + "="*60)
    print("ADMIN PORTAL - DEEP TEST")
    print("="*60)
    
    context = browser.new_context()
    page = context.new_page()
    role = "admin"
    
    try:
        if not login(page, ACCOUNTS["admin"]["email"], ACCOUNTS["admin"]["password"], role):
            log_bug("Admin login failed", "Critical", ["Login attempt"], "Success", "Failed", role)
            return
        
        page.wait_for_timeout(3000)
        
        pages_to_test = [
            ("/admin", "admin_home"),
            ("/admin/users", "admin_users"),
            ("/admin/restaurants", "admin_restaurants"),
            ("/admin/orders", "admin_orders"),
            ("/admin/drivers", "admin_drivers"),
        ]
        
        for path, name in pages_to_test:
            print(f"\n  Testing {name}...")
            page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
            clicked, errors = click_all_buttons(page, role, name)
            print(f"  Clicked {clicked} buttons")
            if errors:
                print(f"  Errors: {len(errors)}")
        
        log_workflow("Admin workflow", "COMPLETED")
        
    except Exception as e:
        log_bug("Admin test error", "Critical", ["Test execution"], "Complete", str(e), role)
    finally:
        context.close()


def test_driver_workflow(browser):
    print("\n" + "="*60)
    print("DRIVER PORTAL - DEEP TEST")
    print("="*60)
    
    context = browser.new_context()
    page = context.new_page()
    role = "driver"
    
    try:
        if not login(page, ACCOUNTS["driver"]["email"], ACCOUNTS["driver"]["password"], role):
            log_bug("Driver login failed", "Critical", ["Login attempt"], "Success", "Failed", role)
            return
        
        page.wait_for_timeout(3000)
        
        pages_to_test = [
            ("/driver", "driver_home"),
            ("/driver/orders", "driver_orders"),
            ("/driver/earnings", "driver_earnings"),
        ]
        
        for path, name in pages_to_test:
            print(f"\n  Testing {name}...")
            page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
            clicked, errors = click_all_buttons(page, role, name)
            print(f"  Clicked {clicked} buttons")
            if errors:
                print(f"  Errors: {len(errors)}")
        
        log_workflow("Driver workflow", "COMPLETED")
        
    except Exception as e:
        log_bug("Driver test error", "Critical", ["Test execution"], "Complete", str(e), role)
    finally:
        context.close()


def test_fleet_workflow(browser):
    print("\n" + "="*60)
    print("FLEET MANAGER PORTAL - DEEP TEST")
    print("="*60)
    
    context = browser.new_context()
    page = context.new_page()
    role = "fleet"
    
    try:
        if not login(page, ACCOUNTS["fleet"]["email"], ACCOUNTS["fleet"]["password"], role):
            log_bug("Fleet login failed", "Critical", ["Login attempt"], "Success", "Failed", role)
            return
        
        page.wait_for_timeout(3000)
        
        pages_to_test = [
            ("/fleet", "fleet_home"),
            ("/fleet/dispatch", "fleet_dispatch"),
            ("/fleet/drivers", "fleet_drivers"),
            ("/fleet/vehicles", "fleet_vehicles"),
        ]
        
        for path, name in pages_to_test:
            print(f"\n  Testing {name}...")
            page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
            clicked, errors = click_all_buttons(page, role, name)
            print(f"  Clicked {clicked} buttons")
            if errors:
                print(f"  Errors: {len(errors)}")
        
        log_workflow("Fleet workflow", "COMPLETED")
        
    except Exception as e:
        log_bug("Fleet test error", "Critical", ["Test execution"], "Complete", str(e), role)
    finally:
        context.close()


def run_deep_test():
    print("\n" + "#"*60)
    print("# NUTRIO FUEL E2E DEEP TEST SUITE")
    print("#"*60)
    print(f"Started at: {datetime.now().isoformat()}")
    print(f"Target: {BASE_URL}")
    print("#"*60 + "\n")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        test_customer_workflow(browser)
        test_partner_workflow(browser)
        test_admin_workflow(browser)
        test_driver_workflow(browser)
        test_fleet_workflow(browser)
        
        browser.close()
    
    REPORT["execution_end"] = datetime.now().isoformat()
    
    print("\n\n" + "="*60)
    print("QA REPORT - NUTRIO FUEL E2E DEEP TEST")
    print("="*60)
    
    print("\n=== EXECUTION SUMMARY ===")
    passed = sum(1 for t in REPORT["tests"] if t["status"] == "PASS")
    failed = sum(1 for t in REPORT["tests"] if t["status"] == "FAIL")
    print(f"Total tests: {len(REPORT['tests'])}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    print(f"\n=== BUGS FOUND: {len(REPORT['bugs'])} ===")
    for i, bug in enumerate(REPORT["bugs"], 1):
        print(f"\n{i}. [{bug['severity']}] {bug['title']}")
        print(f"   Role: {bug['role']}")
        print(f"   Steps: {bug['steps']}")
        print(f"   Expected: {bug['expected']}")
        print(f"   Actual: {bug['actual']}")
    
    print(f"\n=== PERFORMANCE ISSUES: {len(REPORT['performance_issues'])} ===")
    for issue in REPORT["performance_issues"]:
        print(f"- {issue['message']} ({issue['location']})")
    
    print(f"\n=== UI/UX ISSUES: {len(REPORT['ui_issues'])} ===")
    for issue in REPORT["ui_issues"]:
        print(f"- {issue['description']} ({issue['location']})")
    
    print(f"\n=== WORKFLOWS: {len(REPORT['workflows'])} ===")
    for wf in REPORT["workflows"]:
        print(f"- [{wf['status']}] {wf['name']}")
    
    report_file = f"e2e_deep_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, "w") as f:
        json.dump(REPORT, f, indent=2)
    print(f"\nFull report saved to: {report_file}")
    
    critical = sum(1 for b in REPORT["bugs"] if b["severity"] == "Critical")
    high = sum(1 for b in REPORT["bugs"] if b["severity"] == "High")
    medium = sum(1 for b in REPORT["bugs"] if b["severity"] == "Medium")
    low = sum(1 for b in REPORT["bugs"] if b["severity"] == "Low")
    
    print(f"\nCritical: {critical} | High: {high} | Medium: {medium} | Low: {low}")
    
    print("\n" + "="*60)
    if critical > 0:
        print("WARNING: FINAL ASSESSMENT: NEEDS FIXES (Critical bugs found)")
    elif high > 0:
        print("WARNING: FINAL ASSESSMENT: NEEDS FIXES (High priority bugs found)")
    elif medium > 0:
        print("WARNING: FINAL ASSESSMENT: MOSTLY READY (Medium priority issues)")
    else:
        print("SUCCESS: FINAL ASSESSMENT: READY FOR PRODUCTION")
    print("="*60)
    
    return REPORT


if __name__ == "__main__":
    run_deep_test()
