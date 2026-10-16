import io
import csv
from fastapi import APIRouter, Response, HTTPException
from typing import Dict, Any, List
from backend.app.database import get_db_connection
from backend.app.services.demo_generator import DemoDataGenerator

router = APIRouter(prefix="/analytics", tags=["Historical Analytics"])

@router.get("/summary")
def get_analytics_summary():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get active counters
    cursor.execute("SELECT id, name, counter_code, category, avg_service_time_sec, congestion_threshold FROM counters WHERE is_active = 1")
    counters = [dict(r) for r in cursor.fetchall()]
    
    # Latest measurement per counter
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
        WHERE counter_id = ? 
        ORDER BY timestamp DESC LIMIT 1
        """, (c["id"],))
        last_m = cursor.fetchone()
        
        count = last_m["people_count"] if last_m else 0
        wait_sec = last_m["estimated_wait_time_sec"] if last_m else 0.0
        cong_level = last_m["congestion_level"] if last_m else "Normal"
        
        total_waiting += count
        total_wait_sec += wait_sec
        if wait_sec > longest_wait_sec:
            longest_wait_sec = wait_sec
            longest_counter_name = c["name"]
            
        if cong_level in ["Warning", "Critical"]:
            congested_count += 1
            
        summary_counters.append({
            "id": c["id"],
            "name": c["name"],
            "counter_code": c["counter_code"],
            "category": c["category"],
            "people_count": count,
            "estimated_wait_min": round(wait_sec / 60.0, 1),
            "congestion_level": cong_level,
            "requires_attention": cong_level in ["Warning", "Critical"]
        })

    active_count = len(counters)
    avg_wait_min = round((total_wait_sec / max(active_count, 1)) / 60.0, 1)
    
    # Store-wide congestion index
    if congested_count >= 2:
        store_congestion = "High"
    elif congested_count == 1:
        store_congestion = "Moderate"
    else:
        store_congestion = "Optimal"
        
    conn.close()
    
    return {
        "total_waiting": total_waiting,
        "active_counters": active_count,
        "avg_wait_time_min": avg_wait_min,
        "longest_wait_min": round(longest_wait_sec / 60.0, 1),
        "longest_counter_name": longest_counter_name,
        "congestion_level": store_congestion,
        "counters_requiring_attention": congested_count,
        "counters": summary_counters
    }

@router.get("/history")
def get_analytics_history(hours: int = 12):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Aggregate by hour and counter
    cursor.execute("""
    SELECT 
        strftime('%H:00', timestamp) as time_label,
        counter_id,
        AVG(people_count) as avg_people,
        AVG(estimated_wait_time_sec) as avg_wait_sec,
        MAX(people_count) as max_people,
        MAX(is_simulated) as is_simulated
    FROM queue_measurements
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
    GROUP BY strftime('%H:00', timestamp), counter_id
    ORDER BY timestamp ASC
    """, (hours,))
    
    rows = cursor.fetchall()
    
    # Format for Recharts
    time_points: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        label = r["time_label"]
        cid = r["counter_id"]
        if label not in time_points:
            time_points[label] = {
                "time": label,
                "is_simulated": bool(r["is_simulated"])
            }
        time_points[label][f"counter_{cid}_queue"] = round(r["avg_people"], 1)
        time_points[label][f"counter_{cid}_wait_min"] = round(r["avg_wait_sec"] / 60.0, 1)

    conn.close()
    return list(time_points.values())

@router.get("/peak-hours")
def get_peak_hours():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        strftime('%H:00', timestamp) as hour_slot,
        AVG(people_count) as avg_total_people,
        AVG(estimated_wait_time_sec) as avg_wait_sec
    FROM queue_measurements
    GROUP BY strftime('%H:00', timestamp)
    ORDER BY avg_total_people DESC
    LIMIT 6
    """)
    rows = cursor.fetchall()
    peaks = [
        {
            "hour_slot": r["hour_slot"],
            "avg_queue": round(r["avg_total_people"] * 3, 1), # store total
            "avg_wait_min": round(r["avg_wait_sec"] / 60.0, 1)
        }
        for r in rows
    ]
    conn.close()
    return peaks

@router.get("/export-csv")
def export_csv_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        qm.id,
        qm.timestamp,
        c.name as counter_name,
        c.counter_code,
        qm.people_count,
        ROUND(qm.estimated_wait_time_sec, 1) as wait_time_sec,
        ROUND(qm.estimated_wait_time_sec / 60.0, 2) as wait_time_min,
        qm.congestion_level,
        qm.fps,
        CASE WHEN qm.is_simulated = 1 THEN 'SIMULATED' ELSE 'REAL_CAMERA' END as data_source
    FROM queue_measurements qm
    JOIN counters c ON qm.counter_id = c.id
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
        
    csv_bytes = output.getvalue().encode('utf-8')
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=queueiq_historical_analytics.csv"}
    )

@router.post("/seed-demo")
def seed_demo_analytics():
    count = DemoDataGenerator.populate_historical_dataset(days=3)
    return {"status": "success", "records_created": count, "message": "Demo analytics populated successfully"}
