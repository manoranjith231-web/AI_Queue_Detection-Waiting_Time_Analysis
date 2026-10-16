from typing import List, Dict, Any, Optional
import datetime

class RecommendationEngine:
    @staticmethod
    def generate_recommendations(
        counters_data: List[Dict[str, Any]], 
        overall_stats: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Generates rules-based shop owner recommendations based on current live metrics.
        Every recommendation includes clear reasoning and supporting metrics.
        """
        recommendations = []
        active_counters = [c for c in counters_data if c.get("is_active", True)]
        
        if not active_counters:
            return [{
                "id": "rec-no-counters",
                "category": "CONFIGURATION",
                "priority": "HIGH",
                "title": "No Active Billing Counters",
                "recommendation": "Activate at least one billing counter in settings.",
                "reasoning": "All counters are currently toggled off in the system.",
                "supporting_metrics": {"active_counters": 0},
                "status": "ACTIVE"
            }]
            
        total_waiting = sum(c["people_count"] for c in active_counters)
        
        # Rule 1: High sustained congestion on specific counter -> Open assistance or overflow
        overloaded = [c for c in active_counters if c["congestion_level"] in ["Critical", "Warning"]]
        optimal = [c for c in active_counters if c["congestion_level"] == "Normal"]
        
        for c in overloaded:
            if c["congestion_level"] == "Critical":
                recommendations.append({
                    "id": f"rec-overload-{c['id']}",
                    "category": "STAFFING",
                    "priority": "URGENT",
                    "title": f"Overload at {c['name']}",
                    "recommendation": f"Deploy a secondary bagger or open an auxiliary counter immediately.",
                    "reasoning": (
                        f"Current queue of {c['people_count']} people exceeds the threshold of "
                        f"{c['congestion_threshold']} by {c['people_count'] - c['congestion_threshold']}. "
                        f"Estimated wait time has escalated to {c['estimated_wait_time_min']} mins."
                    ),
                    "supporting_metrics": {
                        "counter_id": c["id"],
                        "current_queue": c["people_count"],
                        "threshold": c["congestion_threshold"],
                        "wait_time_min": c["estimated_wait_time_min"]
                    },
                    "status": "ACTIVE"
                })
        
        # Rule 2: Load Imbalance (Queue Re-routing recommendation)
        if len(active_counters) >= 2:
            longest = max(active_counters, key=lambda x: x["estimated_wait_time_sec"])
            shortest = min(active_counters, key=lambda x: x["estimated_wait_time_sec"])
            
            diff_time = longest["estimated_wait_time_sec"] - shortest["estimated_wait_time_sec"]
            if diff_time >= 180.0 and longest["people_count"] >= 3: # 3+ mins difference
                recommendations.append({
                    "id": f"rec-reroute-{longest['id']}-to-{shortest['id']}",
                    "category": "QUEUE_ROUTING",
                    "priority": "HIGH",
                    "title": "Severe Queue Imbalance Detected",
                    "recommendation": f"Direct incoming shoppers from {longest['name']} to {shortest['name']}.",
                    "reasoning": (
                        f"{longest['name']} has an estimated wait of {longest['estimated_wait_time_min']} mins "
                        f"while {shortest['name']} has only {shortest['estimated_wait_time_min']} mins "
                        f"({round(diff_time/60, 1)} mins faster)."
                    ),
                    "supporting_metrics": {
                        "busy_counter": longest["name"],
                        "busy_wait_min": longest["estimated_wait_time_min"],
                        "fast_counter": shortest["name"],
                        "fast_wait_min": shortest["estimated_wait_time_min"],
                        "time_difference_sec": diff_time
                    },
                    "status": "ACTIVE"
                })
                
        # Rule 3: All active counters congested -> Open closed counter
        all_congested = len(overloaded) == len(active_counters) and len(active_counters) > 0
        if all_congested and total_waiting >= 8:
            recommendations.append({
                "id": "rec-systemic-congestion",
                "category": "STAFFING",
                "priority": "URGENT",
                "title": "Store-Wide Peak Checkout Congestion",
                "recommendation": "Open an additional billing register or assign floor supervisors to billing.",
                "reasoning": (
                    f"All {len(active_counters)} active counters are currently congested with {total_waiting} "
                    f"total shoppers in line."
                ),
                "supporting_metrics": {
                    "active_counters": len(active_counters),
                    "total_waiting": total_waiting,
                    "avg_wait_min": overall_stats.get("avg_wait_time_min", 0)
                },
                "status": "ACTIVE"
            })
            
        # Rule 4: Throughput calibration status
        uncalibrated = [c for c in active_counters if not c.get("is_calibrated", False)]
        if uncalibrated:
            names = ", ".join(c["name"] for c in uncalibrated[:2])
            recommendations.append({
                "id": "rec-calibration",
                "category": "CALIBRATION",
                "priority": "LOW",
                "title": "Empirical Service Time Calibration In Progress",
                "recommendation": "Allow at least 6 customer checkout completions to calibrate dynamic throughput.",
                "reasoning": (
                    f"Currently using default service assumptions for {names}. "
                    f"Predictions will automatically become empirically calibrated as checkout departures are logged."
                ),
                "supporting_metrics": {
                    "uncalibrated_counters": [c["name"] for c in uncalibrated]
                },
                "status": "ACTIVE"
            })
            
        # Rule 5: Camera boundary occlusion check
        for c in active_counters:
            boundary_occlusions = c.get("boundary_alert", False)
            if boundary_occlusions:
                recommendations.append({
                    "id": f"rec-camera-angle-{c['id']}",
                    "category": "CAMERA_POSITION",
                    "priority": "MEDIUM",
                    "title": f"Potential Queue Tail Cutoff at {c['name']}",
                    "recommendation": "Adjust camera tilt or widen field of view to capture the queue tail.",
                    "reasoning": (
                        f"Customers detected right at the edge of the video frame at {c['name']} "
                        f"suggests the queue may extend beyond the camera's current field of view."
                    ),
                    "supporting_metrics": {
                        "counter_id": c["id"],
                        "detected_count": c["people_count"]
                    },
                    "status": "ACTIVE"
                })
                
        return recommendations
