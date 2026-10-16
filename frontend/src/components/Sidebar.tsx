'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Video,
  BarChart3,
  Lightbulb,
  Bell,
  Settings,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  Database,
  Camera,
} from 'lucide-react';

const navigationItems = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Live Webcam', href: '/webcam', icon: Camera, badge: 'Live' },
  { name: 'Dataset Testing', href: '/dataset', icon: Database, badge: '1 GB' },
  { name: 'Live Monitoring', href: '/live', icon: Video, badge: 'Dataset' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Recommendations', href: '/recommendations', icon: Lightbulb },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-[#101B2E] flex flex-col justify-between p-4 shrink-0 shadow-card">
      <div className="space-y-6">
        {/* Navigation Section */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 px-3 mb-2 font-semibold">
            Store Operations
          </div>
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-glow font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-surface-elevated'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        item.badge === 'Live'
                          ? 'bg-danger text-white animate-pulse'
                          : 'bg-accent text-background'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {item.name === 'Alerts' && unreadAlerts > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent text-background font-bold">
                      {unreadAlerts}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Enterprise Operations Compliance Card */}
        <div className="p-3.5 rounded-xl bg-surface-card border border-border text-xs space-y-2">
          <div className="flex items-center space-x-2 text-white font-medium">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>Retail Compliance</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Privacy-safe queue counting without facial recognition. Fully local processing on Windows CPU.
          </p>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="pt-4 border-t border-border/80 text-[11px] text-slate-400 space-y-1">
        <div className="flex justify-between items-center">
          <span>Inference Engine</span>
          <span className="text-success font-medium flex items-center gap-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping inline-block" />
            YOLOv8 CPU
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Database</span>
          <span className="font-mono text-slate-300">SQLite (Local)</span>
        </div>
      </div>
    </aside>
  );
}
