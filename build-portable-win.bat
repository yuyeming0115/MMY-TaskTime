@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

echo ================================================
echo    MMY-TaskTime Portable Build (Windows)
echo ================================================
echo.

set EXE_PATH=src-tauri\target\release\mmy-tasktime.exe
set OUTPUT_DIR=release-portable

REM Get version from package.json using Node.js
for /f "tokens=*" %%i in ('node -e "console.log(require('./package.json').version)" 2^>nul') do set VERSION=%%i

if not defined VERSION (
    echo [WARNING] Cannot read version from package.json
    set /p VERSION="Enter version (e.g., 2.0.0): "
)

echo [INFO] Version: %VERSION%
echo.

REM Check if executable exists
if not exist "%EXE_PATH%" (
    echo [INFO] Compiled executable not found
    set /p choice="Run full build first? (y/n): "
    if /i "!choice!"=="y" (
        call build-win.bat
    ) else (
        echo [CANCEL] Operation cancelled
        pause
        exit /b 0
    )
)

REM Check again
if not exist "%EXE_PATH%" (
    echo [ERROR] Executable not found, please run build-win.bat first
    pause
    exit /b 1
)

echo [START] Preparing portable version...

REM Create output directory
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo [COPY] Copying executable with version...
set OUTPUT_FILE=%OUTPUT_DIR%\mmy-tasktime-v%VERSION%.exe
copy "%EXE_PATH%" "%OUTPUT_FILE%" /Y >nul

if exist "%OUTPUT_FILE%" (
    echo [OK] Copied successfully
) else (
    echo [ERROR] Copy failed
    pause
    exit /b 1
)

echo.
echo ================================================
echo [COMPLETE] Portable version generated!
echo ================================================
echo.
echo Output directory: %OUTPUT_DIR%\
echo.
echo File list:
dir "%OUTPUT_DIR%"
echo.

echo [IMPORTANT NOTES]
echo 1. This executable requires WebView2 Runtime on target machine
echo 2. If WebView2 is not installed, download from:
echo    https://developer.microsoft.com/en-us/microsoft-edge/webview2/
echo 3. The executable can be run directly without installation
echo.

pause
