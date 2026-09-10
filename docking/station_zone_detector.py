"""
V-DOCKX Station Zone Cue Detector (Member 1)
Identifies transition from open line following to the docking station zone
via wide transverse floor strip detection or fiducial marker arrival.
"""

import os
from typing import Any, Dict, Optional, Tuple
import cv2
import numpy as np
import yaml


class StationZoneDetector:
    """
    Detects the physical or visual cues indicating entry into the docking station bay.
    Triggers station_zone_detected flag consumed by the Hybrid Docking FSM.
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        transverse_aspect_ratio_min: float = 2.8,
        transverse_width_ratio_min: float = 0.45,
        tag_trigger_max_y_ratio: float = 0.65,
        debounce_frames: int = 2,
    ):
        self.transverse_aspect_min = transverse_aspect_ratio_min
        self.transverse_width_ratio_min = transverse_width_ratio_min
        self.tag_trigger_max_y_ratio = tag_trigger_max_y_ratio
        self.debounce_required = debounce_frames

        self.consecutive_detections = 0
        self.latched = False

        if config_path and os.path.exists(config_path):
            self._load_config(config_path)

    def _load_config(self, path: str) -> None:
        try:
            with open(path, "r") as f:
                cfg = yaml.safe_load(f) or {}
            sz_cfg = cfg.get("station_zone", {})
            self.transverse_aspect_min = sz_cfg.get(
                "transverse_bar_aspect_ratio_min", self.transverse_aspect_min
            )
            self.transverse_width_ratio_min = sz_cfg.get(
                "transverse_bar_width_ratio_min", self.transverse_width_ratio_min
            )
            self.tag_trigger_max_y_ratio = sz_cfg.get(
                "tag_trigger_max_y_ratio", self.tag_trigger_max_y_ratio
            )
            self.debounce_required = sz_cfg.get("debounce_frames", self.debounce_required)
        except Exception:
            pass

    def reset(self) -> None:
        """Reset internal latch and debounce counters."""
        self.consecutive_detections = 0
        self.latched = False

    def detect(
        self,
        frame: np.ndarray,
        tag_detected: bool = False,
        tag_center_y: Optional[int] = None,
    ) -> Tuple[bool, float, Dict[str, Any]]:
        """
        Analyze current frame and optional fiducial tag cue for station entry.
        Returns (zone_detected: bool, confidence: float, metadata: dict).
        """
        if self.latched:
            return True, 1.0, {"reason": "latched", "consecutive": self.consecutive_detections}

        raw_cue_detected = False
        cue_reason = "none"
        confidence = 0.0

        # Cue 1: Direct tag sighting in upper/mid frame
        h, w = frame.shape[:2] if frame is not None else (480, 640)
        if tag_detected and tag_center_y is not None:
            if tag_center_y < int(h * self.tag_trigger_max_y_ratio):
                raw_cue_detected = True
                cue_reason = "tag_in_frame"
                confidence = 0.95

        # Cue 2: Transverse floor marker strip (wide horizontal bar)
        if not raw_cue_detected and frame is not None:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            # High-saturation/brightness mask (yellow/white)
            lower_cue = np.array([15, 60, 60], dtype=np.uint8)
            upper_cue = np.array([45, 255, 255], dtype=np.uint8)
            mask = cv2.inRange(hsv, lower_cue, upper_cue)

            # Analyze lower-mid region (where stop bar appears)
            y_min = int(h * 0.40)
            y_max = int(h * 0.85)
            strip_roi = mask[y_min:y_max, :]

            contours, _ = cv2.findContours(
                strip_roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )

            for cnt in contours:
                x, y, cw, ch = cv2.boundingRect(cnt)
                if ch > 0:
                    aspect_ratio = float(cw) / float(ch)
                    width_ratio = float(cw) / float(w)

                    # Condition: Wide horizontal strip spanning at least 45% of width
                    if (
                        aspect_ratio >= self.transverse_aspect_min
                        and width_ratio >= self.transverse_width_ratio_min
                        and cv2.contourArea(cnt) > 1200
                    ):
                        raw_cue_detected = True
                        cue_reason = "transverse_stop_strip"
                        confidence = float(min(1.0, 0.5 + width_ratio * 0.5))
                        break

        # Debouncing filter
        if raw_cue_detected:
            self.consecutive_detections += 1
        else:
            self.consecutive_detections = max(0, self.consecutive_detections - 1)

        zone_detected = self.consecutive_detections >= self.debounce_required
        if zone_detected:
            self.latched = True

        return (
            zone_detected,
            confidence if zone_detected else 0.0,
            {
                "reason": cue_reason,
                "consecutive": self.consecutive_detections,
                "latched": self.latched,
            },
        )
