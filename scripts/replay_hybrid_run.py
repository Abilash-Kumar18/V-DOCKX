"""
V-DOCKX Offline Replay Test Harness
Executes closed-loop docking against recorded videos or synthetic run logs without hardware.
"""

import math
import os
import sys
import time
from typing import Optional

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from docking.contracts import (
    DockingState,
    PerceptionOutput,
    LineDetectionOutput,
    ObstacleOutput,
)
from docking.hybrid_state_machine import HybridDockingStateMachine
from docking.robot_adapter import SimulatedRobotAdapter
from docking.telemetry import TelemetryLogger


def replay_run(
    initial_y: float = 0.04,
    initial_theta: float = 0.02,
    obstacle_at_sec: Optional[float] = None,
    obstacle_duration_sec: float = 1.5,
    run_id: Optional[str] = None,
):
    print("=" * 65)
    print("         V-DOCKX OFFLINE REPLAY & TELEMETRY RECORDER")
    print("=" * 65)

    logger = TelemetryLogger(run_id=run_id or f"replay_{int(time.time())}")
    print(f"Recording telemetry to: {logger.jsonl_path}")

    fsm = HybridDockingStateMachine()
    robot = SimulatedRobotAdapter(x=0.0, y=initial_y, theta=initial_theta)
    fsm.start_mission()

    t = 0.0
    dt = 0.05
    station_x = 1.50

    while t < 25.0 and fsm.state not in (DockingState.DOCKED, DockingState.FAILED):
        # 1. Line feedback
        line_out = LineDetectionOutput(
            detected=True,
            centroid_error_norm=robot.y / 0.15,
            angle_error_rad=robot.theta,
            confidence=0.92,
        )

        # 2. Target feedback
        dx = station_x - robot.x
        dist = math.hypot(dx, robot.y)
        target_out = PerceptionOutput(
            detected=(robot.x >= 0.5),
            distance_m=round(dist, 4),
            lateral_offset_m=round(robot.y, 4),
            heading_error_rad=round(robot.theta, 4),
            confidence=0.95,
            timestamp=t,
        )

        # 3. Obstacle injection
        is_blocked = False
        if obstacle_at_sec is not None and obstacle_at_sec <= t <= (obstacle_at_sec + obstacle_duration_sec):
            is_blocked = True

        obs_out = ObstacleOutput(
            corridor_blocked=is_blocked,
            obstacle_present=is_blocked,
            minimum_distance_m=0.30 if is_blocked else 999.0,
            detected_classes=["obstacle_box"] if is_blocked else [],
            confidence=0.95 if is_blocked else 0.0,
        )

        # 4. FSM Update
        state, cmd = fsm.update(
            line=line_out,
            target=target_out,
            obstacle=obs_out,
            station_zone_detected=(robot.x >= 0.7),
            last_frame_timestamp=t,
            current_time=t,
        )

        # 5. Kinematics step
        robot.step(dt, cmd.linear_velocity_mps, cmd.angular_velocity_rps)

        # 6. Log telemetry entry
        logger.log(
            state=state.value,
            linear_velocity=cmd.linear_velocity_mps,
            angular_velocity=cmd.angular_velocity_rps,
            distance_m=target_out.distance_m if target_out.detected else 1.5,
            lateral_offset_m=target_out.lateral_offset_m if target_out.detected else robot.y,
            heading_error_rad=target_out.heading_error_rad if target_out.detected else robot.theta,
            corridor_blocked=is_blocked,
            confidence=target_out.confidence if target_out.detected else 0.0,
            reason=cmd.reason,
            extra={
                "robot_x": robot.x,
                "robot_y": robot.y,
                "robot_theta_deg": round(math.degrees(robot.theta), 2),
            },
        )

        t += dt

    logger.close()
    result = fsm.get_result(current_time=t)
    print("-" * 65)
    print(f"REPLAY RESULT: {result.status}")
    print(f"Total Logged Records:  {logger.record_count}")
    print(f"Final Distance Error:  {result.final_distance_m * 100:.2f} cm")
    print(f"Final Lateral Error:   {abs(result.final_lateral_error_m) * 100:.2f} cm")
    print(f"Final Heading Error:   {abs(math.degrees(result.final_heading_error_rad)):.2f} deg")
    print("=" * 65)
    return result


if __name__ == "__main__":
    replay_run(initial_y=0.05, initial_theta=0.03)
