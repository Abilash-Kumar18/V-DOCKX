"""
V-DOCKX Telemetry Logger
Structured JSON Lines and CSV logging for real-time state, perception errors, and commands.
"""

import json
import os
import time
from typing import Optional, Dict, Any, List


class TelemetryLogger:
    """
    Logs high-frequency telemetry records to machine-readable JSONL and summary CSV files.
    """

    def __init__(self, run_id: Optional[str] = None, output_dir: str = "results"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

        timestamp_str = time.strftime("%Y%m%d_%H%M%S")
        self.run_id = run_id or f"run_{timestamp_str}"
        self.jsonl_path = os.path.join(self.output_dir, f"{self.run_id}.jsonl")
        self.log_file = open(self.jsonl_path, "a", encoding="utf-8")
        self.record_count = 0

    def log(
        self,
        state: str,
        linear_velocity: float = 0.0,
        angular_velocity: float = 0.0,
        distance_m: float = 0.0,
        lateral_offset_m: float = 0.0,
        heading_error_rad: float = 0.0,
        corridor_blocked: bool = False,
        confidence: float = 0.0,
        reason: str = "",
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Record one timestamped telemetry entry."""
        now = time.time()
        entry = {
            "timestamp": now,
            "run_id": self.run_id,
            "state": state,
            "linear_velocity_mps": round(linear_velocity, 4),
            "angular_velocity_rps": round(angular_velocity, 4),
            "distance_m": round(distance_m, 4),
            "lateral_offset_m": round(lateral_offset_m, 4),
            "heading_error_rad": round(heading_error_rad, 4),
            "corridor_blocked": corridor_blocked,
            "confidence": round(confidence, 3),
            "reason": reason,
        }
        if extra:
            entry.update(extra)

        self.log_file.write(json.dumps(entry) + "\n")
        self.log_file.flush()
        self.record_count += 1
        return entry

    def close(self) -> None:
        """Close log file."""
        if not self.log_file.closed:
            self.log_file.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
