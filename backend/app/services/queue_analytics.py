import time
from typing import Dict, List, Any, Optional
from collections import deque

class QueueAnalyticsEngine:
    def __init__(self, smoothing_window: int = 5):
        # Rolling count buffer per counter to smooth momentary occlusion / detection flutter
        self.count_history: Dict[int, deque] = {}
        self.smoothing_window = smoothing_window
        # Throughput tracking: counter_id -> list of timestamped departures
        self.departures: Dict[int, deque] = {}
        # Min departure observations needed before empirical throughput overrides configured service time
        self.MIN_OBSERVATIONS_FOR_CALIBRATION = 6

    def record_raw_count(self, counter_id: int, raw_count: int) -> int:
        """
        Smooths raw YOLO detections using a moving median/average over window.
        Prevents bouncing counts if someone momentarily turns sideways or is occluded.
        """
        if counter_id not in self.count_history:
            self.count_history[counter_id] = deque(maxlen=self.smoothing_window)
        
        self.count_history[counter_id].append(raw_count)
        
        # Rounded mean of recent window
        smoothed = int(round(sum(self.count_history[counter_id]) / len(self.count_history[counter_id])))
        return smoothed

    def record_departure(self, counter_id: int) -> None:
        """
        Records when a customer completes billing and leaves the front of the queue.
        Used to calculate empirical throughput.
        """
        now = time.time()
        if counter_id not in self.departures:
            self.departures[counter_id] = deque(maxlen=20)
        self.departures[counter_id].append(now)

    def calculate_empirical_service_time(self, counter_id: int) -> Optional[float]:
        """
        Calculates empirical average service time if sufficient departures exist.
        Returns None if calibration needed (< MIN_OBSERVATIONS_FOR_CALIBRATION).
        """
        events = self.departures.get(counter_id)
        if not events or len(events) < self.MIN_OBSERVATIONS_FOR_CALIBRATION:
            return None
        
        # Inter-departure intervals
        intervals = [events[i] - events[i - 1] for i in range(1, len(events))]
        # Filter extreme outliers (<10s or >10mins)
        valid = [iv for iv in intervals if 10.0 <= iv <= 600.0]
        if len(valid) < 4:
            return None
        return float(sum(valid) / len(valid))

    def estimate_waiting_time(
        self, 
        counter_id: int, 
        people_count: int, 
        configured_service_time_sec: float
    ) -> Dict[str, Any]:
        """
        Documented Waiting Time Formula:
        
        T_wait = N_ahead * S_eff
        
        Where:
        - N_ahead = max(0, people_count - 1)  (The person currently at the billing register is in service; 
                                              a new customer joining waits for everyone ahead)
        - S_eff   = Empirical measured service time (if >= 6 departure samples) OR configured average service time.
        
        Distinguishes calibrated vs rough estimated time.
        """
        people_ahead = max(0, people_count - 1)
        empirical_s = self.calculate_empirical_service_time(counter_id)
        
        if empirical_s is not None:
            effective_service_sec = empirical_s
            is_calibrated = True
            calculation_mode = "Empirical Throughput Calibrated"
        else:
            effective_service_sec = configured_service_time_sec
            is_calibrated = False
            calculation_mode = "Configured Service Time Estimate (Calibration in progress)"
            
        estimated_sec = people_ahead * effective_service_sec
        
        return {
            "people_count": people_count,
            "people_ahead": people_ahead,
            "estimated_wait_time_sec": round(estimated_sec, 1),
            "estimated_wait_time_min": round(estimated_sec / 60.0, 1),
            "is_calibrated": is_calibrated,
            "effective_service_sec": round(effective_service_sec, 1),
            "calculation_mode": calculation_mode,
            "departure_samples_collected": len(self.departures.get(counter_id, []))
        }

    def compute_congestion_status(
        self, 
        people_count: int, 
        congestion_threshold: int
    ) -> Dict[str, Any]:
        """
        Determines queue congestion level:
        - Normal: count < threshold
        - Warning (Congested): count >= threshold and count < threshold + 2
        - Critical (Overloaded): count >= threshold + 2
        """
        if people_count >= congestion_threshold + 2:
            return {
                "level": "Critical",
                "severity_score": 1.0,
                "badge_color": "#EF4444",
                "label": "Overloaded"
            }
        elif people_count >= congestion_threshold:
            return {
                "level": "Warning",
                "severity_score": 0.65,
                "badge_color": "#F59E0B",
                "label": "Congested"
            }
        else:
            return {
                "level": "Normal",
                "severity_score": 0.2,
                "badge_color": "#10B981",
                "label": "Optimal"
            }
