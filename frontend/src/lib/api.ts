const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('queueiq_token') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

export const api = {
  // Live Monitoring
  getLiveStatus: () => fetchApi<any>('/live/status'),
  startCamera: (source_type: string = 'webcam', file_path: string = '') =>
    fetchApi<any>('/live/start', {
      method: 'POST',
      body: JSON.stringify({ source_type, file_path }),
    }),
  stopCamera: () => fetchApi<any>('/live/stop', { method: 'POST' }),
  switchSource: (source_type: string, file_path: string = '', mobile_url: string = '') =>
    fetchApi<any>('/live/switch-source', {
      method: 'POST',
      body: JSON.stringify({ source_type, file_path, mobile_url }),
    }),

  // Counters & Polygons
  getCounters: () => fetchApi<any[]>('/counters'),
  updateCounter: (id: number, data: any) =>
    fetchApi<any>(`/counters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  resetCounters: () =>
    fetchApi<any>('/counters/reset-defaults', { method: 'POST' }),

  // Analytics
  getAnalyticsSummary: () => fetchApi<any>('/analytics/summary'),
  getAnalyticsHistory: (hours: number = 12) =>
    fetchApi<any[]>(`/analytics/history?hours=${hours}`),
  getPeakHours: () => fetchApi<any[]>('/analytics/peak-hours'),
  seedDemoData: () => fetchApi<any>('/analytics/seed-demo', { method: 'POST' }),

  // Alerts
  getAlerts: (unacknowledged: boolean = false) =>
    fetchApi<any[]>(`/alerts?unacknowledged=${unacknowledged}`),
  acknowledgeAlert: (id: number) =>
    fetchApi<any>(`/alerts/${id}/ack`, { method: 'POST' }),
  resolveAlert: (id: number) =>
    fetchApi<any>(`/alerts/${id}/resolve`, { method: 'POST' }),

  // Recommendations
  getRecommendations: () => fetchApi<any[]>('/recommendations'),
  dismissRecommendation: (id: string) =>
    fetchApi<any>(`/recommendations/${id}/dismiss`, { method: 'POST' }),

  // Settings
  getSettings: () => fetchApi<any>('/settings'),
  updateSettings: (data: any) =>
    fetchApi<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Auth
  devLogin: (name: string, email: string) =>
    fetchApi<any>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ name, email }),
    }),
  getSession: () => fetchApi<any>('/auth/session'),

  // Dataset Testing
  getDatasetOverview: () => fetchApi<any>('/dataset/overview'),
  getDatasetSequences: () => fetchApi<any[]>('/dataset/sequences'),
  resetDatasetProcessing: () => fetchApi<any>('/dataset/reset', { method: 'POST' }),
  startDatasetProcessing: (sequence_name: string, sampling_rate: number = 2, conf_threshold: number = 0.35) =>
    fetchApi<any>('/dataset/start', {
      method: 'POST',
      body: JSON.stringify({ sequence_name, sampling_rate, conf_threshold, force_restart: true }),
    }),
  pauseDatasetProcessing: () => fetchApi<any>('/dataset/pause', { method: 'POST' }),
  resumeDatasetProcessing: () => fetchApi<any>('/dataset/resume', { method: 'POST' }),
  stopDatasetProcessing: () => fetchApi<any>('/dataset/stop', { method: 'POST' }),
  getDatasetProgress: () => fetchApi<any>('/dataset/progress'),
  getDatasetSummary: () => fetchApi<any>('/dataset/summary'),
  getDatasetModels: () => fetchApi<any>('/dataset/models'),
  switchDatasetModel: (model_type: string) =>
    fetchApi<any>('/dataset/switch-model', {
      method: 'POST',
      body: JSON.stringify({ model_type }),
    }),
  getFrameInfo: (sequence_name?: string, frame_index?: number, conf_threshold?: number) => {
    const params = new URLSearchParams();
    if (sequence_name) params.append('sequence_name', sequence_name);
    if (frame_index) params.append('frame_index', frame_index.toString());
    if (conf_threshold) params.append('conf_threshold', conf_threshold.toString());
    return fetchApi<any>(`/dataset/frame-info?${params.toString()}`);
  },
  getWebcamStatus: () => fetchApi<any>('/webcam/status'),
  getDefaultWebcamZones: () => fetchApi<any>('/webcam/default-zones'),
  resetWebcamState: () => fetchApi<any>('/webcam/reset', { method: 'POST' }),
  switchWebcamModel: (model_type: string) =>
    fetchApi<any>('/webcam/switch-model', {
      method: 'POST',
      body: JSON.stringify({ model_type }),
    }),
  detectWebcamFrame: (
    imageBase64: string,
    confThreshold: number = 0.35,
    zones: any[] = [],
    modelType: string = 'pretrained',
    avgServiceTimeSec: number = 90,
    activeCounters: number = 3
  ) =>
    fetchApi<any>('/webcam/detect', {
      method: 'POST',
      body: JSON.stringify({
        image_base64: imageBase64,
        conf_threshold: confThreshold,
        zones: zones,
        model_type: modelType,
        avg_service_time_sec: avgServiceTimeSec,
        active_counters: activeCounters,
      }),
    }),
};
