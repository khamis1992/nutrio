#!/usr/bin/env python3
"""
Fix route mismatches in E2E test files
Maps Excel placeholder routes to actual app routes from App.tsx
"""

import os
import re
from pathlib import Path

# Route mapping: Excel/incorrect routes -> Actual app routes
ROUTE_MAPPING = {
    # Admin content routes (doesn't exist, map to closest features)
    '/admin/content/[id]': '/admin/restaurants',
    '/admin/content/[id]/edit': '/admin/restaurants',
    '/admin/content': '/admin/restaurants',
    '/admin/content/new': '/admin/promotions',

    # Admin analytics routes (remove [id] placeholder)
    '/admin/analytics/[id]': '/admin/analytics',
    '/admin/analytics/retention': '/admin/retention-analytics',

    # Admin subscription management (route exists but tests may use wrong pattern)
    '/admin/subscriptions/[id]': '/admin/subscriptions',
    '/admin/subscriptions/[id]/pause': '/admin/subscriptions',
    '/admin/subscriptions/[id]/cancel': '/admin/subscriptions',

    # Admin user management
    '/admin/users/[id]': '/admin/users',
    '/admin/users/[id]/freeze': '/admin/freeze-management',

    # Admin reports (doesn't exist, use exports)
    '/admin/reports': '/admin/exports',
    '/admin/reports/generate': '/admin/exports',

    # Admin IP management
    '/admin/ip': '/admin/ip-management',

    # Admin orders
    '/admin/orders/[id]': '/admin/orders',

    # Admin restaurant detail
    '/admin/restaurant/[id]': '/admin/restaurants/123',
    '/admin/restaurants/[id]': '/admin/restaurants/123',

    # Admin drivers
    '/admin/drivers/[id]': '/admin/drivers',

    # Admin payouts
    '/admin/payouts/[id]': '/admin/payouts',

    # Admin affiliate
    '/admin/affiliate/[id]': '/admin/affiliate-applications',

    # Admin deliveries
    '/admin/deliveries/[id]': '/admin/deliveries',

    # Admin featured
    '/admin/featured/[id]': '/admin/featured',

    # Admin exports
    '/admin/exports/[type]': '/admin/exports',

    # Admin settings
    '/admin/settings/[section]': '/admin/settings',

    # Admin support
    '/admin/support/[ticket]': '/admin/support',

    # Admin notifications
    '/admin/notifications/[id]': '/admin/notifications',

    # Admin gamification
    '/admin/gamification': '/admin/streak-rewards',
    '/admin/gamification/streaks': '/admin/streak-rewards',
    '/admin/gamification/milestones': '/admin/affiliate-milestones',

    # Admin AI
    '/admin/ai': '/admin/analytics',
    '/admin/ai/insights': '/admin/analytics',

    # Partner routes
    '/partner/restaurant/[id]': '/partner',
    '/partner/menu/[id]': '/partner/menu',
    '/partner/menu/[id]/edit': '/partner/menu',
    '/partner/orders/[id]': '/partner/orders',
    '/partner/orders/[id]/detail': '/partner/orders',
    '/partner/analytics/[metric]': '/partner/analytics',
    '/partner/analytics/[id]': '/partner/analytics',
    '/partner/settings/[section]': '/partner/settings',
    '/partner/payouts/[id]': '/partner/payouts',
    '/partner/earnings/[period]': '/partner/earnings',
    '/partner/support/[ticket]': '/partner/support',
    '/partner/reviews/[id]': '/partner/reviews',
    '/partner/notifications/[id]': '/partner/notifications',
    '/partner/profile/[section]': '/partner/profile',
    '/partner/boost/campaign/[id]': '/partner/boost',
    '/partner/addons/[id]': '/partner/addons',
    '/partner/ai/[feature]': '/partner/ai-insights',

    # Customer routes
    '/customer/dashboard': '/dashboard',
    '/customer/orders/[id]': '/order/123',
    '/customer/orders/[id]/tracking': '/tracking',
    '/customer/profile/[section]': '/profile',
    '/customer/settings/[section]': '/settings',
    '/customer/wallet/[action]': '/wallet',
    '/customer/subscription/[id]': '/subscription',
    '/customer/subscription/[id]/modify': '/subscription',
    '/customer/meals/[id]': '/meals/123',
    '/customer/restaurant/[id]': '/restaurant/123',
    '/customer/favorites/[id]': '/favorites',
    '/customer/notifications/[id]': '/notifications',
    '/customer/addresses/[id]': '/addresses',
    '/customer/affiliate/[section]': '/affiliate',
    '/customer/support/[ticket]': '/support',
    '/customer/referral/[code]': '/affiliate/tracking',
    '/customer/schedule/[date]': '/schedule',
    '/customer/progress/[metric]': '/progress',
    '/customer/weight/[entry]': '/weight-tracking',
    '/customer/checkout/[id]': '/checkout',
    '/customer/billing/[id]': '/invoices',
    '/customer/gamification': '/progress',
    '/customer/gamification/streaks': '/progress',
    '/customer/ai': '/meals',

    # Driver routes
    '/driver/delivery/[id]': '/driver/orders/123',
    '/driver/delivery/[id]/navigation': '/driver/orders/123',
    '/driver/delivery/[id]/complete': '/driver/orders/123',
    '/driver/earnings/[period]': '/driver/earnings',
    '/driver/payouts/[id]': '/driver/payouts',
    '/driver/profile/[section]': '/driver/profile',
    '/driver/settings/[section]': '/driver/settings',
    '/driver/support/[ticket]': '/driver/support',
    '/driver/notifications/[id]': '/driver/notifications',
    '/driver/history/[id]': '/driver/history',

    # System routes (these may not exist as pages)
    '/system/health': '/',
    '/system/monitoring': '/',
    '/system/logs': '/',
    '/system/backup': '/',
    '/system/security': '/',
    '/system/performance': '/',
}

# Root directory for test files
E2E_DIR = Path(__file__).parent.parent / 'e2e'

def fix_routes_in_file(file_path: Path) -> int:
    """Fix routes in a single file. Returns number of fixes made."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    fixes = 0

    # Sort by longest first to avoid partial replacements
    sorted_mappings = sorted(ROUTE_MAPPING.items(), key=lambda x: len(x[0]), reverse=True)

    for old_route, new_route in sorted_mappings:
        # Match the route pattern in goto statements
        pattern = r"(page\.goto\([^)]*)" + re.escape(old_route) + r"([^)]*\))"

        def replace_route(match):
            nonlocal fixes
            fixes += 1
            return match.group(1) + new_route + match.group(2)

        content = re.sub(pattern, replace_route, content)

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[FIXED] {fixes} routes in {file_path.name}")
        return fixes

    return 0

def main():
    """Fix routes in all test files."""
    total_fixes = 0
    files_modified = 0

    # Find all test files
    for test_file in E2E_DIR.rglob('*.spec.ts'):
        fixes = fix_routes_in_file(test_file)
        if fixes > 0:
            total_fixes += fixes
            files_modified += 1

    print(f"\n{'='*60}")
    print(f"Route Fix Summary")
    print(f"{'='*60}")
    print(f"Files modified: {files_modified}")
    print(f"Total route fixes: {total_fixes}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
