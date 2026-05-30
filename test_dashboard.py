from playwright.sync_api import sync_playwright
import time

def test_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=100)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        
        try:
            # Navigate to dashboard
            print("Navigating to dashboard...")
            page.goto('http://localhost:5173/nutrio/dashboard', timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)
            
            # Take initial screenshot
            page.screenshot(path='dashboard_initial.png', full_page=True)
            print("Screenshot saved: dashboard_initial.png")
            
            # Check if login is needed
            if page.locator('text=Sign In').count() > 0 or page.locator('text=Login').count() > 0 or page.locator('input[type="email"]').count() > 0:
                print("Login required. Attempting to login...")
                
                # Find email input
                email_input = page.locator('input[type="email"]').first
                if email_input.count() > 0:
                    email_input.fill('eng.aljabor@gmail.com')
                    print("Filled email")
                
                # Find password input
                password_input = page.locator('input[type="password"]').first
                if password_input.count() > 0:
                    password_input.fill('123456789')
                    print("Filled password")
                
                # Click login button
                login_button = page.locator('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]').first
                if login_button.count() > 0:
                    login_button.click()
                    print("Clicked login button")
                    page.wait_for_load_state('networkidle', timeout=30000)
                    time.sleep(3)
                
                # Check if there are any error messages
                error_msg = page.locator('.text-destructive, [role="alert"], .error, .text-red').first
                if error_msg.count() > 0:
                    print(f"Error message found: {error_msg.text_content()}")
                
                # Check URL after login attempt
                current_url = page.url
                print(f"Current URL after login: {current_url}")
                
                # Take screenshot after login
                page.screenshot(path='dashboard_after_login.png', full_page=True)
                print("Screenshot saved: dashboard_after_login.png")
            else:
                print("Already logged in or no login form found")
            
            # Scroll through the page and take screenshots
            print("\nAnalyzing page structure...")
            
            # Get page content summary
            content = page.content()
            print(f"Page content length: {len(content)}")
            
            # Extract all text content from the page
            print("\n=== PAGE TEXT CONTENT ===")
            body_text = page.locator('body').inner_text()
            print(body_text[:3000])  # Print first 3000 chars
            print("\n... [truncated] ...\n")
            
            # Check for key elements with detailed logging
            print("\n=== ELEMENT ANALYSIS ===")
            
            # All headings
            headings = page.locator('h1, h2, h3, h4, h5, h6').all()
            print(f"\nHeadings found ({len(headings)}):")
            for i, h in enumerate(headings[:10]):
                print(f"  {i+1}. {h.text_content()[:100]}")
            
            # All buttons
            buttons = page.locator('button').all()
            print(f"\nButtons found ({len(buttons)}):")
            for i, btn in enumerate(buttons[:15]):
                text = btn.text_content()[:50] if btn.text_content() else '[no text]'
                print(f"  {i+1}. {text}")
            
            # All links
            links = page.locator('a').all()
            print(f"\nLinks found ({len(links)}):")
            for i, link in enumerate(links[:15]):
                text = link.text_content()[:50] if link.text_content() else '[no text]'
                href = link.get_attribute('href') or '[no href]'
                print(f"  {i+1}. {text[:30]} -> {href}")
            
            # Check for specific text content
            print("\n=== TEXT SEARCH ===")
            search_terms = ['Order Again', 'Quick', 'Reorder', 'Nutrition', 'Calories', 'Protein', 'Carbs', 'Dashboard', 'Welcome', 'Meal', 'Subscribe']
            for term in search_terms:
                count = page.locator(f'text={term}').count()
                if count > 0:
                    print(f"  Found '{term}': {count} times")
            
            # Check for cards/containers
            cards = page.locator('[class*="card"], [class*="Card"]').all()
            print(f"\nCard elements found: {len(cards)}")
            
            # Get computed styles for key elements
            print("\n=== STYLES CHECK ===")
            try:
                header = page.locator('header').first
                if header.count() > 0:
                    bg_color = header.evaluate('el => window.getComputedStyle(el).backgroundColor')
                    print(f"Header background: {bg_color}")
            except:
                print("Could not get header styles")
            
            # Take final screenshot
            page.screenshot(path='dashboard_final.png', full_page=True)
            print("\nScreenshot saved: dashboard_final.png")
            
            # Wait for user to see the browser
            print("\nBrowser will stay open for 10 seconds...")
            time.sleep(10)
            
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            page.screenshot(path='dashboard_error.png', full_page=True)
            print("Error screenshot saved: dashboard_error.png")
        
        finally:
            browser.close()

if __name__ == "__main__":
    test_dashboard()
