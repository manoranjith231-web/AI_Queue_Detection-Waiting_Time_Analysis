'use client';

import React, { useEffect, useState } from 'react';
import { Camera, Cpu, Activity, User, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface NavbarProps {
  isSimulated?: boolean;
  fps?: number;
  latency?: number;
  cameraStatus?: string;
  modelStatus?: string;
  onToggleDemo?: () => void;
}

export default function Navbar({
  isSimulated = true,
  fps = 15.0,
  latency = 65,
  cameraStatus = 'Demo Mode',
  modelStatus = 'YOLOv8n (CPU)',
  onToggleDemo,
}: NavbarProps) {
  const [userName, setUserName] = useState<string>('Store Operations Manager');

  useEffect(() => {
    const saved = localStorage.getItem('queueiq_user_name');
    if (saved) setUserName(saved);
  }, []);

  return (
    <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
      {/* Brand & Store Identity */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
          <Activity className="w-5 h-5 text-background" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-heading font-bold text-lg tracking-tight text-white">
              QueueIQ<span className="text-primary font-normal">.AI</span>
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              v1.0 Free Edition
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans">HyperMarket Mart (Branch #104)</p>
        </div>
      </div>

      {/* Live Hardware Telemetry Chips */}
      <div className="hidden md:flex items-center space-x-3 text-xs font-mono">
        {/* Model Chip */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-card border border-border">
          <Cpu className="w-3.5 h-3.5 text-accent" />
          <span className="text-slate-400">Engine:</span>
          <span className="text-slate-200 font-medium">{modelStatus}</span>
        </div>

        {/* Camera / Stream Chip */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-card border border-border">
          <Camera className={`w-3.5 h-3.5 ${isSimulated ? 'text-warning' : 'text-success'}`} />
          <span className="text-slate-400">Source:</span>
          <span className={isSimulated ? 'text-warning' : 'text-success'}>{cameraStatus}</span>
        </div>

        {/* FPS & Latency */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface-card border border-border text-slate-300">
          <span>{fps.toFixed(1)} FPS</span>
          <span className="text-border">|</span>
          <span>{latency} ms</span>
        </div>
      </div>

      {/* Action & User Profile */}
      <div className="flex items-center space-x-3">
        {/* Demo Mode Switcher Button */}
        <button
          onClick={onToggleDemo}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            isSimulated
              ? 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20'
              : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
          }`}
          title="Toggle between laptop webcam and simulated presentation mode"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isSimulated ? 'Switch to Webcam' : 'Switch to Demo Feed'}</span>
        </button>

        {/* User Pill */}
        <div className="flex items-center space-x-2 pl-2 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-primary">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden lg:block text-left text-xs">
            <div className="text-white font-medium truncate max-w-[120px]">{userName}</div>
            <div className="text-[10px] text-slate-400">Local Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
}
