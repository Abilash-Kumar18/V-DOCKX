"""
V-DOCKX Pose Filter (Member 1)
Exponential Moving Average (EMA) and outlier rejection filter
to eliminate ArUco 6-DoF pose jitter and corner estimation noise.
"""

import math
import time
from typing import Optional
from docking.contracts import PerceptionOutput


class PoseFilter:
    """
    Low-pass filter for 6-DoF fiducial pose measurements.
    Applies EMA smoothing to metric distance, lateral displacement,
    and circular interpolation for heading angle.
    """

    def __init__(
        self,
        alpha_position: float = 0.70,
        alpha_heading: float = 0.65,
        max_jump_distance_m: float = 0.50,
        max_jump_lateral_m: float = 0.30,
    ):
        self.alpha_pos = alpha_position
        self.alpha_heading = alpha_heading
        self.max_jump_distance = max_jump_distance_m
        self.max_jump_lateral = max_jump_lateral_m

        self.filtered_distance: Optional[float] = None
        self.filtered_lateral: Optional[float] = None
        self.filtered_heading: Optional[float] = None
        self.last_timestamp: float = 0.0
        self.initialized: bool = False

    def reset(self) -> None:
        """Reset internal filter states."""
        self.filtered_distance = None
        self.filtered_lateral = None
        self.filtered_heading = None
        self.last_timestamp = 0.0
        self.initialized = False

    def update(self, measurement: PerceptionOutput) -> PerceptionOutput:
        """
        Filter a raw PerceptionOutput and return the smoothed PerceptionOutput.
        If measurement.detected is False, returns measurement unchanged.
        """
        if not measurement.detected:
            # Don't reset immediately, but don't filter absent data
            return measurement

        curr_time = measurement.timestamp if measurement.timestamp > 0 else time.time()
        d_meas = measurement.distance_m
        y_meas = measurement.lateral_offset_m
        th_meas = measurement.heading_error_rad

        if not self.initialized or self.filtered_distance is None:
            self.filtered_distance = d_meas
            self.filtered_lateral = y_meas
            self.filtered_heading = th_meas
            self.last_timestamp = curr_time
            self.initialized = True

            return PerceptionOutput(
                timestamp=curr_time,
                station_id=measurement.station_id,
                detected=True,
                distance_m=self.filtered_distance,
                lateral_offset_m=self.filtered_lateral,
                heading_error_rad=self.filtered_heading,
                confidence=measurement.confidence,
                reprojection_error_px=measurement.reprojection_error_px,
            )

        # 1. Outlier Rejection (Kinematic feasibility check)
        if abs(d_meas - self.filtered_distance) > self.max_jump_distance:
            # Clamp or reject massive instantaneous jump
            d_meas = self.filtered_distance + math.copysign(
                self.max_jump_distance, d_meas - self.filtered_distance
            )

        if abs(y_meas - self.filtered_lateral) > self.max_jump_lateral:
            y_meas = self.filtered_lateral + math.copysign(
                self.max_jump_lateral, y_meas - self.filtered_lateral
            )

        # 2. Linear Position EMA
        self.filtered_distance = (
            self.alpha_pos * d_meas + (1.0 - self.alpha_pos) * self.filtered_distance
        )
        self.filtered_lateral = (
            self.alpha_pos * y_meas + (1.0 - self.alpha_pos) * self.filtered_lateral
        )

        # 3. Circular Heading EMA (avoids +-pi wrap-around boundary discontinuity)
        prev_th = self.filtered_heading
        sin_avg = self.alpha_heading * math.sin(th_meas) + (1.0 - self.alpha_heading) * math.sin(prev_th)
        cos_avg = self.alpha_heading * math.cos(th_meas) + (1.0 - self.alpha_heading) * math.cos(prev_th)
        self.filtered_heading = math.atan2(sin_avg, cos_avg)

        self.last_timestamp = curr_time

        return PerceptionOutput(
            timestamp=curr_time,
            station_id=measurement.station_id,
            detected=True,
            distance_m=round(self.filtered_distance, 4),
            lateral_offset_m=round(self.filtered_lateral, 4),
            heading_error_rad=round(self.filtered_heading, 4),
            confidence=measurement.confidence,
            reprojection_error_px=measurement.reprojection_error_px,
        )
