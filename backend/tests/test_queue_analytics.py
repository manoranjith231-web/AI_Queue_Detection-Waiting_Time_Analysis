import pytest
from backend.app.services.queue_analytics import QueueAnalyticsEngine

def test_waiting_time_formula():
    engine = QueueAnalyticsEngine()
    
    # When 1 person is at register: people_ahead = 0, wait time = 0
    res1 = engine.estimate_waiting_time(counter_id=1, people_count=1, configured_service_time_sec=120.0)
    assert res1["people_ahead"] == 0
    assert res1["estimated_wait_time_sec"] == 0.0
    
    # When 4 people are in queue: people_ahead = 3, wait time = 3 * 120 = 360 sec (6.0 min)
    res4 = engine.estimate_waiting_time(counter_id=1, people_count=4, configured_service_time_sec=120.0)
    assert res4["people_ahead"] == 3
    assert res4["estimated_wait_time_sec"] == 360.0
    assert res4["estimated_wait_time_min"] == 6.0
    assert res4["is_calibrated"] is False # initially uses configured time

def test_congestion_levels():
    engine = QueueAnalyticsEngine()
    threshold = 4
    
    # 2 people (< threshold) -> Normal
    cong_norm = engine.compute_congestion_status(people_count=2, congestion_threshold=threshold)
    assert cong_norm["level"] == "Normal"
    
    # 4 people (>= threshold, < threshold+2) -> Warning
    cong_warn = engine.compute_congestion_status(people_count=4, congestion_threshold=threshold)
    assert cong_warn["level"] == "Warning"
    
    # 6 people (>= threshold+2) -> Critical
    cong_crit = engine.compute_congestion_status(people_count=6, congestion_threshold=threshold)
    assert cong_crit["level"] == "Critical"

def test_smoothing_window():
    engine = QueueAnalyticsEngine(smoothing_window=3)
    # Feed noisy sequence: 2, 4, 3
    s1 = engine.record_raw_count(counter_id=1, raw_count=2)
    s2 = engine.record_raw_count(counter_id=1, raw_count=4)
    s3 = engine.record_raw_count(counter_id=1, raw_count=3)
    # Average of [2, 4, 3] = 3
    assert s3 == 3
