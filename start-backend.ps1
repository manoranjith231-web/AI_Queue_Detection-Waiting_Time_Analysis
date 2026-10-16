# ============================================================
# QueueIQ AI - Start Python Computer Vision Backend
# ============================================================
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " QueueIQ AI - Intelligent Supermarket Queue Monitoring" -ForegroundColor White
Write-Host " Starting Python Computer Vision & FastAPI Backend...   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Set Python Virtual Environment
$VenvPython = "$PSScriptRoot\backend_venv\Scripts\python.exe"

if (-Not (Test-Path $VenvPython)) {
    Write-Host "[!] Virtual environment not found at backend_venv. Please create it first:" -ForegroundColor Red
    Write-Host "    python -m venv backend_venv" -ForegroundColor Yellow
    Exit 1
}

# Ensure root directory is on PYTHONPATH
$env:PYTHONPATH = "$PSScriptRoot"

Write-Host "[+] Local SQLite Database: $PSScriptRoot\backend\data\queueiq.db" -ForegroundColor Green
Write-Host "[+] YOLO Model: YOLOv8n (CPU execution, free & local)" -ForegroundColor Green
Write-Host "[+] Fast API Server: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "[+] Interactive API Docs: http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host ""

& $VenvPython "$PSScriptRoot\backend\run_backend.py"
