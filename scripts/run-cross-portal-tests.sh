#!/bin/bash
# Cross-Portal Integration Tests Runner
# Runs all cross-portal workflow tests

echo "=========================================="
echo "Cross-Portal Integration Tests"
echo "Nutrio Fuel - Multi-Portal Workflow Testing"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests with reporting
run_test() {
    local test_file=$1
    local test_name=$2
    
    echo -e "${BLUE}Running: $test_name${NC}"
    echo "----------------------------------------"
    
    npx playwright test "$test_file" --reporter=line
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $test_name PASSED${NC}"
    else
        echo -e "${YELLOW}✗ $test_name FAILED${NC}"
    fi
    echo ""
}

# Check if dev server is running
echo "Checking if dev server is running on port 8080..."
if ! nc -z localhost 8080 2>/dev/null; then
    echo -e "${YELLOW}Warning: Dev server not detected on port 8080${NC}"
    echo "Please run: npm run dev"
    echo ""
    read -p "Press Enter to continue anyway or Ctrl+C to cancel..."
    echo ""
fi

# Run all cross-portal tests
echo -e "${BLUE}Starting Cross-Portal Test Suite...${NC}"
echo ""

# Test 1: Order Lifecycle
run_test "e2e/cross-portal/order-lifecycle.spec.ts" "Order Lifecycle Workflow"

# Test 2: Partner Onboarding
run_test "e2e/cross-portal/partner-onboarding.spec.ts" "Partner Onboarding Workflow"

# Test 3: Driver Delivery
run_test "e2e/cross-portal/driver-delivery.spec.ts" "Driver Delivery Workflow"

# Test 4: Admin Management
run_test "e2e/cross-portal/admin-management.spec.ts" "Admin Management Workflow"

# Test 5: Customer Journey
run_test "e2e/cross-portal/customer-journey.spec.ts" "Customer Journey Workflow"

echo ""
echo "=========================================="
echo -e "${GREEN}Cross-Portal Tests Complete!${NC}"
echo "=========================================="
echo ""
echo "To view detailed report:"
echo "  npx playwright show-report"
echo ""
echo "To run individual tests:"
echo "  npx playwright test e2e/cross-portal/order-lifecycle.spec.ts"
echo "  npx playwright test e2e/cross-portal/partner-onboarding.spec.ts"
echo "  npx playwright test e2e/cross-portal/driver-delivery.spec.ts"
echo "  npx playwright test e2e/cross-portal/admin-management.spec.ts"
echo "  npx playwright test e2e/cross-portal/customer-journey.spec.ts"
echo ""
