"""
V-DOCKX Semantic AI Obstacle Detector (Member 1)
Wraps OpenCV DNN with MobileNet-SSD / ONNX models for real-time classification
of warehouse obstacles (person, box, chair, bottle). Includes zero-crash offline fallback.
"""

import os
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np
import yaml


class AIObstacleDetector:
    """
    Real-time semantic object detector running MobileNet-SSD / ONNX via OpenCV DNN.
    Filters bounding boxes for mission-critical obstacle classes.
    """

    # Pascal VOC classes standard for MobileNet-SSD
    VOC_CLASSES = [
        "background", "aeroplane", "bicycle", "bird", "boat",
        "bottle", "bus", "car", "cat", "chair",
        "cow", "diningtable", "dog", "horse", "motorbike",
        "person", "pottedplant", "sheep", "sofa", "train", "tvmonitor", "box"
    ]

    def __init__(
        self,
        config_path: Optional[str] = None,
        prototxt_path: Optional[str] = None,
        weights_path: Optional[str] = None,
        confidence_threshold: float = 0.45,
        target_classes: Optional[List[str]] = None,
    ):
        self.confidence_threshold = confidence_threshold
        self.prototxt_path = prototxt_path
        self.weights_path = weights_path

        if target_classes is not None:
            self.target_classes = set(target_classes)
        else:
            self.target_classes = {"person", "bottle", "chair", "box", "dog", "cat", "sofa"}

        if config_path and os.path.exists(config_path):
            self._load_config(config_path)

        self.net: Optional[cv2.dnn.Net] = None
        self.offline_mode: bool = True
        self._simulated_detections: List[Dict[str, Any]] = []

        self._init_network()

    def _load_config(self, path: str) -> None:
        try:
            with open(path, "r") as f:
                cfg = yaml.safe_load(f) or {}
            ai_cfg = cfg.get("ai_detector", {})
            self.confidence_threshold = ai_cfg.get(
                "confidence_threshold", self.confidence_threshold
            )
            self.prototxt_path = ai_cfg.get("prototxt_path", self.prototxt_path)
            self.weights_path = ai_cfg.get("weights_path", self.weights_path)
            if "target_classes" in ai_cfg:
                self.target_classes = set(ai_cfg["target_classes"])
        except Exception:
            pass

    def _init_network(self) -> None:
        """Attempt to load DNN weights; fallback smoothly to offline mode if missing."""
        if (
            self.prototxt_path
            and self.weights_path
            and os.path.exists(self.prototxt_path)
            and os.path.exists(self.weights_path)
        ):
            try:
                self.net = cv2.dnn.readNetFromCaffe(self.prototxt_path, self.weights_path)
                # Optimize for OpenCV CPU execution
                self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                self.offline_mode = False
            except Exception:
                self.net = None
                self.offline_mode = True
        else:
            self.offline_mode = True

    def inject_simulation_detection(
        self,
        class_name: str,
        bbox: Tuple[int, int, int, int],
        confidence: float = 0.85,
    ) -> None:
        """Inject a synthetic detection for unit testing and CI simulation."""
        self._simulated_detections.append(
            {"class": class_name, "confidence": confidence, "bbox": bbox}
        )

    def clear_simulation_detections(self) -> None:
        """Clear injected synthetic detections."""
        self._simulated_detections.clear()

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Run inference on frame.
        Returns list of dicts: [{'class': str, 'confidence': float, 'bbox': (x1, y1, x2, y2)}]
        """
        if frame is None or frame.size == 0:
            return []

        # If simulated detections are active, return them
        if self._simulated_detections:
            return list(self._simulated_detections)

        if self.offline_mode or self.net is None:
            # Safe zero-crash fallback: return empty list in offline mode
            return []

        h, w = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(
            cv2.resize(frame, (300, 300)),
            0.007843,
            (300, 300),
            127.5,
        )

        self.net.setInput(blob)
        detections = self.net.forward()

        results: List[Dict[str, Any]] = []

        # detections shape: [1, 1, N, 7]
        for i in range(detections.shape[2]):
            confidence = float(detections[0, 0, i, 2])
            if confidence >= self.confidence_threshold:
                class_id = int(detections[0, 0, i, 1])
                class_name = (
                    self.VOC_CLASSES[class_id]
                    if class_id < len(self.VOC_CLASSES)
                    else "unknown"
                )

                if class_name in self.target_classes:
                    box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                    x1, y1, x2, y2 = box.astype(int)

                    # Clamp to frame boundaries
                    x1 = max(0, min(w - 1, x1))
                    y1 = max(0, min(h - 1, y1))
                    x2 = max(0, min(w - 1, x2))
                    y2 = max(0, min(h - 1, y2))

                    if x2 > x1 and y2 > y1:
                        results.append(
                            {
                                "class": class_name,
                                "confidence": round(confidence, 3),
                                "bbox": (x1, y1, x2, y2),
                            }
                        )

        return results
