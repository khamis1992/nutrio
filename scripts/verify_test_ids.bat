#!/bin/bash
# Verify all data-testid attributes are present in source files
echo "Checking for data-testid attributes in Dashboard.tsx..."
findstr /c:"data-testid=" "src\pages\Dashboard.tsx"
echo ""
echo "Checking for data-testid in BottomTabBar.tsx..."
findstr /c:"data-testid=" "src\components\layout\BottomTabBar.tsx"
