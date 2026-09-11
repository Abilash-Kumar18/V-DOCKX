# Member 2: Controls, State Machine & Backend Lead — Execution Plan

**Branch:** `feature/controls-backend`  
**Role:** Robotics Control, State Machine & Backend Systems Engineer  
**Core Mission:** Implement the hybrid finite-state machine, proportional line controller, precision visual servoing controller, safety supervisor priority gate, and FastAPI backend/WebSocket telemetry streaming.

---

## 1. Assigned Files & Responsibilities

| File Path | Description |
|---|---|
| [`docking/hybrid_state_machine.py`](file:///c:/V-DOCKX/docking/hybrid_state_machine.py) | Lifecycle management across line following, station acquisition, fine alignment, verification, and recovery. |
| [`docking/line_controller.py`](file:///c:/V-DOCKX/docking/line_controller.py) | Proportional steering controller following floor line ($e_c, e_a$) with dynamic speed throttling. |
| [`docking/controller.py`](file:///c:/V-DOCKX/docking/controller.py) | Closed-loop visual servoing controller for final docking approach ($e_d, e_y, e_\theta$). |
| [`docking/safety.py`](file:///c:/V-DOCKX/docking/safety.py) | Safety supervisor enforcing command limits, stale-frame timeouts ($>400\text{ ms}$), emergency stops, and clearance dwell. |
| [`docking/robot_adapter.py`](file:///c:/V-DOCKX/docking/robot_adapter.py) | Translates high-level velocity commands into robot base commands (`cmd_vel`) or 2D kinematic simulation state. |
| [`config/docking.yaml`](file:///c:/V-DOCKX/config/docking.yaml) | Speed limits, control gains ($K_p$), tolerance thresholds, dwell times, and retry bounds. |
| [`backend/main.py`](file:///c:/V-DOCKX/backend) | FastAPI application providing REST control endpoints and high-frequency WebSocket telemetry streams. |
| [`tests/test_hybrid_state_machine.py`](file:///c:/V-DOCKX/tests/test_hybrid_state_machine.py) | Unit tests verifying deterministic state transitions and recovery triggers. |
| [`tests/test_safety.py`](file:///c:/V-DOCKX/tests/test_safety.py) | Unit tests verifying safety override priority over active navigation commands. |

---

## 2. Core Algorithms & Mathematical Formulations

### 2.1 State Machine Lifecycle
```text
[IDLE]
   │ (Docking Request Received)
   ▼
[LINE_SEARCH] ──────► Line detected stably (≥ 3 frames)
   │
   ▼
[LINE_FOLLOW] ──────► Station zone cue detected
   │
   ▼
[STATION_ZONE_APPROACH] ──► Slows down; AprilTag/Station marker visible
   │
   ▼
[DOCKING_TARGET_ACQUIRE] ─► Valid target pose verified
   │
   ▼
[FINE_ALIGN] ───────► Reduces lateral error (e_y) and heading error (e_theta)
   │
   ▼
[FINAL_APPROACH] ───► Creeps at minimal speed (e.g. 0.05 m/s) with tight tolerances
   │
   ▼
[VERIFY] ───────────► Velocity ~0; errors within bounds for Dwell Time ≥ 0.8s
   │
   ▼
[DOCKED / VISUALLY_ALIGNED]
```
**Safety Interruption States (from ANY active state):**
- `OBSTACLE_STOP`: Obstacle in corridor $\rightarrow$ immediate $v=0, \omega=0$. Resumes only after clearance dwell ($\ge 1.0\text{ s}$).
- `LINE_LOST` / `TARGET_LOST`: Bounded reverse and search; fails if retries $> 3$.
- `SENSOR_FAULT_STOP`: Stale camera frame ($> 400\text{ ms}$) $\rightarrow$ fail-safe emergency stop.

---

### 2.2 Control Laws
1. **Line Following Controller** (`docking/line_controller.py`):
   $$\omega = K_c e_c + K_a e_a$$
   $$v = v_{\text{base}} \cdot \max\left(0.3, 1.0 - \beta_c |e_c| - \beta_a |e_a|\right)$$
   *(Slows down when deviation or curvature is large)*.

2. **Visual Servoing Docking Controller** (`docking/controller.py`):
   $$\omega = K_y e_y + K_\theta e_\theta$$
   $$v = \operatorname{clamp}(K_d e_d, v_{\min}, v_{\max})$$
   - Defaults: $K_d = 0.45, K_y = 1.20, K_\theta = 1.00$.
   - Speed clamping: $v_{\max} = 0.20\text{ m/s}$, creeping speed $= 0.05\text{ m/s}$, $|\omega| \le 0.60\text{ rad/s}$.
   - Add deadbands around zero: If $|e_y| < 0.005\text{ m}$ and $|e_\theta| < 0.02\text{ rad}$, set $\omega = 0$ to prevent chatter.

3. **Safety Supervisor Priority Gate** (`docking/safety.py`):
   ```python
   def evaluate_command(raw_cmd, obstacle_status, frame_age_s):
       if frame_age_s > 0.40:
           return ControlCommand(0.0, 0.0, reason="STALE_FRAME_TIMEOUT")
       if obstacle_status.corridor_blocked:
           return ControlCommand(0.0, 0.0, reason="OBSTACLE_SAFETY_STOP")
       return clamp_velocities(raw_cmd)
   ```

4. **Verification Dwell Criteria** (`docking/hybrid_state_machine.py`):
   Transition from `FINAL_APPROACH` to `DOCKED` requires:
   - $|e_y| \le 0.03\text{ m}$ ($3\text{ cm}$)
   - $|e_\theta| \le 0.08\text{ rad}$ (~$4.5^\circ$)
   - $e_d \le 0.12\text{ m}$ ($12\text{ cm}$)
   - Robot velocity $< 0.01\text{ m/s}$
   - All conditions continuously true for $T_{\text{dwell}} \ge 0.8\text{ s}$.

---

## 3. Step-by-Step Implementation Tasks

### Phase 0: Setup & Configuration (Hours 0 – 2)
- [ ] Checkout branch: `git checkout feature/controls-backend`.
- [ ] Define standard parameters in `config/docking.yaml`:
  - `control`: `kp_distance`, `kp_lateral`, `kp_heading`, `max_linear_velocity_mps`, `final_linear_velocity_mps`.
  - `thresholds`: `lateral_tolerance_m`, `heading_tolerance_rad`, `docking_distance_m`, `verification_dwell_s`, `target_loss_timeout_s`.
- [ ] Scaffold `docking/robot_adapter.py` with 2D kinematic differential drive simulator (updates $(x, y, \theta)$ given $(v, \omega)$ and time $\Delta t$).

### Phase 1: Line Controller & State Machine Foundation (Hours 2 – 6)
- [ ] In `docking/line_controller.py`, implement `LineController` computing angular velocity $\omega$ and linear velocity $v$ from `LineDetectionOutput`.
- [ ] In `docking/hybrid_state_machine.py`, implement state enum and transition logic for:
  - `IDLE` $\rightarrow$ `LINE_SEARCH` $\rightarrow$ `LINE_FOLLOW`.
- [ ] In `docking/robot_adapter.py`, connect simulator output to verify the simulated robot tracks a virtual straight and curved line.
- [ ] In `tests/test_hybrid_state_machine.py`, write tests for line acquisition and loss transitions.

### Phase 2: Visual Servoing Controller & Docking States (Hours 6 – 10)
- [ ] In `docking/controller.py`, implement `VisualServoController` taking `PerceptionOutput` and generating velocity commands.
- [ ] In `docking/hybrid_state_machine.py`, implement transitions:
  - `LINE_FOLLOW` $\rightarrow$ `STATION_ZONE_APPROACH` (triggered by zone detector).
  - `STATION_ZONE_APPROACH` $\rightarrow$ `DOCKING_TARGET_ACQUIRE` $\rightarrow$ `FINE_ALIGN` $\rightarrow$ `FINAL_APPROACH`.
- [ ] Connect simulated tag perception to `VisualServoController` to demonstrate smooth convergence from an initial lateral and heading offset.

### Phase 3: Safety Supervisor & Obstacle Reaction (Hours 10 – 14)
- [ ] In `docking/safety.py`, implement `SafetySupervisor`:
  - Enforce strict priority hierarchy.
  - Implement clearance dwell timer: once obstacle disappears, hold $v=0, \omega=0$ until $1.0\text{ s}$ of uninterrupted clear frames has elapsed.
  - Implement stale frame detection: stop if last perception timestamp is $> 0.40\text{ s}$ old.
- [ ] In `docking/hybrid_state_machine.py`, handle transitions into and out of `OBSTACLE_STOP`.
- [ ] In `tests/test_safety.py`, verify safety overrides navigation commands under all conditions.

### Phase 4: Verification Dwell & Recovery Maneuvers (Hours 14 – 18)
- [ ] Implement `VERIFY` state logic:
  - Track consecutive stable frames where errors are inside acceptance bounds.
  - Declare `DOCKED` (status: `VISUALLY_ALIGNED`) only when dwell timer $\ge 0.8\text{ s}$.
- [ ] Implement recovery behaviors:
  - If target lost in `FINE_ALIGN`: command reverse motion at $-0.05\text{ m/s}$ for $1.0\text{ s}$, then small scan.
  - Increment retry counter; if retries $> 3$, enter `FAILED` with machine-readable diagnostic reason.

### Phase 5: FastAPI Backend & Telemetry Streaming (Hours 18 – 22)
- [ ] In `backend/main.py`:
  - Create FastAPI app with REST routes (`/api/start`, `/api/stop`, `/api/status`, `/api/config`).
  - Set up WebSocket endpoint (`/ws/telemetry`) broadcasting state machine status, current velocity, errors ($e_d, e_y, e_\theta$), and safety flags at $20\text{ Hz}$.
- [ ] Fine-tune control gains ($K_p$) using simulated or physical test runs to eliminate terminal hunting/oscillation.

### Phase 6: Packaging & Integration (Hours 22 – 24)
- [ ] Create entry point runner `scripts/run_hybrid_docking.py` executing the full closed loop:
  `Camera` $\rightarrow$ `Perception` $\rightarrow$ `FSM` $\rightarrow$ `Controller` $\rightarrow$ `Safety` $\rightarrow$ `RobotAdapter` $\rightarrow$ `WebSocket Broadcast`.
- [ ] Commit and push changes:
  ```bash
  git add .
  git commit -m "Complete controls & backend: FSM, visual servoing, safety gate, FastAPI server"
  git push origin feature/controls-backend
  ```

---

## 4. Acceptance Criteria & Definition of Done
1. **Safety Priority**: Safety supervisor overrides all movement with zero latency when obstacle/stale frame is reported.
2. **Alignment Precision**: Visual servoing converges to $|e_y| \le 3\text{ cm}$ and $|e_\theta| \le 5^\circ$ from a starting offset of $\pm 20\text{ cm}$ and $\pm 25^\circ$.
3. **No False Docks**: System never declares `DOCKED` without satisfying all dwell time criteria.
4. **Backend Stability**: FastAPI WebSocket server streams telemetry smoothly at $\ge 20\text{ Hz}$ without dropped connections.
