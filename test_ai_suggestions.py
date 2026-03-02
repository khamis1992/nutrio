from playwright.sync_api import sync_playwright
import time

def test_ai_suggestions():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 375, 'height': 812})  # iPhone X size
        
        try:
            # Navigate to the app
            print("Navigating to http://localhost:8080/schedule")
            page.goto('http://localhost:8080/schedule')
            page.wait_for_load_state('networkidle')
            
            # Take initial screenshot
            page.screenshot(path='/tmp/schedule_page.png', full_page=True)
            print("Schedule page loaded - screenshot saved")
            
            # Wait for the page to fully load
            time.sleep(2)
            
            # Look for the + button (FAB) with different selectors
            print("Looking for Add Meal button...")
            
            # Try to find by SVG icon
            add_button = None
            try:
                # Try looking for Plus icon
                add_button = page.locator('svg[class*="lucide-plus"]').first
                if add_button.is_visible():
                    add_button.click()
                    print("Clicked Add Meal button (by icon)")
                else:
                    add_button = None
            except:
                add_button = None
            
            if not add_button:
                # Try by fixed position button at bottom right
                try:
                    add_button = page.locator('button.fixed, button[style*="fixed"]').first
                    if add_button.is_visible():
                        add_button.click()
                        print("Clicked Add Meal button (by fixed position)")
                    else:
                        add_button = None
                except:
                    add_button = None
            
            if not add_button:
                print("Could not find Add Meal button - taking screenshot for inspection")
                page.screenshot(path='/tmp/schedule_no_button.png', full_page=True)
                return
            
            # Wait for MealWizard to open
            time.sleep(2)
            page.screenshot(path='/tmp/meal_wizard.png', full_page=True)
            print("MealWizard opened - screenshot saved")
            
            # Look for Auto-fill button
            print("Looking for Auto-fill My Day with AI button...")
            try:
                page.wait_for_selector('text=Auto-fill', timeout=10000)
                auto_fill_button = page.locator('text=Auto-fill').first
                auto_fill_button.click()
                print("Clicked Auto-fill button")
            except Exception as e:
                print(f"Could not find Auto-fill button: {e}")
                page.screenshot(path='/tmp/meal_wizard_no_autofill.png', full_page=True)
                return
            
            # Wait for AI Suggestions modal
            time.sleep(3)
            page.screenshot(path='/tmp/ai_suggestions_modal.png', full_page=True)
            print("AI Suggestions modal opened - screenshot saved to /tmp/ai_suggestions_modal.png")
            
            # Check if buttons are visible
            print("\n--- Checking for action buttons ---")
            try:
                cancel_visible = page.locator('text=Cancel').first.is_visible()
                apply_visible = page.locator('text=Apply All').first.is_visible()
                print(f"Cancel button visible: {cancel_visible}")
                print(f"Apply All button visible: {apply_visible}")
            except Exception as e:
                print(f"Error checking buttons: {e}")
            
            # Get modal position
            try:
                modal = page.locator('[class*="rounded-t-["]').first
                if modal:
                    box = modal.bounding_box()
                    print(f"\nModal position: y={box['y']}, height={box['height']}")
                    print(f"Modal bottom: {box['y'] + box['height']}")
            except Exception as e:
                print(f"Could not get modal bounds: {e}")
            
            # Get button positions
            try:
                cancel_btn = page.locator('text=Cancel').first
                cancel_box = cancel_btn.bounding_box()
                print(f"\nCancel button position: y={cancel_box['y']}")
                
                apply_btn = page.locator('text=Apply All').first
                apply_box = apply_btn.bounding_box()
                print(f"Apply All button position: y={apply_box['y']}")
            except Exception as e:
                print(f"Could not get button positions: {e}")
            
            print("\nTest completed!")
            
        except Exception as e:
            print(f"\nError: {e}")
            page.screenshot(path='/tmp/error_state.png', full_page=True)
            
        finally:
            browser.close()

if __name__ == "__main__":
    test_ai_suggestions()
