@echo off
REM Start HTTP Server for SIP Frontend
REM This batch file starts the Python HTTP server on port 8000

echo.
echo ========================================
echo   Spectroscopic Intelligence Platform
echo   Frontend HTTP Server
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

REM Start the server
echo Starting HTTP server on port 8000...
echo Access at: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.

python start-server.py
pause
