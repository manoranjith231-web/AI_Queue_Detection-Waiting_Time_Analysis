'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, Info, Check, CheckCheck } from 'lucide-react';
import { Alert } from '@/lib/types';

interface AlertCardProps {
  alert: Alert;
  onAcknowledge: (id: number) => void;
  onResolve: (id: number) => void;
}

export default function AlertCard({ alert, onAcknowledge, onResolve }: AlertCardProps) {
  const isCritical = alert.severity === 'CRITICAL';
  const isWarning = alert.severity === 'WARNING';
  const isAck = Boolean(alert.acknowledged);
  const isResolved = Boolean(alert.resolved);

  return (
    <div
      className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
        isResolved
          ? 'bg-surface/40 border-border/40 opacity-60'
          : isCritical
          ? 'bg-danger/10 border-danger/40 shadow-glow-danger'
          : isWarning
          ? 'bg-warning/10 border-warning/40'
          : 'bg-surface-card border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div
            className={`p-2 rounded-lg mt-0.5 shrink-0 ${
              isCritical
                ? 'bg-danger/20 text-danger'
                : isWarning
                ? 'bg-warning/20 text-warning'
                : 'bg-primary/20 text-primary'
            }`}
          >
            {isCritical ? (
              <AlertCircle className="w-4 h-4" />
            ) : isWarning ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Info className="w-4 h-4" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-heading font-semibold text-sm text-white">
                {alert.title}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-slate-300">
                {alert.alert_type}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{alert.message}</p>
          </div>
        </div>

        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
          {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'Just now'}
        </span>
      </div>

      {/* Snapshot metrics if present */}
      {alert.metrics_snapshot && (
        <div className="flex flex-wrap gap-2 text-[10px] font-mono pl-11">
          {Object.entries(alert.metrics_snapshot).map(([k, v]) => (
            <span key={k} className="px-2 py-0.5 rounded bg-surface border border-border text-slate-300">
              {k}: <strong className="text-white">{String(v)}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border/40 pl-11">
        {!isAck && !isResolved && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface text-slate-200 border border-border hover:bg-surface-elevated hover:text-white transition-all"
          >
            <Check className="w-3.5 h-3.5 text-warning" />
            <span>Acknowledge</span>
          </button>
        )}

        {!isResolved && (
          <button
            onClick={() => onResolve(alert.id)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-all"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Resolve</span>
          </button>
        )}

        {isResolved && (
          <span className="text-xs text-slate-500 font-mono flex items-center space-x-1">
            <CheckCheck className="w-3.5 h-3.5 text-success" />
            <span>Resolved</span>
          </span>
        )}
      </div>
    </div>
  );
}
