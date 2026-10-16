from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List, Optional
from backend.app.services.webcam_service import WebcamService

router = APIRouter(prefix="/webcam", tags=["Live Webcam"])

webcam_service: Optional[WebcamService] = None

def get_webcam_service() -> WebcamService:
    global webcam_service
    if webcam_service is None:
        webcam_service = WebcamService()
    return webcam_service

DEFAULT_ZONES = [
    {
        "id": "zone-1",
        "name": "Checkout 1 (Express)",
        "target": 2,
        "color": "#06B6D4", # Cyan
        "polygon": [
            [0.05, 0.25],
            [0.35, 0.25],
            [0.35, 0.99],
            [0.05, 0.99],
        ]
    },
    {
        "id": "zone-2",
        "name": "Checkout 2 (Main)",
        "target": 3,
        "color": "#3B82F6", # Blue
        "polygon": [
            [0.38, 0.25],
            [0.68, 0.25],
            [0.68, 0.99],
            [0.38, 0.99],
        ]
    },
    {
        "id": "zone-3",
        "name": "Checkout 3 (Self-Scan)",
        "target": 4,
        "color": "#A855F7", # Purple
        "polygon": [
            [0.70, 0.25],
            [0.95, 0.25],
            [0.95, 0.99],
            [0.70, 0.99],
        ]
    }
]

@router.get("/status")
def get_webcam_status():
    """Returns backend YOLO model readiness and diagnostic telemetry."""
    svc = get_webcam_service()
    return svc.get_status()

@router.get("/default-zones")
def get_default_zones():
    """Returns default supermarket checkout register zones."""
    return DEFAULT_ZONES

@router.post("/reset")
def reset_webcam_state():
    """Resets the tracking state and clears stale detections on camera stop/restart."""
    svc = get_webcam_service()
    svc.reset_tracker()
    return {"status": "success", "message": "Tracker and stale state reset successfully"}

@router.post("/switch-model")
def switch_webcam_model(payload: Dict[str, Any] = Body(default={})):
    """Switches active model between 'auto', 'custom', and 'pretrained'."""
    svc = get_webcam_service()
    model_type = payload.get("model_type", "pretrained")
    return svc.switch_model(model_type=model_type)

@router.post("/detect")
def detect_webcam_frame(payload: Dict[str, Any] = Body(...)):
    """Receives a browser webcam frame (base64) and executes real YOLO person detection & queue zone assignment."""
    svc = get_webcam_service()
    image_base64 = payload.get("image_base64")
    if not image_base64:
        raise HTTPException(status_code=400, detail="Missing 'image_base64' in request payload")
    
    conf_threshold = float(payload.get("conf_threshold", 0.35))
    zones = payload.get("zones", DEFAULT_ZONES)
    model_type = payload.get("model_type")
    avg_service_time_sec = int(payload.get("avg_service_time_sec", 90))
    active_counters = int(payload.get("active_counters", 3))
    
    result = svc.process_frame(
        image_base64=image_base64,
        conf_threshold=conf_threshold,
        zones=zones,
        model_type=model_type,
        avg_service_time_sec=avg_service_time_sec,
        active_counters=active_counters
    )
    
    if "error" in result and not result.get("detections"):
        raise HTTPException(status_code=422, detail=result["error"])
        
    return result
