Write-Host "Check if server is running..."
$result = netstat -ano | Select-String ":5173"
if ($result) {
    Write-Host "Server is running!"
    $result | Select-Object -First 5
} else {
    Write-Host "Server NOT running yet. Starting..."
    # Start in background
    Start-Process -FilePath "npx" -ArgumentList "vite", "--port", "5173" -NoNewWindow -PassThru
    Start-Sleep -Seconds 10
    netstat -ano | Select-String ":5173" | Select-Object -First 3
}
