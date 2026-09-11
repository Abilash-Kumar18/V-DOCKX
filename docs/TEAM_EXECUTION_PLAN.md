# V-DOCKX: 3-Member Team Execution Plan
## 24-Hour Hackathon Phased Roadmap

**Project:** Challenge 14 — Vision-Based Autonomous Robot Docking and Charging  
**Architecture:** Hybrid Line-Guided Navigation + Precision Visual Docking + Multi-Layer Camera Safety  
**Team Size:** 3 Members  

---

## 1. Team Role Allocation

| Role | Focus Area | Core Responsibilities |
|---|---|---|
| **Member 1: Vision & Perception Lead** | Computer Vision & AI Models | Camera driver, line detector (HSV/ROI), AprilTag/ArUco 6-DoF pose estimator, obstacle detector (AI + geometric corridor mask), frame preprocessor. |
| **Member 2: Controls, State Machine & Backend Lead** | Robotics Control & Systems | State machine, line-following controller, visual servoing controller, safety supervisor (priority override gate), FastAPI backend/WebSockets, robot command adapter (`cmd_vel`). |
| **Member 3: Dashboard, Telemetry & Integration Lead** | UI/UX & Testing Harness | Real-time web dashboard (React/Canvas HUD), camera overlay, telemetry logger (JSONL), offline replay script, automated test runner, demo video & presentation. |

---

## 2. Phased Roadmap Overview

```
Phase 0: Setup & API Contracts (Hours 0-2)
   │
   ▼
Phase 1: Line Following Baseline & HUD (Hours 2-6)
   │
   ▼
Phase 2: Precision Visual Docking (Hours 6-10)
   │
   ▼
Phase 3: Multi-Layer Camera Safety & Obstacles (Hours 10-14)
   │
   ▼
Phase 4: Docking Verification, Recovery & Replay (Hours 14-18)
   │
   ▼
Phase 5: Full Test Matrix & Gain Tuning (Hours 18-22)
   │
   ▼
Phase 6: Code Freeze & Demo Rehearsal (Hours 22-24)
```

---

## 3. Step-by-Step Phase Breakdown

### Phase 0: Setup, API Contracts & Shared Configuration (Hours 0 – 2)
*Goal: Establish data schemas and shared configurations so all 3 members can develop in parallel without merge conflicts.*

- [ ] **All Members**: Agree on core data contract definitions in `docking/`:
  - `PerceptionOutput`: `timestamp`, `station_id`, `detected` (bool), `distance_m`, `lateral_offset_m`, `heading_error_rad`, `confidence`.
  - `ControlCommand`: `timestamp`, `linear_velocity_mps`, `angular_velocity_rps`, `reason`.
  - `ObstacleOutput`: `timestamp`, `obstacle_present` (bool), `corridor_blocked` (bool), `confidence`.
  - `DockingResult`: `status` (`SUCCESS`, `FAILED`, `VISUALLY_ALIGNED`), `duration_s`, `attempts`, `final_errors`.
- [ ] **Member 1**: Populate `requirements.txt` (`opencv-python`, `numpy`, `fastapi`, `uvicorn`, `pyyaml`, `websockets`, optional `ultralytics`).
- [ ] **Member 2**: Populate default parameters in `config/docking.yaml`, `config/line.yaml`, and `config/obstacle.yaml`.
- [ ] **Member 3**: Set up Git branching workflow (`dev`, feature branches) and create basic project layout.

---

### Phase 1: Route Guidance & Movement Baseline (Hours 2 – 6)
*Goal: Have the robot detect and follow a floor line while streaming live camera feed to the dashboard.*

- [ ] **Member 1 (Perception)**:
  - Implement `docking/camera.py`: OpenCV video capture with device index configuration and offline video fallback.
  - Implement `docking/line_detector.py`: Crop lower-half Region of Interest (ROI), HSV color thresholding, morphological noise removal, contour extraction, centroid ($e_c$) and orientation angle ($e_a$) calculation.
- [ ] **Member 2 (Controls & Backend)**:
  - Implement `docking/line_controller.py`: Proportional steering ($\omega = K_c e_c + K_a e_a$) with dynamic speed reduction on sharp curves or elevated errors.
  - Implement `docking/robot_adapter.py`: Mock/simulator adapter translating velocity commands into simulated motion.
  - Scaffold `docking/hybrid_state_machine.py`: Manage states `IDLE` $\rightarrow$ `LINE_SEARCH` $\rightarrow$ `LINE_FOLLOW`.
- [ ] **Member 3 (Dashboard & Telemetry)**:
  - Build FastAPI WebSocket server in `backend/` streaming frames and telemetry at 10+ FPS.
  - Build initial web dashboard in `frontend/` showing live camera feed with line centroid crosshair and active state badge.

---

### Phase 2: Station Zone Transition & Precision Visual Docking (Hours 6 – 10)
*Goal: Transition the robot from line following to visual servoing using an AprilTag/ArUco marker.*

- [ ] **Member 1 (Perception)**:
  - Implement `docking/station_zone_detector.py`: Identify transition cues (transverse floor strip or marker visibility) to trigger approach mode.
  - Implement `docking/station_pose_detector.py`: ArUco/AprilTag PnP pose solver computing Euclidean distance ($e_d$), lateral offset ($e_y$), and yaw heading error ($e_\theta$).
  - Implement `docking/pose_filter.py`: Temporal smoothing (exponential moving average) to suppress measurement jitter.
- [ ] **Member 2 (Controls & Backend)**:
  - Implement visual servoing in `docking/controller.py`: $\omega = K_y e_y + K_\theta e_\theta$, $v = \operatorname{clamp}(K_d e_d, v_{\min}, v_{\max})$.
  - Expand `docking/hybrid_state_machine.py`: Add `STATION_ZONE_APPROACH` $\rightarrow$ `DOCKING_TARGET_ACQUIRE` $\rightarrow$ `FINE_ALIGN` $\rightarrow$ `FINAL_APPROACH`.
- [ ] **Member 3 (Dashboard & Telemetry)**:
  - Enhance HUD: Render 3D pose coordinate axes on the detected marker, numerical error gauges ($e_d, e_y, e_\theta$), and target lock indicator.
  - Record video samples of docking approaches to populate `data/replay/`.

---

### Phase 3: Multi-Layer Camera Safety & Obstacle Detection (Hours 10 – 14)
*Goal: Stop the robot immediately when obstacles appear and resume only after clearance.*

- [ ] **Member 1 (Perception)**:
  - Implement `docking/free_space_detector.py`: Define a trapezoidal polygon safety corridor in front of the robot. Flag intrusion if unknown texture/edges appear in the corridor.
  - Implement `docking/obstacle_ai.py`: Lightweight AI detection (MobileNet-SSD via OpenCV DNN or YOLO-World for classes `person`, `box`, `cart`).
  - Implement `docking/obstacle_fusion.py`: Fuse AI detections with geometric corridor checks.
- [ ] **Member 2 (Controls & Backend)**:
  - Implement `docking/safety.py`:
    - Priority gate: Force $v=0, \omega=0$ on obstacle detection or camera frame timeout ($>400\text{ ms}$).
    - Transition state to `OBSTACLE_STOP`.
    - Enforce clearance dwell period ($\ge 1.0\text{ s}$) before resuming prior motion state.
- [ ] **Member 3 (Dashboard & Telemetry)**:
  - Add visual safety overlays: Draw the dynamic corridor polygon (Green = Clear, Red = Obstructed) and AI bounding boxes.
  - Add manual Emergency Stop (E-STOP) button on the web interface.

---

### Phase 4: Docking Verification, Recovery & Replay Pipeline (Hours 14 – 18)
*Goal: Ensure docking success is rigorously validated, failures recover gracefully, and runs are replayable.*

- [ ] **Member 1 & 2 (Perception & Controls)**:
  - Implement `VERIFY` state in `docking/hybrid_state_machine.py`:
    - Check $|e_y| \le 3\text{ cm}$, $|e_\theta| \le 5^\circ$, $e_d \le 12\text{ cm}$, speeds $\approx 0$.
    - Require conditions to hold continuously for $T_{\text{dwell}} \ge 0.8\text{ s}$ before transitioning to `DOCKED` (`VISUALLY_ALIGNED`).
  - Implement recovery logic for `LINE_LOST` and `TARGET_LOST` (short reverse, bounded rotation, max 3 retry attempts before `FAILED`).
- [ ] **Member 3 (Dashboard, Logging & Replay)**:
  - Implement `docking/telemetry.py`: Stream and log structured JSON Lines (timestamps, pose estimates, velocities, state, stops).
  - Implement `scripts/replay_hybrid_run.py`: Replay pre-recorded camera video through the perception and state machine stack without physical hardware.
  - Implement `scripts/evaluate_hybrid_runs.py`: Output trial metrics (success rate %, average docking time, final error margins).

---

### Phase 5: Full Test Matrix Execution & Gain Tuning (Hours 18 – 22)
*Goal: Execute the test matrix, eliminate oscillations, and film backup demonstration videos.*

- [ ] **All Members**: Execute the standard test matrix:
  - **H01–H04**: Line following with straight path, left offset start, right offset start, and mild curve.
  - **H06**: Zone cue detection and smooth transition to station target.
  - **H07–H09**: Obstacle in corridor $\rightarrow$ immediate stop; unknown object stop; clearance dwell before resumption.
  - **H10–H13**: Low lighting, camera exposure change, marker loss recovery, and frame timeout ($>400\text{ ms}$).
- [ ] **Member 2**: Fine-tune PID gains ($K_c, K_a, K_y, K_\theta, K_d$) and reduce final creeping velocity ($0.05\text{ m/s}$) to eliminate terminal overshoot.
- [ ] **Member 3**: Record high-quality backup video showing side-by-side robot movement and dashboard HUD.

---

### Phase 6: Code Freeze, Presentation & Packaging (Hours 22 – 24)
*Goal: Polish deliverables, verify one-command startup, and rehearse the live presentation.*

- [ ] **Member 1**: Document model licenses and weights in `models/README.md` and `models/LICENSES.md`.
- [ ] **Member 2**: Finalize single-command entry point in `scripts/run_hybrid_docking.py` and document setup steps in `README.md`.
- [ ] **Member 3**: Finalize pitch deck highlighting architecture, closed-loop control philosophy (*See $\rightarrow$ Estimate $\rightarrow$ Act $\rightarrow$ Verify*), and test metrics table.

---

## 4. Scope Management & Hackathon Rules

### What to NEVER Cut:
1. **Safety Supervisor**: Immediate stop on obstacle, unknown corridor blockage, or stale frames ($>400\text{ ms}$).
2. **Verification Dwell**: Must remain stable for $\ge 0.8\text{ s}$ before declaring docking success.
3. **Offline Replay Mode**: `scripts/replay_hybrid_run.py` ensures the project can be demonstrated even if physical hardware or camera fails during judging.

### What to CUT FIRST (If Behind Schedule):
1. **Custom Model Training**: Use pre-trained weights (OpenCV MobileNet-SSD or default YOLO-World).
2. **Physical Charging Handshake**: Report `VISUALLY_ALIGNED` instead of attempting live electrical contact sensing.
3. **Dynamic Path Planning**: Retain simple stop-and-wait obstacle behavior instead of dynamic re-routing.
4. **Mobile App**: Focus 100% on the Web Dashboard HUD.
