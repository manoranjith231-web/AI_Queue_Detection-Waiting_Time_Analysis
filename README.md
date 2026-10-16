# QueueIQ AI — Intelligent Supermarket Queue Monitoring & Waiting-Time Analytics

[![100% Free & Open Source](https://img.shields.io/badge/Stack-100%25%20Free%20%26%20Open--Source-brightgreen)](#1-free-tool-inventory-strict-free-tools-compliance)
[![Runs on Windows CPU](https://img.shields.io/badge/Hardware-Windows%20CPU%20(No%20GPU%20Required)-blue)](#hardware-requirements)
[![YOLOv8 Object Tracking](https://img.shields.io/badge/AI%20Vision-YOLOv8%20Nano%20%2B%20Centroid%20Tracking-cyan)](#computer-vision-engine)
[![Local-First Database](https://img.shields.io/badge/Database-SQLite%20(Local%20First)-purple)](#database--storage)
[![Privacy Preserving](https://img.shields.io/badge/Privacy-Zero%20Biometrics%20%2F%20No%20Facial%20Rec-emerald)](#privacy--security-guarantees)
[![Test Suite Passed](https://img.shields.io/badge/Tests-17%2F17%20Passed%20(100%25)-success)](#verification--automated-test-suite)

**QueueIQ AI** is a production-grade, local-first intelligent supermarket queue monitoring and waiting-time analytics platform. Engineered for competitive retail hackathons and practical store operations, it monitors checkout counters in real time using laptop webcams, wireless smartphone cameras, or surveillance video feeds, tracks shoppers without collecting biometrics, predicts waiting times using Little's Law, and generates deterministic actionable recommendations for supermarket store owners.

---

## Architecture Overview

```
                   ┌────────────────────────────────────────┐
                   │        Video Input Channels           │
                   │  (Laptop Webcam / Phone Cam / Dataset) │
                   └───────────────────┬────────────────────┘
                                       │
                                       ▼
                   ┌────────────────────────────────────────┐
                   │    FastAPI Python Vision Engine (CPU)  │
                   │  • YOLOv8 Person Detection (Class 0)   │
                   │  • Ground-Anchor Foot Tracking (x, y)  │
                   │  • Ray-Casting Polygon Zone Assignment │
                   │  • Little's Law Wait-Time Calculation  │
                   │  • 45s Cooldown Alert Deduplication    │
                   └───────────────────┬────────────────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        ▼                             ▼
       ┌───────────────────────────────┐  ┌───────────────────────────────┐
       │   Local SQLite Database       │  │   Next.js 14 React Dashboard  │
       │   • Counter Configurations    │  │   • Live MJPEG Stream & Polys │
       │   • Historical Hourly Stats   │  │   • Dataset Video Testing     │
       │   • Rules-Based Insights      │  │   • Smartphone Camera Stream  │
       │   • Alert Incident Logs       │  │   • Deep Trend Charts (Area)  │
       └───────────────────────────────┘  └───────────────────────────────┘
```

---

## 1. Free-Tool Inventory (Strict Free-Tools Compliance)

QueueIQ AI requires **zero paid cloud subscriptions, zero paid APIs, and zero subscription-dependent features**:

| Layer | Free & Open-Source Technology | License / Pricing |
|---|---|---|
| **AI Computer Vision** | Ultralytics YOLOv8 Nano (`yolov8n.pt`) | AGPL-3.0 / 100% Free Open Source |
| **Video Processing** | OpenCV Python (`opencv-python-headless`) | Apache 2.0 / 100% Free |
| **Object Tracking** | Centroid & IoU Persistent Multi-Object Tracking | Custom Local Python / 100% Free |
| **Backend REST & WS** | FastAPI + Uvicorn Async Server | MIT / 100% Free |
| **Frontend Framework**| Next.js 14 App Router + React 18 | MIT / 100% Free |
| **Language & Types**  | TypeScript + Python 3.12 | Open Source / 100% Free |
| **Styling & UI**      | Tailwind CSS + Lucide React + Glassmorphism | MIT / 100% Free |
| **Analytics Charts**  | Recharts (Area, Bar, Multi-Metric Comparative) | MIT / 100% Free |
| **Local Database**    | SQLite 3 (`backend/data/queueiq.db`) | Public Domain / 100% Free |
| **Authentication**    | Local Signed JWT (HMAC-SHA256) | MIT / Zero Cost Local Code |

---

## 2. Key Pages & Features

### 1. Operations Overview Dashboard (`/`)
- **Real-Time KPIs:** Total shoppers waiting, store average queue time, peak queue delay, and store congestion status.
- **Active Checkout Grid:** Counter 1 (Express), Counter 2 (Standard Baskets), and Counter 3 (Bulk Trolleys).
- **Queue Comparison Chart:** Live balance visualizer comparing shoppers across all open registers.
- **Shop-Owner Intelligence:** High-priority recommendations for floor managers.

### 2. Live Retail Vision Monitoring (`/live`)
- **Live Video Feed:** Real-time stream with bounding boxes, tracking IDs, and ground anchor foot markers.
- **Interactive Polygon Canvas:** Store managers can **click and drag vertex nodes 1–4** on the video to reshape queue zones to match their physical counter layout.
- **Ground-Anchor Feet Point:** Tracks where the customer's feet touch the supermarket floor tiles $(X_{\text{mid}}, Y_{\text{bottom}})$, eliminating false positives from customers browsing adjacent aisles.
- **Hardware Telemetry:** Live FPS (15+ FPS), inference latency (<70ms on CPU), model status, and camera state.

### 3. AI Scene Inspector & Dataset Testing Studio (`/dataset`)
- **Curated Supermarket Scenes:** 6 pre-configured retail scenarios (Express Lane, Main Lanes, Entrance Flow, Service Desk, Peak Congestion, Self-Checkout Generalization).
- **Interactive Video Player:**
  - **Play Video / Pause Video** with sequential frame delivery (zero dropped frames).
  - **Speed Selector:** Normal `1x`, Fast `2x`, Slow `0.5x`.
  - **Loop Toggle:** Continuous video sequence looping.
  - **Scrubber Bar & Step Navigation:** Scrub through frames with sub-10ms cached preview.
- **Honest Ground-Truth Benchmarking:** Calculates genuine Precision, Recall, and F1 scores against the 1.02GB Collective Activity surveillance dataset.
- **CSV Detections Export:** Instant direct download of frame-by-frame customer counts and bounding boxes.

### 4. Smartphone Camera Streaming (`/mobile-cam`)
- **No App Installation Required:** Turn any Android phone or iPhone into a retail CCTV monitoring station simply by opening `/mobile-cam` in the phone's mobile browser.
- **Auto-Mirror & High-FPS Canvas:** Captures and streams frames over Wi-Fi directly into the QueueIQ AI computer vision pipeline.

### 5. Laptop Webcam Monitoring (`/webcam`)
- **Instant Local Hardware Connection:** Stream directly from built-in or USB webcams with real-time person detection and interactive checkout boundary overlay.

### 6. Deep Analytics & Reports (`/analytics`)
- **Hourly Queue Trends (Area Chart):** Shopper volume across counters over 6, 12, or 24 hours.
- **Wait Time History (Bar Chart):** Compares delays across checkout categories.
- **Peak Congestion Windows:** Highlights peak lunch (12pm–2pm) and evening (5pm–8pm) supermarket rushes.
- **CSV Aggregate Export:** One-click CSV download of all historical queue records.

### 7. Recommendations Engine (`/recommendations`)
- Rules-based, transparent decision support:
  - *Severe Queue Imbalance:* Directs shoppers from slow to fast counters.
  - *Counter Overload:* Recommends deploying secondary baggers or opening auxiliary registers.
  - *Camera Tail Cutoff:* Warns when shoppers stand near the frame boundary, suggesting camera tilt adjustment.

### 8. Alerts Center (`/alerts`)
- Tracks congestion spikes, camera disconnection, and queue overruns.
- Features **45-second deduplication cooldowns** to prevent alert spamming.
- Audit trail with **Acknowledge** and **Resolve** action buttons.

---

## 3. Quickstart & Installation

### Option A: One-Click Launcher (Recommended for Windows)

Simply execute the root launcher script in PowerShell:
```powershell
.\START.ps1
```
This script will:
1. Start the Python FastAPI backend on `http://127.0.0.1:8000`.
2. Start the Next.js development server on `http://localhost:3000`.
3. Automatically launch your default browser to the Dashboard.

---

### Option B: Manual Step-by-Step Setup

#### Prerequisites
- Windows 10/11 (or Linux/macOS)
- Python 3.10+
- Node.js 18+

#### 1. Setup Python Backend
```powershell
# Create and activate virtual environment
python -m venv backend_venv
.\backend_venv\Scripts\Activate.ps1

# Install dependencies
pip install fastapi uvicorn opencv-python-headless ultralytics numpy pytest httpx

# Run the backend
$env:PYTHONPATH = (Get-Location).Path
python backend\run_backend.py
```
*The FastAPI backend will start on **`http://127.0.0.1:8000`** with OpenAPI docs at **`http://127.0.0.1:8000/docs`**.*

#### 2. Setup Next.js Frontend
In a second terminal:
```powershell
cd frontend
npm install
npm run dev
```
*Open **`http://localhost:3000`** in your browser.*

---

## 4. Benchmark Dataset: Collective Activity Dataset

QueueIQ AI includes full integration with the **[Collective Activity Video Dataset](https://hyper.ai/en/datasets/5240)** (Wongun Choi, Khuram Shahid, Silvio Savarese, 2009).

- **44 Surveillance Sequences:** Containing 25,756 sequential video frames.
- **Ground-Truth Labeled Interactions:**
  1. Crossing
  2. Walking
  3. Waiting (Queue-relevant)
  4. Talking
  5. Queueing (Queue-relevant)
  6. Other
- **In-Memory Frame Caching:** Sub-10ms random frame access with accelerated LRU cache.

---

## 5. Mathematical Waiting-Time Model (Little's Law)

Rather than generating arbitrary numbers, QueueIQ AI implements Little's Law:

$$W_c = N_{\text{ahead}} \times S_{\text{eff}}$$

Where:
- $N_{\text{ahead}} = \max(0, P_c - 1)$ (the shopper currently at the register is already being served).
- $S_{\text{eff}}$ is the **Effective Service Time** in seconds per customer.
- **Configured Mode:** Baseline assumptions ($90\text{s}$ Express, $135\text{s}$ Standard, $180\text{s}$ Bulk).
- **Empirical Calibrated Mode:** Calculated from timestamped customer departure intervals ($\Delta t$) once $\ge 6$ checkouts are completed.

Read the full mathematical derivation in [docs/WAITING_TIME_FORMULA.md](docs/WAITING_TIME_FORMULA.md).

---

## 6. Privacy & Security Guarantees

- **Zero Biometrics:** Only COCO Class 0 (`person`) bounding boxes are detected. No facial landmarks, biometric templates, or identity data are ever captured.
- **In-Memory Frame Processing:** Raw camera frames are processed strictly in volatile RAM and never saved to persistent storage.
- **Local-First Database:** SQLite stores aggregate numbers only (`people_count`, `wait_time_sec`).
- **Local JWT Authentication:** HMAC-SHA256 signed access tokens for store manager actions.

Read full details in [docs/SECURITY.md](docs/SECURITY.md).

---

## 7. Verification & Automated Test Suite

All 17 unit and integration tests pass with 100% success:

```powershell
.\backend_venv\Scripts\python.exe -m pytest backend/tests
```

**Test Coverage Summary:**
- `test_dataset.py`: Dataset overview, sequence listing, frame analysis, and single-frame JPEG extraction (**4/4 Passed**)
- `test_polygon.py`: Point-in-polygon math, non-convex boundaries, ground-anchor foot mapping (**3/3 Passed**)
- `test_queue_analytics.py`: Little's law waiting time, rolling window smoothing, congestion scores (**3/3 Passed**)
- `test_recommendations.py`: Overload detection, queue rebalancing recommendations (**2/2 Passed**)
- `test_alerts.py`: Cooldown deduplication, suppression of duplicate triggers (**1/1 Passed**)
- `test_api.py`: FastAPI health, counters CRUD, analytics summary, dev authentication (**4/4 Passed**)

---

## 8. License & Notice

Distributed under the **MIT License**. Ultralytics YOLOv8 is subject to the AGPL-3.0 license. Developed for HackZen 2.0.
