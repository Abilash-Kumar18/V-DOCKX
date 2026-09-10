"""
Unit Tests for V-DOCKX Safety Supervisor
Verifies priority gate, emergency stop, stale frame watchdog, and clearance dwell.
"""

import pytest
from docking.contracts import ControlCommand, ObstacleOutput
from docking.safety import SafetySupervisor


def test_safety_supervisor_passthrough_when_safe():
    supervisor = SafetySupervisor(max_linear_velocity=0.20, max_angular_velocity=0.60)
    raw_cmd = ControlCommand(timestamp=100.0, linear_velocity_mps=0.15, angular_velocity_rps=0.25, reason="NOMINAL")

    safe_cmd = supervisor.evaluate_command(
        raw_cmd=raw_cmd,
        obstacle=ObstacleOutput(corridor_blocked=False),
        last_frame_timestamp=100.0,
        current_time=100.05,
    )

    assert safe_cmd.linear_velocity_mps == 0.15
    assert safe_cmd.angular_velocity_rps == 0.25
    assert safe_cmd.reason == "NOMINAL"


def test_safety_supervisor_estop_override():
    supervisor = SafetySupervisor()
    supervisor.trigger_estop()

    raw_cmd = ControlCommand(linear_velocity_mps=0.20, angular_velocity_rps=0.50, reason="FORWARD")
    safe_cmd = supervisor.evaluate_command(raw_cmd=raw_cmd, current_time=100.0)

    assert safe_cmd.linear_velocity_mps == 0.0
    assert safe_cmd.angular_velocity_rps == 0.0
    assert safe_cmd.reason == "EMERGENCY_STOP_ACTIVE"

    supervisor.release_estop()
    safe_cmd_after = supervisor.evaluate_command(raw_cmd=raw_cmd, current_time=100.0)
    assert safe_cmd_after.linear_velocity_mps == 0.20


def test_safety_supervisor_stale_frame_timeout():
    supervisor = SafetySupervisor(stale_frame_timeout_s=0.40)
    raw_cmd = ControlCommand(linear_velocity_mps=0.10, angular_velocity_rps=0.10, reason="DRIVING")

    # Frame is 0.50s old (> 0.40s)
    safe_cmd = supervisor.evaluate_command(
        raw_cmd=raw_cmd,
        last_frame_timestamp=100.0,
        current_time=100.50,
    )

    assert safe_cmd.linear_velocity_mps == 0.0
    assert safe_cmd.angular_velocity_rps == 0.0
    assert "STALE_FRAME_TIMEOUT" in safe_cmd.reason


def test_safety_supervisor_obstacle_corridor_stop():
    supervisor = SafetySupervisor()
    raw_cmd = ControlCommand(linear_velocity_mps=0.15, angular_velocity_rps=0.0, reason="FORWARD")

    obs = ObstacleOutput(obstacle_present=True, corridor_blocked=True)
    safe_cmd = supervisor.evaluate_command(raw_cmd=raw_cmd, obstacle=obs, current_time=100.0)

    assert safe_cmd.linear_velocity_mps == 0.0
    assert safe_cmd.angular_velocity_rps == 0.0
    assert safe_cmd.reason == "OBSTACLE_SAFETY_STOP"
    assert supervisor.obstacle_stop_count == 1


def test_safety_supervisor_clearance_dwell():
    supervisor = SafetySupervisor(clearance_dwell_s=1.00)
    raw_cmd = ControlCommand(linear_velocity_mps=0.15, angular_velocity_rps=0.0, reason="FORWARD")

    # 1. Obstacle blocks corridor at t=10.0
    obs_blocked = ObstacleOutput(corridor_blocked=True)
    supervisor.evaluate_command(raw_cmd, obstacle=obs_blocked, current_time=10.0)

    # 2. Obstacle disappears at t=10.5, but dwell time is 1.0s (must stay stopped until t=11.5)
    obs_clear = ObstacleOutput(corridor_blocked=False)
    cmd_dwelling = supervisor.evaluate_command(raw_cmd, obstacle=obs_clear, current_time=10.8)
    assert cmd_dwelling.linear_velocity_mps == 0.0
    assert "CLEARANCE_DWELL_ACTIVE" in cmd_dwelling.reason

    # 3. After dwell period expires at t=11.6 (> 11.5s), motion resumes
    cmd_resumed = supervisor.evaluate_command(raw_cmd, obstacle=obs_clear, current_time=11.6)
    assert cmd_resumed.linear_velocity_mps == 0.15
    assert cmd_resumed.reason == "FORWARD"


def test_safety_supervisor_velocity_clamping():
    supervisor = SafetySupervisor(max_linear_velocity=0.20, max_angular_velocity=0.60)
    overspeed_cmd = ControlCommand(linear_velocity_mps=0.85, angular_velocity_rps=-1.50, reason="FAST")

    safe_cmd = supervisor.evaluate_command(overspeed_cmd, current_time=10.0)
    assert safe_cmd.linear_velocity_mps == 0.20
    assert safe_cmd.angular_velocity_rps == -0.60
