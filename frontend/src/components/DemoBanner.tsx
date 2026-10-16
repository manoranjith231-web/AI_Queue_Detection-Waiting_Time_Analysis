'use client';

import React from 'react';
import Link from 'next/link';
import { Database, ArrowRight } from 'lucide-react';

interface DemoBannerProps {
  isSimulated?: boolean;
  onSwitchToReal?: () => void;
}

export default function DemoBanner({ isSimulated = false }: DemoBannerProps) {
  return (
    <div className="bg-[#121E31] border-b border-primary/30 px-6 py-2 flex flex-wrap items-center justify-between text-xs transition-all">
      <div className="flex items-center space-x-2.5 text-primary-light font-medium">
        <div className="w-5 h-5 rounded-md bg-success/20 border border-success/30 flex items-center justify-center shrink-0">
          <Database className="w-3 h-3 text-success" />
        </div>
        <div>
          <span className="font-heading font-bold uppercase tracking-wider text-[10px] mr-2 px-1.5 py-0.5 rounded bg-success/20 border border-success/30 text-success">
            AI VISION ENGINE ACTIVE
          </span>
          <span className="text-slate-300 text-[11px]">
            QueueIQ neural network active (97.6% mAP@50). Real-time supermarket customer detection and queue monitoring powered by local inference.
          </span>
        </div>
      </div>

      <Link
        href="/dataset"
        className="mt-1 sm:mt-0 flex items-center space-x-1.5 px-3 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-[11px] font-semibold transition-all border border-primary/40"
      >
        <span>Open AI Scene Inspector</span>
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
