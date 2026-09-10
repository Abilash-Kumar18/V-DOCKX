# Product Requirements Document
## Challenge 14: Vision-Based Autonomous Robot Docking and Charging

**Prepared for:** 24-hour hackathon team  
**Document type:** Product requirements and implementation plan  
**Version:** 1.0  
**Date:** 10 September 2026  
**Author:** Manus AI

---

## 1. Executive Summary

Autonomous mobile robots must periodically return to a charging station without human intervention. The final docking maneuver is difficult because the robot must identify the correct station, estimate its relative position and orientation, plan a short collision-free approach, compensate for motion and perception errors, and verify that electrical or physical docking has succeeded. Lighting variation, camera noise, nearby obstacles, and imperfect initial positioning make a single open-loop movement unreliable.

This project proposes a **vision-guided closed-loop docking system**. A forward-facing camera observes the docking area. The system detects a station marker or station geometry, estimates the robot pose relative to the station, plans a safe approach, executes short motion commands, re-estimates the pose after each command, and stops only when alignment and distance are within defined tolerances. A local obstacle detector acts as a safety layer. A successful docking decision is based on visual alignment and, when available, a charging-contact or current signal.

For a 24-hour hackathon, the recommended solution is a **hybrid line-guided and vision-safety MVP**:

1. Use a high-contrast floor line, tape path, or painted guide path to provide a simple and reliable route to the charging area.
2. Use a station marker, charging-bay marker, or visual stop pattern for final docking alignment rather than relying on the line alone.
3. Use a free/open model such as YOLO-World for optional zero-shot object detection, or an OpenCV DNN model such as MobileNet-SSD when its supported classes are sufficient.
4. Combine AI detections with a conservative camera-based free-space and obstacle corridor check; an AI model must not be the only safety mechanism.
5. Use a finite-state controller that follows the line, slows near the station, switches to visual alignment, stops for obstacles, and verifies docking.
6. Demonstrate the system in simulation or with a small differential-drive robot, with a replayable evaluation script.

The MVP should optimize for a reliable, explainable, demonstrable result rather than a generalized autonomous navigation stack. Advanced alternatives such as deep-learning object detection, visual odometry, LiDAR fusion, and reinforcement learning are described in this document but should be treated as stretch goals unless the team already has the required data and hardware.

---

## 2. Problem Statement

The robot currently lacks a reliable way to return to and align with a charging station under realistic operating conditions. A failed docking attempt consumes battery, wastes time, may cause mechanical damage, and can interrupt the robot's mission. The system must determine where the charging station is relative to the robot, approach it safely, correct errors continuously, and confirm that the robot has reached a valid charging pose.

### 2.1 Core problem

Given a sequence of camera images and robot motion feedback, estimate the relative station pose:

\[
T_{station}^{robot} = (x, y, \theta)
\]

where `x` is forward distance, `y` is lateral offset, and `θ` is the relative heading error. Then generate velocity commands that move the robot to a target docking pose while respecting safety constraints.

### 2.2 Operating assumptions for the hackathon

| Category | MVP assumption | Production extension |
|---|---|---|
| Robot | Differential-drive or holonomic mobile base | Multiple robot platforms |
| Sensor | One forward RGB camera | RGB-D camera, LiDAR, wheel odometry, IMU |
| Station | One designated station with a visible marker | Multiple stations and markerless fallback |
| Environment | Mostly planar floor and known docking zone | Dynamic warehouse or factory environment |
| Motion | Low-speed final approach | Full fleet navigation and traffic coordination |
| Compute | Laptop, Raspberry Pi-class computer, or edge GPU | Industrial edge computer |
| Feedback | Camera frames and optional wheel/charging feedback | Certified charging and safety interfaces |

---

## 3. Product Vision and Objectives

### 3.1 Product vision

Enable an autonomous robot to locate, approach, align with, and safely dock at a designated charging station using vision-based closed-loop control, even when initial alignment and lighting are imperfect.

### 3.2 Primary objectives

1. **Detect and identify the correct charging station.** The system must distinguish the target station from irrelevant visual objects.
2. **Estimate relative position and orientation.** The system must estimate forward distance, lateral offset, and heading error with sufficient accuracy for docking.
3. **Generate an accurate approach path.** The robot must approach through controlled motion rather than one long open-loop command.
4. **Correct alignment errors.** The controller must reduce lateral and angular error during the approach.
5. **Detect and avoid obstacles.** The robot must stop or re-plan when an object enters the docking corridor.
6. **Verify successful docking.** The robot must identify a safe final pose and, when possible, confirm electrical or physical contact.
7. **Handle image degradation.** The pipeline must remain usable across brightness changes, blur, moderate glare, and camera exposure changes.
8. **Measure performance.** The system must record docking accuracy, elapsed time, number of attempts, safety stops, and failures.

### 3.3 Secondary objectives

The system should be modular enough to replace the marker detector with a learned detector, replace camera-only obstacle detection with depth or LiDAR, and integrate with a robot middleware such as ROS 2 without rewriting the controller.

### 3.4 Non-goals for the 24-hour MVP

The MVP will not attempt to solve general-purpose navigation across an entire warehouse, multi-robot scheduling, long-term map creation, charging protocol certification, mechanical connector design, or safety certification for operation around people. These are future product concerns.

---

## 4. Users, Stakeholders, and Use Cases

### 4.1 Stakeholders

| Stakeholder | Need |
|---|---|
| Robot operator | A robot that returns to charging without manual intervention |
| Warehouse or factory manager | Fewer interruptions and predictable charging behavior |
| Robotics engineer | Observable perception, control, and failure states |
| Hackathon evaluator | A working demonstration with measurable results |
| Safety reviewer | Clear stop conditions and obstacle response |
| Product owner | A path from prototype to deployable system |

### 4.2 Primary use cases

**UC-01: Automatic return to station.** The robot receives a low-battery or mission-complete command and enters docking mode.

**UC-02: Station detection.** The robot searches for the station marker or station geometry and selects the intended station.

**UC-03: Coarse approach.** The robot moves toward the station while maintaining a safe speed and monitoring obstacles.

**UC-04: Fine alignment.** The robot performs small corrective movements until lateral, angular, and distance errors are within tolerance.

**UC-05: Docking verification.** The robot stops, checks visual alignment and optional electrical/contact feedback, and declares success or failure.

**UC-06: Obstacle interruption.** The robot detects an obstacle in the docking corridor, stops safely, waits or re-plans, and resumes only when the corridor is clear.

**UC-07: Recovery.** If the station is lost, the robot reverses a short distance, rotates or performs a controlled search, and retries within a bounded attempt limit.

---

## 5. Requirements

### 5.1 Functional requirements

| ID | Requirement | Priority | Acceptance criterion |
|---|---|---:|---|
| FR-01 | Capture camera frames at a stable rate | Must | The pipeline processes at least 10 frames per second on the demo computer, or the highest stable rate available |
| FR-02 | Detect the charging station | Must | The correct marker/station is detected in at least 90% of clear test frames |
| FR-03 | Estimate relative pose | Must | The system outputs distance, lateral offset, heading error, and confidence |
| FR-04 | Generate motion commands | Must | Commands respect configured speed and acceleration limits |
| FR-05 | Perform closed-loop correction | Must | The robot re-estimates pose after each control interval |
| FR-06 | Detect near-field obstacles | Must | A test obstacle causes a stop before entering the configured safety distance |
| FR-07 | Verify docking | Must | The system declares success only when all final-pose conditions are satisfied |
| FR-08 | Handle station loss | Must | The robot stops safely and enters search or recovery mode |
| FR-09 | Handle lighting variation | Should | Detection remains functional across at least three brightness conditions |
| FR-10 | Log telemetry | Must | Each run records timestamps, pose estimates, commands, states, confidence, and result |
| FR-11 | Provide operator visibility | Should | A dashboard or overlay shows camera image, marker, errors, state, and result |
| FR-12 | Limit retry attempts | Must | The robot does not oscillate indefinitely; it exits after a configured retry limit |

### 5.2 Non-functional requirements

| Category | Requirement |
|---|---|
| Safety | Any invalid pose, low confidence, obstacle detection, or command timeout must cause a controlled stop. |
| Latency | Perception-to-command latency should be below 150 ms for the MVP. |
| Determinism | The same recorded image sequence should produce reproducible state transitions within reasonable timing variance. |
| Explainability | Every stop, retry, and docking decision must have a machine-readable reason. |
| Modularity | Perception, planning, control, safety, and logging must be separable modules. |
| Configurability | Marker size, camera parameters, tolerances, speeds, and retry limits must be configuration values. |
| Recoverability | The robot must support a safe reverse-and-retry behavior after a failed approach. |
| Demonstrability | The full flow must run with prerecorded images or simulation if physical hardware fails. |

---

## 6. Solution Space and Brainstormed Alternatives

No single technique is optimal in every environment. The recommended architecture uses a robust, low-data method for the MVP and leaves interfaces for more advanced methods.

### 6.1 Station detection alternatives

| Approach | Description | Advantages | Limitations | Hackathon recommendation |
|---|---|---|---|---|
| AprilTag | Detect a coded square fiducial and estimate its pose from camera calibration | Fast, identity-aware, robust, low training effort | Requires visible tag and calibration | **Recommended MVP** |
| ArUco marker | Similar coded marker family supported by common computer-vision libraries | Easy to implement and print | Can be less robust under blur or severe perspective | Good fallback |
| Color or shape segmentation | Detect a station panel, colored beacon, or geometric outline | Very fast and simple | Sensitive to lighting and background clutter | Use as a supplemental detector |
| Template matching | Match a station image template | Easy to prototype | Sensitive to scale, rotation, and lighting | Baseline only |
| Classical feature matching | Use ORB/SIFT-like keypoints against a station image | Does not require training data | Can fail on textureless or blurred views | Useful for textured stations |
| Object detector | Train YOLO or a lightweight detector to detect the station | Handles appearance variation and partial occlusion | Needs data, labeling, and inference tuning | Stretch goal |
| Segmentation model | Predict station pixels or docking zone | Supports geometry and obstacle reasoning | More data and compute required | Stretch goal |
| Learned keypoint/pose model | Predict station corners or relative pose directly | Potentially robust after training | Hard to validate in 24 hours | Future work |
| Active beacon | Use infrared, LED, ultrasonic, or radio beacon to aid vision | Works in poor visual conditions | Adds hardware and integration complexity | Optional fallback |

### 6.2 Relative pose estimation alternatives

1. **Planar marker pose estimation.** Use known marker dimensions and calibrated camera intrinsics to compute a six-degree-of-freedom pose. Project the pose into the floor plane to derive `x`, `y`, and `θ`. This is the preferred method.
2. **Homography-based estimation.** Estimate a planar projective transform from station corners. This is useful when the station is a known planar surface but can be less stable than a calibrated marker pose.
3. **Monocular geometric estimation.** Infer distance from apparent station width or known feature size. This is simple but sensitive to camera tilt and detection noise.
4. **Depth-based estimation.** Use RGB-D depth to estimate the station plane and distance directly. This improves metric accuracy but requires depth hardware and handling of reflective surfaces.
5. **Visual odometry or SLAM.** Estimate the robot's movement from image sequences and combine it with station observations. This supports station loss recovery but is unnecessary for a short, controlled docking maneuver.
6. **Sensor fusion.** Fuse vision with wheel odometry, IMU, LiDAR, or depth using an extended Kalman filter or complementary filter. This is the best production direction when individual sensors are unreliable.

### 6.3 Path-planning alternatives

| Planner | Best use | Complexity |
|---|---|---:|
| Direct visual servoing | Clear, short docking corridor | Low; **recommended** |
| Waypoint approach | Approach to a pre-docking pose, then fine-align | Low; **recommended fallback** |
| Pure pursuit | Smoothly follow a short path | Low to medium |
| Dynamic Window Approach | Select safe velocity commands using robot dynamics and obstacles | Medium |
| Vector Field Histogram | Reactive obstacle avoidance | Medium |
| A* or Dijkstra | Known static occupancy grid | Medium |
| RRT/RRT* | Complex geometry and constrained spaces | High for MVP |
| Model Predictive Control | High-quality constrained control | High; future work |

The MVP should use a two-stage path: first move to a **pre-docking pose** approximately aligned with the station, then use visual servoing for the final approach. This is more stable than attempting to drive directly from an arbitrary starting pose.

### 6.4 Obstacle-detection alternatives

1. **Camera optical flow or frame differencing.** Fast but weak for static obstacles and depth estimation.
2. **Bounding-box object detection.** Detect people, boxes, and vehicles. Requires a model and may not estimate exact collision distance.
3. **Monocular depth estimation.** Produces a relative depth map but can be unreliable for metric safety distances.
4. **RGB-D depth thresholding.** Detect points within the docking corridor and stop if they are closer than the configured threshold.
5. **LiDAR or ultrasonic sensors.** Provide direct range measurements and are preferred for a safety layer when available.
6. **Virtual bumper or contact switch.** A final mechanical safety mechanism; it must never be the primary collision-avoidance method.

For the hackathon, use depth or LiDAR if already available. Otherwise implement a vision-only corridor detector and clearly label it as a prototype safety mechanism.

### 6.5 Control alternatives

- **Proportional controller:** Set angular velocity proportional to heading and lateral error and linear velocity proportional to distance. This is easy to tune and explain.
- **PID controller:** Add integral and derivative terms when steady-state error or oscillation is observed. Avoid integral windup near the station.
- **Pure pursuit:** Track a look-ahead point on a short docking path. It is useful when the robot must approach from an angle.
- **Finite-state controller:** Use explicit states such as `SEARCH`, `COARSE_APPROACH`, `FINE_ALIGN`, `FINAL_DOCK`, `VERIFY`, and `RECOVERY`. This is recommended for reliable hackathon behavior.
- **Fuzzy controller:** Use linguistic rules such as “large left error means rotate right.” It can be useful when the measurement model is noisy but adds tuning overhead.
- **Model predictive control:** Optimize a short sequence of commands subject to obstacle and velocity constraints. It is a production candidate, not an MVP requirement.
- **Reinforcement learning:** Learn docking behavior from simulation. It is not recommended in a 24-hour event because training, sim-to-real transfer, and safety validation dominate the schedule.

### 6.6 Docking-verification alternatives

1. Marker centered within a pixel or angular tolerance.
2. Estimated distance below a docking threshold.
3. Heading error below a configured tolerance.
4. Robot velocity near zero for a dwell period.
5. Charging current or voltage detected.
6. Docking switch or contact sensor activated.
7. A station-side confirmation signal received.
8. A short reverse test showing the station remains aligned, if mechanically safe.

The recommended decision is conjunctive: visual pose conditions plus low velocity, with charging/contact feedback used when available. Visual alignment alone should be reported as `VISUALLY_ALIGNED`, not necessarily `CHARGING_CONFIRMED`.

---

## 7. Recommended MVP Solution

### 7.1 Concept

The robot carries a forward-facing camera. The charging station has a uniquely identifiable planar marker placed at a known height and orientation. The camera is calibrated once. The perception module detects the marker and calculates its pose. The controller converts that pose into a short velocity command. The command is executed for a small time step, then the process repeats.

The station area is divided into three conceptual zones:

| Zone | Behavior |
|---|---|
| Search zone | Rotate slowly or follow a search pattern until the marker is detected |
| Approach zone | Move toward the station while reducing lateral and heading error |
| Docking zone | Move slowly, apply strict alignment tolerances, and verify final state |

### 7.2 Relative error definition

Use a station-centered coordinate convention:

- `e_d`: forward distance from the robot docking reference point to the target docking line.
- `e_y`: lateral offset from the station centerline.
- `e_theta`: heading error between robot heading and the station approach direction.
- `c`: perception confidence, combining marker quality, reprojection error, and temporal consistency.

A simple control law is:

\[
\omega = K_y e_y + K_\theta e_\theta
\]

\[
v = \operatorname{clamp}(K_d e_d, v_{min}, v_{max})
\]

The controller reduces `v` as the robot enters the final docking zone. If confidence falls below a threshold, the robot stops rather than extrapolating from stale vision.

### 7.3 State machine

```text
IDLE
  -> SEARCH
  -> STATION_DETECTED
  -> COARSE_APPROACH
  -> FINE_ALIGN
  -> FINAL_APPROACH
  -> VERIFY
  -> DOCKED

Any active state
  -> OBSTACLE_STOP
  -> LOST_TARGET
  -> RECOVERY
  -> FAILED
```

**SEARCH** rotates at low speed and scans a bounded field of view.  
**STATION_DETECTED** validates the marker over multiple frames.  
**COARSE_APPROACH** moves toward a pre-docking pose.  
**FINE_ALIGN** minimizes lateral and angular error.  
**FINAL_APPROACH** uses a low speed and strict confidence checks.  
**VERIFY** checks visual alignment, velocity, dwell time, and optional charging feedback.  
**OBSTACLE_STOP** commands zero velocity and records the reason.  
**LOST_TARGET** stops immediately and attempts a bounded reacquisition.  
**RECOVERY** reverses or repositions before retrying.  
**FAILED** requires operator intervention or returns the robot to a safe standby mode.

---

## 8. System Architecture

### 8.1 Logical architecture

```text
+--------------------+       +------------------------+
| Camera / RGB-D     | ----> | Image Preprocessing    |
+--------------------+       | Exposure, resize, ROI  |
                             +-----------+------------+
                                         |
                                         v
                             +------------------------+
                             | Station Perception     |
                             | Marker/geometry pose   |
                             +-----------+------------+
                                         |
                         +---------------+----------------+
                         |                                |
                         v                                v
              +---------------------+          +----------------------+
              | Pose Filter         |          | Obstacle Detector    |
              | Temporal smoothing |          | Corridor safety      |
              +----------+----------+          +----------+-----------+
                         |                                |
                         +---------------+----------------+
                                         v
                             +------------------------+
                             | State Machine          |
                             | Docking lifecycle      |
                             +-----------+------------+
                                         |
                                         v
                             +------------------------+
                             | Local Planner /        |
                             | Visual Servo Controller|
                             +-----------+------------+
                                         |
                                         v
                             +------------------------+
                             | Safety Supervisor      |
                             | Limits, timeout, stop  |
                             +-----------+------------+
                                         |
                                         v
                             +------------------------+
                             | Robot Base / Simulator |
                             +------------------------+

             All modules ---> Telemetry, replay logs, dashboard
```

### 8.2 Component responsibilities

| Component | Responsibility | MVP implementation |
|---|---|---|
| Camera driver | Acquire timestamped frames | OpenCV, ROS image topic, or simulator feed |
| Preprocessor | Resize, crop region of interest, normalize brightness | OpenCV grayscale/CLAHE/blur |
| Station detector | Identify marker and estimate pose | AprilTag or ArUco detector |
| Pose filter | Smooth measurement and reject outliers | Exponential moving average or median window |
| Obstacle detector | Identify occupied docking corridor | Depth/LiDAR threshold or vision heuristic |
| State machine | Control lifecycle and failure transitions | Python enum plus explicit transition logic |
| Local planner | Produce desired velocity and target alignment | Two-stage waypoint plus controller |
| Safety supervisor | Clamp commands and override motion | Independent final command gate |
| Robot adapter | Convert velocity command to simulator/robot API | Mock adapter or ROS 2 `cmd_vel` |
| Logger | Store every event and metric | JSON Lines or CSV |
| Dashboard | Show current state and camera overlay | OpenCV window or lightweight web UI |

### 8.3 Interfaces

```text
PerceptionOutput:
  timestamp
  station_id
  detected: boolean
  distance_m
  lateral_offset_m
  heading_error_rad
  confidence
  reprojection_error_px

ObstacleOutput:
  timestamp
  obstacle_present
  minimum_distance_m
  confidence

ControlCommand:
  timestamp
  linear_velocity_mps
  angular_velocity_rps
  reason

DockingResult:
  status: SUCCESS | FAILED | ABORTED | VISUALLY_ALIGNED
  duration_s
  attempts
  final_distance_m
  final_lateral_error_m
  final_heading_error_rad
  obstacle_stops
  failure_reason
```

---

## 9. End-to-End Workflow

### 9.1 Operational workflow

1. The robot receives a docking request.
2. The safety supervisor checks battery, sensor availability, and command freshness.
3. The robot enters `SEARCH` if the station is not in view.
4. The detector identifies the station marker and validates it across consecutive frames.
5. The pose estimator transforms camera coordinates into the robot base frame.
6. The planner creates a pre-docking target and determines whether the approach corridor is clear.
7. The controller sends a short command with bounded speed.
8. The robot stops or continues according to the latest perception result.
9. The controller switches to fine alignment near the station.
10. The robot reaches a candidate docking pose and enters `VERIFY`.
11. The verifier checks visual alignment, distance, heading, low velocity, dwell time, and optional electrical feedback.
12. The system emits a result, stores telemetry, and returns control to the mission manager.

### 9.2 Perception-processing loop

```text
while docking_active:
    frame = camera.read()
    image = preprocess(frame)
    station = detect_station(image)
    obstacle = detect_obstacle(image, depth_or_lidar)

    if obstacle.is_present:
        safety_stop("obstacle")
        continue

    if not station.detected or station.confidence < MIN_CONFIDENCE:
        handle_target_loss()
        continue

    pose = filter_pose(station)
    state = update_state_machine(pose)
    command = controller.compute(pose, state)
    command = safety_supervisor.limit(command, pose, obstacle)
    robot.send(command)
    logger.record(frame, pose, obstacle, state, command)
```

### 9.3 Recovery workflow

If the marker is lost for fewer than `N` frames, the robot should stop and wait briefly because a transient blur or occlusion may resolve. If the marker remains lost, the robot should reverse a small distance, rotate toward the last known station direction, and retry detection. If the retry limit is exceeded, the robot should enter `FAILED` and request operator intervention. Recovery must never continue blindly toward a stale target pose.

---

## 10. Detailed Implementation Plan

### 10.1 Suggested technology stack

| Layer | Option |
|---|---|
| Language | Python 3.10+ for rapid prototyping |
| Vision | OpenCV, AprilTag or ArUco library |
| Numerical processing | NumPy |
| Robotics integration | ROS 2 if already available; otherwise a simple adapter |
| Simulation | Gazebo, Webots, Isaac Sim, PyBullet, or custom 2D simulator |
| Dashboard | OpenCV overlay, Streamlit, or a small Flask page |
| Storage | JSON Lines, CSV, and PNG/MP4 replay artifacts |
| Packaging | `requirements.txt`, configuration YAML, reproducible run script |

### 10.2 Camera calibration

Calibrate the camera if hardware is available. Record focal lengths, principal point, distortion coefficients, image resolution, camera height, and camera pitch. If calibration cannot be completed, use a known approximate calibration and label metric accuracy as provisional. The marker's physical size must be measured accurately because pose scale depends on it.

### 10.3 Station setup

Mount one unique marker at a visible and repeatable location on the station. Use a high-contrast print with a known ID. Add a visual docking line or center reference if the physical station has a preferred approach direction. Keep the station background visually simple for the MVP, then add clutter during evaluation.

### 10.4 Pose estimation

The marker detector returns image corners and a pose estimate. Convert the pose into the robot coordinate frame using the camera-to-base transform. Derive the docking errors from the transformed station pose. Reject detections with excessive reprojection error, implausible distance, impossible height, or sudden frame-to-frame jumps.

Apply temporal filtering carefully. Filtering should reduce jitter without causing the robot to continue moving toward a stale pose. If the measurement age exceeds a timeout, invalidate it and stop.

### 10.5 Controller tuning

Begin with low speeds and proportional control. Tune one variable at a time:

1. Increase angular gain until the robot corrects heading without sustained oscillation.
2. Increase lateral gain until the robot converges to the centerline.
3. Increase distance gain until approach time is acceptable.
4. Reduce final-zone speed and increase alignment strictness.
5. Add a small derivative term only if the robot overshoots because of measurement delay.

Use command saturation, acceleration limits, and a deadband around zero error. Do not use an integral term unless a persistent bias remains after camera-frame and base-frame calibration.

### 10.6 Obstacle logic

Define a docking corridor in front of the robot. If a depth, LiDAR, or vision estimate reports an obstacle inside the corridor and below the configured stopping distance, the safety supervisor must immediately send zero velocity. The planner may resume only after the obstacle is absent for a stable dwell period. A human or moving object should be treated as a reason to stop, not as an object to navigate around during the final docking maneuver.

### 10.7 Docking decision logic

A visually aligned state requires:

```text
abs(lateral_offset) <= lateral_tolerance
abs(heading_error) <= heading_tolerance
distance <= docking_distance
confidence >= confidence_threshold
linear_speed <= speed_threshold
angular_speed <= speed_threshold
conditions hold for dwell_time
```

A charging-confirmed state additionally requires charging current, voltage, station acknowledgment, or a contact sensor. If this signal is unavailable, report `VISUALLY_ALIGNED` and do not claim electrical charging success.

### 10.8 Configuration example

```yaml
camera:
  width: 1280
  height: 720
  fps: 30
  marker_size_m: 0.12

control:
  max_linear_velocity_mps: 0.20
  max_angular_velocity_rps: 0.60
  final_linear_velocity_mps: 0.05
  kp_distance: 0.45
  kp_lateral: 1.20
  kp_heading: 1.00

thresholds:
  min_confidence: 0.65
  lateral_tolerance_m: 0.03
  heading_tolerance_rad: 0.08
  docking_distance_m: 0.12
  obstacle_stop_distance_m: 0.35
  target_loss_timeout_s: 0.40
  verification_dwell_s: 0.80
  max_retries: 3
```

---

## 11. Evaluation and Success Metrics

### 11.1 Primary metrics

| Metric | Definition | MVP target |
|---|---|---:|
| Docking success rate | Successful docks divided by total attempts | At least 85% in controlled trials |
| Final lateral error | Absolute lateral offset at verification | ≤ 3 cm where metric calibration allows |
| Final heading error | Absolute orientation error at verification | ≤ 5 degrees |
| Final distance error | Difference from target docking distance | ≤ 3 cm |
| Median docking time | Time from docking request to verified result | ≤ 60 seconds |
| Retry rate | Attempts requiring recovery | ≤ 20% |
| Obstacle stop reliability | Trials in which the robot stops before the safety boundary | 100% in scripted tests |
| False docking rate | Invalid poses declared successful | 0 in acceptance tests |
| Target reacquisition rate | Successful recovery after temporary station loss | At least 80% |
| Perception latency | Frame-to-pose output time | ≤ 100 ms target |

### 11.2 Test matrix

| Test | Initial pose | Lighting | Obstacle | Expected result |
|---|---|---|---|---|
| T01 | Centered and close | Normal | None | Direct successful dock |
| T02 | Large lateral offset | Normal | None | Corrective approach and success |
| T03 | Heading misalignment | Normal | None | Rotation correction and success |
| T04 | Far starting position | Normal | None | Coarse plus fine approach |
| T05 | Dim lighting | Low | None | Detection remains usable or safe stop |
| T06 | Bright glare | High | None | No false docking; recover or stop |
| T07 | Temporary marker occlusion | Normal | None | Stop and reacquire |
| T08 | Static obstacle in corridor | Normal | Yes | Stop before obstacle |
| T09 | Obstacle removed | Normal | Removed | Resume after stable clearance |
| T10 | Wrong marker visible | Normal | None | Reject incorrect station ID |
| T11 | Camera blur | Normal | None | Safe stop or bounded recovery |
| T12 | Sensor timeout | Any | Any | Safety supervisor stops robot |

### 11.3 Logging and observability

Each run must include a unique run ID and timestamp. Log camera frames or a low-rate video, station detections, confidence, pose errors, state transitions, commands, obstacle observations, stop reasons, and final result. Generate a summary report with per-test success, duration, minimum clearance, and final errors.

---

## 12. 24-Hour Hackathon Execution Plan

The team should divide work into parallel tracks while maintaining one shared integration branch and one known-good demo path.

### 12.1 Team roles

| Role | Main responsibility |
|---|---|
| Perception engineer | Camera pipeline, marker detection, pose estimation, filtering |
| Controls engineer | State machine, controller, velocity limits, recovery |
| Robotics/simulation engineer | Robot adapter, simulation, hardware integration, obstacle sensor |
| Product/demo engineer | Dashboard, metrics, test harness, pitch, documentation |

If the team has fewer members, combine perception with controls and combine simulation with demo engineering.

### 12.2 Hour-by-hour plan

| Time | Deliverable |
|---|---|
| 0–1 | Confirm success criteria, freeze MVP scope, assign roles, inspect hardware and environment |
| 1–3 | Set up repository, dependencies, camera feed or simulator, station marker, configuration file |
| 3–6 | Implement marker detection, calibration inputs, pose output, and visualization overlay |
| 6–9 | Implement state machine and low-speed proportional controller with mocked robot commands |
| 9–12 | Connect controller to simulator or robot; achieve a clean centered docking run |
| 12–14 | Add obstacle detection, safety supervisor, command limits, and emergency stop |
| 14–16 | Add lighting preprocessing, pose filtering, target-loss recovery, and retry limits |
| 16–18 | Add logging, metrics, replay mode, dashboard, and automated test scenarios |
| 18–20 | Run the complete test matrix; tune tolerances and gains; fix integration failures |
| 20–22 | Freeze code, create a reliable demo route, record backup video, prepare architecture slide |
| 22–23 | Rehearse the presentation, collect measured results, document known limitations |
| 23–24 | Final verification, package code and report, run the demo, submit artifacts |

### 12.3 Scope control rules

The team must preserve a working baseline after every major integration step. If hardware integration is unstable by hour 12, switch to simulation or recorded camera replay. If a learned detector is not reliable by hour 10, fall back to a marker detector. If full obstacle avoidance is not stable, implement a conservative stop-only safety behavior rather than an unsafe planner.

### 12.4 Definition of done

The MVP is complete when the team can run one command that starts the system, shows the camera and state overlay, detects the station, approaches it, stops for an obstacle, resumes after clearance, verifies a final pose, logs the result, and produces a measurable test summary. A prerecorded replay must demonstrate the same state machine if the physical robot is unavailable during judging.

---

## 13. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---:|---:|---|
| Camera calibration is inaccurate | High | Medium | Use a visible marker, measure dimensions, validate against known distances, reduce target claims |
| Marker is not detected under glare | High | Medium | Use matte print, exposure control, adaptive preprocessing, larger marker, fallback station geometry |
| Robot oscillates near station | High | Medium | Reduce gains, lower final speed, add deadband and derivative damping |
| Wheel slip causes pose mismatch | Medium | Medium | Use closed-loop visual correction, add odometry only as a secondary estimate |
| Obstacle detector misses objects | High | Medium | Use conservative corridor threshold, stop-only logic, depth/LiDAR if available |
| Station is visually occluded | Medium | Medium | Stop, reverse slightly, reacquire; do not use stale pose indefinitely |
| Hardware integration consumes time | High | High | Build simulator/mock adapter first and preserve replay mode |
| False positive docking | High | Low to medium | Require multiple conditions and a dwell period; never rely on marker presence alone |
| Lighting changes break thresholding | Medium | Medium | Prefer fiducial detection; test at multiple exposure levels |
| Network or middleware failure | Medium | Medium | Keep core loop local and use a simple direct adapter |
| Scope expands into general navigation | High | High | Freeze MVP to final docking corridor and document extensions separately |
| Lack of charging feedback | Medium | High | Report visual alignment separately from charging confirmation |

---

## 14. Security, Safety, and Responsible Operation

This prototype controls a moving machine. The software must treat perception uncertainty as a reason to stop. The system must not command motion when the camera stream is stale, the command interface is unavailable, the station identity is ambiguous, or the obstacle sensor reports an unsafe condition.

Recommended safeguards include a physical emergency-stop button, a maximum final speed, a maximum docking duration, a maximum number of retries, a minimum battery reserve for recovery, a dead-man or operator override during initial testing, and a clearly marked test area. The demo should use a low-mass robot or simulation and should not operate near unprotected people.

The system should separate **safety stop** from **mission failure**. A safety stop means the robot has done the correct safe action and may resume after the condition clears. A mission failure means the configured recovery policy has been exhausted and human intervention is required.

---

## 15. Future Roadmap

### Phase 1: Hackathon MVP

Marker-based station detection, calibrated pose estimation, closed-loop visual servoing, stop-only obstacle response, state machine, replay logs, and measurable demo.

### Phase 2: Robust prototype

Sensor fusion with wheel odometry and IMU, RGB-D or LiDAR obstacle detection, automatic calibration checks, station inventory, improved recovery, and a web-based monitoring dashboard.

### Phase 3: Production pilot

Multiple stations, learned station detection, dynamic obstacle handling, charging protocol integration, fleet management, health monitoring, remote diagnostics, and systematic safety validation.

### Phase 4: Generalized autonomy

Markerless docking fallback, semantic mapping, uncertainty-aware planning, multi-robot coordination, predictive battery scheduling, and model-predictive control.

---

## 16. Recommended Demo Narrative

The demo should begin with the robot positioned off-center and slightly rotated relative to the station. The operator triggers docking. The camera overlay shows the station marker, estimated pose, error values, and current state. The robot corrects its heading and lateral position through small commands.

During the approach, place a safe test obstacle in the docking corridor. The robot must stop and visibly report `OBSTACLE_STOP`. Remove the obstacle. The robot should resume only after the clearance dwell period. The robot then enters final approach, stops at the target pose, and reports `DOCKED` or `VISUALLY_ALIGNED` with measured errors.

The presentation should show that the system is not simply driving toward a fixed point. It should emphasize the closed loop: **see, estimate, act, re-see, correct, verify**. The team should show a metrics table from repeated trials and explain the fallback plan using simulation or replay logs.

---

## 17. Acceptance Checklist

### Product behavior

- [ ] The target station is uniquely identified.
- [ ] Relative distance, lateral offset, heading error, and confidence are visible.
- [ ] The robot uses closed-loop corrections.
- [ ] Final motion is slower than coarse approach motion.
- [ ] An obstacle causes an immediate controlled stop.
- [ ] Target loss causes a stop and bounded recovery.
- [ ] Incorrect station identity is rejected.
- [ ] Docking requires a dwell period and multiple conditions.
- [ ] Visual alignment and charging confirmation are reported separately when necessary.

### Engineering quality

- [ ] Configuration is externalized.
- [ ] Safety limits are enforced in a final command gate.
- [ ] Every state transition has a logged reason.
- [ ] Replay mode works without hardware.
- [ ] A test script calculates the main metrics.
- [ ] The repository contains setup instructions and a one-command run path.
- [ ] Known limitations and assumptions are documented.

### Presentation

- [ ] Architecture diagram is ready.
- [ ] Live or recorded demo is ready.
- [ ] Metrics from repeated tests are available.
- [ ] Failure and recovery behavior is demonstrated.
- [ ] Future improvements are clearly separated from the MVP.

---

## 18. Final Recommendation

Build the MVP around a **fiducial-marker-based visual servoing loop with a finite-state machine and conservative safety supervisor**. This solution has the highest probability of producing a working result in 24 hours because it avoids the data and tuning burden of deep learning while directly addressing station identification, relative pose, alignment correction, obstacle response, and docking verification.

Use a layered fallback strategy. The primary detector should be an AprilTag or ArUco marker. A station-geometry or color detector may support reacquisition but should not override a low-confidence pose. Use a pre-docking waypoint for coarse positioning and a proportional controller for fine alignment. Add depth or LiDAR if already available; otherwise implement a conservative camera-based stop zone and disclose the limitation. Preserve a simulator and replay mode from the beginning so the team can still demonstrate a complete system if the robot hardware fails.

The strongest hackathon submission will not claim perfect autonomy. It will demonstrate a safe, measurable, explainable docking loop, quantify its accuracy and success rate, and show how the architecture can evolve into a production system.

---

## References

[1]: https://docs.opencv.org/ "OpenCV Documentation"

[2]: https://docs.opencv.org/4.x/d5/dae/tutorial_aruco_detection.html "OpenCV ArUco Marker Detection Documentation"

[3]: https://github.com/AprilRobotics/apriltag "AprilTag Fiducial Marker Library"

[4]: https://docs.ros.org/en/jazzy/index.html "ROS 2 Jazzy Documentation"

[5]: https://navigation.ros.org/ "Nav2 Navigation Framework Documentation"

[6]: https://docs.ros.org/en/jazzy/Tutorials/Intermediate/URDF/Using-a-URDF-in-Gazebo.html "ROS 2 and Gazebo Simulation Documentation"

[7]: https://docs.opencv.org/4.x/d9/db0/tutorial_homography.html "OpenCV Homography Documentation"

[8]: https://docs.opencv.org/4.x/dc/d6b/group__video__track.html "OpenCV Motion and Optical Flow Documentation"

[9]: https://docs.opencv.org/4.x/dc/dc3/tutorial_py_matcher.html "OpenCV Feature Matching Documentation"

[10]: https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Launch/Launch-system.html "ROS 2 Launch System Documentation"

---

**Document status:** Ready for team review and implementation planning.

**Suggested repository structure:**

```text
robot-docking/
├── README.md
├── requirements.txt
├── config/
│   └── docking.yaml
├── docking/
│   ├── camera.py
│   ├── perception.py
│   ├── pose_filter.py
│   ├── obstacle_detector.py
│   ├── controller.py
│   ├── state_machine.py
│   ├── safety.py
│   ├── robot_adapter.py
│   └── logger.py
├── tests/
│   ├── test_perception.py
│   ├── test_controller.py
│   ├── test_safety.py
│   └── test_replay.py
├── data/
│   ├── calibration/
│   └── replay/
├── scripts/
│   ├── run_docking.py
│   ├── replay_run.py
│   └── evaluate_runs.py
└── results/
```

The team should commit the first end-to-end baseline before adding advanced features. In a time-constrained event, a safe and measurable baseline is more valuable than an incomplete generalized autonomy system.

---

*End of PRD.*

[1] [2] [3] [4] [5] [6] [7] [8] [9] [10]


---

# Revision 2: Hybrid Line-Guided Docking and Camera-Based Obstacle Safety

## A. Updated Idea and Design Decision

The project can be made more reliable and achievable within 24 hours by separating navigation into two layers:

1. **Line-guided navigation:** A visible floor line, tape strip, painted lane, or high-contrast path leads the robot from its operating area to the charging zone. The camera detects the line and a controller keeps the robot centered on it.
2. **Vision-guided final docking:** Near the station, the robot stops treating the line as the only reference. It switches to a station marker, docking bay geometry, or a visual stop pattern for final alignment and docking verification.
3. **Camera-based safety layer:** A lightweight object detector identifies likely obstacles, while a separate image-based free-space and corridor check detects anything that blocks the robot's immediate path. The robot stops conservatively whenever either layer reports a credible hazard.

This is a stronger design than using line following alone. A line can guide the robot to the vicinity of a station but cannot reliably establish final distance, orientation, or contact. Conversely, a marker-only approach requires the station to be visible from a larger distance and can be affected by occlusion. The hybrid design assigns each visual cue the task it performs best.

The central control principle is:

> **Follow the line until the charging zone is reached; then use the station geometry to dock; at every stage, let the safety supervisor override motion.**

### A.1 Revised MVP recommendation

| Layer | Recommended method | Reason |
|---|---|---|
| Route guidance | Camera-based line detection using color/brightness segmentation, perspective normalization, and centroid error | Fast, explainable, no training data, works on a prepared demo floor |
| Station approach trigger | Detect a wide station-zone marker, transverse line, AprilTag/ArUco marker, or known bay geometry | Provides a clear transition from route following to docking |
| Final alignment | AprilTag/ArUco pose estimation or station-boundary geometry | Gives identity and final pose; more accurate than line position alone |
| Obstacle AI | YOLO-World with prompts such as `person`, `box`, `cart`, `pallet`, `robot`, and `obstacle`, if compute allows | Zero-shot promptable detection without collecting a custom dataset |
| Obstacle fallback | Small pretrained detector such as MobileNet-SSD, plus lower-image free-space and corridor occupancy checks | Lower compute and more deterministic for common object classes |
| Safety decision | Conservative fusion of AI boxes, motion/temporal evidence, and free-space mask | Avoids depending on one imperfect detector |
| Control | Finite-state machine with line PID/proportional control and final visual servoing | Simple to tune and easy to demonstrate |
| Verification | Visual alignment, stopped velocity, dwell time, and optional charging/contact signal | Prevents false success declarations |

### A.2 Important limitation about free AI models

A model being downloadable at no cost does not automatically mean that it is unrestricted for every deployment. Ultralytics documentation describes YOLO-World as a real-time, promptable open-vocabulary detector, but its licensing page distinguishes AGPL-3.0 use from commercial or proprietary embedding. For an educational hackathon, the team should record the model version and license, publish the project source when required, and avoid claiming that a free download is automatically production-safe for a closed commercial robot. For a future commercial product, conduct a formal license review before deployment. [11] [12]

The safest hackathon implementation is to make the obstacle detector replaceable through a common interface. If the team wants to avoid Ultralytics licensing questions, use an OpenCV DNN model with a compatible license and a known class list, or use classical vision for the safety corridor while presenting AI detection as an advisory perception layer.

## B. Hybrid Operating Modes

The revised state machine is:

```text
IDLE
  -> LINE_SEARCH
  -> LINE_FOLLOW
  -> STATION_ZONE_APPROACH
  -> DOCKING_TARGET_ACQUIRE
  -> FINE_ALIGN
  -> FINAL_APPROACH
  -> VERIFY
  -> DOCKED

From any motion state:
  -> OBSTACLE_STOP
  -> SENSOR_FAULT_STOP
  -> LINE_LOST
  -> TARGET_LOST
  -> RECOVERY
  -> FAILED
```

### B.1 State behavior

| State | Camera reference | Robot behavior | Transition condition |
|---|---|---|---|
| `LINE_SEARCH` | Floor region of interest | Rotate slowly or perform a short search pattern | Line detected for stable consecutive frames |
| `LINE_FOLLOW` | Line centroid and orientation | Follow the line at moderate speed | Station-zone cue detected or line reaches docking bay |
| `STATION_ZONE_APPROACH` | Line plus station-zone cue | Reduce speed and maintain line center | Final station marker/geometry acquired |
| `DOCKING_TARGET_ACQUIRE` | Station marker or bay geometry | Stop or creep slowly | Valid target pose across multiple frames |
| `FINE_ALIGN` | Station pose | Correct lateral and angular error | Errors fall below approach thresholds |
| `FINAL_APPROACH` | Station pose and obstacle corridor | Advance at very low speed | Docking pose reached |
| `VERIFY` | Station pose plus optional contact signal | Hold position | Conditions stable for dwell period |
| `OBSTACLE_STOP` | Obstacle detector and free-space mask | Command zero velocity | Obstacle absent for clearance dwell period |
| `LINE_LOST` | Last line position | Stop, reverse slightly, reacquire | Line reacquired or retry limit reached |
| `TARGET_LOST` | Last target pose | Stop, reverse or search locally | Target reacquired or retry limit reached |
| `RECOVERY` | Line, target, and safety inputs | Perform bounded recovery maneuver | New valid reference acquired |

The robot must not jump directly from a single noisy line detection to `FINAL_APPROACH`. Each transition should require temporal stability, such as three to five consecutive valid frames, to reduce false transitions.

## C. Line-Following Methodology

### C.1 Camera processing pipeline

1. Capture a forward-facing frame.
2. Crop a lower-region region of interest because the floor line is expected there.
3. Convert the region to HSV or a brightness-normalized color space.
4. Threshold the line color or brightness range.
5. Apply morphological opening and closing to remove speckles and fill small gaps.
6. Use connected components or contours to select the candidate line.
7. Fit a centerline or calculate the line centroid at two image heights.
8. Estimate lateral error and line angle.
9. Project the error into a simple robot-centered coordinate convention.
10. Send a bounded velocity command.

### C.2 Line detection choices

| Line environment | Detector | Strength | Failure mode |
|---|---|---|---|
| Bright tape on dark floor | HSV threshold and contour | Very fast and transparent | Sensitive to similar floor objects |
| Dark tape on bright floor | Inverted grayscale threshold | Minimal dependencies | Sensitive to shadows |
| Colored tape | HSV range with adaptive exposure | Easy to tune | Color shifts under lighting |
| Thin or broken line | Canny edges plus Hough line fitting | Recovers geometric edges | More false positives |
| Curved line | Sliding-window search or polynomial fit | Supports bends | More implementation effort |
| Variable lighting | Adaptive threshold plus temporal tracking | More robust | Requires careful tuning |

For a 24-hour event, use a high-contrast line with a known color and add an adaptive brightness fallback. The path should contain a visually distinct **station-zone marker**, such as a wide transverse bar, a colored patch, a large fiducial marker, or a line pattern that cannot be confused with ordinary route segments.

### C.3 Line controller

Let `e_c` be the normalized horizontal offset between the line center and the camera center, and let `e_a` be the line orientation error. A simple control law is:

\[
\omega = K_c e_c + K_a e_a
\]

\[
v = v_{base} \cdot g(|e_c|, |e_a|)
\]

where `g` reduces speed when the line error is large, the line is only partially visible, the station zone is near, or the obstacle confidence is elevated. Use a low-pass filter or exponential moving average on `e_c` to avoid steering jitter.

The robot should slow automatically when:

- the line is near the edge of the camera image;
- the line confidence decreases;
- the station-zone marker is detected;
- the line curvature increases;
- an obstacle is close to the corridor;
- the robot enters the final docking area.

### C.4 Line-loss recovery

If the line is missing for a short interval, hold zero velocity and use the last known line direction to perform a small alternating search. If the line remains missing, reverse a short distance and rotate toward the last known direction. Do not continue forward using a stale line estimate. After a bounded number of attempts, enter `FAILED` with reason `LINE_NOT_REACQUIRED`.

## D. Camera-Based Obstacle Detection

### D.1 Recommended two-layer safety approach

The obstacle system should not depend on a single AI model. Use two complementary tests:

**Layer 1: AI object detection.** Detect semantically meaningful objects such as people, boxes, carts, pallets, robots, and vehicles. An AI detection is useful even when the object is not a simple color or shape.

**Layer 2: geometric free-space check.** Define a trapezoidal or rectangular safety corridor in the lower and central image. Detect whether the corridor contains an object-like region, motion, or a major interruption of the expected floor pattern. This layer can stop for unknown objects that the model does not recognize.

The safety supervisor should use an OR rule for stopping:

```text
stop if:
    trusted_ai_obstacle_in_corridor
    OR free_space_confidence_is_low
    OR apparent_obstacle_distance_is_below_threshold
    OR detector_timeout_or_frame_stale
```

For resuming, use a stricter AND-like rule:

```text
resume only if:
    corridor_clear_for_clearance_dwell
    AND camera_frame_is_fresh
    AND line_or_station_reference_is_valid
    AND no emergency-stop condition is active
```

### D.2 Candidate free/open models

| Model or method | Use in this project | Benefits | Caveats |
|---|---|---|---|
| YOLO-World small model | Prompt-based detection of `person`, `box`, `cart`, `pallet`, `robot`, and `vehicle` | No custom training required; promptable; can track detections | Computational cost and Ultralytics license obligations must be checked |
| MobileNet-SSD through OpenCV DNN | Detect common COCO/VOC-style classes | Lightweight, CPU-friendly, simple deployment | Fixed class vocabulary; may miss unusual warehouse objects |
| YOLOv5 or another permissively licensed small detector | General object detection | Many pretrained checkpoints and examples | Verify exact repository and weights license before use |
| Background subtraction | Detect moving obstacles in a static camera scene | No AI model or training data | Does not detect stationary obstacles reliably |
| Optical flow | Detect motion and estimate collision risk | Useful for moving objects | Weak for static obstacles and camera motion |
| Color/contour/edge segmentation | Detect a block in the safety corridor | Fast and deterministic | Sensitive to floor texture and lighting |
| Monocular depth model | Estimate relative depth of image regions | Can detect broad near-field blockage | Metric distance and edge-device speed may be weak |
| RGB-D depth threshold | Reject objects closer than a configured range | Direct geometric safety signal | Requires depth camera and reflective-surface handling |

### D.3 Model choice for the hackathon

Use the following decision rule:

1. If a laptop or edge GPU is available, test YOLO-World small at reduced resolution with a fixed vocabulary. Run it at a lower rate than the line detector, for example 5–10 Hz, and track detections between inference frames.
2. If only CPU compute is available, use MobileNet-SSD or a small compatible detector through OpenCV DNN. Keep the line detector and free-space safety check at the full camera rate.
3. If model installation or licensing becomes a blocker, remove the AI model from the critical path and use free-space occupancy, optical flow, and a manually defined obstacle shape for the demo. The system should remain safe and functional.
4. Never interpret “no detection” as “no obstacle.” A missing AI detection must leave the free-space and stale-frame safety checks active.

### D.4 Camera obstacle corridor

Create a polygon representing the robot's near-field path. The polygon should be wider near the bottom of the image and narrower toward the horizon. The corridor width should correspond to the robot width plus a safety margin. A detected bounding box is considered hazardous when its lower-center point or a conservative fraction of its area intersects this polygon.

When the station is near, shrink the robot speed and widen the safety margin. When the robot is line-following in an open area, the system may use a larger look-ahead region. The obstacle detector does not need perfect distance estimation for the MVP if the behavior is deliberately conservative: detect a likely object in the corridor and stop.

## E. Revised Hybrid Architecture

```text
+------------------+       +---------------------+
| Forward Camera   | ----> | Frame Preprocessor  |
+------------------+       | ROI, HSV, resize    |
                           +----------+----------+
                                      |
             +------------------------+-------------------------+
             |                        |                         |
             v                        v                         v
   +------------------+     +------------------+      +------------------+
   | Line Detector    |     | Station Detector |      | AI Obstacle      |
   | Centroid/angle   |     | Marker/zone pose |      | Detector         |
   +--------+---------+     +--------+---------+      +--------+---------+
            |                        |                        |
            v                        v                        v
   +------------------+     +------------------+      +------------------+
   | Line Controller  |     | Docking Controller|      | Free-space /    |
   | Route guidance   |     | Fine alignment    |      | Corridor Check   |
   +--------+---------+     +--------+---------+      +--------+---------+
            |                        |                        |
            +------------------------+-------------------------+
                                     v
                           +-----------------------+
                           | Hybrid State Machine  |
                           | line -> dock -> verify|
                           +-----------+-----------+
                                       v
                           +-----------------------+
                           | Safety Supervisor     |
                           | stop, limit, timeout  |
                           +-----------+-----------+
                                       v
                           +-----------------------+
                           | Robot Base / Simulator|
                           +-----------------------+

                    All modules -> overlay, telemetry, replay
```

### E.1 Decision priority

The motion decision must follow this priority order:

1. Emergency-stop or sensor fault.
2. Obstacle stop or unsafe corridor.
3. Station final-docking controller when a valid docking target is available.
4. Station-zone slow approach.
5. Line-following controller.
6. Search or recovery behavior.

This prevents the line-following controller from commanding forward motion when the obstacle layer has identified a hazard.

## F. Revised Functional Requirements

| ID | Updated requirement | Priority | Acceptance criterion |
|---|---|---:|---|
| HY-01 | Detect and follow the route line | Must | Robot remains within a configured lateral path tolerance in repeated runs |
| HY-02 | Detect station-zone transition cue | Must | Robot switches from line following to docking mode at the intended zone |
| HY-03 | Acquire a final docking target | Must | Marker or station geometry is validated across consecutive frames |
| HY-04 | Detect semantic obstacles using an AI model when available | Should | At least the selected test classes are detected in the demo environment |
| HY-05 | Detect unknown blocking regions using free-space analysis | Must | A manually placed block in the safety corridor triggers a stop even if the AI model does not recognize its class |
| HY-06 | Fuse line, docking, and obstacle outputs | Must | Safety output overrides navigation output in every test |
| HY-07 | Recover from line loss | Must | Robot stops, searches, and either reacquires the line or fails safely |
| HY-08 | Resume only after obstacle clearance | Must | Robot remains stopped during the clearance dwell period |
| HY-09 | Verify final docking pose | Must | Success requires final alignment, low speed, dwell time, and optional contact feedback |
| HY-10 | Record model name and license | Should | Run metadata includes detector, version, weights, and license notes |

## G. Revised 24-Hour Implementation Plan

| Time | Hybrid deliverable |
|---|---|
| 0–1 h | Freeze line color, path layout, station-zone cue, robot speed, and safety boundaries |
| 1–3 h | Implement camera capture, lower-image ROI, line thresholding, contour selection, and overlay |
| 3–5 h | Implement line-following controller and test on a straight and mildly curved path |
| 5–7 h | Add station-zone marker and transition state; slow the robot near the charging area |
| 7–9 h | Add AprilTag/ArUco or station-geometry final docking detector |
| 9–11 h | Implement final alignment controller, verification dwell, and docking result |
| 11–14 h | Integrate AI obstacle detector; test fixed prompts or the lightweight CPU model |
| 14–16 h | Implement corridor polygon, free-space check, stale-frame timeout, and safety override |
| 16–18 h | Add line-loss recovery, obstacle clearance dwell, retries, and telemetry |
| 18–20 h | Execute test matrix under different lighting, offsets, and obstacle placements |
| 20–22 h | Freeze the primary demo path, create replay mode, record backup video, and collect metrics |
| 22–24 h | Rehearse the demo, document model/license details, package code, and submit |

### G.1 Cut order if the team is behind schedule

Cut features in this order:

1. Custom training or fine-tuning.
2. YOLO-World prompt experimentation.
3. Full obstacle avoidance and re-planning; retain stop-only safety behavior.
4. Curved-line support; retain a straight or gently curved prepared path.
5. Live charging-current integration; retain visual alignment plus a simulated contact signal.

Do not cut the safety supervisor, stale-frame stop, line-loss stop, docking verification, or replay mode.

## H. Revised Evaluation Matrix

| Test | Scenario | Expected result |
|---|---|---|
| H01 | Straight high-contrast line, no obstacle | Stable line following and docking |
| H02 | Robot starts left of line | Converges without leaving the path |
| H03 | Robot starts right of line | Converges without oscillation |
| H04 | Mild line bend | Slows and follows the bend |
| H05 | Line partially occluded | Stops or boundedly reacquires; no blind forward motion |
| H06 | Station-zone cue visible | Switches to docking mode at the correct point |
| H07 | Person or box in corridor | AI detection and safety corridor trigger stop |
| H08 | Unknown object not in AI vocabulary | Free-space/corridor check triggers stop |
| H09 | Obstacle removed | Resumes only after clearance dwell and valid line/target |
| H10 | Low light or exposure shift | Line detector uses preprocessing or fails safely |
| H11 | Wrong station marker | Rejects target identity |
| H12 | Target temporarily lost | Stops and recovers or reports bounded failure |
| H13 | Camera frame timeout | Safety supervisor commands zero velocity |
| H14 | Final alignment offset | Fine controller corrects before verification |

## I. Suggested Repository Additions

```text
robot-docking/
├── docking/
│   ├── line_detector.py
│   ├── line_controller.py
│   ├── station_zone_detector.py
│   ├── station_pose_detector.py
│   ├── obstacle_ai.py
│   ├── free_space_detector.py
│   ├── obstacle_fusion.py
│   ├── hybrid_state_machine.py
│   ├── safety.py
│   └── telemetry.py
├── models/
│   ├── README.md
│   └── LICENSES.md
├── config/
│   ├── docking.yaml
│   ├── line.yaml
│   └── obstacle.yaml
├── tests/
│   ├── test_line_detector.py
│   ├── test_obstacle_fusion.py
│   └── test_hybrid_state_machine.py
└── scripts/
    ├── run_hybrid_docking.py
    ├── replay_hybrid_run.py
    └── evaluate_hybrid_runs.py
```

## J. Improved Demonstration Story

The robot begins away from the station and is deliberately offset from the floor line. It searches briefly, detects the line, and follows it. The overlay shows the line mask, center error, steering command, and state. Near the charging station, a station-zone cue causes the robot to slow and switch from route following to docking target acquisition.

A box or person-shaped object is then placed in the camera corridor. The AI detector displays the detection, while the safety polygon highlights the blocked path. The robot stops and reports `OBSTACLE_STOP`. The object is removed. After the corridor remains clear for the configured dwell period, the robot resumes, acquires the station marker, corrects its final lateral and angular error, and reports `VISUALLY_ALIGNED` or `CHARGING_CONFIRMED` depending on available feedback.

This narrative demonstrates three independent strengths: a low-data route-following method, an AI-assisted perception layer, and a conservative safety mechanism that can stop for objects outside the model's vocabulary.

## K. Final Updated Recommendation

Adopt the hybrid method, but define it as **line following for route guidance, marker or station geometry for final docking, and AI plus geometric free-space analysis for safety**. Do not use an object detector as a direct motion planner. Its role is to raise a safety event. Do not use the floor line as the final docking reference. Its role ends when the robot reaches the station zone.

The most practical 24-hour build is a high-contrast taped line, a clearly marked station zone, an AprilTag or equivalent final marker, a proportional line controller, a low-speed visual docking controller, a stop-only obstacle supervisor, and a replayable camera test harness. YOLO-World can be added as the free, promptable AI detector when compute and licensing assumptions are acceptable. Otherwise, MobileNet-SSD or classical corridor occupancy can provide a reliable fallback.

This architecture reduces the search space, lowers the amount of required training data, makes the demo visually understandable, and preserves a credible path toward production through later upgrades such as RGB-D or LiDAR fusion, learned line segmentation, multi-station identity, and dynamic obstacle planning.

---

## Additional References for Revision 2

[11]: https://docs.ultralytics.com/models/yolo-world "Ultralytics YOLO-World Model Documentation"

[12]: https://www.ultralytics.com/license "Ultralytics Licensing Information"
