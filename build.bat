@echo off
setlocal enabledelayedexpansion

echo [1/3] Building frontend...
cd frontend
call npm install
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed.
    exit /b %errorlevel%
)
cd ..

echo [2/3] Preparing backend static directory...
set "STATIC_DIR=backend\static"
if exist "!STATIC_DIR!" (
    echo Cleaning existing static directory...
    rmdir /s /q "!STATIC_DIR!"
)
mkdir "!STATIC_DIR!"

echo [3/3] Copying build files to backend...
xcopy /e /y /q "frontend\dist\*" "!STATIC_DIR!"

echo [SUCCESS] Frontend built and copied to backend/static.
pause
