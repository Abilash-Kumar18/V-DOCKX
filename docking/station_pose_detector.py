"""
V-DOCKX ArUco / AprilTag 6-DoF Station Pose Detector (Member 1)
Identifies docking fiducial markers, refines corners with sub-pixel precision,
and solves Perspective-n-Point (PnP) to compute metric distance (e_d),
lateral displacement (e_y), relative heading (e_theta), and reprojection error.
"""

import math
import os
import time
from typing import Any, Dict, List, Optional, Tuple
import cv2  # type: ignore
import numpy as np  # type: ignore
import yaml

from docking.contracts import PerceptionOutput


class StationPoseDetector:
    """
    6-DoF Station Fiducial Pose Estimator.
    Emits PerceptionOutput conforming strictly to frozen V-DOCKX data contract.
    """

    BENCHMARK_SPECS = {
        "forward_distance_accuracy_m": 0.02,   # ±2.0 cm at 1.0m
        "terminal_distance_accuracy_m": 0.005, # ±0.5 cm inside deceleration zone (<0.35m)
        "lateral_crosstrack_accuracy_m": 0.005, # ±0.5 cm across operating corridor
        "heading_yaw_error_deg": 2.5,          # ±2.5 deg (~0.04 rad)
        "corner_subpixel_precision_px": [0.1, 0.3], # Window size 5x5, eps=0.01
        "max_reprojection_error_px": 0.8,      # Average PnP solver back-projection
        "solver": "SOLVEPNP_IPPE_SQUARE",
    }

    def __init__(
        self,
        config_path: Optional[str] = None,
        target_station_id: int = 0,
        marker_size_m: float = 0.12,
        dictionary_id: int = cv2.aruco.DICT_4X4_50,
        camera_matrix: Optional[np.ndarray] = None,
        dist_coeffs: Optional[np.ndarray] = None,
        max_dropout_frames: int = 10,
    ):
        self.target_station_id = target_station_id
        self.marker_size_m = marker_size_m
        self.max_dropout_frames = max_dropout_frames

        # Camera Intrinsics
        if camera_matrix is not None:
            self.camera_matrix = camera_matrix
        else:
            self.camera_matrix = np.array(
                [[650.0, 0.0, 320.0], [0.0, 650.0, 240.0], [0.0, 0.0, 1.0]],
                dtype=np.float64,
            )

        if dist_coeffs is not None:
            self.dist_coeffs = dist_coeffs
        else:
            self.dist_coeffs = np.zeros((5, 1), dtype=np.float64)

        if config_path and os.path.exists(config_path):
            self._load_config(config_path)

        # ArUco Dictionary and Detector Parameters
        self.dictionary = cv2.aruco.getPredefinedDictionary(dictionary_id)
        self.parameters = cv2.aruco.DetectorParameters()
        self.parameters.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX

        # Support OpenCV 4.8+ ArucoDetector if present
        if hasattr(cv2.aruco, "ArucoDetector"):
            self.aruco_detector = cv2.aruco.ArucoDetector(self.dictionary, self.parameters)
        else:
            self.aruco_detector = None

        # Predefined 3D marker coordinate model (planar square centered at origin)
        half = self.marker_size_m / 2.0
        self.object_points = np.array(
            [
                [-half, half, 0.0],   # Top-Left
                [half, half, 0.0],    # Top-Right
                [half, -half, 0.0],   # Bottom-Right
                [-half, -half, 0.0],  # Bottom-Left
            ],
            dtype=np.float64,
        )

        # Sub-pixel corner criteria
        self.subpix_criteria = (
            cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER,
            30,
            0.01,
        )

        # Tracking state
        self.consecutive_lost_frames = 0
        self.last_valid_output: Optional[PerceptionOutput] = None

    def _load_config(self, path: str) -> None:
        """Load parameters from YAML config."""
        try:
            with open(path, "r") as f:
                cfg = yaml.safe_load(f) or {}

            # Check for camera intrinsics in line/docking config
            cam_cfg = cfg.get("camera", {})
            if cam_cfg:
                fx = cam_cfg.get("fx", self.camera_matrix[0, 0])
                fy = cam_cfg.get("fy", self.camera_matrix[1, 1])
                cx = cam_cfg.get("cx", self.camera_matrix[0, 2])
                cy = cam_cfg.get("cy", self.camera_matrix[1, 2])
                dist = cam_cfg.get("dist_coeffs", [0.0, 0.0, 0.0, 0.0, 0.0])
                self.camera_matrix = np.array(
                    [[fx, 0.0, cx], [0.0, fy, cy], [0.0, 0.0, 1.0]], dtype=np.float64
                )
                self.dist_coeffs = np.array(dist, dtype=np.float64)

            station_cfg = cfg.get("station", {})
            if station_cfg:
                self.target_station_id = station_cfg.get(
                    "target_station_id", self.target_station_id
                )
                self.marker_size_m = station_cfg.get(
                    "marker_size_m", self.marker_size_m
                )
        except Exception:
            pass

    def reset(self) -> None:
        """Reset tracking history."""
        self.consecutive_lost_frames = 0
        self.last_valid_output = None

    def detect(
        self, frame: np.ndarray, current_time: Optional[float] = None
    ) -> PerceptionOutput:
        """
        Detect target ArUco marker in frame and compute 6-DoF pose.
        """
        now = current_time if current_time is not None else time.time()

        if frame is None or frame.size == 0:
            return self._handle_lost(now)

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # 1. Detect fiducials
        if self.aruco_detector is not None:
            corners, ids, rejected = self.aruco_detector.detectMarkers(gray)
        else:
            corners, ids, rejected = cv2.aruco.detectMarkers(
                gray, self.dictionary, parameters=self.parameters
            )

        if ids is None or len(ids) == 0:
            return self._handle_lost(now)

        # 2. Filter for target station ID
        ids_flat = ids.flatten()
        target_idx = None
        for i, m_id in enumerate(ids_flat):
            if m_id == self.target_station_id:
                target_idx = i
                break

        if target_idx is None:
            # Only foreign markers detected
            return self._handle_lost(now)

        # 3. Sub-pixel refinement on detected corners
        marker_corners = corners[target_idx][0]
        refined_corners = cv2.cornerSubPix(
            gray,
            marker_corners.astype(np.float32),
            winSize=(5, 5),
            zeroZone=(-1, -1),
            criteria=self.subpix_criteria,
        )

        # 4. Perspective-n-Point (PnP) solver
        success, rvec, tvec = cv2.solvePnP(
            self.object_points,
            refined_corners,
            self.camera_matrix,
            self.dist_coeffs,
            flags=cv2.SOLVEPNP_IPPE_SQUARE,
        )

        if not success:
            return self._handle_lost(now)

        # 5. Extract Metric Position and Orientation
        # In camera coordinates:
        # X: + right, - left
        # Y: + down, - up
        # Z: forward along optical axis
        e_y = float(tvec[0][0])
        e_d = float(tvec[2][0])

        # Rotation matrix from Rodrigues vector
        R, _ = cv2.Rodrigues(rvec)
        # Relative yaw around camera vertical Y-axis:
        # For a marker facing the camera, R_face = diag(1, -1, -1)
        # R[0, 2] = -sin(theta), R[2, 2] = -cos(theta)
        e_theta = math.atan2(-R[0, 2], -R[2, 2])

        # 6. Compute Reprojection Error
        projected_pts, _ = cv2.projectPoints(
            self.object_points, rvec, tvec, self.camera_matrix, self.dist_coeffs
        )
        projected_pts = projected_pts.reshape(-1, 2)
        reprojection_error_px = float(
            np.mean(np.linalg.norm(refined_corners - projected_pts, axis=1))
        )

        # 7. Confidence Calculation
        # Quality drops if reprojection error is large or marker is tiny
        marker_area = cv2.contourArea(refined_corners.astype(np.float32))
        err_quality = max(0.0, min(1.0, 1.0 - (reprojection_error_px / 4.0)))
        area_quality = min(1.0, marker_area / 1200.0)
        confidence = float(np.clip(0.7 * err_quality + 0.3 * area_quality, 0.1, 1.0))

        # Reset lost counter
        self.consecutive_lost_frames = 0

        output = PerceptionOutput(
            timestamp=now,
            station_id=self.target_station_id,
            detected=True,
            distance_m=round(e_d, 4),
            lateral_offset_m=round(e_y, 4),
            heading_error_rad=round(e_theta, 4),
            confidence=round(confidence, 3),
            reprojection_error_px=round(reprojection_error_px, 3),
        )

        self.last_valid_output = output
        return output

    def _handle_lost(self, now: float) -> PerceptionOutput:
        """
        Handle missing target frames with temporal extrapolation assistance.
        """
        self.consecutive_lost_frames += 1

        if (
            self.last_valid_output is not None
            and self.consecutive_lost_frames < self.max_dropout_frames
        ):
            # Extrapolated estimate: decay confidence slightly
            decayed_conf = max(
                0.1, self.last_valid_output.confidence * (1.0 - 0.08 * self.consecutive_lost_frames)
            )
            return PerceptionOutput(
                timestamp=now,
                station_id=self.target_station_id,
                detected=False,  # Signal missing to state machine while preserving last direction
                distance_m=self.last_valid_output.distance_m,
                lateral_offset_m=self.last_valid_output.lateral_offset_m,
                heading_error_rad=self.last_valid_output.heading_error_rad,
                confidence=round(decayed_conf, 3),
                reprojection_error_px=self.last_valid_output.reprojection_error_px,
            )

        return PerceptionOutput(
            timestamp=now,
            station_id=self.target_station_id,
            detected=False,
            distance_m=999.0,
            lateral_offset_m=0.0,
            heading_error_rad=0.0,
            confidence=0.0,
            reprojection_error_px=0.0,
        )
