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
  switchSource: (source_type: string, file_path: string = '') =>
    fetchApi<any>('/live/switch-source', {
      method: 'POST',
      body: JSON.stringify({ source_type, file_path }),
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
};
