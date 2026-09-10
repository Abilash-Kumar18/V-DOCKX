"""
Unit Tests for V-DOCKX Hybrid State Machine and Controllers
Verifies operational lifecycle transitions, verification dwell, and recovery bounds.
"""

import pytest
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


def test_line_controller_steering_and_throttling():
    ctrl = LineController(
        kp_centroid=0.80,
        kp_angle=0.60,
        base_linear_velocity=0.15,
        max_angular_velocity=0.60,
    )

    # 1. Centered line: straight forward, minimal turn
    cmd_center = ctrl.compute(LineDetectionOutput(detected=True, centroid_error_norm=0.0, angle_error_rad=0.0, confidence=0.9))
    assert cmd_center.linear_velocity_mps == 0.15
    assert cmd_center.angular_velocity_rps == 0.0

    # 2. Line offset to right (+e_c): should steer right (-omega)
    cmd_offset = ctrl.compute(LineDetectionOutput(detected=True, centroid_error_norm=0.5, angle_error_rad=0.0, confidence=0.9))
    assert cmd_offset.angular_velocity_rps < 0.0
    # Speed throttles down
    assert cmd_offset.linear_velocity_mps < 0.15


def test_visual_servo_controller_deadbands_and_deceleration():
    ctrl = VisualServoController(
        kp_distance=0.45,
        kp_lateral=1.20,
        kp_heading=1.00,
        target_docking_distance=0.12,
        deceleration_distance=0.35,
        final_linear_velocity=0.05,
        lateral_deadband_m=0.005,
        heading_deadband_rad=0.02,
    )

    # 1. Far away: high speed (0.20m/s clamped)
    cmd_far = ctrl.compute(PerceptionOutput(detected=True, distance_m=1.5, lateral_offset_m=0.0, heading_error_rad=0.0, confidence=0.9))
    assert cmd_far.linear_velocity_mps > 0.05

    # 2. Near deceleration zone (0.30m < 0.35m): speed capped to final_linear_velocity
    cmd_near = ctrl.compute(PerceptionOutput(detected=True, distance_m=0.30, lateral_offset_m=0.0, heading_error_rad=0.0, confidence=0.9))
    assert cmd_near.linear_velocity_mps <= 0.05

    # 3. Inside deadband: zero angular velocity
    cmd_deadband = ctrl.compute(PerceptionOutput(detected=True, distance_m=0.5, lateral_offset_m=0.003, heading_error_rad=0.01, confidence=0.9))
    assert cmd_deadband.angular_velocity_rps == 0.0


def test_fsm_complete_nominal_docking_cycle():
    fsm = HybridDockingStateMachine(
        docking_distance_m=0.12,
        lateral_tolerance_m=0.03,
        heading_tolerance_rad=0.08,
        verification_dwell_s=0.50,
    )

    assert fsm.state == DockingState.IDLE

    # 1. Start mission
    fsm.start_mission()
    assert fsm.state == DockingState.LINE_SEARCH

    # 2. Acquire line over 3 frames
    line_ok = LineDetectionOutput(detected=True, centroid_error_norm=0.0, confidence=0.85)
    for _ in range(3):
        state, _ = fsm.update(line=line_ok, current_time=1.0)
    assert state == DockingState.LINE_FOLLOW

    # 3. Station zone detected
    state, _ = fsm.update(line=line_ok, station_zone_detected=True, current_time=2.0)
    assert state == DockingState.STATION_ZONE_APPROACH

    # 4. Target tag detected over 3 frames
    target_far = PerceptionOutput(detected=True, distance_m=1.0, lateral_offset_m=0.10, heading_error_rad=0.20, confidence=0.8)
    for _ in range(3):
        state, _ = fsm.update(line=line_ok, target=target_far, current_time=3.0)
    assert state == DockingState.DOCKING_TARGET_ACQUIRE

    # 5. Lock confirmed -> Fine align
    target_lock = PerceptionOutput(detected=True, distance_m=0.8, lateral_offset_m=0.09, heading_error_rad=0.18, confidence=0.85)
    state, _ = fsm.update(target=target_lock, current_time=4.0)
    assert state == DockingState.FINE_ALIGN

    # 6. Fine alignment achieved -> Final approach
    target_aligned = PerceptionOutput(detected=True, distance_m=0.40, lateral_offset_m=0.02, heading_error_rad=0.03, confidence=0.90)
    state, _ = fsm.update(target=target_aligned, current_time=5.0)
    assert state == DockingState.FINAL_APPROACH

    # 7. Final docking pad reached -> Verify
    target_docked = PerceptionOutput(detected=True, distance_m=0.12, lateral_offset_m=0.01, heading_error_rad=0.02, confidence=0.95)
    state, cmd = fsm.update(target=target_docked, current_time=6.0)
    assert state == DockingState.VERIFY
    assert cmd.linear_velocity_mps == 0.0  # Must hold position

    # 8. Verification dwell period (0.50s)
    state, _ = fsm.update(target=target_docked, current_time=6.3)
    assert state == DockingState.VERIFY  # 0.3s < 0.5s dwell

    state, _ = fsm.update(target=target_docked, current_time=6.6)
    assert state == DockingState.DOCKED  # 0.6s >= 0.5s dwell satisfied!

    result = fsm.get_result()
    assert result.status == "VISUALLY_ALIGNED"
    assert result.final_distance_m == 0.12


def test_fsm_obstacle_stop_and_resume():
    fsm = HybridDockingStateMachine()
    fsm.start_mission()
    line_ok = LineDetectionOutput(detected=True, centroid_error_norm=0.0, confidence=0.85)
    for _ in range(3):
        fsm.update(line=line_ok, current_time=1.0)
    assert fsm.state == DockingState.LINE_FOLLOW

    # Obstacle appears in corridor
    obs_blocked = ObstacleOutput(obstacle_present=True, corridor_blocked=True)
    state, cmd = fsm.update(line=line_ok, obstacle=obs_blocked, current_time=2.0)
    assert state == DockingState.OBSTACLE_STOP
    assert cmd.linear_velocity_mps == 0.0

    # Obstacle clears at t=3.0, but clearance dwell is 1.0s (must remain stopped at t=3.5)
    obs_clear = ObstacleOutput(obstacle_present=False, corridor_blocked=False)
    state, cmd = fsm.update(line=line_ok, obstacle=obs_clear, current_time=3.5)
    assert state == DockingState.OBSTACLE_STOP
    assert cmd.linear_velocity_mps == 0.0

    # After clearance dwell (t=4.2 > 4.0s), resumes prior state
    state, cmd = fsm.update(line=line_ok, obstacle=obs_clear, current_time=4.2)
    assert state == DockingState.LINE_FOLLOW


def test_fsm_target_loss_and_max_retries_failure():
    fsm = HybridDockingStateMachine(max_retries=2, recovery_reverse_duration_s=0.50)
    fsm.start_mission()
    fsm.state = DockingState.FINE_ALIGN

    # Target lost for > 10 frames
    missing_target = PerceptionOutput(detected=False)
    for _ in range(12):
        fsm.update(target=missing_target, current_time=1.0)

    # Enters recovery attempt 1
    assert fsm.state == DockingState.RECOVERY
    assert fsm.retry_count == 1

    # Recovery completes -> line search
    state, _ = fsm.update(target=missing_target, current_time=1.6)
    assert state == DockingState.LINE_SEARCH

    # Force target loss again to test retry limit
    fsm.state = DockingState.FINE_ALIGN
    for _ in range(12):
        fsm.update(target=missing_target, current_time=2.0)
    assert fsm.retry_count == 2

    # Finish recovery 2
    fsm.update(target=missing_target, current_time=2.6)

    # Force target loss third time (> max_retries 2)
    fsm.state = DockingState.FINE_ALIGN
    for _ in range(12):
        fsm.update(target=missing_target, current_time=3.0)

    assert fsm.state == DockingState.FAILED
    assert "EXCEEDED_MAX_RETRIES" in fsm.failure_reason
