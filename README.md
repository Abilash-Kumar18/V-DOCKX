# V-DOCKX

**Vision-Based Autonomous Robot Docking and Charging System**

---

## Setup

### Prerequisites
- **Node.js**: v18.0+ / npm v9.0+
- **Python**: 3.10+ (with `pip` and `venv`)
- **Mobile Development**: Flutter SDK (or React Native / Expo CLI) & Android Studio / Xcode
- **Vision & Robotics**: OpenCV, NumPy, PyTorch / Ultralytics (YOLO), ROS2 / Gazebo (optional for simulation)

---

### Installation & Quickstart

#### 1. Clone the Repository
```bash
git clone https://github.com/Abilash-Kumar18/V-DOCKX.git
cd V-DOCKX
git checkout dev
```

#### 2. Backend Setup (API & Vision Engine)
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
python main.py
```
*Backend server will start at `http://localhost:8000` (API docs at `http://localhost:8000/docs`).*

#### 3. Frontend Dashboard Setup (Web UI / Telemetry)
```bash
cd frontend
npm install
npm run dev
```
*Web dashboard will be available at `http://localhost:5173` or `http://localhost:3000`.*

#### 4. Mobile Application Setup (Remote Monitoring & Control)
```bash
cd mobile
# For Flutter:
flutter pub get
flutter run

# For React Native / Expo:
# npm install
# npx expo start
```

---

## Project PRD

[PASTE FULL PRD OUTPUT FROM MANUS AI HERE]

### 1. PROBLEM STATEMENT & IDEA
- **Restated Problem**: Autonomous mobile robots (AMRs) in industrial, warehouse, and service environments must reliably return to charging stations to sustain 24/7 operations. In real-world environments, mechanical misalignments, dynamic lighting shifts, partial camera occlusions, and floor obstacles near charging pads cause docking failures. Repeated missed attempts drain battery reserves and disrupt operations.
- **Product Pitch**: **V-DOCKX** is an AI-powered, vision-guided autonomous precision docking and fleet power management system that delivers sub-centimeter alignment, real-time obstacle evasion, and instant visual verification for autonomous robots.
- **Target User Personas**: Warehouse Operations Managers, Robotics Deployment Engineers, Autonomous Fleet Maintenance Supervisors.
- **Core Value Proposition**: Eliminates manual intervention and costly docking failures with robust multi-marker visual pose estimation, adaptive trajectory correction, real-time obstacle avoidance, and unified cross-platform fleet monitoring.

### 2. FEATURE SCOPE
- **Must-Have (MVP)**:
  1. Real-time vision-based charging station localization (ArUco / AprilTag / Visual Feature Detection).
  2. Relative 6-DoF pose estimation (distance, yaw, pitch, roll, lateral offset) with error compensation under varied lighting.
  3. Dynamic collision-free trajectory planner with real-time docking approach adjustment.
  4. Visual alignment verification & electrical docking confirmation handshake.
  5. Centralized telemetry dashboard & mobile monitor displaying live camera stream, docking trajectory, battery state, and diagnostic telemetry.
- **Should-Have**:
  - Multi-robot charging queue scheduling and automated bay allocation.
  - Historical docking telemetry analytics (docking duration, retry rate, alignment error margins).
  - Emergency manual teleoperation override via mobile and web interfaces.
- **Won't-Have (Deferred)**:
  - Hardware contact-pad fabrication specifications.
  - Multi-warehouse cloud federation.

### 3. TECH STACK
- **Frontend**: React.js / Vite + Tailwind CSS / Vanilla CSS + Lucide Icons + Canvas / WebGL for real-time trajectory visualization.
- **Backend & Vision Service**: FastAPI (Python 3.11) + OpenCV (`cv2`) + NumPy + SciPy + WebSockets for high-frequency telemetry streaming.
- **Mobile App**: Flutter (Dart) or React Native for responsive real-time field diagnostics and teleoperation.
- **Database**: PostgreSQL / SQLite (for local development) with SQLAlchemy ORM and Redis for telemetry caching.
- **Deployment**: Docker containerization, Uvicorn / Gunicorn, Vercel / Netlify for web frontend.

### 4. SYSTEM ARCHITECTURE & DATA FLOW
1. **Vision Ingestion**: Robot on-board camera captures docking bay optical feed.
2. **Pose Estimation**: OpenCV / Vision Engine detects station visual fiducials and computes Euclidean distance and orientation matrix.
3. **Trajectory & Control**: Path planner computes spline trajectory and velocity commands (`cmd_vel`) to compensate for lateral/angular drift.
4. **Docking Handshake**: Proximity sensor + visual alignment verification triggers contact lock and begins charging cycle.
5. **Telemetry Broadcast**: FastAPI backend broadcasts real-time state via WebSockets to Web Dashboard and Mobile App.

### 5. TEAM & TASK ALLOCATION
- **Abilash Kumar R** (Team Lead): Architecture, FastAPI backend, database models, WebSocket streaming, GitHub orchestration, deployment.
- **Devaroopa E**: Frontend UI/UX, real-time docking HUD, camera feed viewer, alignment indicator components.
- **Dharani V**: Mobile app development (Flutter/React Native), full-stack integration, DB migrations, mobile-to-robot telemetry.
- **Dharshini B**: Frontend telemetry dashboard, analytics charts, partial backend API integration, session logging.
- **Francis Fernando V**: Frontend components, obstacle warning indicators, responsive layout, simulation UI.
