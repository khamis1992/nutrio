from playwright.sync_api import sync_playwright
import json

def audit_partner_dashboard():
    """Audit Partner Dashboard for mock data and verify live data connections"""
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        # Capture console logs
        console_logs = []
        page.on("console", lambda msg: console_logs.append({
            "type": msg.type,
            "text": msg.text
        }))
        
        # Capture network requests
        network_requests = []
        page.on("request", lambda request: network_requests.append({
            "url": request.url,
            "method": request.method,
            "resource_type": request.resource_type
        }))
        
        print("=" * 80)
        print("PARTNER DASHBOARD AUDIT REPORT")
        print("=" * 80)
        
        # Navigate to Partner Dashboard
        print("\n[1] Navigating to Partner Dashboard...")
        try:
            page.goto('http://localhost:8080/partner', timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)
            print("[OK] Page loaded successfully")
        except Exception as e:
            print(f"[ERROR] Failed to load page: {e}")
            # Take screenshot anyway to see what's there
        
        # Take full page screenshot
        page.screenshot(path='partner_dashboard_audit.png', full_page=True)
        print("[OK] Screenshot saved: partner_dashboard_audit.png")
        
        # Check if redirected to auth page
        current_url = page.url
        print(f"\n[2] Current URL: {current_url}")
        
        if '/auth' in current_url or '/partner/auth' in current_url:
            print("[WARN] Partner requires authentication - redirecting to login page")
            print("  This is expected behavior for protected routes")
        
        # Analyze page content
        print("\n[3] Analyzing page structure...")
        
        # Count cards
        cards = page.locator('.card, [class*="Card"]').all()
        print(f"  Found {len(cards)} card elements")
        
        # Check for stat values
        stat_elements = page.locator('text=/^\\d+$/').all()
        print(f"  Found {len(stat_elements)} numeric stat elements")
        
        # Look for currency values
        currency_elements = page.locator('text=/QAR|QR|\\$|€|£/').all()
        print(f"  Found {len(currency_elements)} currency elements")
        
        # Check for loading states
        skeletons = page.locator('.skeleton, [class*="Skeleton"]').all()
        print(f"  Found {len(skeletons)} skeleton loading elements")
        
        # Analyze console logs
        print("\n[4] Console Log Analysis:")
        errors = [log for log in console_logs if log['type'] == 'error']
        warnings = [log for log in console_logs if log['type'] == 'warning']
        
        if errors:
            print(f"  [ERROR] {len(errors)} console errors found:")
            for error in errors[:5]:  # Show first 5
                print(f"    - {error['text'][:100]}")
        else:
            print("  [OK] No console errors")
            
        if warnings:
            print(f"  [WARN] {len(warnings)} console warnings found")
        
        # Analyze network requests
        print("\n[5] Network Request Analysis:")
        supabase_requests = [r for r in network_requests if 'supabase' in r['url']]
        api_requests = [r for r in network_requests if r['resource_type'] == 'xhr' or r['resource_type'] == 'fetch']
        
        print(f"  Total network requests: {len(network_requests)}")
        print(f"  Supabase requests: {len(supabase_requests)}")
        print(f"  API/XHR requests: {len(api_requests)}")
        
        if supabase_requests:
            print("  Supabase endpoints called:")
            for req in supabase_requests[:5]:
                print(f"    - {req['method']} {req['url'][:80]}")
        
        # Extract visible text content from cards
        print("\n[6] Card Content Analysis:")
        try:
            # Get all text content
            content = page.content()
            
            # Look for common mock data patterns
            mock_indicators = [
                'mock', 'dummy', 'test', 'sample', 'example',
                'placeholder', 'lorem ipsum', 'fake'
            ]
            
            found_mock = False
            for indicator in mock_indicators:
                if indicator in content.lower():
                    print(f"  [WARN] Found potential mock data indicator: '{indicator}'")
                    found_mock = True
            
            if not found_mock:
                print("  [OK] No obvious mock data indicators found")
                
        except Exception as e:
            print(f"  [ERROR] Error analyzing content: {e}")
        
        # Check for specific Partner Dashboard elements
        print("\n[7] Partner Dashboard Specific Elements:")
        
        elements_to_check = [
            ('Menu Items', 'text=/Menu Items/i'),
            ('Active Orders', 'text=/Active Orders/i'),
            ("Today's Orders", 'text=/Today.*Orders/i'),
            ('Revenue', 'text=/Revenue/i'),
            ("This Week's Revenue", 'text=/This Week/i'),
            ('Quick Actions', 'text=/Quick Action/i'),
            ('Recent Orders', 'text=/Recent Orders/i'),
        ]
        
        for name, selector in elements_to_check:
            try:
                element = page.locator(selector).first
                if element.is_visible():
                    print(f"  [OK] {name} card found")
                else:
                    print(f"  [ERROR] {name} card not visible")
            except:
                print(f"  [ERROR] {name} card not found")
        
        browser.close()
        
        print("\n" + "=" * 80)
        print("AUDIT COMPLETE")
        print("=" * 80)
        print("\nNext Steps:")
        print("1. Review the screenshot: partner_dashboard_audit.png")
        print("2. Check for authentication requirements")
        print("3. Verify all cards display live data from Supabase")
        print("4. Test navigation to all linked pages")
        
        return {
            "url": current_url,
            "cards_found": len(cards),
            "console_errors": len(errors),
            "supabase_requests": len(supabase_requests),
            "requires_auth": '/auth' in current_url
        }

if __name__ == "__main__":
    result = audit_partner_dashboard()
    print("\n" + json.dumps(result, indent=2))
