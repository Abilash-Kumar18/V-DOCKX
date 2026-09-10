"""
V-DOCKX Obstacle & Safety Fusion Supervisor (Member 1)
Integrates geometric free-space corridor occupancy with semantic AI detections.
Produces unified ObstacleOutput strictly complying with frozen data contract.
"""

import os
import time
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np
import yaml

from docking.contracts import ObstacleOutput
from docking.free_space_detector import FreeSpaceDetector
from docking.obstacle_ai import AIObstacleDetector


class ObstacleFusionSupervisor:
    """
    Dual-layer safety fusion supervisor.
    Combines fail-safe geometric corridor check with AI object classification.
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        free_space_detector: Optional[FreeSpaceDetector] = None,
        ai_detector: Optional[AIObstacleDetector] = None,
        stop_distance_m: float = 0.40,
        warning_distance_m: float = 0.80,
    ):
        self.config_path = config_path
        self.stop_distance_m = stop_distance_m
        self.warning_distance_m = warning_distance_m

        if free_space_detector is not None:
            self.free_space_detector = free_space_detector
        else:
            self.free_space_detector = FreeSpaceDetector(config_path=config_path)

        if ai_detector is not None:
            self.ai_detector = ai_detector
        else:
            self.ai_detector = AIObstacleDetector(config_path=config_path)

        if config_path and os.path.exists(config_path):
            self._load_config(config_path)

    def _load_config(self, path: str) -> None:
        try:
            with open(path, "r") as f:
                cfg = yaml.safe_load(f) or {}
            f_cfg = cfg.get("fusion", {})
            self.stop_distance_m = f_cfg.get("stop_distance_m", self.stop_distance_m)
            self.warning_distance_m = f_cfg.get("warning_distance_m", self.warning_distance_m)
        except Exception:
            pass

    def evaluate(
        self,
        frame: np.ndarray,
        exclude_line_mask: Optional[np.ndarray] = None,
        current_time: Optional[float] = None,
    ) -> Tuple[ObstacleOutput, np.ndarray]:
        """
        Evaluate full frame through dual-layer safety supervisor.
        Returns:
            ObstacleOutput: Frozen DTO for state machine and safety gate.
            annotated_frame: Debug visualization with safety corridor and detections.
        """
        now = current_time if current_time is not None else time.time()

        if frame is None or frame.size == 0:
            return (
                ObstacleOutput(
                    timestamp=now,
                    obstacle_present=False,
                    corridor_blocked=False,
                    minimum_distance_m=999.0,
                    detected_classes=[],
                    confidence=0.0,
                ),
                frame,
            )

        # -------------------------------------------------------------
        # 1. LAYER 1: Geometric Free-Space Corridor Analysis
        # -------------------------------------------------------------
        geom_blocked, geom_dist, edge_density, annotated = self.free_space_detector.evaluate(
            frame, exclude_mask=exclude_line_mask
        )

        # -------------------------------------------------------------
        # 2. LAYER 2: Semantic AI Object Detections
        # -------------------------------------------------------------
        ai_detections = self.ai_detector.detect(frame)

        corridor_poly = self.free_space_detector.polygon_points
        corridor_blocked = geom_blocked
        min_distance = geom_dist if geom_blocked else 999.0
        detected_classes: List[str] = []
        confidences: List[float] = []

        obstacle_present = len(ai_detections) > 0 or geom_blocked

        # Test each AI detection against the geometric corridor polygon
        for det in ai_detections:
            cls_name = det["class"]
            conf = det["confidence"]
            x1, y1, x2, y2 = det["bbox"]

            detected_classes.append(cls_name)
            confidences.append(conf)

            # Ground footprint test: bottom center of bounding box
            footprint_x = (x1 + x2) // 2
            footprint_y = y2

            # Point-in-polygon test: >= 0 means inside or on boundary
            inside_corridor = cv2.pointPolygonTest(
                corridor_poly, (float(footprint_x), float(footprint_y)), False
            ) >= 0

            # Distance estimate from footprint row
            det_dist = self.free_space_detector.estimate_distance_from_row(
                footprint_y, frame.shape[0]
            )

            # Draw AI bounding box
            box_color = (0, 0, 255) if inside_corridor else (255, 180, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), box_color, 2)
            label = f"{cls_name}: {conf:.2f} ({det_dist:.2f}m)"
            cv2.putText(
                annotated,
                label,
                (x1, max(20, y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                box_color,
                2,
            )

            if inside_corridor:
                corridor_blocked = True
                min_distance = min(min_distance, det_dist)

        # Calculate composite confidence
        if confidences:
            fusion_conf = float(np.mean(confidences))
        elif geom_blocked:
            fusion_conf = float(min(1.0, 0.5 + edge_density * 5.0))
        else:
            fusion_conf = 1.0  # High confidence that corridor is clear

        output = ObstacleOutput(
            timestamp=now,
            obstacle_present=obstacle_present,
            corridor_blocked=corridor_blocked,
            minimum_distance_m=round(min_distance, 3),
            detected_classes=list(set(detected_classes)),
            confidence=round(fusion_conf, 3),
        )

        return output, annotated
