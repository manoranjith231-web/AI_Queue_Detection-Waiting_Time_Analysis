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
  color?: 'blue' | 'amber' | 'emerald' | 'rose' | 'cyan' | 'violet';
  isHighlighted?: boolean;
}

export default function MetricsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendType = 'neutral',
  color = 'blue',
  isHighlighted = false,
}: MetricsCardProps) {
  const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    blue: {
      bg: 'bg-primary/10',
      border: 'border-primary/40',
      text: 'text-primary',
      glow: 'hover:border-primary hover:shadow-glow',
    },
    cyan: {
      bg: 'bg-primary/10',
      border: 'border-primary/40',
      text: 'text-primary',
      glow: 'hover:border-primary hover:shadow-glow',
    },
    amber: {
      bg: 'bg-accent/10',
      border: 'border-accent/40',
      text: 'text-accent',
      glow: 'hover:border-accent hover:shadow-glow-amber',
    },
    violet: {
      bg: 'bg-primary/10',
      border: 'border-primary/40',
      text: 'text-primary',
      glow: 'hover:border-primary',
    },
    emerald: {
      bg: 'bg-success/10',
      border: 'border-success/40',
      text: 'text-success',
      glow: 'hover:border-success',
    },
    rose: {
      bg: 'bg-danger/10',
      border: 'border-danger/40',
      text: 'text-danger',
      glow: 'hover:border-danger hover:shadow-glow-danger',
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div
      className={`p-5 rounded-2xl bg-surface-card border border-border transition-all duration-200 relative overflow-hidden group shadow-card ${
        scheme.glow
      } ${isHighlighted ? `${scheme.border} bg-surface-elevated shadow-glow-amber` : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-sans">
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
