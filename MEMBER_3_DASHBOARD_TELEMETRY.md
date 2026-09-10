# Member 3: Dashboard, Telemetry & Integration Lead — Execution Plan

**Branch:** `feature/dashboard-telemetry`  
**Role:** Frontend UI/UX, Telemetry & Evaluation Harness Engineer  
**Core Mission:** Build the real-time web telemetry dashboard (HUD), camera overlay renderer, JSON Lines telemetry logger, offline video replay system, and automated evaluation metrics script.

---

## 1. Assigned Files & Responsibilities

| File Path | Description |
|---|---|
| [`frontend/`](file:///c:/V-DOCKX/frontend) | React / Vite + Vanilla CSS / Canvas HUD dashboard showing live camera feed, visual overlays, telemetry dials, and manual controls. |
| [`docking/telemetry.py`](file:///c:/V-DOCKX/docking/telemetry.py) | High-performance telemetry logger writing machine-readable JSON Lines (`.jsonl`) records for every frame. |
| [`scripts/replay_hybrid_run.py`](file:///c:/V-DOCKX/scripts/replay_hybrid_run.py) | Offline replay test harness executing the full perception and control loop against pre-recorded video files. |
| [`scripts/evaluate_hybrid_runs.py`](file:///c:/V-DOCKX/scripts/evaluate_hybrid_runs.py) | Batch analysis script computing success rates, docking times, final errors, and safety stop statistics across runs. |
| [`data/replay/`](file:///c:/V-DOCKX/data/replay) | Directory housing sample pre-recorded test run videos and telemetry logs. |
| [`results/`](file:///c:/V-DOCKX/results) | Directory where evaluation summaries, metrics tables, and run logs are output. |
| [`tests/test_replay.py`](file:///c:/V-DOCKX/tests/test_replay.py) | Automated test verifying that replay mode produces deterministic state transitions from recorded logs. |

---

## 2. Dashboard UI/UX Specification

The Web Dashboard serves as the primary visual display for judges, operators, and engineers:

```
+---------------------------------------------------------------------------------------+
|  V-DOCKX Autonomous Docking Telemetry HUD                [ E-STOP ] [ START DOCKING ] |
+---------------------------------------------------+-----------------------------------+
|                                                   |  SYSTEM STATUS                    |
|                LIVE CAMERA STREAM                 |  State: [ FINE_ALIGN ] (Orange)   |
|                                                   |  Battery: 84% | Latency: 42 ms    |
|   [===========================================]   +-----------------------------------+
|   |         \                       /         |   |  DOCKING ERROR GAUGES             |
|   |          \  CORRIDOR (CLEAR)   /          |   |  Distance (e_d):     0.24 m       |
|   |           \                   /           |   |  Lateral Error (e_y): +0.02 m     |
|   |            \      [Tag]      /            |   |  Heading Error:      -2.4 deg     |
|   |             +---------------+             |   +-----------------------------------+
|   |             |   (e_c, e_a)  |             |   |  VELOCITY COMMANDS                |
|   |             |  Line Center  |             |   |  Linear (v):  0.08 m/s            |
|   |             +---------------+             |   |  Angular (w): -0.12 rad/s         |
|   [===========================================]   +-----------------------------------+
|                                                   |  VERIFICATION STATUS              |
|   Overlays: Line Centroid | 3D Marker Axes |      |  Tolerances: [ OK ]               |
|   Safety Polygon | AI Obstacle Bounding Box       |  Dwell Time: [=======>    ] 0.6s  |
+---------------------------------------------------+-----------------------------------+
```

### Visual Overlay Elements (Drawn on Canvas or OpenCV stream):
1. **Line Centroid**: Vertical cyan guideline with crosshair at detected line center ($e_c$).
2. **Station Target**: Green bounding box around detected marker with RGB 3D coordinate axes ($X$ Red, $Y$ Green, $Z$ Blue).
3. **Safety Corridor Polygon**:
   - **Green** when path is clear.
   - **Flashing Red** with warning icon when obstacle or unknown edge intrusion is detected.
4. **AI Bounding Boxes**: Bounding rectangles around detected semantic objects with class label and confidence score (e.g. `box 89%`).

---

## 3. Step-by-Step Implementation Tasks

### Phase 0: Setup & Telemetry Schemas (Hours 0 – 2)
- [ ] Checkout branch: `git checkout feature/dashboard-telemetry`.
- [ ] Initialize frontend in `frontend/` using Vite (`npm create vite@latest . -- --template react` or lightweight Vanilla HTML/CSS/JS).
- [ ] In `docking/telemetry.py`, define JSON Lines structure:
  ```json
  {
    "timestamp": 1725972000.125,
    "run_id": "run_20260910_01",
    "state": "FINE_ALIGN",
    "distance_m": 0.245,
    "lateral_offset_m": 0.018,
    "heading_error_rad": -0.042,
    "linear_velocity_mps": 0.08,
    "angular_velocity_rps": -0.12,
    "corridor_blocked": false,
    "confidence": 0.92
  }
  ```

### Phase 1: Video Player & Initial HUD (Hours 2 – 6)
- [ ] In `frontend/`:
  - Build connection manager connecting to FastAPI WebSocket endpoint (`ws://localhost:8000/ws/telemetry`).
  - Render real-time camera frames on an HTML5 `<canvas>`.
  - Add active state badge with dynamic color styling (e.g. Green: `LINE_FOLLOW`/`DOCKED`, Orange: `APPROACH`/`ALIGN`, Red: `OBSTACLE_STOP`/`FAILED`).
- [ ] Test video feed streaming from Member 1's `camera.py` through Member 2's backend.

### Phase 2: Docking Gauges & Marker HUD Overlays (Hours 6 – 10)
- [ ] Add metric dials and numerical readouts:
  - Forward distance $e_d$ progress bar (ranges from $1.5\text{ m}$ down to docking goal $0.12\text{ m}$).
  - Lateral offset meter $e_y$ centered at zero with $\pm 3\text{ cm}$ target zone markers.
  - Heading error dial showing degrees offset.
- [ ] On the video canvas, render the detected AprilTag/ArUco bounding polygon and center lock target.
- [ ] Collect 2–3 sample video clips of camera approaches and save into `data/replay/` for offline testing.

### Phase 3: Safety Corridor Visualizer & Emergency Controls (Hours 10 – 14)
- [ ] Implement safety corridor polygon rendering on the canvas:
  - Interpolate trapezoid coordinates received via telemetry.
  - Fill polygon with semi-transparent green (clear) or semi-transparent red (blocked).
- [ ] Render obstacle bounding boxes with category badges (`person`, `box`, `obstacle`).
- [ ] Implement interactive control buttons:
  - **Start Docking** (`POST /api/start`).
  - **Emergency Stop (E-STOP)** (`POST /api/stop`) commanding zero velocity immediately.

### Phase 4: Telemetry Logger, Replay Harness & Evaluation Script (Hours 14 – 18)
- [ ] In `docking/telemetry.py`:
  - Implement `TelemetryLogger` with buffered asynchronous writes to `.jsonl` files in `results/`.
- [ ] In `scripts/replay_hybrid_run.py`:
  - Allow running the full perception/control loop against any recorded `.mp4` file in `data/replay/` without requiring physical camera or robot hardware.
  - Re-generate telemetry logs identically.
- [ ] In `scripts/evaluate_hybrid_runs.py`:
  - Read multiple `.jsonl` log files and generate a markdown metrics summary:
    - Overall Docking Success Rate ($\%$).
    - Median Docking Duration (seconds).
    - Final Lateral Error Mean & Max (cm).
    - Final Heading Error Mean & Max (deg).
    - Obstacle Stop Count & Resume Dwell Compliance ($\%$).
- [ ] In `tests/test_replay.py`, verify `replay_hybrid_run.py` runs end-to-end without crashing.

### Phase 5: Test Matrix Execution & Demonstration Media (Hours 18 – 22)
- [ ] Run test matrix scenarios (H01–H14) using the replay and evaluation scripts:
  - Verify metrics match PRD targets (Success Rate $\ge 85\%$, Lateral Error $\le 3\text{ cm}$, Heading $\le 5^\circ$).
  - Export metrics table into `results/evaluation_report.md`.
- [ ] Screen-record high-definition demonstration video showing:
  1. Off-center start $\rightarrow$ line acquisition.
  2. Transition to station zone.
  3. Obstacle placed in path $\rightarrow$ HUD flashes red, robot halts.
  4. Obstacle removed $\rightarrow$ dwell timer $\rightarrow$ resume approach.
  5. Final verification dwell and `DOCKED` declaration.

### Phase 6: Presentation Deck & Demo Rehearsal (Hours 22 – 24)
- [ ] Build presentation slides (leveraging `vdockx.pptx`):
  - Architecture diagram (Perception $\rightarrow$ State Machine $\rightarrow$ Safety Supervisor $\rightarrow$ HUD).
  - Quantitative evaluation metrics table.
  - Video demo embedded as offline backup.
- [ ] Rehearse live demonstration flow.
- [ ] Commit and push changes:
  ```bash
  git add .
  git commit -m "Complete frontend dashboard HUD, telemetry logger, replay and evaluation harness"
  git push origin feature/dashboard-telemetry
  ```

---

## 4. Acceptance Criteria & Definition of Done
1. **Live Rendering**: Dashboard renders stream and telemetry smoothly at $\ge 20\text{ FPS}$ with $< 50\text{ ms}$ display latency.
2. **Safety Feedback**: Obstacle intrusion visibly turns the safety corridor red within 1 frame.
3. **Replay Mode**: `scripts/replay_hybrid_run.py` works out-of-the-box with zero hardware required.
4. **Automated Analytics**: `scripts/evaluate_hybrid_runs.py` parses runs and outputs full performance statistics automatically.
