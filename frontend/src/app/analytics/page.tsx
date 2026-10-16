'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  Calendar,
  Clock,
  TrendingUp,
  BarChart2,
  RefreshCw,
  FileSpreadsheet,
  Users,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '@/lib/api';

export default function AnalyticsPage() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [hoursRange, setHoursRange] = useState<number>(12);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [history, peaks] = await Promise.all([
        api.getAnalyticsHistory(hoursRange),
        api.getPeakHours(),
      ]);
      setHistoryData(history);
      setPeakHours(peaks);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [hoursRange]);

  const handleSeedDemoData = async () => {
    try {
      await api.seedDemoData();
      fetchAnalytics();
    } catch (err) {
      console.error('Failed to seed demo data:', err);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header and Export Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white tracking-tight">
            Queue Intelligence & Peak Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Historical aggregate queue lengths, waiting-time trends, and peak hour customer volume.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSeedDemoData}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-surface-card text-slate-300 border border-border hover:bg-surface-elevated transition-all"
            title="Generate 3-day sample retail patterns"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Generate Sample History</span>
          </button>

          <a
            href="http://127.0.0.1:8000/api/analytics/export-csv"
            download
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-background hover:bg-primary-light transition-all shadow-glow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Dataset</span>
          </a>
        </div>
      </div>

      {/* Hourly Queue Length Trends (Area Chart) */}
      <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-bold text-lg text-white">
              Queue Length Hourly Trends
            </h3>
            <p className="text-xs text-slate-400">
              Shoppers in line across Counter 1 (Express), Counter 2 (Standard), and Counter 3 (Bulk)
            </p>
          </div>

          {/* Time range selector */}
          <div className="flex items-center space-x-1 bg-surface p-1 rounded-xl border border-border text-xs">
            {[6, 12, 24].map((hr) => (
              <button
                key={hr}
                onClick={() => setHoursRange(hr)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  hoursRange === hr
                    ? 'bg-primary/20 text-primary font-semibold border border-primary/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Last {hr}h
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorC1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorC2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorC3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#23304E" vertical={false} />
              <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
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
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Area
                type="monotone"
                dataKey="counter_1_queue"
                name="Counter 1 (Express)"
                stroke="#06B6D4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorC1)"
              />
              <Area
                type="monotone"
                dataKey="counter_2_queue"
                name="Counter 2 (Standard)"
                stroke="#8B5CF6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorC2)"
              />
              <Area
                type="monotone"
                dataKey="counter_3_queue"
                name="Counter 3 (Bulk)"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorC3)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Estimated Waiting Time Trends + Peak Congestion Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waiting Time Trends Chart */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-4">
          <div>
            <h3 className="font-heading font-bold text-lg text-white">
              Estimated Customer Waiting Times (Mins)
            </h3>
            <p className="text-xs text-slate-400">
              Minutes spent in line prior to reaching checkout counter
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#23304E" vertical={false} />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
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
                <Bar dataKey="counter_1_wait_min" name="C1 Wait (Min)" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="counter_2_wait_min" name="C2 Wait (Min)" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="counter_3_wait_min" name="C3 Wait (Min)" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Congestion Periods Table */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-lg text-white">
                Historical Peak Congestion Hours
              </h3>
              <p className="text-xs text-slate-400">
                Identified rush periods requiring auxiliary staffing
              </p>
            </div>
            <Clock className="w-4 h-4 text-warning" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase font-mono text-slate-400 border-b border-border/80 pb-2">
                <tr>
                  <th className="py-2.5">Hour Window</th>
                  <th className="py-2.5">Avg Store Queue</th>
                  <th className="py-2.5">Avg Wait</th>
                  <th className="py-2.5">Staffing Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-slate-300">
                {peakHours.map((slot, idx) => (
                  <tr key={idx} className="hover:bg-surface-elevated/40">
                    <td className="py-3 font-mono font-medium text-white">{slot.hour_slot}</td>
                    <td className="py-3 font-mono">{slot.avg_queue} shoppers</td>
                    <td className="py-3 font-mono text-warning">{slot.avg_wait_min} mins</td>
                    <td className="py-3">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          slot.avg_queue > 6
                            ? 'bg-danger/20 text-danger border border-danger/30'
                            : 'bg-warning/20 text-warning border border-warning/30'
                        }`}
                      >
                        {slot.avg_queue > 6 ? 'Peak Overflow' : 'Moderate Rush'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
