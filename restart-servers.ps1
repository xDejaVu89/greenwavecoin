# Kill all node processes
Write-Output "Stopping all node processes..."
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Start stub backend
Write-Output "Starting stub backend on port 3000..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; node stub-backend.js"
Start-Sleep -Seconds 3

# Start Vite dev server
Write-Output "Starting Vite dev server on port 5173..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\desktop'; npm run dev:renderer"
Start-Sleep -Seconds 5

# Verify both ports
Write-Output "`nChecking ports..."
try {
    $health = (Invoke-WebRequest -Uri 'http://localhost:3000/health' -UseBasicParsing).Content
    Write-Output "Port 3000 (stub backend): OK - $health"
} catch {
    Write-Output "Port 3000: FAILED - $($_.Exception.Message)"
}

try {
    $vite = (Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing).StatusCode
    Write-Output "Port 5173 (Vite): OK - Status $vite"
} catch {
    Write-Output "Port 5173: FAILED - $($_.Exception.Message)"
}

Write-Output "`nBoth servers started. Open http://localhost:5173 in your browser."
Write-Output "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
