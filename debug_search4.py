from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.goto('http://localhost:5173/nutrio/meals')
    page.wait_for_load_state('networkidle')
    
    # Get all text that contains underscore
    result = page.evaluate('''() => {
        const inputs = document.querySelectorAll('input');
        const results = [];
        inputs.forEach(inp => {
            if(inp.placeholder && inp.placeholder.includes('_')) {
                results.push({
                    placeholder: inp.placeholder,
                    value: inp.value
                });
            }
        });
        return results;
    }''')
    print('Inputs with underscores in placeholder:', result)
    
    browser.close()
