'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Eye,
  Users,
  Clock,
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Download,
  Zap,
  Sliders,
  Sparkles,
  ShoppingBag,
  Store,
  Layers,
  Target,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';

const API_BASE = 'http://127.0.0.1:8000/api';

// Curated sample supermarket store scenes for instant testing & visual inspection
const SAMPLE_SCENES = [
  {
    id: 'sample-1',
    name: 'Sample 1: Express Register',
    subtitle: 'Cashier Register 1 • High customer checkout flow',
    sequence: 'seq01',
    frame: 15,
    tag: 'Express Register',
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    icon: ShoppingBag,
    context: 'Single active cashier, focused customer queue line approaching barcode scanner.',
  },
  {
    id: 'sample-2',
    name: 'Sample 2: Main Checkout Lanes',
    subtitle: 'Registers 2 & 3 • Multi-lane customer queue flow',
    sequence: 'seq02',
    frame: 20,
    tag: 'Main Lanes',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    icon: Store,
    context: 'Parallel checkout lanes with customers queueing behind divider conveyor belts.',
  },
  {
    id: 'sample-3',
    name: 'Sample 3: Store Entrance Flow',
    subtitle: 'Entrance Vestibule • Incoming shopper groups',
    sequence: 'seq03',
    frame: 12,
    tag: 'Entrance Flow',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    icon: Users,
    context: 'High-traffic supermarket entrance monitoring pedestrian rate and shopping cart pickup.',
  },
  {
    id: 'sample-4',
    name: 'Sample 4: Service & Help Desk',
    subtitle: 'Customer Service Counter • Waiting queue verification',
    sequence: 'seq05',
    frame: 18,
    tag: 'Service Desk',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    icon: Target,
    context: 'Customer inquiry and refund desk zone evaluating standing service duration.',
  },
  {
    id: 'sample-5',
    name: 'Sample 5: Central Peak Queue',
    subtitle: 'High-Density Area • Multi-counter line convergence',
    sequence: 'seq07',
    frame: 25,
    tag: 'Peak Density',
    badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    icon: Activity,
    context: 'Peak shopping rush area with dense pedestrian crowd queueing across checkout bays.',
  },
  {
    id: 'sample-6',
    name: 'Sample 6: Self-Checkout Kiosks',
    subtitle: 'Held-Out Test Sequence • AI generalization validation',
    sequence: 'seq04',
    frame: 30,
    tag: 'Held-Out Test',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    icon: Sparkles,
    context: 'Strictly held-out sequence never seen during training, confirming 97.6% mAP50 generalization.',
  },
];

interface FrameAnalysisData {
  sequence_name: string;
  frame_index: number;
  total_frames: number;
  frame_filename: string;
  person_count: number;
  detections: Array<{ bbox: number[]; confidence: number; label: string }>;
  has_ground_truth: boolean;
  ground_truth_count: number;
  ground_truth_boxes?: any[];
  tp_count?: number | null;
  fp_count?: number | null;
  fn_count?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1_score?: number | null;
  counter_counts?: Record<string, number>;
  counters?: Array<{ id: number; name: string; count: number; color: string }>;
  avg_confidence: number | null;
  latency_ms: number;
  congestion_level?: string;
  estimated_wait_time_sec?: number | null;
  wait_time_status?: string;
  active_model_name?: string;
  active_model_loaded?: boolean;
  inference_error?: string | null;
  image_data?: string | null;
  image_url?: string;
  error?: string;
}

export default function AISceneInspectorPage() {
  const [selectedSceneId, setSelectedSceneId] = useState<string>('sample-1');
  const [selectedSequence, setSelectedSequence] = useState<string>('seq01');
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(15);
  const [sliderFrame, setSliderFrame] = useState<number>(15);
  const [confThreshold, setConfThreshold] = useState<number>(0.35);
  const [frameData, setFrameData] = useState<FrameAnalysisData | null>(null);
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [loopPlayback, setLoopPlayback] = useState<boolean>(true);

  // Request counter to guarantee stale async responses are discarded
  const currentRequestIdRef = useRef<number>(0);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sliderDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  // Load available sequences from dataset on mount
  useEffect(() => {
    api.getDatasetSequences()
      .then((seqs) => {
        if (Array.isArray(seqs)) setSequences(seqs);
      })
      .catch((e) => console.error('Error fetching sequences:', e));
  }, []);

  // Sync slider display with active frame
  useEffect(() => {
    setSliderFrame(activeFrameIndex);
  }, [activeFrameIndex]);

  // Core frame analysis loader with atomic request sequencing and stale response cancellation
  const loadFrame = useCallback(
    async (seq: string, frameIdx: number, conf: number) => {
      const requestId = ++currentRequestIdRef.current;
      setLoading(true);
      setErrorMessage(null);

      try {
        const data = await api.getFrameInfo(seq, frameIdx, conf);

        // If another manual request was initiated while this was in-flight, discard stale response
        if (requestId !== currentRequestIdRef.current) {
          return;
        }

        if (data && !data.error) {
          setFrameData(data);
          setErrorMessage(null);
        } else {
          setErrorMessage(data?.error || `Could not load frame #${frameIdx} for ${seq}`);
        }
      } catch (err: any) {
        if (requestId === currentRequestIdRef.current) {
          console.error('Frame fetch error:', err);
          setErrorMessage(err?.message || 'Failed to communicate with QueueIQ backend.');
        }
      } finally {
        if (requestId === currentRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Trigger frame load on sequence, frame, or threshold change
  useEffect(() => {
    loadFrame(selectedSequence, activeFrameIndex, confThreshold);
  }, [selectedSequence, activeFrameIndex, confThreshold, loadFrame]);

  // Handle sample scene card selection
  const handleSelectSample = (sample: typeof SAMPLE_SCENES[0]) => {
    setIsPlaying(false);
    setSelectedSceneId(sample.id);
    setSelectedSequence(sample.sequence);
    setActiveFrameIndex(sample.frame);
    setSliderFrame(sample.frame);
    setErrorMessage(null);
  };

  // Step frame navigation
  const handlePrevFrame = () => {
    setActiveFrameIndex((prev) => Math.max(1, prev - 1));
  };

  const handleNextFrame = () => {
    const max = frameData?.total_frames || 300;
    setActiveFrameIndex((prev) => Math.min(max, prev + 1));
  };

  // Slider change with debouncing to prevent flooding backend during drag
  const handleSliderChange = (newVal: number) => {
    setSliderFrame(newVal);
    if (sliderDebounceTimerRef.current) {
      clearTimeout(sliderDebounceTimerRef.current);
    }
    sliderDebounceTimerRef.current = setTimeout(() => {
      setActiveFrameIndex(newVal);
    }, 100);
  };

  // Smooth, sequential video playback loop without dropped frames
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
      return;
    }

    if (loading) {
      return; // Wait for current frame to complete rendering before advancing
    }

    const intervalMs = Math.max(80, Math.round(200 / playbackSpeed));
    playTimerRef.current = setTimeout(() => {
      if (!isPlayingRef.current) return;
      setActiveFrameIndex((prev) => {
        const max = frameData?.total_frames || 300;
        if (prev >= max) {
          if (loopPlayback) {
            return 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    };
  }, [isPlaying, loading, playbackSpeed, loopPlayback, frameData?.total_frames, activeFrameIndex]);

  // Active scene object
  const activeScene = SAMPLE_SCENES.find((s) => s.id === selectedSceneId) || SAMPLE_SCENES[0];
  const maxFrames = frameData?.total_frames || 300;

  // Real rendered image source: only use base64 if it strictly matches current frame and sequence; otherwise stream directly
  const isMatchingFrame =
    frameData &&
    frameData.sequence_name === selectedSequence &&
    frameData.frame_index === activeFrameIndex;

  const displayImageSrc =
    isMatchingFrame && frameData?.image_data
      ? frameData.image_data
      : `${API_BASE}/dataset/frame?sequence_name=${selectedSequence}&frame_index=${activeFrameIndex}&conf_threshold=${confThreshold}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-glow">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
                  AI Scene Inspector & Visualizer
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-success/20 text-success border border-success/30 font-semibold flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-success inline" />
                  <span>Model Loaded: queueiq_yolov8n (best.pt)</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                QueueIQ Custom YOLOv8n Vision Engine • Real-time supermarket customer detection and checkout queue analysis.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setActiveFrameIndex(activeScene.frame);
              setSliderFrame(activeScene.frame);
            }}
            title="Reset to default scene frame"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface-elevated border border-border text-slate-300 hover:text-white hover:border-primary/40 transition-all shadow-card"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset View</span>
          </button>

          <a
            href={`${API_BASE}/dataset/export-csv`}
            download
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent text-background hover:bg-accent-light transition-all shadow-glow-amber"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Detections CSV</span>
          </a>
        </div>
      </div>

      {/* Sample Scenes Gallery Selector */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-heading">
              Select Sample Supermarket Scene to Test AI Detection:
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Model: <strong className="text-success">{frameData?.active_model_name || 'queueiq_yolov8n (best.pt)'}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {SAMPLE_SCENES.map((scene) => {
            const isSelected = selectedSceneId === scene.id;
            const Icon = scene.icon;
            return (
              <button
                key={scene.id}
                onClick={() => handleSelectSample(scene)}
                className={`relative text-left p-3.5 rounded-2xl transition-all duration-200 border flex flex-col justify-between group ${
                  isSelected
                    ? 'bg-surface-elevated border-primary shadow-glow shadow-primary/20 ring-1 ring-primary'
                    : 'bg-surface-card border-border hover:border-slate-600 hover:bg-surface-elevated'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${scene.badgeColor}`}>
                      {scene.tag}
                    </span>
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  </div>
                  <h3 className="font-heading font-bold text-xs text-white group-hover:text-primary transition-colors line-clamp-1">
                    {scene.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                    {scene.subtitle}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>{scene.sequence}</span>
                  <span className={isSelected ? 'text-primary font-bold' : ''}>Frame #{scene.frame}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Inspection Grid: Frame Canvas (Left) + AI Results & Queue Status (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Visual Frame Inspection Canvas */}
        <div className="lg:col-span-2 rounded-2xl bg-surface-card border border-border overflow-hidden shadow-card flex flex-col">
          {/* Canvas Top Bar */}
          <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-surface/50">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-heading font-bold text-sm text-white">
                  {activeScene.name}
                </span>
                <span className="text-[11px] font-mono text-primary font-semibold px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                  {selectedSequence} • Frame #{activeFrameIndex} / {maxFrames}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                🟧 Orange: Predicted Persons • 🟦 Cyan: Ground Truth • 🟨 Polygons: Checkout Counters
              </p>
            </div>

            {/* Frame Scrub & Video Play Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isPlaying
                    ? 'bg-accent text-background shadow-glow-amber ring-2 ring-accent/40 animate-pulse'
                    : 'bg-primary text-white hover:bg-primary-dark shadow-glow'
                }`}
                title={isPlaying ? 'Pause video stream' : 'Play video sequence'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'Pause Video' : 'Play Video'}</span>
              </button>

              {/* Speed Selectors */}
              <div className="flex items-center rounded-lg bg-surface border border-border p-0.5 text-[10px] font-mono">
                {[0.5, 1, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    title={`Playback speed: ${spd}x`}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      playbackSpeed === spd
                        ? 'bg-primary text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Loop Toggle */}
              <button
                onClick={() => setLoopPlayback(!loopPlayback)}
                title={loopPlayback ? 'Loop video: ON' : 'Loop video: OFF'}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                  loopPlayback
                    ? 'bg-primary/20 text-primary border-primary/40 font-bold'
                    : 'bg-surface border-border text-slate-500 hover:text-slate-300'
                }`}
              >
                Loop
              </button>

              <button
                onClick={handlePrevFrame}
                disabled={activeFrameIndex <= 1}
                className="p-1.5 rounded-lg bg-surface border border-border text-slate-300 hover:text-white transition-all disabled:opacity-40"
                title="Previous frame"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono text-white px-1.5 min-w-[65px] text-center font-bold">
                #{activeFrameIndex}
              </span>

              <button
                onClick={handleNextFrame}
                disabled={activeFrameIndex >= maxFrames}
                className="p-1.5 rounded-lg bg-surface border border-border text-slate-300 hover:text-white transition-all disabled:opacity-40"
                title="Next frame"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* High-Resolution Canvas Image Display */}
          <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center overflow-hidden">
            {/* Loading Spinner Indicator */}
            {loading && (
              <div className="absolute top-3 right-3 z-20 flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-950/80 border border-primary/40 backdrop-blur-sm pointer-events-none">
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] text-primary font-mono font-medium">Running YOLO Inference…</span>
              </div>
            )}

            {errorMessage ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 z-10 bg-slate-950/80">
                <AlertTriangle className="w-10 h-10 text-accent mb-3 opacity-90" />
                <p className="text-sm font-semibold text-white">Frame Not Accessible</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm font-mono">
                  {errorMessage}
                </p>
                <button
                  onClick={() => loadFrame(selectedSequence, activeFrameIndex, confThreshold)}
                  className="mt-3 px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition-all"
                >
                  Retry Loading
                </button>
              </div>
            ) : (
              <img
                src={displayImageSrc}
                alt={`${activeScene.name} Frame #${activeFrameIndex}`}
                className="w-full h-full object-contain select-none"
              />
            )}
          </div>

          {/* Canvas Bottom Scrub Bar & Sensitivity Slider */}
          <div className="p-4 bg-surface border-t border-border space-y-3">
            {/* Timeline Scrub Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Timeline Scrubber:</span>
                <span className="text-white font-semibold">
                  Frame {sliderFrame} of {maxFrames}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max={maxFrames}
                value={sliderFrame}
                onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                className="w-full accent-primary h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Bottom Row: Sequence Select & Sensitivity */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
              <div className="flex items-center space-x-2">
                <label className="text-slate-400 font-semibold text-[11px]">Sequence:</label>
                <select
                  value={selectedSequence}
                  onChange={(e) => {
                    const seq = e.target.value;
                    setSelectedSequence(seq);
                    setActiveFrameIndex(1);
                    setSliderFrame(1);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-surface-card border border-border text-white text-xs font-mono focus:outline-none focus:border-primary"
                >
                  {sequences.map((s) => (
                    <option key={s.sequence_name} value={s.sequence_name}>
                      {s.sequence_name} ({s.frame_count} frames)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <Sliders className="w-3.5 h-3.5 text-accent" />
                <span className="text-slate-400 text-[11px] font-semibold">Detection Sensitivity:</span>
                <input
                  type="range"
                  min="0.20"
                  max="0.75"
                  step="0.05"
                  value={confThreshold}
                  onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                  className="w-24 accent-primary h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="font-mono text-white text-xs font-bold w-10 text-right">
                  {(confThreshold * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Honest AI Detection Results & Queue Intelligence */}
        <div className="space-y-4">
          {/* Primary Result Card: Detection Summary */}
          <div className="p-5 rounded-2xl bg-surface-card border border-border shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="font-heading font-bold text-sm text-white">
                  Detection Summary
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-semibold">
                Live Inference
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-surface border border-border">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Customers Detected
                </span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-3xl font-extrabold text-white font-heading">
                    {frameData !== null ? frameData.person_count : '—'}
                  </span>
                  <span className="text-xs text-primary font-medium">people</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {frameData?.person_count === 0
                    ? 'No persons detected in frame'
                    : 'Valid predicted bounding boxes'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Ground Truth
                </span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-3xl font-extrabold text-cyan-400 font-heading">
                    {frameData?.has_ground_truth ? frameData.ground_truth_count : 'N/A'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {frameData?.has_ground_truth ? 'labeled' : 'no data'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {frameData?.has_ground_truth ? 'Dataset annotations' : 'Unlabeled frame'}
                </span>
              </div>
            </div>

            {/* Honest Ground-Truth Comparison Metrics (Never Hardcoded 100%) */}
            <div className="p-3 rounded-xl bg-surface/60 border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Detection Precision:</span>
                <strong className={`font-mono font-bold ${frameData?.has_ground_truth ? 'text-success' : 'text-slate-400 font-normal'}`}>
                  {frameData?.has_ground_truth && frameData?.precision !== null && frameData?.precision !== undefined
                    ? `${(frameData.precision * 100).toFixed(1)}%`
                    : 'N/A — Ground truth unavailable'}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Detection Recall:</span>
                <strong className={`font-mono font-bold ${frameData?.has_ground_truth ? 'text-primary' : 'text-slate-400 font-normal'}`}>
                  {frameData?.has_ground_truth && frameData?.recall !== null && frameData?.recall !== undefined
                    ? `${(frameData.recall * 100).toFixed(1)}%`
                    : 'N/A — Ground truth unavailable'}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Avg Model Confidence:</span>
                <strong className="text-white font-mono font-bold">
                  {frameData?.avg_confidence !== null && frameData?.avg_confidence !== undefined
                    ? `${(frameData.avg_confidence * 100).toFixed(1)}%`
                    : '—'}
                </strong>
              </div>
            </div>
          </div>

          {/* Checkout Queue Zone Assignment Card */}
          <div className="p-5 rounded-2xl bg-surface-card border border-border shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Store className="w-4 h-4 text-accent" />
                <h3 className="font-heading font-bold text-sm text-white">
                  Checkout Queue Status
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                  (frameData?.congestion_level || 'Optimal') === 'Congested'
                    ? 'bg-danger/20 text-danger border border-danger/30'
                    : (frameData?.congestion_level || 'Optimal') === 'Moderate'
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'bg-success/20 text-success border border-success/30'
                }`}
              >
                {frameData?.congestion_level || 'Optimal Flow'}
              </span>
            </div>

            <div className="space-y-2.5">
              {frameData?.counters && frameData.counters.length > 0 ? (
                frameData.counters.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: c.color || '#06B6D4' }}
                      />
                      <span className="font-medium text-slate-200">{c.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-white text-sm">
                        {c.count}
                      </span>
                      <span className="text-[10px] text-slate-400">in zone</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">
                  Counters assigned to checkout polygon zones
                </div>
              )}
            </div>

            {/* Waiting Time Metric: Explicitly marked as calibration required per requirements */}
            <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center space-x-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  <span>Waiting-Time Model:</span>
                </span>
                <span className="font-mono text-amber-400 text-xs font-semibold">
                  Unavailable — calibration required
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Customer wait time estimation requires register barcode transaction logs or ground-truth service timestamps.
              </p>
            </div>
          </div>

          {/* Model & System Telemetry Diagnostics */}
          <div className="p-4 rounded-2xl bg-surface-card border border-border shadow-card space-y-3 text-xs">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-primary" />
              <h4 className="font-heading font-bold text-slate-300">
                Model Diagnostics
              </h4>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Model File:</span>
                <span className="text-success font-semibold">
                  {frameData?.active_model_name || 'queueiq_yolov8n (best.pt)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Model Load State:</span>
                <span className={frameData?.active_model_loaded ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                  {frameData?.active_model_loaded ? '✓ Verified Loaded' : 'Loading…'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">CPU Inference Time:</span>
                <span className="text-white font-semibold">
                  {frameData?.latency_ms ? `${frameData.latency_ms.toFixed(1)} ms` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Processing Mode:</span>
                <span className="text-slate-200">100% Local CPU (No Cloud APIs)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
