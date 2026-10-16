'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Play,
  Square,
  Activity,
  Users,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Sparkles,
  Store,
  Layers,
  Zap,
  CheckCircle2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  VideoOff,
} from 'lucide-react';
import { api } from '@/lib/api';

interface QueueZone {
  id: string;
  name: string;
  target: number;
  color: string;
  polygon: number[][]; // normalized coords [x, y] in range [0, 1]
  count?: number;
  status?: 'Short' | 'Moderate' | 'Long';
  status_color?: string;
}

const DEFAULT_ZONES: QueueZone[] = [
  {
    id: 'zone-1',
    name: 'Checkout 1 (Express)',
    target: 2,
    color: '#06B6D4', // Cyan
    polygon: [
      [0.05, 0.25],
      [0.35, 0.25],
      [0.35, 0.99],
      [0.05, 0.99],
    ],
  },
  {
    id: 'zone-2',
    name: 'Checkout 2 (Main)',
    target: 3,
    color: '#3B82F6', // Blue
    polygon: [
      [0.38, 0.25],
      [0.68, 0.25],
      [0.68, 0.99],
      [0.38, 0.99],
    ],
  },
  {
    id: 'zone-3',
    name: 'Checkout 3 (Self-Scan)',
    target: 4,
    color: '#A855F7', // Purple
    polygon: [
      [0.70, 0.25],
      [0.95, 0.25],
      [0.95, 0.99],
      [0.70, 0.99],
    ],
  },
];

export default function LiveWebcamPage() {
  // Camera stream state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraStatus, setCameraStatus] = useState<string>('Camera Inactive');
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Detection settings & state
  const [detectionActive, setDetectionActive] = useState<boolean>(false);
  const [confThreshold, setConfThreshold] = useState<number>(0.35);
  const [samplingIntervalMs, setSamplingIntervalMs] = useState<number>(250); // ~4 FPS inference
  const [showZonesOverlay, setShowZonesOverlay] = useState<boolean>(true);
  const [selectedModelType, setSelectedModelType] = useState<string>('pretrained');
  const [activeModelName, setActiveModelName] = useState<string>('yolov8n.pt (COCO Person Detector)');

  // Queue wait time parameters & explainability
  const [avgServiceTimeSec, setAvgServiceTimeSec] = useState<number>(90);
  const [activeCounters, setActiveCounters] = useState<number>(3);
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState<number | null>(null);
  const [waitTimeExplanation, setWaitTimeExplanation] = useState<string>(
    'Approximate estimate based on 90s avg service time across 3 active registers.'
  );

  // Live telemetry metrics
  const [peopleCount, setPeopleCount] = useState<number>(0);
  const [inferenceLatency, setInferenceLatency] = useState<number>(0);
  const [actualFps, setActualFps] = useState<number>(0);
  const [zones, setZones] = useState<QueueZone[]>(DEFAULT_ZONES);
  const [recommendations, setRecommendations] = useState<string[]>([
    'Start the camera and detection to observe live queue flow and automated cashier recommendations.',
  ]);
  const [limitationNotice, setLimitationNotice] = useState<string>(
    'Queue counts reflect visible pedestrian bounding boxes. Occasional occlusions or overlapping customers can occur in dense checkout lines.'
  );
  const [modelInfo, setModelInfo] = useState<any>(null);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasCaptureRef = useRef<HTMLCanvasElement | null>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Flow control refs to prevent overlapping requests and race conditions
  const isDetectingRef = useRef<boolean>(false);
  const isInferenceInFlightRef = useRef<boolean>(false);
  const detectionLoopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDetectionTimestampRef = useRef<number>(Date.now());
  const activeZonesRef = useRef<QueueZone[]>(DEFAULT_ZONES);
  const selectedModelTypeRef = useRef<string>('pretrained');
  const avgServiceTimeSecRef = useRef<number>(90);
  const activeCountersRef = useRef<number>(3);

  // Keep activeZonesRef & parameter refs in sync with state for loop execution
  useEffect(() => {
    activeZonesRef.current = zones;
  }, [zones]);

  useEffect(() => {
    selectedModelTypeRef.current = selectedModelType;
  }, [selectedModelType]);

  useEffect(() => {
    avgServiceTimeSecRef.current = avgServiceTimeSec;
  }, [avgServiceTimeSec]);

  useEffect(() => {
    activeCountersRef.current = activeCounters;
  }, [activeCounters]);

  // Load backend model diagnostics on mount
  useEffect(() => {
    api.getWebcamStatus()
      .then((data) => setModelInfo(data))
      .catch((e) => console.error('Failed to get webcam status:', e));
  }, []);

  // Enumerate available video devices
  const enumerateCameras = useCallback(async () => {
    try {
      if (navigator?.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setCameraDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      }
    } catch (err) {
      console.warn('Could not enumerate media devices:', err);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    enumerateCameras();
  }, [enumerateCameras]);

  // Safe camera track shutdown
  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Silent catch
        }
      });
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStatus('Camera Stopped');
  }, []);

  // Keep video element synced with stream whenever cameraActive changes
  useEffect(() => {
    if (cameraActive && mediaStreamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      videoRef.current.play().catch((e) => console.warn('Play sync error:', e));
    }
  }, [cameraActive]);

  // Start Camera
  const startCamera = async (targetDeviceId?: string) => {
    setPermissionError(null);
    setCameraStatus('Requesting Camera Access…');
    stopCameraStream();

    const devId = targetDeviceId || selectedDeviceId;

    try {
      let stream: MediaStream | null = null;
      try {
        const constraints: MediaStreamConstraints = {
          video: devId
            ? { deviceId: { ideal: devId } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn('Specific constraints failed, falling back to basic video constraint:', firstErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Auto-play caught:', playErr);
        }
      }

      setCameraActive(true);
      setCameraStatus('Active (Connected)');
      setPermissionError(null);
      await enumerateCameras();
    } catch (err: any) {
      console.error('Camera access error:', err);
      let errorMsg = 'Could not access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission was denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera is currently in use by another application (e.g. Teams, Zoom, or another browser tab).';
      } else if (err.message) {
        errorMsg = `Camera error: ${err.message}`;
      }
      setPermissionError(errorMsg);
      setCameraStatus('Permission Denied / Error');
      setCameraActive(false);
    }
  };

  // Stop Camera & Detection
  const handleStopAll = () => {
    setDetectionActive(false);
    isDetectingRef.current = false;
    if (detectionLoopTimerRef.current) {
      clearInterval(detectionLoopTimerRef.current);
      detectionLoopTimerRef.current = null;
    }
    stopCameraStream();
    clearOverlay();
    setPeopleCount(0);
    setEstimatedWaitMinutes(null);
    api.resetWebcamState().catch(console.error);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isDetectingRef.current = false;
      if (detectionLoopTimerRef.current) {
        clearInterval(detectionLoopTimerRef.current);
        detectionLoopTimerRef.current = null;
      }
      stopCameraStream();
      api.resetWebcamState().catch(console.error);
    };
  }, [stopCameraStream]);

  // Clear overlay canvas
  const clearOverlay = () => {
    const canvas = canvasOverlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Draw detections & queue polygon zones on overlay canvas
  const drawOverlay = useCallback(
    (
      detections: any[],
      zoneList: QueueZone[],
      videoW: number,
      videoH: number
    ) => {
      const canvas = canvasOverlayRef.current;
      if (!canvas) return;

      if (canvas.width !== videoW || canvas.height !== videoH) {
        canvas.width = videoW;
        canvas.height = videoH;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Queue Zones if enabled
      if (showZonesOverlay) {
        for (const zone of zoneList) {
          if (!zone.polygon || zone.polygon.length < 3) continue;

          ctx.beginPath();
          const firstPt = zone.polygon[0];
          ctx.moveTo(firstPt[0] * videoW, firstPt[1] * videoH);

          for (let i = 1; i < zone.polygon.length; i++) {
            ctx.lineTo(zone.polygon[i][0] * videoW, zone.polygon[i][1] * videoH);
          }
          ctx.closePath();

          // Semi-transparent fill based on zone status
          const isCrowded = (zone.count || 0) > zone.target + 1;
          const fillColor = isCrowded
            ? 'rgba(239, 68, 68, 0.20)' // Red
            : (zone.count || 0) >= zone.target
            ? 'rgba(245, 158, 11, 0.18)' // Amber
            : 'rgba(6, 182, 212, 0.15)'; // Cyan/Blue

          ctx.fillStyle = fillColor;
          ctx.fill();

          ctx.lineWidth = 2;
          ctx.strokeStyle = zone.color || '#06B6D4';
          ctx.stroke();

          // Zone name badge
          const topY = Math.min(...zone.polygon.map((p) => p[1])) * videoH;
          const leftX = Math.min(...zone.polygon.map((p) => p[0])) * videoW;

          ctx.fillStyle = 'rgba(16, 27, 46, 0.85)';
          const labelText = `${zone.name}: ${zone.count || 0} in line (${zone.status || 'Short'})`;
          ctx.font = 'bold 11px monospace';
          const textMetrics = ctx.measureText(labelText);
          ctx.fillRect(leftX, Math.max(16, topY - 18), textMetrics.width + 12, 18);

          ctx.fillStyle = zone.color || '#06B6D4';
          ctx.fillText(labelText, leftX + 6, Math.max(29, topY - 5));
        }
      }

      // 2. Draw Detected Person Bounding Boxes
      for (let i = 0; i < detections.length; i++) {
        const det = detections[i];
        const [x1, y1, x2, y2] = det.bbox;
        const confPercent = Math.round((det.confidence || 0) * 100);

        // Bounding box (Amazon Orange / Cyan)
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#00C896'; // QueueIQ Emerald
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Header label badge with persistent Track ID
        const trackId = det.track_id ? ` #${det.track_id}` : ` #${i + 1}`;
        const label = `Person${trackId} (${confPercent}%)`;
        ctx.font = 'bold 11px sans-serif';
        const labelW = ctx.measureText(label).width;

        ctx.fillStyle = '#00C896';
        ctx.fillRect(x1, Math.max(0, y1 - 18), labelW + 8, 18);

        ctx.fillStyle = '#101B2E';
        ctx.fillText(label, x1 + 4, Math.max(13, y1 - 4));

        // Centroid point (Sky blue)
        if (det.center_point) {
          ctx.beginPath();
          ctx.arc(det.center_point[0], det.center_point[1], 3.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#38BDF8';
          ctx.fill();
        }

        // Ground anchor foot point (Emerald)
        if (det.foot_point) {
          ctx.beginPath();
          ctx.arc(det.foot_point[0], det.foot_point[1], 4, 0, 2 * Math.PI);
          ctx.fillStyle = '#10B981';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    },
    [showZonesOverlay]
  );

  // Single-frame capture & send to backend
  const captureAndDetect = useCallback(async () => {
    if (!videoRef.current || !canvasCaptureRef.current || isInferenceInFlightRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || video.paused || video.ended) {
      return;
    }

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    const captureCanvas = canvasCaptureRef.current;
    if (captureCanvas.width !== vw || captureCanvas.height !== vh) {
      captureCanvas.width = vw;
      captureCanvas.height = vh;
    }

    const ctx = captureCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Draw video frame to hidden canvas and encode as JPEG
    ctx.drawImage(video, 0, 0, vw, vh);
    const imageBase64 = captureCanvas.toDataURL('image/jpeg', 0.80);

    isInferenceInFlightRef.current = true;
    const cycleStart = performance.now();

    try {
      const response = await api.detectWebcamFrame(
        imageBase64,
        confThreshold,
        activeZonesRef.current,
        selectedModelTypeRef.current,
        avgServiceTimeSecRef.current,
        activeCountersRef.current
      );

      if (response && !response.error) {
        setPeopleCount(response.people_count || 0);
        setInferenceLatency(response.inference_latency_ms || 0);
        if (response.model_name) {
          setActiveModelName(response.model_name);
        }
        if (response.estimated_wait_minutes !== undefined) {
          setEstimatedWaitMinutes(response.estimated_wait_minutes);
        }
        if (response.wait_time_explanation) {
          setWaitTimeExplanation(response.wait_time_explanation);
        }

        // Update processing FPS
        const elapsedSec = (performance.now() - cycleStart) / 1000;
        const instantaneousFps = elapsedSec > 0 ? Math.min(30, 1.0 / elapsedSec) : 0;
        setActualFps(parseFloat(instantaneousFps.toFixed(1)));

        // Update zone counts & recommendations
        if (Array.isArray(response.zones)) {
          setZones(response.zones);
        }
        if (Array.isArray(response.recommendations)) {
          setRecommendations(response.recommendations);
        }
        if (response.limitation_notice) {
          setLimitationNotice(response.limitation_notice);
        }

        // Render visual overlay
        drawOverlay(response.detections || [], response.zones || activeZonesRef.current, vw, vh);
      }
    } catch (err) {
      console.warn('Webcam detection request failed:', err);
    } finally {
      isInferenceInFlightRef.current = false;
      lastDetectionTimestampRef.current = Date.now();
    }
  }, [confThreshold, drawOverlay]);

  // Detection loop manager - strictly clear previous timer to prevent overlapping loops
  useEffect(() => {
    isDetectingRef.current = detectionActive && cameraActive;

    if (detectionLoopTimerRef.current) {
      clearInterval(detectionLoopTimerRef.current);
      detectionLoopTimerRef.current = null;
    }

    if (detectionActive && cameraActive) {
      detectionLoopTimerRef.current = setInterval(() => {
        if (isDetectingRef.current && !isInferenceInFlightRef.current) {
          captureAndDetect();
        }
      }, samplingIntervalMs);
    } else {
      clearOverlay();
    }

    return () => {
      if (detectionLoopTimerRef.current) {
        clearInterval(detectionLoopTimerRef.current);
        detectionLoopTimerRef.current = null;
      }
    };
  }, [detectionActive, cameraActive, samplingIntervalMs, captureAndDetect]);

  // Zone management helpers
  const handleUpdateZoneTarget = (zoneId: string, newTarget: number) => {
    setZones((prev) =>
      prev.map((z) => (z.id === zoneId ? { ...z, target: Math.max(1, newTarget) } : z))
    );
  };

  const handleUpdateZoneName = (zoneId: string, newName: string) => {
    setZones((prev) =>
      prev.map((z) => (z.id === zoneId ? { ...z, name: newName } : z))
    );
  };

  const handleRemoveZone = (zoneId: string) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
  };

  const handleAddZone = () => {
    const newId = `zone-${Date.now()}`;
    const newZone: QueueZone = {
      id: newId,
      name: `Checkout ${zones.length + 1}`,
      target: 3,
      color: '#10B981',
      polygon: [
        [0.20, 0.40],
        [0.50, 0.40],
        [0.50, 0.90],
        [0.20, 0.90],
      ],
      count: 0,
      status: 'Short',
    };
    setZones((prev) => [...prev, newZone]);
  };

  const handleResetZones = () => {
    setZones(DEFAULT_ZONES);
  };

  // Compute total queue count across all zones
  const totalQueueWaiters = zones.reduce((acc, z) => acc + (z.count || 0), 0);
  const overallQueueStatus =
    zones.some((z) => z.status === 'Long')
      ? 'Long'
      : zones.some((z) => z.status === 'Moderate')
      ? 'Moderate'
      : 'Short';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Hidden canvas for video frame extraction */}
      <canvas ref={canvasCaptureRef} className="hidden" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-glow">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
                  Live Webcam People Detection & Queue Optimization
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-success/20 text-success border border-success/30 font-semibold flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-success inline" />
                  <span>{activeModelName}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time browser webcam stream with local CPU neural network inference, polygon queue zone counting, and automated dispatch optimization.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {!cameraActive ? (
            <button
              onClick={() => startCamera()}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-all shadow-glow"
            >
              <Camera className="w-4 h-4" />
              <span>Start Camera</span>
            </button>
          ) : (
            <button
              onClick={handleStopAll}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-danger text-white hover:bg-danger/90 transition-all shadow-card"
            >
              <VideoOff className="w-4 h-4" />
              <span>Stop Camera</span>
            </button>
          )}

          {cameraActive && (
            <button
              onClick={() => setDetectionActive(!detectionActive)}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                detectionActive
                  ? 'bg-accent text-background shadow-glow-amber'
                  : 'bg-surface-elevated border border-border text-slate-200 hover:text-white'
              }`}
            >
              {detectionActive ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{detectionActive ? 'Stop Detection' : 'Start Detection'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Permission / Hardware Error Notice */}
      {permissionError && (
        <div className="p-4 rounded-2xl bg-danger/10 border border-danger/30 text-xs text-danger-light flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
          <div className="flex-1">
            <strong className="font-semibold block text-white">Camera Connection Alert:</strong>
            <span>{permissionError}</span>
          </div>
          <button
            onClick={startCamera}
            className="px-3 py-1.5 rounded-lg bg-danger text-white font-semibold text-xs hover:bg-danger/90"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top Telemetry & Diagnostics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total People in View */}
        <div className="p-4 rounded-2xl bg-surface-card border border-border shadow-card space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">People Detected</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white font-heading">
              {detectionActive && cameraActive ? peopleCount : '—'}
            </span>
            <span className="text-xs text-primary font-medium">in frame</span>
          </div>
          <span className="text-[10px] text-slate-400 block">
            Classified from valid person bounding boxes
          </span>
        </div>

        {/* Estimated Queue Waiting Count */}
        <div className="p-4 rounded-2xl bg-surface-card border border-border shadow-card space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Queue Line Waiters</span>
            <Store className="w-4 h-4 text-accent" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white font-heading">
              {detectionActive && cameraActive ? totalQueueWaiters : '—'}
            </span>
            <span className="text-xs text-accent font-medium">in registers</span>
          </div>
          <span className="text-[10px] text-slate-400 block">
            Customers inside configured polygon zones
          </span>
        </div>

        {/* Estimated Wait Time (Real, Explainable Formula) */}
        <div className="p-4 rounded-2xl bg-surface-card border border-border shadow-card space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Estimated Wait</span>
            <Clock className="w-4 h-4 text-accent" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white font-heading">
              {detectionActive && cameraActive && estimatedWaitMinutes !== null
                ? `~${estimatedWaitMinutes}m`
                : '—'}
            </span>
            <span className="text-xs text-accent font-medium">approx</span>
          </div>
          <span className="text-[10px] text-slate-400 block truncate" title={waitTimeExplanation}>
            {detectionActive && cameraActive
              ? `~${avgServiceTimeSec}s/shopper • ${activeCounters} register(s)`
              : 'Standby (Camera Inactive)'}
          </span>
        </div>

        {/* Processing Performance */}
        <div className="p-4 rounded-2xl bg-surface-card border border-border shadow-card space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Inference Performance</span>
            <Zap className="w-4 h-4 text-success" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-success font-heading">
              {detectionActive && inferenceLatency > 0 ? `${inferenceLatency.toFixed(0)}` : '—'}
            </span>
            <span className="text-xs text-slate-400 font-mono">ms latency</span>
          </div>
          <span className="text-[10px] text-slate-400 block font-mono">
            {detectionActive ? `${actualFps} FPS actual throughput` : 'Awaiting stream'}
          </span>
        </div>

        {/* Overall Queue Flow State */}
        <div className="p-4 rounded-2xl bg-surface-card border border-border shadow-card space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Overall Congestion</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span
              className={`text-2xl font-extrabold font-heading ${
                overallQueueStatus === 'Long'
                  ? 'text-danger'
                  : overallQueueStatus === 'Moderate'
                  ? 'text-accent'
                  : 'text-success'
              }`}
            >
              {detectionActive && cameraActive ? overallQueueStatus : 'Standby'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block">
            Across {zones.length} active register zones
          </span>
        </div>
      </div>

      {/* Main Grid: Video Stream (Left) + Queue Zones Configuration & Recommendations (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Video Preview Canvas */}
        <div className="lg:col-span-2 rounded-2xl bg-surface-card border border-border overflow-hidden shadow-card flex flex-col">
          {/* Top Canvas Bar */}
          <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-surface/50">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
              <span className="font-heading font-bold text-sm text-white">
                Live Camera Feed
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-slate-300">
                {cameraStatus}
              </span>
            </div>

            {/* Camera Selector Dropdown */}
            {cameraDevices.length > 1 && (
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400 font-semibold">Camera:</span>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedDeviceId(newId);
                    if (cameraActive) startCamera(newId);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-border text-white text-xs font-mono focus:outline-none focus:border-primary"
                >
                  {cameraDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Video Container with Overlaid Canvas */}
          <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
            {/* Camera Offline Placeholder Overlay */}
            {!cameraActive && (
              <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center text-slate-500">
                  <Camera className="w-8 h-8 opacity-60" />
                </div>
                <h3 className="font-heading font-bold text-base text-white">
                  Camera Currently Offline
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Click <strong>Start Camera</strong> above to enable your laptop webcam for real-time customer detection and queue zone optimization.
                </p>
                <button
                  onClick={() => startCamera()}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition-all shadow-glow"
                >
                  Enable Webcam
                </button>
              </div>
            )}

            {/* HTML5 Live Video Element & Pixel-Locked Overlaid Canvas */}
            <div className="relative max-w-full max-h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => {
                  videoRef.current?.play().catch((e) => console.warn('Play on loaded metadata error:', e));
                }}
                className="max-w-full max-h-full block object-contain"
                style={{ maxHeight: '100%', maxWidth: '100%' }}
              />

              {/* Overlaid Canvas for Real-Time Bounding Boxes & Queue Zones - ALWAYS Mounted & 100% Locked */}
              <canvas
                ref={canvasOverlayRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />
            </div>

            {/* Detection Inactive Banner */}
            {cameraActive && !detectionActive && (
              <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-border text-[11px] text-slate-300 backdrop-blur-sm">
                Camera streaming • Click <strong>Start Detection</strong> to run YOLO detection
              </div>
            )}
          </div>

          {/* Bottom Video Controls & Sliders */}
          <div className="p-4 bg-surface border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs">
            {/* AI Model Selector */}
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-success" />
              <span className="text-slate-400 font-semibold text-[11px]">AI Model:</span>
              <select
                value={selectedModelType}
                onChange={(e) => {
                  const mType = e.target.value;
                  setSelectedModelType(mType);
                  api.switchWebcamModel(mType).then((res) => {
                    if (res?.model_name) setActiveModelName(res.model_name);
                  }).catch(console.error);
                }}
                className="px-2.5 py-1 rounded-lg bg-surface-card border border-border text-white text-xs font-mono focus:outline-none focus:border-primary"
              >
                <option value="pretrained">YOLOv8 COCO Person (Recommended for Laptop Webcam)</option>
                <option value="auto">Auto-Adaptive (COCO + QueueIQ)</option>
                <option value="custom">QueueIQ best.pt (Trained Pedestrian Model)</option>
              </select>
            </div>

            {/* Avg Service Time Selector */}
            <div className="flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span className="text-slate-400 font-semibold text-[11px]">Service Time:</span>
              <select
                value={avgServiceTimeSec}
                onChange={(e) => setAvgServiceTimeSec(parseInt(e.target.value))}
                className="px-2 py-1 rounded-lg bg-surface-card border border-border text-white text-xs font-mono"
              >
                <option value={45}>45s (Fast Scan)</option>
                <option value={60}>60s (Express Lane)</option>
                <option value={90}>90s (Standard Supermarket)</option>
                <option value={120}>120s (Busy/Heavy Cart)</option>
                <option value={180}>180s (Full Bulk Cart)</option>
              </select>
            </div>

            {/* Active Checkout Registers */}
            <div className="flex items-center space-x-2">
              <Store className="w-3.5 h-3.5 text-primary" />
              <span className="text-slate-400 font-semibold text-[11px]">Counters:</span>
              <select
                value={activeCounters}
                onChange={(e) => setActiveCounters(parseInt(e.target.value))}
                className="px-2 py-1 rounded-lg bg-surface-card border border-border text-white text-xs font-mono"
              >
                <option value={1}>1 Active Counter</option>
                <option value={2}>2 Active Counters</option>
                <option value={3}>3 Active Counters</option>
                <option value={4}>4 Active Counters</option>
                <option value={5}>5 Active Counters</option>
              </select>
            </div>

            {/* Confidence Threshold */}
            <div className="flex items-center space-x-2.5">
              <Sliders className="w-3.5 h-3.5 text-accent" />
              <span className="text-slate-400 font-semibold text-[11px]">Confidence:</span>
              <input
                type="range"
                min="0.20"
                max="0.80"
                step="0.05"
                value={confThreshold}
                onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                className="w-20 accent-primary h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-white text-xs font-bold w-9">
                {(confThreshold * 100).toFixed(0)}%
              </span>
            </div>

            {/* Frame Sampling Interval */}
            <div className="flex items-center space-x-2.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-slate-400 font-semibold text-[11px]">Sampling:</span>
              <select
                value={samplingIntervalMs}
                onChange={(e) => setSamplingIntervalMs(parseInt(e.target.value))}
                className="px-2 py-1 rounded-lg bg-surface-card border border-border text-white text-xs font-mono"
              >
                <option value={150}>150 ms (High ~6 FPS)</option>
                <option value={250}>250 ms (Balanced ~4 FPS)</option>
                <option value={400}>400 ms (CPU Friendly ~2.5 FPS)</option>
                <option value={700}>700 ms (Low ~1.4 FPS)</option>
              </select>
            </div>

            {/* Toggle Overlay Zones */}
            <button
              onClick={() => setShowZonesOverlay(!showZonesOverlay)}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-surface-card border border-border text-slate-300 hover:text-white transition-all"
            >
              {showZonesOverlay ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
              <span>{showZonesOverlay ? 'Hide Zones' : 'Show Zones'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Queue Zones Configuration & Live Optimization Recommendations */}
        <div className="space-y-4">
          {/* Queue Zones Panel */}
          <div className="p-5 rounded-2xl bg-surface-card border border-border shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Store className="w-4 h-4 text-accent" />
                <h3 className="font-heading font-bold text-sm text-white">
                  Configured Queue Zones
                </h3>
              </div>
              <button
                onClick={handleAddZone}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span>Add Zone</span>
              </button>
            </div>

            {/* Zones List */}
            <div className="space-y-2.5">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="p-3.5 rounded-xl bg-surface border border-border space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: zone.color }}
                      />
                      <input
                        type="text"
                        value={zone.name}
                        onChange={(e) => handleUpdateZoneName(zone.id, e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-primary text-white font-medium text-xs focus:outline-none px-1"
                      />
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        zone.status === 'Long'
                          ? 'bg-danger/20 text-danger border border-danger/30'
                          : zone.status === 'Moderate'
                          ? 'bg-accent/20 text-accent border border-accent/30'
                          : 'bg-success/20 text-success border border-success/30'
                      }`}
                    >
                      {zone.status || 'Short'}
                    </span>
                  </div>

                  {/* Zone Occupancy Count, Estimated Wait & Target Stepper */}
                  <div className="flex flex-wrap items-center justify-between pt-1 border-t border-border/50 text-[11px] gap-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400">Occupancy:</span>
                      <strong className="text-white font-mono text-xs">
                        {zone.count || 0}
                      </strong>
                      <span className="text-slate-500">ppl</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-accent font-mono text-[10px]">
                        ~{(((zone.count || 0) * avgServiceTimeSec) / 60.0).toFixed(1)}m wait
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400">Target:</span>
                      <button
                        onClick={() => handleUpdateZoneTarget(zone.id, zone.target - 1)}
                        className="w-5 h-5 rounded bg-surface-card border border-border flex items-center justify-center text-slate-300 hover:text-white"
                      >
                        -
                      </button>
                      <span className="font-mono text-white font-bold w-4 text-center">
                        {zone.target}
                      </span>
                      <button
                        onClick={() => handleUpdateZoneTarget(zone.id, zone.target + 1)}
                        className="w-5 h-5 rounded bg-surface-card border border-border flex items-center justify-center text-slate-300 hover:text-white"
                      >
                        +
                      </button>

                      {zones.length > 1 && (
                        <button
                          onClick={() => handleRemoveZone(zone.id)}
                          title="Remove Zone"
                          className="text-slate-500 hover:text-danger ml-1 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleResetZones}
              className="text-[11px] text-slate-400 hover:text-primary transition-colors flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to default supermarket registers</span>
            </button>
          </div>

          {/* AI Queue Optimization Recommendations Card */}
          <div className="p-5 rounded-2xl bg-surface-card border border-border shadow-card space-y-3.5">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-heading font-bold text-sm text-white">
                Queue Dispatch Recommendations
              </h3>
            </div>

            {/* Waiting Time Formula Calculation Box */}
            <div className="p-3 rounded-xl bg-surface border border-accent/30 text-[11px] text-slate-200 space-y-1">
              <div className="flex items-center space-x-1.5 text-accent font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span>Waiting Time Estimate Breakdown</span>
              </div>
              <p className="text-slate-300 font-mono text-[10px]">
                {detectionActive && cameraActive
                  ? waitTimeExplanation
                  : `Formula: Wait = customers ahead (${totalQueueWaiters}) × ${avgServiceTimeSec}s ÷ (${activeCounters} counters × 60s) = ~${estimatedWaitMinutes ?? 0}m.`}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-slate-200 leading-relaxed"
                >
                  <p>{rec}</p>
                </div>
              ))}
            </div>

            {/* Honest Limitation Notice */}
            <div className="p-3 rounded-xl bg-surface border border-border/70 text-[11px] text-slate-400 leading-snug">
              <span className="font-semibold text-slate-300 block mb-0.5">Real-world Limitations:</span>
              <span>{limitationNotice}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
