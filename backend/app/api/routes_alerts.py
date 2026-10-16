from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from backend.app.services.alert_manager import AlertManager
from backend.app.services.auth_service import get_current_user

router = APIRouter(prefix="/alerts", tags=["Alerts"])

alert_manager = None

def get_alert_manager():
    global alert_manager
    return alert_manager

@router.get("", response_model=List[Dict[str, Any]])
def list_alerts(limit: int = 30, unacknowledged: bool = False):
    mgr = get_alert_manager()
    return mgr.get_recent_alerts(limit=limit, unacknowledged_only=unacknowledged)

@router.post("/{alert_id}/ack")
def acknowledge_alert(alert_id: int, user = Depends(get_current_user)):
    mgr = get_alert_manager()
    success = mgr.acknowledge_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert_id": alert_id, "action": "acknowledged"}

@router.post("/{alert_id}/resolve")
def resolve_alert(alert_id: int, user = Depends(get_current_user)):
    mgr = get_alert_manager()
    success = mgr.resolve_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert_id": alert_id, "action": "resolved"}
