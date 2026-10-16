import cv2
import numpy as np
import time
import os
import threading
from typing import List, Dict, Any, Tuple, Optional
from collections import OrderedDict
from backend.app.config import settings
from backend.app.services.polygon_service import PolygonService
from backend.app.services.queue_analytics import QueueAnalyticsEngine
from backend.app.services.alert_manager import AlertManager

class SimpleCentroidTracker:
    """
    Lightweight, fast CPU-friendly Centroid & IoU tracker.
    Tracks people across video frames, maintains persistent track IDs,
    and detects when a tracked person exits a queue zone.
    """
    def __init__(self, max_disappeared: int = 15, max_distance: float = 75.0):
        self.next_object_id = 1
        self.objects: Dict[int, Tuple[float, float]] = OrderedDict() # id -> centroid
        self.bboxes: Dict[int, List[int]] = OrderedDict()          # id -> bbox
        self.disappeared: Dict[int, int] = OrderedDict()
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

    def register(self, centroid: Tuple[float, float], bbox: List[int]) -> int:
        obj_id = self.next_object_id
        self.objects[obj_id] = centroid
        self.bboxes[obj_id] = bbox
        self.disappeared[obj_id] = 0
        self.next_object_id += 1
        return obj_id

    def deregister(self, object_id: int):
        del self.objects[object_id]
        del self.bboxes[object_id]
        del self.disappeared[object_id]

    def update(self, rects: List[List[int]]) -> List[Dict[str, Any]]:
        # rects: list of [x1, y1, x2, y2]
        if len(rects) == 0:
            for obj_id in list(self.disappeared.keys()):
                self.disappeared[obj_id] += 1
                if self.disappeared[obj_id] > self.max_disappeared:
                    self.deregister(obj_id)
            return []

        input_centroids = np.zeros((len(rects), 2), dtype="float")
        for i, (x1, y1, x2, y2) in enumerate(rects):
            input_centroids[i] = ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

        if len(self.objects) == 0:
            tracked_results = []
            for i in range(len(rects)):
                obj_id = self.register(input_centroids[i], rects[i])
                tracked_results.append({
                    "track_id": obj_id,
                    "bbox": rects[i],
                    "centroid": input_centroids[i].tolist()
                })
            return tracked_results

        object_ids = list(self.objects.keys())
        object_centroids = list(self.objects.values())

        # Compute pairwise Euclidean distance matrix
        D = np.linalg.norm(np.array(object_centroids)[:, np.newaxis] - input_centroids, axis=2)
        rows = D.min(axis=1).argsort()
        cols = D.argmin(axis=1)[rows]

        used_rows = set()
        used_cols = set()

        tracked_results = []
        for (row, col) in zip(rows, cols):
            if row in used_rows or col in used_cols:
                continue

            if D[row, col] > self.max_distance:
                continue

            obj_id = object_ids[row]
            self.objects[obj_id] = input_centroids[col]
            self.bboxes[obj_id] = rects[col]
            self.disappeared[obj_id] = 0
            used_rows.add(row)
            used_cols.add(col)

            tracked_results.append({
                "track_id": obj_id,
                "bbox": rects[col],
                "centroid": input_centroids[col].tolist()
            })

        unused_rows = set(range(0, D.shape[0])).difference(used_rows)
        unused_cols = set(range(0, D.shape[1])).difference(used_cols)

        for row in unused_rows:
            obj_id = object_ids[row]
            self.disappeared[obj_id] += 1
            if self.disappeared[obj_id] > self.max_disappeared:
                self.deregister(obj_id)

        for col in unused_cols:
            obj_id = self.register(input_centroids[col], rects[col])
            tracked_results.append({
                "track_id": obj_id,
                "bbox": rects[col],
                "centroid": input_centroids[col].tolist()
            })

        return tracked_results


class VisionEngine:
    def __init__(self, alert_manager: AlertManager, analytics_engine: QueueAnalyticsEngine):
        self.alert_manager = alert_manager
        self.analytics_engine = analytics_engine
        self.tracker = SimpleCentroidTracker()
        
        self.model = None
        self.model_status = "Not loaded"
        self.model_name = settings.YOLO_MODEL_NAME
        
        # Camera / Stream state
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_running = False
        self.camera_status = "Disconnected"
        self.current_source = settings.VIDEO_SOURCE # 'webcam', 'file', 'demo'
        self.current_fps = 0.0
        self.latency_ms = 0.0
        self.lock = threading.Lock()
        
        # Latest processed state snapshot
        self.latest_frame: Optional[np.ndarray] = None
        self.latest_counters_data: List[Dict[str, Any]] = []
        self.latest_detections: List[Dict[str, Any]] = []
        self.is_demo_mode = False
        
        # Load model once on initialization
        self._init_model()

    def _init_model(self):
        try:
            self.model_status = "Loading YOLOv8n..."
            from ultralytics import YOLO
            # YOLOv8n weights automatically cache locally without cloud/API keys
            self.model = YOLO("yolov8n.pt")
            self.model_status = "Active (YOLOv8n CPU)"
            print("QueueIQ VisionEngine: YOLOv8n loaded successfully.")
        except Exception as e:
            self.model_status = f"Fallback Mode ({str(e)[:30]})"
            print(f"QueueIQ VisionEngine: YOLO load warning: {e}. Using OpenCV HOG fallback detector.")

    def start_camera(self, source_type: str = "webcam", file_path: str = "") -> bool:
        with self.lock:
            if self.is_running:
                return True
            
            self.current_source = source_type
            if source_type == "webcam":
                self.cap = cv2.VideoCapture(settings.CAMERA_INDEX, cv2.CAP_DSHOW if os.name == 'nt' else cv2.CAP_ANY)
                if not self.cap.isOpened():
                    # Try default index
                    self.cap = cv2.VideoCapture(0)
                
                if not self.cap or not self.cap.isOpened():
                    self.camera_status = "Camera Unavailable (Switch to Demo Mode)"
                    self.alert_manager.create_alert_if_eligible(
                        counter_id=None,
                        alert_type="CAMERA_DISCONNECT",
                        severity="WARNING",
                        title="Webcam Not Detected",
                        message="Laptop webcam could not be opened. Using simulated demo feed."
                    )
                    return False
                
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, settings.FRAME_WIDTH)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, settings.FRAME_HEIGHT)
                self.camera_status = "Connected (Webcam)"
                self.is_demo_mode = False

            elif source_type == "file" and file_path and os.path.exists(file_path):
                self.cap = cv2.VideoCapture(file_path)
                if not self.cap.isOpened():
                    self.camera_status = "File Open Error"
                    return False
                self.camera_status = f"Playing: {os.path.basename(file_path)}"
                self.is_demo_mode = False

            elif source_type == "demo":
                self.camera_status = "Demo Mode (Simulated Stream)"
                self.is_demo_mode = True
                self.cap = None

            self.is_running = True
            return True

    def stop_camera(self):
        with self.lock:
            self.is_running = False
            if self.cap:
                self.cap.release()
                self.cap = None
            self.camera_status = "Stopped"

    def detect_persons(self, frame: np.ndarray) -> List[List[int]]:
        """
        Runs person detection on frame. Returns list of bounding boxes [x1, y1, x2, y2].
        COCO class 0 is 'person'.
        """
        rects = []
        if self.model:
            try:
                # conf=0.35, classes=[0] filters exclusively for humans
                results = self.model(frame, classes=[0], conf=settings.CONFIDENCE_THRESHOLD, verbose=False)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                        rects.append([x1, y1, x2, y2])
            except Exception as e:
                print("Inference error:", e)
        else:
            # OpenCV HOG fallback if PyTorch model was not loaded
            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            found, _ = hog.detectMultiScale(frame, winStride=(8, 8), padding=(4, 4), scale=1.05)
            for (x, y, w, h) in found:
                rects.append([x, y, x + w, y + h])
                
        return rects

    def generate_demo_frame(self, counters: List[Dict[str, Any]]) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        """
        Generates a synthetic realistic supermarket checkout scene for presentations.
        Simulates people standing in queues with smooth position fluctuations.
        """
        h, w = settings.FRAME_HEIGHT, settings.FRAME_WIDTH
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        
        # Draw supermarket store floor tiles
        frame[:] = (22, 27, 34) # Midnight slate
        for grid_x in range(0, w, 40):
            cv2.line(frame, (grid_x, 0), (grid_x, h), (30, 38, 48), 1)
        for grid_y in range(0, h, 40):
            cv2.line(frame, (0, grid_y), (w, grid_y), (30, 38, 48), 1)

        # Counter register tables at top
        cv2.rectangle(frame, (10, 20), (w - 10, 90), (45, 55, 72), -1)
        cv2.putText(frame, "BILLING COUNTERS & SCANNING REGISTERS", (w//4, 55), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (148, 163, 184), 1, cv2.LINE_AA)

        # Simulated people per counter
        simulated_detections = []
        import math
        t = time.time()

        for idx, counter in enumerate(counters):
            # Oscillate simulated queue count between 1 and 6 based on time
            base_count = 2 + (idx % 2) * 2
            fluctuation = int(round(math.sin(t * 0.4 + idx * 1.5) * 1.5))
            people_num = max(1, min(7, base_count + fluctuation))
            
            # Place people vertically inside counter lane
            lane_center_x = int(w * (0.2 + idx * 0.3))
            start_y = 140
            for p in range(people_num):
                px = lane_center_x + int(math.sin(t + p) * 6)
                py = start_y + p * 45
                box_w, box_h = 32, 60
                x1, y1 = px - box_w // 2, py - box_h
                x2, y2 = px + box_w // 2, py
                
                simulated_detections.append({
                    "track_id": (idx + 1) * 100 + p,
                    "bbox": [x1, y1, x2, y2],
                    "centroid": [px, py - box_h // 2]
                })

        return frame, simulated_detections

    def process_frame(self, counters: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Captures one frame, executes detection, assigns to polygons,
        computes waiting times & congestion, and renders annotated frame.
        """
        start_time = time.time()
        
        if self.is_demo_mode or not self.cap or not self.cap.isOpened():
            frame, tracked_detections = self.generate_demo_frame(counters)
            is_simulated = True
        else:
            ret, frame = self.cap.read()
            if not ret:
                # Video file reached end or camera disconnected
                if self.current_source == "file":
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0) # Loop video
                    ret, frame = self.cap.read()
                if not ret:
                    frame, tracked_detections = self.generate_demo_frame(counters)
                    is_simulated = True
                else:
                    is_simulated = False
                    raw_rects = self.detect_persons(frame)
                    tracked_detections = self.tracker.update(raw_rects)
            else:
                is_simulated = False
                raw_rects = self.detect_persons(frame)
                tracked_detections = self.tracker.update(raw_rects)

        fh, fw = frame.shape[:2]

        # Assign detections to counter queue polygons
        assignments = PolygonService.assign_people_to_counters(
            tracked_detections, 
            counters, 
            fw, 
            fh
        )

        counters_summary = []
        for counter in counters:
            cid = counter["id"]
            assigned_people = assignments.get(cid, [])
            raw_count = len(assigned_people)
            
            # Smooth count across rolling window
            smoothed_count = self.analytics_engine.record_raw_count(cid, raw_count)
            
            # Waiting time calculation
            wait_info = self.analytics_engine.estimate_waiting_time(
                counter_id=cid,
                people_count=smoothed_count,
                configured_service_time_sec=counter.get("avg_service_time_sec", 120.0)
            )
            
            # Congestion evaluation
            congestion = self.analytics_engine.compute_congestion_status(
                people_count=smoothed_count,
                congestion_threshold=counter.get("congestion_threshold", 4)
            )
            
            # Check if any detected person is touching frame boundary (cutoff warning)
            boundary_alert = any(
                p["bbox"][1] <= 10 or p["bbox"][3] >= fh - 10 
                for p in assigned_people
            )
            
            # Fire alert if congestion is warning or critical
            if congestion["level"] in ["Warning", "Critical"]:
                self.alert_manager.create_alert_if_eligible(
                    counter_id=cid,
                    alert_type="CONGESTION",
                    severity=congestion["level"].upper(),
                    title=f"Queue Congestion: {counter['name']}",
                    message=f"{counter['name']} has {smoothed_count} people waiting (est. {wait_info['estimated_wait_time_min']} mins).",
                    metrics_snapshot={
                        "people_count": smoothed_count,
                        "wait_time_min": wait_info["estimated_wait_time_min"],
                        "threshold": counter.get("congestion_threshold", 4)
                    }
                )

            counters_summary.append({
                "id": cid,
                "counter_code": counter.get("counter_code", f"C{cid}"),
                "name": counter["name"],
                "category": counter.get("category", "Standard"),
                "is_active": counter.get("is_active", 1),
                "people_count": smoothed_count,
                "raw_count": raw_count,
                "people_ahead": wait_info["people_ahead"],
                "estimated_wait_time_sec": wait_info["estimated_wait_time_sec"],
                "estimated_wait_time_min": wait_info["estimated_wait_time_min"],
                "is_calibrated": wait_info["is_calibrated"],
                "calculation_mode": wait_info["calculation_mode"],
                "congestion_level": congestion["level"],
                "congestion_label": congestion["label"],
                "congestion_color": congestion["badge_color"],
                "congestion_threshold": counter.get("congestion_threshold", 4),
                "color": counter.get("color", "#06B6D4"),
                "boundary_alert": boundary_alert
            })

        # Render annotations on video frame
        annotated_frame = self._render_annotations(
            frame, 
            counters, 
            counters_summary, 
            tracked_detections,
            is_simulated
        )

        elapsed = time.time() - start_time
        self.latency_ms = round(elapsed * 1000, 1)
        self.current_fps = round(1.0 / max(elapsed, 0.001), 1)

        self.latest_frame = annotated_frame
        self.latest_counters_data = counters_summary
        self.latest_detections = tracked_detections

        return {
            "fps": self.current_fps,
            "latency_ms": self.latency_ms,
            "model_status": self.model_status,
            "camera_status": self.camera_status,
            "is_simulated": is_simulated,
            "total_waiting": sum(c["people_count"] for c in counters_summary if c["is_active"]),
            "counters": counters_summary
        }

    def _render_annotations(
        self, 
        frame: np.ndarray, 
        counters: List[Dict[str, Any]], 
        counters_summary: List[Dict[str, Any]], 
        detections: List[Dict[str, Any]],
        is_simulated: bool
    ) -> np.ndarray:
        h, w = frame.shape[:2]
        vis = frame.copy()

        # 1. Draw Queue Region Polygons
        summary_by_id = {c["id"]: c for c in counters_summary}
        for counter in counters:
            if not counter.get("is_active", 1):
                continue
            
            poly = counter.get("polygon_coords")
            if isinstance(poly, str):
                import json
                poly = json.loads(poly)
            
            if not poly or len(poly) < 3:
                continue

            # Convert normalized coords [0..1] to pixel coords
            pts = np.array([[int(pt[0] * w), int(pt[1] * h)] for pt in poly], dtype=np.int32)
            
            # Hex color to BGR
            hex_color = counter.get("color", "#06B6D4").lstrip("#")
            bgr = tuple(int(hex_color[i:i+2], 16) for i in (4, 2, 0)) # RGB -> BGR
            
            # Semi-transparent polygon overlay
            overlay = vis.copy()
            cv2.fillPoly(overlay, [pts], bgr)
            cv2.addWeighted(overlay, 0.18, vis, 0.82, 0, vis)
            
            # Polygon perimeter border
            cv2.polylines(vis, [pts], isClosed=True, color=bgr, thickness=2, lineType=cv2.LINE_AA)

            # Header badge on polygon top-left vertex
            c_info = summary_by_id.get(counter["id"], {})
            count_val = c_info.get("people_count", 0)
            wait_min = c_info.get("estimated_wait_time_min", 0.0)
            badge_text = f"{counter['name']}: {count_val} waiting (~{wait_min}m)"
            
            top_pt = pts[np.argmin(pts[:, 1])] # highest point
            tx, ty = max(10, top_pt[0]), max(25, top_pt[1] - 8)
            
            # Badge background
            (tw, th), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(vis, (tx - 4, ty - th - 4), (tx + tw + 6, ty + 4), (15, 23, 42), -1)
            cv2.rectangle(vis, (tx - 4, ty - th - 4), (tx + tw + 6, ty + 4), bgr, 1)
            cv2.putText(vis, badge_text, (tx, ty - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        # 2. Draw Person Detections & Tracking ID
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            track_id = det.get("track_id", "")
            
            # Person bounding box (cyan)
            cv2.rectangle(vis, (x1, y1), (x2, y2), (212, 182, 6), 2, lineType=cv2.LINE_AA)
            
            # Track ID pill
            id_text = f"ID #{track_id}"
            (iw, ih), _ = cv2.getTextSize(id_text, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
            cv2.rectangle(vis, (x1, y1 - ih - 6), (x1 + iw + 6, y1), (212, 182, 6), -1)
            cv2.putText(vis, id_text, (x1 + 3, y1 - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (10, 15, 25), 1, cv2.LINE_AA)

            # Ground anchor foot position indicator
            foot_x, foot_y = PolygonService.get_person_ground_anchor((x1, y1, x2, y2))
            cv2.circle(vis, (int(foot_x), int(foot_y)), 4, (0, 255, 255), -1)

        # 3. Demo Banner overlay if active
        if is_simulated:
            banner_text = "DEMO MODE - SIMULATED DATA"
            (bw, bh), _ = cv2.getTextSize(banner_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
            cv2.rectangle(vis, (w//2 - bw//2 - 12, 8), (w//2 + bw//2 + 12, 38), (15, 23, 42), -1)
            cv2.rectangle(vis, (w//2 - bw//2 - 12, 8), (w//2 + bw//2 + 12, 38), (245, 158, 11), 2)
            cv2.putText(vis, banner_text, (w//2 - bw//2, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (245, 158, 11), 2, cv2.LINE_AA)

        return vis

    def get_jpeg_frame(self) -> Optional[bytes]:
        """Encodes latest annotated frame to JPEG for MJPEG HTTP video stream"""
        if self.latest_frame is None:
            return None
        ret, jpeg = cv2.imencode('.jpg', self.latest_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if ret:
            return jpeg.tobytes()
        return None
