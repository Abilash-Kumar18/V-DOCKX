# V-DOCKX: Git Branching & Conflict Prevention Rules
## Multi-Member / Multi-Agent Collaboration Protocol

**Target Audience:** Human Developers and AI Coding Agents operating across team branches.  
**Objective:** Guarantee **zero merge conflicts** during concurrent 24-hour hackathon execution by establishing strict file ownership, interface freezes, and rebase sync protocols.

---

## 1. Branch Structure & Roles

| Role | Branch Name | Owner Domain |
|---|---|---|
| **Member 1** | `feature/vision-perception` | Computer Vision, OpenCV, Markers, AI Object Detection, Corridor Safety |
| **Member 2** | `feature/controls-backend` | FSM State Machine, Controllers, Safety Gate, FastAPI / WebSockets |
| **Member 3** | `feature/dashboard-telemetry` | Web UI / Canvas HUD, Telemetry Logger, Replay & Evaluation Scripts |
| **Integration** | `dev` | Shared staging branch (PR target) |
| **Production** | `main` | Stable final demo release |

---

## 2. File Ownership Matrix (Strict Boundaries)

> [!CAUTION]
> **RULE OF ISOLATION FOR AGENTS & DEVELOPERS:**  
> An agent or developer operating on a specific branch must **ONLY modify files within their assigned domain**. Never edit, format, or stage files owned by another role in your branch.

```
V-DOCKX/
├── [Member 1 EXCLUSIVE DOMAIN] (Branch: feature/vision-perception)
│   ├── docking/camera.py
│   ├── docking/line_detector.py
│   ├── docking/station_zone_detector.py
│   ├── docking/station_pose_detector.py
│   ├── docking/pose_filter.py
│   ├── docking/free_space_detector.py
│   ├── docking/obstacle_ai.py
│   ├── docking/obstacle_fusion.py
│   ├── config/line.yaml
│   ├── config/obstacle.yaml
│   ├── models/
│   └── tests/test_line_detector.py, tests/test_obstacle_fusion.py
│
├── [Member 2 EXCLUSIVE DOMAIN] (Branch: feature/controls-backend)
│   ├── docking/hybrid_state_machine.py
│   ├── docking/line_controller.py
│   ├── docking/controller.py
│   ├── docking/safety.py
│   ├── docking/robot_adapter.py
│   ├── config/docking.yaml
│   ├── backend/
│   └── tests/test_hybrid_state_machine.py, tests/test_safety.py
│
└── [Member 3 EXCLUSIVE DOMAIN] (Branch: feature/dashboard-telemetry)
    ├── frontend/
    ├── docking/telemetry.py
    ├── scripts/replay_hybrid_run.py
    ├── scripts/evaluate_hybrid_runs.py
    ├── data/replay/
    ├── results/
    └── tests/test_replay.py
```

---

## 3. Shared Data Contracts Protocol (`docking/contracts.py`)

All cross-module communication is decoupled through standardized data transfer objects (DTOs):

1. **`PerceptionOutput`**: Pose ($e_d, e_y, e_\theta$), station ID, confidence, reprojection error.
2. **`LineDetectionOutput`**: Normalized centroid error ($e_c$), orientation error ($e_a$), line mask.
3. **`ObstacleOutput`**: Corridor blockage flag, distance to nearest obstacle, detected classes.
4. **`ControlCommand`**: Linear velocity ($v$), angular velocity ($\omega$), command reason.
5. **`DockingResult`**: Verification state, duration, retry count, final error margins.

### Contract Freeze Directive:
- Data contract dataclasses must be defined in `docking/contracts.py`.
- **Once committed in Phase 0, `contracts.py` is FROZEN.**
- No agent may alter existing field names or types without cross-team consensus.

---

## 4. Configuration & Dependency Isolation

### Config Isolation
Never merge all settings into one large `config.yaml`. Configuration is strictly decoupled:
* `config/line.yaml` & `config/obstacle.yaml` $\rightarrow$ Managed exclusively on `feature/vision-perception`.
* `config/docking.yaml` $\rightarrow$ Managed exclusively on `feature/controls-backend`.

### Dependency Locking (`requirements.txt`)
* All base dependencies (`opencv-python`, `numpy`, `fastapi`, `uvicorn`, `websockets`, `pyyaml`) are installed upfront in Phase 0.
* **Member 2 is the sole manager of `requirements.txt`**. If Member 1 or Member 3 requires a new library, Member 2 appends it and merges it to `dev`.

---

## 5. Mocking & Decoupled Execution (Zero Blocking)

No agent or developer should wait for another branch to be completed:
* **Controls Agent (Member 2)**: Tests the state machine and visual servoing using synthetic perception generators ($e_y = +0.05\text{ m}, e_\theta = -0.04\text{ rad}$) without needing live camera hardware.
* **Dashboard Agent (Member 3)**: Tests the Web HUD using mock WebSocket JSON telemetry streams or recorded video files in `data/replay/`.
* **Perception Agent (Member 1)**: Tests line detection and ArUco pose estimation against standalone image files or OpenCV `imshow` test scripts.

---

## 6. Git Synchronization & Merge Protocol

### Routine Local Development
Always verify your active branch before staging code:
```bash
# Verify active branch
git branch --show-current

# Stage only files in your assigned domain
git add docking/<your_assigned_module>.py
git commit -m "feat(scope): descriptive message of changes"
```

### Pulling Updates from `dev` (Never Use `git merge dev`)
To prevent recursive merge bubbles and conflicts, **always rebase**:
```bash
git fetch origin
git rebase origin/dev
git push origin <your-branch-name>
```

### Sequential Phase-End Merging into `dev`
At the conclusion of each phase (e.g., Phase 1, Phase 2, Phase 3):
1. **Member 1 (Perception) merges first** into `dev`.
2. **Member 2 (Controls) rebases onto `dev`**, runs unit tests, and merges second.
3. **Member 3 (Dashboard) rebases onto `dev`**, runs integration tests, and merges third.

---

## 7. AI Agent Operational Directives

When an AI coding agent is prompted to work on a task:
1. **Read this file first** to identify the assigned branch and file boundaries.
2. **Do NOT format or touch files outside the assigned role domain**, even for "cleanup" or "linting".
3. **Keep function signatures identical** to the interface contracts in `docking/contracts.py`.
4. **Preserve existing tests and mock harnesses** when editing modules.
