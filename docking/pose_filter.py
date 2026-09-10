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

    BENCHMARK_SPECS = {
        "jitter_variance_reduction_pct": 70.0,
        "alpha_position": 0.70,
        "alpha_heading": 0.65,
        "kinematic_jump_clamping_m": 0.50,
        "angular_boundary_discontinuities": 0,
    }

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

        if (
            not self.initialized
            or self.filtered_distance is None
            or self.filtered_lateral is None
            or self.filtered_heading is None
        ):
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

        curr_dist = self.filtered_distance
        curr_lat = self.filtered_lateral
        curr_th = self.filtered_heading

        # 1. Outlier Rejection (Kinematic feasibility check)
        if abs(d_meas - curr_dist) > self.max_jump_distance:
            # Clamp or reject massive instantaneous jump
            d_meas = curr_dist + math.copysign(
                self.max_jump_distance, d_meas - curr_dist
            )

        if abs(y_meas - curr_lat) > self.max_jump_lateral:
            y_meas = curr_lat + math.copysign(
                self.max_jump_lateral, y_meas - curr_lat
            )

        # 2. Linear Position EMA
        self.filtered_distance = (
            self.alpha_pos * d_meas + (1.0 - self.alpha_pos) * curr_dist
        )
        self.filtered_lateral = (
            self.alpha_pos * y_meas + (1.0 - self.alpha_pos) * curr_lat
        )

        # 3. Circular Heading EMA (avoids +-pi wrap-around boundary discontinuity)
        sin_avg = self.alpha_heading * math.sin(th_meas) + (1.0 - self.alpha_heading) * math.sin(curr_th)
        cos_avg = self.alpha_heading * math.cos(th_meas) + (1.0 - self.alpha_heading) * math.cos(curr_th)
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
