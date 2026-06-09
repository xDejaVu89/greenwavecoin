@echo off
REM GreenWaveCoin Worker — Windows Build Script
REM Run this on a Windows machine to build the .exe

echo ============================================
echo  GreenWaveCoin Worker — Windows Build
echo ============================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+ from python.org
    pause
    exit /b 1
)

echo Installing build dependencies...
pip install pyinstaller requests numpy

echo.
echo Building GreenWaveCoin-Worker.exe ...
pyinstaller gwc_worker.spec --clean

if exist "dist\GreenWaveCoin-Worker.exe" (
    echo.
    echo ============================================
    echo  SUCCESS! Built: dist\GreenWaveCoin-Worker.exe
    echo ============================================
    echo.
    echo Upload dist\GreenWaveCoin-Worker.exe to GitHub Releases.
) else (
    echo.
    echo ERROR: Build failed. Check output above.
)

pause
