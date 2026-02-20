from playwright.sync_api import sync_playwright
import json

def test_admin_dashboard():
    results = {
        "login_success": False,
        "admin_access": False,
        "stats": {},
        "navigation": [],
        "errors": [],
        "screenshots": []
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        
        # Capture console logs
        page.on("console", lambda msg: print(f"[Console {msg.type}]: {msg.text[:100]}") if msg.type == "error" else None)
        
        try:
            print("="*60)
            print("TESTING ADMIN DASHBOARD")
            print("="*60)
            
            # Step 1: Navigate to admin
            print("\n[Step 1] Navigating to /admin...")
            page.goto('http://localhost:8080/admin', timeout=30000)
            page.wait_for_load_state('networkidle')
            
            print(f"   Current URL: {page.url}")
            page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/test_01_start.png')
            
            # Step 2: Login
            if '/auth' in page.url:
                print("\n[Step 2] Logging in...")
                
                # Clear and fill email
                email_input = page.locator('input[type="email"]').first
                email_input.fill('khamis-1992@hotmail.com')
                print("   Email filled")
                
                # Fill password
                password_input = page.locator('input[type="password"]').first
                password_input.fill('Khamees1992#')
                print("   Password filled")
                
                # Click sign in
                sign_in_btn = page.locator('button:has-text("Sign In"), button[type="submit"]').first
                sign_in_btn.click()
                print("   Sign in clicked")
                
                # Wait for navigation - be generous with time
                page.wait_for_timeout(5000)
                
                print(f"   URL after login: {page.url}")
                page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/test_02_after_login.png')
                results["screenshots"].extend(['test_01_start.png', 'test_02_after_login.png'])
                
                # Check if login was successful
                if '/admin' in page.url:
                    print("   [OK] Login successful - on admin page!")
                    results["login_success"] = True
                    results["admin_access"] = True
                elif '/dashboard' in page.url:
                    print("   [INFO] On dashboard, checking for admin access...")
                    results["login_success"] = True
                    
                    # Navigate to admin
                    page.goto('http://localhost:8080/admin')
                    page.wait_for_load_state('networkidle')
                    page.wait_for_timeout(3000)
                    
                    print(f"   URL after nav to admin: {page.url}")
                    page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/test_03_admin_page.png')
                    results["screenshots"].append('test_03_admin_page.png')
                    
                    if '/admin' in page.url:
                        print("   [OK] Admin page accessible!")
                        results["admin_access"] = True
                    else:
                        print(f"   [X] Still redirected to: {page.url}")
                elif '/auth' in page.url:
                    # Check for error message
                    error_msg = page.locator('text=/invalid|error|wrong|failed/i').first
                    if error_msg.is_visible():
                        print(f"   [X] Login error: {error_msg.inner_text()}")
                    else:
                        print("   [X] Still on auth page - login may have failed")
                    return results
            else:
                print("   [INFO] Not on auth page")
                results["login_success"] = True
            
            # Step 3: Check admin content
            if results["admin_access"]:
                print("\n[Step 3] Checking admin dashboard content...")
                
                # Look for admin-specific elements
                content = page.content()
                
                # Check for stats
                import re
                stats_found = []
                
                # Look for numbers followed by text
                stat_patterns = [
                    r'(\d+)\s*Active Restaurants',
                    r'(\d+)\s*Total Users', 
                    r'(\d+)\s*Today',
                    r'(\d+)\s*Orders',
                    r'\$?([\d,.]+)\s*Revenue',
                    r'(\d+)\s*Pending'
                ]
                
                for pattern in stat_patterns:
                    matches = re.findall(pattern, content, re.IGNORECASE)
                    if matches:
                        stats_found.append(matches[0])
                
                if stats_found:
                    print(f"   [OK] Found stats: {stats_found}")
                    results["stats"] = stats_found
                else:
                    print("   [!] No stats found (showing 0 or empty)")
                
                # Check for sidebar navigation
                nav_elements = page.locator('nav, [class*="sidebar"], [class*="navigation"]').all()
                print(f"   [OK] Found {len(nav_elements)} navigation containers")
                
                # Look for admin links
                admin_links = page.locator('a[href*="/admin"]').all()
                print(f"   [OK] Found {len(admin_links)} admin links")
                results["navigation"] = [{"href": link.get_attribute('href'), "text": link.inner_text()[:30]} for link in admin_links[:10]]
                
                # Final screenshot
                page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/test_04_final.png', full_page=True)
                results["screenshots"].append('test_04_final.png')
            
            # Summary
            print("\n" + "="*60)
            print("TEST SUMMARY")
            print("="*60)
            print(f"Login Success: {results['login_success']}")
            print(f"Admin Access: {results['admin_access']}")
            print(f"Stats Found: {len(results['stats'])}")
            print(f"Navigation Items: {len(results['navigation'])}")
            
            if results['admin_access']:
                print("\n✅ ADMIN DASHBOARD IS ACCESSIBLE!")
                if len(results['stats']) > 0:
                    print("✅ Stats are showing data!")
                else:
                    print("⚠️  Stats showing 0 (database may be empty)")
            elif results['login_success']:
                print("\n⚠️  LOGGED IN BUT NO ADMIN ACCESS")
                print("   User may not have admin role")
            else:
                print("\n❌ LOGIN FAILED")
            
            print("="*60)
            
        except Exception as e:
            print(f"\n[X] Test error: {str(e)}")
            import traceback
            traceback.print_exc()
            page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/test_error.png')
        finally:
            browser.close()
    
    # Save results
    with open('C:/Users/khamis/Documents/nutrio-fuel/admin_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print("\nResults saved to: admin_test_results.json")
    print("Screenshots:")
    for s in results.get("screenshots", []):
        print(f"  - {s}")
    
    return results

if __name__ == "__main__":
    test_admin_dashboard()
