# Member 1: Vision & Perception Lead — Execution Plan

**Branch:** `feature/vision-perception`  
**Role:** Computer Vision & AI Models Engineer  
**Core Mission:** Implement robust, real-time image capture, floor line detection, AprilTag/ArUco 6-DoF pose estimation, and dual-layer safety detection (semantic AI + geometric corridor).

---

## 1. Assigned Files & Responsibilities

| File Path | Description |
|---|---|
| [`docking/camera.py`](file:///c:/V-DOCKX/docking/camera.py) | OpenCV video capture wrapper supporting webcam, IP stream, and offline video file fallback. |
| [`docking/line_detector.py`](file:///c:/V-DOCKX/docking/line_detector.py) | Floor line detection via lower-half ROI, HSV thresholding, contour extraction, centroid ($e_c$) and angle ($e_a$). |
| [`docking/station_zone_detector.py`](file:///c:/V-DOCKX/docking/station_zone_detector.py) | Detects station transition cue (wide transverse floor strip or tag entry) to trigger docking mode. |
| [`docking/station_pose_detector.py`](file:///c:/V-DOCKX/docking/station_pose_detector.py) | ArUco / AprilTag fiducial detector and PnP pose solver computing metric distance ($e_d$), lateral offset ($e_y$), and yaw ($e_\theta$). |
| [`docking/pose_filter.py`](file:///c:/V-DOCKX/docking/pose_filter.py) | Exponential moving average (EMA) filter to suppress high-frequency pose jitter. |
| [`docking/obstacle_ai.py`](file:///c:/V-DOCKX/docking/obstacle_ai.py) | Lightweight AI object detector (MobileNet-SSD via OpenCV DNN or YOLO-World small) for classes `person`, `box`, `cart`. |
| [`docking/free_space_detector.py`](file:///c:/V-DOCKX/docking/free_space_detector.py) | Geometric trapezoidal safety corridor mask checking for path obstruction regardless of object classification. |
| [`docking/obstacle_fusion.py`](file:///c:/V-DOCKX/docking/obstacle_fusion.py) | Fuses AI detections and geometric corridor occupancy into a unified safety status. |
| [`config/line.yaml`](file:///c:/V-DOCKX/config/line.yaml) | HSV color bounds, ROI crop boundaries, morphology kernel sizes. |
| [`config/obstacle.yaml`](file:///c:/V-DOCKX/config/obstacle.yaml) | Corridor polygon vertices, AI confidence thresholds, minimum distance limits. |
| [`models/LICENSES.md`](file:///c:/V-DOCKX/models/LICENSES.md) | Documentation of model weights, licenses (e.g. AGPL vs Apache/BSD), and versions. |
| [`tests/test_line_detector.py`](file:///c:/V-DOCKX/tests/test_line_detector.py) | Unit tests for line extraction and error calculation under sample frames. |
| [`tests/test_obstacle_fusion.py`](file:///c:/V-DOCKX/tests/test_obstacle_fusion.py) | Unit tests verifying corridor intrusion detection. |

---

## 2. Output Data Contracts

Your modules must return instances of these data structures (or equivalent dictionaries):

```python
# docking/station_pose_detector.py
@dataclass
class PerceptionOutput:
    timestamp: float
    station_id: int
    detected: bool
    distance_m: float           # e_d: Forward distance to docking plane
    lateral_offset_m: float     # e_y: Horizontal displacement (+ right, - left)
    heading_error_rad: float    # e_theta: Heading error in radians
    confidence: float           # 0.0 to 1.0 (based on reprojection quality)
    reprojection_error_px: float

# docking/line_detector.py
@dataclass
class LineDetectionOutput:
    timestamp: float
    detected: bool
    centroid_error_norm: float  # e_c: Normalized [-1.0, 1.0] from camera center
    angle_error_rad: float      # e_a: Angle of line relative to vertical
    confidence: float           # 0.0 to 1.0 (based on contour area and continuity)
    annotated_frame: np.ndarray # Frame with visual overlay drawn

# docking/obstacle_fusion.py
@dataclass
class ObstacleOutput:
    timestamp: float
    obstacle_present: bool
    corridor_blocked: bool      # True if an object is inside the robot corridor
    minimum_distance_m: float   # Estimated distance to nearest obstacle
    detected_classes: list[str] # E.g. ['box', 'person']
    confidence: float
```

---

## 3. Step-by-Step Implementation Tasks

### Phase 0: Setup & Calibration (Hours 0 – 2)
- [ ] Checkout branch: `git checkout feature/vision-perception`.
- [ ] Add dependencies to `requirements.txt`: `opencv-python>=4.8`, `numpy>=1.24`, `pyyaml`.
- [ ] Set up camera calibration matrix in `docking/camera.py`:
  - Focal lengths $(f_x, f_y)$, principal point $(c_x, c_y)$, distortion coefficients.
  - Define fallback approximate matrix if physical camera calibration board is not available.

### Phase 1: Line Following Perception (Hours 2 – 6)
- [ ] In `docking/camera.py`, implement `CameraStream` with methods `get_frame()` and `release()`. Support passing an MP4 path for synthetic replay testing.
- [ ] In `docking/line_detector.py`:
  - Crop lower $40\%$–$50\%$ of image (focus on ground corridor).
  - Convert to HSV and apply threshold bounds from `config/line.yaml`.
  - Apply morphological opening/closing (`cv2.morphologyEx`) to remove speckles.
  - Find largest continuous contour and compute moments (`cv2.moments`).
  - Calculate normalized lateral centroid offset $e_c = \frac{c_x - \text{width}/2}{\text{width}/2}$.
  - Fit line or compare top/bottom centroid to extract heading error $e_a$.
- [ ] In `tests/test_line_detector.py`, write test cases for centered line, left offset, and missing line.

### Phase 2: Station Zone & AprilTag/ArUco Pose Estimation (Hours 6 – 10)
- [ ] In `docking/station_zone_detector.py`:
  - Detect visual transition cue (e.g. wide horizontal bar or arrival of tag in upper frame) to inform the state machine that the robot has entered the docking zone.
- [ ] In `docking/station_pose_detector.py`:
  - Initialize OpenCV ArUco detector (`cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)`).
  - Detect markers, filter for target `station_id` (reject foreign tags).
  - Call `cv2.aruco.estimatePoseSingleMarkers` or `cv2.solvePnP` with known marker size (e.g. $0.12\text{ m}$).
  - Extract metric $x, y, z$ and Rodrigues rotation vector; convert to $(e_d, e_y, e_\theta)$.
- [ ] In `docking/pose_filter.py`, implement exponential moving average:
  $$x_{\text{filtered}} = \alpha \cdot x_{\text{meas}} + (1 - \alpha) \cdot x_{\text{prev}}$$
  with $\alpha \approx 0.7$ to eliminate tag corner detection jitter.

### Phase 3: Dual-Layer Safety & Obstacle Detection (Hours 10 – 14)
- [ ] In `docking/free_space_detector.py`:
  - Define trapezoidal polygon representing the robot's ground footprint projected forward $1.5\text{ m}$.
  - Segment ground plane; if excessive edge energy (`cv2.Canny`) or non-ground color appears inside this polygon, raise `corridor_blocked = True`.
- [ ] In `docking/obstacle_ai.py`:
  - Load pre-trained MobileNet-SSD via `cv2.dnn.readNetFromCaffe` or YOLO-World small.
  - Filter detections for obstacle classes (`person`, `bottle`, `chair`, `box`).
- [ ] In `docking/obstacle_fusion.py`:
  - Combine AI bounding boxes with corridor polygon. If any bounding box bottom intersects the corridor, trigger `corridor_blocked = True`.
- [ ] In `tests/test_obstacle_fusion.py`, test with mock obstacle boxes inside and outside the corridor.

### Phase 4: Lighting Robustness & Recovery Assistance (Hours 14 – 18)
- [ ] Add CLAHE (Contrast Limited Adaptive Histogram Equalization) in preprocessor to handle low light and glare.
- [ ] Implement search/reacquisition helper: if tag is lost for $< 10$ frames, use temporal extrapolation; if $> 10$ frames, emit `detected = False` with last known direction.

### Phase 5: Test Matrix Validation & Tuning (Hours 18 – 22)
- [ ] Test under scenario conditions:
  - Dim room lighting and bright directional flashlight (glare).
  - Synthetic obstacle placement directly in front of camera.
  - Frame rate benchmark: Ensure perception pipeline runs $\ge 15\text{ FPS}$ on test laptop.

### Phase 6: Model Documentation & Packaging (Hours 22 – 24)
- [ ] Document model weights, license details, and download instructions in `models/README.md` and `models/LICENSES.md`.
- [ ] Clean up debug print statements and verify all functions have complete docstrings.
- [ ] Commit and push changes:
  ```bash
  git add .
  git commit -m "Complete perception pipeline: line detection, pose estimation, obstacle safety"
  git push origin feature/vision-perception
  ```

---

## 4. Acceptance Criteria & Definition of Done
1. **Line Detection**: Calculates $e_c$ and $e_a$ reliably at $\ge 20\text{ FPS}$.
2. **Pose Accuracy**: Tag distance $e_d$ within $\pm 2\text{ cm}$ and angle $e_\theta$ within $\pm 3^\circ$ at $1.0\text{ m}$ distance.
3. **Safety Guarantee**: Any object $> 10\text{ cm}$ placed in the safety corridor triggers `corridor_blocked = True` $100\%$ of the time.
4. **Latency**: Total frame-to-output latency $< 80\text{ ms}$.
