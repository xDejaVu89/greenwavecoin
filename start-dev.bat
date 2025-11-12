@echo off
echo Starting GreenWaveCoin Development Servers...
echo.

REM Kill existing node processes
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

REM Start stub backend
echo Starting stub backend on port 3000...
start "Stub Backend (Port 3000)" cmd /k "cd /d %~dp0 && node stub-backend.js"
timeout /t 3 /nobreak >nul

REM Start Vite dev server
echo Starting Vite dev server on port 5173...
start "Vite Dev Server (Port 5173)" cmd /k "cd /d %~dp0desktop && npm run dev:renderer"
timeout /t 5 /nobreak >nul

echo.
echo Both servers started!
echo - Stub Backend: http://localhost:3000
echo - Vite Dev: http://localhost:5173
echo.
echo Press any key to close this window (servers will keep running)...
pause >nul
