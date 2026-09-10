"""
V-DOCKX Camera Capture & Stream Wrapper (Member 1)
Supports physical webcams, RTSP/HTTP video streams, offline video files,
and synthetic frame generation with calibrated intrinsics.
"""

import os
import threading
import time
from typing import Any, Dict, Optional, Tuple, Union
import cv2  # type: ignore
import numpy as np  # type: ignore
import yaml


class SyntheticFrameGenerator:
    """
    Generates synthetic frames with floor lines, ArUco markers, and obstacles
    for offline simulation, automated testing, and CI pipelines.
    """

    def __init__(self, width: int = 640, height: int = 480):
        self.width = width
        self.height = height
        self.frame_idx = 0

    def generate(
        self,
        draw_line: bool = True,
        line_offset_px: int = 0,
        line_angle_deg: float = 0.0,
        draw_marker: bool = False,
        marker_id: int = 0,
        marker_center: Tuple[int, int] = (320, 200),
        marker_size_px: int = 60,
        draw_obstacle: bool = False,
        obstacle_bbox: Optional[Tuple[int, int, int, int]] = None,
    ) -> np.ndarray:
        """
        Generate a synthetic BGR frame.
        """
        # Ground floor: neutral gray concrete
        frame = np.full((self.height, self.width, 3), 140, dtype=np.uint8)

        # Draw a yellow floor line (BGR: [0, 215, 255])
        if draw_line:
            center_x = self.width // 2 + line_offset_px
            rad = np.radians(line_angle_deg)
            dy = int(self.height * 0.55)
            dx = int(np.tan(rad) * (dy / 2.0))

            pt_bottom = (center_x - dx, self.height)
            pt_top = (center_x + dx, self.height - dy)
            cv2.line(frame, pt_bottom, pt_top, (0, 215, 255), 24)

        # Draw ArUco marker if requested
        if draw_marker:
            try:
                dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
                marker_img = cv2.aruco.generateImageMarker(dictionary, marker_id, marker_size_px)
                marker_bgr = cv2.cvtColor(marker_img, cv2.COLOR_GRAY2BGR)

                cx, cy = marker_center
                half = marker_size_px // 2
                x1, y1 = max(0, cx - half), max(0, cy - half)
                x2, y2 = min(self.width, cx + half), min(self.height, cy + half)

                mw = x2 - x1
                mh = y2 - y1
                if mw > 0 and mh > 0:
                    frame[y1:y2, x1:x2] = cv2.resize(marker_bgr, (mw, mh))
            except Exception:
                pass

        # Draw obstacle if requested
        if draw_obstacle:
            if obstacle_bbox is None:
                # Default obstacle right in front of the robot ground corridor
                obstacle_bbox = (280, 360, 360, 440)
            x1, y1, x2, y2 = obstacle_bbox
            cv2.rectangle(frame, (x1, y1), (x2, y2), (40, 40, 160), -1)  # dark red box

        self.frame_idx += 1
        return frame


class CameraStream:
    """
    Threaded, low-latency OpenCV video capture wrapper.
    Ensures get_frame() returns the freshest frame without buffer backlog.
    """

    def __init__(
        self,
        source: Union[int, str, None] = None,
        config_path: Optional[str] = None,
        width: int = 640,
        height: int = 480,
        fps: int = 30,
        synthetic_mode: bool = False,
    ):
        self.source = source
        self.width = width
        self.height = height
        self.fps = fps
        self.synthetic_mode = synthetic_mode

        # Load camera calibration parameters if available
        self.camera_matrix, self.dist_coeffs = self._load_calibration(config_path)

        self.cap: Optional[cv2.VideoCapture] = None
        self.latest_frame: Optional[np.ndarray] = None
        self.latest_timestamp: float = 0.0
        self.running: bool = False
        self.lock = threading.Lock()
        self.thread: Optional[threading.Thread] = None

        self.synthetic_generator = SyntheticFrameGenerator(width, height)

        if not self.synthetic_mode and self.source is not None:
            self._start_capture()
        else:
            self.synthetic_mode = True

    def _load_calibration(self, config_path: Optional[str]) -> Tuple[np.ndarray, np.ndarray]:
        """Load intrinsics from config or use standard pinhole defaults."""
        fx, fy = 650.0, 650.0
        cx = self.width / 2.0
        cy = self.height / 2.0
        dist = [0.0, 0.0, 0.0, 0.0, 0.0]

        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    cfg = yaml.safe_load(f) or {}
                cam_cfg = cfg.get("camera", {})
                fx = cam_cfg.get("fx", fx)
                fy = cam_cfg.get("fy", fy)
                cx = cam_cfg.get("cx", cx)
                cy = cam_cfg.get("cy", cy)
                dist = cam_cfg.get("dist_coeffs", dist)
                self.width = cam_cfg.get("width", self.width)
                self.height = cam_cfg.get("height", self.height)
                self.fps = cam_cfg.get("fps", self.fps)
            except Exception:
                pass

        camera_matrix = np.array(
            [[fx, 0.0, cx], [0.0, fy, cy], [0.0, 0.0, 1.0]], dtype=np.float64
        )
        dist_coeffs = np.array(dist, dtype=np.float64)
        return camera_matrix, dist_coeffs

    def _start_capture(self) -> None:
        """Initialize VideoCapture and start background grabber thread."""
        try:
            if isinstance(self.source, int):
                # On Windows, use DirectShow backend for faster device opening
                backend = cv2.CAP_DSHOW if os.name == "nt" else cv2.CAP_ANY
                self.cap = cv2.VideoCapture(self.source, backend)
            else:
                self.cap = cv2.VideoCapture(self.source)

            if self.cap and self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                self.cap.set(cv2.CAP_PROP_FPS, self.fps)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                self.running = True
                self.thread = threading.Thread(target=self._capture_worker, daemon=True)
                self.thread.start()
            else:
                # Fallback to synthetic mode if hardware camera is not accessible
                self.synthetic_mode = True
        except Exception:
            self.synthetic_mode = True

    def _capture_worker(self) -> None:
        """Continuous background thread keeping latest_frame fresh."""
        while self.running and self.cap is not None:
            ret, frame = self.cap.read()
            if ret and frame is not None:
                with self.lock:
                    self.latest_frame = frame
                    self.latest_timestamp = time.time()
            else:
                # If reading from video file and reached EOF, loop or stop
                if isinstance(self.source, str) and os.path.exists(self.source):
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                time.sleep(0.01)

    def get_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """
        Get the freshest frame.
        Returns (success: bool, frame: Optional[np.ndarray]).
        """
        if self.synthetic_mode:
            frame = self.synthetic_generator.generate()
            return True, frame

        with self.lock:
            if self.latest_frame is not None:
                return True, self.latest_frame.copy()

        # If thread hasn't caught a frame yet, try direct read once
        if self.cap is not None and self.cap.isOpened():
            ret, frame = self.cap.read()
            if ret and frame is not None:
                return True, frame

        return False, None

    def get_intrinsics(self) -> Tuple[np.ndarray, np.ndarray]:
        """Returns (camera_matrix, distortion_coefficients)."""
        return self.camera_matrix, self.dist_coeffs

    def release(self) -> None:
        """Gracefully release camera hardware and stop worker thread."""
        self.running = False
        if self.thread is not None and self.thread.is_alive():
            self.thread.join(timeout=1.0)
        if self.cap is not None:
            self.cap.release()
            self.cap = None


def show_or_save_frame(
    window_name: str,
    frame: np.ndarray,
    output_path: str = "results/preview.jpg",
    delay_ms: int = 1,
) -> bool:
    """
    Display frame using cv2.imshow if highgui is available;
    otherwise saves preview to disk for headless environments.
    Returns False if user pressed 'q' to quit, True otherwise.
    """
    if frame is None:
        return True
    try:
        cv2.imshow(window_name, frame)
        key = cv2.waitKey(delay_ms) & 0xFF
        return key != ord("q")
    except (cv2.error, Exception):
        # Headless fallback: save current visual output to results/
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, frame)
        return True

