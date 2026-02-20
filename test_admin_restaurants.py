from playwright.sync_api import sync_playwright
import json

def test_admin_restaurants_page():
    results = {
        "page_loaded": False,
        "restaurants_found": 0,
        "tabs_working": False,
        "errors": [],
        "screenshots": []
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        
        # Capture console errors
        def handle_console(msg):
            if msg.type == "error":
                error_text = msg.text
                results["errors"].append(error_text)
                print(f"[Console Error]: {error_text[:150]}")
        
        page.on("console", handle_console)
        
        # Capture network requests
        api_errors = []
        def handle_response(response):
            if "supabase" in response.url and not response.ok:
                api_errors.append({
                    "url": response.url,
                    "status": response.status
                })
                print(f"[API Error {response.status}]: {response.url[:100]}")
        
        page.on("response", handle_response)
        
        try:
            print("="*60)
            print("TESTING ADMIN RESTAURANTS PAGE")
            print("="*60)
            
            # Step 1: Login first
            print("\n[Step 1] Logging in...")
            page.goto('http://localhost:8080/auth', timeout=30000)
            page.wait_for_load_state('networkidle')
            
            page.fill('input[type="email"]', 'khamis-1992@hotmail.com')
            page.fill('input[type="password"]', 'Khamees1992#')
            page.click('button[type="submit"]')
            
            page.wait_for_timeout(3000)
            print(f"   Logged in, current URL: {page.url}")
            
            # Step 2: Navigate to restaurants page
            print("\n[Step 2] Navigating to /admin/restaurants...")
            # First click on Restaurants link in sidebar
            restaurants_link = page.locator('a:has-text("Restaurants"), [href="/admin/restaurants"]').first
            if restaurants_link.is_visible():
                restaurants_link.click()
                page.wait_for_timeout(3000)
            else:
                page.goto('http://localhost:8080/admin/restaurants')
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(3000)
            
            print(f"   Current URL: {page.url}")
            results["page_loaded"] = '/admin/restaurants' in page.url
            
            page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/restaurants_page.png', full_page=True)
            results["screenshots"].append('restaurants_page.png')
            
            # Step 3: Check for restaurants
            print("\n[Step 3] Checking for restaurants...")
            
            # Look for restaurant cards or items
            restaurant_cards = page.locator('text=/Mediterranean|Green Garden|Fitness Fuel|restaurant/i').all()
            print(f"   Found {len(restaurant_cards)} restaurant references")
            
            # Look for "No restaurants" message
            no_restaurants = page.locator('text=/No restaurants|not found|empty/i').all()
            if no_restaurants:
                print(f"   [!] Found 'No restaurants' message")
            
            # Check tabs
            tabs = page.locator('[role="tab"], button:has-text("Pending"), button:has-text("Approved"), button:has-text("Rejected")').all()
            print(f"   Found {len(tabs)} tabs")
            
            if len(tabs) >= 3:
                results["tabs_working"] = True
                print("   [OK] All tabs present (Pending, Approved, Rejected)")
            
            # Step 4: Check tabs content
            print("\n[Step 4] Checking tabs content...")
            
            # Click on Pending tab
            pending_tab = page.locator('button:has-text("Pending"), [role="tab"]:has-text("Pending")').first
            if pending_tab.is_visible():
                pending_tab.click()
                page.wait_for_timeout(2000)
                
                # Check for restaurants in pending tab
                pending_restaurants = page.locator('[class*="card"], [class*="restaurant"], [class*="item"]').all()
                print(f"   Pending tab: Found {len(pending_restaurants)} items")
                
                # Check specific restaurant names
                page_content = page.content()
                restaurant_names = ["Mediterranean", "Green Garden", "Fitness Fuel"]
                found_names = []
                for name in restaurant_names:
                    if name.lower() in page_content.lower():
                        found_names.append(name)
                
                if found_names:
                    print(f"   [OK] Found restaurants: {', '.join(found_names)}")
                    results["restaurants_found"] = len(found_names)
                else:
                    print("   [!] No restaurant names found in page content")
            
            # Step 5: Summary
            print("\n" + "="*60)
            print("TEST SUMMARY")
            print("="*60)
            print(f"Page Loaded: {results['page_loaded']}")
            print(f"Restaurants Found: {results['restaurants_found']}")
            print(f"Tabs Working: {results['tabs_working']}")
            print(f"Console Errors: {len(results['errors'])}")
            print(f"API Errors: {len(api_errors)}")
            
            if api_errors:
                print("\nAPI Errors:")
                for err in api_errors[:5]:
                    print(f"  {err['status']}: {err['url'][:80]}")
            
            print("="*60)
            
        except Exception as e:
            print(f"\n[X] Test error: {str(e)}")
            import traceback
            traceback.print_exc()
        finally:
            browser.close()
    
    # Save results
    with open('C:/Users/khamis/Documents/nutrio-fuel/admin_restaurants_test.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print("\nResults saved to: admin_restaurants_test.json")
    print("Screenshot: restaurants_page.png")
    
    return results

if __name__ == "__main__":
    test_admin_restaurants_page()
