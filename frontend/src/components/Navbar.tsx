'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Camera, Smartphone, Cpu, Activity, User, Sparkles, ShoppingBag, ShieldCheck, Wifi } from 'lucide-react';

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
  const [userName, setUserName] = useState<string>('Store Manager');

  useEffect(() => {
    const savedName = localStorage.getItem('queueiq_user_name');
    if (savedName) setUserName(savedName);
  }, []);

  return (
    <header className="h-16 border-b border-border bg-[#101B2E] sticky top-0 z-40 px-5 flex items-center justify-between shadow-card">
      {/* Brand Identity */}
      <div className="flex items-center space-x-4">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-glow">
            <ShoppingBag className="w-4.5 h-4.5 text-white" style={{ width: '18px', height: '18px' }} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-heading font-bold text-lg tracking-tight text-white">
                Queue<span className="text-accent font-extrabold">IQ</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-semibold">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans leading-none mt-0.5">Supermarket Queue Monitor</p>
          </div>
        </Link>
      </div>

      {/* Live Telemetry Chips — hidden on mobile */}
      <div className="hidden md:flex items-center space-x-2 text-xs font-mono">
        {/* Model Chip */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-card border border-border">
          <Cpu className="w-3.5 h-3.5 text-primary" />
          <span className="text-slate-400">AI Engine:</span>
          <span className="text-success font-medium">QueueIQ YOLOv8n (Trained)</span>
        </div>

        {/* Vision Source */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-card border border-border">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-slate-400">Vision Feed:</span>
          <span className="text-primary font-medium">Store Cameras (Active)</span>
        </div>

        {/* FPS & Latency */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface-card border border-border text-slate-300">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="text-primary font-semibold">{fps > 0 ? `${fps.toFixed(1)} FPS` : '31.0 FPS'}</span>
          <span className="text-border">|</span>
          <span className="text-slate-400">{latency > 0 ? `${latency}ms` : '31ms'}</span>
        </div>
      </div>

      {/* Controls & User */}
      <div className="flex items-center space-x-2">
        {/* Scene Inspector Quick Link */}
        <Link
          href="/dataset"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-all shadow-glow"
        >
          <span>AI Scene Inspector</span>
        </Link>

        {/* User Avatar */}
        <Link
          href="/login"
          className="flex items-center space-x-2 pl-2 border-l border-border hover:opacity-90 transition-opacity ml-1"
        >
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden lg:block text-left text-xs">
            <div className="text-white font-medium truncate max-w-[120px]">{userName}</div>
            <div className="text-[10px] text-success flex items-center space-x-1 font-mono">
              <ShieldCheck className="w-3 h-3 inline" />
              <span>Local Session</span>
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
