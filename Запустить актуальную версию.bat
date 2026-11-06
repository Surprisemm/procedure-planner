@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if not exist "node_modules\electron\dist\electron.exe" goto missing
start "" "node_modules\electron\dist\electron.exe" . %*
exit /b 0
:missing
chcp 65001 >nul
echo Не найден Electron. Выполните в этой папке: npm ci
pause
exit /b 1
