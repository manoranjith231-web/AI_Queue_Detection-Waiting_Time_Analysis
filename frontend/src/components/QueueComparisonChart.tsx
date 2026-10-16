'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { LiveCounterStatus } from '@/lib/types';

interface QueueComparisonChartProps {
  counters: LiveCounterStatus[];
}

export default function QueueComparisonChart({ counters }: QueueComparisonChartProps) {
  const chartData = counters.map((c) => ({
    name: c.name.split('(')[0],
    people: c.people_count,
    wait_min: c.estimated_wait_time_min,
    threshold: c.congestion_threshold,
  }));

  return (
    <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold text-base text-white">
            Live Counter Load & Waiting-Time Comparison
          </h3>
          <p className="text-xs text-slate-400">
            Real-time balance of waiting customers and estimated service delay
          </p>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#23304E" vertical={false} />
            <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
            <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0D1322',
                borderColor: '#23304E',
                borderRadius: '0.75rem',
                color: '#fff',
                fontSize: '0.75rem',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            <Bar dataKey="people" name="Shoppers Waiting" fill="#06B6D4" radius={[6, 6, 0, 0]} />
            <Bar dataKey="wait_min" name="Est. Wait Time (Mins)" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
