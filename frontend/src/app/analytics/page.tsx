'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Download,
  Calendar,
  Clock,
  TrendingUp,
  BarChart2,
  RefreshCw,
  FileSpreadsheet,
  Users,
  Database,
  ArrowRight,
  Target,
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
import { DatasetSummary } from '@/lib/types';

export default function AnalyticsPage() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);
  const [hoursRange, setHoursRange] = useState<number>(12);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [history, peaks, dsSum] = await Promise.all([
        api.getAnalyticsHistory(hoursRange),
        api.getPeakHours(),
        api.getDatasetSummary(),
      ]);
      setHistoryData(history);
      setPeakHours(peaks);
      setDatasetSummary(dsSum);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [hoursRange]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header and Export Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white tracking-tight">
            Dataset Computer-Vision Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Empirical detection volume, ground-truth precision/recall, and sequence crowd distribution.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/dataset"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-all shadow-glow"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Process Dataset Batch</span>
          </Link>

          <a
            href="http://127.0.0.1:8000/api/dataset/export-csv"
            download
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-background hover:bg-accent-light transition-all shadow-glow-amber"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Dataset</span>
          </a>
        </div>
      </div>

      {/* Dataset Validation KPI Strip */}
      {datasetSummary && datasetSummary.has_processed_data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-surface-card border border-border">
            <span className="text-xs text-slate-400 block">Dataset Frames Analyzed</span>
            <span className="text-2xl font-mono font-bold text-white mt-1 block">
              {datasetSummary.total_frames_processed}
            </span>
            <span className="text-[10px] text-slate-500">Across local runs</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-card border border-border">
            <span className="text-xs text-slate-400 block">Total Detections</span>
            <span className="text-2xl font-mono font-bold text-primary mt-1 block">
              {datasetSummary.total_person_detections}
            </span>
            <span className="text-[10px] text-slate-500">YOLOv8 Class 0 (Person)</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-card border border-border">
            <span className="text-xs text-slate-400 block">Model Precision</span>
            <span className="text-2xl font-mono font-bold text-success mt-1 block">
              {datasetSummary.precision ? `${(datasetSummary.precision * 100).toFixed(1)}%` : '--'}
            </span>
            <span className="text-[10px] text-slate-500">Evaluated vs ground truth</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-card border border-border">
            <span className="text-xs text-slate-400 block">Model Recall</span>
            <span className="text-2xl font-mono font-bold text-accent mt-1 block">
              {datasetSummary.recall ? `${(datasetSummary.recall * 100).toFixed(1)}%` : '--'}
            </span>
            <span className="text-[10px] text-slate-500">Detected / Total GT targets</span>
          </div>
        </div>
      )}

      {/* Hourly Queue Length Trends (Area Chart) */}
      <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-bold text-lg text-white">
              Hourly Queue Volume Trends
            </h3>
            <p className="text-xs text-slate-400">
              Shoppers in line across Counter 1 (Express), Counter 2 (Standard), and Counter 3 (Bulk)
            </p>
          </div>

          <div className="flex items-center space-x-1 bg-surface p-1 rounded-xl border border-border text-xs">
            {[6, 12, 24].map((hr) => (
              <button
                key={hr}
                onClick={() => setHoursRange(hr)}
                className={`px-3 py-1 rounded-lg transition-all font-semibold ${
                  hoursRange === hr
                    ? 'bg-primary text-white shadow-sm'
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
                  <stop offset="5%" stopColor="#2874F0" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2874F0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorC2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF9900" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#FF9900" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorC3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#263A5C" vertical={false} />
              <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#101B2E',
                  borderColor: '#263A5C',
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
                stroke="#2874F0"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorC1)"
              />
              <Area
                type="monotone"
                dataKey="counter_2_queue"
                name="Counter 2 (Standard)"
                stroke="#FF9900"
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
        <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-4 shadow-card">
          <div>
            <h3 className="font-heading font-bold text-lg text-white">
              Estimated Customer Delay (Minutes)
            </h3>
            <p className="text-xs text-slate-400">
              Minutes spent in line prior to reaching checkout counter
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263A5C" vertical={false} />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#101B2E',
                    borderColor: '#263A5C',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '0.75rem',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="counter_1_wait_min" name="C1 Wait (Min)" fill="#2874F0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="counter_2_wait_min" name="C2 Wait (Min)" fill="#FF9900" radius={[4, 4, 0, 0]} />
                <Bar dataKey="counter_3_wait_min" name="C3 Wait (Min)" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Congestion Periods Table */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-lg text-white">
                Historical Peak Congestion Windows
              </h3>
              <p className="text-xs text-slate-400">
                Supermarket rush periods requiring auxiliary staffing
              </p>
            </div>
            <Clock className="w-4 h-4 text-accent" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase font-mono text-slate-400 border-b border-border/80 pb-2">
                <tr>
                  <th className="py-2.5">Hour Window</th>
                  <th className="py-2.5">Store Queue</th>
                  <th className="py-2.5">Avg Wait</th>
                  <th className="py-2.5">Staffing Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-slate-300">
                {peakHours.map((slot, idx) => (
                  <tr key={idx} className="hover:bg-surface-elevated/40">
                    <td className="py-3 font-mono font-medium text-white">{slot.hour_slot}</td>
                    <td className="py-3 font-mono">{slot.avg_queue} shoppers</td>
                    <td className="py-3 font-mono text-accent font-semibold">{slot.avg_wait_min} mins</td>
                    <td className="py-3">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                          slot.avg_queue > 6
                            ? 'bg-danger/20 text-danger border border-danger/30'
                            : 'bg-accent/20 text-accent border border-accent/30'
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
