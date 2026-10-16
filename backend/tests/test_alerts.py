import pytest
import time
from backend.app.services.alert_manager import AlertManager

def test_alert_cooldown():
    mgr = AlertManager(cooldown_seconds=2)
    
    # First alert should fire
    fire1 = mgr.should_fire(counter_id=1, alert_type="CONGESTION")
    assert fire1 is True
    
    # Immediate second alert for same counter and type should be suppressed
    fire2 = mgr.should_fire(counter_id=1, alert_type="CONGESTION")
    assert fire2 is False
    
    # Different alert type or counter should fire
    fire_c2 = mgr.should_fire(counter_id=2, alert_type="CONGESTION")
    assert fire_c2 is True
