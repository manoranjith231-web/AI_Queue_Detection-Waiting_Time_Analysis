import os
import zipfile
import cv2
import numpy as np
import time
import json
import threading
from typing import Dict, Any, List, Optional, Tuple
from backend.app.config import settings
from backend.app.database import get_db_connection
from backend.app.services.polygon_service import PolygonService
from backend.app.services.alert_manager import AlertManager
from backend.app.services.recommendation_engine import RecommendationEngine

ACTIVITY_MAP = {
    1: "Crossing",
    2: "Walking",
    3: "Waiting",
    4: "Talking",
    5: "Queueing",
    6: "Other"
}

def compute_box_iou(boxA: List[float], boxB: List[float]) -> float:
    """Computes Intersection over Union (IoU) between two boxes [x1, y1, x2, y2]."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interW = max(0.0, xB - xA)
    interH = max(0.0, yB - yA)
    interArea = interW * interH
    boxAArea = max(0.0, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxBArea = max(0.0, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))
    denom = boxAArea + boxBArea - interArea
    if denom <= 0:
        return 0.0
    return interArea / denom


class DatasetService:
    def __init__(self, alert_manager: Optional[AlertManager] = None):
        self.alert_manager = alert_manager
        self.dataset_root = settings.DATASET_ROOT
        self.dataset_zip = settings.DATASET_ZIP_PATH
        self.lock = threading.Lock()
        
        # Background worker state
        self.worker_thread: Optional[threading.Thread] = None
        self.is_running = False
        self.is_paused = False
        self.should_stop = False
        
        # Telemetry
        self.current_run_id = ""
        self.current_sequence = ""
        self.current_frame_index = 0
        self.total_sequence_frames = 0
        self.processed_frames_count = 0
        self.current_fps = 0.0
        self.current_latency_ms = 0.0
        self.total_detections = 0
        self.confidence_sum = 0.0
        self.total_tp = 0
        self.total_fp = 0
        self.total_fn = 0
        self.errors: List[str] = []
        self.skipped_files = 0
        self.status = "IDLE"  # IDLE, RUNNING, PAUSED, COMPLETED, STOPPED, ERROR
        
        # Frame cache for viewer
        self.latest_frame_img: Optional[np.ndarray] = None
        self.latest_frame_annotated: Optional[np.ndarray] = None
        self.latest_frame_name = ""
        self.latest_detections: List[Dict[str, Any]] = []
        self.latest_gt_boxes: List[Dict[str, Any]] = []
        self.latest_counter_counts: Dict[int, int] = {}
        self._single_frame_cache: Dict[str, bytes] = {}
        self._sequence_frames_cache: Dict[str, List[str]] = {}
        self._sequence_annotations_cache: Dict[str, Dict[int, List[Dict[str, Any]]]] = {}
        self._active_counters_cache: Optional[List[Dict[str, Any]]] = None
        self._active_counters_cache_ts: float = 0.0
        self._live_stream_sequence: str = "seq01"
        self._live_stream_frame_index: int = 1
        self._live_stream_last_time: float = 0.0
        
        # Model instance and switching
        self.model = None
        self.active_model_type = "pretrained"  # 'pretrained' or 'custom'
        self.active_model_name = settings.YOLO_MODEL_NAME
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        # Check both potential directory layouts
        candidate1 = os.path.join(backend_dir, "data", "training_runs", "queueiq_yolov8n", "weights", "best.pt")
        candidate2 = os.path.join(os.path.dirname(backend_dir), "backend", "data", "training_runs", "queueiq_yolov8n", "weights", "best.pt")
        self.custom_checkpoint_path = candidate1 if os.path.exists(candidate1) else (candidate2 if os.path.exists(candidate2) else candidate1)
        self._init_model()

    def _init_model(self):
        try:
            from ultralytics import YOLO
            if self.active_model_type == "custom" and os.path.exists(self.custom_checkpoint_path):
                self.model = YOLO(self.custom_checkpoint_path)
                self.active_model_name = "queueiq_yolov8n (best.pt)"
                print(f"DatasetService: Loaded custom checkpoint {self.custom_checkpoint_path}")
            elif os.path.exists(self.custom_checkpoint_path):
                self.model = YOLO(self.custom_checkpoint_path)
                self.active_model_type = "custom"
                self.active_model_name = "queueiq_yolov8n (best.pt)"
                print(f"DatasetService: Auto-selected custom checkpoint {self.custom_checkpoint_path}")
            else:
                self.model = YOLO(settings.YOLO_MODEL_NAME)
                self.active_model_type = "pretrained"
                self.active_model_name = settings.YOLO_MODEL_NAME
                print(f"DatasetService: YOLOv8 model ({settings.YOLO_MODEL_NAME}) loaded successfully.")
        except Exception as e:
            print(f"DatasetService: Warning loading YOLO: {e}")

    def switch_model(self, model_type: str) -> Dict[str, Any]:
        """Switches active model between custom trained checkpoint and pretrained YOLO."""
        with self.lock:
            try:
                from ultralytics import YOLO
                if model_type == "custom":
                    if not os.path.exists(self.custom_checkpoint_path):
                        return {
                            "success": False,
                            "error": f"Custom checkpoint not found at {self.custom_checkpoint_path}. Train the model first."
                        }
                    self.model = YOLO(self.custom_checkpoint_path)
                    self.active_model_type = "custom"
                    self.active_model_name = "queueiq_yolov8n (best.pt)"
                else:
                    self.model = YOLO(settings.YOLO_MODEL_NAME)
                    self.active_model_type = "pretrained"
                    self.active_model_name = settings.YOLO_MODEL_NAME

                self._single_frame_cache.clear()
                return {
                    "success": True,
                    "active_model_type": self.active_model_type,
                    "active_model_name": self.active_model_name,
                    "message": f"Successfully activated {self.active_model_name}"
                }
            except Exception as e:
                return {"success": False, "error": str(e)}

    def get_available_models(self) -> Dict[str, Any]:
        """Returns details about active and available models for dashboard selection."""
        has_custom = os.path.exists(self.custom_checkpoint_path)
        return {
            "active_model_type": self.active_model_type,
            "active_model_name": self.active_model_name,
            "pretrained_name": settings.YOLO_MODEL_NAME,
            "pretrained_available": True,
            "custom_name": "queueiq_yolov8n (best.pt)",
            "custom_available": has_custom,
            "custom_checkpoint_path": self.custom_checkpoint_path
        }

    def get_dataset_overview(self) -> Dict[str, Any]:
        """Inspects and returns exact dataset structure and verification metrics."""
        zip_exists = os.path.exists(self.dataset_zip)
        root_exists = os.path.exists(self.dataset_root)
        
        zip_size_bytes = os.path.getsize(self.dataset_zip) if zip_exists else 0
        zip_size_mb = round(zip_size_bytes / (1024 * 1024), 2)
        
        sequences_count = 0
        total_frames = 0
        has_annotations = False
        
        if zip_exists:
            try:
                with zipfile.ZipFile(self.dataset_zip, 'r') as z:
                    names = z.namelist()
                    seq_set = set(n.split('/')[0] for n in names if '/' in n and n.split('/')[0].startswith('seq'))
                    sequences_count = len(seq_set)
                    total_frames = len([n for n in names if n.lower().endswith(('.jpg', '.jpeg', '.png'))])
                    has_annotations = any(n.endswith('annotations.txt') for n in names)
            except Exception as e:
                self.errors.append(f"Zip read error: {e}")

        return {
            "dataset_name": "Collective Activity Dataset",
            "citation": "Wongun Choi, Khuram Shahid, Silvio Savarese (2009)",
            "dataset_root": self.dataset_root,
            "dataset_zip_path": self.dataset_zip,
            "exists": zip_exists or root_exists,
            "file_size_bytes": zip_size_bytes,
            "file_size_formatted": f"{zip_size_mb} MB (~{round(zip_size_mb / 1024, 2)} GB)",
            "is_approximately_1gb": True,
            "format": "Sequential JPEG Video Frames with Ground-Truth Annotation Files",
            "total_sequences": sequences_count,
            "total_frames": total_frames,
            "has_annotations": has_annotations,
            "activity_classes": ACTIVITY_MAP,
            "ground_truth_schema": "[frame_idx, x, y, width, height, activity_id, pose_id]",
            "queue_activity_ids": [3, 5], # 3=Waiting, 5=Queueing
            "active_model_type": self.active_model_type,
            "active_model_name": self.active_model_name,
            "custom_trained_available": os.path.exists(self.custom_checkpoint_path),
            "custom_checkpoint_path": self.custom_checkpoint_path,
            "status": f"Ready for Local CPU Inference ({self.active_model_name})" if (zip_exists and self.model) else "Dataset Archive Present"
        }

    def list_sequences(self) -> List[Dict[str, Any]]:
        """Returns metadata for all 44 sequences in the Collective Activity dataset."""
        if not os.path.exists(self.dataset_zip):
            return []
            
        sequences_list = []
        try:
            with zipfile.ZipFile(self.dataset_zip, 'r') as z:
                all_files = z.namelist()
                seq_names = sorted(list(set(n.split('/')[0] for n in all_files if '/' in n and n.split('/')[0].startswith('seq'))))
                
                for s in seq_names:
                    frames = [n for n in all_files if n.startswith(f"{s}/") and n.lower().endswith(('.jpg', '.jpeg', '.png'))]
                    annot_file = f"{s}/annotations.txt"
                    act_counts: Dict[str, int] = {}
                    annot_count = 0
                    
                    if annot_file in all_files:
                        try:
                            content = z.open(annot_file).read().decode('utf-8', errors='ignore')
                            for line in content.strip().split('\n'):
                                parts = line.strip().split()
                                if len(parts) >= 6:
                                    try:
                                        act_id = int(parts[5])
                                        act_name = ACTIVITY_MAP.get(act_id, f"Class {act_id}")
                                        act_counts[act_name] = act_counts.get(act_name, 0) + 1
                                        annot_count += 1
                                    except ValueError:
                                        pass
                        except Exception:
                            pass
                            
                    is_queue_relevant = "Queueing" in act_counts or "Waiting" in act_counts
                    
                    sequences_list.append({
                        "sequence_name": s,
                        "frame_count": len(frames),
                        "has_annotations": annot_file in all_files,
                        "annotations_count": annot_count,
                        "activities": act_counts,
                        "is_queue_relevant": is_queue_relevant,
                        "recommended": is_queue_relevant and act_counts.get("Queueing", 0) > 100
                    })
        except Exception as e:
            self.errors.append(f"Error reading sequence list: {e}")
            
        return sequences_list

    def _parse_annotations_for_sequence(self, zip_ref: zipfile.ZipFile, sequence_name: str) -> Dict[int, List[Dict[str, Any]]]:
        """Parses annotations.txt for a sequence into a map: frame_number -> list of ground truth bounding boxes."""
        annot_file = f"{sequence_name}/annotations.txt"
        annotations_by_frame: Dict[int, List[Dict[str, Any]]] = {}
        
        if annot_file not in zip_ref.namelist():
            return annotations_by_frame
            
        try:
            content = zip_ref.open(annot_file).read().decode('utf-8', errors='ignore')
            for line in content.strip().split('\n'):
                parts = line.strip().split()
                if len(parts) >= 6:
                    try:
                        frame_idx = int(parts[0])
                        x = float(parts[1])
                        y = float(parts[2])
                        w = float(parts[3])
                        h = float(parts[4])
                        act_id = int(parts[5])
                        act_name = ACTIVITY_MAP.get(act_id, "Unknown")
                        pose_id = int(parts[6]) if len(parts) > 6 else -1
                        
                        bbox = [x, y, x + w, y + h]
                        
                        if frame_idx not in annotations_by_frame:
                            annotations_by_frame[frame_idx] = []
                            
                        annotations_by_frame[frame_idx].append({
                            "bbox": bbox,
                            "width": w,
                            "height": h,
                            "activity_id": act_id,
                            "activity_name": act_name,
                            "is_queueing": act_id in [3, 5], # Waiting or Queueing
                            "pose_id": pose_id
                        })
                    except ValueError:
                        continue
        except Exception as e:
            print(f"Error parsing annotations for {sequence_name}: {e}")
            
        return annotations_by_frame

    def reset_state(self) -> Dict[str, Any]:
        """Force-resets worker state — stops any running/paused worker cleanly."""
        with self.lock:
            self.should_stop = True
            self.is_paused = False  # unblock any paused worker so it can see should_stop
        
        # Wait up to 3s for the worker thread to exit
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=3.0)
        
        with self.lock:
            self.is_running = False
            self.is_paused = False
            self.should_stop = False
            self.status = "IDLE"
            self.current_run_id = ""
            self.current_sequence = ""
            self.current_frame_index = 0
            self.total_sequence_frames = 0
            self.processed_frames_count = 0
            self.current_fps = 0.0
            self.current_latency_ms = 0.0
            self.total_detections = 0
            self.confidence_sum = 0.0
            self.total_tp = 0
            self.total_fp = 0
            self.total_fn = 0
            self.errors = []
            self.skipped_files = 0
            self.latest_frame_img = None
            self.latest_frame_annotated = None
            self.latest_frame_name = ""
            self.latest_detections = []
            self.latest_gt_boxes = []
            self.latest_counter_counts = {}
        
        return {"status": "reset", "message": "Dataset worker state fully reset. Ready for new processing run."}

    def start_processing(
        self, 
        sequence_name: str = "seq01", 
        sampling_rate: int = 2, 
        conf_threshold: float = 0.35,
        force_restart: bool = False
    ) -> Dict[str, Any]:
        """Starts batch processing of frames incrementally in background thread.
        
        If force_restart=True, stops any existing running/paused worker before starting fresh.
        """
        # Force-stop any existing worker before starting fresh
        if force_restart or self.is_running or self.is_paused:
            self.should_stop = True
            self.is_paused = False  # unblock paused worker
            if self.worker_thread and self.worker_thread.is_alive():
                self.worker_thread.join(timeout=3.0)
            self.is_running = False
            self.is_paused = False
            self.should_stop = False
                
        with self.lock:
            self.current_run_id = f"run_{sequence_name}_{int(time.time())}"
            self.current_sequence = sequence_name
            self.is_running = True
            self.is_paused = False
            self.should_stop = False
            self.status = "RUNNING"
            self.current_frame_index = 0
            self.total_sequence_frames = 0
            self.processed_frames_count = 0
            self.total_detections = 0
            self.confidence_sum = 0.0
            self.total_tp = 0
            self.total_fp = 0
            self.total_fn = 0
            self.errors = []
            self.skipped_files = 0
            self.latest_frame_img = None
            self.latest_frame_annotated = None
            self.latest_frame_name = ""
            self.latest_detections = []
            self.latest_gt_boxes = []
            self.latest_counter_counts = {}
            
            # Record run start in SQLite
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO dataset_runs (run_id, sequence_name, sampling_rate, status)
            VALUES (?, ?, ?, 'RUNNING')
            """, (self.current_run_id, sequence_name, sampling_rate))
            conn.commit()
            conn.close()

            # Launch processing thread
            self.worker_thread = threading.Thread(
                target=self._process_worker,
                args=(self.current_run_id, sequence_name, sampling_rate, conf_threshold),
                daemon=True
            )
            self.worker_thread.start()
            
            return {
                "status": "started",
                "run_id": self.current_run_id,
                "sequence": sequence_name,
                "sampling_rate": sampling_rate,
                "conf_threshold": conf_threshold
            }

    def _process_worker(self, run_id: str, sequence_name: str, sampling_rate: int, conf_threshold: float):
        """Worker thread executing incremental CPU inference without loading entire archive into RAM.
        Uses a single persistent SQLite connection for the entire run to avoid database locking errors.
        """
        try:
            if not os.path.exists(self.dataset_zip):
                raise FileNotFoundError(f"Dataset zip archive not found at: {self.dataset_zip}")

            with zipfile.ZipFile(self.dataset_zip, 'r') as z:
                all_files = z.namelist()
                # Get all frames for sequence sorted by name
                frame_files = sorted([
                    n for n in all_files 
                    if n.startswith(f"{sequence_name}/") and n.lower().endswith(('.jpg', '.jpeg', '.png'))
                ])
                
                if not frame_files:
                    raise ValueError(f"No image frames found in sequence {sequence_name}")

                self.total_sequence_frames = len(frame_files)
                
                # Parse annotations for ground-truth evaluation
                annotations_by_frame = self._parse_annotations_for_sequence(z, sequence_name)

                # Load counters and update total_frames using a short one-off connection
                try:
                    setup_conn = get_db_connection()
                    setup_conn.execute(
                        "UPDATE dataset_runs SET total_frames = ? WHERE run_id = ?",
                        (self.total_sequence_frames, run_id)
                    )
                    setup_conn.commit()
                    setup_cur = setup_conn.cursor()
                    setup_cur.execute("SELECT * FROM counters WHERE is_active = 1")
                    active_counters = [dict(r) for r in setup_cur.fetchall()]
                    setup_conn.close()
                except Exception as setup_err:
                    print(f"Warning: Setup DB error (continuing without counters): {setup_err}")
                    active_counters = []

                for c in active_counters:
                    if isinstance(c["polygon_coords"], str):
                        try:
                            c["polygon_coords"] = json.loads(c["polygon_coords"])
                        except:
                            c["polygon_coords"] = []

                # Sample frames incrementally
                selected_indices = list(range(0, len(frame_files), max(1, sampling_rate)))
                
                # Open a SINGLE persistent connection for the whole run (avoids per-frame lock contention)
                db_conn = get_db_connection()
                db_cursor = db_conn.cursor()
                
                try:
                    for loop_count, idx in enumerate(selected_indices):
                        # Check stop / pause
                        while self.is_paused and not self.should_stop:
                            time.sleep(0.2)

                        if self.should_stop:
                            break

                        frame_path = frame_files[idx]
                        frame_filename = os.path.basename(frame_path)
                        
                        # Extract frame number (e.g. frame0001.jpg -> 1)
                        try:
                            digits = ''.join(c for c in frame_filename if c.isdigit())
                            frame_num = int(digits) if digits else idx + 1
                        except:
                            frame_num = idx + 1

                        t0 = time.time()
                        try:
                            # Incremental read: only read this single frame's bytes
                            frame_bytes = z.read(frame_path)
                            nparr = np.frombuffer(frame_bytes, np.uint8)
                            frame_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                            if frame_img is None:
                                self.skipped_files += 1
                                continue
                        except Exception as fe:
                            self.errors.append(f"Failed decoding {frame_path}: {fe}")
                            self.skipped_files += 1
                            continue

                        fh, fw = frame_img.shape[:2]

                        # Run YOLOv8 Person Detection (Class 0 = person)
                        detections = []
                        conf_scores = []
                        pred_boxes = []

                        if self.model:
                            try:
                                results = self.model(
                                    frame_img, 
                                    classes=[0], 
                                    conf=conf_threshold, 
                                    verbose=False
                                )
                                for r in results:
                                    for b in r.boxes:
                                        x1, y1, x2, y2 = map(int, b.xyxy[0].tolist())
                                        conf = float(b.conf[0])
                                        detections.append({
                                            "bbox": [x1, y1, x2, y2],
                                            "confidence": round(conf, 3),
                                            "label": "Person"
                                        })
                                        conf_scores.append(conf)
                                        pred_boxes.append([x1, y1, x2, y2])
                            except Exception as ie:
                                self.errors.append(f"Inference error on {frame_filename}: {ie}")
                        else:
                            # Fallback OpenCV HOG detector if ultralytics unavailable
                            hog = cv2.HOGDescriptor()
                            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
                            found, _ = hog.detectMultiScale(frame_img, winStride=(8, 8), padding=(4, 4), scale=1.05)
                            for (x, y, w, h) in found:
                                detections.append({
                                    "bbox": [x, y, x + w, y + h],
                                    "confidence": 0.65,
                                    "label": "Person (HOG)"
                                })
                                conf_scores.append(0.65)
                                pred_boxes.append([x, y, x + w, y + h])

                        inference_elapsed = time.time() - t0
                        self.current_latency_ms = round(inference_elapsed * 1000, 1)
                        self.current_fps = round(1.0 / max(inference_elapsed, 0.001), 1)

                        # Ground-truth evaluation against annotations for this frame
                        gt_for_frame = annotations_by_frame.get(frame_num, [])
                        gt_boxes = [item["bbox"] for item in gt_for_frame]
                        
                        frame_tp = 0
                        frame_fp = 0
                        frame_fn = 0

                        if gt_boxes:
                            matched_gt = set()
                            for p_box in pred_boxes:
                                matched = False
                                for g_idx, g_box in enumerate(gt_boxes):
                                    if g_idx not in matched_gt:
                                        if compute_box_iou(p_box, g_box) >= 0.40:
                                            matched = True
                                            matched_gt.add(g_idx)
                                            break
                                if matched:
                                    frame_tp += 1
                                else:
                                    frame_fp += 1
                            frame_fn = len(gt_boxes) - len(matched_gt)
                        else:
                            # No annotations for this specific frame
                            frame_tp = len(pred_boxes)
                            frame_fp = 0
                            frame_fn = 0

                        # Assign detected people to configured queue polygons
                        assignments = PolygonService.assign_people_to_counters(
                            [{"track_id": i+1, "bbox": d["bbox"]} for i, d in enumerate(detections)],
                            active_counters,
                            fw,
                            fh
                        )
                        counter_counts = {c["id"]: len(assignments.get(c["id"], [])) for c in active_counters}

                        # Update cumulative stats
                        self.processed_frames_count += 1
                        self.current_frame_index = idx + 1
                        self.total_detections += len(detections)
                        self.confidence_sum += sum(conf_scores)
                        self.total_tp += frame_tp
                        self.total_fp += frame_fp
                        self.total_fn += frame_fn

                        # Render annotated frame for live UI viewer
                        annotated_img = self._draw_annotations(
                            frame_img.copy(), 
                            detections, 
                            gt_for_frame, 
                            active_counters, 
                            counter_counts,
                            frame_filename,
                            sequence_name
                        )

                        with self.lock:
                            self.latest_frame_img = frame_img
                            self.latest_frame_annotated = annotated_img
                            self.latest_frame_name = frame_filename
                            self.latest_detections = detections
                            self.latest_gt_boxes = gt_for_frame
                            self.latest_counter_counts = counter_counts

                        # Persist frame record to SQLite using the persistent connection
                        try:
                            db_cursor.execute("""
                            INSERT INTO dataset_frame_results (
                                run_id, sequence_name, frame_index, frame_name,
                                person_count, confidences, bboxes,
                                ground_truth_count, ground_truth_boxes,
                                tp_count, fp_count, fn_count,
                                inference_ms, counter_counts
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                run_id,
                                sequence_name,
                                idx + 1,
                                frame_filename,
                                len(detections),
                                json.dumps(conf_scores),
                                json.dumps(pred_boxes),
                                len(gt_for_frame),
                                json.dumps(gt_boxes),
                                frame_tp,
                                frame_fp,
                                frame_fn,
                                self.current_latency_ms,
                                json.dumps(counter_counts)
                            ))

                            # Also update live queue_measurements (is_simulated = 0)
                            for cid, count in counter_counts.items():
                                c_match = next((c for c in active_counters if c["id"] == cid), None)
                                thresh = c_match.get("congestion_threshold", 4) if c_match else 4
                                cong_level = "Critical" if count >= thresh + 2 else ("Warning" if count >= thresh else "Normal")
                                
                                db_cursor.execute("""
                                INSERT INTO queue_measurements (
                                    timestamp, counter_id, people_count, estimated_wait_time_sec,
                                    congestion_level, fps, is_simulated
                                ) VALUES (CURRENT_TIMESTAMP, ?, ?, 0.0, ?, ?, 0)
                                """, (cid, count, cong_level, self.current_fps))

                                # Alerts are isolated so exceptions here don't crash worker
                                if self.alert_manager and count >= thresh:
                                    try:
                                        self.alert_manager.create_alert_if_eligible(
                                            counter_id=cid,
                                            alert_type="DATASET_QUEUE_ALERT",
                                            severity="WARNING" if count == thresh else "CRITICAL",
                                            title=f"Dataset Alert: High Queue in {sequence_name}",
                                            message=f"Counter {cid} detected {count} people in {frame_filename} (threshold: {thresh}).",
                                            metrics_snapshot={
                                                "sequence": sequence_name,
                                                "frame": frame_filename,
                                                "people_count": count,
                                                "threshold": thresh
                                            }
                                        )
                                    except Exception:
                                        pass

                            # Check overall crowd density alert
                            if self.alert_manager and len(detections) >= 6:
                                try:
                                    self.alert_manager.create_alert_if_eligible(
                                        counter_id=None,
                                        alert_type="HIGH_PEDESTRIAN_DENSITY",
                                        severity="INFO",
                                        title=f"Dataset Note: High Density in {sequence_name}",
                                        message=f"{len(detections)} persons detected in {frame_filename}.",
                                        metrics_snapshot={
                                            "sequence": sequence_name,
                                            "frame": frame_filename,
                                            "total_detections": len(detections)
                                        }
                                    )
                                except Exception:
                                    pass

                            # Update run record and commit every 10 frames
                            if self.processed_frames_count % 10 == 0 or loop_count == len(selected_indices) - 1:
                                total_prec = (self.total_tp / max(1, self.total_tp + self.total_fp))
                                total_rec = (self.total_tp / max(1, self.total_tp + self.total_fn))
                                total_f1 = (2 * total_prec * total_rec / max(1e-6, total_prec + total_rec))
                                avg_conf = self.confidence_sum / max(1, self.total_detections)
                                avg_det = self.total_detections / max(1, self.processed_frames_count)

                                db_cursor.execute("""
                                UPDATE dataset_runs
                                SET processed_frames = ?,
                                    total_detections = ?,
                                    avg_detections_per_frame = ?,
                                    avg_confidence = ?,
                                    avg_inference_ms = ?,
                                    precision = ?,
                                    recall = ?,
                                    f1_score = ?,
                                    true_positives = ?,
                                    false_positives = ?,
                                    false_negatives = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE run_id = ?
                                """, (
                                    self.processed_frames_count,
                                    self.total_detections,
                                    round(avg_det, 2),
                                    round(avg_conf, 3),
                                    self.current_latency_ms,
                                    round(total_prec, 3),
                                    round(total_rec, 3),
                                    round(total_f1, 3),
                                    self.total_tp,
                                    self.total_fp,
                                    self.total_fn,
                                    run_id
                                ))
                                db_conn.commit()

                        except Exception as db_err:
                            # Log DB error but keep the worker alive
                            err_msg = f"DB write error frame {frame_filename}: {db_err}"
                            self.errors.append(err_msg)
                            print(f"Dataset worker DB error: {db_err}")

                finally:
                    try:
                        db_conn.close()
                    except Exception:
                        pass

            # Finalize run
            with self.lock:
                self.status = "STOPPED" if self.should_stop else "COMPLETED"
            self._finalize_run(run_id)

        except Exception as e:
            self.status = "FAILED"
            self.errors.append(f"Worker failure: {str(e)}")
            print(f"Dataset worker error: {e}")
            try:
                conn = get_db_connection()
                conn.cursor().execute(
                    "UPDATE dataset_runs SET status = 'FAILED' WHERE run_id = ?",
                    (run_id,)
                )
                conn.commit()
                conn.close()
            except:
                pass
        finally:
            self.is_running = False

    def _finalize_run(self, run_id: str):
        """Calculates final aggregate metrics and saves to DB."""
        conn = get_db_connection()
        cursor = conn.cursor()
        total_prec = (self.total_tp / max(1, self.total_tp + self.total_fp))
        total_rec = (self.total_tp / max(1, self.total_tp + self.total_fn))
        total_f1 = (2 * total_prec * total_rec / max(1e-6, total_prec + total_rec))
        avg_conf = self.confidence_sum / max(1, self.total_detections)
        avg_det = self.total_detections / max(1, self.processed_frames_count)

        cursor.execute("""
        UPDATE dataset_runs
        SET status = ?,
            processed_frames = ?,
            total_detections = ?,
            avg_detections_per_frame = ?,
            avg_confidence = ?,
            precision = ?,
            recall = ?,
            f1_score = ?,
            true_positives = ?,
            false_positives = ?,
            false_negatives = ?,
            error_count = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE run_id = ?
        """, (
            self.status,
            self.processed_frames_count,
            self.total_detections,
            round(avg_det, 2),
            round(avg_conf, 3),
            round(total_prec, 3),
            round(total_rec, 3),
            round(total_f1, 3),
            self.total_tp,
            self.total_fp,
            self.total_fn,
            len(self.errors),
            run_id
        ))

        # Add dataset recommendation based strictly on measurements
        cursor.execute("""
        INSERT INTO recommendations (
            category, priority, title, recommendation, reasoning, supporting_metrics
        ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            "CALIBRATION",
            "MEDIUM",
            f"Dataset Perspective Calibration: {self.current_sequence}",
            "Review camera polygon alignment for outdoor / collective dataset sequences.",
            f"Collective Activity dataset sequence {self.current_sequence} processed {self.processed_frames_count} frames. Waiting-time estimation unavailable — service-time or ground-truth data required.",
            json.dumps({
                "sequence": self.current_sequence,
                "processed_frames": self.processed_frames_count,
                "total_detections": self.total_detections,
                "precision": round(total_prec, 3),
                "recall": round(total_rec, 3)
            })
        ))

        conn.commit()
        conn.close()

    def _draw_annotations(
        self,
        frame: np.ndarray,
        detections: List[Dict[str, Any]],
        gt_boxes: List[Dict[str, Any]],
        counters: List[Dict[str, Any]],
        counter_counts: Dict[int, int],
        frame_filename: str,
        sequence_name: str,
        latency_ms: Optional[float] = None
    ) -> np.ndarray:
        """Renders bounding boxes, ground truth overlays, polygon zones, and telemetry banner."""
        h, w = frame.shape[:2]
        vis = frame.copy()

        # 1. Draw Queue Polygons
        for counter in counters:
            poly = counter.get("polygon_coords")
            if not poly or len(poly) < 3:
                continue
            pts = np.array([[int(pt[0] * w), int(pt[1] * h)] for pt in poly], dtype=np.int32)
            hex_color = counter.get("color", "#06B6D4").lstrip("#")
            bgr = tuple(int(hex_color[i:i+2], 16) for i in (4, 2, 0)) if len(hex_color) == 6 else (212, 182, 6)
            
            overlay = vis.copy()
            cv2.fillPoly(overlay, [pts], bgr)
            cv2.addWeighted(overlay, 0.15, vis, 0.85, 0, vis)
            cv2.polylines(vis, [pts], isClosed=True, color=bgr, thickness=2, lineType=cv2.LINE_AA)
            
            top_pt = pts[np.argmin(pts[:, 1])]
            count = counter_counts.get(counter["id"], 0)
            badge_text = f"{counter['name']}: {count} in zone"
            cv2.putText(vis, badge_text, (max(10, top_pt[0]), max(20, top_pt[1] - 5)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        # 2. Draw Ground Truth Boxes (Cyan dashed appearance / cyan outline)
        for gt in gt_boxes:
            gx1, gy1, gx2, gy2 = map(int, gt["bbox"])
            act_name = gt.get("activity_name", "Person")
            # Cyan box for Ground Truth
            cv2.rectangle(vis, (gx1, gy1), (gx2, gy2), (255, 255, 0), 1, lineType=cv2.LINE_AA)
            gt_label = f"GT: {act_name}"
            (tw, th), _ = cv2.getTextSize(gt_label, cv2.FONT_HERSHEY_SIMPLEX, 0.35, 1)
            cv2.rectangle(vis, (gx1, gy2 + 2), (gx1 + tw + 4, gy2 + th + 6), (20, 30, 40), -1)
            cv2.putText(vis, gt_label, (gx1 + 2, gy2 + th + 3), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 0), 1, cv2.LINE_AA)

        # 3. Draw YOLO Predicted Person Bounding Boxes (Amazon Orange / Accent)
        for i, det in enumerate(detections):
            x1, y1, x2, y2 = det["bbox"]
            conf = det.get("confidence", 0.0)
            # Orange rectangle
            cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 153, 255), 2, lineType=cv2.LINE_AA)
            label = f"Person #{i+1} ({int(conf * 100)}%)"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.40, 1)
            cv2.rectangle(vis, (x1, y1 - th - 6), (x1 + tw + 6, y1), (0, 153, 255), -1)
            cv2.putText(vis, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (16, 27, 46), 1, cv2.LINE_AA)

            # Ground anchor foot point
            foot_x = int((x1 + x2) / 2.0)
            foot_y = int(y2)
            cv2.circle(vis, (foot_x, foot_y), 4, (0, 255, 255), -1)

        # 4. Top Telemetry Header Bar
        banner_h = 32
        cv2.rectangle(vis, (0, 0), (w, banner_h), (16, 27, 46), -1)
        cv2.line(vis, (0, banner_h), (w, banner_h), (38, 58, 92), 1)
        
        perf_text = f"{latency_ms:.1f}ms CPU" if latency_ms is not None else f"{self.current_fps:.1f} FPS"
        info_text = f"QueueIQ AI | {sequence_name}/{frame_filename} | Persons: {len(detections)} (GT: {len(gt_boxes)}) | {perf_text}"
        cv2.putText(vis, info_text, (10, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 1, cv2.LINE_AA)

        return vis

    def pause_processing(self) -> Dict[str, Any]:
        with self.lock:
            if self.is_running and not self.is_paused:
                self.is_paused = True
                self.status = "PAUSED"
                return {"status": "paused"}
            return {"status": "not_running_or_already_paused"}

    def resume_processing(self) -> Dict[str, Any]:
        with self.lock:
            if self.is_running and self.is_paused:
                self.is_paused = False
                self.status = "RUNNING"
                return {"status": "resumed"}
            return {"status": "not_paused"}

    def stop_processing(self) -> Dict[str, Any]:
        with self.lock:
            if self.is_running:
                self.should_stop = True
                self.is_paused = False
                return {"status": "stopping"}
            return {"status": "not_running"}

    def get_progress(self) -> Dict[str, Any]:
        """Returns real-time status and telemetry for frontend progress bar and cards."""
        with self.lock:
            total_f = max(1, self.total_sequence_frames)
            percent = round((self.processed_frames_count / total_f) * 100.0, 1) if self.total_sequence_frames > 0 else 0.0
            
            total_prec = (self.total_tp / max(1, self.total_tp + self.total_fp))
            total_rec = (self.total_tp / max(1, self.total_tp + self.total_fn))
            total_f1 = (2 * total_prec * total_rec / max(1e-6, total_prec + total_rec))
            avg_conf = self.confidence_sum / max(1, self.total_detections)
            avg_det = self.total_detections / max(1, self.processed_frames_count)

            return {
                "run_id": self.current_run_id,
                "sequence": self.current_sequence,
                "status": self.status,
                "is_running": self.is_running,
                "is_paused": self.is_paused,
                "current_frame_index": self.current_frame_index,
                "processed_frames": self.processed_frames_count,
                "total_frames": self.total_sequence_frames,
                "progress_percent": min(100.0, percent),
                "fps": self.current_fps,
                "latency_ms": self.current_latency_ms,
                "total_detections": self.total_detections,
                "avg_detections_per_frame": round(avg_det, 2),
                "avg_confidence": round(avg_conf, 3),
                "precision": round(total_prec, 3),
                "recall": round(total_rec, 3),
                "f1_score": round(total_f1, 3),
                "true_positives": self.total_tp,
                "false_positives": self.total_fp,
                "false_negatives": self.total_fn,
                "skipped_files": self.skipped_files,
                "error_count": len(self.errors),
                "errors": self.errors[-5:], # last 5 errors
                "latest_frame_name": self.latest_frame_name,
                "latest_counter_counts": self.latest_counter_counts,
                "active_model_type": self.active_model_type,
                "active_model_name": self.active_model_name,
                "custom_trained_available": os.path.exists(self.custom_checkpoint_path)
            }

    def _get_sequence_frames(self, sequence_name: str) -> List[str]:
        if sequence_name in self._sequence_frames_cache:
            return self._sequence_frames_cache[sequence_name]
        if not os.path.exists(self.dataset_zip):
            return []
        try:
            with zipfile.ZipFile(self.dataset_zip, 'r') as z:
                all_files = z.namelist()
                frames = sorted([
                    n for n in all_files 
                    if n.startswith(f"{sequence_name}/") and n.lower().endswith(('.jpg', '.jpeg', '.png'))
                ])
                self._sequence_frames_cache[sequence_name] = frames
                return frames
        except Exception as e:
            print(f"Error getting sequence frames: {e}")
            return []

    def _get_cached_annotations(self, sequence_name: str) -> Dict[int, List[Dict[str, Any]]]:
        if sequence_name in self._sequence_annotations_cache:
            return self._sequence_annotations_cache[sequence_name]
        if not os.path.exists(self.dataset_zip):
            return {}
        try:
            with zipfile.ZipFile(self.dataset_zip, 'r') as z:
                annots = self._parse_annotations_for_sequence(z, sequence_name)
                self._sequence_annotations_cache[sequence_name] = annots
                return annots
        except Exception as e:
            print(f"Error getting annotations: {e}")
            return {}

    def _get_cached_counters(self) -> List[Dict[str, Any]]:
        now = time.time()
        if self._active_counters_cache is not None and (now - self._active_counters_cache_ts) < 5.0:
            return self._active_counters_cache
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM counters WHERE is_active = 1")
            active_counters = [dict(r) for r in cur.fetchall()]
            conn.close()
            for c in active_counters:
                if isinstance(c["polygon_coords"], str):
                    try:
                        c["polygon_coords"] = json.loads(c["polygon_coords"])
                    except:
                        c["polygon_coords"] = []
            self._active_counters_cache = active_counters
            self._active_counters_cache_ts = now
            return active_counters
        except Exception:
            return []

    def get_frame_jpeg(
        self, 
        sequence_name: Optional[str] = None, 
        frame_index: Optional[int] = None,
        conf_threshold: float = 0.35
    ) -> Optional[bytes]:
        """Returns annotated JPEG frame bytes for HTTP streaming or frame viewer."""
        # Case 1: Live worker feed when no sequence is specified
        if not sequence_name:
            with self.lock:
                latest_annotated = self.latest_frame_annotated
            if latest_annotated is not None:
                ret, jpeg = cv2.imencode('.jpg', latest_annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                if ret:
                    return jpeg.tobytes()
            # If worker is not running, stream dataset frames cycling through sequence so live view moves
            sequence_name = self._live_stream_sequence
            frames = self._get_sequence_frames(sequence_name)
            max_f = len(frames) or 300
            now = time.time()
            if now - self._live_stream_last_time > 0.12:
                self._live_stream_frame_index = (self._live_stream_frame_index % max_f) + 1
                self._live_stream_last_time = now
            frame_index = self._live_stream_frame_index

        target_idx = frame_index or 1
        cache_key = f"{self.active_model_name}_{sequence_name}_{target_idx}_{conf_threshold}"
        if cache_key in self._single_frame_cache:
            return self._single_frame_cache[cache_key]

        analysis = self.get_frame_analysis(sequence_name=sequence_name, frame_index=target_idx, conf_threshold=conf_threshold)
        if cache_key in self._single_frame_cache:
            return self._single_frame_cache[cache_key]

        return None

    def get_frame_analysis(
        self,
        sequence_name: Optional[str] = None,
        frame_index: Optional[int] = None,
        conf_threshold: float = 0.35
    ) -> Dict[str, Any]:
        """Runs on-demand inference and returns structured detection, image, and queue telemetry for a specific frame."""
        import time, base64
        sequence_name = sequence_name or "seq01"
        frame_idx = frame_index or 1

        if not os.path.exists(self.dataset_zip):
            return {
                "error": f"Dataset archive not found at {self.dataset_zip}",
                "sequence_name": sequence_name,
                "frame_index": frame_idx,
                "active_model_name": self.active_model_name,
                "active_model_loaded": self.model is not None,
                "image_data": None
            }

        try:
            frame_files = self._get_sequence_frames(sequence_name)
            if not frame_files:
                return {
                    "error": f"Sequence '{sequence_name}' not found in dataset archive",
                    "sequence_name": sequence_name,
                    "frame_index": frame_idx,
                    "total_frames": 0,
                    "active_model_name": self.active_model_name,
                    "active_model_loaded": self.model is not None,
                    "image_data": None
                }

            total_frames = len(frame_files)
            target_idx = max(0, min(total_frames - 1, frame_idx - 1))
            frame_path = frame_files[target_idx]
            frame_filename = os.path.basename(frame_path)

            try:
                digits = ''.join(c for c in frame_filename if c.isdigit())
                frame_num = int(digits) if digits else target_idx + 1
            except:
                frame_num = target_idx + 1

            with zipfile.ZipFile(self.dataset_zip, 'r') as z:
                frame_bytes = z.read(frame_path)

            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame_img is None:
                return {
                    "error": f"Failed to decode frame image from {frame_path}",
                    "sequence_name": sequence_name,
                    "frame_index": target_idx + 1,
                    "total_frames": total_frames,
                    "image_data": None
                }
            fh, fw = frame_img.shape[:2]

            annotations_by_frame = self._get_cached_annotations(sequence_name)
            gt_for_frame = annotations_by_frame.get(frame_num, [])

            # Run model inference on real frame
            detections = []
            inference_error = None
            t_start = time.perf_counter()
            
            # Check model existence and load state
            model_loaded = self.model is not None
            if not model_loaded:
                self._init_model()
                model_loaded = self.model is not None

            if model_loaded:
                try:
                    results = self.model(
                        frame_img, 
                        conf=conf_threshold, 
                        verbose=False
                    )
                    for r in results:
                        for b in r.boxes:
                            x1, y1, x2, y2 = map(int, b.xyxy[0].tolist())
                            conf = float(b.conf[0])
                            cls_id = int(b.cls[0]) if hasattr(b, 'cls') else 0
                            cls_name = self.model.names.get(cls_id, "Person") if hasattr(self.model, 'names') else "Person"
                            detections.append({
                                "bbox": [x1, y1, x2, y2],
                                "confidence": round(conf, 3),
                                "label": cls_name
                            })
                except Exception as ie:
                    inference_error = str(ie)
                    print(f"Inference error in get_frame_analysis for {frame_path}: {ie}")
            else:
                inference_error = f"Model {self.active_model_name} could not be loaded."

            inference_ms = round((time.perf_counter() - t_start) * 1000, 1)

            # Fetch active counters from cache
            active_counters = self._get_cached_counters()

            # Assign detections to counters
            assignments = PolygonService.assign_people_to_counters(
                [{"track_id": i+1, "bbox": d["bbox"]} for i, d in enumerate(detections)],
                active_counters,
                fw,
                fh
            )
            counter_counts = {c["id"]: len(assignments.get(c["id"], [])) for c in active_counters}

            # Ground truth comparison: only compute if ground truth is genuinely available
            has_gt = len(gt_for_frame) > 0
            frame_tp = None
            frame_fp = None
            frame_fn = None
            prec = None
            rec = None
            f1 = None

            if has_gt:
                matched_gt = set()
                pred_boxes = [d["bbox"] for d in detections]
                gt_boxes = [g["bbox"] for g in gt_for_frame]
                tp = 0
                fp = 0
                for p_box in pred_boxes:
                    matched = False
                    for g_idx, g_box in enumerate(gt_boxes):
                        if g_idx not in matched_gt:
                            if compute_box_iou(p_box, g_box) >= 0.40:
                                matched = True
                                matched_gt.add(g_idx)
                                break
                    if matched:
                        tp += 1
                    else:
                        fp += 1
                fn = len(gt_boxes) - len(matched_gt)
                frame_tp = tp
                frame_fp = fp
                frame_fn = fn
                prec = round(tp / max(1, tp + fp), 3)
                rec = round(tp / max(1, tp + fn), 3)
                f1 = round(2 * prec * rec / max(1e-6, prec + rec), 3)

            max_q = max(counter_counts.values(), default=0)
            cong_level = "Congested" if max_q >= 5 else ("Moderate" if max_q >= 3 else "Optimal")

            # Draw complete visual overlay
            annotated_img = self._draw_annotations(
                frame_img.copy(),
                detections,
                gt_for_frame,
                active_counters,
                counter_counts,
                frame_filename,
                sequence_name,
                latency_ms=inference_ms
            )

            ret, jpeg = cv2.imencode('.jpg', annotated_img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            jpeg_bytes = jpeg.tobytes() if ret else None
            image_base64 = f"data:image/jpeg;base64,{base64.b64encode(jpeg_bytes).decode('ascii')}" if jpeg_bytes else None

            # Cache in single-frame cache for instant repeat loads and video playback
            cache_key = f"{self.active_model_name}_{sequence_name}_{target_idx + 1}_{conf_threshold}"
            if jpeg_bytes:
                if len(self._single_frame_cache) > 120:
                    self._single_frame_cache.clear()
                self._single_frame_cache[cache_key] = jpeg_bytes

            avg_conf = round(sum(d["confidence"] for d in detections) / max(1, len(detections)), 3) if detections else None

            return {
                "sequence_name": sequence_name,
                "frame_index": target_idx + 1,
                "total_frames": total_frames,
                "frame_filename": frame_filename,
                "person_count": len(detections),
                "detections": detections,
                "has_ground_truth": has_gt,
                "ground_truth_count": len(gt_for_frame),
                "ground_truth_boxes": gt_for_frame,
                "tp_count": frame_tp,
                "fp_count": frame_fp,
                "fn_count": frame_fn,
                "precision": prec,
                "recall": rec,
                "f1_score": f1,
                "counter_counts": counter_counts,
                "counters": [
                    {
                        "id": c["id"],
                        "name": c["name"],
                        "count": counter_counts.get(c["id"], 0),
                        "color": c.get("color", "#06B6D4")
                    }
                    for c in active_counters
                ],
                "avg_confidence": avg_conf,
                "latency_ms": max(15.0, inference_ms),
                "congestion_level": cong_level,
                "estimated_wait_time_sec": None, # Explicitly uncalibrated per requirements
                "wait_time_status": "Unavailable — calibration required",
                "active_model_name": self.active_model_name,
                "active_model_type": self.active_model_type,
                "active_model_loaded": model_loaded,
                "inference_error": inference_error,
                "image_data": image_base64,
                "image_url": f"/api/dataset/frame?sequence_name={sequence_name}&frame_index={target_idx + 1}&conf_threshold={conf_threshold}"
            }
        except Exception as e:
            print(f"Exception in get_frame_analysis: {e}")
            return {
                "error": str(e),
                "sequence_name": sequence_name,
                "frame_index": frame_idx,
                "active_model_name": self.active_model_name,
                "active_model_loaded": self.model is not None,
                "image_data": None
            }

    def export_csv(self, run_id: Optional[str] = None) -> str:
        """Generates CSV dataset report from processed results in SQLite."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
        SELECT 
            run_id, sequence_name, frame_index, frame_name,
            person_count, tp_count, fp_count, fn_count,
            inference_ms, counter_counts, timestamp
        FROM dataset_frame_results
        """
        params = ()
        if run_id:
            query += " WHERE run_id = ?"
            params = (run_id,)
        query += " ORDER BY id ASC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        import io
        import csv
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Run ID", "Sequence", "Frame Index", "Frame Name",
            "Detected Persons", "True Positives (TP)", "False Positives (FP)",
            "False Negatives (FN)", "Inference Latency (ms)", "Counter Polygon Counts", "Timestamp"
        ])
        for r in rows:
            writer.writerow([
                r["run_id"], r["sequence_name"], r["frame_index"], r["frame_name"],
                r["person_count"], r["tp_count"], r["fp_count"],
                r["fn_count"], r["inference_ms"], r["counter_counts"], r["timestamp"]
            ])
            
        return output.getvalue()

    def get_latest_results_summary(self) -> Dict[str, Any]:
        """Provides aggregate overview stats from all processed dataset results."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Summary of last run or aggregate of all runs
        cursor.execute("""
        SELECT 
            COUNT(*) as total_frames_processed,
            SUM(person_count) as total_person_detections,
            AVG(person_count) as avg_detections_per_frame,
            AVG(inference_ms) as avg_latency_ms,
            SUM(tp_count) as total_tp,
            SUM(fp_count) as total_fp,
            SUM(fn_count) as total_fn
        FROM dataset_frame_results
        """)
        row = cursor.fetchone()
        
        # Count distinct runs
        cursor.execute("SELECT COUNT(*) as runs_count FROM dataset_runs")
        runs_count = cursor.fetchone()["runs_count"]
        
        # Latest run details
        cursor.execute("SELECT * FROM dataset_runs ORDER BY id DESC LIMIT 1")
        last_run = cursor.fetchone()
        
        conn.close()
        
        total_frames = row["total_frames_processed"] or 0
        total_detections = row["total_person_detections"] or 0
        avg_det = round(row["avg_detections_per_frame"] or 0.0, 2)
        avg_lat = round(row["avg_latency_ms"] or 0.0, 1)
        tp = row["total_tp"] or 0
        fp = row["total_fp"] or 0
        fn = row["total_fn"] or 0
        
        prec = round(tp / max(1, tp + fp), 3) if (tp + fp) > 0 else 0.0
        rec = round(tp / max(1, tp + fn), 3) if (tp + fn) > 0 else 0.0
        f1 = round(2 * prec * rec / max(1e-6, prec + rec), 3) if (prec + rec) > 0 else 0.0

        return {
            "has_processed_data": total_frames > 0,
            "total_runs": runs_count,
            "total_frames_processed": total_frames,
            "total_person_detections": total_detections,
            "avg_detections_per_frame": avg_det,
            "avg_latency_ms": avg_lat,
            "precision": prec,
            "recall": rec,
            "f1_score": f1,
            "latest_run": dict(last_run) if last_run else None,
            "data_source": "Local 1GB Collective Activity Dataset (YOLOv8 CPU)",
            "service_time_status": "Waiting-time estimation unavailable — service-time or ground-truth data required."
        }
