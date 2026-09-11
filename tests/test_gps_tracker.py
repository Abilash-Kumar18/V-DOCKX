import pytest
from docking.gps_tracker import GPSTracker

def test_gps_tracker_same_location():
    tracker = GPSTracker(dock_lat=13.0827, dock_lng=80.2707)
    res = tracker.compute_relative_pose(phone_lat=13.0827, phone_lng=80.2707, compass_heading=0.0)
    assert res["distance_to_dock_m"] == 0.0
    assert res["dx_meters"] == 0.0
    assert res["dy_meters"] == 0.0

def test_gps_tracker_displacement_north():
    # 0.0001 deg lat is approx 11.1 meters North
    tracker = GPSTracker(dock_lat=13.0827, dock_lng=80.2707)
    res = tracker.compute_relative_pose(phone_lat=13.0828, phone_lng=80.2707, compass_heading=180.0)
    assert res["dy_meters"] > 10.0
    assert abs(res["dx_meters"]) < 0.1
    assert 10.0 < res["distance_to_dock_m"] < 12.0
    # Dock is South from phone, so bearing to dock should be ~180 degrees
    assert abs(res["bearing_to_dock_deg"] - 180.0) < 1.0

def test_gps_tracker_set_anchor():
    tracker = GPSTracker()
    tracker.set_dock_anchor(37.7749, -122.4194)
    assert tracker.dock_lat == 37.7749
    assert tracker.dock_lng == -122.4194
