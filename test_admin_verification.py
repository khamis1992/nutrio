from playwright.sync_api import sync_playwright
import json

def test_admin_with_login():
    results = {
        "login_success": False,
        "dashboard_loaded": False,
        "stats": {},
        "navigation": [],
        "errors": [],
        "screenshots": []
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        
        # Capture console errors
        page.on("console", lambda msg: results["errors"].append({"type": msg.type, "text": msg.text}) if msg.type == "error" else None)
        
        try:
            print("Testing admin dashboard with login...")
            print("="*60)
            
            # 1. Go to admin page
            print("\n1. Navigating to admin page...")
            page.goto('http://localhost:8080/admin', timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)
            
            # Take screenshot of initial state
            page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/admin_step1_initial.png')
            results["screenshots"].append("admin_step1_initial.png")
            
            # Check if we're on login page
            if '/auth' in page.url:
                print("   [OK] Redirected to login page")
                
                # 2. Fill login form
                print("\n2. Logging in...")
                page.fill('input[type="email"], input[name="email"]', 'khamis-1992@hotmail.com')
                page.fill('input[type="password"], input[name="password"]', 'Khamees1992#')
                
                # Click sign in button
                sign_in_btn = page.locator('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]').first
                sign_in_btn.click()
                
                # Wait for navigation
                page.wait_for_load_state('networkidle', timeout=30000)
                page.wait_for_timeout(3000)  # Extra wait for data loading
                
                # Check if login was successful
                if '/admin' in page.url or '/dashboard' in page.url:
                    print(f"   [OK] Login successful - on: {page.url}")
                    results["login_success"] = True
                    
                    # If redirected to dashboard, try to navigate to admin
                    if '/dashboard' in page.url:
                        print("   [!] Redirected to dashboard, navigating to admin...")
                        page.goto('http://localhost:8080/admin', timeout=30000)
                        page.wait_for_load_state('networkidle', timeout=30000)
                        page.wait_for_timeout(3000)
                        print(f"   Current URL: {page.url}")
                else:
                    print(f"   [X] Login failed - still on: {page.url}")
                    page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/admin_login_failed.png')
                    results["screenshots"].append("admin_login_failed.png")
                    return results
            else:
                print(f"   [!] Already on: {page.url}")
                results["login_success"] = True
            
            # 3. Check dashboard loaded
            print("\n3. Checking dashboard content...")
            page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/admin_step2_dashboard.png', full_page=True)
            results["screenshots"].append("admin_step2_dashboard.png")
            
            # Look for stats
            stats_patterns = [
                ("Active Restaurants", r"(\d+)\s*Active Restaurants"),
                ("Total Users", r"(\d+)\s*Total Users"),
                ("Today's Orders", r"(\d+)\s*Today's?\s*Orders"),
                ("Weekly Revenue", r"([\$\d,.]+)\s*Weekly Revenue")
            ]
            
            page_content = page.content()
            
            for stat_name, pattern in stats_patterns:
                import re
                match = re.search(pattern, page_content, re.IGNORECASE)
                if match:
                    value = match.group(1)
                    results["stats"][stat_name] = value
                    print(f"   [OK] {stat_name}: {value}")
                else:
                    print(f"   [!] {stat_name}: Not found")
            
            # 4. Check navigation portals
            print("\n4. Checking navigation portals...")
            nav_items = page.locator('nav a, [role="navigation"] a, .sidebar a, .menu a, [class*="sidebar"] a').all()
            
            for item in nav_items[:15]:  # Get first 15
                try:
                    text = item.inner_text().strip()
                    href = item.get_attribute('href') or ''
                    if text and '/admin' in href:
                        results["navigation"].append({"text": text, "href": href})
                        print(f"   - {text[:30]}")
                except:
                    pass
            
            print(f"   [OK] Found {len(results['navigation'])} admin navigation items")
            
            # 5. Check for data tables
            print("\n5. Checking for data tables...")
            tables = page.locator('table, [class*="data"], [class*="list"]').all()
            print(f"   [OK] Found {len(tables)} data containers")
            
            # 6. Check for errors
            print("\n6. Checking for API errors...")
            error_logs = [e for e in results["errors"] if e["type"] == "error"]
            if error_logs:
                print(f"   [!] Found {len(error_logs)} console errors:")
                for err in error_logs[:5]:
                    print(f"      {err['text'][:100]}")
            else:
                print("   [OK] No console errors")
            
            # 7. Summary
            print("\n" + "="*60)
            print("DASHBOARD VERIFICATION SUMMARY")
            print("="*60)
            print(f"Login Success: {'YES' if results['login_success'] else 'NO'}")
            print(f"Stats Found: {len(results['stats'])}")
            print(f"Navigation Items: {len(results['navigation'])}")
            print(f"Errors: {len(error_logs)}")
            print("\nStats Values:")
            for name, value in results["stats"].items():
                print(f"  - {name}: {value}")
            print("="*60)
            
            if len(results["stats"]) >= 3 and results["login_success"]:
                print("\n✅ DASHBOARD IS WORKING CORRECTLY!")
            elif results["login_success"]:
                print("\n⚠️  DASHBOARD LOADED BUT SOME STATS MISSING")
            else:
                print("\n❌ LOGIN FAILED")
                
        except Exception as e:
            print(f"\n[X] Test error: {str(e)}")
            results["errors"].append(str(e))
            page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/admin_error.png')
        finally:
            browser.close()
    
    # Save results
    with open('C:/Users/khamis/Documents/nutrio-fuel/admin_verification_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print("\nResults saved to: admin_verification_results.json")
    print("Screenshots saved:")
    for screenshot in results["screenshots"]:
        print(f"  - {screenshot}")
    
    return results

if __name__ == "__main__":
    test_admin_with_login()
