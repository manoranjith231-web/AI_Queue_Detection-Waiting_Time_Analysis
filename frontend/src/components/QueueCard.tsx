'use client';

import React from 'react';
import { Users, Clock, Gauge, AlertTriangle, ShieldCheck } from 'lucide-react';
import { LiveCounterStatus } from '@/lib/types';

interface QueueCardProps {
  counter: LiveCounterStatus;
}

export default function QueueCard({ counter }: QueueCardProps) {
  const isCongested = counter.congestion_level !== 'Normal';
  const isCritical = counter.congestion_level === 'Critical';

  return (
    <div
      className={`p-5 rounded-2xl bg-surface-card border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
        isCritical
          ? 'border-danger/60 shadow-glow-danger bg-danger/5'
          : isCongested
          ? 'border-warning/60 shadow-glow-amber bg-warning/5'
          : 'border-border hover:border-slate-700'
      }`}
    >
      {/* Top Bar: Code, Category, Congestion Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: counter.color || '#06B6D4' }}
          />
          <span className="font-heading font-bold text-white text-base">
            {counter.name}
          </span>
        </div>

        <span
          className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
            isCritical
              ? 'bg-danger/20 text-danger border-danger/40 animate-pulse'
              : isCongested
              ? 'bg-warning/20 text-warning border-warning/40'
              : 'bg-success/20 text-success border-success/40'
          }`}
        >
          {counter.congestion_label || counter.congestion_level}
        </span>
      </div>

      {/* Main Metrics: People & Wait Time */}
      <div className="grid grid-cols-2 gap-4 my-5 py-3 border-y border-border/50">
        {/* People Count */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>Shoppers in Line</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-heading font-bold text-white">
              {counter.people_count}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              ({counter.people_ahead} ahead)
            </span>
          </div>
        </div>

        {/* Estimated Waiting Time */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
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
          <span className="flex items-center space-x-1">
            <Gauge className="w-3 h-3 text-slate-500" />
            <span>Avg Service Rate:</span>
          </span>
          <span className="font-mono text-slate-200">
            {counter.avg_service_time_sec}s / customer
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3 text-slate-500" />
            <span>Formula Status:</span>
          </span>
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
              counter.is_calibrated
                ? 'bg-success/15 text-success'
                : 'bg-surface-elevated text-slate-300'
            }`}
          >
            {counter.is_calibrated ? 'Empirical Calibrated' : 'Configured Assumption'}
          </span>
        </div>

        {counter.boundary_alert && (
          <div className="pt-2 flex items-center space-x-1 text-warning text-[10px]">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>Shoppers detected near frame boundary. Queue tail may extend out of view.</span>
          </div>
        )}
      </div>
    </div>
  );
}
