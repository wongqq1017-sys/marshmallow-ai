#!/bin/bash
# Marshmallow AI - iOS 自动化构建脚本
# 使用方法: bash build-ios.sh

set -e

# 設定 UTF-8 編碼 (解決 CocoaPods 問題)
export LANG=en_US.UTF-8

echo "=========================================="
echo "Marshmallow AI - iOS 构建流程"
echo "=========================================="

# 1. 删除 DerivedData 缓存
echo ""
echo "[1/5] 正在清理 DerivedData 缓存..."
rm -rf ~/Library/Developer/Xcode/DerivedData/App-ercbgaxqpwnlxbdeclevotsshdpj
rm -rf ~/Library/Developer/Xcode/DerivedData/App-ffsbzxszxermotccnmnnyugyvdfg
rm -rf ~/Library/Developer/Xcode/DerivedData/MarshmallowApp-*
echo "✅ DerivedData 缓存已清理"

# 2. 构建 Vite 项目
echo ""
echo "[2/5] 正在构建 Vite 项目..."
npx vite build
echo "✅ Vite 项目构建完成"

# 3. 同步到 iOS
echo ""
echo "[3/5] 正在同步到 iOS..."
npx cap sync ios
echo "✅ iOS 同步完成"

# 4. 获取可用模拟器 (使用 iPhone 15 Pro)
echo ""
echo "[4/5] 正在设置模拟器..."
SIMULATOR_ID="0166807C-1AB0-4DB8-B029-FA6ED624FA42"
echo "📱 使用模拟器: iPhone 15 Pro (OS 17.0.1)"

# 5. xcodebuild 编译并安装到模拟器 (使用 workspace)
echo ""
echo "[5/5] 正在编译并安装到模拟器..."
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  build

if [ $? -eq 0 ]; then
  echo ""
  echo "=========================================="
  echo "✅ 构建成功！"
  echo "=========================================="
  echo ""
  echo "📱 正在安装到模拟器..."

  # 安裝到模擬器
  xcrun simctl boot "$SIMULATOR_ID" || true

  # 動態找到最新的 App-xxx 目錄
  APP_DIR=$(ls -td ~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Debug-iphonesimulator/App.app 2>/dev/null | head -1)
  if [ -n "$APP_DIR" ]; then
    xcrun simctl install "$SIMULATOR_ID" "$APP_DIR"
  fi

  # 啟動 App
  APP_PID=$(xcrun simctl launch "$SIMULATOR_ID" com.marshmallow.confidence 2>/dev/null | grep -oP '^\d+' || echo "")
  if [ -n "$APP_PID" ]; then
    echo "✅ App 已启动 (PID: $APP_PID)"
  else
    echo "✅ App 已安装到模拟器"
  fi
  echo ""
  echo "📱 可以在模拟器中打开应用进行测试"
  echo "   或者运行: open -a Simulator"
else
  echo ""
  echo "=========================================="
  echo "❌ 构建失败，请检查错误信息"
  echo "=========================================="
  exit 1
fi
