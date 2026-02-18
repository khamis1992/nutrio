@echo off
REM NutriFuel Documentation - Print to PDF Helper
REM This script opens the HTML file and provides instructions

echo ========================================
echo NutriFuel Documentation Print Helper
echo ========================================
echo.
echo Opening print-ready documentation in your default browser...
echo.
echo FOLLOW THESE STEPS TO CREATE PDF:
echo.
echo 1. When browser opens, press Ctrl+P
echo 2. Select "Save as PDF" as destination
echo 3. Set paper size to A4
echo 4. ENABLE "Background graphics"
echo 5. DISABLE "Headers and footers"
echo 6. Click Save/Print
echo.
echo File location: %~dp0NUTRIOFUEL_PRINT_READY.html
echo.
echo ========================================
echo.

REM Open the HTML file
start "" "%~dp0NUTRIOFUEL_PRINT_READY.html"

REM Wait a moment
timeout /t 2 >nul

echo.
echo [+] Browser should now be open with the documentation
echo [+] Press Ctrl+P to open print dialog
echo [+] Follow the steps above to create your PDF
echo.
pause
