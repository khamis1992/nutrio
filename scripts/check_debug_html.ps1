$Content = Get-Content "C:\Users\khamis\Documents\nutrio\regression_test\debug.html"
$Content | Select-String -Pattern "customer-layout|bottom-tab-bar|min-h-screen|log-meal|nav " | Select-Object -First 10
