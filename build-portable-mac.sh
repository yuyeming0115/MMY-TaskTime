#!/bin/bash

echo "================================================"
echo "   MMY-TaskTime Portable Build (macOS/Linux)"
echo "================================================"
echo ""

# Get version from package.json
VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null)

if [ -z "$VERSION" ]; then
    echo "[WARNING] Cannot read version from package.json"
    read -p "Enter version (e.g., 2.0.0): " VERSION
fi

echo "[INFO] Version: $VERSION"
echo ""

EXE_PATH="src-tauri/target/release/mmy-tasktime"
OUTPUT_DIR="release-portable"
OUTPUT_FILE="$OUTPUT_DIR/mmy-tasktime-v$VERSION"

# Check if executable exists
if [ ! -f "$EXE_PATH" ]; then
    echo "[INFO] Compiled executable not found"
    read -p "Run full build first? (y/n): " choice
    if [[ "$choice" == "y" || "$choice" == "Y" ]]; then
        ./build-mac.sh
    else
        echo "[CANCEL] Operation cancelled"
        exit 0
    fi
fi

# Check again
if [ ! -f "$EXE_PATH" ]; then
    echo "[ERROR] Executable not found, please run ./build-mac.sh first"
    exit 1
fi

echo "[START] Preparing portable version..."

# Create output directory
mkdir -p "$OUTPUT_DIR"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - Copy .app with version
    echo "[COPY] Copying .app with version..."
    if [ -d "src-tauri/target/release/bundle/macos/MMY-TaskTime.app" ]; then
        cp -R "src-tauri/target/release/bundle/macos/MMY-TaskTime.app" "$OUTPUT_DIR/MMY-TaskTime-v$VERSION.app"
        echo "[OK] Copied MMY-TaskTime-v$VERSION.app"
        
        # Also create zip
        echo "[ZIP] Creating zip archive..."
        cd "$OUTPUT_DIR"
        zip -r "MMY-TaskTime-v$VERSION.zip" "MMY-TaskTime-v$VERSION.app" -q
        cd ..
        echo "[OK] Created MMY-TaskTime-v$VERSION.zip"
    else
        echo "[WARNING] .app not found, copying executable..."
        cp "$EXE_PATH" "$OUTPUT_FILE"
        chmod +x "$OUTPUT_FILE"
    fi
else
    # Linux - Copy executable with version
    echo "[COPY] Copying executable with version..."
    cp "$EXE_PATH" "$OUTPUT_FILE"
    chmod +x "$OUTPUT_FILE"
    
    # Create tar.gz archive
    echo "[ARCHIVE] Creating archive..."
    cd "$OUTPUT_DIR"
    tar -czf "mmy-tasktime-v$VERSION.tar.gz" "mmy-tasktime-v$VERSION"
    cd ..
    echo "[OK] Created mmy-tasktime-v$VERSION.tar.gz"
fi

echo ""
echo "================================================"
echo "[COMPLETE] Portable version generated!"
echo "================================================"
echo ""
echo "Output directory: $OUTPUT_DIR/"
echo ""
echo "File list:"
ls -lh "$OUTPUT_DIR"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "[IMPORTANT NOTES]"
    echo "1. macOS .app can be distributed as zip or dmg"
    echo "2. For distribution, consider code signing and notarization"
    echo "3. Users may need to right-click and select 'Open' on first launch"
else
    echo "[IMPORTANT NOTES]"
    echo "1. Linux executable requires WebKitGTK installed"
    echo "2. Consider distributing as AppImage or Flatpak for better compatibility"
    echo "3. The tar.gz archive contains the versioned executable"
fi

echo ""
read -p "Press Enter to exit..."
