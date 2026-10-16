'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  Play,
  Square,
  RefreshCw,
  Cpu,
  Layers,
  Settings2,
  Sliders,
  CheckCircle,
} from 'lucide-react';
import PolygonEditor from '@/components/PolygonEditor';
import QueueCard from '@/components/QueueCard';
import { api } from '@/lib/api';
import { LiveCounterStatus, Counter } from '@/lib/types';

export default function LiveMonitoringPage() {
  const [counters, setCounters] = useState<LiveCounterStatus[]>([]);
  const [rawCounters, setRawCounters] = useState<Counter[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [cameraStatus, setCameraStatus] = useState('Active');
  const [modelStatus, setModelStatus] = useState('YOLOv8n (CPU)');
  const [fps, setFps] = useState(15.0);
  const [latency, setLatency] = useState(65);
  const [showPolygonEditor, setShowPolygonEditor] = useState(false);

  const fetchLiveState = async () => {
    try {
      const [liveData, countersData] = await Promise.all([
        api.getLiveStatus(),
        api.getCounters(),
      ]);
      setCounters(liveData.counters || []);
      setRawCounters(countersData || []);
      setIsDemoMode(Boolean(liveData.is_simulated));
      setCameraStatus(liveData.camera_status || 'Active');
      setModelStatus(liveData.model_status || 'YOLOv8n (CPU)');
      setFps(liveData.fps || 15.0);
      setLatency(liveData.latency_ms || 65);
    } catch (err) {
      console.error('Error fetching live monitoring state:', err);
    }
  };

  useEffect(() => {
    fetchLiveState();
    const interval = setInterval(fetchLiveState, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleStartWebcam = async () => {
    try {
      const res = await api.startCamera('webcam');
      setCameraStatus(res.camera_status);
      setIsCameraActive(true);
      fetchLiveState();
    } catch (err) {
      console.error('Failed to start webcam:', err);
    }
  };

  const handleStopCamera = async () => {
    try {
      await api.stopCamera();
      setIsCameraActive(false);
      setCameraStatus('Stopped');
    } catch (err) {
      console.error('Failed to stop camera:', err);
    }
  };

  const handleSwitchToDemo = async () => {
    try {
      await api.switchSource('demo');
      fetchLiveState();
    } catch (err) {
      console.error('Failed to switch to demo:', err);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white tracking-tight">
            Live Queue Vision Monitoring
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time YOLOv8 person tracking, ground-anchor foot placement, and polygon queue zone mapping.
          </p>
        </div>

        {/* Video Control Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPolygonEditor(!showPolygonEditor)}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              showPolygonEditor
                ? 'bg-primary text-background border-primary shadow-glow'
                : 'bg-surface-card text-slate-200 border-border hover:bg-surface-elevated'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showPolygonEditor ? 'Hide Polygon Editor' : 'Configure Queue Polygons'}</span>
          </button>

          <button
            onClick={handleStartWebcam}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-success/20 text-success border border-success/40 hover:bg-success/30 transition-all"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Laptop Webcam</span>
          </button>

          <button
            onClick={handleSwitchToDemo}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-warning/20 text-warning border border-warning/40 hover:bg-warning/30 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Demo Mode</span>
          </button>

          <button
            onClick={handleStopCamera}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-elevated text-slate-400 border border-border hover:text-danger hover:border-danger/30 transition-all"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Stop</span>
          </button>
        </div>
      </div>

      {/* Main Video Section OR Interactive Polygon Editor */}
      {showPolygonEditor ? (
        <PolygonEditor counters={rawCounters} onCountersUpdated={fetchLiveState} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 3 Cols: Video Stream Container */}
          <div className="lg:col-span-3 rounded-2xl overflow-hidden bg-black border border-border shadow-2xl relative">
            <div className="relative aspect-video w-full flex items-center justify-center bg-slate-950">
              {isCameraActive ? (
                <img
                  src="http://127.0.0.1:8000/api/live/stream"
                  alt="Live Queue Feed"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center space-y-2 text-slate-500">
                  <Camera className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm font-medium">Video Stream Paused</p>
                  <button
                    onClick={handleStartWebcam}
                    className="px-4 py-1.5 rounded-lg text-xs bg-primary text-background font-semibold"
                  >
                    Resume Feed
                  </button>
                </div>
              )}

              {/* Live Overlay Badges */}
              <div className="absolute top-3 left-3 flex items-center space-x-2">
                <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-mono text-white border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                  <span>LIVE FEED</span>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-mono text-primary border border-primary/30">
                  {fps.toFixed(1)} FPS | {latency}ms
                </span>
              </div>
            </div>

            {/* Stream Status Bar */}
            <div className="p-3 bg-surface border-t border-border flex flex-wrap items-center justify-between text-xs text-slate-400">
              <div className="flex items-center space-x-4">
                <span>
                  Source: <strong className="text-slate-200">{cameraStatus}</strong>
                </span>
                <span>
                  Engine: <strong className="text-slate-200">{modelStatus}</strong>
                </span>
                <span>
                  Target FPS: <strong className="text-slate-200">15 FPS (CPU-tuned)</strong>
                </span>
              </div>

              <button
                onClick={() => setShowPolygonEditor(true)}
                className="text-primary hover:underline font-mono text-xs"
              >
                Reshape Queue Polygons →
              </button>
            </div>
          </div>

          {/* 1 Col: Quick Telemetry & Vision Specs */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-surface-card border border-border space-y-3">
              <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
                Vision Engine Parameters
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between pb-1.5 border-b border-border/50">
                  <span className="text-slate-400">Model Architecture</span>
                  <span className="font-mono text-white font-medium">YOLOv8 Nano</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-border/50">
                  <span className="text-slate-400">Detected Class</span>
                  <span className="font-mono text-primary font-medium">Class 0 (Person)</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-border/50">
                  <span className="text-slate-400">Tracking Algorithm</span>
                  <span className="font-mono text-white">Centroid + IoU</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-border/50">
                  <span className="text-slate-400">Zone Assignment</span>
                  <span className="font-mono text-slate-200">Ground-Anchor Feet</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-border/50">
                  <span className="text-slate-400">Hardware Mode</span>
                  <span className="font-mono text-success">Windows CPU (No GPU req)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Privacy Guarantee</span>
                  <span className="font-mono text-success">Zero Facial Rec / Local</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-card/60 border border-border text-xs text-slate-400 space-y-2">
              <span className="text-slate-200 font-semibold block">Supermarket Zone Assignment</span>
              <p className="leading-relaxed text-[11px]">
                Customers are assigned to billing queues using their bottom-center ground coordinates (foot placement) rather than head or center point. This ensures people in adjacent aisles are never falsely counted.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Counters Real-time Cards */}
      <div className="space-y-4">
        <h2 className="font-heading font-bold text-xl text-white">
          Active Billing Register Live Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {counters.map((c) => (
            <QueueCard key={c.id} counter={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
