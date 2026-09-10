"""
V-DOCKX Line-Following Controller
Proportional steering and dynamic curvature speed throttling for route guidance.
"""

import time
from typing import Optional
from docking.contracts import LineDetectionOutput, ControlCommand


class LineController:
    """
    Computes bounded velocity commands to keep the robot aligned with a floor line.
    Control Law:
        omega = K_c * e_c + K_a * e_a
        v = v_base * max(min_ratio, 1.0 - beta_c * |e_c| - beta_a * |e_a|)
    """

    def __init__(
        self,
        kp_centroid: float = 0.80,
        kp_angle: float = 0.60,
        base_linear_velocity: float = 0.15,
        max_linear_velocity: float = 0.20,
        min_linear_velocity: float = 0.03,
        max_angular_velocity: float = 0.60,
        beta_centroid: float = 0.70,
        beta_angle: float = 0.50,
        min_confidence: float = 0.40,
    ):
        self.kp_centroid = kp_centroid
        self.kp_angle = kp_angle
        self.base_linear_velocity = base_linear_velocity
        self.max_linear_velocity = max_linear_velocity
        self.min_linear_velocity = min_linear_velocity
        self.max_angular_velocity = max_angular_velocity
        self.beta_centroid = beta_centroid
        self.beta_angle = beta_angle
        self.min_confidence = min_confidence

    def compute(self, line_output: LineDetectionOutput) -> ControlCommand:
        """
        Compute control command based on detected line error.
        """
        now = time.time()

        if not line_output.detected or line_output.confidence < self.min_confidence:
            return ControlCommand(
                timestamp=now,
                linear_velocity_mps=0.0,
                angular_velocity_rps=0.0,
                reason="LINE_NOT_DETECTED_OR_LOW_CONFIDENCE",
            )

        e_c = line_output.centroid_error_norm  # [-1.0, 1.0], + is right of center
        e_a = line_output.angle_error_rad      # Angle relative to vertical

        # Steering: if line is to the right (+e_c), we steer right (-omega in right-handed convention)
        # Standard robotics convention: +omega = counter-clockwise (turn left), -omega = clockwise (turn right)
        # So if e_c > 0 (robot is left of line, line is to the right in camera), we turn right -> negative omega
        omega = -(self.kp_centroid * e_c + self.kp_angle * e_a)

        # Clamp angular velocity
        omega = max(-self.max_angular_velocity, min(self.max_angular_velocity, omega))

        # Dynamic speed throttling: slow down on curves or large offsets
        throttle_factor = 1.0 - (self.beta_centroid * abs(e_c) + self.beta_angle * abs(e_a))
        throttle_factor = max(0.25, min(1.0, throttle_factor))

        linear_v = self.base_linear_velocity * throttle_factor
        linear_v = max(self.min_linear_velocity, min(self.max_linear_velocity, linear_v))

        return ControlCommand(
            timestamp=now,
            linear_velocity_mps=round(linear_v, 4),
            angular_velocity_rps=round(omega, 4),
            reason="LINE_TRACKING_ACTIVE",
        )
