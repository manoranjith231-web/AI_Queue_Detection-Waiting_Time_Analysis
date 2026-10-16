import io
import csv
from fastapi import APIRouter, Response, HTTPException
from typing import Dict, Any, List
from backend.app.database import get_db_connection
from backend.app.services.demo_generator import DemoDataGenerator

router = APIRouter(prefix="/analytics", tags=["Historical Analytics"])

dataset_service = None

@router.get("/summary")
def get_analytics_summary():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check dataset processing runs
    cursor.execute("""
    SELECT 
        COUNT(*) as total_frames,
        SUM(person_count) as total_detections,
        AVG(person_count) as avg_detections,
        AVG(inference_ms) as avg_latency
    FROM dataset_frame_results
    """)
    ds_row = cursor.fetchone()
    ds_frames = ds_row["total_frames"] if ds_row else 0
    ds_detections = ds_row["total_detections"] if ds_row and ds_row["total_detections"] else 0
    ds_avg_det = round(ds_row["avg_detections"] or 0.0, 2)
    ds_avg_lat = round(ds_row["avg_latency"] or 0.0, 1)

    # Get active counters
    cursor.execute("SELECT id, name, counter_code, category, avg_service_time_sec, congestion_threshold FROM counters WHERE is_active = 1")
    counters = [dict(r) for r in cursor.fetchall()]
    
    # Latest measurement per counter strictly from REAL dataset (is_simulated = 0)
    summary_counters = []
    total_waiting = 0
    total_wait_sec = 0.0
    longest_wait_sec = 0.0
    longest_counter_name = "None"
    congested_count = 0
    
    for c in counters:
        cursor.execute("""
        SELECT people_count, estimated_wait_time_sec, congestion_level, is_simulated
        FROM queue_measurements 
        WHERE counter_id = ? AND is_simulated = 0
        ORDER BY timestamp DESC, id DESC LIMIT 1
        """, (c["id"],))
        last_m = cursor.fetchone()
        
        count = last_m["people_count"] if last_m else 0
        wait_sec = 0.0 # Waiting time estimation unavailable without ground-truth service timestamps
        cong_level = last_m["congestion_level"] if last_m else "Normal"
        
        total_waiting += count
        if cong_level in ["Warning", "Critical"]:
            congested_count += 1
            
        summary_counters.append({
            "id": c["id"],
            "name": c["name"],
            "counter_code": c["counter_code"],
            "category": c["category"],
            "people_count": count,
            "estimated_wait_min": 0.0,
            "congestion_level": cong_level,
            "requires_attention": cong_level in ["Warning", "Critical"],
            "calibration_status": "Waiting-time estimation unavailable — service-time or ground-truth data required."
        })

    active_count = len(counters)
    
    # Store-wide congestion index
    if congested_count >= 2:
        store_congestion = "High"
    elif congested_count == 1:
        store_congestion = "Moderate"
    else:
        store_congestion = "Optimal"
        
    conn.close()
    
    # Get service status if available
    processing_status = "Awaiting dataset processing"
    if dataset_service:
        progress = dataset_service.get_progress()
        if progress["is_running"]:
            processing_status = f"Processing {progress['sequence']} ({progress['progress_percent']}%)"
        elif ds_frames > 0:
            processing_status = f"Completed ({ds_frames} frames processed)"
    elif ds_frames > 0:
        processing_status = f"Processed {ds_frames} frames"

    return {
        "is_dataset_mode": True,
        "processing_status": processing_status,
        "has_processed_data": ds_frames > 0,
        "dataset_frames_processed": ds_frames,
        "dataset_total_detections": ds_detections,
        "dataset_avg_detections_per_frame": ds_avg_det,
        "dataset_avg_latency_ms": ds_avg_lat,
        "unique_customers_disclaimer": "Total detections across frames do not represent unique customers.",
        "waiting_time_disclaimer": "Waiting-time estimation unavailable — service-time or ground-truth data required.",
        "total_waiting": total_waiting if ds_frames > 0 else 0,
        "active_counters": active_count,
        "avg_wait_time_min": "Unavailable",
        "longest_wait_min": "Unavailable",
        "longest_counter_name": "Calibration required" if ds_frames > 0 else "None",
        "congestion_level": store_congestion if ds_frames > 0 else "Optimal",
        "counters_requiring_attention": congested_count if ds_frames > 0 else 0,
        "counters": summary_counters
    }

@router.get("/history")
def get_analytics_history(hours: int = 12):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if we have dataset frame results
    cursor.execute("""
    SELECT frame_index, sequence_name, person_count, tp_count, fp_count, fn_count, inference_ms, timestamp
    FROM dataset_frame_results
    ORDER BY id ASC
    LIMIT 60
    """)
    frame_rows = cursor.fetchall()
    
    if frame_rows:
        # Return real dataset frame-by-frame timeline
        timeline = []
        for r in frame_rows:
            timeline.append({
                "time": f"F{r['frame_index']} ({r['sequence_name']})",
                "counter_1_queue": r["person_count"],
                "counter_2_queue": r["tp_count"],
                "counter_3_queue": r["fp_count"],
                "counter_1_wait_min": 0.0,
                "counter_2_wait_min": 0.0,
                "counter_3_wait_min": 0.0,
                "inference_ms": r["inference_ms"],
                "is_dataset": True
            })
        conn.close()
        return timeline
        
    # Otherwise check real queue_measurements (is_simulated = 0)
    cursor.execute("""
    SELECT 
        strftime('%H:%M', timestamp) as time_label,
        counter_id,
        AVG(people_count) as avg_people,
        AVG(estimated_wait_time_sec) as avg_wait_sec,
        MAX(people_count) as max_people,
        0 as is_simulated
    FROM queue_measurements
    WHERE is_simulated = 0
    GROUP BY strftime('%H:%M', timestamp), counter_id
    ORDER BY timestamp ASC
    """)
    rows = cursor.fetchall()
    
    time_points: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        label = r["time_label"]
        cid = r["counter_id"]
        if label not in time_points:
            time_points[label] = {
                "time": label,
                "is_simulated": False
            }
        time_points[label][f"counter_{cid}_queue"] = round(r["avg_people"], 1)
        time_points[label][f"counter_{cid}_wait_min"] = 0.0

    conn.close()
    return list(time_points.values())

@router.get("/peak-hours")
def get_peak_hours():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check dataset sequence activity
    cursor.execute("""
    SELECT sequence_name, COUNT(*) as frames_count, AVG(person_count) as avg_people, MAX(person_count) as max_people
    FROM dataset_frame_results
    GROUP BY sequence_name
    ORDER BY avg_people DESC
    """)
    rows = cursor.fetchall()
    
    if rows:
        peaks = [
            {
                "hour_slot": f"Seq {r['sequence_name']}",
                "avg_queue": round(r["avg_people"], 1),
                "avg_wait_min": "Unavailable"
            }
            for r in rows
        ]
        conn.close()
        return peaks

    # Fallback to real queue_measurements
    cursor.execute("""
    SELECT 
        strftime('%H:00', timestamp) as hour_slot,
        AVG(people_count) as avg_total_people,
        AVG(estimated_wait_time_sec) as avg_wait_sec
    FROM queue_measurements
    WHERE is_simulated = 0
    GROUP BY strftime('%H:00', timestamp)
    ORDER BY avg_total_people DESC
    LIMIT 6
    """)
    rows = cursor.fetchall()
    peaks = [
        {
            "hour_slot": r["hour_slot"],
            "avg_queue": round(r["avg_total_people"] * 3, 1),
            "avg_wait_min": "Unavailable"
        }
        for r in rows
    ]
    conn.close()
    return peaks

@router.get("/export-csv")
def export_csv_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check dataset_frame_results first
    cursor.execute("""
    SELECT 
        id, run_id, sequence_name, frame_index, frame_name,
        person_count, tp_count, fp_count, fn_count,
        inference_ms, counter_counts, timestamp
    FROM dataset_frame_results
    ORDER BY id ASC
    """)
    ds_rows = cursor.fetchall()
    
    if ds_rows:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID", "Run ID", "Sequence", "Frame Index", "Frame File",
            "Person Detections", "True Positives", "False Positives", "False Negatives",
            "Inference (ms)", "Counter Polygon Counts", "Timestamp", "Data Source"
        ])
        for r in ds_rows:
            writer.writerow([
                r["id"], r["run_id"], r["sequence_name"], r["frame_index"], r["frame_name"],
                r["person_count"], r["tp_count"], r["fp_count"], r["fn_count"],
                r["inference_ms"], r["counter_counts"], r["timestamp"], "COLLECTIVE_ACTIVITY_DATASET"
            ])
        conn.close()
        return Response(
            content=output.getvalue().encode('utf-8'),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=queueiq_dataset_results.csv"}
        )

    # Otherwise export queue_measurements (real only)
    cursor.execute("""
    SELECT 
        qm.id,
        qm.timestamp,
        c.name as counter_name,
        c.counter_code,
        qm.people_count,
        0.0 as wait_time_sec,
        0.0 as wait_time_min,
        qm.congestion_level,
        qm.fps,
        'DATASET_REAL' as data_source
    FROM queue_measurements qm
    JOIN counters c ON qm.counter_id = c.id
    WHERE qm.is_simulated = 0
    ORDER BY qm.timestamp DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Record ID", "Timestamp", "Counter Name", "Counter Code", 
        "People Waiting", "Wait Time (Sec)", "Wait Time (Min)", 
        "Congestion Level", "FPS", "Data Source"
    ])
    for r in rows:
        writer.writerow(list(r))
        
    return Response(
        content=output.getvalue().encode('utf-8'),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=queueiq_historical_analytics.csv"}
    )

@router.post("/seed-demo")
def seed_demo_analytics():
    return {
        "status": "disabled_in_dataset_mode",
        "message": "Synthetic demo generation is disabled. QueueIQ AI is currently operating in Dataset-Only mode using the local 1GB Collective Activity dataset."
    }
