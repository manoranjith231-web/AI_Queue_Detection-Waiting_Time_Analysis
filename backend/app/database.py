import sqlite3
import json
import os
from typing import List, Dict, Any, Optional
from backend.app.config import settings

def get_db_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(settings.DATABASE_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Billing Counters & Configured Queue Polygons
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS counters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        counter_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Standard',
        is_active BOOLEAN NOT NULL DEFAULT 1,
        avg_service_time_sec REAL NOT NULL DEFAULT 120.0,
        congestion_threshold INTEGER NOT NULL DEFAULT 4,
        polygon_coords TEXT NOT NULL, -- JSON array of [x, y] normalized coordinates [0..1]
        color TEXT NOT NULL DEFAULT '#06B6D4',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # 2. Historical Aggregate Measurements
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS queue_measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        counter_id INTEGER NOT NULL,
        people_count INTEGER NOT NULL,
        estimated_wait_time_sec REAL NOT NULL,
        congestion_level TEXT NOT NULL, -- 'Normal', 'Warning', 'Critical'
        fps REAL DEFAULT 0.0,
        is_simulated BOOLEAN NOT NULL DEFAULT 0,
        FOREIGN KEY (counter_id) REFERENCES counters(id) ON DELETE CASCADE
    );
    """)
    
    # 3. Alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        counter_id INTEGER,
        alert_type TEXT NOT NULL, -- 'CONGESTION', 'LONG_QUEUE', 'CAMERA_DISCONNECT', 'AI_LATENCY'
        severity TEXT NOT NULL,   -- 'INFO', 'WARNING', 'CRITICAL'
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        metrics_snapshot TEXT,    -- JSON snapshot of relevant counts/wait times
        acknowledged BOOLEAN NOT NULL DEFAULT 0,
        acknowledged_at DATETIME,
        resolved BOOLEAN NOT NULL DEFAULT 0,
        resolved_at DATETIME,
        FOREIGN KEY (counter_id) REFERENCES counters(id) ON DELETE SET NULL
    );
    """)
    
    # 4. Shop-Owner Recommendations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        category TEXT NOT NULL,   -- 'STAFFING', 'QUEUE_ROUTING', 'CAMERA_POSITION', 'CALIBRATION'
        priority TEXT NOT NULL,   -- 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
        title TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        supporting_metrics TEXT,  -- JSON data
        status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'APPLIED', 'DISMISSED'
        target_counter_id INTEGER,
        FOREIGN KEY (target_counter_id) REFERENCES counters(id) ON DELETE SET NULL
    );
    """)
    
    # 5. App Configuration Key-Values
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 6. Real Dataset Processing Runs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dataset_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT UNIQUE NOT NULL,
        sequence_name TEXT NOT NULL,
        sampling_rate INTEGER NOT NULL DEFAULT 1,
        total_frames INTEGER NOT NULL DEFAULT 0,
        processed_frames INTEGER NOT NULL DEFAULT 0,
        total_detections INTEGER NOT NULL DEFAULT 0,
        avg_detections_per_frame REAL DEFAULT 0.0,
        avg_confidence REAL DEFAULT 0.0,
        avg_inference_ms REAL DEFAULT 0.0,
        precision REAL DEFAULT 0.0,
        recall REAL DEFAULT 0.0,
        f1_score REAL DEFAULT 0.0,
        true_positives INTEGER DEFAULT 0,
        false_positives INTEGER DEFAULT 0,
        false_negatives INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'IDLE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 7. Real Dataset Frame Results
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dataset_frame_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        sequence_name TEXT NOT NULL,
        frame_index INTEGER NOT NULL,
        frame_name TEXT NOT NULL,
        person_count INTEGER NOT NULL,
        confidences TEXT,
        bboxes TEXT,
        ground_truth_count INTEGER DEFAULT 0,
        ground_truth_boxes TEXT,
        tp_count INTEGER DEFAULT 0,
        fp_count INTEGER DEFAULT 0,
        fn_count INTEGER DEFAULT 0,
        inference_ms REAL DEFAULT 0.0,
        counter_counts TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES dataset_runs(run_id) ON DELETE CASCADE
    );
    """)
    
    conn.commit()
    seed_default_counters(conn)
    if settings.DATASET_ONLY_MODE:
        # Enforce Dataset-Only Mode: remove synthetic simulated measurements
        cursor.execute("DELETE FROM queue_measurements WHERE is_simulated = 1")
        conn.commit()
    else:
        seed_initial_analytics_if_empty(conn)
    conn.close()

def seed_default_counters(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM counters")
    if cursor.fetchone()["cnt"] == 0:
        # Default 3 realistic polygon zones for supermarket billing counters
        # Normalized coordinates (0.0 to 1.0) relative to video frame width & height
        default_counters = [
            (
                "C1",
                "Counter 1 (Express Checkout)",
                "Express",
                1,
                90.0, # 1.5 mins service time
                3,    # Congestion at 3 people
                json.dumps([
                    [0.05, 0.25],
                    [0.32, 0.25],
                    [0.32, 0.90],
                    [0.05, 0.90]
                ]),
                "#06B6D4" # Cyan
            ),
            (
                "C2",
                "Counter 2 (Regular Baskets)",
                "Standard",
                1,
                135.0, # 2.25 mins service time
                4,     # Congestion at 4 people
                json.dumps([
                    [0.36, 0.25],
                    [0.64, 0.25],
                    [0.64, 0.90],
                    [0.36, 0.90]
                ]),
                "#8B5CF6" # Violet
            ),
            (
                "C3",
                "Counter 3 (Trolley & Bulk)",
                "Bulk",
                1,
                180.0, # 3.0 mins service time
                5,     # Congestion at 5 people
                json.dumps([
                    [0.68, 0.25],
                    [0.95, 0.25],
                    [0.95, 0.90],
                    [0.68, 0.90]
                ]),
                "#10B981" # Emerald
            )
        ]
        cursor.executemany("""
        INSERT INTO counters (counter_code, name, category, is_active, avg_service_time_sec, congestion_threshold, polygon_coords, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, default_counters)
        conn.commit()

def seed_initial_analytics_if_empty(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM queue_measurements")
    if cursor.fetchone()["cnt"] == 0:
        # Insert a sample baseline history for demo & chart visualization
        import datetime
        now = datetime.datetime.now()
        samples = []
        for hour_offset in range(12, 0, -1):
            t = now - datetime.timedelta(hours=hour_offset)
            # Simulated daytime supermarket curve (peak around noon and 6pm)
            hour = t.hour
            peak_factor = 1.6 if (12 <= hour <= 14 or 17 <= hour <= 20) else 0.8
            
            c1_count = int(2 * peak_factor)
            c2_count = int(3 * peak_factor)
            c3_count = int(2 * peak_factor)
            
            samples.append((t.strftime("%Y-%m-%d %H:%M:%S"), 1, c1_count, c1_count * 90.0, "Warning" if c1_count >= 3 else "Normal", 15.0, 1))
            samples.append((t.strftime("%Y-%m-%d %H:%M:%S"), 2, c2_count, c2_count * 135.0, "Critical" if c2_count >= 5 else ("Warning" if c2_count >= 4 else "Normal"), 15.0, 1))
            samples.append((t.strftime("%Y-%m-%d %H:%M:%S"), 3, c3_count, c3_count * 180.0, "Warning" if c3_count >= 4 else "Normal", 15.0, 1))
        
        cursor.executemany("""
        INSERT INTO queue_measurements (timestamp, counter_id, people_count, estimated_wait_time_sec, congestion_level, fps, is_simulated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, samples)
        conn.commit()

def reset_db_demo_data() -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM queue_measurements WHERE is_simulated = 1")
    cursor.execute("DELETE FROM alerts")
    cursor.execute("DELETE FROM recommendations")
    conn.commit()
    seed_initial_analytics_if_empty(conn)
    conn.close()
