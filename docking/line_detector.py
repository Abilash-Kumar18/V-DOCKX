"""
V-DOCKX Floor Line Detector (Member 1)
Extracts path guide line using ground ROI cropping, CLAHE illumination normalization,
HSV color filtering, morphological refinement, and spatial moments.
Computes normalized centroid offset (e_c) and heading angle error (e_a).
"""

import math
import os
import time
from typing import Any, Dict, Optional, Tuple
import cv2  # type: ignore
import numpy as np  # type: ignore
import yaml

from docking.contracts import LineDetectionOutput


class LineDetector:
    """
    Ground floor path line detector for mobile robot navigation.
    Outputs normalized tracking errors adhering to frozen LineDetectionOutput contract.
    """

    BENCHMARK_SPECS = {
        "centroid_offset_error_norm": 0.02,         # ±0.02 (±6.4 pixels in 640px)
        "path_heading_angle_error_deg": 1.7,        # ±1.7 deg (±0.03 rad)
        "lighting_invariance_detection_rate_pct": 98.5, # Under 50% dimming & glare
        "color_space": "LAB (CLAHE L-channel) + HSV thresholding",
    }

    def __init__(
        self,
        config_path: Optional[str] = None,
        crop_top_ratio: float = 0.50,
        crop_bottom_ratio: float = 1.00,
        min_contour_area: float = 300.0,
        max_contour_area: float = 60000.0,
        clahe_clip_limit: float = 2.0,
    ):
        self.crop_top_ratio = crop_top_ratio
        self.crop_bottom_ratio = crop_bottom_ratio
        self.min_contour_area = min_contour_area
        self.max_contour_area = max_contour_area
        self.clahe_clip_limit = clahe_clip_limit

        # Default HSV ranges for yellow path line
        self.hsv_yellow_lower = np.array([15, 70, 70], dtype=np.uint8)
        self.hsv_yellow_upper = np.array([38, 255, 255], dtype=np.uint8)

        # Secondary HSV range for high-contrast white path line
        self.hsv_white_lower = np.array([0, 0, 225], dtype=np.uint8)
        self.hsv_white_upper = np.array([180, 35, 255], dtype=np.uint8)

        self.morph_kernel_size = 5

        if config_path and os.path.exists(config_path):
            self._load_config(config_path)

        self.clahe = cv2.createCLAHE(
            clipLimit=self.clahe_clip_limit, tileGridSize=(8, 8)
        )
        self.kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, (self.morph_kernel_size, self.morph_kernel_size)
        )

    def _load_config(self, path: str) -> None:
        """Load parameters from YAML config."""
        try:
            with open(path, "r") as f:
                cfg = yaml.safe_load(f) or {}
            line_cfg = cfg.get("line_detection", {})
            self.crop_top_ratio = line_cfg.get("crop_top_ratio", self.crop_top_ratio)
            self.crop_bottom_ratio = line_cfg.get("crop_bottom_ratio", self.crop_bottom_ratio)
            self.min_contour_area = line_cfg.get("min_contour_area", self.min_contour_area)
            self.max_contour_area = line_cfg.get("max_contour_area", self.max_contour_area)
            self.clahe_clip_limit = line_cfg.get("clahe_clip_limit", self.clahe_clip_limit)

            if "hsv_yellow_lower" in line_cfg:
                self.hsv_yellow_lower = np.array(line_cfg["hsv_yellow_lower"], dtype=np.uint8)
            if "hsv_yellow_upper" in line_cfg:
                self.hsv_yellow_upper = np.array(line_cfg["hsv_yellow_upper"], dtype=np.uint8)
            if "hsv_white_lower" in line_cfg:
                self.hsv_white_lower = np.array(line_cfg["hsv_white_lower"], dtype=np.uint8)
            if "hsv_white_upper" in line_cfg:
                self.hsv_white_upper = np.array(line_cfg["hsv_white_upper"], dtype=np.uint8)
            if "morph_kernel_size" in line_cfg:
                self.morph_kernel_size = line_cfg["morph_kernel_size"]
        except Exception:
            pass

    def preprocess(self, bgr_roi: np.ndarray) -> np.ndarray:
        """
        Apply CLAHE illumination normalization and multi-color HSV thresholding.
        Returns cleaned binary mask.
        """
        # 1. CLAHE in LAB color space (luminance channel)
        lab = cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l_equalized = self.clahe.apply(l)
        lab_normalized = cv2.merge([l_equalized, a, b])
        bgr_normalized = cv2.cvtColor(lab_normalized, cv2.COLOR_LAB2BGR)

        # 2. Convert to HSV
        hsv = cv2.cvtColor(bgr_normalized, cv2.COLOR_BGR2HSV)

        # 3. Create color mask (combining yellow and bright white cues)
        mask_yellow = cv2.inRange(hsv, self.hsv_yellow_lower, self.hsv_yellow_upper)
        mask_white = cv2.inRange(hsv, self.hsv_white_lower, self.hsv_white_upper)
        combined_mask = cv2.bitwise_or(mask_yellow, mask_white)

        # 4. Morphological noise cleanup (open removes salt speckles, close connects line gaps)
        opened = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, self.kernel, iterations=1)
        closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, self.kernel, iterations=2)

        return closed

    def detect(self, frame: np.ndarray) -> LineDetectionOutput:
        """
        Process a full BGR camera frame and extract floor line parameters.
        """
        timestamp = time.time()
        if frame is None or frame.size == 0:
            return LineDetectionOutput(
                timestamp=timestamp,
                detected=False,
                centroid_error_norm=0.0,
                angle_error_rad=0.0,
                confidence=0.0,
                annotated_frame=None,
            )

        h, w = frame.shape[:2]
        y_start = int(h * self.crop_top_ratio)
        y_end = int(h * self.crop_bottom_ratio)

        roi = frame[y_start:y_end, :]
        roi_h, roi_w = roi.shape[:2]

        binary_mask = self.preprocess(roi)

        # Find contours
        contours, _ = cv2.findContours(
            binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        annotated = frame.copy()
        # Draw ROI guideline (cyan box)
        cv2.rectangle(annotated, (0, y_start), (w - 1, y_end - 1), (255, 255, 0), 1)
        # Center reference vertical line (blue)
        cv2.line(annotated, (w // 2, y_start), (w // 2, y_end), (255, 100, 0), 1)

        valid_contours = [
            c for c in contours
            if self.min_contour_area <= cv2.contourArea(c) <= self.max_contour_area
        ]

        if not valid_contours:
            cv2.putText(
                annotated,
                "LINE: LOST",
                (20, y_start - 10 if y_start > 30 else 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 255),
                2,
            )
            return LineDetectionOutput(
                timestamp=timestamp,
                detected=False,
                centroid_error_norm=0.0,
                angle_error_rad=0.0,
                confidence=0.0,
                annotated_frame=annotated,
            )

        # Select primary continuous path contour
        primary_cnt = max(valid_contours, key=cv2.contourArea)
        area = cv2.contourArea(primary_cnt)

        # 1. Centroid calculation via moments
        m = cv2.moments(primary_cnt)
        if m["m00"] == 0:
            return LineDetectionOutput(
                timestamp=timestamp,
                detected=False,
                centroid_error_norm=0.0,
                angle_error_rad=0.0,
                confidence=0.0,
                annotated_frame=annotated,
            )

        cx_roi = m["m10"] / m["m00"]
        cy_roi = m["m01"] / m["m00"]

        # Normalized centroid error: -1.0 (far left) to +1.0 (far right)
        half_w = roi_w / 2.0
        e_c = (cx_roi - half_w) / half_w
        e_c = float(np.clip(e_c, -1.0, 1.0))

        # 2. Heading Angle Calculation
        # Compute sub-moments across top half and bottom half of the ROI
        half_roi_h = roi_h // 2
        top_mask = binary_mask[:half_roi_h, :]
        bot_mask = binary_mask[half_roi_h:, :]

        m_top = cv2.moments(top_mask)
        m_bot = cv2.moments(bot_mask)

        if m_top["m00"] > 50 and m_bot["m00"] > 50:
            cx_top = m_top["m10"] / m_top["m00"]
            cy_top = m_top["m01"] / m_top["m00"]
            cx_bot = m_bot["m10"] / m_bot["m00"]
            cy_bot = (m_bot["m01"] / m_bot["m00"]) + half_roi_h

            dx = cx_top - cx_bot
            dy = cy_bot - cy_top  # dy > 0 points forward along camera lookahead
            e_a = math.atan2(dx, dy)
        else:
            # Fallback to PCA / fitLine on primary contour points
            line_params = cv2.fitLine(primary_cnt, cv2.DIST_L2, 0, 0.01, 0.01)
            # cv2.fitLine returns shape (4, 1) or list of arrays; extract scalar items
            vx = float(line_params[0].item() if hasattr(line_params[0], "item") else line_params[0])
            vy = float(line_params[1].item() if hasattr(line_params[1], "item") else line_params[1])
            if vy < 0:
                vx, vy = -vx, -vy
            e_a = math.atan2(vx, vy)

        e_a = float(np.clip(e_a, -math.pi / 2.0, math.pi / 2.0))

        # 3. Confidence metric [0.0, 1.0]
        # Evaluated from contour area, aspect ratio continuity, and solidity
        hull = cv2.convexHull(primary_cnt)
        hull_area = cv2.contourArea(hull)
        solidity = area / hull_area if hull_area > 0 else 0.5
        expected_nominal_area = (roi_h * 20.0)  # ~20px nominal line width
        area_score = min(1.0, area / max(expected_nominal_area, 1.0))
        confidence = float(np.clip(0.6 * area_score + 0.4 * solidity, 0.1, 1.0))

        # 4. Draw annotations
        # Offset contour back into full frame coordinates
        shifted_cnt = primary_cnt.copy()
        shifted_cnt[:, :, 1] += y_start
        cv2.drawContours(annotated, [shifted_cnt], -1, (0, 255, 0), 2)

        # Centroid circle in frame space
        cx_full = int(cx_roi)
        cy_full = int(cy_roi + y_start)
        cv2.circle(annotated, (cx_full, cy_full), 6, (0, 0, 255), -1)

        # Steering direction vector indicator
        arrow_len = 50
        arrow_end_x = int(cx_full + arrow_len * math.sin(e_a))
        arrow_end_y = int(cy_full - arrow_len * math.cos(e_a))
        cv2.arrowedLine(
            annotated, (cx_full, cy_full), (arrow_end_x, arrow_end_y), (0, 255, 255), 2
        )

        # Readout text
        label = f"LINE: DETECTED | e_c={e_c:+.2f} | e_a={math.degrees(e_a):+.1f} deg | conf={confidence:.2f}"
        cv2.putText(
            annotated,
            label,
            (20, y_start - 10 if y_start > 30 else 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.50,
            (0, 255, 0),
            2,
        )

        return LineDetectionOutput(
            timestamp=timestamp,
            detected=True,
            centroid_error_norm=round(e_c, 4),
            angle_error_rad=round(e_a, 4),
            confidence=round(confidence, 3),
            annotated_frame=annotated,
        )
