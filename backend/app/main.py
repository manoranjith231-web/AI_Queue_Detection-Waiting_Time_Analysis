import asyncio
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import init_db, get_db_connection
from backend.app.services.alert_manager import AlertManager
from backend.app.services.queue_analytics import QueueAnalyticsEngine
from backend.app.services.vision_engine import VisionEngine
from backend.app.services.dataset_service import DatasetService
from backend.app.api import routes_counters, routes_live, routes_analytics, routes_alerts, routes_recommendations, routes_settings, routes_auth, routes_dataset, routes_webcam

# Background periodic SQLite persistence task (Only active when NOT in dataset-only mode)
async def periodic_metrics_saver(engine: VisionEngine):
    if settings.DATASET_ONLY_MODE:
        return
    while True:
        try:
            await asyncio.sleep(8.0) # Every 8s save latest aggregate queue readings
            if engine and engine.latest_counters_data:
                conn = get_db_connection()
                cursor = conn.cursor()
                records = []
                for c in engine.latest_counters_data:
                    records.append((
                        c["id"],
                        c["people_count"],
                        c["estimated_wait_time_sec"],
                        c["congestion_level"],
                        engine.current_fps,
                        1 if engine.is_demo_mode else 0
                    ))
                cursor.executemany("""
                INSERT INTO queue_measurements (counter_id, people_count, estimated_wait_time_sec, congestion_level, fps, is_simulated)
                VALUES (?, ?, ?, ?, ?, ?)
                """, records)
                conn.commit()
                conn.close()
        except asyncio.CancelledError:
            break
        except Exception:
            pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing QueueIQ AI SQLite database...")
    init_db()
    
    alert_mgr = AlertManager(cooldown_seconds=settings.ALERT_COOLDOWN_SECONDS)
    analytics_eng = QueueAnalyticsEngine()
    vision_eng = VisionEngine(alert_manager=alert_mgr, analytics_engine=analytics_eng)
    dataset_svc = DatasetService(alert_manager=alert_mgr)
    
    # Bind dependencies to route modules
    routes_live.vision_engine = vision_eng
    routes_alerts.alert_manager = alert_mgr
    routes_recommendations.vision_engine = vision_eng
    routes_dataset.dataset_service = dataset_svc
    routes_analytics.dataset_service = dataset_svc
    
    if settings.DATASET_ONLY_MODE:
        vision_eng.camera_status = "Dataset-Only Mode Active"
        vision_eng.is_demo_mode = False
        print("QueueIQ AI: Operating in DATASET-ONLY Mode (1GB Collective Activity Dataset).")
    else:
        vision_eng.start_camera(source_type="demo")
    
    bg_task = asyncio.create_task(periodic_metrics_saver(vision_eng))
    print("QueueIQ AI Backend initialized successfully.")
    
    yield
    
    bg_task.cancel()
    vision_eng.stop_camera()
    print("QueueIQ AI Backend shutdown safely.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Intelligent Supermarket Queue Monitoring & Waiting-Time Analytics System",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Open for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api
app.include_router(routes_counters.router, prefix=settings.API_V1_STR)
app.include_router(routes_live.router, prefix=settings.API_V1_STR)
app.include_router(routes_analytics.router, prefix=settings.API_V1_STR)
app.include_router(routes_alerts.router, prefix=settings.API_V1_STR)
app.include_router(routes_recommendations.router, prefix=settings.API_V1_STR)
app.include_router(routes_settings.router, prefix=settings.API_V1_STR)
app.include_router(routes_auth.router, prefix=settings.API_V1_STR)
app.include_router(routes_dataset.router, prefix=settings.API_V1_STR)
app.include_router(routes_webcam.router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "free_tier_compliant": True,
        "gpu_required": False,
        "local_first": True
    }
