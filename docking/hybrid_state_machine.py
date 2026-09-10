"""
V-DOCKX Hybrid Docking Finite State Machine
Orchestrates line-guided navigation, visual servoing, verification dwell, and recovery.
"""

import time
from typing import Optional, Tuple
from docking.contracts import (
    DockingState,
    PerceptionOutput,
    LineDetectionOutput,
    ObstacleOutput,
    ControlCommand,
    DockingResult,
)
from docking.line_controller import LineController
from docking.controller import VisualServoController
from docking.safety import SafetySupervisor


class HybridDockingStateMachine:
    """
    State machine managing the complete docking lifecycle:
    Line Following -> Station Zone -> Fine Alignment -> Verification -> Docked.
    """

    def __init__(
        self,
        line_controller: Optional[LineController] = None,
        docking_controller: Optional[VisualServoController] = None,
        safety_supervisor: Optional[SafetySupervisor] = None,
        lateral_tolerance_m: float = 0.03,
        heading_tolerance_rad: float = 0.08,
        docking_distance_m: float = 0.12,
        verification_dwell_s: float = 0.80,
        max_retries: int = 3,
        recovery_reverse_speed_mps: float = -0.05,
        recovery_reverse_duration_s: float = 1.00,
    ):
        self.line_controller = line_controller or LineController()
        self.docking_controller = docking_controller or VisualServoController()
        self.safety_supervisor = safety_supervisor or SafetySupervisor()

        self.lateral_tolerance_m = lateral_tolerance_m
        self.heading_tolerance_rad = heading_tolerance_rad
        self.docking_distance_m = docking_distance_m
        self.verification_dwell_s = verification_dwell_s
        self.max_retries = max_retries
        self.recovery_reverse_speed_mps = recovery_reverse_speed_mps
        self.recovery_reverse_duration_s = recovery_reverse_duration_s

        # FSM State Variables
        self.state: DockingState = DockingState.IDLE
        self.previous_state: DockingState = DockingState.IDLE
        self.start_time: float = 0.0
        self.state_enter_time: float = time.time()
        self.dwell_start_time: Optional[float] = None
        self.recovery_start_time: Optional[float] = None

        self.consecutive_line_frames: int = 0
        self.consecutive_target_frames: int = 0
        self.missing_target_frames: int = 0
        self.missing_line_frames: int = 0
        self.retry_count: int = 0
        self.failure_reason: str = ""

        # Latest cached inputs
        self.last_perception: Optional[PerceptionOutput] = None
        self.last_command: ControlCommand = ControlCommand()

    def start_mission(self, start_time: Optional[float] = None) -> None:
        """Trigger start of autonomous docking mission."""
        self.state = DockingState.LINE_SEARCH
        self.start_time = start_time if start_time is not None else time.time()
        self.state_enter_time = self.start_time
        self.retry_count = 0
        self.failure_reason = ""
        self.consecutive_line_frames = 0
        self.consecutive_target_frames = 0

    def abort_mission(self, reason: str = "MISSION_ABORTED_BY_OPERATOR") -> None:
        """Abort active mission."""
        self.transition_to(DockingState.FAILED, reason)
        self.safety_supervisor.trigger_estop()

    def transition_to(self, new_state: DockingState, reason: str = "") -> None:
        """Transition FSM to a new state with timestamp tracking."""
        if self.state != new_state:
            self.previous_state = self.state
            self.state = new_state
            self.state_enter_time = time.time()
            if new_state == DockingState.FAILED:
                self.failure_reason = reason

    def update(
        self,
        line: Optional[LineDetectionOutput] = None,
        target: Optional[PerceptionOutput] = None,
        obstacle: Optional[ObstacleOutput] = None,
        station_zone_detected: bool = False,
        last_frame_timestamp: Optional[float] = None,
        current_time: Optional[float] = None,
    ) -> Tuple[DockingState, ControlCommand]:
        """
        Execute one FSM cycle and return the updated (State, Safe ControlCommand).
        """
        now = current_time if current_time is not None else time.time()
        if self.start_time == 0.0 or (current_time is not None and self.start_time > 1e8 and current_time < 1e6):
            self.start_time = now

        if target is not None:
            self.last_perception = target

        # -------------------------------------------------------------
        # 1. PRIORITY SAFETY OVERRIDES (Handled by SafetySupervisor)
        # -------------------------------------------------------------
        # If corridor is blocked, force state into OBSTACLE_STOP
        if obstacle is not None and obstacle.corridor_blocked:
            if self.state not in (DockingState.OBSTACLE_STOP, DockingState.FAILED, DockingState.DOCKED):
                self.transition_to(DockingState.OBSTACLE_STOP, "CORRIDOR_BLOCKED")

        # -------------------------------------------------------------
        # 2. STATE MACHINE TRANSITION & MOTION LOGIC
        # -------------------------------------------------------------
        raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason="IDLE")

        if self.state == DockingState.IDLE:
            raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason="WAITING_FOR_START")

        elif self.state == DockingState.LINE_SEARCH:
            # Rotate slowly searching for line
            if line is not None and line.detected:
                self.consecutive_line_frames += 1
                if self.consecutive_line_frames >= 3:
                    self.transition_to(DockingState.LINE_FOLLOW, "LINE_ACQUIRED")
                    raw_cmd = self.line_controller.compute(line)
                else:
                    raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.15, reason="LINE_SEARCH_SCAN")
            else:
                self.consecutive_line_frames = 0
                raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.20, reason="LINE_SEARCH_ROTATING")

        elif self.state == DockingState.LINE_FOLLOW:
            if line is not None and line.detected:
                self.missing_line_frames = 0
                raw_cmd = self.line_controller.compute(line)

                # Transition condition: Station zone detected or marker entered upper FOV
                if station_zone_detected or (target is not None and target.detected and target.distance_m < 1.8):
                    self.transition_to(DockingState.STATION_ZONE_APPROACH, "STATION_ZONE_REACHED")
            else:
                self.missing_line_frames += 1
                if self.missing_line_frames > 8:
                    self.transition_to(DockingState.LINE_LOST, "LINE_LOST_DURING_FOLLOW")
                    raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason="LINE_LOST")

        elif self.state == DockingState.STATION_ZONE_APPROACH:
            # Slower approach while watching for station marker
            if line is not None and line.detected:
                raw_cmd = self.line_controller.compute(line)
                # Cap speed in station zone
                raw_cmd.linear_velocity_mps = min(0.08, raw_cmd.linear_velocity_mps)

            if target is not None and target.detected and target.confidence >= 0.50:
                self.consecutive_target_frames += 1
                if self.consecutive_target_frames >= 3:
                    self.transition_to(DockingState.DOCKING_TARGET_ACQUIRE, "TARGET_MARKER_LOCKED")
            else:
                self.consecutive_target_frames = 0

        elif self.state == DockingState.DOCKING_TARGET_ACQUIRE:
            # Brief pause / creep while acquiring stable target pose
            if target is not None and target.detected and target.confidence >= 0.60:
                self.transition_to(DockingState.FINE_ALIGN, "TARGET_CONFIRMED")
                raw_cmd = self.docking_controller.compute(target)
            else:
                raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.02, angular_velocity_rps=0.0, reason="ACQUIRING_TARGET_LOCK")

        elif self.state == DockingState.FINE_ALIGN:
            if target is not None and target.detected:
                self.missing_target_frames = 0
                raw_cmd = self.docking_controller.compute(target)

                # If coarse alignment achieved, switch to final approach
                if abs(target.lateral_offset_m) <= 0.08 and abs(target.heading_error_rad) <= 0.15:
                    self.transition_to(DockingState.FINAL_APPROACH, "ALIGNMENT_TOLERANCES_MET")
            else:
                self.missing_target_frames += 1
                if self.missing_target_frames > 10:
                    self.transition_to(DockingState.TARGET_LOST, "TARGET_LOST_IN_FINE_ALIGN")
                    raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason="TARGET_LOST")

        elif self.state == DockingState.FINAL_APPROACH:
            if target is not None and target.detected:
                self.missing_target_frames = 0
                raw_cmd = self.docking_controller.compute(target)

                # Reached final docking pad distance
                if target.distance_m <= self.docking_distance_m:
                    self.transition_to(DockingState.VERIFY, "DOCKING_LINE_REACHED")
                    self.dwell_start_time = now
                    raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason="COMMENCING_VERIFICATION")
            else:
                self.missing_target_frames += 1
                if self.missing_target_frames > 8:
                    self.transition_to(DockingState.TARGET_LOST, "TARGET_LOST_FINAL_APPROACH")
                    raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason="TARGET_LOST")

        elif self.state == DockingState.VERIFY:
            # Hold zero motion during verification
            raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason="VERIFYING_POSE")

            if target is not None and target.detected:
                # Check conjunctive docking tolerances
                within_lat = abs(target.lateral_offset_m) <= self.lateral_tolerance_m
                within_head = abs(target.heading_error_rad) <= self.heading_tolerance_rad
                within_dist = target.distance_m <= (self.docking_distance_m + 0.03)

                if within_lat and within_head and within_dist:
                    if self.dwell_start_time is None:
                        self.dwell_start_time = now

                    elapsed_dwell = now - self.dwell_start_time
                    if elapsed_dwell >= self.verification_dwell_s:
                        self.transition_to(DockingState.DOCKED, "VERIFICATION_DWELL_SATISFIED")
                else:
                    # Pose slipped outside tolerance during dwell
                    self.dwell_start_time = None
                    self.transition_to(DockingState.FINE_ALIGN, "TOLERANCE_VIOLATED_RE_ALIGNING")
            else:
                self.dwell_start_time = None
                self.transition_to(DockingState.TARGET_LOST, "TARGET_LOST_DURING_VERIFICATION")

        elif self.state == DockingState.DOCKED:
            raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason="DOCKING_COMPLETE")

        elif self.state == DockingState.OBSTACLE_STOP:
            raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason="STOPPED_FOR_OBSTACLE")
            # If corridor is clear and clearance dwell elapsed in safety supervisor, resume
            if obstacle is None or not obstacle.corridor_blocked:
                if not self.safety_supervisor.corridor_was_blocked:
                    # Resumed from clearance dwell
                    resume_target = (
                        self.previous_state
                        if self.previous_state not in (DockingState.OBSTACLE_STOP, DockingState.FAILED)
                        else DockingState.LINE_FOLLOW
                    )
                    self.transition_to(resume_target, "OBSTACLE_CLEARED")

        elif self.state in (DockingState.LINE_LOST, DockingState.TARGET_LOST):
            self.retry_count += 1
            if self.retry_count > self.max_retries:
                self.transition_to(DockingState.FAILED, f"EXCEEDED_MAX_RETRIES ({self.max_retries})")
                raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason="MAX_RETRIES_EXCEEDED")
            else:
                self.transition_to(DockingState.RECOVERY, f"INITIATING_RECOVERY_ATTEMPT_{self.retry_count}")
                self.recovery_start_time = now
                raw_cmd = ControlCommand(
                    timestamp=now,
                    linear_velocity_mps=self.recovery_reverse_speed_mps,
                    angular_velocity_rps=0.0,
                    reason=f"RECOVERY_REVERSE_ATTEMPT_{self.retry_count}",
                )

        elif self.state == DockingState.RECOVERY:
            if self.recovery_start_time is None:
                self.recovery_start_time = now

            elapsed_recovery = now - self.recovery_start_time
            if elapsed_recovery < self.recovery_reverse_duration_s:
                raw_cmd = ControlCommand(
                    timestamp=now,
                    linear_velocity_mps=self.recovery_reverse_speed_mps,
                    angular_velocity_rps=0.0,
                    reason="RECOVERY_REVERSING",
                )
            else:
                # Re-enter search
                self.recovery_start_time = None
                self.transition_to(DockingState.LINE_SEARCH, "RECOVERY_REVERSE_COMPLETE_SCANNING")
                raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.20, reason="RECOVERY_SCANNING")

        elif self.state == DockingState.FAILED:
            raw_cmd = ControlCommand(timestamp=now, linear_velocity_mps=0.0, angular_velocity_rps=0.0, reason=f"FAILED: {self.failure_reason}")

        # -------------------------------------------------------------
        # 3. FINAL SAFETY SUPERVISOR GATE
        # -------------------------------------------------------------
        safe_cmd = self.safety_supervisor.evaluate_command(
            raw_cmd=raw_cmd,
            obstacle=obstacle,
            last_frame_timestamp=last_frame_timestamp,
            current_time=now,
        )

        self.last_update_time = now
        self.last_command = safe_cmd
        return self.state, safe_cmd

    def get_result(self, current_time: Optional[float] = None) -> DockingResult:
        """Return final mission performance summary."""
        now = current_time if current_time is not None else (self.last_update_time if hasattr(self, 'last_update_time') else time.time())
        duration = round(now - self.start_time, 2) if self.start_time > 0 else 0.0
        final_dist = self.last_perception.distance_m if self.last_perception else 0.0
        final_lat = self.last_perception.lateral_offset_m if self.last_perception else 0.0
        final_head = self.last_perception.heading_error_rad if self.last_perception else 0.0

        status_str = "VISUALLY_ALIGNED" if self.state == DockingState.DOCKED else self.state.value

        return DockingResult(
            status=status_str,
            duration_s=duration,
            attempts=self.retry_count + 1,
            final_distance_m=round(final_dist, 4),
            final_lateral_error_m=round(final_lat, 4),
            final_heading_error_rad=round(final_head, 4),
            obstacle_stops=self.safety_supervisor.obstacle_stop_count,
            failure_reason=self.failure_reason,
        )
