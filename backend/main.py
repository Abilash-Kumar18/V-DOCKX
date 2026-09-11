"""
V-DOCKX FastAPI Backend & Telemetry Server
REST endpoints for mission control and high-frequency WebSocket telemetry streaming.
"""

import asyncio
import base64
import glob
import json
import math
import os
import time
from typing import Dict, Any, List, Optional
import cv2
import numpy as np
import yaml
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from docking.contracts import (
    DockingState,
    PerceptionOutput,
    LineDetectionOutput,
    ObstacleOutput,
    ControlCommand,
)
from docking.line_controller import LineController
from docking.controller import VisualServoController
from docking.safety import SafetySupervisor
from docking.hybrid_state_machine import HybridDockingStateMachine
from docking.robot_adapter import SimulatedRobotAdapter
from docking.station_pose_detector import StationPoseDetector
from docking.pose_filter import PoseFilter
from docking.line_detector import LineDetector
from docking.obstacle_fusion import ObstacleFusionSupervisor

app = FastAPI(
    title="V-DOCKX Telemetry & Mission Control API",
    version="1.0.0",
    description="Backend API and WebSocket streaming for Autonomous Robot Docking and Charging.",
)

# Enable CORS for frontend clients (React/Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Configuration Loader
# -------------------------------------------------------------
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config", "docking.yaml")


def load_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r") as f:
            return yaml.safe_load(f) or {}
    return {}


cfg = load_config()
ctrl_cfg = cfg.get("control", {})
thresh_cfg = cfg.get("thresholds", {})

# -------------------------------------------------------------
# Subsystem Instances
# -------------------------------------------------------------
line_ctrl = LineController(
    kp_centroid=ctrl_cfg.get("kp_line_centroid", 0.80),
    kp_angle=ctrl_cfg.get("kp_line_angle", 0.60),
    max_linear_velocity=ctrl_cfg.get("max_linear_velocity_mps", 0.20),
    max_angular_velocity=ctrl_cfg.get("max_angular_velocity_rps", 0.60),
)

servo_ctrl = VisualServoController(
    kp_distance=ctrl_cfg.get("kp_distance", 0.45),
    kp_lateral=ctrl_cfg.get("kp_lateral", 1.20),
    kp_heading=ctrl_cfg.get("kp_heading", 1.00),
    max_linear_velocity=ctrl_cfg.get("max_linear_velocity_mps", 0.20),
    final_linear_velocity=ctrl_cfg.get("final_linear_velocity_mps", 0.05),
    min_linear_velocity=ctrl_cfg.get("min_linear_velocity_mps", 0.02),
    max_angular_velocity=ctrl_cfg.get("max_angular_velocity_rps", 0.60),
    target_docking_distance=thresh_cfg.get("docking_distance_m", 0.12),
    lateral_deadband_m=ctrl_cfg.get("lateral_deadband_m", 0.005),
    heading_deadband_rad=ctrl_cfg.get("heading_deadband_rad", 0.02),
)

safety = SafetySupervisor(
    stale_frame_timeout_s=thresh_cfg.get("target_loss_timeout_s", 0.40),
    clearance_dwell_s=thresh_cfg.get("clearance_dwell_s", 1.00),
    max_linear_velocity=ctrl_cfg.get("max_linear_velocity_mps", 0.20),
    max_angular_velocity=ctrl_cfg.get("max_angular_velocity_rps", 0.60),
)

fsm = HybridDockingStateMachine(
    line_controller=line_ctrl,
    docking_controller=servo_ctrl,
    safety_supervisor=safety,
    lateral_tolerance_m=thresh_cfg.get("lateral_tolerance_m", 0.03),
    heading_tolerance_rad=thresh_cfg.get("heading_tolerance_rad", 0.08),
    docking_distance_m=thresh_cfg.get("docking_distance_m", 0.12),
    verification_dwell_s=thresh_cfg.get("verification_dwell_s", 0.80),
    max_retries=thresh_cfg.get("max_retries", 3),
)

robot = SimulatedRobotAdapter(x=0.0, y=0.15, theta=-0.10)

# Real Vision Perception Pipeline (OpenCV & AI)
pose_detector = StationPoseDetector()
pose_filter = PoseFilter()
line_detector = LineDetector()
obstacle_fusion = ObstacleFusionSupervisor()

destination_point = {"x": 1.0, "y": 0.35}
last_real_frame_time = 0.0
last_motion_state: Dict[str, Any] = {"isMoving": False, "speedMps": 0.0, "accel": 0.0}

# Simulated synthetic inputs (fallback when camera offline)
synthetic_line = LineDetectionOutput(detected=True, centroid_error_norm=0.10, angle_error_rad=0.05, confidence=0.85)
synthetic_target = PerceptionOutput(detected=False, distance_m=1.8, lateral_offset_m=0.15, heading_error_rad=-0.10, confidence=0.75)
synthetic_obstacle = ObstacleOutput(obstacle_present=False, corridor_blocked=False)

# -------------------------------------------------------------
# WebSocket Connection Manager
# -------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        msg_str = json.dumps(message)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(msg_str)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()

# -------------------------------------------------------------
# REST Endpoints
# -------------------------------------------------------------
@app.get("/")
def root():
    return {"name": "V-DOCKX API", "status": "online", "state": fsm.state.value}


@app.get("/api/status")
def get_status():
    res = fsm.get_result()
    pose = robot.get_telemetry_dict()
    return {
        "state": fsm.state.value,
        "estop_active": safety.estop_active,
        "linear_velocity": fsm.last_command.linear_velocity_mps,
        "angular_velocity": fsm.last_command.angular_velocity_rps,
        "command_reason": fsm.last_command.reason,
        "robot_pose": pose,
        "result": {
            "status": res.status,
            "duration_s": res.duration_s,
            "attempts": res.attempts,
            "final_distance_m": res.final_distance_m,
            "final_lateral_error_m": res.final_lateral_error_m,
            "final_heading_error_rad": res.final_heading_error_rad,
            "obstacle_stops": res.obstacle_stops,
        },
    }


@app.post("/api/start")
def start_mission():
    safety.release_estop()
    fsm.start_mission()
    return {"message": "Docking mission initiated", "state": fsm.state.value}


@app.post("/api/stop")
def emergency_stop():
    safety.trigger_estop()
    fsm.abort_mission("OPERATOR_EMERGENCY_STOP")
    robot.stop()
    return {"message": "Emergency stop triggered", "estop": True, "state": fsm.state.value}


@app.post("/api/reset")
def reset_system():
    safety.release_estop()
    fsm.reset()
    robot.reset(x=0.0, y=0.15, theta=-0.10)
    return {"message": "System reset to initial state", "state": fsm.state.value}


@app.get("/api/config")
def get_config():
    return load_config()


@app.get("/api/analytics")
def get_analytics():
    """Returns aggregated evaluation metrics across all runs in results/."""
    try:
        from scripts.evaluate_hybrid_runs import evaluate_logs
        summary = evaluate_logs("results")
        return summary
    except Exception as e:
        return {"error": str(e), "total_runs": 0}


@app.get("/api/runs")
def get_runs():
    """Returns the most recent docking runs from results/."""
    runs = []
    log_files = glob.glob(os.path.join("results", "*.jsonl"))
    for file_path in sorted(log_files, key=os.path.getmtime, reverse=True)[:15]:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
                if not lines:
                    continue
                first = json.loads(lines[0])
                last = json.loads(lines[-1])
                duration = round(max(0.0, last.get("timestamp", 0) - first.get("timestamp", 0)), 2)
                lat_err_cm = round(abs(last.get("lateral_offset_m", 0.0)) * 100, 2)
                head_err_deg = round(abs(math.degrees(last.get("heading_error_rad", 0.0))), 2)
                state = last.get("state", "UNKNOWN")
                success = (state in ("DOCKED", "VISUALLY_ALIGNED") or (lat_err_cm <= 3.0 and head_err_deg <= 5.0))
                runs.append({
                    "run_id": os.path.basename(file_path).replace(".jsonl", ""),
                    "timestamp": last.get("timestamp", 0),
                    "duration_s": duration,
                    "final_state": state,
                    "success": success,
                    "lateral_error_cm": lat_err_cm,
                    "heading_error_deg": head_err_deg,
                    "distance_cm": round(last.get("distance_m", 0.12) * 100, 1),
                    "file_name": os.path.basename(file_path),
                })
        except Exception:
            continue
    return runs


class ObstacleInjectRequest(BaseModel):
    corridor_blocked: bool
    distance_m: float = 0.30


@app.post("/api/obstacle/inject")
def inject_obstacle(req: ObstacleInjectRequest):
    global synthetic_obstacle
    synthetic_obstacle = ObstacleOutput(
        timestamp=time.time(),
        obstacle_present=req.corridor_blocked,
        corridor_blocked=req.corridor_blocked,
        minimum_distance_m=req.distance_m,
        detected_classes=["test_box"] if req.corridor_blocked else [],
        confidence=0.95 if req.corridor_blocked else 0.0,
    )
    return {"corridor_blocked": req.corridor_blocked}


# -------------------------------------------------------------
# Real Vision & Mobile Motion Endpoints
# -------------------------------------------------------------
class VisionProcessRequest(BaseModel):
    frame_b64: str
    robot_pose: Optional[Dict[str, float]] = None
    motion: Optional[Dict[str, Any]] = None


class DestinationRequest(BaseModel):
    x: float
    y: float


class MobileMotionRequest(BaseModel):
    pose: Dict[str, float]
    motion: Optional[Dict[str, Any]] = None


@app.get("/api/destination")
def get_destination():
    return destination_point


@app.post("/api/destination")
def set_destination(req: DestinationRequest):
    global destination_point
    destination_point = {"x": req.x, "y": req.y}
    return {"message": "Destination updated", "destination": destination_point}


@app.get("/api/robot/pose")
def get_robot_pose():
    dist_to_dest = math.hypot(destination_point["x"] - robot.x, destination_point["y"] - robot.y)
    return {
        "pose": robot.get_telemetry_dict(),
        "motion": last_motion_state,
        "is_docked": fsm.state == DockingState.DOCKED or dist_to_dest <= 0.25,
        "distance_m": round(dist_to_dest, 3),
        "destination": destination_point,
    }


@app.post("/api/robot/motion")
async def update_mobile_motion(req: MobileMotionRequest):
    global last_motion_state, last_real_frame_time
    now = time.time()
    last_real_frame_time = now
    if req.motion:
        last_motion_state = req.motion
    if "x" in req.pose and "y" in req.pose:
        robot.x = req.pose["x"]
        robot.y = req.pose["y"]
    if "heading" in req.pose:
        robot.theta = math.radians(req.pose["heading"])

    dist_to_dest = math.hypot(destination_point["x"] - robot.x, destination_point["y"] - robot.y)
    is_docked = dist_to_dest <= 0.25
    if is_docked:
        fsm.state = DockingState.DOCKED

    telemetry_pkt = {
        "timestamp": now,
        "state": fsm.state.value,
        "fsm_state": fsm.state.value,
        "linear_velocity_mps": 0.20 if (req.motion and req.motion.get("isMoving")) else 0.0,
        "v": 0.20 if (req.motion and req.motion.get("isMoving")) else 0.0,
        "angular_velocity_rps": 0.0,
        "w": 0.0,
        "command_reason": "Mobile Sensor Teleoperation",
        "robot_pose": robot.get_telemetry_dict(),
        "target": {
            "detected": True,
            "distance_m": round(dist_to_dest, 3),
            "lateral_offset_m": round(robot.x - destination_point["x"], 3),
            "heading_error_rad": round(robot.theta, 3),
        },
        "ed": round(dist_to_dest, 3),
        "ey": round(robot.x - destination_point["x"], 3),
        "etheta": round(robot.theta, 3),
        "obstacle": {
            "corridor_blocked": False,
            "stop_count": safety.obstacle_stop_count,
        },
        "corridor_blocked": False,
        "dwell_progress_pct": 100.0 if is_docked else 0.0,
        "dwell_countdown": 0.0,
        "estop_active": safety.estop_active,
        "safety_halt": False,
        "is_real_camera": True,
        "is_docked": is_docked,
        "charging_active": is_docked,
        "destination": destination_point,
    }
    await manager.broadcast(telemetry_pkt)

    return {
        "status": "ok",
        "pose": robot.get_telemetry_dict(),
        "motion": last_motion_state,
        "is_docked": is_docked or fsm.state == DockingState.DOCKED,
        "charging_active": is_docked or fsm.state == DockingState.DOCKED,
        "distance_m": round(dist_to_dest, 3),
    }


@app.post("/api/vision/process")
async def process_real_frame(req: VisionProcessRequest):
    """
    Ingest live frame from mobile phone or USB webcam.
    Runs ArUco pose estimation, floor line tracking, and obstacle detection.
    Feeds real measurements into the hybrid state machine and safety gate.
    """
    global last_real_frame_time, synthetic_target, synthetic_line, synthetic_obstacle, last_motion_state
    now = time.time()
    last_real_frame_time = now

    # Update robot pose if provided by mobile motion sensor
    if req.robot_pose:
        if "x" in req.robot_pose and "y" in req.robot_pose:
            robot.x = req.robot_pose["x"]
            robot.y = req.robot_pose["y"]
        if "heading" in req.robot_pose:
            robot.theta = math.radians(req.robot_pose["heading"])

    if req.motion:
        last_motion_state = req.motion

    # 1. Decode base64 image
    try:
        parts = req.frame_b64.split(",")
        raw_b64 = parts[1] if len(parts) > 1 else parts[0]
        img_bytes = base64.b64decode(raw_b64)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Empty decoded image")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image decoding failed: {e}")

    # 2. ArUco 6-DoF Target Pose Estimation
    raw_pose = pose_detector.detect(frame)
    filtered_pose = pose_filter.update(raw_pose)
    synthetic_target = filtered_pose

    # 3. Floor Line Tracking
    line_out = line_detector.detect(frame)
    synthetic_line = line_out

    # 4. Obstacle Detection (AI + Geometric Corridor)
    obs_out, _ = obstacle_fusion.evaluate(frame)
    synthetic_obstacle = obs_out

    # 5. Station Zone Cue: Target marker visible or station proximity
    dist_to_dest = math.hypot(destination_point["x"] - robot.x, destination_point["y"] - robot.y)
    zone_cue = filtered_pose.detected or (dist_to_dest <= 0.85)

    # 6. Step Hybrid State Machine with Real Sensor Ingestion
    state, cmd = fsm.update(
        line=line_out,
        target=filtered_pose,
        obstacle=obs_out,
        station_zone_detected=zone_cue,
        last_frame_timestamp=now,
        current_time=now,
    )

    # 7. Advance kinematics if not docked/stopped
    if state not in (DockingState.IDLE, DockingState.FAILED, DockingState.DOCKED, DockingState.OBSTACLE_STOP):
        robot.send_command(cmd)

    dwell_pct = 0.0
    dwell_countdown = 0.0
    if fsm.dwell_start_time is not None:
        elapsed = now - fsm.dwell_start_time
        dwell_pct = min(100.0, round((elapsed / fsm.verification_dwell_s) * 100.0, 1))
        dwell_countdown = round(max(0.0, fsm.verification_dwell_s - elapsed), 2)

    # 8. Broadcast over WebSocket for zero-lag dashboard sync
    telemetry_pkt = {
        "timestamp": now,
        "state": state.value,
        "fsm_state": state.value,
        "linear_velocity_mps": cmd.linear_velocity_mps,
        "v": cmd.linear_velocity_mps,
        "angular_velocity_rps": cmd.angular_velocity_rps,
        "w": cmd.angular_velocity_rps,
        "command_reason": cmd.reason,
        "robot_pose": robot.get_telemetry_dict(),
        "target": {
            "detected": filtered_pose.detected,
            "distance_m": filtered_pose.distance_m,
            "lateral_offset_m": filtered_pose.lateral_offset_m,
            "heading_error_rad": filtered_pose.heading_error_rad,
        },
        "ed": filtered_pose.distance_m,
        "ey": filtered_pose.lateral_offset_m,
        "etheta": filtered_pose.heading_error_rad,
        "obstacle": {
            "corridor_blocked": obs_out.corridor_blocked,
            "stop_count": safety.obstacle_stop_count,
        },
        "corridor_blocked": obs_out.corridor_blocked,
        "dwell_progress_pct": dwell_pct,
        "dwell_countdown": dwell_countdown,
        "estop_active": safety.estop_active,
        "safety_halt": safety.estop_active or obs_out.corridor_blocked,
        "is_real_camera": True,
        "is_docked": state == DockingState.DOCKED,
        "charging_active": state == DockingState.DOCKED,
        "destination": destination_point,
    }
    await manager.broadcast(telemetry_pkt)

    return {
        "success": True,
        "state": state.value,
        "target_detected": filtered_pose.detected,
        "distance_m": filtered_pose.distance_m if filtered_pose.detected else round(dist_to_dest, 3),
        "lateral_offset_m": filtered_pose.lateral_offset_m if filtered_pose.detected else round(robot.y - destination_point["y"], 3),
        "heading_error_deg": round(math.degrees(filtered_pose.heading_error_rad), 2) if filtered_pose.detected else round(math.degrees(robot.theta), 2),
        "obstacle_present": obs_out.obstacle_present,
        "corridor_blocked": obs_out.corridor_blocked,
        "linear_v": cmd.linear_velocity_mps,
        "angular_w": cmd.angular_velocity_rps,
        "dwell_pct": dwell_pct,
        "dwell_countdown": dwell_countdown,
        "is_docked": state == DockingState.DOCKED,
        "charging_active": state == DockingState.DOCKED,
    }


# -------------------------------------------------------------
# Background Simulation & Telemetry Loop (20 Hz)
# -------------------------------------------------------------
async def simulation_loop():
    """Runs a 20Hz loop updating kinematics, FSM, and broadcasting telemetry."""
    while True:
        now = time.time()

        # If live camera is actively streaming from phone/webcam, pause synthetic override!
        if time.time() - last_real_frame_time < 2.5:
            await asyncio.sleep(0.05)
            continue

        # Dynamically update synthetic line tracking based on robot pose relative to guide line (y=0)
        synthetic_line.centroid_error_norm = max(-1.0, min(1.0, round(robot.y / 0.15, 3)))
        synthetic_line.angle_error_rad = max(-1.0, min(1.0, round(robot.theta, 3)))
        synthetic_line.timestamp = now

        # Update synthetic target perception based on simulated robot pose
        dx = 1.5 - robot.x
        dy = -robot.y
        dist = math.sqrt(dx * dx + dy * dy)
        heading_err = -robot.theta

        if fsm.state in (
            DockingState.STATION_ZONE_APPROACH,
            DockingState.DOCKING_TARGET_ACQUIRE,
            DockingState.FINE_ALIGN,
            DockingState.FINAL_APPROACH,
            DockingState.VERIFY,
            DockingState.DOCKED,
        ):
            synthetic_target.detected = True
            synthetic_target.distance_m = round(dist, 4)
            synthetic_target.lateral_offset_m = round(robot.y, 4)
            synthetic_target.heading_error_rad = round(robot.theta, 4)
            synthetic_target.confidence = 0.90
            synthetic_target.timestamp = now
        else:
            synthetic_target.detected = False
            synthetic_target.distance_m = round(dist, 4)
            synthetic_target.lateral_offset_m = round(robot.y, 4)
            synthetic_target.heading_error_rad = round(robot.theta, 4)
            synthetic_target.timestamp = now

        # Execute FSM cycle
        state, cmd = fsm.update(
            line=synthetic_line,
            target=synthetic_target,
            obstacle=synthetic_obstacle,
            station_zone_detected=(robot.x >= 0.6),
            last_frame_timestamp=now,
            current_time=now,
        )

        # Advance robot kinematics
        if state not in (DockingState.IDLE, DockingState.FAILED, DockingState.DOCKED):
            robot.send_command(cmd)

        # Calculate verification dwell progress percentage
        dwell_pct = 0.0
        dwell_countdown = 0.0
        if fsm.dwell_start_time is not None:
            elapsed = now - fsm.dwell_start_time
            dwell_pct = min(100.0, round((elapsed / fsm.verification_dwell_s) * 100.0, 1))
            dwell_countdown = round(max(0.0, fsm.verification_dwell_s - elapsed), 2)

        # Broadcast rich telemetry packet (supports nested and direct schemas)
        telemetry_pkt = {
            "timestamp": now,
            "state": state.value,
            "fsm_state": state.value,
            "linear_velocity_mps": cmd.linear_velocity_mps,
            "v": cmd.linear_velocity_mps,
            "angular_velocity_rps": cmd.angular_velocity_rps,
            "w": cmd.angular_velocity_rps,
            "command_reason": cmd.reason,
            "robot_pose": robot.get_telemetry_dict(),
            "target": {
                "detected": synthetic_target.detected,
                "distance_m": synthetic_target.distance_m,
                "lateral_offset_m": synthetic_target.lateral_offset_m,
                "heading_error_rad": synthetic_target.heading_error_rad,
            },
            "ed": synthetic_target.distance_m,
            "ey": synthetic_target.lateral_offset_m,
            "etheta": synthetic_target.heading_error_rad,
            "obstacle": {
                "corridor_blocked": synthetic_obstacle.corridor_blocked,
                "stop_count": safety.obstacle_stop_count,
            },
            "corridor_blocked": synthetic_obstacle.corridor_blocked,
            "dwell_progress_pct": dwell_pct,
            "dwell_countdown": dwell_countdown,
            "estop_active": safety.estop_active,
            "safety_halt": safety.estop_active or synthetic_obstacle.corridor_blocked,
        }

        await manager.broadcast(telemetry_pkt)
        await asyncio.sleep(0.05)  # 20 Hz


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulation_loop())


# -------------------------------------------------------------
# WebSocket Telemetry Stream Endpoint
# -------------------------------------------------------------
@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep-alive receive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
