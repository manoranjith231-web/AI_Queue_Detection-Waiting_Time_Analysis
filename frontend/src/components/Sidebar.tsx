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
  ExternalLink,
} from 'lucide-react';

const navigationItems = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Live Monitoring', href: '/live', icon: Video, badge: 'Live' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Recommendations', href: '/recommendations', icon: Lightbulb },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-surface/50 backdrop-blur-md flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        {/* Navigation Section */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 px-3 mb-2">
            Operations
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
                      ? 'bg-primary/10 text-primary border border-primary/25 shadow-glow'
                      : 'text-slate-400 hover:text-white hover:bg-surface-card'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>

                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-danger/20 text-danger border border-danger/30 animate-pulse">
                      {item.badge}
                    </span>
                  )}

                  {item.name === 'Alerts' && unreadAlerts > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30">
                      {unreadAlerts}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Free Stack Trust Card */}
        <div className="p-3.5 rounded-xl bg-surface-card/60 border border-border text-xs space-y-2">
          <div className="flex items-center space-x-2 text-slate-300 font-medium">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span>100% Free & Local</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Runs offline without cloud GPUs or paid API credits. Computer vision processed locally on CPU.
          </p>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="pt-4 border-t border-border/60 text-[11px] text-slate-500 space-y-1">
        <div className="flex justify-between items-center">
          <span>Engine Status</span>
          <span className="text-success flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping inline-block" />
            Active
          </span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Storage</span>
          <span className="font-mono">SQLite (Local)</span>
        </div>
      </div>
    </aside>
  );
}
