@echo off
REM Start AI Vision Pipeline Service for SIP
REM Runs FastAPI AI Vision model on port 5000

echo.
echo ========================================
echo   Spectroscopic Intelligence Platform
echo   AI Vision Service (Plant & Leaf QA)
echo ========================================
echo.

cd /d "%~dp0ai_pipeline"

if exist "venv\Scripts\python.exe" (
    echo Starting AI Vision Service with venv...
    echo Model: MobileNetV2 + Grad-CAM Leaf Disease Detection
    echo AI Service available at: http://localhost:5000
    echo.
    venv\Scripts\python.exe app.py
) else (
    echo Starting AI Vision Service with system python...
    python app.py
)

pause
