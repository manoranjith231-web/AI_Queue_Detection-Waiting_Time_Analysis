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
  avg_wait_time_min: number | string;
  longest_wait_min: number | string;
  longest_counter_name: string;
  congestion_level: 'Optimal' | 'Moderate' | 'High';
  counters_requiring_attention: number;
  is_dataset_mode?: boolean;
  processing_status?: string;
  has_processed_data?: boolean;
  dataset_frames_processed?: number;
  dataset_total_detections?: number;
  dataset_avg_detections_per_frame?: number;
  dataset_avg_latency_ms?: number;
  unique_customers_disclaimer?: string;
  waiting_time_disclaimer?: string;
  counters: {
    id: number;
    name: string;
    counter_code: string;
    category: string;
    people_count: number;
    estimated_wait_min: number;
    congestion_level: string;
    requires_attention: boolean;
    calibration_status?: string;
  }[];
}

export interface DatasetOverview {
  dataset_name: string;
  citation: string;
  dataset_root: string;
  dataset_zip_path: string;
  exists: boolean;
  file_size_bytes: number;
  file_size_formatted: string;
  is_approximately_1gb: boolean;
  format: string;
  total_sequences: number;
  total_frames: number;
  has_annotations: boolean;
  activity_classes: Record<number, string>;
  ground_truth_schema?: string;
  queue_activity_ids?: number[];
  status: string;
  active_model_type?: string;
  active_model_name?: string;
  custom_trained_available?: boolean;
  custom_checkpoint_path?: string;
}

export interface DatasetSequence {
  sequence_name: string;
  frame_count: number;
  has_annotations: boolean;
  annotations_count: number;
  activities: Record<string, number>;
  is_queue_relevant: boolean;
  recommended: boolean;
}

export interface DatasetProgress {
  run_id: string;
  sequence: string;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'FAILED';
  is_running: boolean;
  is_paused: boolean;
  current_frame_index: number;
  processed_frames: number;
  total_frames: number;
  progress_percent: number;
  fps: number;
  latency_ms: number;
  total_detections: number;
  avg_detections_per_frame: number;
  avg_confidence: number;
  precision: number;
  recall: number;
  f1_score: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  skipped_files: number;
  error_count: number;
  errors: string[];
  latest_frame_name: string;
  latest_counter_counts: Record<number, number>;
  active_model_type?: string;
  active_model_name?: string;
  custom_trained_available?: boolean;
}

export interface DatasetSummary {
  has_processed_data: boolean;
  total_runs: number;
  total_frames_processed: number;
  total_person_detections: number;
  avg_detections_per_frame: number;
  avg_latency_ms: number;
  precision: number;
  recall: number;
  f1_score: number;
  data_source: string;
  service_time_status: string;
  latest_run?: any;
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
