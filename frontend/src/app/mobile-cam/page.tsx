'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Smartphone,
  Video,
  VideoOff,
  RefreshCw,
  Wifi,
  WifiOff,
  ArrowLeft,
  RotateCcw,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Camera,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function MobileCameraPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [fps, setFps] = useState(0);
  const [framesSent, setFramesSent] = useState(0);
  const [serverStatus, setServerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameCountRef = useRef(0);
  const totalFramesRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

  // Check backend server connectivity
  useEffect(() => {
    const checkServer = () => {
      fetch('/api/health')
        .then((res) => (res.ok ? setServerStatus('connected') : setServerStatus('error')))
        .catch(() => setServerStatus('error'));
    };
    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  const startCamera = async () => {
    setErrorMsg('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsStreaming(true);
      frameCountRef.current = 0;
      totalFramesRef.current = 0;
    } catch (err: any) {
      setErrorMsg(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : err?.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : 'Could not start camera. Please check permissions and try again.'
      );
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setFps(0);
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Restart camera when facingMode changes
  useEffect(() => {
    if (isStreaming) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Frame upload loop
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isStreaming) {
      intervalId = setInterval(() => {
        if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== 4) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, 640, 480);

        canvas.toBlob(
          async (blob) => {
            if (!blob) return;
            const formData = new FormData();
            formData.append('file', blob, 'frame.jpg');

            try {
              const res = await fetch('/api/live/phone-frame', {
                method: 'POST',
                body: formData,
              });
              if (res.ok) {
                frameCountRef.current++;
                totalFramesRef.current++;
                const now = Date.now();
                if (now - lastFpsTimeRef.current >= 1000) {
                  setFps(frameCountRef.current);
                  setFramesSent(totalFramesRef.current);
                  frameCountRef.current = 0;
                  lastFpsTimeRef.current = now;
                }
              }
            } catch {
              // Frame dropped silently
            }
          },
          'image/jpeg',
          0.75
        );
      }, 100); // ~10 FPS upload
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isStreaming]);

  const serverStatusConfig = {
    connecting: { color: 'text-warning', icon: AlertCircle, label: 'Connecting...' },
    connected: { color: 'text-success', icon: CheckCircle2, label: 'Server Ready' },
    error: { color: 'text-danger', icon: XCircle, label: 'Server Offline' },
  };
  const statusCfg = serverStatusConfig[serverStatus];
  const StatusIcon = statusCfg.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <div className="bg-[#101B2E] border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link
          href="/"
          className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium">Back to Dashboard</span>
        </Link>

        <div className="flex items-center space-x-1.5 text-xs font-mono px-3 py-1.5 rounded-full bg-surface-card border border-border">
          <StatusIcon className={`w-3.5 h-3.5 ${statusCfg.color}`} />
          <span className={statusCfg.color}>{statusCfg.label}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full p-4 space-y-4">
        {/* Title */}
        <div className="pt-2 space-y-1">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <h1 className="font-heading font-bold text-xl text-white">Mobile Camera Monitor</h1>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Stream your phone camera wirelessly to QueueIQ AI for live queue detection via Wi-Fi.
          </p>
        </div>

        {/* Live Stats Row */}
        {isStreaming && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-card border border-border rounded-xl p-3 text-center">
              <div className="text-lg font-bold font-mono text-primary">{fps}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">FPS</div>
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-3 text-center">
              <div className="text-lg font-bold font-mono text-accent">{framesSent}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Frames</div>
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-3 text-center">
              <div className="flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" />
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Live</div>
            </div>
          </div>
        )}

        {/* Video Viewport */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-border shadow-2xl"
          style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover ${!isStreaming ? 'hidden' : ''}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {!isStreaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-surface-card border border-border flex items-center justify-center">
                <Camera className="w-8 h-8 text-slate-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-slate-300">Camera is Off</p>
                <p className="text-xs text-slate-500">Tap Start to begin streaming</p>
              </div>
              {errorMsg && (
                <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-center max-w-xs">
                  {errorMsg}
                </div>
              )}
            </div>
          )}

          {/* Streaming Overlay */}
          {isStreaming && (
            <>
              <div className="absolute top-3 left-3 flex items-center space-x-2">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-mono text-white border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                  <span>LIVE</span>
                </div>
                <div className="px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-mono text-accent border border-accent/30">
                  {fps} FPS
                </div>
              </div>

              <div className="absolute bottom-3 right-3">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-mono text-success border border-success/30">
                  <Wifi className="w-3 h-3" />
                  <span>Streaming to PC</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Camera Controls */}
        <div className="space-y-3">
          {isStreaming ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={flipCamera}
                className="flex items-center justify-center space-x-2 py-3.5 rounded-xl text-sm font-semibold bg-surface-card border border-border hover:bg-surface-elevated text-slate-200 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Flip Camera</span>
              </button>
              <button
                onClick={stopCamera}
                className="flex items-center justify-center space-x-2 py-3.5 rounded-xl text-sm font-semibold bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-all"
              >
                <VideoOff className="w-4 h-4" />
                <span>Stop Stream</span>
              </button>
            </div>
          ) : (
            <button
              onClick={startCamera}
              disabled={serverStatus === 'error'}
              className="w-full py-4 rounded-xl text-sm font-bold bg-accent text-background hover:bg-accent-light transition-all shadow-glow-amber flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Video className="w-5 h-5" />
              <span>Start Live Streaming</span>
            </button>
          )}
        </div>

        {/* How it works */}
        <div className="bg-surface-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-white">How to Use</span>
          </div>
          <ol className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start space-x-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">1</span>
              <span>Connect your phone and laptop to the <strong className="text-slate-300">same Wi-Fi</strong> network.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">2</span>
              <span>Open <strong className="text-slate-300 font-mono">http://&lt;your-pc-ip&gt;:3000/mobile-cam</strong> in your phone browser.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">3</span>
              <span>Grant camera permission and tap <strong className="text-slate-300">Start Live Streaming</strong>.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">4</span>
              <span>Point the phone at checkout counters — YOLOv8 detects queues live on your PC!</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
