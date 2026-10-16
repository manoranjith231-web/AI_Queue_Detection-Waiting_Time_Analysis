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
        api.getAlerts(true), // unacknowledged
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
          <h1 className="font-heading text-3xl font-bold text-white tracking-tight">
            Checkout Operations Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time queue analytics, customer wait estimations, and AI supermarket intelligence.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/live"
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-background hover:bg-primary-light transition-all shadow-glow"
          >
            <span>Open Live Video Feed</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total People Waiting"
          value={summary?.total_waiting ?? '--'}
          subtitle="Across all active checkout registers"
          icon={Users}
          color="cyan"
          trend="+2 vs 10m ago"
          trendType="neutral"
        />

        <MetricsCard
          title="Avg Estimated Wait"
          value={`${summary?.avg_wait_time_min ?? '--'} m`}
          subtitle="Little's Law queue prediction"
          icon={Clock}
          color="violet"
          trend="Target < 4.0m"
          trendType={Number(summary?.avg_wait_time_min || 0) > 4 ? 'negative' : 'positive'}
        />

        <MetricsCard
          title="Peak Wait Time"
          value={`${summary?.longest_wait_min ?? '--'} m`}
          subtitle={`At ${summary?.longest_counter_name || 'Counter'}`}
          icon={TrendingUp}
          color="amber"
          isHighlighted={Number(summary?.longest_wait_min || 0) >= 6}
        />

        <MetricsCard
          title="Congestion Level"
          value={summary?.congestion_level ?? 'Optimal'}
          subtitle={`${summary?.counters_requiring_attention ?? 0} counters requiring staff`}
          icon={ShieldAlert}
          color={
            summary?.congestion_level === 'High'
              ? 'rose'
              : summary?.congestion_level === 'Moderate'
              ? 'amber'
              : 'emerald'
          }
        />
      </div>

      {/* Live Billing Counters Status Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-xl text-white">
              Billing Counters Live Status
            </h2>
            <p className="text-xs text-slate-400">
              Polygon-assigned person detection and queue waiting status
            </p>
          </div>
          <Link
            href="/live"
            className="text-xs font-mono text-primary hover:underline flex items-center space-x-1"
          >
            <span>Edit Queue Polygons</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {liveCounters.map((counter) => (
            <QueueCard key={counter.id} counter={counter} />
          ))}
        </div>
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
              <Lightbulb className="w-4 h-4 text-primary" />
              <h3 className="font-heading font-bold text-base text-white">
                Shop-Owner Intelligence
              </h3>
            </div>
            <Link
              href="/recommendations"
              className="text-xs text-primary hover:underline font-mono"
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
                All queues operating within optimal bounds. No critical adjustments needed.
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
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h3 className="font-heading font-bold text-base text-white">
                Recent Queue Alerts
              </h3>
            </div>
            <Link href="/alerts" className="text-xs text-primary hover:underline font-mono">
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
