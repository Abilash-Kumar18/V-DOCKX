"""
V-DOCKX Safety Supervisor
Highest-priority motion clamp, stale frame watchdog, emergency stop, and clearance dwell.
"""

import time
from typing import Optional
from docking.contracts import ControlCommand, ObstacleOutput


class SafetySupervisor:
    """
    Guarantees machine safety by overriding any motion command when hazards occur.
    Priority Hierarchy:
        1. Manual Emergency Stop (E-STOP)
        2. Stale Camera Frame Watchdog (> 0.40s)
        3. Corridor Obstacle Intrusion
        4. Clearance Dwell Countdown (>= 1.0s before resume)
        5. Command Velocity Clamping
    """

    def __init__(
        self,
        stale_frame_timeout_s: float = 0.40,
        clearance_dwell_s: float = 1.00,
        max_linear_velocity: float = 0.20,
        max_angular_velocity: float = 0.60,
    ):
        self.stale_frame_timeout_s = stale_frame_timeout_s
        self.clearance_dwell_s = clearance_dwell_s
        self.max_linear_velocity = max_linear_velocity
        self.max_angular_velocity = max_angular_velocity

        self.estop_active: bool = False
        self.last_obstacle_time: float = 0.0
        self.corridor_was_blocked: bool = False
        self.obstacle_stop_count: int = 0

    def trigger_estop(self) -> None:
        """Manually trigger emergency stop."""
        self.estop_active = True

    def release_estop(self) -> None:
        """Release manual emergency stop."""
        self.estop_active = False

    def evaluate_command(
        self,
        raw_cmd: ControlCommand,
        obstacle: Optional[ObstacleOutput] = None,
        last_frame_timestamp: Optional[float] = None,
        current_time: Optional[float] = None,
    ) -> ControlCommand:
        """
        Evaluate and clamp motion command through the safety priority gate.
        """
        now = current_time if current_time is not None else time.time()

        # 1. Emergency Stop Priority
        if self.estop_active:
            return ControlCommand(
                timestamp=now,
                linear_velocity_mps=0.0,
                angular_velocity_rps=0.0,
                reason="EMERGENCY_STOP_ACTIVE",
            )

        # 2. Stale Camera Frame Watchdog
        if last_frame_timestamp is not None:
            frame_age = now - last_frame_timestamp
            if frame_age > self.stale_frame_timeout_s:
                return ControlCommand(
                    timestamp=now,
                    linear_velocity_mps=0.0,
                    angular_velocity_rps=0.0,
                    reason=f"STALE_FRAME_TIMEOUT (age: {frame_age:.3f}s > {self.stale_frame_timeout_s}s)",
                )

        # 3. Obstacle Corridor Check
        if obstacle is not None and obstacle.corridor_blocked:
            if not self.corridor_was_blocked:
                self.obstacle_stop_count += 1
            self.corridor_was_blocked = True
            self.last_obstacle_time = now
            return ControlCommand(
                timestamp=now,
                linear_velocity_mps=0.0,
                angular_velocity_rps=0.0,
                reason="OBSTACLE_SAFETY_STOP",
            )

        # 4. Clearance Dwell Logic (Hold stopped after obstacle disappears)
        if self.corridor_was_blocked:
            time_since_clear = now - self.last_obstacle_time
            if time_since_clear < self.clearance_dwell_s:
                return ControlCommand(
                    timestamp=now,
                    linear_velocity_mps=0.0,
                    angular_velocity_rps=0.0,
                    reason=f"CLEARANCE_DWELL_ACTIVE ({time_since_clear:.2f}s / {self.clearance_dwell_s}s)",
                )
            else:
                # Dwell period successfully satisfied
                self.corridor_was_blocked = False

        # 5. Velocity Clamping
        clamped_v = max(
            -self.max_linear_velocity,
            min(self.max_linear_velocity, raw_cmd.linear_velocity_mps),
        )
        clamped_omega = max(
            -self.max_angular_velocity,
            min(self.max_angular_velocity, raw_cmd.angular_velocity_rps),
        )

        return ControlCommand(
            timestamp=now,
            linear_velocity_mps=round(clamped_v, 4),
            angular_velocity_rps=round(clamped_omega, 4),
            reason=raw_cmd.reason,
        )
