'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Camera, Shield, Check, Store } from 'lucide-react';
import { api } from '@/lib/api';
import { Counter, SystemSettings } from '@/lib/types';

export default function SettingsPage() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    store_name: 'HyperMarket Mart (Branch 104)',
    confidence_threshold: 0.35,
    camera_index: 0,
    video_source: 'webcam',
    default_service_time_sec: 120.0,
    congestion_threshold_people: 4,
    alert_cooldown_seconds: 45,
    yolo_model: 'yolov8n.pt',
  });
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [cData, sData] = await Promise.all([
          api.getCounters(),
          api.getSettings(),
        ]);
        setCounters(cData);
        if (sData) setSettings(sData);
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    load();
  }, []);

  const handleUpdateCounter = (id: number, field: string, value: any) => {
    setCounters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleSaveAll = async () => {
    try {
      await api.updateSettings(settings);
      for (const c of counters) {
        await api.updateCounter(c.id, {
          name: c.name,
          category: c.category,
          avg_service_time_sec: c.avg_service_time_sec,
          congestion_threshold: c.congestion_threshold,
          is_active: Boolean(c.is_active),
        });
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleResetPolygons = async () => {
    if (!confirm('Reset all 3 queue polygons back to factory supermarket layout?')) return;
    try {
      await api.resetCounters();
      const updated = await api.getCounters();
      setCounters(updated);
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Settings className="w-6 h-6 text-primary" />
            <h1 className="font-heading text-3xl font-bold text-white tracking-tight">
              Supermarket & Queue Settings
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Configure register service rates, congestion alert triggers, camera devices, and store properties.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-glow transition-all ${
            isSaved
              ? 'bg-success text-background font-bold'
              : 'bg-primary text-background hover:bg-primary-light'
          }`}
        >
          {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{isSaved ? 'Settings Saved!' : 'Save All Changes'}</span>
        </button>
      </div>

      {/* General Store Configuration */}
      <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-5">
        <div className="flex items-center space-x-2 text-white font-heading font-semibold text-base">
          <Store className="w-5 h-5 text-primary" />
          <span>General Store Configuration</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Store Name / Branch</label>
            <input
              type="text"
              value={settings.store_name}
              onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-sm text-white focus:outline-none focus:border-primary font-sans"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Alert Cooldown (Seconds)</label>
            <input
              type="number"
              value={settings.alert_cooldown_seconds}
              onChange={(e) =>
                setSettings({ ...settings, alert_cooldown_seconds: parseInt(e.target.value) || 45 })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-sm text-white focus:outline-none focus:border-primary font-mono"
            />
            <span className="text-[11px] text-slate-500">
              Suppresses duplicate audio/visual alerts within this cooldown period.
            </span>
          </div>
        </div>
      </div>

      {/* Billing Registers & Service Time Calibration */}
      <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white font-heading font-semibold text-base">
            <Settings className="w-5 h-5 text-accent" />
            <span>Billing Counters & Queue Assumptions</span>
          </div>

          <button
            onClick={handleResetPolygons}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Polygons</span>
          </button>
        </div>

        <div className="space-y-4">
          {counters.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-surface/70 border border-border/80 grid grid-cols-1 md:grid-cols-4 gap-4 items-center"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Counter Name
                </span>
                <input
                  type="text"
                  value={c.name}
                  onChange={(e) => handleUpdateCounter(c.id, 'name', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Category
                </span>
                <select
                  value={c.category}
                  onChange={(e) => handleUpdateCounter(c.id, 'category', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-white"
                >
                  <option value="Express">Express Checkout</option>
                  <option value="Standard">Standard Baskets</option>
                  <option value="Bulk">Trolley & Bulk</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Avg Service Time (Sec)
                </span>
                <input
                  type="number"
                  value={c.avg_service_time_sec}
                  onChange={(e) =>
                    handleUpdateCounter(c.id, 'avg_service_time_sec', parseFloat(e.target.value) || 120)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Congestion Threshold
                </span>
                <input
                  type="number"
                  value={c.congestion_threshold}
                  onChange={(e) =>
                    handleUpdateCounter(c.id, 'congestion_threshold', parseInt(e.target.value) || 4)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-white font-mono"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Free & Open-Source Security & Privacy Notice */}
      <div className="p-5 rounded-2xl bg-surface-card/60 border border-border text-xs text-slate-400 space-y-2">
        <div className="flex items-center space-x-2 text-slate-200 font-semibold">
          <Shield className="w-4 h-4 text-success" />
          <span>Local-First & Privacy Standards</span>
        </div>
        <p className="leading-relaxed">
          QueueIQ AI processes all video frames locally in system memory. No raw video streams, customer facial biometric data, or identity features are ever stored to disk or transmitted to third-party cloud services. Only aggregate numerical counts and anonymous queue timestamps are recorded in the local SQLite database.
        </p>
      </div>
    </div>
  );
}
