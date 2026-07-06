@echo off
REM Start Backend Server for SIP
REM This batch file starts the Node.js Express server

echo.
echo ========================================
echo   Spectroscopic Intelligence Platform
echo   Backend API Server
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Navigate to backend folder
cd backend

REM Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

REM Start the server
echo.
echo Starting backend server...
echo API available at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js
pause
