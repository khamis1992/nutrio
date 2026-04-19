from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Listen for console messages
    def handle_console(msg):
        if msg.type == 'error':
            print(f'Console error: {msg.text}')
    
    page.on('console', handle_console)
    
    page.goto('http://localhost:5173/nutrio/meals')
    page.wait_for_load_state('networkidle')
    
    # Get all translations that contain "search"
    result = page.evaluate('''() => {
        // Check if there's a language context
        const inputs = document.querySelectorAll('input');
        const results = [];
        inputs.forEach(inp => {
            results.push({
                placeholder: inp.placeholder,
                value: inp.value
            });
        });
        return results;
    }''')
    print('All inputs:', result)
    
    browser.close()
