import os
import cv2
import numpy as np
import base64
import time
from typing import List, Dict, Any, Optional

class WebcamTracker:
    """Lightweight Centroid & IoU tracker for real-time webcam person tracking."""
    def __init__(self, max_missing_frames: int = 4):
        self.next_track_id = 1
        self.tracks: Dict[int, Dict[str, Any]] = {}
        self.max_missing = max_missing_frames

    def reset(self):
        self.next_track_id = 1
        self.tracks.clear()

    def update(self, detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        matched_track_ids = set()
        matched_det_indices = set()

        for d_idx, det in enumerate(detections):
            best_score = 0.0
            best_tid = None
            cx, cy = det["center_point"]
            boxA = det["bbox"]
            wA = boxA[2] - boxA[0]
            hA = boxA[3] - boxA[1]

            for tid, trk in self.tracks.items():
                if tid in matched_track_ids:
                    continue
                boxB = trk["bbox"]
                wB = boxB[2] - boxB[0]
                hB = boxB[3] - boxB[1]

                inter_x = max(0, min(boxA[2], boxB[2]) - max(boxA[0], boxB[0]))
                inter_y = max(0, min(boxA[3], boxB[3]) - max(boxA[1], boxB[1]))
                inter = inter_x * inter_y
                union = wA * hA + wB * hB - inter
                iou = (inter / union) if union > 0 else 0

                tcx, tcy = trk["centroid"]
                dist = np.hypot(cx - tcx, cy - tcy)

                # Matching metric: high IoU or close centroid distance
                if iou > 0.30 or (dist < 90.0 and iou > 0.10):
                    score = iou + max(0, 1.0 - dist / 150.0)
                    if score > best_score:
                        best_score = score
                        best_tid = tid

            if best_tid is not None:
                matched_track_ids.add(best_tid)
                matched_det_indices.add(d_idx)
                det["track_id"] = best_tid
                self.tracks[best_tid] = {
                    "bbox": det["bbox"],
                    "centroid": [cx, cy],
                    "missing_count": 0,
                    "confidence": det["confidence"]
                }

        # Unmatched detections become new tracks
        for d_idx, det in enumerate(detections):
            if d_idx not in matched_det_indices:
                tid = self.next_track_id
                self.next_track_id += 1
                det["track_id"] = tid
                self.tracks[tid] = {
                    "bbox": det["bbox"],
                    "centroid": det["center_point"],
                    "missing_count": 0,
                    "confidence": det["confidence"]
                }

        # Age unmatched tracks and cull stale ones
        stale_ids = []
        for tid in list(self.tracks.keys()):
            if tid not in matched_track_ids and tid not in [d.get("track_id") for d in detections]:
                self.tracks[tid]["missing_count"] += 1
                if self.tracks[tid]["missing_count"] > self.max_missing:
                    stale_ids.append(tid)

        for tid in stale_ids:
            del self.tracks[tid]

        return detections


class WebcamService:
    def __init__(self):
        self.custom_model = None
        self.pretrained_model = None
        # Use pretrained COCO person model as default for laptop webcams (verified for indoor portraits/close-up)
        self.active_model_type = "pretrained"
        self.model = None
        self.model_name = "yolov8n.pt (COCO Person Detector)"
        self.model_loaded = False
        self.is_custom = False
        self.tracker = WebcamTracker(max_missing_frames=4)
        
        # Resolve custom checkpoint path
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        candidate1 = os.path.join(backend_dir, "data", "training_runs", "queueiq_yolov8n", "weights", "best.pt")
        candidate2 = os.path.join(os.path.dirname(backend_dir), "backend", "data", "training_runs", "queueiq_yolov8n", "weights", "best.pt")
        self.checkpoint_path = candidate1 if os.path.exists(candidate1) else (candidate2 if os.path.exists(candidate2) else candidate1)
        
        self._init_model()

    def reset_tracker(self):
        """Resets the tracking state on camera stop or restart."""
        self.tracker.reset()

    def _init_model(self):
        try:
            from ultralytics import YOLO
            # 1. Load pretrained YOLOv8n (COCO - verified class 0 = person, optimized for indoor/laptop webcam)
            try:
                self.pretrained_model = YOLO("yolov8n.pt")
                print("WebcamService: Pretrained YOLOv8n COCO model loaded.")
            except Exception as pe:
                print(f"WebcamService: Pretrained load warning: {pe}")
                self.pretrained_model = None

            # 2. Load custom trained model if exists
            if os.path.exists(self.checkpoint_path):
                try:
                    self.custom_model = YOLO(self.checkpoint_path)
                    print(f"WebcamService: Custom best.pt loaded from {self.checkpoint_path}")
                except Exception as ce:
                    print(f"WebcamService: Custom model load warning: {ce}")
                    self.custom_model = None

            # Set active model
            if self.active_model_type == "pretrained" and self.pretrained_model is not None:
                self.model = self.pretrained_model
                self.model_name = "yolov8n.pt (COCO Person Detector)"
                self.is_custom = False
            elif self.custom_model is not None:
                self.model = self.custom_model
                self.model_name = "queueiq_yolov8n (best.pt)"
                self.is_custom = True
            elif self.pretrained_model is not None:
                self.model = self.pretrained_model
                self.model_name = "yolov8n.pt (COCO Person Detector)"
                self.is_custom = False

            self.model_loaded = (self.model is not None)
        except Exception as e:
            self.model_loaded = False
            self.model_name = f"Load Error: {str(e)[:40]}"
            print(f"WebcamService: Error loading YOLO model: {e}")

    def switch_model(self, model_type: str = "pretrained") -> Dict[str, Any]:
        """Switches between 'pretrained', 'custom', and 'auto' models."""
        model_type = model_type.lower()
        self.active_model_type = model_type
        self.reset_tracker()

        if model_type == "custom" and self.custom_model:
            self.model = self.custom_model
            self.model_name = "queueiq_yolov8n (best.pt)"
            self.is_custom = True
        elif model_type == "auto":
            self.active_model_type = "auto"
            self.model = self.pretrained_model or self.custom_model
            self.model_name = "Auto-Adaptive (COCO + QueueIQ)"
            self.is_custom = False
        else: # pretrained (default for webcam)
            self.active_model_type = "pretrained"
            self.model = self.pretrained_model
            self.model_name = "yolov8n.pt (COCO Person Detector)"
            self.is_custom = False

        return self.get_status()

    def get_status(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "active_model_type": self.active_model_type,
            "model_loaded": self.model_loaded,
            "is_custom": self.is_custom,
            "has_custom": (self.custom_model is not None),
            "has_pretrained": (self.pretrained_model is not None),
            "checkpoint_path": self.checkpoint_path,
            "checkpoint_exists": os.path.exists(self.checkpoint_path),
            "classes": {0: "person"}
        }

    def _run_model_inference(self, target_model, frame, conf_threshold: float, is_coco: bool = True) -> List[Dict[str, Any]]:
        """Executes inference with smart NMS deduplication and person class isolation."""
        detections = []
        try:
            kwargs = {
                "conf": conf_threshold,
                "iou": 0.45,
                "verbose": False
            }
            if is_coco:
                kwargs["classes"] = [0] # Class 0 = Person only

            results = target_model(frame, **kwargs)
            for r in results:
                for b in r.boxes:
                    cls_id = int(b.cls[0]) if hasattr(b, 'cls') else 0
                    cls_name = target_model.names.get(cls_id, "Person") if hasattr(target_model, 'names') else "Person"

                    # Strictly enforce person class only
                    if cls_name.lower() in ["person", "0", "customer"]:
                        x1, y1, x2, y2 = map(int, b.xyxy[0].tolist())
                        conf = float(b.conf[0])

                        # Filter out tiny noise / background artifacts
                        box_w = x2 - x1
                        box_h = y2 - y1
                        if box_w < 25 or box_h < 25:
                            continue

                        cx = (x1 + x2) / 2.0
                        cy = (y1 + y2) / 2.0
                        foot_x = cx
                        foot_y = float(y2)

                        detections.append({
                            "bbox": [x1, y1, x2, y2],
                            "confidence": round(conf, 3),
                            "label": "Person",
                            "center_point": [round(cx, 1), round(cy, 1)],
                            "foot_point": [round(foot_x, 1), round(foot_y, 1)],
                            "zone_id": None
                        })
        except Exception as e:
            print(f"WebcamService inference error: {e}")

        # Multi-stage NMS & Vertical Body Part Deduplication
        # Sort detections by confidence descending
        detections.sort(key=lambda d: d["confidence"], reverse=True)
        clean_detections = []

        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            wA = x2 - x1
            hA = y2 - y1
            areaA = wA * hA
            is_duplicate = False

            for kept in clean_detections:
                kx1, ky1, kx2, ky2 = kept["bbox"]
                wB = kx2 - kx1
                hB = ky2 - ky1
                areaB = wB * hB

                inter_w = max(0, min(x2, kx2) - max(x1, kx1))
                inter_h = max(0, min(y2, ky2) - max(y1, ky1))
                interArea = inter_w * inter_h

                denom = float(areaA + areaB - interArea)
                iou = (interArea / denom) if denom > 0 else 0
                iom = (interArea / float(min(areaA, areaB))) if min(areaA, areaB) > 0 else 0
                horiz_overlap = (inter_w / float(min(wA, wB))) if min(wA, wB) > 0 else 0

                # 1. Standard IoU suppression
                if iou > 0.40:
                    is_duplicate = True
                    break

                # 2. Containment suppression (head inside torso box or sub-box detection)
                if iom > 0.40:
                    is_duplicate = True
                    # Envelope into complete person box
                    kept["bbox"] = [min(kx1, x1), min(ky1, y1), max(kx2, x2), max(ky2, y2)]
                    kept["center_point"] = [(kept["bbox"][0] + kept["bbox"][2]) / 2.0, (kept["bbox"][1] + kept["bbox"][3]) / 2.0]
                    kept["foot_point"] = [kept["center_point"][0], float(kept["bbox"][3])]
                    break

                # 3. Vertical alignment suppression (head stacked vertically directly on torso)
                # Two distinct people sitting side-by-side have horiz_overlap < 0.25
                # Same person's head and chest share horiz_overlap > 0.60
                if horiz_overlap > 0.60 and (inter_h > 0 or abs(y1 - ky2) < 45 or abs(ky1 - y2) < 45):
                    is_duplicate = True
                    # Merge into single unified person box
                    kept["bbox"] = [min(kx1, x1), min(ky1, y1), max(kx2, x2), max(ky2, y2)]
                    kept["center_point"] = [(kept["bbox"][0] + kept["bbox"][2]) / 2.0, (kept["bbox"][1] + kept["bbox"][3]) / 2.0]
                    kept["foot_point"] = [kept["center_point"][0], float(kept["bbox"][3])]
                    break

            if not is_duplicate:
                clean_detections.append(det)

        return clean_detections

    def process_frame(
        self,
        image_base64: str,
        conf_threshold: float = 0.35,
        zones: Optional[List[Dict[str, Any]]] = None,
        model_type: Optional[str] = None,
        avg_service_time_sec: int = 90,
        active_counters: int = 3
    ) -> Dict[str, Any]:
        """Runs high-accuracy person detection on a webcam frame, tracks people, and evaluates queue wait times."""
        t_start = time.perf_counter()

        # 1. Decode base64 image
        try:
            if "," in image_base64:
                image_base64 = image_base64.split(",", 1)[1]
            img_bytes = base64.b64decode(image_base64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                return {"error": "Failed to decode image from base64"}
        except Exception as e:
            return {"error": f"Base64 decode error: {str(e)}"}

        h, w = frame.shape[:2]

        if not self.model_loaded:
            self._init_model()

        # 2. Select model and run inference
        requested_type = (model_type or self.active_model_type or "pretrained").lower()
        detections = []
        actual_model_name = self.model_name
        inference_error = None

        try:
            if requested_type == "custom" and self.custom_model:
                detections = self._run_model_inference(self.custom_model, frame, conf_threshold, is_coco=False)
                actual_model_name = "queueiq_yolov8n (best.pt)"
            elif requested_type == "auto":
                # Auto mode: try COCO person detector first for webcam, fallback to custom if needed
                if self.pretrained_model is not None:
                    detections = self._run_model_inference(self.pretrained_model, frame, conf_threshold, is_coco=True)
                    actual_model_name = "yolov8n.pt (COCO Person Detector)"
                elif self.custom_model is not None:
                    detections = self._run_model_inference(self.custom_model, frame, conf_threshold, is_coco=False)
                    actual_model_name = "queueiq_yolov8n (best.pt)"
            else:
                # Pretrained (recommended for laptop webcam)
                target = self.pretrained_model or self.custom_model
                if target:
                    detections = self._run_model_inference(target, frame, conf_threshold, is_coco=(target == self.pretrained_model))
                    actual_model_name = "yolov8n.pt (COCO Person Detector)"
        except Exception as ie:
            inference_error = str(ie)
            print(f"Webcam inference error: {ie}")

        # 3. Update Tracker for persistent IDs and fresh per-frame results
        detections = self.tracker.update(detections)

        inference_ms = round((time.perf_counter() - t_start) * 1000, 1)

        # 4. Queue Zones Evaluation with dual Centroid & Ground Anchor Testing
        processed_zones = []
        zone_counts: Dict[str, int] = {}

        configured_zones = zones or []
        for z in configured_zones:
            zid = str(z.get("id", ""))
            zname = z.get("name", f"Zone {zid}")
            target = int(z.get("target_queue_length", z.get("target", 3)))
            color = z.get("color", "#06B6D4")
            poly_coords = z.get("polygon", z.get("polygon_coords", []))

            zone_counts[zid] = 0

            # Convert normalized coords [0..1] to pixel coords [0..w, 0..h]
            pts = []
            if poly_coords and len(poly_coords) >= 3:
                for pt in poly_coords:
                    px = int(pt[0] * w) if pt[0] <= 1.0 else int(pt[0])
                    py = int(pt[1] * h) if pt[1] <= 1.0 else int(pt[1])
                    pts.append([px, py])
                pts_np = np.array(pts, dtype=np.int32)
            else:
                pts_np = None

            # Test each detected person in current frame
            if pts_np is not None:
                for det in detections:
                    fx, fy = det["foot_point"]
                    cx, cy = det["center_point"]
                    in_foot = cv2.pointPolygonTest(pts_np, (float(fx), float(fy)), False) >= 0
                    in_center = cv2.pointPolygonTest(pts_np, (float(cx), float(cy)), False) >= 0
                    if in_foot or in_center:
                        zone_counts[zid] += 1
                        det["zone_id"] = zid

            count = zone_counts[zid]

            # Individual zone estimated wait time
            # For a customer in this lane: (count * service_time_sec) / 60
            z_wait_minutes = round((count * avg_service_time_sec) / 60.0, 1)

            # Queue Status Classification: Short, Moderate, Long
            if count < target:
                status = "Short"
                status_color = "#10B981" # Green
            elif count <= target + 1:
                status = "Moderate"
                status_color = "#F59E0B" # Amber
            else:
                status = "Long"
                status_color = "#EF4444" # Red

            processed_zones.append({
                "id": zid,
                "name": zname,
                "target": target,
                "count": count,
                "estimated_wait_minutes": z_wait_minutes,
                "status": status,
                "status_color": status_color,
                "color": color,
                "polygon": poly_coords
            })

        # 5. Explainable Waiting Time Estimation for New Arriving Customer
        # Formula: Estimated wait (minutes) = customers ahead × average service time in seconds ÷ (active counters × 60)
        total_in_queue = sum(z["count"] for z in processed_zones)
        active_counter_count = max(1, active_counters if active_counters > 0 else (len(processed_zones) or 3))
        
        if total_in_queue > 0:
            estimated_wait_minutes = round((total_in_queue * avg_service_time_sec) / (active_counter_count * 60.0), 1)
        else:
            estimated_wait_minutes = 0.0

        wait_time_explanation = (
            f"Estimated wait for arriving customer: ~{estimated_wait_minutes} min "
            f"({total_in_queue} customers ahead × {avg_service_time_sec}s avg service ÷ {active_counter_count} active counters)."
        )

        # 6. Generate Actionable Queue Optimization Recommendations
        recommendations = []
        if processed_zones:
            sorted_zones = sorted(processed_zones, key=lambda x: x["count"], reverse=True)
            longest_zone = sorted_zones[0]
            shortest_zone = sorted_zones[-1]

            if longest_zone["count"] > longest_zone["target"] + 1:
                recommendations.append(
                    f"{longest_zone['name']} has an extended queue ({longest_zone['count']} detected, ~{longest_zone['estimated_wait_minutes']}m wait). Consider opening an additional checkout register."
                )
            elif longest_zone["count"] >= longest_zone["target"]:
                recommendations.append(
                    f"{longest_zone['name']} has reached its target queue threshold ({longest_zone['count']} detected). Monitor lane inflow."
                )
            else:
                recommendations.append(
                    f"All configured registers are operating within target capacity. Expected wait is ~{estimated_wait_minutes} min."
                )

            if longest_zone["count"] >= 2 and shortest_zone["count"] < shortest_zone["target"]:
                recommendations.append(
                    f"{shortest_zone['name']} currently has fewer detected customers ({shortest_zone['count']}). Directing incoming shoppers there will balance checkout times."
                )
        else:
            if len(detections) > 0:
                recommendations.append(
                    f"{len(detections)} customer(s) detected in camera field. Configure queue zones to track checkout registers."
                )
            else:
                recommendations.append("Camera view is clear. No customers currently detected in frame.")

        limitation_notice = (
            "Wait Time Assumptions: Approximate calculation based on visible bounding boxes and configured average service time. "
            "Actual transaction durations may vary based on basket sizes, payment methods, or price checks."
        )

        return {
            "people_count": len(detections),
            "estimated_queue_length": total_in_queue,
            "estimated_wait_minutes": estimated_wait_minutes,
            "avg_service_time_sec": avg_service_time_sec,
            "active_counters": active_counter_count,
            "wait_time_explanation": wait_time_explanation,
            "detections": detections,
            "zones": processed_zones,
            "recommendations": recommendations,
            "limitation_notice": limitation_notice,
            "inference_latency_ms": inference_ms,
            "model_name": actual_model_name,
            "model_used": actual_model_name,
            "model_loaded": self.model_loaded,
            "inference_error": inference_error,
            "frame_width": w,
            "frame_height": h,
        }
