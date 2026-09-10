"""
V-DOCKX Evaluation Metrics Script
Analyzes JSONL telemetry logs from results/ and generates quantitative performance reports.
"""

import json
import glob
import math
import os
import sys
from typing import List, Dict, Any

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def evaluate_logs(results_dir: str = "results") -> Dict[str, Any]:
    log_files = glob.glob(os.path.join(results_dir, "*.jsonl"))

    if not log_files:
        print(f"No .jsonl telemetry logs found in '{results_dir}'.")
        return {}

    print(f"Analyzing {len(log_files)} telemetry run logs in '{results_dir}'...")

    total_runs = len(log_files)
    successful_docks = 0
    durations: List[float] = []
    final_lateral_errors: List[float] = []
    final_heading_errors: List[float] = []
    final_distance_errors: List[float] = []
    total_obstacle_stops = 0

    target_distance = 0.12  # 12 cm
    lateral_tol = 0.03      # 3 cm
    heading_tol = 0.08      # ~4.5 deg

    for file_path in log_files:
        entries: List[Dict[str, Any]] = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

        if not entries:
            continue

        first = entries[0]
        last = entries[-1]

        duration = max(0.0, last.get("timestamp", 0.0) - first.get("timestamp", 0.0))
        durations.append(duration)

        # Final errors
        lat_err = abs(last.get("lateral_offset_m", 0.0))
        head_err = abs(last.get("heading_error_rad", 0.0))
        dist_err = abs(last.get("distance_m", target_distance) - target_distance)

        final_lateral_errors.append(lat_err)
        final_heading_errors.append(head_err)
        final_distance_errors.append(dist_err)

        # Obstacle stops
        stops = sum(1 for e in entries if e.get("corridor_blocked", False))
        total_obstacle_stops += stops

        # Docking success criteria
        is_docked = last.get("state") in ("DOCKED", "VISUALLY_ALIGNED") or (
            lat_err <= lateral_tol and head_err <= heading_tol and dist_err <= 0.03
        )
        if is_docked:
            successful_docks += 1

    success_rate = (successful_docks / total_runs) * 100.0 if total_runs > 0 else 0.0
    mean_duration = sum(durations) / len(durations) if durations else 0.0
    mean_lat_cm = (sum(final_lateral_errors) / len(final_lateral_errors)) * 100.0 if final_lateral_errors else 0.0
    max_lat_cm = max(final_lateral_errors) * 100.0 if final_lateral_errors else 0.0
    mean_head_deg = math.degrees(sum(final_heading_errors) / len(final_heading_errors)) if final_heading_errors else 0.0
    max_head_deg = math.degrees(max(final_heading_errors)) if final_heading_errors else 0.0
    mean_dist_cm = (sum(final_distance_errors) / len(final_distance_errors)) * 100.0 if final_distance_errors else 0.0

    report = {
        "total_runs": total_runs,
        "successful_docks": successful_docks,
        "success_rate_pct": round(success_rate, 1),
        "mean_duration_s": round(mean_duration, 2),
        "mean_lateral_error_cm": round(mean_lat_cm, 2),
        "max_lateral_error_cm": round(max_lat_cm, 2),
        "mean_heading_error_deg": round(mean_head_deg, 2),
        "max_heading_error_deg": round(max_head_deg, 2),
        "mean_distance_error_cm": round(mean_dist_cm, 2),
        "total_obstacle_stops": total_obstacle_stops,
    }

    # Print summary
    print("\n" + "=" * 65)
    print("           V-DOCKX QUANTITATIVE EVALUATION SUMMARY")
    print("=" * 65)
    print(f"Total Evaluated Runs:        {report['total_runs']}")
    print(f"Docking Success Rate:        {report['success_rate_pct']}% (Target: >= 85%)")
    print(f"Mean Docking Duration:       {report['mean_duration_s']}s (Target: <= 60s)")
    print(f"Mean Lateral Error:          {report['mean_lateral_error_cm']} cm (Tolerance: <= 3.0 cm)")
    print(f"Max Lateral Error:           {report['max_lateral_error_cm']} cm")
    print(f"Mean Heading Error:          {report['mean_heading_error_deg']} deg (Tolerance: <= 5.0 deg)")
    print(f"Max Heading Error:           {report['max_heading_error_deg']} deg")
    print(f"Mean Final Distance Error:   {report['mean_distance_error_cm']} cm (Tolerance: <= 3.0 cm)")
    print(f"Total Corridor Stops:        {report['total_obstacle_stops']}")
    print("=" * 65)

    return report


if __name__ == "__main__":
    evaluate_logs()
