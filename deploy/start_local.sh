#!/bin/bash
# ==============================================================================
# V-DOCKX Local Production Launcher (Linux/macOS)
# ==============================================================================

echo "[V-DOCKX] Starting Backend daemon..."
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "[V-DOCKX] Starting Next.js Frontend..."
(cd frontend && npm start) &
FRONTEND_PID=$!

if command -v adb &> /dev/null; then
    adb reverse tcp:3000 tcp:3000
    adb reverse tcp:8000 tcp:8000
    echo "[V-DOCKX] ADB reverse connected for USB tethering."
fi

echo "[V-DOCKX] System running at http://localhost:3000/"
echo "Press [CTRL+C] to stop all services."

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
