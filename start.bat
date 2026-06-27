@echo off
chcp 65001 >nul
title MMY-TaskTime 启动器

echo ====================================
echo   MMY-TaskTime 桌面版启动器
echo ====================================
echo.

REM 设置 Rust/Cargo 路径
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

REM 检查 cargo 是否可用
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Rust/Cargo，请先安装 Rust: https://rustup.rs/
    echo.
    pause
    exit /b 1
)

echo [信息] 正在启动 MMY-TaskTime...
echo [信息] 首次启动需要编译依赖，请耐心等待约5-10分钟
echo.

REM 切换到项目目录并启动
cd /d "%~dp0"
npx tauri dev

if %errorlevel% neq 0 (
    echo.
    echo [错误] 启动失败，请检查错误信息
    pause
)
