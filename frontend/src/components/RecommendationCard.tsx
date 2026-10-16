'use client';

import React from 'react';
import { Lightbulb, ArrowRight, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';
import { Recommendation } from '@/lib/types';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onDismiss?: (id: string) => void;
}

export default function RecommendationCard({
  recommendation,
  onDismiss,
}: RecommendationCardProps) {
  const isUrgent = recommendation.priority === 'URGENT';
  const isHigh = recommendation.priority === 'HIGH';

  return (
    <div
      className={`p-5 rounded-2xl bg-surface-card border transition-all space-y-4 ${
        isUrgent
          ? 'border-danger/50 bg-danger/5 shadow-glow-danger'
          : isHigh
          ? 'border-warning/50 bg-warning/5'
          : 'border-border'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div
            className={`p-2 rounded-xl border ${
              isUrgent
                ? 'bg-danger/20 text-danger border-danger/40'
                : isHigh
                ? 'bg-warning/20 text-warning border-warning/40'
                : 'bg-primary/20 text-primary border-primary/40'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-surface-elevated text-slate-300 border border-border">
              {recommendation.category}
            </span>
            <h4 className="font-heading font-bold text-base text-white mt-1">
              {recommendation.title}
            </h4>
          </div>
        </div>

        <span
          className={`text-[11px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
            isUrgent
              ? 'bg-danger/20 text-danger border-danger/40 animate-pulse'
              : isHigh
              ? 'bg-warning/20 text-warning border-warning/40'
              : 'bg-primary/20 text-primary border-primary/40'
          }`}
        >
          {recommendation.priority}
        </span>
      </div>

      {/* Actionable Advice */}
      <div className="p-3.5 rounded-xl bg-surface/80 border border-border text-sm font-medium text-slate-200">
        <span className="text-primary font-bold mr-1.5">Action:</span>
        {recommendation.recommendation}
      </div>

      {/* Reasoning & Supporting Metrics */}
      <div className="space-y-2 text-xs text-slate-400">
        <div>
          <span className="text-slate-300 font-medium">Why: </span>
          <span>{recommendation.reasoning}</span>
        </div>

        {recommendation.supporting_metrics && (
          <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-mono">
            {Object.entries(recommendation.supporting_metrics).map(([k, v]) => (
              <span
                key={k}
                className="px-2 py-1 rounded bg-surface-elevated/80 border border-border text-slate-300"
              >
                {k.replace(/_/g, ' ')}: <strong className="text-primary">{String(v)}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Dismiss / Mark Applied */}
      {onDismiss && (
        <div className="flex justify-end pt-1">
          <button
            onClick={() => onDismiss(recommendation.id)}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            <span>Mark Action Taken</span>
          </button>
        </div>
      )}
    </div>
  );
}
