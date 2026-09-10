"""
V-DOCKX Robot Command Adapter & Simulation Engine
Translates velocity commands into robot base movements or 2D kinematic simulation.
"""

import math
import time
from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any
from docking.contracts import ControlCommand


class BaseRobotAdapter(ABC):
    """Abstract interface for robot communication."""

    @abstractmethod
    def send_command(self, cmd: ControlCommand) -> None:
        """Send velocity command to robot base."""
        pass

    @abstractmethod
    def get_pose(self) -> Tuple[float, float, float]:
        """Return (x, y, theta) pose in meters and radians."""
        pass

    @abstractmethod
    def stop(self) -> None:
        """Emergency zero-velocity stop."""
        pass


class SimulatedRobotAdapter(BaseRobotAdapter):
    """
    2D Kinematic Differential Drive Simulator (Unicycle Model).
    Equations of Motion:
        x_new = x + v * cos(theta) * dt
        y_new = y + v * sin(theta) * dt
        theta_new = theta + omega * dt
    """

    def __init__(
        self,
        x: float = 0.0,
        y: float = 0.0,
        theta: float = 0.0,
    ):
        self.initial_x = x
        self.initial_y = y
        self.initial_theta = theta

        self.x = x
        self.y = y
        self.theta = theta

        self.current_linear_v = 0.0
        self.current_angular_w = 0.0
        self.last_update_time = time.time()
        self.trajectory_history: List[Tuple[float, float, float]] = [(x, y, theta)]

    def reset(self, x: float = 0.0, y: float = 0.0, theta: float = 0.0) -> None:
        """Reset simulation pose."""
        self.x = x
        self.y = y
        self.theta = theta
        self.current_linear_v = 0.0
        self.current_angular_w = 0.0
        self.last_update_time = time.time()
        self.trajectory_history = [(x, y, theta)]

    def send_command(self, cmd: ControlCommand) -> None:
        """Receive command and integrate motion over elapsed time."""
        now = cmd.timestamp if cmd.timestamp > 0 else time.time()
        dt = max(0.001, min(0.5, now - self.last_update_time))
        self.step(dt, cmd.linear_velocity_mps, cmd.angular_velocity_rps)
        self.last_update_time = now

    def step(self, dt: float, v: float, omega: float) -> Tuple[float, float, float]:
        """Directly advance kinematic state by dt seconds."""
        self.current_linear_v = v
        self.current_angular_w = omega

        # Unicycle model integration
        self.x += v * math.cos(self.theta) * dt
        self.y += v * math.sin(self.theta) * dt
        self.theta += omega * dt

        # Normalize theta to [-pi, pi]
        self.theta = (self.theta + math.pi) % (2 * math.pi) - math.pi

        self.trajectory_history.append((round(self.x, 4), round(self.y, 4), round(self.theta, 4)))
        return self.get_pose()

    def get_pose(self) -> Tuple[float, float, float]:
        return (round(self.x, 4), round(self.y, 4), round(self.theta, 4))

    def stop(self) -> None:
        self.current_linear_v = 0.0
        self.current_angular_w = 0.0
        self.last_update_time = time.time()

    def get_telemetry_dict(self) -> Dict[str, Any]:
        return {
            "x": round(self.x, 4),
            "y": round(self.y, 4),
            "theta_rad": round(self.theta, 4),
            "theta_deg": round(math.degrees(self.theta), 2),
            "linear_v": round(self.current_linear_v, 4),
            "angular_w": round(self.current_angular_w, 4),
        }
