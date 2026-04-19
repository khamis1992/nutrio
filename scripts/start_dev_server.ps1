# Script to start dev server and wait
Write-Host "Starting dev server..."
Start-Process -FilePath "npx" -ArgumentList "vite", "--port", "5173" -NoNewWindow -PassThru | Out-Null
Write-Host "Wait 10 seconds for server to start..."
Start-Sleep -Seconds 10
Write-Host "Checking if server is running..."
netstat -ano | Select-String ":5173" | Select-Object -First 3
