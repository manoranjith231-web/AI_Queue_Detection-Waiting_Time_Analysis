from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import json
from backend.app.database import get_db_connection, seed_default_counters
from backend.app.services.auth_service import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/counters", tags=["Counters & Polygons"])

class CounterUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    avg_service_time_sec: Optional[float] = None
    congestion_threshold: Optional[int] = None
    polygon_coords: Optional[List[List[float]]] = None
    color: Optional[str] = None

@router.get("", response_model=List[Dict[str, Any]])
def get_all_counters():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM counters ORDER BY id ASC")
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

@router.put("/{counter_id}")
def update_counter(counter_id: int, payload: Dict[str, Any], user = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM counters WHERE id = ?", (counter_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Counter not found")
    
    updates = []
    values = []
    
    if "name" in payload:
        updates.append("name = ?")
        values.append(payload["name"])
    if "category" in payload:
        updates.append("category = ?")
        values.append(payload["category"])
    if "is_active" in payload:
        updates.append("is_active = ?")
        values.append(1 if payload["is_active"] else 0)
    if "avg_service_time_sec" in payload:
        updates.append("avg_service_time_sec = ?")
        values.append(float(payload["avg_service_time_sec"]))
    if "congestion_threshold" in payload:
        updates.append("congestion_threshold = ?")
        values.append(int(payload["congestion_threshold"]))
    if "polygon_coords" in payload:
        updates.append("polygon_coords = ?")
        coords = payload["polygon_coords"]
        values.append(json.dumps(coords) if isinstance(coords, list) else coords)
    if "color" in payload:
        updates.append("color = ?")
        values.append(payload["color"])
        
    if updates:
        values.append(counter_id)
        query = f"UPDATE counters SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        cursor.execute(query, values)
        conn.commit()
        
    conn.close()
    return {"status": "success", "counter_id": counter_id, "updated_fields": list(payload.keys())}

@router.post("/reset-defaults")
def reset_counters_to_defaults(user = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM counters")
    conn.commit()
    seed_default_counters(conn)
    conn.close()
    return {"status": "success", "message": "Counters and queue polygons reset to factory defaults"}
