export interface Counter {
  id: number;
  counter_code: string;
  name: string;
  category: string;
  is_active: boolean | number;
  avg_service_time_sec: number;
  congestion_threshold: number;
  polygon_coords: [number, number][];
  color: string;
}

export interface LiveCounterStatus extends Counter {
  people_count: number;
  raw_count: number;
  people_ahead: number;
  estimated_wait_time_sec: number;
  estimated_wait_time_min: number;
  is_calibrated: boolean;
  calculation_mode: string;
  congestion_level: 'Normal' | 'Warning' | 'Critical';
  congestion_label: string;
  congestion_color: string;
  boundary_alert?: boolean;
}

export interface LiveStatusResponse {
  fps: number;
  latency_ms: number;
  model_status: string;
  camera_status: string;
  is_simulated: boolean;
  total_waiting: number;
  counters: LiveCounterStatus[];
}

export interface AnalyticsSummary {
  total_waiting: number;
  active_counters: number;
  avg_wait_time_min: number;
  longest_wait_min: number;
  longest_counter_name: string;
  congestion_level: 'Optimal' | 'Moderate' | 'High';
  counters_requiring_attention: number;
  counters: {
    id: number;
    name: string;
    counter_code: string;
    category: string;
    people_count: number;
    estimated_wait_min: number;
    congestion_level: string;
    requires_attention: boolean;
  }[];
}

export interface Alert {
  id: number;
  timestamp: string;
  counter_id: number | null;
  alert_type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  metrics_snapshot?: Record<string, any>;
  acknowledged: boolean | number;
  acknowledged_at?: string;
  resolved: boolean | number;
  resolved_at?: string;
}

export interface Recommendation {
  id: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  title: string;
  recommendation: string;
  reasoning: string;
  supporting_metrics: Record<string, any>;
  status: 'ACTIVE' | 'APPLIED' | 'DISMISSED';
}

export interface SystemSettings {
  store_name: string;
  confidence_threshold: number;
  camera_index: number;
  video_source: string;
  default_service_time_sec: number;
  congestion_threshold_people: number;
  alert_cooldown_seconds: number;
  yolo_model: string;
}
