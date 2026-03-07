from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Navigate to the profile page
    page.goto('http://localhost:5173/profile')
    page.wait_for_load_state('networkidle')
    
    # Take screenshot of initial state (might show login or profile based on auth)
    page.screenshot(path='/tmp/profile_initial.png', full_page=True)
    print("Screenshot saved: /tmp/profile_initial.png")
    
    # Get page content to check for any visible English text
    content = page.content()
    
    # Check if there's a language switcher
    try:
        lang_selector = page.locator('[data-testid="language-switcher"], button:has-text("العربية"), button:has-text("AR"), select[name="language"]')
        if lang_selector.count() > 0:
            print("Found language switcher")
            lang_selector.first.click()
            time.sleep(0.5)
            
            # Look for Arabic option and click it
            arabic_option = page.locator('text=العربية, text=AR, [value="ar"]')
            if arabic_option.count() > 0:
                arabic_option.first.click()
                time.sleep(1)
                page.wait_for_load_state('networkidle')
                
                # Take screenshot after switching to Arabic
                page.screenshot(path='/tmp/profile_arabic.png', full_page=True)
                print("Screenshot saved: /tmp/profile_arabic.png")
    except Exception as e:
        print(f"Language switcher interaction failed: {e}")
    
    # Look for specific hardcoded English text that shouldn't be there
    english_texts = [
        "Name, gender, age and email address",
        "Delivery Addresses",
        "Dietary & Allergies",
        "Manage dietary preferences",
        "Terms and conditions",
        "Privacy Policy",
        "personal_info_desc",
        "Personal Info"
    ]
    
    found_english = []
    for text in english_texts:
        if text in content:
            found_english.append(text)
    
    if found_english:
        print(f"\n⚠️ Found hardcoded English text: {found_english}")
    else:
        print("\n✅ No hardcoded English text found in HTML content")
    
    # Get all visible text on the page
    visible_text = page.evaluate('''() => {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        let text = '';
        let node;
        while (node = walker.nextNode()) {
            if (node.parentElement.offsetParent !== null) {
                text += node.textContent + ' ';
            }
        }
        return text;
    }''')
    
    # Check for key English phrases in visible text
    key_phrases = [
        "Name, gender, age",
        "Delivery Addresses",
        "Dietary & Allergies",
        "Terms and conditions",
        "personal_info_desc"
    ]
    
    visible_english = []
    for phrase in key_phrases:
        if phrase in visible_text:
            visible_english.append(phrase)
    
    if visible_english:
        print(f"\n⚠️ Found visible English text: {visible_english}")
    else:
        print("\n✅ No visible English text from hardcoded strings")
    
    browser.close()