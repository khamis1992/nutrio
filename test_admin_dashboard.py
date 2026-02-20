from playwright.sync_api import sync_playwright
import json

def test_admin_dashboard():
    results = {
        "authenticated": False,
        "is_admin": False,
        "stats_visible": False,
        "api_errors": [],
        "stats_values": {},
        "screenshot": None
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        
        # Capture console and network
        console_logs = []
        page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text}))
        
        api_responses = []
        page.on("response", lambda response: api_responses.append({
            "url": response.url,
            "status": response.status,
            "ok": response.ok
        }) if "supabase" in response.url.lower() else None)
        
        try:
            print("Checking admin dashboard state...\n")
            
            # Go to admin page
            page.goto('http://localhost:8080/admin', timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)
            
            # Wait a bit for any redirects and data fetching
            page.wait_for_timeout(3000)
            
            # Check current URL
            current_url = page.url
            print(f"Current URL: {current_url}")
            
            if '/auth' in current_url:
                print("[AUTH] Redirected to login - not authenticated")
                results["authenticated"] = False
            elif '/admin' in current_url:
                print("[OK] On admin page")
                results["authenticated"] = True
                
                # Take screenshot
                page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/admin_dashboard_check.png', full_page=True)
                results["screenshot"] = "admin_dashboard_check.png"
                
                # Check for stats cards
                stats_elements = page.locator('text=/\\d+ Active Restaurants|\\d+ Total Users|\\d+ Today').all()
                zero_elements = page.locator('text=/0 Active Restaurants|0 Total Users|0 Today').all()
                
                print(f"\n[STATS] Found {len(stats_elements)} stats elements")
                print(f"[ZERO] Found {len(zero_elements)} showing '0'")
                
                if zero_elements:
                    print("\n[!] Stats are showing 0 values - possible causes:")
                    print("    1. Database tables are empty")
                    print("    2. API calls failed")
                    print("    3. User not authorized (not admin)")
                    
                # Try to read stat values
                try:
                    restaurants = page.locator('text=/\\d+ Active Restaurants/').first.inner_text()
                    results["stats_values"]["restaurants"] = restaurants
                    print(f"    Restaurants stat: {restaurants}")
                except:
                    pass
                    
                try:
                    users = page.locator('text=/\\d+ Total Users/').first.inner_text()
                    results["stats_values"]["users"] = users
                    print(f"    Users stat: {users}")
                except:
                    pass
                
                # Check for admin sidebar (indicates admin access)
                sidebar = page.locator('text=/Admin Panel|Dashboard|Restaurants/i').all()
                if sidebar:
                    print(f"\n[OK] Admin sidebar detected ({len(sidebar)} navigation items)")
                    results["is_admin"] = True
                else:
                    print("\n[!] No admin sidebar - may not have admin privileges")
                    results["is_admin"] = False
            
            # Check for errors
            errors = [log for log in console_logs if log["type"] == "error"]
            if errors:
                print(f"\n[!] Found {len(errors)} console errors:")
                for err in errors[:5]:
                    print(f"    ERROR: {err['text'][:150]}")
                results["api_errors"] = errors
            
            # Check Supabase responses
            failed_calls = [r for r in api_responses if not r.get("ok")]
            if failed_calls:
                print(f"\n[!] {len(failed_calls)} failed API calls:")
                for call in failed_calls[:5]:
                    print(f"    {call['status']}: {call['url'][:80]}")
            elif api_responses:
                print(f"\n[OK] {len(api_responses)} Supabase API calls succeeded")
                
        except Exception as e:
            print(f"\n[X] Error: {str(e)}")
            results["api_errors"].append(str(e))
        finally:
            browser.close()
    
    # Save results
    with open('C:/Users/khamis/Documents/nutrio-fuel/admin_dashboard_check.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print("\n" + "="*60)
    print("Dashboard check complete")
    print("Screenshot: admin_dashboard_check.png")
    print("Results: admin_dashboard_check.json")
    print("="*60)
    
    return results

if __name__ == "__main__":
    test_admin_dashboard()
