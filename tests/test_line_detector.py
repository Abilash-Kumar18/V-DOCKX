"""
Unit Tests for V-DOCKX Vision & Line Detection Pipeline (Member 1)
Validates line tracking, centroid errors, heading angles, CLAHE invariance,
station zone cues, and 6-DoF fiducial pose estimation.
"""

import math
import unittest
import numpy as np
import cv2

from docking.contracts import LineDetectionOutput, PerceptionOutput
from docking.line_detector import LineDetector
from docking.station_zone_detector import StationZoneDetector
from docking.station_pose_detector import StationPoseDetector
from docking.pose_filter import PoseFilter
from docking.camera import SyntheticFrameGenerator


class TestLineDetector(unittest.TestCase):

    def setUp(self):
        self.detector = LineDetector()
        self.generator = SyntheticFrameGenerator(width=640, height=480)

    def test_centered_line(self):
        """Centered line should produce near-zero centroid error and near-zero angle."""
        frame = self.generator.generate(line_offset_px=0, line_angle_deg=0.0)
        output = self.detector.detect(frame)

        self.assertTrue(output.detected)
        self.assertAlmostEqual(output.centroid_error_norm, 0.0, delta=0.08)
        self.assertAlmostEqual(output.angle_error_rad, 0.0, delta=0.08)
        self.assertGreater(output.confidence, 0.50)
        self.assertIsNotNone(output.annotated_frame)

    def test_offset_left_and_right(self):
        """Verifies correct sign of centroid error for lateral displacements."""
        # Line offset to left (-px) -> e_c < 0
        frame_left = self.generator.generate(line_offset_px=-120, line_angle_deg=0.0)
        out_left = self.detector.detect(frame_left)
        self.assertTrue(out_left.detected)
        self.assertLess(out_left.centroid_error_norm, -0.20)

        # Line offset to right (+px) -> e_c > 0
        frame_right = self.generator.generate(line_offset_px=+120, line_angle_deg=0.0)
        out_right = self.detector.detect(frame_right)
        self.assertTrue(out_right.detected)
        self.assertGreater(out_right.centroid_error_norm, +0.20)

    def test_angled_line(self):
        """Verifies that line slant produces non-zero heading error e_a."""
        # Slant to the right (+15 deg)
        frame_angled = self.generator.generate(line_offset_px=0, line_angle_deg=15.0)
        out_angled = self.detector.detect(frame_angled)

        self.assertTrue(out_angled.detected)
        self.assertGreater(out_angled.angle_error_rad, 0.10)

    def test_missing_line(self):
        """Uniform blank frame should yield detected=False and confidence=0.0."""
        blank_frame = np.full((480, 640, 3), 150, dtype=np.uint8)
        output = self.detector.detect(blank_frame)

        self.assertFalse(output.detected)
        self.assertEqual(output.centroid_error_norm, 0.0)
        self.assertEqual(output.angle_error_rad, 0.0)
        self.assertEqual(output.confidence, 0.0)

    def test_clahe_lighting_robustness(self):
        """Line must still be detected under dim shadow and bright lighting."""
        base_frame = self.generator.generate(line_offset_px=0, line_angle_deg=0.0)

        # Dim frame (50% brightness)
        dim_frame = (base_frame * 0.50).astype(np.uint8)
        out_dim = self.detector.detect(dim_frame)
        self.assertTrue(out_dim.detected)

        # Bright frame with glare
        bright_frame = np.clip(base_frame.astype(np.int32) + 60, 0, 255).astype(np.uint8)
        out_bright = self.detector.detect(bright_frame)
        self.assertTrue(out_bright.detected)


class TestStationZoneAndPose(unittest.TestCase):

    def test_station_zone_transverse_bar(self):
        """Transverse horizontal bar across path triggers station zone approach."""
        zone_detector = StationZoneDetector(debounce_frames=1)
        frame = np.full((480, 640, 3), 180, dtype=np.uint8)

        # Draw a wide transverse yellow stop strip across 70% of the frame in lower-mid region
        cv2.rectangle(frame, (80, 260), (560, 310), (0, 215, 255), -1)

        detected, conf, meta = zone_detector.detect(frame)
        self.assertTrue(detected)
        self.assertGreater(conf, 0.70)
        self.assertEqual(meta["reason"], "transverse_stop_strip")

    def test_aruco_pose_detection(self):
        """Synthesized ArUco marker should be detected with valid 6-DoF metric outputs."""
        pose_detector = StationPoseDetector(target_station_id=0, marker_size_m=0.12)
        generator = SyntheticFrameGenerator(width=640, height=480)

        # Generate frame with ArUco marker 0 centered in upper-middle view
        frame = generator.generate(
            draw_marker=True,
            marker_id=0,
            marker_center=(320, 220),
            marker_size_px=80,
        )

        output = pose_detector.detect(frame)
        self.assertTrue(output.detected)
        self.assertEqual(output.station_id, 0)
        # Marker distance should be positive and reasonable (~0.5 - 2.0m)
        self.assertGreater(output.distance_m, 0.20)
        self.assertLess(output.distance_m, 3.0)
        self.assertAlmostEqual(output.lateral_offset_m, 0.0, delta=0.25)
        self.assertGreater(output.confidence, 0.50)

    def test_pose_filter_smoothing_and_outlier_clamping(self):
        """PoseFilter should smooth high-frequency jitter and clamp abrupt jumps."""
        pfilter = PoseFilter(alpha_position=0.50, max_jump_distance_m=0.30)

        # 1. First reading
        m1 = PerceptionOutput(detected=True, distance_m=1.00, lateral_offset_m=0.10, heading_error_rad=0.0)
        f1 = pfilter.update(m1)
        self.assertAlmostEqual(f1.distance_m, 1.00, places=2)

        # 2. Small noisy reading (1.04m)
        m2 = PerceptionOutput(detected=True, distance_m=1.04, lateral_offset_m=0.12, heading_error_rad=0.02)
        f2 = pfilter.update(m2)
        # Should be EMA average (0.5 * 1.04 + 0.5 * 1.00 = 1.02)
        self.assertAlmostEqual(f2.distance_m, 1.02, delta=0.01)

        # 3. Massive outlier jump (e.g. glitch reading 3.50m)
        m3 = PerceptionOutput(detected=True, distance_m=3.50, lateral_offset_m=0.12, heading_error_rad=0.02)
        f3 = pfilter.update(m3)
        # The jump of 2.48m exceeds max_jump_distance_m (0.30m), so input was clamped to ~1.32m
        self.assertLess(f3.distance_m, 1.30)


if __name__ == "__main__":
    unittest.main()
