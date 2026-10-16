'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Camera,
  Smartphone,
  Play,
  Square,
  RefreshCw,
  Cpu,
  Layers,
  Settings2,
  Sliders,
  CheckCircle,
  ExternalLink,
  Wifi,
  Globe,
  Database,
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
  const [currentSource, setCurrentSource] = useState('demo');
  const [modelStatus, setModelStatus] = useState('YOLOv8n (CPU)');
  const [fps, setFps] = useState(15.0);
  const [latency, setLatency] = useState(65);
  const [showPolygonEditor, setShowPolygonEditor] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [mobileIpUrl, setMobileIpUrl] = useState('http://192.168.1.50:8080/video');
  const [mobileConnecting, setMobileConnecting] = useState(false);

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
      setCurrentSource(liveData.current_source || 'demo');
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

  const handleConnectMobileIp = async () => {
    setMobileConnecting(true);
    try {
      await api.switchSource('mobile_cam', '', mobileIpUrl);
      setShowMobileModal(false);
      fetchLiveState();
    } catch (err) {
      alert('Could not connect to Mobile IP stream. Verify your phone and laptop are on the same Wi-Fi.');
    } finally {
      setMobileConnecting(false);
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
            Live Retail Vision Monitoring
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time YOLOv8 person tracking, ground-anchor foot placement, and polygon queue zones.
          </p>
        </div>

        {/* Video Source Control Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dataset"
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-all shadow-glow"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Dataset Testing Studio</span>
          </Link>

          <button
            onClick={() => setShowPolygonEditor(!showPolygonEditor)}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              showPolygonEditor
                ? 'bg-primary text-white border-primary shadow-glow'
                : 'bg-surface-card text-slate-200 border border-border hover:bg-surface-elevated'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showPolygonEditor ? 'Close Polygon Editor' : 'Configure Queue Polygons'}</span>
          </button>

          <span className="px-3 py-1.5 rounded-xl text-xs font-mono bg-surface border border-border text-slate-400">
            Source: <strong className="text-white">Dataset Only</strong>
          </span>
        </div>
      </div>

      {/* Mobile Camera Connect Modal */}
      {showMobileModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-border p-6 rounded-2xl max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2.5">
                <Smartphone className="w-5 h-5 text-accent" />
                <h3 className="font-heading font-bold text-lg text-white">
                  Connect Mobile Camera
                </h3>
              </div>
              <button
                onClick={() => setShowMobileModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Option 1: Mobile Web App */}
              <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                <span className="font-heading font-semibold text-white block text-sm">
                  Option 1: Stream Directly From Phone Browser (Easiest)
                </span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Open your smartphone browser on the same Wi-Fi network and navigate to:
                </p>
                <div className="p-2.5 rounded-lg bg-surface-elevated text-accent font-mono text-xs font-semibold flex items-center justify-between">
                  <span>http://localhost:3000/mobile-cam</span>
                  <Link
                    href="/mobile-cam"
                    target="_blank"
                    className="flex items-center space-x-1 text-slate-300 hover:text-white"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                <p className="text-[10px] text-slate-500">
                  Allow camera permissions on your phone, and it immediately streams wireless video frames to QueueIQ AI!
                </p>
              </div>

              {/* Option 2: IP Webcam / DroidCam app */}
              <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                <span className="font-heading font-semibold text-white block text-sm">
                  Option 2: Connect via Free Phone App (IP Webcam / DroidCam)
                </span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Download free <strong>IP Webcam</strong> (Android) or <strong>IP Camera Lite</strong> (iOS), tap &ldquo;Start Server&rdquo;, and enter the RTSP / HTTP video URL below:
                </p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={mobileIpUrl}
                    onChange={(e) => setMobileIpUrl(e.target.value)}
                    placeholder="http://192.168.1.X:8080/video"
                    className="flex-1 px-3 py-2 rounded-lg bg-surface-elevated border border-border text-white text-xs font-mono focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={handleConnectMobileIp}
                    disabled={mobileConnecting}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-background hover:bg-accent-light shrink-0"
                  >
                    {mobileConnecting ? 'Connecting...' : 'Connect Stream'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    className="px-4 py-1.5 rounded-lg text-xs bg-primary text-white font-semibold"
                  >
                    Resume Feed
                  </button>
                </div>
              )}

              {/* Live Overlay Badges */}
              <div className="absolute top-3 left-3 flex items-center space-x-2">
                <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-mono text-white border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                  <span>MONITORING ACTIVE</span>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-mono text-accent border border-accent/40 font-semibold">
                  {fps.toFixed(1)} FPS | {latency}ms
                </span>
              </div>
            </div>

            {/* Stream Status Bar */}
            <div className="p-3.5 bg-surface border-t border-border flex flex-wrap items-center justify-between text-xs text-slate-400">
              <div className="flex items-center space-x-4">
                <span>
                  Source: <strong className="text-white">{cameraStatus}</strong>
                </span>
                <span>
                  Inference: <strong className="text-white">{modelStatus}</strong>
                </span>
                <span>
                  Anchor Mode: <strong className="text-accent">Customer Foot Ground Contact</strong>
                </span>
              </div>

              <button
                onClick={() => setShowPolygonEditor(true)}
                className="text-primary hover:underline font-mono text-xs font-semibold"
              >
                Drag & Reshape Queue Polygons →
              </button>
            </div>
          </div>

          {/* 1 Col: Quick Vision Engine Specifications */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-surface-card border border-border space-y-3.5 shadow-card">
              <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
                Retail Vision Pipeline
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between pb-1.5 border-b border-border/60">
                  <span className="text-slate-400">Model</span>
                  <span className="font-mono text-white font-medium">YOLOv8 Nano</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-border/60">
                  <span className="text-slate-400">Target</span>
                  <span className="font-mono text-primary font-semibold">Class 0 (Shopper)</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-border/60">
                  <span className="text-slate-400">Tracking</span>
                  <span className="font-mono text-white">Centroid + IoU ID</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-border/60">
                  <span className="text-slate-400">Mobile Cam</span>
                  <span className="font-mono text-accent font-semibold">Supported</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-border/60">
                  <span className="text-slate-400">Hardware</span>
                  <span className="font-mono text-success">Windows CPU (No GPU req)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Privacy</span>
                  <span className="font-mono text-success">No Biometrics / In-Memory</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-card border border-border text-xs text-slate-400 space-y-2 shadow-card">
              <span className="text-white font-semibold block">Mobile Monitoring Tip</span>
              <p className="leading-relaxed text-[11px]">
                You can mount your smartphone on a retail tripod overlooking the checkout registers. Open <code>/mobile-cam</code> on your phone to turn it into an AI queue monitoring station.
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
