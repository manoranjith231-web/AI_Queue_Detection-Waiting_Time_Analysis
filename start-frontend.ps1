# ============================================================
# QueueIQ AI — Start Next.js React Dashboard Frontend
# ============================================================
Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host " QueueIQ AI — Next.js Operations Dashboard               " -ForegroundColor White
Write-Host " Launching local development web server...               " -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# Check for node in local tools or system
$ToolsNode = "$PSScriptRoot\tools\node"
if (Test-Path "$ToolsNode\node.exe") {
    $env:PATH = "$ToolsNode;$env:PATH"
    Write-Host "[+] Using local portable Node.js: $ToolsNode" -ForegroundColor Green
}

Set-Location "$PSScriptRoot\frontend"
Write-Host "[+] Dashboard UI available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

npm run dev
