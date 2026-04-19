# Start dev server in background
Write-Host "Starting dev server..."
npm run dev | Out-Null

# Wait for server to start
Write-Host "Waiting for server..."
Start-Sleep -Seconds 8

# Test with Playwright
Write-Host "Running tests..."
python scripts/test_dashboard_complete.py
