"""
V-DOCKX Precision Visual Servoing Controller
Closed-loop trajectory correction, terminal deceleration, and deadband stabilization.
"""

import time
from docking.contracts import PerceptionOutput, ControlCommand


class VisualServoController:
    """
    Closed-loop visual servoing controller for final docking approach.
    Control Law:
        omega = -(K_y * e_y + K_theta * e_theta)
        v = clamp(K_d * (e_d - target_distance), v_min, v_max)
    """

    def __init__(
        self,
        kp_distance: float = 0.45,
        kp_lateral: float = 1.20,
        kp_heading: float = 1.00,
        max_linear_velocity: float = 0.20,
        final_linear_velocity: float = 0.05,
        min_linear_velocity: float = 0.02,
        max_angular_velocity: float = 0.60,
        target_docking_distance: float = 0.12,
        deceleration_distance: float = 0.35,
        lateral_deadband_m: float = 0.005,
        heading_deadband_rad: float = 0.02,
        min_confidence: float = 0.50,
    ):
        self.kp_distance = kp_distance
        self.kp_lateral = kp_lateral
        self.kp_heading = kp_heading
        self.max_linear_velocity = max_linear_velocity
        self.final_linear_velocity = final_linear_velocity
        self.min_linear_velocity = min_linear_velocity
        self.max_angular_velocity = max_angular_velocity
        self.target_docking_distance = target_docking_distance
        self.deceleration_distance = deceleration_distance
        self.lateral_deadband_m = lateral_deadband_m
        self.heading_deadband_rad = heading_deadband_rad
        self.min_confidence = min_confidence

    def compute(self, perception: PerceptionOutput) -> ControlCommand:
        """
        Compute angular and linear velocity commands from 6-DoF perception pose.
        """
        now = time.time()

        if not perception.detected or perception.confidence < self.min_confidence:
            return ControlCommand(
                timestamp=now,
                linear_velocity_mps=0.0,
                angular_velocity_rps=0.0,
                reason="TARGET_NOT_DETECTED_OR_LOW_CONFIDENCE",
            )

        e_d = perception.distance_m
        e_y = perception.lateral_offset_m
        e_theta = perception.heading_error_rad

        # Apply deadband around zero error to prevent terminal jitter
        eff_y = 0.0 if abs(e_y) < self.lateral_deadband_m else e_y
        eff_theta = 0.0 if abs(e_theta) < self.heading_deadband_rad else e_theta

        # Compute angular velocity: +e_y (target to the right) -> turn CW (-omega)
        omega = -(self.kp_lateral * eff_y + self.kp_heading * eff_theta)
        omega = max(-self.max_angular_velocity, min(self.max_angular_velocity, omega))

        # Forward distance error relative to final docking target
        distance_error = e_d - self.target_docking_distance

        if distance_error <= 0.0:
            # Reached or passed docking target line
            linear_v = 0.0
        else:
            # Scale linear velocity proportionally with distance
            linear_v = self.kp_distance * distance_error

            # If inside the final deceleration zone, cap speed to final creeping speed
            speed_ceiling = (
                self.final_linear_velocity
                if e_d <= self.deceleration_distance
                else self.max_linear_velocity
            )

            linear_v = max(self.min_linear_velocity, min(speed_ceiling, linear_v))

        return ControlCommand(
            timestamp=now,
            linear_velocity_mps=round(linear_v, 4),
            angular_velocity_rps=round(omega, 4),
            reason="VISUAL_SERVOING_ACTIVE",
        )
