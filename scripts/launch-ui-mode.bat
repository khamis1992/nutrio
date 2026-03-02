@echo off
REM Launch Playwright UI Mode for Cross-Portal Tests
REM Run this script to see all 4 portals in action!

echo ╔═══════════════════════════════════════════════════════════╗
echo ║  NUTRIO FUEL - CROSS-PORTAL UI MODE LAUNCHER             ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

REM Check if dev server is running
echo Checking if dev server is running on port 8080...
timeout /t 2 /nobreak >nul

REM Show menu
echo.
echo Select which test to run:
echo.
echo   1) Order Lifecycle (Recommended - 9 tests, ~30 seconds)
echo      Shows: Customer - Partner - Driver - Admin
echo.
echo   2) Wallet and Payments (20 tests, ~60 seconds)
echo      Shows: Financial flows across all portals
echo.
echo   3) All Cross-Portal Tests (154 tests, ~5 minutes)
echo      Shows: Complete test suite
echo.
echo   4) Quick Demo (1 test, ~10 seconds)
echo      Shows: All 4 portals logging in
echo.
echo   5) Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto orderlifecycle
if "%choice%"=="2" goto walletpayments
if "%choice%"=="3" goto alltests
if "%choice%"=="4" goto quickdemo
if "%choice%"=="5" goto exit

echo Invalid choice. Please run the script again.
pause
exit /b 1

:orderlifecycle
echo.
echo Launching Order Lifecycle tests...
echo You'll see:
echo   - Customer browsing meals
echo   - Partner receiving orders
echo   - Driver viewing deliveries
echo   - Admin monitoring everything
echo.
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui
goto end

:walletpayments
echo.
echo Launching Wallet and Payments tests...
echo You'll see:
echo   - Customer wallet and checkout
echo   - Partner earnings dashboard
echo   - Driver earnings and payouts
echo   - Admin financial oversight
echo.
npx playwright test e2e/cross-portal/wallet-payments.spec.ts --ui
goto end

:alltests
echo.
echo Launching ALL cross-portal tests...
echo This will run 154 tests across 10 workflows
echo Estimated time: 5 minutes
echo.
set /p confirm="Continue? (y/n): "
if /i "%confirm%"=="y" (
    npx playwright test e2e/cross-portal/ --ui
)
goto end

:quickdemo
echo.
echo Launching Quick Demo...
echo You'll see all 4 portals log in simultaneously!
echo.
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts:167 --ui
goto end

:exit
echo Goodbye!
exit /b 0

:end
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║  UI Mode Closed                                           ║
echo ╚═══════════════════════════════════════════════════════════╝
pause
