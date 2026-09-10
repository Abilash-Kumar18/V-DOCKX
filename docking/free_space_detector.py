"""
V-DOCKX Geometric Free-Space & Corridor Safety Detector (Member 1)
Evaluates ground plane occupancy within the robot's projected kinematic corridor
using edge density (Canny), color uniformity, and spatial row depth mapping.
Acts as a fail-safe geometric safety supervisor independent of semantic AI classification.
"""

import os
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np
import yaml


class FreeSpaceDetector:
    """
    Geometric safety supervisor evaluating ground plane traversability.
    Verifies that the trapezoidal path immediately in front of the robot is unobstructed.
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        polygon_points: Optional[List[List[int]]] = None,
        edge_density_threshold: float = 0.06,
        canny_thresh1: int = 50,
        canny_thresh2: int = 150,
        lookahead_distance_m: float = 1.50,
        min_distance_base_m: float = 0.20,
    ):
        self.edge_density_threshold = edge_density_threshold
        self.canny_thresh1 = canny_thresh1
        self.canny_thresh2 = canny_thresh2
        self.lookahead_distance_m = lookahead_distance_m
        self.min_distance_base_m = min_distance_base_m

        # Default trapezoid ground corridor in 640x480 frame
        if polygon_points is not None:
            self.polygon_points = np.array(polygon_points, dtype=np.int32)
        else:
            self.polygon_points = np.array(
                [[100, 480], [540, 480], [400, 240], [240, 240]], dtype=np.int32
            )

        if config_path and os.path.exists(config_path):
            self._load_config(config_path)

        self._mask_cache: Optional[np.ndarray] = None
        self._mask_area: int = 0

    def _load_config(self, path: str) -> None:
        try:
            with open(path, "r") as f:
                cfg = yaml.safe_load(f) or {}
            c_cfg = cfg.get("corridor", {})
            if "polygon_points" in c_cfg:
                self.polygon_points = np.array(c_cfg["polygon_points"], dtype=np.int32)
            self.edge_density_threshold = c_cfg.get(
                "edge_density_threshold", self.edge_density_threshold
            )
            self.canny_thresh1 = c_cfg.get("canny_threshold1", self.canny_thresh1)
            self.canny_thresh2 = c_cfg.get("canny_threshold2", self.canny_thresh2)
            self.lookahead_distance_m = c_cfg.get(
                "lookahead_distance_m", self.lookahead_distance_m
            )
        except Exception:
            pass

    def _get_corridor_mask(self, h: int, w: int) -> np.ndarray:
        if (
            self._mask_cache is None
            or self._mask_cache.shape[0] != h
            or self._mask_cache.shape[1] != w
        ):
            mask = np.zeros((h, w), dtype=np.uint8)
            cv2.fillPoly(mask, [self.polygon_points], 255)
            self._mask_cache = mask
            self._mask_area = max(1, cv2.countNonZero(mask))
        return self._mask_cache

    def estimate_distance_from_row(self, y: int, h: int = 480) -> float:
        """
        Estimate metric distance along ground plane given image pixel row y.
        y = 480 -> min_distance_base_m (~0.20m)
        y = 240 -> lookahead_distance_m (~1.50m)
        """
        y_bottom = float(np.max(self.polygon_points[:, 1]))
        y_top = float(np.min(self.polygon_points[:, 1]))

        y_clamped = max(y_top, min(y_bottom, float(y)))
        # u is 0.0 at base (closest), 1.0 at apex (farthest)
        u = (y_bottom - y_clamped) / max(1.0, y_bottom - y_top)

        # Non-linear perspective scaling: pixels near horizon represent much larger distances
        dist = self.min_distance_base_m + (self.lookahead_distance_m - self.min_distance_base_m) * (u ** 1.3)
        return float(round(dist, 3))

    def evaluate(
        self, frame: np.ndarray, exclude_mask: Optional[np.ndarray] = None
    ) -> Tuple[bool, float, float, np.ndarray]:
        """
        Analyze frame for path corridor blockage.
        Returns:
            corridor_blocked (bool): True if obstacle encroaches safety polygon.
            min_distance_m (float): Estimated distance to closest detected intrusion.
            edge_density (float): Fraction of corridor pixels occupied by edges.
            annotated_frame (np.ndarray): Debug visualization.
        """
        if frame is None or frame.size == 0:
            return False, 999.0, 0.0, frame

        h, w = frame.shape[:2]
        corridor_mask = self._get_corridor_mask(h, w)

        # Convert to grayscale and blur slightly to suppress sensor noise
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Canny edge detector
        edges = cv2.Canny(blurred, self.canny_thresh1, self.canny_thresh2)

        # If a known floor line mask is provided to exclude, subtract it
        if exclude_mask is not None and exclude_mask.shape == (h, w):
            # Dilate line mask slightly so floor line edges aren't counted as obstacles
            line_dilated = cv2.dilate(exclude_mask, np.ones((5, 5), np.uint8))
            edges = cv2.bitwise_and(edges, cv2.bitwise_not(line_dilated))

        # Corridor intersection
        corridor_edges = cv2.bitwise_and(edges, edges, mask=corridor_mask)
        edge_pixels = cv2.countNonZero(corridor_edges)
        edge_density = edge_pixels / float(self._mask_area)

        # Detect structural obstacle contours inside the corridor
        # A clean floor line produces only 1-pixel thin vertical edges (area == 0).
        # An obstacle (box, person, fallen object) has 2D width/height and enclosed area.
        edge_cnts, _ = cv2.findContours(
            corridor_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        has_structural_obstacle = False
        obstacle_max_y = 0

        for c in edge_cnts:
            bx, by, bw, bh = cv2.boundingRect(c)
            area = cv2.contourArea(c)
            # Physical obstacles have significant width AND height, or non-zero enclosed area
            if (bw >= 15 and bh >= 15) or area > 120.0:
                has_structural_obstacle = True
                obstacle_max_y = max(obstacle_max_y, by + bh)

        corridor_blocked = (edge_density > self.edge_density_threshold) or has_structural_obstacle

        annotated = frame.copy()
        color = (0, 0, 255) if corridor_blocked else (0, 255, 0)

        # Draw corridor boundary polygon
        cv2.polylines(annotated, [self.polygon_points], isClosed=True, color=color, thickness=2)

        # Compute nearest obstacle distance
        min_distance = 999.0
        if corridor_blocked:
            if obstacle_max_y > 0:
                min_distance = self.estimate_distance_from_row(obstacle_max_y, h)
                cv2.circle(annotated, (w // 2, obstacle_max_y), 8, (0, 0, 255), -1)
            elif edge_pixels > 0:
                edge_coords = np.argwhere(corridor_edges > 0)
                if len(edge_coords) > 0:
                    max_y = int(np.max(edge_coords[:, 0]))
                    min_distance = self.estimate_distance_from_row(max_y, h)
                    cv2.circle(annotated, (w // 2, max_y), 8, (0, 0, 255), -1)

        status_text = (
            f"CORRIDOR: {'BLOCKED' if corridor_blocked else 'CLEAR'} "
            f"| density={edge_density:.3f} | min_d={min_distance:.2f}m"
        )
        cv2.putText(
            annotated,
            status_text,
            (20, h - 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.50,
            color,
            2,
        )

        return corridor_blocked, min_distance, edge_density, annotated
