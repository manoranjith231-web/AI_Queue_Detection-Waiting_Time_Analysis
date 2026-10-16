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
    <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold text-base text-white">
            Register Load & Waiting-Time Distribution
          </h3>
          <p className="text-xs text-slate-400">
            Real-time balance across Counter 1 (Express), Counter 2 (Standard), and Counter 3 (Bulk)
          </p>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#263A5C" vertical={false} />
            <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
            <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#101B2E',
                borderColor: '#263A5C',
                borderRadius: '0.75rem',
                color: '#fff',
                fontSize: '0.75rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            {/* Flipkart Royal Blue for Shoppers Waiting, Amazon Amber for Wait Time */}
            <Bar dataKey="people" name="Shoppers in Line" fill="#2874F0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="wait_min" name="Est. Wait Time (Mins)" fill="#FF9900" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
