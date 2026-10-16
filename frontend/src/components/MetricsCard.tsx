'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  color?: 'cyan' | 'violet' | 'amber' | 'emerald' | 'rose';
  isHighlighted?: boolean;
}

export default function MetricsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendType = 'neutral',
  color = 'cyan',
  isHighlighted = false,
}: MetricsCardProps) {
  const colorMap = {
    cyan: {
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      text: 'text-primary',
      glow: 'hover:border-primary/50 hover:shadow-glow',
    },
    violet: {
      bg: 'bg-accent/10',
      border: 'border-accent/30',
      text: 'text-accent',
      glow: 'hover:border-accent/50 hover:shadow-glow-accent',
    },
    amber: {
      bg: 'bg-warning/10',
      border: 'border-warning/30',
      text: 'text-warning',
      glow: 'hover:border-warning/50 hover:shadow-glow-amber',
    },
    emerald: {
      bg: 'bg-success/10',
      border: 'border-success/30',
      text: 'text-success',
      glow: 'hover:border-success/50',
    },
    rose: {
      bg: 'bg-danger/10',
      border: 'border-danger/30',
      text: 'text-danger',
      glow: 'hover:border-danger/50 hover:shadow-glow-danger',
    },
  };

  const scheme = colorMap[color];

  return (
    <div
      className={`p-5 rounded-2xl bg-surface-card/80 border border-border transition-all duration-300 relative overflow-hidden group ${
        scheme.glow
      } ${isHighlighted ? `${scheme.border} bg-surface-elevated` : ''}`}
    >
      {/* Background radial gradient accent */}
      <div
        className={`absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 blur-xl pointer-events-none ${scheme.bg}`}
      />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-sans">
          {title}
        </span>
        <div className={`p-2.5 rounded-xl ${scheme.bg} ${scheme.text} border ${scheme.border}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline space-x-2">
        <span className="text-3xl font-heading font-bold text-white tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-mono font-medium ${
              trendType === 'positive'
                ? 'text-success'
                : trendType === 'negative'
                ? 'text-danger'
                : 'text-slate-400'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-2 text-xs text-slate-400 font-sans leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
