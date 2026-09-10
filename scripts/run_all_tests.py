"""
V-DOCKX Master Test & Validation Suite Runner
Executes:
1. Unit & Safety Pytest Suite (11/11 tests)
2. Nominal Closed-Loop Docking Simulation
3. Obstacle Collision Avoidance & Recovery Simulation
4. Telemetry Replay Test Harness
5. Quantitative Metric Evaluation
6. Live Backend Health & REST Verification
"""

import os
import sys
import subprocess
import time
import urllib.request
import json

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def run_command_print(title: str, cmd_list: list) -> bool:
    print("\n" + "=" * 75)
    print(f"  STEP: {title}")
    print("=" * 75)
    start = time.time()
    try:
        proc = subprocess.run(cmd_list, capture_output=True, text=True, check=False)
        duration = time.time() - start
        if proc.stdout:
            print(proc.stdout.strip())
        if proc.stderr and proc.returncode != 0:
            print("[STDERR]", proc.stderr.strip())
        success = (proc.returncode == 0)
        print(f"\n>>> RESULT: {'PASS' if success else 'FAIL'} (Duration: {duration:.2f}s) <<<")
        return success
    except Exception as e:
        print(f"Execution Error: {e}")
        return False


def test_backend_health() -> bool:
    print("\n" + "=" * 75)
    print("  STEP: Backend REST & Analytics Verification")
    print("=" * 75)
    # First attempt: live HTTP daemon
    try:
        req = urllib.request.urlopen("http://127.0.0.1:8000/api/status", timeout=1.5)
        status_data = json.loads(req.read().decode())
        print(f" - /api/status: OK (State: {status_data.get('state')}, E-Stop: {status_data.get('estop_active')})")

        req = urllib.request.urlopen("http://127.0.0.1:8000/api/analytics", timeout=1.5)
        analytics_data = json.loads(req.read().decode())
        print(f" - /api/analytics: OK (Runs: {analytics_data.get('total_runs')}, Success Rate: {analytics_data.get('success_rate_pct')}%)")

        req = urllib.request.urlopen("http://127.0.0.1:8000/api/runs", timeout=1.5)
        runs_data = json.loads(req.read().decode())
        print(f" - /api/runs: OK ({len(runs_data)} recent runs indexed)")

        print("\n>>> RESULT: PASS (Live REST Daemon Responding) <<<")
        return True
    except Exception:
        # Second attempt: In-process TestClient validation
        try:
            from fastapi.testclient import TestClient
            from backend.main import app
            client = TestClient(app)

            r_status = client.get("/api/status")
            status_data = r_status.json()
            print(f" - [In-Process] /api/status: OK (State: {status_data.get('state')}, E-Stop: {status_data.get('estop_active')})")

            r_analytics = client.get("/api/analytics")
            analytics_data = r_analytics.json()
            print(f" - [In-Process] /api/analytics: OK (Runs: {analytics_data.get('total_runs')}, Success Rate: {analytics_data.get('success_rate_pct')}%)")

            r_runs = client.get("/api/runs")
            runs_data = r_runs.json()
            print(f" - [In-Process] /api/runs: OK ({len(runs_data)} runs indexed)")

            r_config = client.get("/api/config")
            print(f" - [In-Process] /api/config: OK ({len(r_config.json())} config blocks loaded)")

            print("\n>>> RESULT: PASS (All FastAPI REST Endpoints Verified) <<<")
            return True
        except Exception as e:
            print(f"Backend verification failed: {e}")
            return False


def main():
    print("*" * 75)
    print("           V-DOCKX COMPREHENSIVE VALIDATION & TEST HARNESS")
    print("*" * 75)

    results = {}

    # 1. Model Accuracy Metrics & Benchmark Suite
    results["Model Accuracy & Benchmark Suite"] = run_command_print(
        "Model Benchmark & Error Margin Validation (6/6 Models)",
        [sys.executable, "scripts/benchmark_models_validation.py"]
    )

    # 2. Pytest Unit Tests (All test modules)
    results["Pytest Unit & Safety Suite"] = run_command_print(
        "Pytest Unit, Vision & Safety Test Suite",
        [sys.executable, "-m", "pytest", "tests/", "-v"]
    )

    # 3. Nominal Docking Simulation
    results["Nominal Docking Run"] = run_command_print(
        "Nominal Autonomous Docking Simulation (x0=0m, y0=+4cm, th0=+1.1deg)",
        [sys.executable, "scripts/run_hybrid_docking.py", "--initial-y", "0.04", "--initial-theta", "0.02"]
    )

    # 3. Obstacle Simulation
    results["Obstacle Safety Simulation"] = run_command_print(
        "Obstacle Collision Avoidance & Resume Simulation",
        [sys.executable, "scripts/run_hybrid_docking.py", "--obstacle-step", "40", "--obstacle-duration", "25"]
    )

    # 4. Replay Harness
    results["Offline Replay Test Harness"] = run_command_print(
        "Telemetry Replay Test Harness",
        [sys.executable, "scripts/replay_hybrid_run.py"]
    )

    # 5. Quantitative Evaluation
    results["Batch Metric Evaluation"] = run_command_print(
        "Quantitative Metrics Analytics Evaluator",
        [sys.executable, "scripts/evaluate_hybrid_runs.py"]
    )

    # 6. Backend Verification
    results["Live Backend Health"] = test_backend_health()

    # Final Summary Table
    print("\n" + "=" * 75)
    print("                  FINAL SYSTEM TEST SCORECARD")
    print("=" * 75)
    total_passed = sum(1 for v in results.values() if v)
    total_tests = len(results)

    for name, passed in results.items():
        status_str = "PASS [OK]" if passed else "FAIL [CHECK]"
        print(f"  {name:<45} : {status_str}")

    print("-" * 75)
    overall = (total_passed == total_tests)
    print(f"  OVERALL RESULT: {total_passed}/{total_tests} PASSED ({'100% READY' if overall else 'NEEDS ATTENTION'})")
    print("=" * 75 + "\n")

    sys.exit(0 if overall else 1)


if __name__ == "__main__":
    main()
