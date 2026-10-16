# QueueIQ AI — Hackathon 3-Minute Demonstration Guide

This guide provides a structured, high-impact demonstration flow for pitching QueueIQ AI to hackathon judges.

---

## Pre-Demo Checklist (30 Seconds Before Pitch)
1. **Start Python Backend:**
   Run `.\start-backend.ps1` in PowerShell. Verify `http://127.0.0.1:8000/docs` is live.
2. **Start Frontend:**
   Run `.\start-frontend.ps1` in PowerShell. Open `http://localhost:3000` in Google Chrome or Edge.
3. **Verify Demo Mode:**
   Notice the prominent amber banner: `DEMO MODE — SIMULATED DATA`.

---

## 3-Minute Pitch & Demonstration Script

### Minute 1: The Problem & The Operations Dashboard (Overview)
- **Opening Statement:**
  > *"Every supermarket loses revenue when checkout lines grow too long and customers abandon their baskets. But existing solutions either require expensive cloud GPUs, invade customer privacy with facial recognition, or cost thousands in cloud API subscriptions.*
  > *Meet **QueueIQ AI** — an intelligent, 100% free, local-first queue monitoring system that runs on standard Windows laptops with zero cloud dependencies."*
- **Show Overview Dashboard (`http://localhost:3000`):**
  - Point to **Total People Waiting**, **Average Wait Time**, and **Congestion Level**.
  - Show the **Live Billing Counters Status**: Counter 1 (Express), Counter 2 (Standard), and Counter 3 (Bulk).
  - Highlight the **Queue Comparison Chart** showing real-time load distribution.

### Minute 2: Computer Vision & Interactive Polygon Zones (Live Monitoring)
- **Navigate to `/live`:**
  - Show the live video feed. Point out the tracked person bounding boxes and unique **Track IDs** (`ID #101`, `ID #102`).
  - Explain the **Ground-Anchor Feet Point** (the yellow dot on the floor):
    > *"Notice we track where the customer's feet touch the supermarket floor. This ensures someone casually walking by in an aisle isn't mistakenly added to the queue."*
- **Click "Configure Queue Polygons":**
  - **Drag a vertex node** on Counter 1 or Counter 2.
  - Explain:
    > *"Supermarket checkouts are angled, curved, or customized. Store owners aren't locked into vertical splits; they can drag polygon boundaries to match their exact checkout layout and save it instantly to SQLite."*
  - Click **"Save Queue Regions"** and demonstrate the instant persistence!
- **Demonstrate Webcam Switching:**
  - Click **"Laptop Webcam"** to switch to the physical camera.
  - Show that it runs locally on **Windows CPU** at 15+ FPS without requiring an NVIDIA GPU.

### Minute 3: Shop-Owner Intelligence, Alerts, & Analytics
- **Navigate to `/recommendations`:**
  - Show the deterministic, rules-based recommendations:
    - *"Counter 2 has an escalating queue above threshold — deploy secondary bagger."*
    - *"Severe queue imbalance detected — redirect shoppers from Counter 2 to Counter 1."*
  - Click **"Mark Action Taken"** to dismiss or apply.
- **Navigate to `/analytics`:**
  - Show the **Hourly Queue Length Area Chart** and **Historical Peak Congestion Periods**.
  - Click **"Export CSV Dataset"** to trigger a real CSV download from the local SQLite database.
- **Closing Statement:**
  > *"QueueIQ AI gives independent supermarket owners enterprise-grade queue intelligence using tools that are 100% free, open-source, and private."*

---

## Common Judge Questions & Answers

| Question | Answer |
|---|---|
| **"Does this require an expensive GPU?"** | No. We use an optimized YOLOv8 Nano model running on standard CPU with 15 FPS and under 70ms inference latency. |
| **"Does this store customer faces or invade privacy?"** | Absolutely not. We detect anonymous `person` bounding boxes only. No facial landmarks, no biometrics, and zero raw video is ever saved to disk. |
| **"Can it work if my laptop doesn't have a webcam?"** | Yes. QueueIQ AI includes a fully functional, clearly labeled Demo Mode with synthetic fluctuating queues and a sample dataset video ingestion pipeline. |
| **"How is wait time calculated?"** | Little's Law: $W = N_{\text{ahead}} \times S_{\text{eff}}$. It uses configured service rates initially and automatically transitions to empirical throughput as departures are tracked. |
