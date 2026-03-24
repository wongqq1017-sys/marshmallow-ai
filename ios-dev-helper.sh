#!/bin/zsh
set -e

echo "🔄 清理 Xcode DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData || true

echo "📦 打包前端 (npm run build)..."
npm run build

echo "📲 同步到 iOS (npx cap sync ios)..."
npx cap sync ios

echo "🧪 開啟 iOS 專案到 Xcode..."
open ios/App/App.xcworkspace

echo "✅ 完成，你只要在 Xcode 裡按下 Run，看模擬器就好。"

