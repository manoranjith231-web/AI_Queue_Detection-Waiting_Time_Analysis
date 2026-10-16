'use client';

import React from 'react';
import { Users, Clock, Gauge, AlertTriangle, ShieldCheck, ShoppingCart } from 'lucide-react';
import { LiveCounterStatus } from '@/lib/types';

interface QueueCardProps {
  counter: LiveCounterStatus;
}

export default function QueueCard({ counter }: QueueCardProps) {
  const isCongested = counter.congestion_level !== 'Normal';
  const isCritical = counter.congestion_level === 'Critical';

  return (
    <div
      className={`p-5 rounded-2xl bg-surface-card border transition-all duration-200 relative overflow-hidden flex flex-col justify-between shadow-card ${
        isCritical
          ? 'border-danger/70 shadow-glow-danger bg-danger/5'
          : isCongested
          ? 'border-accent/70 shadow-glow-amber bg-accent/5'
          : 'border-border hover:border-border-light'
      }`}
    >
      {/* Top Bar: Code, Category, Congestion Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ backgroundColor: counter.color || '#2874F0' }}
          />
          <div>
            <span className="font-heading font-bold text-white text-base block">
              {counter.name}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {counter.category} Register
            </span>
          </div>
        </div>

        <span
          className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-semibold ${
            isCritical
              ? 'bg-danger/20 text-danger border-danger/40 animate-pulse'
              : isCongested
              ? 'bg-accent/20 text-accent border-accent/40'
              : 'bg-success/20 text-success border-success/40'
          }`}
        >
          {counter.congestion_label || counter.congestion_level}
        </span>
      </div>

      {/* Main Metrics: Shoppers & Estimated Wait Time */}
      <div className="grid grid-cols-2 gap-4 my-5 py-3.5 border-y border-border/70 bg-surface/50 rounded-xl px-3">
        {/* Shoppers Count */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>Shoppers in Line</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-heading font-bold text-white">
              {counter.people_count}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({counter.people_ahead} ahead)
            </span>
          </div>
        </div>

        {/* Estimated Waiting Time */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
            <Clock className="w-3.5 h-3.5 text-accent" />
            <span>Est. Wait Time</span>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl font-heading font-bold text-white">
              {counter.estimated_wait_time_min}
            </span>
            <span className="text-xs text-slate-400 font-mono">mins</span>
          </div>
        </div>
      </div>

      {/* Calibration & Service Speed Footer */}
      <div className="space-y-2 text-[11px] text-slate-400">
        <div className="flex justify-between items-center">
          <span className="flex items-center space-x-1.5">
            <Gauge className="w-3 h-3 text-slate-400" />
            <span>Scan Rate:</span>
          </span>
          <span className="font-mono text-slate-200 font-semibold">
            {counter.avg_service_time_sec}s / shopper
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3 h-3 text-slate-400" />
            <span>Estimation Mode:</span>
          </span>
          <span
            className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold ${
              counter.is_calibrated
                ? 'bg-success/20 text-success'
                : 'bg-surface-elevated text-slate-300'
            }`}
          >
            {counter.is_calibrated ? 'Empirical Calibrated' : 'Configured Standard'}
          </span>
        </div>

        {counter.boundary_alert && (
          <div className="pt-2 flex items-center space-x-1.5 text-accent text-[10px] font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Customer detected near frame edge. Queue tail may extend out of camera range.</span>
          </div>
        )}
      </div>
    </div>
  );
}
