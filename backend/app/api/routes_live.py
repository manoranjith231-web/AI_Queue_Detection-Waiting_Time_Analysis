import asyncio
import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Dict, Any, List
from backend.app.database import get_db_connection

router = APIRouter(prefix="/live", tags=["Live Monitoring"])

# Injected vision_engine instance will be bound in main.py
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

@router.get("/status")
def get_live_status():
    engine = get_vision_engine()
    if not engine:
        raise HTTPException(status_code=503, detail="Vision engine not initialized")
    
    counters = get_all_active_counters()
    result = engine.process_frame(counters)
    return result

@router.post("/start")
def start_live_camera(payload: Dict[str, Any] = None):
    engine = get_vision_engine()
    source_type = (payload or {}).get("source_type", "webcam")
    file_path = (payload or {}).get("file_path", "")
    
    success = engine.start_camera(source_type=source_type, file_path=file_path)
    return {
        "status": "success" if success else "fallback_demo",
        "camera_status": engine.camera_status,
        "is_demo_mode": engine.is_demo_mode,
        "current_source": engine.current_source
    }

@router.post("/stop")
def stop_live_camera():
    engine = get_vision_engine()
    engine.stop_camera()
    return {
        "status": "success",
        "camera_status": engine.camera_status
    }

@router.post("/switch-source")
def switch_source(payload: Dict[str, Any]):
    engine = get_vision_engine()
    source_type = payload.get("source_type", "demo")
    file_path = payload.get("file_path", "")
    
    engine.stop_camera()
    success = engine.start_camera(source_type=source_type, file_path=file_path)
    return {
        "status": "success" if success else "error",
        "camera_status": engine.camera_status,
        "is_demo_mode": engine.is_demo_mode,
        "current_source": engine.current_source
    }

def mjpeg_frame_generator():
    engine = get_vision_engine()
    while True:
        counters = get_all_active_counters()
        engine.process_frame(counters)
        jpeg_bytes = engine.get_jpeg_frame()
        if jpeg_bytes:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg_bytes + b'\r\n')
        time.sleep(0.06) # ~16 FPS

@router.get("/stream")
def get_video_stream():
    engine = get_vision_engine()
    if not engine.is_running:
        engine.start_camera(source_type="demo")
        
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
            await asyncio.sleep(0.12) # ~8Hz updates for UI telemetry
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print("WebSocket error:", e)
