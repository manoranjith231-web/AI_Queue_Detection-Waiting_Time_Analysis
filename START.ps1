# ============================================================
#  QueueIQ AI - One-Click Launcher
#  Run this script to start both backend + frontend together
# ============================================================

$Root = "C:\Users\Manoranjith\Desktop\hackzen2.0"
$NodeExe = "$Root\tools\node\node.exe"
$NpmCli  = "$Root\tools\node\node_modules\npm\bin\npm-cli.js"
$VenvPy  = "$Root\backend_venv\Scripts\python.exe"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  QueueIQ AI - Starting Servers"          -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Start Backend ---
Write-Host "[1/2] Starting Python FastAPI Backend..." -ForegroundColor Yellow
$env:PYTHONPATH = $Root
Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit", "-Command",
    "`$env:PYTHONPATH = '$Root'; & '$VenvPy' '$Root\backend\run_backend.py'"
) -WorkingDirectory $Root

Start-Sleep -Seconds 3

# --- 2. Start Frontend ---
Write-Host "[2/2] Starting Next.js Frontend..." -ForegroundColor Yellow
$env:PATH = "$Root\tools\node;$env:PATH"
Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit", "-Command",
    "`$env:PATH = '$Root\tools\node;' + `$env:PATH; & '$NodeExe' '$NpmCli' run dev"
) -WorkingDirectory "$Root\frontend"

Start-Sleep -Seconds 6

# --- 3. Open browser ---
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Opening Dashboard in Browser..."        -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard  --> http://localhost:3000"   -ForegroundColor White
Write-Host "  Live Feed  --> http://localhost:3000/live" -ForegroundColor White
Write-Host "  Phone Cam  --> http://localhost:3000/mobile-cam" -ForegroundColor White
Write-Host "  API Docs   --> http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Start-Process "http://localhost:3000"

Write-Host "Both servers are running in separate windows." -ForegroundColor Green
Write-Host "Close those windows to stop the servers." -ForegroundColor Gray
