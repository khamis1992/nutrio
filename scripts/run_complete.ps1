# Start dev server in a way that keeps it running
Write-Host "Starting dev server in background..."
Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev" -WindowStyle Minimized

# Wait for server to start
Write-Host "Waiting for server..."
Start-Sleep -Seconds 8

# Test
Write-Host "Running test..."
python scripts/final_test.py

# Cleanup
Write-Host "Done"
