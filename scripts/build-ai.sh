#!/bin/sh
# オンデバイス AI ヘルパー（Swift / Foundation Models）をビルドする。
# 出力: build/native/workone-ai（electron-builder の extraResources で同梱）
set -e
cd "$(dirname "$0")/.."
mkdir -p build/native
xcrun swiftc -O -parse-as-library \
  -target arm64-apple-macos26.0 \
  native/workone-ai/main.swift \
  -o build/native/workone-ai
echo "built build/native/workone-ai"
