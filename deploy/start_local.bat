@echo off
REM ==============================================================================
REM V-DOCKX Local Production Launcher (Windows)
REM ==============================================================================

echo [V-DOCKX] Starting FastAPI Backend on port 8000...
start "V-DOCKX Backend" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

echo [V-DOCKX] Starting Next.js Frontend on port 3000...
start "V-DOCKX Frontend" cmd /k "cd frontend && npm start"

echo [V-DOCKX] Running ADB reverse for USB tethering...
where adb >nul 2>nul
if %errorlevel% equ 0 (
    adb reverse tcp:3000 tcp:3000
    adb reverse tcp:8000 tcp:8000
    echo [V-DOCKX] ADB reverse connected: port 3000 and 8000 forwarded to phone.
) else (
    echo [V-DOCKX] Note: adb command not found in PATH. Use Wi-Fi hotspot if testing on mobile.
)

echo [V-DOCKX] Dashboard running at: http://localhost:3000/
echo [V-DOCKX] Mobile Camera at:   http://localhost:3000/camera
pause
