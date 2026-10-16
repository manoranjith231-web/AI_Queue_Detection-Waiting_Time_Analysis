import time
import json
import sqlite3
from typing import List, Dict, Any, Optional
from backend.app.config import settings
from backend.app.database import get_db_connection

class AlertManager:
    def __init__(self, cooldown_seconds: int = 45):
        self.cooldown_seconds = cooldown_seconds
        # Key: (counter_id, alert_type) -> last_fired_timestamp
        self.last_fired: Dict[str, float] = {}

    def should_fire(self, counter_id: Optional[int], alert_type: str) -> bool:
        key = f"{counter_id}_{alert_type}"
        now = time.time()
        last_time = self.last_fired.get(key, 0)
        if now - last_time >= self.cooldown_seconds:
            self.last_fired[key] = now
            return True
        return False

    def create_alert_if_eligible(
        self,
        counter_id: Optional[int],
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        metrics_snapshot: Optional[Dict[str, Any]] = None
    ) -> Optional[int]:
        if not self.should_fire(counter_id, alert_type):
            return None
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO alerts (counter_id, alert_type, severity, title, message, metrics_snapshot)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            counter_id,
            alert_type,
            severity,
            title,
            message,
            json.dumps(metrics_snapshot) if metrics_snapshot else None
        ))
        alert_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return alert_id

    def get_recent_alerts(self, limit: int = 20, unacknowledged_only: bool = False) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "SELECT * FROM alerts "
        if unacknowledged_only:
            query += "WHERE acknowledged = 0 "
        query += "ORDER BY timestamp DESC LIMIT ?"
        
        cursor.execute(query, (limit,))
        rows = cursor.fetchall()
        alerts = []
        for r in rows:
            alert = dict(r)
            if alert["metrics_snapshot"]:
                try:
                    alert["metrics_snapshot"] = json.loads(alert["metrics_snapshot"])
                except Exception:
                    pass
            alerts.append(alert)
        conn.close()
        return alerts

    def acknowledge_alert(self, alert_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        UPDATE alerts 
        SET acknowledged = 1, acknowledged_at = CURRENT_TIMESTAMP 
        WHERE id = ?
        """, (alert_id,))
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

    def resolve_alert(self, alert_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        UPDATE alerts 
        SET resolved = 1, resolved_at = CURRENT_TIMESTAMP 
        WHERE id = ?
        """, (alert_id,))
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success
