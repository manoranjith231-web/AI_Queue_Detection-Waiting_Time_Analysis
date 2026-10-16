'use client';

import React from 'react';
import { AlertTriangle, Play, Sparkles } from 'lucide-react';

interface DemoBannerProps {
  isSimulated: boolean;
  onSwitchToReal?: () => void;
}

export default function DemoBanner({ isSimulated, onSwitchToReal }: DemoBannerProps) {
  if (!isSimulated) return null;

  return (
    <div className="bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-surface-card border-b border-warning/30 px-6 py-2.5 flex flex-wrap items-center justify-between text-xs transition-all">
      <div className="flex items-center space-x-2.5 text-warning font-medium">
        <div className="w-6 h-6 rounded-lg bg-warning/20 border border-warning/40 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
        </div>
        <div>
          <span className="font-heading font-bold uppercase tracking-wider text-[11px] mr-2 px-1.5 py-0.5 rounded bg-warning/20 border border-warning/40">
            DEMO MODE — SIMULATED DATA
          </span>
          <span className="text-slate-300">
            Synthetic queue fluctuations are active for presentation purposes. Real camera measurements are not being shown.
          </span>
        </div>
      </div>

      {onSwitchToReal && (
        <button
          onClick={onSwitchToReal}
          className="mt-2 sm:mt-0 flex items-center space-x-1.5 px-3 py-1 rounded-md bg-warning text-background font-semibold hover:bg-warning-light transition-all shadow-sm"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Launch Laptop Webcam</span>
        </button>
      )}
    </div>
  );
}
