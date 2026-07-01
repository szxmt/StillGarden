$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$env:STILLGARDEN_PORT = "8877"
$owners = @(Get-NetTCPConnection -LocalPort 8877 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($pidValue in $owners) {
  if ($pidValue) {
    Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
  }
}
python .\backend\server.py
