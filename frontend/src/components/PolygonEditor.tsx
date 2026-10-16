'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Save, RotateCcw, Check, Move, HelpCircle, Layers } from 'lucide-react';
import { Counter } from '@/lib/types';
import { api } from '@/lib/api';

interface PolygonEditorProps {
  counters: Counter[];
  onCountersUpdated: () => void;
}

export default function PolygonEditor({ counters, onCountersUpdated }: PolygonEditorProps) {
  const [selectedCounterId, setSelectedCounterId] = useState<number>(counters[0]?.id || 1);
  const [editPolygons, setEditPolygons] = useState<Record<number, [number, number][]>>({});
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map: Record<number, [number, number][]> = {};
    counters.forEach((c) => {
      map[c.id] = c.polygon_coords || [];
    });
    setEditPolygons(map);
    if (!selectedCounterId && counters.length > 0) {
      setSelectedCounterId(counters[0].id);
    }
  }, [counters]);

  const activeCounter = counters.find((c) => c.id === selectedCounterId);
  const currentVertices = editPolygons[selectedCounterId] || [];

  const handleMouseDownVertex = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingVertexIndex(idx);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingVertexIndex === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));

    setEditPolygons((prev) => {
      const currentList = [...(prev[selectedCounterId] || [])];
      currentList[draggingVertexIndex] = [parseFloat(x.toFixed(3)), parseFloat(y.toFixed(3))];
      return {
        ...prev,
        [selectedCounterId]: currentList,
      };
    });
  };

  const handleMouseUp = () => {
    setDraggingVertexIndex(null);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      for (const counter of counters) {
        const poly = editPolygons[counter.id];
        if (poly && poly.length >= 3) {
          await api.updateCounter(counter.id, {
            polygon_coords: poly,
          });
        }
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onCountersUpdated();
    } catch (err) {
      console.error('Error saving polygons:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Reset all 3 queue polygons back to standard retail layout?')) return;
    try {
      await api.resetCounters();
      onCountersUpdated();
    } catch (err) {
      console.error('Error resetting polygons:', err);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-6 shadow-card">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-bold text-lg text-white">
              Editable Polygon Queue Regions
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Drag the vertex nodes on the video canvas below to adapt queue monitoring to your supermarket layout.
          </p>
        </div>

        {/* Counter Selection Tabs */}
        <div className="flex items-center space-x-2 bg-surface p-1 rounded-xl border border-border">
          {counters.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCounterId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                selectedCounterId === c.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: c.color || '#2874F0' }}
              />
              <span>{c.name.split('(')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Editor Canvas Overlay on Live Video */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-border select-none cursor-crosshair group"
      >
        <img
          src="http://127.0.0.1:8000/api/live/stream"
          alt="Queue Monitoring Stream"
          className="w-full h-full object-contain pointer-events-none"
        />

        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {counters.map((c) => {
            const poly = editPolygons[c.id] || [];
            if (poly.length < 3) return null;
            const pointsString = poly
              .map(([x, y]) => `${x * 100}%,${y * 100}%`)
              .join(' ');
            const isSelected = c.id === selectedCounterId;

            return (
              <polygon
                key={c.id}
                points={pointsString}
                fill={c.color || '#2874F0'}
                fillOpacity={isSelected ? 0.28 : 0.08}
                stroke={c.color || '#2874F0'}
                strokeWidth={isSelected ? 3 : 1.5}
                strokeDasharray={isSelected ? 'none' : '4 4'}
              />
            );
          })}
        </svg>

        {/* Interactive Vertex Handles */}
        {currentVertices.map(([x, y], idx) => (
          <div
            key={idx}
            onMouseDown={(e) => handleMouseDownVertex(idx, e)}
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
            }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 cursor-grab active:cursor-grabbing flex items-center justify-center transition-transform hover:scale-125 z-20 ${
              draggingVertexIndex === idx
                ? 'bg-white border-accent scale-125 shadow-glow-amber'
                : 'bg-primary border-white'
            }`}
          >
            <span className="text-[9px] font-mono font-bold text-white">
              {idx + 1}
            </span>
          </div>
        ))}

        <div className="absolute bottom-3 left-3 bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border text-[11px] text-slate-300 pointer-events-none flex items-center space-x-2">
          <Move className="w-3.5 h-3.5 text-accent" />
          <span>Click and drag nodes 1-4 to reshape {activeCounter?.name}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          onClick={handleResetDefaults}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-surface text-slate-300 border border-border hover:bg-surface-elevated hover:text-white transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Layout</span>
        </button>

        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            saveSuccess
              ? 'bg-success text-white font-bold'
              : 'bg-accent text-background hover:bg-accent-light shadow-glow-amber'
          }`}
        >
          {saveSuccess ? (
            <>
              <Check className="w-4 h-4" />
              <span>Polygons Saved to SQLite!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Queue Regions'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
