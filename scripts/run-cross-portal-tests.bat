@echo off
REM Cross-Portal Integration Tests Runner for Windows
REM Runs all cross-portal workflow tests

echo ==========================================
echo Cross-Portal Integration Tests
echo Nutrio Fuel - Multi-Portal Workflow Testing
echo ==========================================
echo.

REM Check if dev server is running
echo Checking if dev server is running on port 8080...
timeout /t 2 /nobreak >nul

REM Test 1: Order Lifecycle
echo.
echo Running: Order Lifecycle Workflow
echo ----------------------------------------
call npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --reporter=line
echo.

REM Test 2: Partner Onboarding
echo Running: Partner Onboarding Workflow
echo ----------------------------------------
call npx playwright test e2e/cross-portal/partner-onboarding.spec.ts --reporter=line
echo.

REM Test 3: Driver Delivery
echo Running: Driver Delivery Workflow
echo ----------------------------------------
call npx playwright test e2e/cross-portal/driver-delivery.spec.ts --reporter=line
echo.

REM Test 4: Admin Management
echo Running: Admin Management Workflow
echo ----------------------------------------
call npx playwright test e2e/cross-portal/admin-management.spec.ts --reporter=line
echo.

REM Test 5: Customer Journey
echo Running: Customer Journey Workflow
echo ----------------------------------------
call npx playwright test e2e/cross-portal/customer-journey.spec.ts --reporter=line
echo.

echo ==========================================
echo Cross-Portal Tests Complete!
echo ==========================================
echo.
echo To view detailed report:
echo   npx playwright show-report
echo.
echo To run individual tests:
echo   npx playwright test e2e/cross-portal/order-lifecycle.spec.ts
echo   npx playwright test e2e/cross-portal/partner-onboarding.spec.ts
echo   npx playwright test e2e/cross-portal/driver-delivery.spec.ts
echo   npx playwright test e2e/cross-portal/admin-management.spec.ts
echo   npx playwright test e2e/cross-portal/customer-journey.spec.ts
echo.

pause
