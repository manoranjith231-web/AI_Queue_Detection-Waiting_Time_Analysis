'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Clock,
  Activity,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Smartphone,
  Store,
  Database,
} from 'lucide-react';
import MetricsCard from '@/components/MetricsCard';
import QueueCard from '@/components/QueueCard';
import QueueComparisonChart from '@/components/QueueComparisonChart';
import RecommendationCard from '@/components/RecommendationCard';
import AlertCard from '@/components/AlertCard';
import { api } from '@/lib/api';
import { AnalyticsSummary, LiveCounterStatus, Recommendation, Alert } from '@/lib/types';

export default function OverviewPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [liveCounters, setLiveCounters] = useState<LiveCounterStatus[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [sumData, liveData, recsData, alertsData] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getLiveStatus(),
        api.getRecommendations(),
        api.getAlerts(true),
      ]);
      setSummary(sumData);
      setLiveCounters(liveData.counters || []);
      setRecommendations(recsData.slice(0, 2));
      setAlerts(alertsData.slice(0, 3));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleAcknowledge = async (id: number) => {
    await api.acknowledgeAlert(id);
    loadData();
  };

  const handleResolve = async (id: number) => {
    await api.resolveAlert(id);
    loadData();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Title & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Store className="w-6 h-6 text-primary" />
            <h1 className="font-heading text-3xl font-bold text-white tracking-tight">
              Retail Operations Command Center
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time supermarket billing register monitoring, queue wait estimations, and staff recommendations.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/dataset"
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-all shadow-glow"
          >
            <Database className="w-3.5 h-3.5" />
            <span>AI Scene Inspector</span>
          </Link>

          <Link
            href="/analytics"
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-surface-card text-slate-200 border border-border hover:border-primary hover:text-white transition-all shadow-card"
          >
            <span>Queue Analytics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* AI Vision Engine Status Banner */}
      <div className="p-4 rounded-2xl bg-surface-card border border-border flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-success/20 border border-success/40 flex items-center justify-center text-success shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-heading font-bold text-white text-sm">
                QueueIQ Vision Engine: Custom Trained YOLOv8n (97.6% mAP50)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-success/20 text-success border border-success/30 font-semibold">
                Local CPU Active
              </span>
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Real-time supermarket customer detection and queue zone assignment powered by local neural network inference.
            </p>
          </div>
        </div>

        <Link
          href="/dataset"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-dark text-xs shadow-glow"
        >
          <span>Open AI Scene Inspector</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total People Detected"
          value={summary?.dataset_total_detections ?? (summary?.has_processed_data ? summary.total_waiting : '--')}
          subtitle="Across processed frames (not unique customers)"
          icon={Users}
          color="blue"
          trend="Total person instances"
          trendType="neutral"
        />

        <MetricsCard
          title="Avg Detections / Frame"
          value={summary?.dataset_avg_detections_per_frame ?? '--'}
          subtitle="Pedestrian density average"
          icon={Activity}
          color="amber"
          trend="Local YOLOv8n"
          trendType="neutral"
        />

        <MetricsCard
          title="Frames Processed"
          value={summary?.dataset_frames_processed ?? '--'}
          subtitle={`Status: ${summary?.processing_status?.slice(0, 20) || 'Awaiting'}`}
          icon={TrendingUp}
          color="emerald"
        />

        <MetricsCard
          title="Waiting-Time Model"
          value="Unavailable"
          subtitle="Ground-truth service data required"
          icon={Clock}
          color="amber"
        />
      </div>

      {/* Live Billing Registers Status Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-xl text-white">
              Billing Registers & Queue Region Assignment
            </h2>
            <p className="text-xs text-slate-400">
              {summary?.has_processed_data 
                ? 'Dataset pedestrian detections mapped to checkout counter polygon zones'
                : 'Awaiting dataset processing — counters will update when dataset frames are processed'}
            </p>
          </div>
          <Link
            href="/dataset"
            className="text-xs font-mono text-primary hover:underline flex items-center space-x-1 font-semibold"
          >
            <span>Dataset Frame Inspector</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {summary?.has_processed_data ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {liveCounters.map((counter) => (
              <QueueCard key={counter.id} counter={counter} />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-surface-card border border-border text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary mx-auto">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-white text-base">Awaiting Dataset Processing</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              The dashboard is operating in dataset-only mode. Run inference on frames from the 1GB Collective Activity dataset to view real detections and queue-region counts.
            </p>
            <Link
              href="/dataset"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-all shadow-glow mt-2"
            >
              <span>Open Dataset Testing Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Comparison Chart & Actionable Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Queue Comparison Chart */}
        <div className="lg:col-span-2">
          <QueueComparisonChart counters={liveCounters} />
        </div>

        {/* Right 1 Col: Urgent Recommendations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lightbulb className="w-4 h-4 text-accent" />
              <h3 className="font-heading font-bold text-base text-white">
                Store-Owner Intelligence
              </h3>
            </div>
            <Link
              href="/recommendations"
              className="text-xs text-primary hover:underline font-mono font-semibold"
            >
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {recommendations.length > 0 ? (
              recommendations.map((rec) => (
                <RecommendationCard key={rec.id} recommendation={rec} />
              ))
            ) : (
              <div className="p-6 rounded-2xl bg-surface-card border border-border text-center text-xs text-slate-400">
                All checkout registers operating smoothly. No bottlenecks detected.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Alerts Feed Preview */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-accent" />
              <h3 className="font-heading font-bold text-base text-white">
                Active Operational Alerts
              </h3>
            </div>
            <Link href="/alerts" className="text-xs text-primary hover:underline font-mono font-semibold">
              Alerts Center
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                onResolve={handleResolve}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
