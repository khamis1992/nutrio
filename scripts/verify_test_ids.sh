#!/bin/bash
# Verify all data-testid attributes are present in source files
echo "Checking for data-testid attributes in Dashboard.tsx..."
grep -c 'data-testid=' src/pages/Dashboard.tsx || echo "No data-testid found"
echo ""
echo "Checking for data-testid in BottomTabBar.tsx..."
grep -c 'data-testid=' src/components/layout/BottomTabBar.tsx || echo "No data-testid found"
