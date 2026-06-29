@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

echo ================================================
echo    MMY-TaskTime Build Script (Windows)
echo ================================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found, please install Node.js first
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

REM Check Rust
where cargo >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Rust/Cargo not found, please install Rust first
    echo Download: https://rustup.rs/
    pause
    exit /b 1
)

echo [CHECK] Checking dependencies...
for /f "tokens=1" %%i in ('node --version') do echo [OK] Node.js: %%i
for /f "tokens=1-2" %%i in ('cargo --version') do echo [OK] Rust: %%i %%j

echo.
echo [START] Preparing frontend resources...
call npm run prepare:dist

if %errorlevel% neq 0 (
    echo [ERROR] Failed to prepare frontend resources
    pause
    exit /b 1
)

echo.
echo [START] Building application...
echo This may take a few minutes, please wait...
echo.

call npm run build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed, please check error messages
    pause
    exit /b 1
)

echo.
echo ================================================
echo [SUCCESS] Build completed!
echo ================================================
echo.
echo Output location: src-tauri\target\release\bundle\
echo.

if exist "src-tauri\target\release\bundle\msi\*.msi" (
    echo Generated MSI installer:
    dir /b "src-tauri\target\release\bundle\msi\*.msi"
)

if exist "src-tauri\target\release\bundle\nsis\*.exe" (
    echo.
    echo Generated NSIS installer:
    dir /b "src-tauri\target\release\bundle\nsis\*.exe"
)

echo.
echo Single executable:
if exist "src-tauri\target\release\mmy-tasktime.exe" (
    echo [OK] Generated: src-tauri\target\release\mmy-tasktime.exe
    
    REM Get version and copy with version
    for /f "tokens=*" %%i in ('node -e "console.log(require('./package.json').version)" 2^>nul') do set VERSION=%%i
    if defined VERSION (
        copy "src-tauri\target\release\mmy-tasktime.exe" "release-portable\mmy-tasktime-v%VERSION%.exe" >nul 2>&1
        if exist "release-portable\mmy-tasktime-v%VERSION%.exe" (
            echo [COPY] Portable version: release-portable\mmy-tasktime-v%VERSION%.exe
        )
    )
) else (
    echo [INFO] Executable not found in expected location
)

echo.
pause
