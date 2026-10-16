import pytest
from backend.app.services.recommendation_engine import RecommendationEngine

def test_overload_recommendation():
    counters = [
        {
            "id": 1,
            "name": "Counter 1",
            "is_active": 1,
            "people_count": 7,
            "congestion_threshold": 4,
            "congestion_level": "Critical",
            "estimated_wait_time_sec": 720.0,
            "estimated_wait_time_min": 12.0
        },
        {
            "id": 2,
            "name": "Counter 2",
            "is_active": 1,
            "people_count": 1,
            "congestion_threshold": 4,
            "congestion_level": "Normal",
            "estimated_wait_time_sec": 0.0,
            "estimated_wait_time_min": 0.0
        }
    ]
    
    recs = RecommendationEngine.generate_recommendations(counters, {"avg_wait_time_min": 6.0})
    
    # Check that overload recommendation was generated
    overload_recs = [r for r in recs if r["category"] == "STAFFING" and r["priority"] == "URGENT"]
    assert len(overload_recs) >= 1
    assert "Counter 1" in overload_recs[0]["title"]

def test_queue_rebalancing_recommendation():
    counters = [
        {
            "id": 1,
            "name": "Counter 1",
            "is_active": 1,
            "people_count": 5,
            "congestion_threshold": 4,
            "congestion_level": "Warning",
            "estimated_wait_time_sec": 480.0, # 8 mins
            "estimated_wait_time_min": 8.0
        },
        {
            "id": 2,
            "name": "Counter 2",
            "is_active": 1,
            "people_count": 1,
            "congestion_threshold": 4,
            "congestion_level": "Normal",
            "estimated_wait_time_sec": 60.0,  # 1 min
            "estimated_wait_time_min": 1.0
        }
    ]
    
    recs = RecommendationEngine.generate_recommendations(counters, {"avg_wait_time_min": 4.5})
    reroute_recs = [r for r in recs if r["category"] == "QUEUE_ROUTING"]
    assert len(reroute_recs) == 1
    assert "Counter 1" in reroute_recs[0]["reasoning"]
    assert "Counter 2" in reroute_recs[0]["reasoning"]
