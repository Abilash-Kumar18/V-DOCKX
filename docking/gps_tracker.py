"""
V-DOCKX GPS and Geodesic Relative Path Tracker
Transforms real-world GPS coordinates (WGS84 Lat/Lng) between the Laptop Dock and
the Mobile Phone Robot into relative local metric coordinates (meters), distance,
and bearing angles for autonomous docking.
"""

import math
from typing import Dict, Any, Tuple, Optional


class GPSTracker:
    """
    Tracks real-time phone GPS location relative to the laptop charging station anchor.
    Uses equirectangular / haversine projection for millimeter-to-meter accuracy.
    """

    EARTH_RADIUS_M = 6371000.0

    def __init__(
        self,
        dock_lat: float = 42.3601,
        dock_lng: float = -71.0589,
        arena_width_m: float = 2.0,
        arena_height_m: float = 2.0,
    ):
        self.dock_lat = dock_lat
        self.dock_lng = dock_lng
        self.arena_width_m = arena_width_m
        self.arena_height_m = arena_height_m

        # Fixed charging station coordinate in the 2D arena map (meters)
        self.dock_arena_x = 1.00
        self.dock_arena_y = 0.35

        self.last_phone_gps: Optional[Dict[str, Any]] = None
        self.last_relative_pose: Optional[Dict[str, Any]] = None

    def set_dock_anchor(self, lat: float, lng: float) -> None:
        """Sets the fixed charging station GPS coordinates (from the laptop)."""
        self.dock_lat = lat
        self.dock_lng = lng

    def compute_relative_pose(
        self,
        phone_lat: float,
        phone_lng: float,
        compass_heading: float = 0.0,
        accuracy_m: Optional[float] = None,
    ) -> Dict[str, Any]:
        lat_rad = math.radians(self.dock_lat)
        d_lat_rad = math.radians(phone_lat - self.dock_lat)
        d_lng_rad = math.radians(phone_lng - self.dock_lng)

        # Delta in meters: dy is North-South, dx is East-West
        dy_m = d_lat_rad * self.EARTH_RADIUS_M
        dx_m = d_lng_rad * self.EARTH_RADIUS_M * math.cos(lat_rad)

        distance_m = math.sqrt(dx_m**2 + dy_m**2)

        to_dock_dx = -dx_m
        to_dock_dy = -dy_m
        bearing_to_dock_deg = (math.degrees(math.atan2(to_dock_dx, to_dock_dy)) + 360.0) % 360.0

        heading_error_deg = ((bearing_to_dock_deg - compass_heading + 180.0) % 360.0) - 180.0

        arena_x = max(0.15, min(1.85, self.dock_arena_x + dx_m * 0.5))
        arena_y = max(0.38, min(1.85, self.dock_arena_y + dy_m * 0.5))

        pose_result = {
            "phone_lat": phone_lat,
            "phone_lng": phone_lng,
            "dock_lat": self.dock_lat,
            "dock_lng": self.dock_lng,
            "dx_meters": round(dx_m, 3),
            "dy_meters": round(dy_m, 3),
            "distance_to_dock_m": round(distance_m, 3),
            "bearing_to_dock_deg": round(bearing_to_dock_deg, 1),
            "compass_heading_deg": round(compass_heading, 1),
            "heading_error_deg": round(heading_error_deg, 1),
            "arena_x": round(arena_x, 3),
            "arena_y": round(arena_y, 3),
            "accuracy_m": accuracy_m,
            "is_aligned": abs(heading_error_deg) < 10.0,
        }

        self.last_phone_gps = {
            "lat": phone_lat,
            "lng": phone_lng,
            "accuracy": accuracy_m,
        }
        self.last_relative_pose = pose_result
        return pose_result
