'use client';

import React, { useState, useEffect } from 'react';
import { Lightbulb, Filter, RefreshCw, CheckCircle2 } from 'lucide-react';
import RecommendationCard from '@/components/RecommendationCard';
import { api } from '@/lib/api';
import { Recommendation } from '@/lib/types';

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const recs = await api.getRecommendations();
      setRecommendations(recs);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
    const timer = setInterval(fetchRecommendations, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleDismiss = async (id: string) => {
    try {
      await api.dismissRecommendation(id);
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to dismiss recommendation:', err);
    }
  };

  const filtered = recommendations.filter((r) => {
    if (filterPriority === 'ALL') return true;
    return r.priority === filterPriority;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-6 h-6 text-primary" />
            <h1 className="font-heading text-3xl font-bold text-white tracking-tight">
              Shop-Owner Intelligence
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic, rules-based operational guidance for queue load rebalancing, bagger allocation, and register throughput.
          </p>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center space-x-2 bg-surface-card p-1 rounded-xl border border-border text-xs">
          {['ALL', 'URGENT', 'HIGH', 'MEDIUM'].map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterPriority === p
                  ? 'bg-primary/20 text-primary font-semibold border border-primary/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onDismiss={handleDismiss}
            />
          ))
        ) : (
          <div className="p-12 text-center rounded-2xl bg-surface-card border border-border space-y-3">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto opacity-80" />
            <h3 className="font-heading font-semibold text-lg text-white">
              No Pending Actionable Alerts
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Checkout queues are distributed evenly across active registers, and service delays remain well below configured congestion thresholds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
