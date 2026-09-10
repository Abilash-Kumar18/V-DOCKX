"""
V-DOCKX End-to-End Simulation Test Runner
Simulates autonomous robot docking from start to verified alignment.
"""

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
from docking.robot_adapter import SimulatedRobotAdapter


def run_simulation(inject_obstacle_at_step: int = -1):
    print("=" * 65)
    print("       V-DOCKX CLOSED-LOOP DOCKING SIMULATION TEST")
    print("=" * 65)

    fsm = HybridDockingStateMachine(
        docking_distance_m=0.12,
        lateral_tolerance_m=0.03,
        heading_tolerance_rad=0.08,
        verification_dwell_s=0.80,
    )

    # Initial robot pose: x=0.0m, lateral offset y=+0.04m, heading error +0.02 rad
    robot = SimulatedRobotAdapter(x=0.0, y=0.04, theta=0.02)
    fsm.start_mission()

    t = 0.0
    dt = 0.05
    step = 0
    station_x = 1.50  # Station charging plane at x=1.5m

    print(f"Initial Pose: x={robot.x:.3f}m, y={robot.y:.3f}m, theta={math.degrees(robot.theta):.2f} deg")
    print("-" * 65)
    print(f"{'Time':<7} | {'State':<23} | {'v (m/s)':<8} | {'w (rad/s)':<9} | {'Robot Pose (x, y, theta)'}")
    print("-" * 65)

    while t < 25.0 and fsm.state not in (DockingState.DOCKED, DockingState.FAILED):
        # 1. Floor Line Perception (Robot at y, line is at y=0)
        e_c = robot.y / 0.15
        e_a = robot.theta
        line_out = LineDetectionOutput(
            detected=True,
            centroid_error_norm=e_c,
            angle_error_rad=e_a,
            confidence=0.92,
        )

        # 2. Station Target Perception (Station at x=1.5, y=0.0)
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

        # 3. Obstacle Injection (Optional)
        obstacle_blocked = (step == inject_obstacle_at_step)
        obs_out = ObstacleOutput(
            corridor_blocked=obstacle_blocked,
            obstacle_present=obstacle_blocked,
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

        # 5. Kinematic Integration
        robot.step(dt, cmd.linear_velocity_mps, cmd.angular_velocity_rps)

        # Print progress every 10 steps (0.5s) or on state change
        if step % 10 == 0 or state != fsm.previous_state:
            th_deg = math.degrees(robot.theta)
            print(
                f"{t:5.2f}s  | {state.value:<23} | {cmd.linear_velocity_mps:7.3f} | {cmd.angular_velocity_rps:8.3f}  | x={robot.x:5.3f}m, y={robot.y:6.3f}m, {th_deg:5.1f} deg"
            )

        t += dt
        step += 1

    print("-" * 65)
    result = fsm.get_result()
    print(f"MISSION STATUS: {result.status}")
    print(f"Total Duration: {result.duration_s}s")
    print(f"Final Distance to Bay: {result.final_distance_m * 100:.2f} cm (Target: 12.0 cm)")
    print(f"Final Lateral Error:   {abs(result.final_lateral_error_m) * 100:.2f} cm (Tolerance: <= 3.0 cm)")
    print(f"Final Heading Error:   {abs(math.degrees(result.final_heading_error_rad)):.2f} deg (Tolerance: <= 5.0 deg)")
    print("=" * 65)


if __name__ == "__main__":
    run_simulation()
