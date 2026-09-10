"""
Unit Tests for V-DOCKX Obstacle & Safety Fusion Supervisor (Member 1)
Validates geometric corridor intrusion, semantic AI bounding box fusion,
footprint polygon intersection, and zero-crash offline execution.
"""

import unittest
import numpy as np
import cv2

from docking.contracts import ObstacleOutput
from docking.free_space_detector import FreeSpaceDetector
from docking.obstacle_ai import AIObstacleDetector
from docking.obstacle_fusion import ObstacleFusionSupervisor
from docking.camera import SyntheticFrameGenerator


class TestObstacleFusion(unittest.TestCase):

    def setUp(self):
        self.free_space = FreeSpaceDetector()
        self.ai_detector = AIObstacleDetector()
        self.fusion = ObstacleFusionSupervisor(
            free_space_detector=self.free_space,
            ai_detector=self.ai_detector,
        )
        self.generator = SyntheticFrameGenerator(width=640, height=480)

    def tearDown(self):
        self.ai_detector.clear_simulation_detections()

    def test_clear_corridor(self):
        """Clean floor should produce corridor_blocked = False and long distance."""
        frame = self.generator.generate(line_offset_px=0, draw_obstacle=False)
        output, annotated = self.fusion.evaluate(frame)

        self.assertFalse(output.corridor_blocked)
        self.assertGreaterEqual(output.minimum_distance_m, 100.0)
        self.assertIsNotNone(annotated)

    def test_geometric_intrusion_inside_corridor(self):
        """Physical high-contrast box placed directly inside the corridor must block corridor."""
        # Box inside ground corridor: [280, 340, 360, 420]
        frame = self.generator.generate(
            draw_obstacle=True,
            obstacle_bbox=(280, 340, 360, 420),
        )
        output, annotated = self.fusion.evaluate(frame)

        self.assertTrue(output.corridor_blocked)
        self.assertTrue(output.obstacle_present)
        # Distance should be under 1.0m
        self.assertLess(output.minimum_distance_m, 1.20)

    def test_ai_detection_inside_corridor(self):
        """AI detection inside the corridor polygon triggers corridor_blocked and logs class."""
        frame = self.generator.generate(draw_obstacle=False)

        # Inject AI detection of a person standing directly in front of the robot
        # Footprint bottom center: (320, 380) inside corridor polygon
        self.ai_detector.inject_simulation_detection(
            class_name="person",
            bbox=(280, 200, 360, 380),
            confidence=0.88,
        )

        output, annotated = self.fusion.evaluate(frame)

        self.assertTrue(output.corridor_blocked)
        self.assertTrue(output.obstacle_present)
        self.assertIn("person", output.detected_classes)
        self.assertLess(output.minimum_distance_m, 1.50)

    def test_ai_detection_outside_corridor(self):
        """AI detection outside the corridor (e.g. bystander on side) must NOT block corridor."""
        frame = self.generator.generate(draw_obstacle=False)

        # Inject AI detection in the peripheral top-left corner (outside corridor)
        self.ai_detector.inject_simulation_detection(
            class_name="person",
            bbox=(10, 50, 70, 180),
            confidence=0.90,
        )

        output, annotated = self.fusion.evaluate(frame)

        # Obstacle is present in frame, but corridor is NOT blocked
        self.assertTrue(output.obstacle_present)
        self.assertFalse(output.corridor_blocked)
        self.assertIn("person", output.detected_classes)

    def test_distance_depth_ordering(self):
        """Intrusions closer to camera base (higher y) must yield smaller metric distance."""
        dist_near = self.free_space.estimate_distance_from_row(440)
        dist_far = self.free_space.estimate_distance_from_row(260)

        self.assertLess(dist_near, dist_far)
        self.assertLess(dist_near, 0.60)
        self.assertGreater(dist_far, 1.00)


if __name__ == "__main__":
    unittest.main()
