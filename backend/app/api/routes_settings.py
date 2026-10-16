from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from backend.app.config import settings
from backend.app.services.auth_service import get_current_user

router = APIRouter(prefix="/settings", tags=["System Settings"])

current_app_settings = {
    "store_name": settings.STORE_NAME,
    "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
    "camera_index": settings.CAMERA_INDEX,
    "video_source": settings.VIDEO_SOURCE,
    "default_service_time_sec": settings.DEFAULT_SERVICE_TIME_SEC,
    "congestion_threshold_people": settings.CONGESTION_THRESHOLD_PEOPLE,
    "alert_cooldown_seconds": settings.ALERT_COOLDOWN_SECONDS,
    "yolo_model": settings.YOLO_MODEL_NAME
}

@router.get("")
def get_settings():
    return current_app_settings

@router.put("")
def update_settings(payload: Dict[str, Any], user = Depends(get_current_user)):
    for k, v in payload.items():
        if k in current_app_settings:
            current_app_settings[k] = v
    return {"status": "success", "settings": current_app_settings}
