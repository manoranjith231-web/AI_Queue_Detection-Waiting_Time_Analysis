import numpy as np
import cv2
from typing import List, Dict, Tuple, Any

class PolygonService:
    @staticmethod
    def point_in_polygon(point: Tuple[float, float], polygon: List[List[float]]) -> bool:
        """
        Check if a 2D point (x, y) is inside a polygon.
        Coordinates can be normalized [0, 1] or pixel coordinates.
        Uses cv2.pointPolygonTest (free, fast, handles non-convex shapes).
        """
        if not polygon or len(polygon) < 3:
            return False
        
        pts = np.array(polygon, dtype=np.float32)
        # cv2.pointPolygonTest requires point as (x, y) tuple and pts as array
        result = cv2.pointPolygonTest(pts, (float(point[0]), float(point[1])), measureDist=False)
        return result >= 0  # 1 = inside, 0 = on edge, -1 = outside

    @staticmethod
    def get_person_ground_anchor(bbox: Tuple[int, int, int, int]) -> Tuple[float, float]:
        """
        Calculates customer ground anchor (foot position) from bounding box [x1, y1, x2, y2].
        In supermarket retail analytics, customer foot position is the industry standard
        for assigning person to queue zones rather than bounding box center or head.
        """
        x1, y1, x2, y2 = bbox
        foot_x = (x1 + x2) / 2.0
        foot_y = float(y2)  # bottom edge
        return (foot_x, foot_y)

    @staticmethod
    def assign_people_to_counters(
        detections: List[Dict[str, Any]], 
        counters: List[Dict[str, Any]], 
        frame_width: int, 
        frame_height: int
    ) -> Dict[int, List[Dict[str, Any]]]:
        """
        Assigns detected persons to active counter queue polygons.
        Returns mapping: counter_id -> list of assigned person detections
        """
        assignments: Dict[int, List[Dict[str, Any]]] = {c["id"]: [] for c in counters if c.get("is_active", 1)}
        
        for det in detections:
            bbox = det["bbox"] # [x1, y1, x2, y2] in pixels
            foot_x, foot_y = PolygonService.get_person_ground_anchor(bbox)
            
            # Normalize foot coords to [0..1]
            norm_foot_x = foot_x / max(frame_width, 1)
            norm_foot_y = foot_y / max(frame_height, 1)
            
            assigned = False
            for counter in counters:
                if not counter.get("is_active", 1):
                    continue
                
                poly = counter.get("polygon_coords")
                if isinstance(poly, str):
                    import json
                    poly = json.loads(poly)
                
                if PolygonService.point_in_polygon((norm_foot_x, norm_foot_y), poly):
                    assignments[counter["id"]].append(det)
                    assigned = True
                    break # Assign to first matching zone
                    
            if not assigned:
                # Person is in store aisle or walking outside configured queues
                pass
                
        return assignments
