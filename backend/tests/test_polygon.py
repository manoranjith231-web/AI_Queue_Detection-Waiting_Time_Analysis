import pytest
from backend.app.services.polygon_service import PolygonService

def test_point_in_polygon():
    # Square polygon from [0.1, 0.1] to [0.5, 0.5]
    polygon = [
        [0.1, 0.1],
        [0.5, 0.1],
        [0.5, 0.5],
        [0.1, 0.5]
    ]
    
    # Inside point
    assert PolygonService.point_in_polygon((0.3, 0.3), polygon) is True
    # Outside point
    assert PolygonService.point_in_polygon((0.8, 0.8), polygon) is False
    # Border point
    assert PolygonService.point_in_polygon((0.1, 0.3), polygon) is True

def test_person_ground_anchor():
    bbox = [100, 50, 200, 250] # x1, y1, x2, y2
    foot_x, foot_y = PolygonService.get_person_ground_anchor(bbox)
    assert foot_x == 150.0
    assert foot_y == 250.0

def test_assign_people_to_counters():
    counters = [
        {
            "id": 1,
            "name": "Counter 1",
            "is_active": 1,
            "polygon_coords": [[0.0, 0.0], [0.5, 0.0], [0.5, 1.0], [0.0, 1.0]]
        },
        {
            "id": 2,
            "name": "Counter 2",
            "is_active": 1,
            "polygon_coords": [[0.5, 0.0], [1.0, 0.0], [1.0, 1.0], [0.5, 1.0]]
        }
    ]
    detections = [
        {"track_id": 101, "bbox": [100, 100, 200, 400]}, # foot at x=150, y=400 (norm: 150/1000 = 0.15 -> C1)
        {"track_id": 102, "bbox": [700, 100, 800, 400]}  # foot at x=750, y=400 (norm: 750/1000 = 0.75 -> C2)
    ]
    
    assignments = PolygonService.assign_people_to_counters(detections, counters, frame_width=1000, frame_height=1000)
    assert len(assignments[1]) == 1
    assert assignments[1][0]["track_id"] == 101
    assert len(assignments[2]) == 1
    assert assignments[2][0]["track_id"] == 102
