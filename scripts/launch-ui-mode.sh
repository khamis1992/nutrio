#!/bin/bash
# Launch Playwright UI Mode for Cross-Portal Tests
# Run this script to see all 4 portals in action!

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  🎭 NUTRIO FUEL - CROSS-PORTAL UI MODE LAUNCHER          ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dev server is running
echo -e "${BLUE}Checking if dev server is running on port 8080...${NC}"
if ! nc -z localhost 8080 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Dev server not detected!${NC}"
    echo ""
    echo "Please start the dev server first:"
    echo "  npm run dev"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo -e "${GREEN}✅ Dev server is running!${NC}"
echo ""

# Show menu
echo "Select which test to run:"
echo ""
echo "  1) Order Lifecycle (Recommended - 9 tests, ~30 seconds)"
echo "     Shows: Customer → Partner → Driver → Admin"
echo ""
echo "  2) Wallet & Payments (20 tests, ~60 seconds)"
echo "     Shows: Financial flows across all portals"
echo ""
echo "  3) All Cross-Portal Tests (154 tests, ~5 minutes)"
echo "     Shows: Complete test suite"
echo ""
echo "  4) Quick Demo (1 test, ~10 seconds)"
echo "     Shows: All 4 portals logging in"
echo ""
echo "  5) Exit"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}Launching Order Lifecycle tests...${NC}"
        echo "You'll see:"
        echo "  • Customer browsing meals"
        echo "  • Partner receiving orders"
        echo "  • Driver viewing deliveries"
        echo "  • Admin monitoring everything"
        echo ""
        npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui
        ;;
    2)
        echo ""
        echo -e "${GREEN}Launching Wallet & Payments tests...${NC}"
        echo "You'll see:"
        echo "  • Customer wallet and checkout"
        echo "  • Partner earnings dashboard"
        echo "  • Driver earnings and payouts"
        echo "  • Admin financial oversight"
        echo ""
        npx playwright test e2e/cross-portal/wallet-payments.spec.ts --ui
        ;;
    3)
        echo ""
        echo -e "${GREEN}Launching ALL cross-portal tests...${NC}"
        echo "This will run 154 tests across 10 workflows"
        echo "Estimated time: 5 minutes"
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            npx playwright test e2e/cross-portal/ --ui
        fi
        ;;
    4)
        echo ""
        echo -e "${GREEN}Launching Quick Demo...${NC}"
        echo "You'll see all 4 portals log in simultaneously!"
        echo ""
        npx playwright test e2e/cross-portal/order-lifecycle.spec.ts:167 --ui
        ;;
    5)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ✨ UI Mode Closed                                        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
