@echo off
chcp 65001 >nul
title 月亮小窝本地服务
cd /d "%~dp0"
set STILLGARDEN_PORT=8877
powershell -NoProfile -ExecutionPolicy Bypass -Command "$owners = @(Get-NetTCPConnection -LocalPort 8877 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach ($pidValue in $owners) { if ($pidValue) { Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue } }"
python server.py
pause
