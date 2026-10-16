# QueueIQ AI — Intelligent Supermarket Queue Monitoring & Waiting-Time Analytics

[![100% Free & Open Source](https://img.shields.io/badge/Stack-100%25%20Free%20%26%20Open--Source-brightgreen)](#free-tool-inventory)
[![Runs on Windows CPU](https://img.shields.io/badge/Hardware-Windows%20CPU%20(No%20GPU%20Required)-blue)](#hardware-requirements)
[![YOLOv8 Object Tracking](https://img.shields.io/badge/AI%20Vision-YOLOv8%20Nano%20%2B%20Centroid%20Tracking-cyan)](#computer-vision-engine)
[![Local-First Database](https://img.shields.io/badge/Database-SQLite%20(Local%20First)-purple)](#database--storage)
[![Privacy Preserving](https://img.shields.io/badge/Privacy-Zero%20Biometrics%20%2F%20No%20Facial%20Rec-emerald)](#privacy--security)

**QueueIQ AI** is a production-grade, local-first intelligent supermarket queue monitoring and waiting-time analytics platform. Engineered specifically for competitive hackathons and practical retail deployment, it monitors billing counters in real time using a standard laptop webcam or video feed, tracks customers without invading privacy, predicts customer waiting times using Little's Law, and generates deterministic rules-based recommendations for supermarket owners.

---

## 1. Free-Tool Inventory (Strict Free-Tools Compliance)

QueueIQ AI requires **zero paid cloud subscriptions, zero paid APIs, and zero subscription-dependent features**:

| Layer | Free & Open-Source Technology | License / Pricing |
|---|---|---|
| **AI Computer Vision** | Ultralytics YOLOv8 Nano (`yolov8n.pt`) | AGPL-3.0 / 100% Free Open Source |
| **Video Processing** | OpenCV Python (`opencv-python`) | Apache 2.0 / 100% Free |
| **Object Tracking** | Centroid & IoU Persistent Tracking | Custom Local Python / 100% Free |
| **Backend REST & WS** | FastAPI + Uvicorn | MIT / 100% Free |
| **Frontend Framework**| Next.js 14 App Router + React 18 | MIT / 100% Free |
| **Language & Types**  | TypeScript + Python 3.12 | Open Source / 100% Free |
| **Styling & UI**      | Tailwind CSS + Lucide React + Glassmorphism | MIT / 100% Free |
| **Analytics Charts**  | Recharts (Area, Bar, Multi-Metric) | MIT / 100% Free |
| **Local Database**    | SQLite 3 (`backend/data/queueiq.db`) | Public Domain / 100% Free |
| **Authentication**    | Local-first Signed JWT + Optional Google OAuth | MIT / Zero Cost Local Code |

---

## 2. Benchmark Video Dataset Integration: Collective Activity Dataset

QueueIQ AI includes native support for the **[Collective Activity Video Dataset](https://hyper.ai/en/datasets/5240)**.

The Collective Activity Dataset contains real-world surveillance video sequences of collective group dynamics, specifically containing labeled **"queuing"**, **"waiting"**, and **"walking"** human interactions recorded with consumer handheld cameras.

### How QueueIQ AI Ingests the Dataset:
1. Place any video sequence from the dataset (or custom supermarket CCTV clip) into `backend/videos/queue_sample.mp4`.
2. On the **Live Monitoring** page or via API:
   ```json
   POST /api/live/switch-source
   {
     "source_type": "file",
     "file_path": "backend/videos/queue_sample.mp4"
   }
   ```
3. The Vision Engine loops through the queuing sequence, assigns bounding boxes to the configured counter polygons, and logs empirical customer throughput!

---

## 3. Quickstart: Windows Setup & Commands

All commands are executed in Windows PowerShell without requiring administrative privileges.

### Step 1: Clone or Navigate to Project
```powershell
cd c:\Users\Manoranjith\Desktop\hackzen2.0
```

### Step 2: Start the Python AI Backend
```powershell
.\start-backend.ps1
```
*Alternatively, manual commands:*
```powershell
$env:PYTHONPATH = (Get-Location).Path
.\backend_venv\Scripts\python.exe backend\run_backend.py
```
> The backend server will initialize SQLite tables, load YOLOv8n on CPU, and listen on **`http://127.0.0.1:8000`**.  
> Interactive OpenAPI documentation is available at **`http://127.0.0.1:8000/docs`**.

### Step 3: Start the Next.js Frontend Dashboard
Open a new PowerShell terminal:
```powershell
cd c:\Users\Manoranjith\Desktop\hackzen2.0
.\start-frontend.ps1
```
*Alternatively, manual commands:*
```powershell
$env:PATH = "$PSScriptRoot\tools\node;$env:PATH"
cd frontend
npm run dev
```
> Open your browser to **`http://localhost:3000`** to access the dashboard!

---

## 4. Key Pages & Features

### 1. Overview Dashboard (`/`)
- **KPI Metrics:** Total People Waiting, Average Estimated Wait Time, Peak Wait Time, and Store Congestion Level.
- **Live Register Grid:** Counter 1 (Express), Counter 2 (Standard Baskets), and Counter 3 (Bulk Trolley).
- **Queue Comparison Chart:** Real-time load balance comparison.
- **Shop-Owner Recommendations:** Top urgent staffing and queue rebalancing advice.

### 2. Live Monitoring & Interactive Polygon Editor (`/live`)
- **Live Video Feed:** Real-time 640x480 video with bounding boxes and track IDs.
- **Interactive Polygon Canvas:** Store managers can **click and drag vertex nodes 1–4** on the video to reshape queue zones to match their physical counter layout.
- **Ground-Anchor Feet Point:** Tracks where the customer's feet touch the supermarket floor tiles $(X_{\text{mid}}, Y_{\text{bottom}})$, eliminating false positives from customers browsing adjacent aisles.
- **Hardware Telemetry:** Live FPS (15+ FPS), inference latency (<70ms on CPU), model status, and camera state.

### 3. Deep Analytics & CSV Export (`/analytics`)
- **Hourly Queue Trends (Area Chart):** Shows customer volume across counters over the last 6, 12, or 24 hours.
- **Customer Wait Time History (Bar Chart):** Compares delays.
- **Historical Peak Congestion Periods:** Highlights peak lunch (12pm–2pm) and evening (5pm–8pm) supermarket rushes.
- **CSV Dataset Export:** Instant direct download of SQLite historical aggregate measurements.

### 4. Shop-Owner Intelligence (`/recommendations`)
- Rules-based, transparent decision support:
  - *Severe Queue Imbalance:* Directs shoppers from slow to fast counters.
  - *Counter Overload:* Recommends deploying secondary baggers or opening auxiliary registers.
  - *Camera Tail Cutoff:* Warns when shoppers stand near the frame boundary, suggesting camera tilt adjustment.

### 5. Alerts Center (`/alerts`)
- Tracks congestion spikes, camera disconnection, and queue overruns.
- Features **45-second deduplication cooldowns** to prevent alert spamming.
- Audit trail with **Acknowledge** and **Resolve** action buttons.

### 6. Supermarket Settings (`/settings`)
- Configurable store name, counter service times, congestion thresholds, and alert cooldown intervals.
- Factory reset button to restore default supermarket polygon geometry.

---

## 5. Waiting-Time Mathematical Model

Unlike systems that invent arbitrary numbers, QueueIQ AI implements Little's Law:

$$W_c = N_{\text{ahead}} \times S_{\text{eff}}$$

Where:
- $N_{\text{ahead}} = \max(0, P_c - 1)$ (the customer at the register is already in service).
- $S_{\text{eff}}$ is the **Effective Service Time** in seconds per customer.
- **Configured Mode:** Uses baseline assumptions ($90\text{s}$ Express, $135\text{s}$ Standard, $180\text{s}$ Bulk).
- **Empirical Calibrated Mode:** Automatically calculated from timestamped customer departure intervals ($\Delta t$) once $\ge 6$ checkouts are completed.

Read the complete mathematical derivation in [WAITING_TIME_FORMULA.md](file:///c:/Users/Manoranjith/Desktop/hackzen2.0/docs/WAITING_TIME_FORMULA.md).

---

## 6. Privacy & Security Guarantees

- **Zero Biometrics:** Only COCO Class 0 (`person`) bounding boxes are detected. No facial landmarks, biometric templates, or identity data.
- **In-Memory Frame Processing:** Raw webcam frames are processed strictly in volatile RAM and never written to disk.
- **Local-First Database:** SQLite stores only aggregate numbers (`people_count`, `wait_time_sec`).
- **Local JWT Authentication:** Signed tokens using HMAC-SHA256 for store manager access.
- **Optional Google OAuth:** Ready for configuration with Google Cloud Console Client ID.

Read full details in [SECURITY.md](file:///c:/Users/Manoranjith/Desktop/hackzen2.0/docs/SECURITY.md).

---

## 7. Verification & Automated Test Suite

All 13 unit and integration tests pass with 100% success:

```powershell
.\backend_venv\Scripts\python.exe -m pytest backend/tests
```

**Test Results:**
- `test_polygon.py`: Point-in-polygon math, non-convex boundaries, ground-anchor foot mapping (**Passed**)
- `test_queue_analytics.py`: Little's law waiting time, rolling window smoothing, congestion scores (**Passed**)
- `test_recommendations.py`: Overload detection, queue rebalancing recommendations (**Passed**)
- `test_alerts.py`: Cooldown deduplication, suppression of duplicate triggers (**Passed**)
- `test_api.py`: FastAPI health, counters CRUD, analytics summary, dev authentication (**Passed**)

Frontend Production Build:
```powershell
cd frontend
$env:PATH = "C:\Users\Manoranjith\Desktop\hackzen2.0\tools\node;" + $env:PATH
npm run build
```
- **Result:** `✓ Compiled successfully`, `✓ Generating static pages (10/10)`, `Exit Code: 0`.

---

## 8. License & Hackathon Notice

Developed for HackZen 2.0. Distributed under the MIT Open Source License. Ultralytics YOLOv8 is subject to the AGPL-3.0 license.
