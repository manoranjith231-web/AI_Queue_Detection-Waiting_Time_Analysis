'use client';

import React, { useState, useEffect } from 'react';
import '@/styles/globals.css';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import DemoBanner from '@/components/DemoBanner';
import { api } from '@/lib/api';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [telemetry, setTelemetry] = useState<{
    fps: number;
    latency: number;
    cameraStatus: string;
    modelStatus: string;
    isSimulated: boolean;
  }>({
    fps: 15.0,
    latency: 60,
    cameraStatus: 'Demo Mode (Simulated)',
    modelStatus: 'YOLOv8n (CPU)',
    isSimulated: true,
  });

  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);

  // Poll live telemetry every 3 seconds
  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const status = await api.getLiveStatus();
        if (mounted) {
          setTelemetry({
            fps: status.fps || 15.0,
            latency: status.latency_ms || 60,
            cameraStatus: status.camera_status || 'Active',
            modelStatus: status.model_status || 'YOLOv8n (CPU)',
            isSimulated: Boolean(status.is_simulated),
          });
        }
      } catch {
        // Backend warming up — ignore silently
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleToggleDemo = async () => {
    try {
      const nextSource = telemetry.isSimulated ? 'webcam' : 'demo';
      await api.switchSource(nextSource);
      setTelemetry((prev) => ({
        ...prev,
        isSimulated: nextSource === 'demo',
        cameraStatus: nextSource === 'webcam' ? 'Webcam Active' : 'Demo Mode (Simulated)',
      }));
    } catch (err) {
      console.error('Failed to toggle source:', err);
    }
  };

  return (
    <html lang="en" className="dark">
      <head>
        <title>QueueIQ AI — Intelligent Supermarket Queue Monitoring</title>
        <meta
          name="description"
          content="Real-time supermarket billing counter queue monitoring using computer vision person tracking, waiting-time analytics, and AI-powered staff recommendations."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-background text-foreground min-h-screen flex flex-col font-sans selection:bg-primary selection:text-white">
        <Navbar
          isSimulated={telemetry.isSimulated}
          fps={telemetry.fps}
          latency={telemetry.latency}
          cameraStatus={telemetry.cameraStatus}
          modelStatus={telemetry.modelStatus}
          onToggleDemo={handleToggleDemo}
        />
        <DemoBanner
          isSimulated={telemetry.isSimulated}
          onSwitchToReal={handleToggleDemo}
        />

        <div className="flex-1 flex overflow-hidden">
          <Sidebar unreadAlerts={unreadAlerts} />
          <main className="flex-1 overflow-y-auto p-5 md:p-7 bg-gradient-to-b from-surface/20 to-background">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
