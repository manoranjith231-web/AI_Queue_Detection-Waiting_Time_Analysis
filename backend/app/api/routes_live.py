import asyncio
import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import Dict, Any, List
from backend.app.database import get_db_connection

router = APIRouter(prefix="/live", tags=["Live Monitoring"])

vision_engine = None

def get_vision_engine():
    global vision_engine
    return vision_engine

def get_all_active_counters() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM counters WHERE is_active = 1 ORDER BY id ASC")
    rows = cursor.fetchall()
    counters = []
    for r in rows:
        c = dict(r)
        if isinstance(c["polygon_coords"], str):
            try:
                c["polygon_coords"] = json.loads(c["polygon_coords"])
            except Exception:
                c["polygon_coords"] = []
        counters.append(c)
    conn.close()
    return counters

from backend.app.config import settings
from backend.app.api import routes_dataset

@router.get("/status")
def get_live_status():
    ds_svc = routes_dataset.dataset_service
    if settings.DATASET_ONLY_MODE and ds_svc:
        counters = get_all_active_counters()
        prog = ds_svc.get_progress()
        counts_map = prog.get("latest_counter_counts", {})
        
        counters_summary = []
        for c in counters:
            cid = c["id"]
            cnt = counts_map.get(cid, 0)
            thresh = c.get("congestion_threshold", 4)
            cong_level = "Critical" if cnt >= thresh + 2 else ("Warning" if cnt >= thresh else "Normal")
            
            counters_summary.append({
                "id": cid,
                "counter_code": c.get("counter_code", f"C{cid}"),
                "name": c["name"],
                "category": c.get("category", "Standard"),
                "is_active": c.get("is_active", 1),
                "people_count": cnt,
                "raw_count": cnt,
                "people_ahead": max(0, cnt - 1),
                "estimated_wait_time_sec": 0.0,
                "estimated_wait_time_min": 0.0,
                "is_calibrated": False,
                "calculation_mode": "Dataset Detections",
                "congestion_level": cong_level,
                "congestion_label": cong_level,
                "congestion_color": "#EF4444" if cong_level == "Critical" else ("#F59E0B" if cong_level == "Warning" else "#10B981"),
                "congestion_threshold": thresh,
                "color": c.get("color", "#2874F0"),
                "boundary_alert": False,
                "service_time_status": "Waiting-time estimation unavailable — service-time or ground-truth data required."
            })
            
        return {
            "fps": prog["fps"] if prog["is_running"] else 0.0,
            "latency_ms": prog["latency_ms"] if prog["is_running"] else 0.0,
            "model_status": "YOLOv8n (Local CPU)",
            "camera_status": f"Dataset: {prog['sequence']}" if prog["sequence"] else "1GB Collective Activity Dataset",
            "current_source": "dataset",
            "is_simulated": False,
            "total_waiting": sum(c["people_count"] for c in counters_summary if c["is_active"]),
            "counters": counters_summary,
            "dataset_progress": prog
        }

    engine = get_vision_engine()
    if not engine:
        raise HTTPException(status_code=503, detail="Vision engine not initialized")
    
    counters = get_all_active_counters()
    result = engine.process_frame(counters)
    return result

@router.post("/start")
def start_live_camera(payload: Dict[str, Any] = None):
    if settings.DATASET_ONLY_MODE:
        return {
            "status": "dataset_only_mode",
            "camera_status": "Dataset-Only Mode Active (Webcam Disabled)",
            "is_demo_mode": False,
            "current_source": "dataset"
        }
    engine = get_vision_engine()
    source_type = (payload or {}).get("source_type", "webcam")
    file_path = (payload or {}).get("file_path", "")
    mobile_url = (payload or {}).get("mobile_url", "")
    
    success = engine.start_camera(source_type=source_type, file_path=file_path, mobile_url=mobile_url)
    return {
        "status": "success" if success else "fallback_demo",
        "camera_status": engine.camera_status,
        "is_demo_mode": engine.is_demo_mode,
        "current_source": engine.current_source
    }

@router.post("/stop")
def stop_live_camera():
    if settings.DATASET_ONLY_MODE:
        ds_svc = routes_dataset.dataset_service
        if ds_svc:
            ds_svc.stop_processing()
        return {"status": "success", "camera_status": "Dataset Processing Stopped"}
    engine = get_vision_engine()
    engine.stop_camera()
    return {
        "status": "success",
        "camera_status": engine.camera_status
    }

@router.post("/switch-source")
def switch_source(payload: Dict[str, Any]):
    if settings.DATASET_ONLY_MODE:
        return {
            "status": "dataset_only_mode",
            "camera_status": "1GB Collective Activity Dataset",
            "is_demo_mode": False,
            "current_source": "dataset"
        }
    engine = get_vision_engine()
    source_type = payload.get("source_type", "demo")
    file_path = payload.get("file_path", "")
    mobile_url = payload.get("mobile_url", "")
    
    engine.stop_camera()
    success = engine.start_camera(source_type=source_type, file_path=file_path, mobile_url=mobile_url)
    return {
        "status": "success" if success else "error",
        "camera_status": engine.camera_status,
        "is_demo_mode": engine.is_demo_mode,
        "current_source": engine.current_source
    }

@router.post("/phone-frame")
async def receive_phone_frame(file: UploadFile = File(...)):
    if settings.DATASET_ONLY_MODE:
        raise HTTPException(status_code=403, detail="Mobile camera stream disabled in Dataset-Only mode")
    engine = get_vision_engine()
    if not engine:
        raise HTTPException(status_code=503, detail="Vision engine not ready")
    
    image_bytes = await file.read()
    engine.set_mobile_frame_from_browser(image_bytes)
    return {"status": "ok", "bytes_received": len(image_bytes)}

def mjpeg_frame_generator():
    ds_svc = routes_dataset.dataset_service
    while True:
        if settings.DATASET_ONLY_MODE and ds_svc:
            jpeg_bytes = ds_svc.get_frame_jpeg()
            if jpeg_bytes:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg_bytes + b'\r\n')
            time.sleep(0.08)
        else:
            engine = get_vision_engine()
            if engine:
                counters = get_all_active_counters()
                engine.process_frame(counters)
                jpeg_bytes = engine.get_jpeg_frame()
                if jpeg_bytes:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + jpeg_bytes + b'\r\n')
            time.sleep(0.06)

@router.get("/stream")
def get_video_stream():
    return StreamingResponse(
        mjpeg_frame_generator(), 
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.websocket("/ws")
async def websocket_live_updates(websocket: WebSocket):
    await websocket.accept()
    engine = get_vision_engine()
    
    try:
        while True:
            counters = get_all_active_counters()
            status_data = engine.process_frame(counters)
            await websocket.send_text(json.dumps(status_data))
            await asyncio.sleep(0.12)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print("WebSocket error:", e)
