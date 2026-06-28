@echo off
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
cd /d "%~dp0"
npx tauri dev
if %errorlevel% neq 0 pause
