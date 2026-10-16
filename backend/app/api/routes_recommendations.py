from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from backend.app.services.recommendation_engine import RecommendationEngine
from backend.app.services.auth_service import get_current_user

router = APIRouter(prefix="/recommendations", tags=["Shop Owner Intelligence"])

vision_engine = None

def get_vision_engine():
    global vision_engine
    return vision_engine

from backend.app.database import get_db_connection
import json

@router.get("", response_model=List[Dict[str, Any]])
def list_recommendations():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Check if DB has stored recommendations
    cursor.execute("""
    SELECT id, category, priority, title, recommendation, reasoning, supporting_metrics, status
    FROM recommendations
    WHERE status = 'ACTIVE'
    ORDER BY id DESC
    LIMIT 10
    """)
    db_recs = cursor.fetchall()
    
    # 2. Check dataset frame results
    cursor.execute("""
    SELECT 
        COUNT(*) as total_frames,
        SUM(person_count) as total_detections,
        AVG(person_count) as avg_detections,
        MAX(person_count) as peak_detections
    FROM dataset_frame_results
    """)
    ds_stats = cursor.fetchone()
    ds_frames = ds_stats["total_frames"] if ds_stats else 0
    ds_detections = ds_stats["total_detections"] if ds_stats and ds_stats["total_detections"] else 0
    ds_peak = ds_stats["peak_detections"] if ds_stats and ds_stats["peak_detections"] else 0
    
    # 3. Check latest run
    cursor.execute("SELECT * FROM dataset_runs ORDER BY id DESC LIMIT 1")
    latest_run = cursor.fetchone()
    conn.close()

    recs = []

    if ds_frames > 0:
        # Real dataset-driven recommendation 1: Waiting-time requirement
        recs.append({
            "id": "rec-waiting-time-disclaimer",
            "category": "CALIBRATION",
            "priority": "HIGH",
            "title": "Service-Time Ground Truth Required",
            "recommendation": "Waiting-time estimation unavailable — service-time or ground-truth data required.",
            "reasoning": (
                "The Collective Activity dataset provides spatial bounding boxes and activity labels "
                "(Queueing/Waiting) across real video sequences, but does not include transaction register "
                "service duration timestamps."
            ),
            "supporting_metrics": {
                "dataset_source": "Collective Activity Dataset (1GB)",
                "processed_frames": ds_frames,
                "total_detections": ds_detections
            },
            "status": "ACTIVE"
        })

        # Real dataset-driven recommendation 2: High queue density if detected
        if ds_peak >= 5:
            recs.append({
                "id": "rec-dataset-high-density",
                "category": "STAFFING",
                "priority": "URGENT",
                "title": f"High Queue Volume Detected ({ds_peak} Persons)",
                "recommendation": "Deploy auxiliary checkout capacity or implement queue line management.",
                "reasoning": (
                    f"Real YOLOv8 inference identified a peak density of {ds_peak} persons in sequence "
                    f"{latest_run['sequence_name'] if latest_run else 'dataset'}. Sustained high counts require staffing adjustments."
                ),
                "supporting_metrics": {
                    "peak_persons": ds_peak,
                    "avg_persons_per_frame": round(ds_stats["avg_detections"] or 0, 2),
                    "total_frames_analyzed": ds_frames
                },
                "status": "ACTIVE"
            })

        # Real dataset-driven recommendation 3: Perspective calibration
        recs.append({
            "id": "rec-dataset-calibration",
            "category": "CAMERA_POSITION",
            "priority": "MEDIUM",
            "title": "Dataset Perspective Calibration",
            "recommendation": "Adjust polygon queue regions to match the camera angle of the selected sequence.",
            "reasoning": (
                "The dataset frames were recorded with handheld digital cameras at pedestrian/queue vantage points. "
                "Polygon calibration is required to align checkout counters with the real focal plane."
            ),
            "supporting_metrics": {
                "sequence": latest_run["sequence_name"] if latest_run else "seq01",
                "precision": latest_run["precision"] if latest_run else 0.0,
                "recall": latest_run["recall"] if latest_run else 0.0
            },
            "status": "ACTIVE"
        })

    # Include any custom DB recommendations
    for r in db_recs:
        rec_id = f"db-rec-{r['id']}"
        if not any(existing["id"] == rec_id for existing in recs):
            metrics = {}
            if r["supporting_metrics"]:
                try:
                    metrics = json.loads(r["supporting_metrics"])
                except:
                    metrics = {}
            recs.append({
                "id": rec_id,
                "category": r["category"],
                "priority": r["priority"],
                "title": r["title"],
                "recommendation": r["recommendation"],
                "reasoning": r["reasoning"],
                "supporting_metrics": metrics,
                "status": r["status"]
            })

    if not recs:
        # Clean empty state when awaiting dataset processing
        return [
            {
                "id": "rec-awaiting-dataset",
                "category": "CONFIGURATION",
                "priority": "MEDIUM",
                "title": "Awaiting Dataset Processing",
                "recommendation": "Navigate to Dataset Testing to process frames from the 1GB Collective Activity dataset.",
                "reasoning": "QueueIQ AI is operating in Dataset-Only mode. Recommendations are generated exclusively from real vision inference on dataset frames rather than synthetic demo values.",
                "supporting_metrics": {
                    "dataset_mode": True,
                    "dataset_status": "Ready in Collective Activity/data/ActivityDataset.zip"
                },
                "status": "ACTIVE"
            }
        ]

    return recs

@router.post("/{rec_id}/dismiss")
def dismiss_recommendation(rec_id: str, user = Depends(get_current_user)):
    return {"status": "success", "rec_id": rec_id, "state": "DISMISSED"}
