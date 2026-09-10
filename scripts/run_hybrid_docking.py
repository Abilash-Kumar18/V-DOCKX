"""
V-DOCKX Single-Command Closed-Loop Hybrid Docking Runner
Executes the full pipeline:
Camera/Perception -> FSM -> Controller -> Safety Supervisor -> Robot Kinematics -> Telemetry Logging
"""

import argparse
import math
import os
import sys
import time

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from docking.contracts import (
    DockingState,
    PerceptionOutput,
    LineDetectionOutput,
    ObstacleOutput,
)
from docking.hybrid_state_machine import HybridDockingStateMachine
from docking.line_controller import LineController
from docking.controller import VisualServoController
from docking.safety import SafetySupervisor
from docking.robot_adapter import SimulatedRobotAdapter
from docking.telemetry import TelemetryLogger


def run_hybrid_docking(
    initial_x: float = 0.0,
    initial_y: float = 0.05,
    initial_theta: float = -0.05,
    station_x: float = 1.50,
    target_docking_distance: float = 0.12,
    obstacle_step: int = -1,
    obstacle_duration: int = 20,
    record: bool = True,
    max_time_s: float = 30.0,
    verbose: bool = True,
):
    if verbose:
        print("=" * 72)
        print("            V-DOCKX CLOSED-LOOP AUTONOMOUS DOCKING RUNNER")
        print("=" * 72)
        print(f"Config: Init Pose=(x={initial_x:.2f}m, y={initial_y:.3f}m, theta={math.degrees(initial_theta):.1f} deg)")
        print(f"Station: x={station_x:.2f}m | Docking Distance: {target_docking_distance*100:.1f} cm | Record: {record}")
        if obstacle_step > 0:
            print(f"Obstacle: Injected at step {obstacle_step} for {obstacle_duration} steps")
        print("-" * 72)

    # 1. Instantiate Controllers & Safety
    line_ctrl = LineController(kp_centroid=0.80, kp_angle=0.60, max_linear_velocity=0.20, max_angular_velocity=0.60)
    servo_ctrl = VisualServoController(
        kp_distance=0.45,
        kp_lateral=1.20,
        kp_heading=1.00,
        max_linear_velocity=0.20,
        final_linear_velocity=0.05,
        min_linear_velocity=0.02,
        max_angular_velocity=0.60,
        target_docking_distance=target_docking_distance,
        lateral_deadband_m=0.005,
        heading_deadband_rad=0.02,
    )
    safety_sup = SafetySupervisor(stale_frame_timeout_s=0.40, clearance_dwell_s=1.00)

    # 2. Instantiate FSM
    fsm = HybridDockingStateMachine(
        line_controller=line_ctrl,
        docking_controller=servo_ctrl,
        safety_supervisor=safety_sup,
        lateral_tolerance_m=0.03,
        heading_tolerance_rad=0.08,
        docking_distance_m=target_docking_distance,
        verification_dwell_s=0.80,
    )

    # 3. Instantiate Robot Kinematics
    robot = SimulatedRobotAdapter(x=initial_x, y=initial_y, theta=initial_theta)

    # 4. Telemetry Logger
    logger = None
    if record:
        run_id = f"hybrid_{int(time.time())}"
        logger = TelemetryLogger(run_id=run_id, output_dir="results")

    # Start mission
    fsm.start_mission()

    t = 0.0
    dt = 0.05  # 20 Hz
    step = 0

    if verbose:
        print(f"{'Time':<7} | {'State':<23} | {'v (m/s)':<7} | {'w (r/s)':<7} | {'Pose (x, y, th)':<21} | {'Dwell'}")
        print("-" * 72)

    while t < max_time_s and fsm.state not in (DockingState.DOCKED, DockingState.FAILED):
        now = t

        # A. Synthetic Floor Line Perception
        # Guide line lies along y=0
        line_out = LineDetectionOutput(
            timestamp=now,
            detected=True,
            centroid_error_norm=max(-1.0, min(1.0, robot.y / 0.15)),
            angle_error_rad=max(-1.0, min(1.0, robot.theta)),
            confidence=0.92,
        )

        # B. Synthetic Target Perception (Station at x=station_x, y=0.0)
        dx = station_x - robot.x
        dist = math.hypot(dx, robot.y)
        target_detected = (robot.x >= 0.50)

        target_out = PerceptionOutput(
            timestamp=now,
            detected=target_detected,
            distance_m=round(dist, 4),
            lateral_offset_m=round(robot.y, 4),
            heading_error_rad=round(robot.theta, 4),
            confidence=0.95 if target_detected else 0.0,
        )

        # C. Obstacle Injection
        obstacle_active = (0 <= obstacle_step <= step < obstacle_step + obstacle_duration)
        obs_out = ObstacleOutput(
            timestamp=now,
            corridor_blocked=obstacle_active,
            obstacle_present=obstacle_active,
            minimum_distance_m=0.35 if obstacle_active else 2.0,
        )

        # D. FSM Update
        state, cmd = fsm.update(
            line=line_out,
            target=target_out,
            obstacle=obs_out,
            station_zone_detected=(robot.x >= 0.70),
            last_frame_timestamp=now,
            current_time=now,
        )

        # E. Step Kinematics
        if state not in (DockingState.IDLE, DockingState.FAILED, DockingState.DOCKED):
            robot.step(dt, cmd.linear_velocity_mps, cmd.angular_velocity_rps)

        # F. Log Telemetry
        if logger:
            dwell_pct = 0.0
            if fsm.dwell_start_time is not None:
                dwell_pct = min(100.0, ((now - fsm.dwell_start_time) / fsm.verification_dwell_s) * 100.0)

            logger.log(
                state=state.value,
                linear_velocity=cmd.linear_velocity_mps,
                angular_velocity=cmd.angular_velocity_rps,
                distance_m=dist,
                lateral_offset_m=robot.y,
                heading_error_rad=robot.theta,
                corridor_blocked=obstacle_active,
                reason=cmd.reason,
                timestamp=now,
                extra={"robot_pose": robot.get_telemetry_dict(), "dwell_progress_pct": dwell_pct},
            )

        # G. Console Output
        if verbose:
            if step % 10 == 0 or state != fsm.previous_state:
                th_deg = math.degrees(robot.theta)
                dwell_str = f"{fsm.verification_dwell_s - (now - fsm.dwell_start_time):.1f}s" if fsm.dwell_start_time else "---"
                print(
                    f"{t:5.2f}s  | {state.value:<23} | {cmd.linear_velocity_mps:6.2f}  | {cmd.angular_velocity_rps:6.2f}  | "
                    f"({robot.x:4.2f}, {robot.y:5.2f}, {th_deg:4.1f}d) | {dwell_str}"
                )

        t += dt
        step += 1

    result = fsm.get_result()
    if logger:
        logger.close()

    final_lat_cm = abs(result.final_lateral_error_m) * 100.0
    final_head_deg = abs(math.degrees(result.final_heading_error_rad))
    final_dist_cm = result.final_distance_m * 100.0
    success = (result.status in ("SUCCESS", "VISUALLY_ALIGNED") and final_lat_cm <= 3.0 and final_head_deg <= 5.0)

    if verbose:
        print("-" * 72)
        print("                  FINAL DOCKING EVALUATION REPORT")
        print("-" * 72)
        print(f"  Outcome:                {'PASS [SUCCESS]' if success else 'FAIL [' + result.status + ']'}")
        print(f"  Total Duration:         {result.duration_s:.2f} s")
        print(f"  Final Distance:         {final_dist_cm:.2f} cm (Target: {target_docking_distance*100:.1f} cm)")
        print(f"  Final Lateral Error:    {final_lat_cm:.2f} cm (Gate: <= 3.0 cm)")
        print(f"  Final Heading Error:    {final_head_deg:.2f} deg (Gate: <= 5.0 deg)")
        print(f"  Obstacle Interventions: {result.obstacle_stops}")
        if logger:
            print(f"  Telemetry Run File:     {logger.jsonl_path}")
        print("=" * 72)

    return {
        "success": success,
        "status": result.status,
        "duration_s": result.duration_s,
        "final_distance_cm": final_dist_cm,
        "final_lateral_error_cm": final_lat_cm,
        "final_heading_error_deg": final_head_deg,
        "obstacle_stops": result.obstacle_stops,
        "log_path": logger.jsonl_path if logger else None,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="V-DOCKX Autonomous Closed-Loop Docking Runner")
    parser.add_argument("--initial-y", type=float, default=0.05, help="Initial lateral offset in meters (default: 0.05m)")
    parser.add_argument("--initial-theta", type=float, default=-0.05, help="Initial heading in radians (default: -0.05 rad)")
    parser.add_argument("--obstacle-step", type=int, default=-1, help="Simulation step to inject obstacle (default: -1 for none)")
    parser.add_argument("--obstacle-duration", type=int, default=20, help="Number of steps obstacle stays active (default: 20)")
    parser.add_argument("--no-record", action="store_true", help="Disable telemetry logging to results/")
    args = parser.parse_args()

    run_hybrid_docking(
        initial_y=args.initial_y,
        initial_theta=args.initial_theta,
        obstacle_step=args.obstacle_step,
        obstacle_duration=args.obstacle_duration,
        record=not args.no_record,
    )
