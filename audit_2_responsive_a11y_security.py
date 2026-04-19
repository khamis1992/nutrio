"""Audit 2: Responsive/Mobile + Accessibility + Security Deep Audit"""
import json
from playwright.sync_api import sync_playwright

RESULTS = []

def add_result(category, test_name, status, details="", severity=""):
    RESULTS.append({
        "category": category,
        "test": test_name,
        "status": status,
        "details": details,
        "severity": severity
    })

VIEWPORTS = [
    {"name": "iPhone SE", "width": 375, "height": 667},
    {"name": "iPhone 14", "width": 390, "height": 844},
    {"name": "iPhone 14 Pro Max", "width": 430, "height": 932},
    {"name": "Android Mid", "width": 360, "height": 800},
    {"name": "iPad Mini", "width": 768, "height": 1024},
    {"name": "Desktop", "width": 1440, "height": 900},
    {"name": "Landscape Mobile", "width": 844, "height": 390},
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ============= RESPONSIVE TESTING =============
    for vp in VIEWPORTS:
        context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)

        page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=20000)
        page.wait_for_timeout(2000)

        # Screenshot
        safe_name = vp["name"].replace(" ", "_").lower()
        page.screenshot(path=f"audit_responsive_{safe_name}.png", full_page=True)

        # Check for horizontal overflow
        overflow = page.evaluate("""() => {
            const docWidth = document.documentElement.scrollWidth;
            const bodyWidth = document.body.scrollWidth;
            const viewportWidth = window.innerWidth;
            return {
                docScrollWidth: docWidth,
                bodyScrollWidth: bodyWidth,
                viewportWidth: viewportWidth,
                hasHorizontalOverflow: docWidth > viewportWidth + 10 || bodyWidth > viewportWidth + 10,
                maxOverflow: Math.max(docWidth, bodyWidth) - viewportWidth
            };
        }""")

        if overflow["hasHorizontalOverflow"]:
            add_result("Responsive", f"Horizontal Overflow - {vp['name']}", "FAIL",
                       f"Overflow: {overflow['maxOverflow']}px on {vp['width']}x{vp['height']}", "High")
        else:
            add_result("Responsive", f"No Overflow - {vp['name']}", "PASS",
                       f"{vp['width']}x{vp['height']} viewport OK")

        # Check for clipped/truncated elements
        clipped = page.evaluate("""() => {
            const issues = [];
            document.querySelectorAll('button, a, [role="button"]').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.right > window.innerWidth + 5 || rect.left < -5 ||
                    rect.bottom > window.innerHeight + 50 || rect.top < -50) {
                    issues.push({
                        tag: el.tagName,
                        text: el.textContent?.substring(0, 50),
                        rect: {top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left}
                    });
                }
            });
            return issues.slice(0, 10);
        }""")

        if clipped:
            add_result("Responsive", f"Clipped Elements - {vp['name']}", "WARN",
                       f"{len(clipped)} elements outside viewport", "Medium")

        # Touch target sizes (44px minimum)
        small_targets = page.evaluate("""() => {
            const small = [];
            document.querySelectorAll('button, a, [role="button"], [tabindex]').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
                    small.push({
                        tag: el.tagName,
                        text: el.textContent?.substring(0, 30),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    });
                }
            });
            return small.slice(0, 20);
        }""")

        if small_targets:
            add_result("Responsive", f"Small Touch Targets - {vp['name']}", "WARN",
                       f"{len(small_targets)} targets < 44px: {small_targets[:5]}", "Medium")

        if console_errors:
            add_result("Responsive", f"Console Errors - {vp['name']}", "WARN",
                       f"{len(console_errors)} errors", "Low")

        context.close()

    # ============= ACCESSIBILITY TESTING =============
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    page.goto("http://localhost:5173/nutrio/dashboard", wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(2000)

    # Check for images without alt text
    img_alt_issues = page.evaluate("""() => {
        const issues = [];
        document.querySelectorAll('img').forEach(img => {
            if (!img.alt || img.alt.trim() === '') {
                issues.push({src: img.src?.substring(0, 100), hasAlt: !!img.alt});
            }
        });
        return issues;
    }""")
    add_result("Accessibility", "Images Missing Alt Text", "WARN" if img_alt_issues else "PASS",
               f"{len(img_alt_issues)} images without alt text", "Medium")

    # Check for form inputs without labels
    label_issues = page.evaluate("""() => {
        const issues = [];
        document.querySelectorAll('input, select, textarea').forEach(el => {
            const hasLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
                document.querySelector(`label[for="${el.id}"]`) || el.closest('label');
            if (!hasLabel) {
                issues.push({type: el.type || el.tagName, id: el.id, name: el.name});
            }
        });
        return issues;
    }""")
    add_result("Accessibility", "Inputs Without Labels", "WARN" if label_issues else "PASS",
               f"{len(label_issues)} inputs without labels: {label_issues[:5]}", "Medium")

    # Check color contrast (basic check)
    contrast_issues = page.evaluate("""() => {
        const issues = [];
        document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, label').forEach(el => {
            const style = window.getComputedStyle(el);
            const color = style.color;
            const bg = style.backgroundColor;
            if (color && bg && bg !== 'rgba(0, 0, 0, 0)' && color !== bg) {
                const text = el.textContent?.trim();
                if (text && text.length > 0 && text.length < 200) {
                    const fontSize = parseFloat(style.fontSize);
                    const isLarge = fontSize >= 18 || (fontSize >= 14 && parseInt(style.fontWeight) >= 700);
                    if (!isLarge) {
                        const rgb1 = color.match(/\\d+/g)?.map(Number);
                        const rgb2 = bg.match(/\\d+/g)?.map(Number);
                        if (rgb1 && rgb2) {
                            const l1 = 0.2126 * rgb1[0]/255 + 0.7152 * rgb1[1]/255 + 0.0722 * rgb1[2]/255;
                            const l2 = 0.2126 * rgb2[0]/255 + 0.7152 * rgb2[1]/255 + 0.0722 * rgb2[2]/255;
                            const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
                            if (ratio < 4.5) {
                                issues.push({
                                    text: text.substring(0, 40),
                                    ratio: ratio.toFixed(2),
                                    color: color,
                                    bg: bg
                                });
                            }
                        }
                    }
                }
            }
        });
        return issues.slice(0, 15);
    }""")
    add_result("Accessibility", "Low Contrast Text", "WARN" if contrast_issues else "PASS",
               f"{len(contrast_issues)} elements with contrast < 4.5:1", "Medium")

    # Check heading hierarchy
    heading_hierarchy = page.evaluate("""() => {
        const headings = [];
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
            headings.push({level: parseInt(h.tagName[1]), text: h.textContent?.trim().substring(0, 50)});
        });
        let issues = [];
        let prev = 0;
        for (const h of headings) {
            if (h.level > prev + 1 && prev > 0) {
                issues.push({text: h.text, level: h.level, prevLevel: prev});
            }
            prev = h.level;
        }
        return {headings: headings, skipped: issues};
    }""")
    add_result("Accessibility", "Heading Hierarchy", "WARN" if heading_hierarchy["skipped"] else "PASS",
               f"Headings: {heading_hierarchy['headings'][:10]}. Skipped: {heading_hierarchy['skipped']}", "Low")

    # Check ARIA roles
    aria_issues = page.evaluate("""() => {
        const issues = [];
        document.querySelectorAll('[role]').forEach(el => {
            const validRoles = ['alert', 'alertdialog', 'application', 'article', 'banner', 'button',
                'cell', 'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo',
                'dialog', 'directory', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell',
                'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
                'marquee', 'math', 'menu', 'menubar', 'menuitem', 'meter', 'navigation', 'none',
                'note', 'option', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region',
                'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
                'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel',
                'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'];
            if (!validRoles.includes(el.getAttribute('role'))) {
                issues.push({role: el.getAttribute('role'), tag: el.tagName});
            }
        });
        return issues;
    }""")
    add_result("Accessibility", "Invalid ARIA Roles", "WARN" if aria_issues else "PASS",
               f"Invalid roles: {aria_issues}", "Medium")

    # Focus order check
    focusable_count = page.evaluate("""() => {
        return document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])').length;
    }""")
    add_result("Accessibility", "Focusable Elements Count", "INFO",
               f"{focusable_count} focusable elements on page")

    # ============= SECURITY DEEP AUDIT =============
    # Check for inline scripts with sensitive data
    inline_script_issues = page.evaluate("""() => {
        const scripts = document.querySelectorAll('script:not([src])');
        const issues = [];
        scripts.forEach(s => {
            const text = s.textContent || '';
            if (text.includes('api_key') || text.includes('secret') || text.includes('token') ||
                text.includes('password')) {
                issues.push({preview: text.substring(0, 200)});
            }
        });
        return issues;
    }""")
    add_result("Security", "Inline Scripts with Sensitive Data", "FAIL" if inline_script_issues else "PASS",
               f"Found {len(inline_script_issues)} inline scripts with sensitive keywords", "High")

    # Check meta viewport for viewport-fit
    viewport_meta = page.evaluate("""() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
    }""")
    add_result("Mobile", "Viewport Meta Tag", "PASS" if viewport_meta else "FAIL",
               f"Content: {viewport_meta}", "High" if not viewport_meta else "Low")

    # Check for external resource loads
    external_resources = page.evaluate("""() => {
        const resources = [];
        document.querySelectorAll('script[src], link[href]').forEach(el => {
            const src = el.src || el.href;
            if (src && !src.startsWith(window.location.origin) && !src.includes('localhost')) {
                resources.push(src.substring(0, 150));
            }
        });
        return resources;
    }""")
    add_result("Security", "External Resource Loading", "INFO",
               f"External resources: {external_resources}")

    # Check meta tags for security
    meta_tags = page.evaluate("""() => {
        const metas = {};
        document.querySelectorAll('meta').forEach(m => {
            const name = m.getAttribute('name') || m.getAttribute('http-equiv');
            if (name) metas[name] = m.getAttribute('content')?.substring(0, 100);
        });
        return metas;
    }""")
    has_csp = 'content-security-policy' in str(meta_tags).lower()
    add_result("Security", "Content Security Policy", "WARN" if not has_csp else "PASS",
               f"Meta tags: {meta_tags}. CSP present: {has_csp}", "Medium")

    # ============= PERFORMANCE AUDIT =============
    perf_metrics = page.evaluate("""() => {
        const resources = performance.getEntriesByType('resource');
        const totalSize = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
        const slowResources = resources
            .filter(r => r.duration > 1000)
            .map(r => ({name: r.name.substring(0, 100), duration: Math.round(r.duration)}));
        const jsResources = resources.filter(r => r.name.endsWith('.js') || r.name.includes('.js?'));
        const cssResources = resources.filter(r => r.name.endsWith('.css') || r.name.includes('.css?'));

        return {
            totalResources: resources.length,
            totalTransferSize: totalSize,
            totalTransferSizeKB: Math.round(totalSize / 1024),
            slowResources: slowResources.slice(0, 10),
            jsFiles: jsResources.length,
            cssFiles: cssResources.length,
            jsTotalKB: Math.round(jsResources.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
            largestResources: resources
                .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
                .slice(0, 10)
                .map(r => ({name: r.name.substring(0, 100), sizeKB: Math.round((r.transferSize || 0) / 1024)}))
        };
    }""")
    add_result("Performance", "Resource Summary", "INFO",
               f"Resources: {perf_metrics['totalResources']}, Total KB: {perf_metrics['totalTransferSizeKB']}, JS: {perf_metrics['jsTotalKB']}KB in {perf_metrics['jsFiles']} files")
    add_result("Performance", "Slow Resources", "WARN" if perf_metrics['slowResources'] else "PASS",
               f"Slow (>1s): {perf_metrics['slowResources']}", "Medium")
    add_result("Performance", "Largest Resources", "INFO",
               f"Top 10: {perf_metrics['largestResources']}")

    # LCP/FID/CLS (Core Web Vitals proxy)
    web_vitals = page.evaluate("""() => {
        const paint = performance.getEntriesByType('paint');
        return {
            fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
            lcpEntries: performance.getEntriesByType('largest-contentful-paint'),
        };
    }""")
    fcp = web_vitals.get('fcp')
    if fcp:
        add_result("Performance", "First Contentful Paint", "PASS" if fcp < 2000 else "WARN" if fcp < 3000 else "FAIL",
                   f"FCP: {round(fcp)}ms", "High" if fcp and fcp > 3000 else "Medium")

    # ============= ROLE/PERMISSION TESTING =============
    # Check if admin/partner/driver data is exposed
    cross_portal_data = page.evaluate("""() => {
        const body = document.body?.innerHTML || '';
        return {
            hasAdminData: body.includes('admin-only') || body.includes('Admin Dashboard'),
            hasPartnerData: body.includes('partner-only') || body.includes('Restaurant Dashboard'),
            hasDriverData: body.includes('driver-only') || body.includes('Driver Dashboard'),
            hasRevenueData: body.includes('total_revenue') || body.includes('revenue'),
        };
    }""")
    add_result("Security", "Cross-Portal Data Leakage", "FAIL" if any(cross_portal_data.values()) else "PASS",
               f"Cross-portal data: {cross_portal_data}", "Critical")

    # Check for exposed environment variables
    env_leak = page.evaluate("""() => {
        const body = document.body?.innerHTML || '';
        return {
            hasSupabaseURL: body.includes('supabase.co') && !body.includes('placeholder'),
            hasApiKey: body.match(/['"][a-zA-Z0-9]{30,}['"]/g)?.slice(0, 5),
        };
    }""")
    add_result("Security", "Environment Variable Leakage", "WARN" if env_leak.get('hasApiKey') else "PASS",
               f"Potential keys in DOM: {env_leak.get('hasApiKey', [])}", "High")

    context.close()
    browser.close()

with open("audit_2_results.json", "w") as f:
    json.dump(RESULTS, f, indent=2)

print(f"Audit 2 complete. {len(RESULTS)} findings.")
for r in RESULTS:
    if r["status"] in ["FAIL", "WARN"]:
        print(f"  [{r['status']}] [{r['severity']}] {r['test']}: {r['details'][:120]}")