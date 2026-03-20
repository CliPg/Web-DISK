#!/bin/bash

# 遇到错误即停止
set -e

echo "[1/3] Building frontend..."
cd frontend
npm install
npm run build
if [ $? -ne 0 ]; then
    echo "[ERROR] Frontend build failed."
    exit 1
fi
cd ..

echo "[2/3] Preparing backend static directory..."
STATIC_DIR="backend/static"
if [ -d "$STATIC_DIR" ]; then
    echo "Cleaning existing static directory..."
    rm -rf "$STATIC_DIR"
fi
mkdir -p "$STATIC_DIR"

echo "[3/3] Copying build files to backend..."
cp -R frontend/dist/* "$STATIC_DIR/"

echo "[SUCCESS] Frontend built and copied to backend/static."
