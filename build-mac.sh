#!/bin/bash

echo "================================================"
echo "   MMY-TaskTime 一键打包脚本 (macOS/Linux)"
echo "================================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 Rust
if ! command -v cargo &> /dev/null; then
    echo "[错误] 未找到 Rust/Cargo，请先安装 Rust"
    echo "访问 https://rustup.rs/ 安装"
    exit 1
fi

# 检查依赖
echo "[检查] 正在检查依赖..."
echo "[✓] Node.js: $(node --version)"
echo "[✓] Rust: $(cargo --version)"

# 检查 macOS 的额外依赖
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "[检查] macOS 检测到，检查 Xcode Command Line Tools..."
    if ! command -v xcodebuild &> /dev/null; then
        echo "[警告] 未找到 Xcode Command Line Tools，可能需要安装"
        echo "运行: xcode-select --install"
    fi
fi

echo ""
echo "[开始] 正在准备前端资源..."
npm run prepare:dist

if [ $? -ne 0 ]; then
    echo "[错误] 前端资源准备失败"
    exit 1
fi

echo ""
echo "[开始] 正在打包应用..."
echo "这可能需要几分钟时间，请耐心等待..."
echo ""

npm run build

if [ $? -ne 0 ]; then
    echo ""
    echo "[错误] 打包失败，请检查错误信息"
    exit 1
fi

echo ""
echo "================================================"
echo "[成功] 打包完成！"
echo "================================================"
echo ""
echo "输出文件位置: src-tauri/target/release/bundle/"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "生成的文件:"
    ls -lh src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null || echo "  - DMG: 未找到"
    ls -d src-tauri/target/release/bundle/macos/*.app 2>/dev/null || echo "  - APP: 未找到"
else
    echo "生成的文件:"
    ls -lh src-tauri/target/release/bundle/deb/*.deb 2>/dev/null || echo "  - DEB: 未找到"
    ls -lh src-tauri/target/release/bundle/rpm/*.rpm 2>/dev/null || echo "  - RPM: 未找到"
    ls -lh src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null || echo "  - AppImage: 未找到"
fi

echo ""
echo "单文件可执行程序:"
if [ -f "src-tauri/target/release/mmy-tasktime" ]; then
    echo "  - 已生成: src-tauri/target/release/mmy-tasktime"
else
    echo "  - 未生成（可执行程序在 bundle 目录中）"
fi
echo ""

read -p "按回车键退出..."
