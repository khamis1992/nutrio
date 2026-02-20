from playwright.sync_api import sync_playwright

def debug_restaurants_query():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        
        # Track all API calls
        api_calls = []
        def handle_request(request):
            if "restaurants" in request.url.lower():
                api_calls.append({
                    "type": "request",
                    "url": request.url,
                    "method": request.method
                })
        
        def handle_response(response):
            if "restaurants" in response.url.lower():
                api_calls.append({
                    "type": "response", 
                    "url": response.url,
                    "status": response.status,
                    "ok": response.ok
                })
        
        page.on("request", handle_request)
        page.on("response", handle_response)
        
        # Console logging
        page.on("console", lambda msg: print(f"[Console]: {msg.text[:150]}") if "restaurant" in msg.text.lower() or "error" in msg.type else None)
        
        print("="*60)
        print("DEBUGGING RESTAURANTS QUERY")
        print("="*60)
        
        # Login
        print("\n1. Logging in...")
        page.goto('http://localhost:8080/admin')
        page.wait_for_load_state('networkidle')
        
        if '/auth' in page.url:
            page.fill('input[type="email"]', 'khamis-1992@hotmail.com')
            page.fill('input[type="password"]', 'Khamees1992#')
            page.click('button[type="submit"]')
            page.wait_for_timeout(4000)
        
        print(f"   Current URL: {page.url}")
        
        # Navigate to restaurants
        print("\n2. Navigating to Restaurants page...")
        page.click('text=Restaurants')
        page.wait_for_timeout(5000)
        
        print(f"   Current URL: {page.url}")
        
        # Check API calls
        print("\n3. API Calls related to restaurants:")
        restaurant_calls = [c for c in api_calls if "restaurants" in c.get("url", "").lower()]
        for call in restaurant_calls:
            if call["type"] == "response":
                print(f"   {call['method'] if 'method' in call else 'GET'} {call['status']} - {call['url'][:80]}")
        
        # Check for errors in page
        print("\n4. Checking page state...")
        content = page.content()
        
        if "No restaurants found" in content:
            print("   [!] Page shows 'No restaurants found'")
        
        if "Mediterranean" in content or "Green Garden" in content:
            print("   [OK] Restaurant names found in page!")
        
        # Check all tabs
        print("\n5. Checking all tabs...")
        for tab_name in ["Pending", "Approved", "Rejected"]:
            tab = page.locator(f'button:has-text("{tab_name}"), [role="tab"]:has-text("{tab_name}")').first
            if tab.is_visible():
                tab.click()
                page.wait_for_timeout(2000)
                
                # Check if content loads
                cards = page.locator('[class*="card"]').all()
                print(f"   {tab_name} tab: {len(cards)} cards/items found")
        
        # Take screenshot
        page.screenshot(path='C:/Users/khamis/Documents/nutrio-fuel/debug_restaurants.png', full_page=True)
        print("\n   Screenshot saved: debug_restaurants.png")
        
        browser.close()
        
        print("\n" + "="*60)

if __name__ == "__main__":
    debug_restaurants_query()
