# V-DOCKX | Vision-Based Autonomous Robot Docking & Telemetry Control

[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://docker.com)
[![Tests](https://img.shields.io/badge/Tests-7%2F7%20Passed%20(100%25)-success.svg)](scripts/run_all_tests.py)

V-DOCKX is a high-precision, vision-guided autonomous robot docking, collision evasion, and telemetry mission control platform. It combines sub-centimeter visual servoing, ArUco 6-DoF pose estimation, real-time corridor clearance assessment, and live smartphone camera video streaming.

---

## 🏛️ Organized Project Structure

```
V-DOCKX/
├── backend/                  # FastAPI Application Layer (REST & WebSockets)
│   └── main.py               # Telemetry, GPS tracking & vision processing server
├── config/                   # YAML System Configurations
│   ├── docking.yaml          # Tolerances, PID controller gains, FSM params
│   ├── line.yaml             # HSV thresholds, perspective ROI
│   └── obstacle.yaml         # Collision safety thresholds
├── data/                     # Calibration and Replay Datasets
├── deploy/                   # Production Deployment Packaging
│   ├── Dockerfile.backend    # Multi-stage Python 3.11 slim backend image
│   ├── Dockerfile.frontend   # Standalone Next.js Node 20 alpine image (~110MB)
│   ├── nginx.conf            # Nginx ingress reverse proxy (Port 80 -> UI & API)
│   ├── docker-compose.yml    # Multi-container orchestration
│   ├── DEPLOYMENT.md         # In-depth deployment manual & architecture guide
│   ├── .env.example          # Production environment template
│   ├── start_local.bat       # One-click Windows development launcher
│   └── start_local.sh        # One-click Linux/macOS development launcher
├── docking/                  # Core Robotics & Computer Vision Algorithms
│   ├── contracts.py          # Dataclasses & type schemas
│   ├── controller.py         # Visual servoing PID controller
│   ├── line_controller.py    # Line-following controller
│   ├── line_detector.py      # CLAHE-enhanced path detector
│   ├── free_space_detector.py# Geometric corridor collision detector (5.0m max horizon)
│   ├── obstacle_ai.py        # MobileNet-SSD semantic obstacle detection
│   ├── obstacle_fusion.py    # Multi-sensor fusion supervisor
│   ├── hybrid_state_machine.py# Finite state machine coordinator
│   ├── gps_tracker.py        # Smartphone relative GPS tracker
│   ├── robot_adapter.py      # Hardware / simulation robot adapter
│   └── safety.py             # Velocity clamping & emergency brake supervisor
├── docs/                     # Specifications & Design Documents
│   ├── Product Requirements Document.md
│   ├── TEAM_EXECUTION_PLAN.md
│   ├── BRANCHING_AND_CONFLICT_RULES.md
│   ├── MEMBER_1_VISION_PERCEPTION.md
│   ├── MEMBER_2_CONTROLS_BACKEND.md
│   ├── MEMBER_3_DASHBOARD_TELEMETRY.md
│   ├── workflow_infographic.jpg
│   └── vdockx.pptx
├── frontend/                 # Next.js 16 Mission Control Web Dashboard
│   ├── src/app/              # App router (Dashboard, /camera, API routes)
│   ├── src/lib/              # Video broadcasting & math utilities
│   ├── public/               # Static assets & icons
│   └── next.config.mjs       # Configured with standalone Docker output
├── models/                   # AI weights and deployment prototxt
│   ├── MobileNetSSD_deploy.prototxt
│   ├── MobileNetSSD_deploy.caffemodel
│   └── LICENSES.md
├── results/                  # Automated benchmark logs & JSONL runs
├── scripts/                  # Utilities, Benchmarks & Simulation Harness
│   ├── run_all_tests.py      # Master 7-step test & compliance suite
│   ├── run_hybrid_docking.py # Simulation docking runner
│   ├── benchmark_models_validation.py # Model accuracy verification
│   ├── evaluate_hybrid_runs.py        # Analytics & metrics generator
│   └── replay_hybrid_run.py  # Offline telemetry replay harness
├── tests/                    # Pytest Automated Test Suite (27/27 Passing)
├── docker-compose.yml        # Root Docker Compose orchestrator
├── pyproject.toml            # Python linting & packaging config
├── requirements.txt          # Python production dependencies
└── .env.example              # Environment variable template
```

---

## 🚀 Quickstart & Deployment

### 1. Unified One-Click Local Launcher
For rapid local testing with mobile phone USB tethering:
- **Windows**: Double click `deploy\start_local.bat`
- **Linux/macOS**: Run `./deploy/start_local.sh`

### 2. Docker Compose (Production Deployment)
Start the complete stack (Backend, Next.js Frontend, and Nginx Gateway):
```bash
docker compose up -d --build
```
- **Mission Control UI**: [http://localhost](http://localhost) (or `http://localhost:3000`)
- **Mobile Camera Stream**: [http://localhost/camera](http://localhost/camera) (or `http://localhost:3000/camera`)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Live Status**: [http://localhost:8000/api/status](http://localhost:8000/api/status)

For in-depth cloud deployment guides (AWS, DigitalOcean, Hetzner, Vercel, Railway, and SSL certificates for mobile camera access), read [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md).

---

## 🧪 Verification & Automated Testing

V-DOCKX features an end-to-end automated validation suite:

```bash
# Run the 27-test Pytest unit and safety suite
python -m pytest tests/ -v

# Run the master 7-step benchmark and system scorecard
python scripts/run_all_tests.py
```

### System Benchmark Scorecard (100% Compliant)
```
===========================================================================
                  FINAL SYSTEM TEST SCORECARD
===========================================================================
  Model Accuracy & Benchmark Suite              : PASS [OK]
  Pytest Unit & Safety Suite                    : PASS [OK]
  Nominal Docking Run                           : PASS [OK]
  Obstacle Safety Simulation                    : PASS [OK]
  Offline Replay Test Harness                   : PASS [OK]
  Batch Metric Evaluation                       : PASS [OK]
  Live Backend Health                           : PASS [OK]
---------------------------------------------------------------------------
  OVERALL RESULT: 7/7 PASSED (100% READY)
===========================================================================
```

---

## 📱 Mobile Phone Camera Setup

1. Connect your smartphone to the PC using a USB cable with USB Debugging enabled.
2. Enable port forwarding (automatic in `start_local.bat`):
   ```bash
   adb reverse tcp:3000 tcp:3000
   adb reverse tcp:8000 tcp:8000
   ```
3. On your phone's browser, open:
   `http://localhost:3000/camera`
4. Touch the phone to the charging port (3cm contact tolerance) to trigger the **`⚡ CHARGED (100%)`** confirmation handshake.
