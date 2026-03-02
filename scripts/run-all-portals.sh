#!/bin/bash
# Run all 4 portals simultaneously
# Usage: ./run-all-portals.sh

echo "=========================================="
echo "Running Tests Across All 4 Portals"
echo "=========================================="
echo ""

# Run with 4 workers (one per portal)
npx playwright test \
  e2e/customer/auth-fixed.spec.ts \
  e2e/admin/dashboard.spec.ts \
  e2e/cross-portal/order-lifecycle.spec.ts \
  --workers=4 \
  --reporter=list

echo ""
echo "=========================================="
echo "Portal Tests Complete!"
echo "=========================================="
