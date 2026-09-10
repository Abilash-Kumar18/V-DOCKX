"""
V-DOCKX Shared Data Contracts
Frozen Interface Specifications for Member 1, Member 2, and Member 3.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, List


class DockingState(str, Enum):
    IDLE = "IDLE"
    LINE_SEARCH = "LINE_SEARCH"
    LINE_FOLLOW = "LINE_FOLLOW"
    STATION_ZONE_APPROACH = "STATION_ZONE_APPROACH"
    DOCKING_TARGET_ACQUIRE = "DOCKING_TARGET_ACQUIRE"
    FINE_ALIGN = "FINE_ALIGN"
    FINAL_APPROACH = "FINAL_APPROACH"
    VERIFY = "VERIFY"
    DOCKED = "DOCKED"
    OBSTACLE_STOP = "OBSTACLE_STOP"
    LINE_LOST = "LINE_LOST"
    TARGET_LOST = "TARGET_LOST"
    SENSOR_FAULT_STOP = "SENSOR_FAULT_STOP"
    RECOVERY = "RECOVERY"
    FAILED = "FAILED"


@dataclass
class PerceptionOutput:
    """Output from AprilTag/ArUco 6-DoF fiducial pose estimator."""
    timestamp: float = 0.0
    station_id: int = 0
    detected: bool = False
    distance_m: float = 999.0          # e_d: Forward distance to docking plane
    lateral_offset_m: float = 0.0      # e_y: Lateral error (+ right, - left)
    heading_error_rad: float = 0.0     # e_theta: Relative heading error in radians
    confidence: float = 0.0            # 0.0 to 1.0 based on detection quality
    reprojection_error_px: float = 0.0 # Error from PnP solver


@dataclass
class LineDetectionOutput:
    """Output from camera-based floor line detector."""
    timestamp: float = 0.0
    detected: bool = False
    centroid_error_norm: float = 0.0   # e_c: Normalized offset [-1.0, 1.0] from center
    angle_error_rad: float = 0.0       # e_a: Orientation angle relative to path vertical
    confidence: float = 0.0            # 0.0 to 1.0
    annotated_frame: Any = None        # Optional debug visual overlay frame


@dataclass
class ObstacleOutput:
    """Output from dual-layer safety supervisor (AI + geometric corridor)."""
    timestamp: float = 0.0
    obstacle_present: bool = False
    corridor_blocked: bool = False     # True if obstacle is inside robot's safety corridor
    minimum_distance_m: float = 999.0  # Estimated distance to nearest hazard
    detected_classes: List[str] = field(default_factory=list)
    confidence: float = 0.0


@dataclass
class ControlCommand:
    """Velocity command dispatched to robot base or simulator."""
    timestamp: float = 0.0
    linear_velocity_mps: float = 0.0   # Forward velocity in m/s
    angular_velocity_rps: float = 0.0  # Angular velocity in rad/s (+ CCW / left turn)
    reason: str = ""                   # Diagnostic explanation for telemetry


@dataclass
class DockingResult:
    """Final summary outcome of a docking mission."""
    status: str = "PENDING"            # SUCCESS | VISUALLY_ALIGNED | FAILED | ABORTED
    duration_s: float = 0.0
    attempts: int = 1
    final_distance_m: float = 0.0
    final_lateral_error_m: float = 0.0
    final_heading_error_rad: float = 0.0
    obstacle_stops: int = 0
    failure_reason: str = ""
