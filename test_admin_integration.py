from playwright.sync_api import sync_playwright
import json

def test_admin_integration():
    results = {
        "page_load": False,
        "authentication": False,
        "dashboard_elements": [],
        "navigation_portals": [],
        "database_connection": False,
        "api_calls": [],
        "errors": []
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console logs and network requests
        console_logs = []
        page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text}))
        
        # Track API calls
        api_calls = []
        page.on("request", lambda request: api_calls.append({
            "url": request.url,
            "method": request.method,
            "resource_type": request.resource_type
        }))
        
        page.on("response", lambda response: api_calls.append({
            "url": response.url,
            "status": response.status,
            "type": "response"
        }))
        
        try:
            print("Testing Admin Page Integration...\n")
            
            # 1. Test page load
            print("1. Testing page load...")
            page.goto('http://localhost:8080/admin/', timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)
            
            # Check if page loaded successfully
            if page.url == 'http://localhost:8080/admin/':
                results["page_load"] = True
                print("   [OK] Admin page loaded successfully")
            else:
                print(f"   [!] Redirected to: {page.url}")
            
            # Take screenshot for visual inspection
            page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/admin_test_screenshot.png', full_page=True)
            print("   [OK] Screenshot saved")
            
            # 2. Check for authentication status
            print("\n2. Checking authentication...")
            
            # Check for login form or dashboard content
            login_form = page.locator('form, input[type="password"], button:has-text("Login"), button:has-text("Sign in")').first
            dashboard_content = page.locator('[class*="dashboard"], [class*="admin"], h1, h2').first
            
            if login_form.is_visible():
                print("   [LOCK] Login form detected - requires authentication")
                results["authentication"] = "login_required"
            elif dashboard_content.is_visible():
                print("   [OK] Dashboard content visible - authenticated")
                results["authentication"] = "authenticated"
            else:
                print("   [!] Unknown state - checking content...")
            
            # 3. Discover dashboard/portals
            print("\n3. Discovering portals and navigation...")
            
            # Find all navigation links
            nav_links = page.locator('nav a, [role="navigation"] a, .sidebar a, .menu a').all()
            print(f"   Found {len(nav_links)} navigation links:")
            
            for link in nav_links[:10]:  # Show first 10
                try:
                    text = link.inner_text().strip() or link.get_attribute('aria-label') or 'Unnamed'
                    href = link.get_attribute('href') or '#'
                    results["navigation_portals"].append({"text": text, "href": href})
                    print(f"      - {text[:30]} -> {href}")
                except:
                    pass
            
            # 4. Check for database-connected elements
            print("\n4. Checking database integration...")
            
            # Look for data tables, lists, or dynamic content
            data_tables = page.locator('table, [class*="table"], [class*="data"], [class*="list"]').all()
            print(f"   Found {len(data_tables)} data containers (tables/lists)")
            
            # Check for loading states
            loading_elements = page.locator('[class*="loading"], [class*="spinner"], [class*="skeleton"]').all()
            if loading_elements:
                print(f"   [TIME] Found {len(loading_elements)} loading elements (indicates data fetching)")
            
            # Check for empty states
            empty_states = page.locator('text=/no data|empty|no items/i').all()
            if empty_states:
                print(f"   [EMPTY] Found {len(empty_states)} empty state indicators")
            
            # 5. Check API calls for database evidence
            print("\n5. Checking API/database calls...")
            
            supabase_calls = [call for call in api_calls if 'supabase' in call.get('url', '').lower()]
            api_endpoints = [call for call in api_calls if call.get('resource_type') == 'xhr' or '/api/' in call.get('url', '')]
            
            if supabase_calls:
                print(f"   [OK] Found {len(supabase_calls)} Supabase database calls")
                results["database_connection"] = True
            elif api_endpoints:
                print(f"   [OK] Found {len(api_endpoints)} API calls")
                results["database_connection"] = True
            else:
                print("   [!] No database API calls detected yet (may need authentication)")
            
            results["api_calls"] = api_calls[:20]  # Store first 20 calls
            
            # 6. Check for key admin features
            print("\n6. Checking admin features...")
            
            feature_keywords = ['users', 'orders', 'products', 'analytics', 'reports', 'settings', 'content']
            page_content = page.content().lower()
            
            found_features = []
            for keyword in feature_keywords:
                if keyword in page_content:
                    found_features.append(keyword)
            
            if found_features:
                print(f"   [OK] Found admin features: {', '.join(found_features)}")
                results["dashboard_elements"] = found_features
            else:
                print("   [!] No standard admin features detected")
            
            # 7. Check for errors
            print("\n7. Checking for errors...")
            error_logs = [log for log in console_logs if log["type"] in ['error', 'warning']]
            
            if error_logs:
                print(f"   [!] Found {len(error_logs)} console errors/warnings:")
                for log in error_logs[:5]:
                    print(f"      [{log['type'].upper()}] {log['text'][:100]}")
                results["errors"] = error_logs
            else:
                print("   [OK] No console errors detected")
            
            # 8. Summary
            print("\n" + "="*60)
            print("INTEGRATION TEST SUMMARY")
            print("="*60)
            print(f"[OK] Page Load: {'PASS' if results['page_load'] else 'FAIL'}")
            print(f"[LOCK] Authentication: {results['authentication'].upper() if results['authentication'] else 'UNKNOWN'}")
            print(f"[WEB] Navigation Portals: {len(results['navigation_portals'])} found")
            print(f"[DB] Database Connection: {'CONNECTED' if results['database_connection'] else 'NOT DETECTED'}")
            print(f"[CHART] Admin Features: {len(results['dashboard_elements'])} found")
            print(f"[!] Errors: {len(results['errors'])} issues")
            print("="*60)
            
        except Exception as e:
            print(f"\n[X] Test failed with error: {str(e)}")
            results["errors"].append(str(e))
        finally:
            browser.close()
    
    # Save detailed results
    with open('C:/Users/khamis/Documents/nutrio-fuel/admin_integration_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print("\nDetailed results saved to: admin_integration_test_results.json")
    print("Screenshot saved to: admin_test_screenshot.png")
    
    return results

if __name__ == "__main__":
    test_admin_integration()
