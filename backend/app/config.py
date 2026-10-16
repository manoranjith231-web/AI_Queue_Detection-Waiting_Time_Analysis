import os
from pydantic import BaseModel
from typing import List

class Settings(BaseModel):
    # App Information
    PROJECT_NAME: str = "QueueIQ AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    STORE_NAME: str = "HyperMarket Mart (Branch 104)"
    
    # Environment & Security
    ENV: str = os.getenv("ENV", "development")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "queueiq-insecure-dev-secret-key-change-in-production")
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    
    # Vision & Model Parameters
    YOLO_MODEL_NAME: str = os.getenv("YOLO_MODEL_NAME", "yolov8n.pt")
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.35"))
    CAMERA_INDEX: int = int(os.getenv("CAMERA_INDEX", "0"))
    VIDEO_SOURCE: str = os.getenv("VIDEO_SOURCE", "webcam") # webcam | file | demo
    VIDEO_FILE_PATH: str = os.getenv("VIDEO_FILE_PATH", "")
    TARGET_FPS: int = 15
    FRAME_WIDTH: int = 640
    FRAME_HEIGHT: int = 480
    
    # Queue & Service Time Defaults
    DEFAULT_SERVICE_TIME_SEC: float = 120.0  # 2.0 mins per customer average
    CONGESTION_THRESHOLD_PEOPLE: int = 4     # >= 4 people = warning/congested
    CRITICAL_THRESHOLD_PEOPLE: int = 6       # >= 6 people = critical
    
    # Alert System
    ALERT_COOLDOWN_SECONDS: int = 45         # Suppress duplicate alerts within 45s
    
    # Database
    DATABASE_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
        "data", 
        "queueiq.db"
    )

settings = Settings()
