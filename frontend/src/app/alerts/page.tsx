'use client';

import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, ShieldCheck, CheckCheck } from 'lucide-react';
import AlertCard from '@/components/AlertCard';
import { api } from '@/lib/api';
import { Alert } from '@/lib/types';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showUnacknowledgedOnly, setShowUnacknowledgedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await api.getAlerts(showUnacknowledgedOnly);
      setAlerts(res);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 4000);
    return () => clearInterval(timer);
  }, [showUnacknowledgedOnly]);

  const handleAcknowledge = async (id: number) => {
    try {
      await api.acknowledgeAlert(id);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await api.resolveAlert(id);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Bell className="w-6 h-6 text-warning" />
            <h1 className="font-heading text-3xl font-bold text-white tracking-tight">
              Operational Queue Alerts
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time congestion notifications, 45-second deduplication cooldowns, and audit trail.
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center space-x-2 bg-surface-card p-1 rounded-xl border border-border text-xs">
          <button
            onClick={() => setShowUnacknowledgedOnly(false)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              !showUnacknowledgedOnly
                ? 'bg-primary/20 text-primary font-semibold border border-primary/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setShowUnacknowledgedOnly(true)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              showUnacknowledgedOnly
                ? 'bg-primary/20 text-primary font-semibold border border-primary/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Unacknowledged Only
          </button>
        </div>
      </div>

      {/* Alerts Grid / List */}
      <div className="space-y-4">
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
            />
          ))
        ) : (
          <div className="p-12 text-center rounded-2xl bg-surface-card border border-border space-y-3">
            <ShieldCheck className="w-12 h-12 text-success mx-auto opacity-80" />
            <h3 className="font-heading font-semibold text-lg text-white">
              No Active Queue Alerts
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All checkout registers are operating normally. Congestion triggers will automatically appear here when queues exceed defined thresholds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
