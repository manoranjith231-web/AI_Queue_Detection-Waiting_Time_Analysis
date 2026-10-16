from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from backend.app.services.recommendation_engine import RecommendationEngine
from backend.app.services.auth_service import get_current_user

router = APIRouter(prefix="/recommendations", tags=["Shop Owner Intelligence"])

vision_engine = None

def get_vision_engine():
    global vision_engine
    return vision_engine

@router.get("", response_model=List[Dict[str, Any]])
def list_recommendations():
    engine = get_vision_engine()
    if not engine or not engine.latest_counters_data:
        # Fallback to defaults
        return [
            {
                "id": "rec-init",
                "category": "STAFFING",
                "priority": "MEDIUM",
                "title": "Counter Balancing Check",
                "recommendation": "Maintain Counter 1 for Express basket customers to maximize store throughput.",
                "reasoning": "Standard operating guidelines for retail supermarket checkout speed.",
                "supporting_metrics": {"optimal_throughput": "45 customers/hour"},
                "status": "ACTIVE"
            }
        ]
        
    overall_stats = {
        "avg_wait_time_min": round(
            sum(c["estimated_wait_time_min"] for c in engine.latest_counters_data) / max(len(engine.latest_counters_data), 1),
            1
        )
    }
    
    recs = RecommendationEngine.generate_recommendations(engine.latest_counters_data, overall_stats)
    return recs

@router.post("/{rec_id}/dismiss")
def dismiss_recommendation(rec_id: str, user = Depends(get_current_user)):
    return {"status": "success", "rec_id": rec_id, "state": "DISMISSED"}
