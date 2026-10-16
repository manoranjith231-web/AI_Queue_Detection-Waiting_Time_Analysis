# QueueIQ AI — Architecture & Technical Design

## 1. System Overview

QueueIQ AI is a local-first, privacy-preserving intelligent supermarket queue monitoring and waiting-time analytics system. It runs entirely on free, open-source technologies without requiring cloud GPUs, paid computer vision APIs, or subscription databases.

```
                    +--------------------------------------------+
                    |           Laptop Webcam / Camera           |
                    |         (or Collective Video Clip)         |
                    +---------------------+----------------------+
                                          | Raw Frames (640x480)
                                          v
+---------------------------------------------------------------------------------+
|                               PYTHON AI BACKEND                                 |
|                                                                                 |
|   +-----------------------+     +--------------------+     +----------------+   |
|   | YOLOv8n (CPU-Tuned)   | --> | Centroid & IoU     | --> | Polygon Zone   |   |
|   | Person Detector       |     | Object Tracker     |     | Assignment     |   |
|   +-----------------------+     +--------------------+     +----------------+   |
|                                                                    |            |
|                                                                    v            |
|   +-----------------------+     +--------------------+     +----------------+   |
|   | SQLite Database       | <-- | Rule-Based Alerts  | <-- | Little's Law   |   |
|   | (queueiq.db)          |     | & Recommendations  |     | Analytics      |   |
|   +-----------------------+     +--------------------+     +----------------+   |
|               ^                                                    |            |
|               | Fast REST API (FastAPI)                            v            |
|               +-----------------------------+--------------+---------------+    |
+---------------------------------------------|--------------|--------------------+
                                              |              |
                      MJPEG Video Stream (8-16 FPS)          | WebSocket / REST
                                              |              |
+---------------------------------------------v--------------v--------------------+
|                               FRONTEND DASHBOARD                                |
|                                                                                 |
|   +-----------------------+     +--------------------+     +----------------+   |
|   | Next.js App Router    |     | Interactive Polygon|     | Recharts       |   |
|   | & React 18            |     | Canvas Editor      |     | Analytics      |   |
|   +-----------------------+     +--------------------+     +----------------+   |
|                                                                                 |
|   +-------------------------------------------------------------------------+   |
|   | Midnight Navy Glassmorphic UI (Space Grotesk / Inter / JetBrains Mono)  |   |
|   +-------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------+
```

---

## 2. Component Breakdown

### 2.1 Computer Vision Engine (`backend/app/services/vision_engine.py`)
- **Model:** Ultralytics YOLOv8 Nano (`yolov8n.pt`), optimized for CPU inference. Runs once per frame, filtering strictly for COCO Class 0 (`person`) with default confidence threshold $0.35$.
- **Tracking:** `SimpleCentroidTracker` with distance and IoU thresholding to prevent double counting and maintain identity as shoppers advance in queue.
- **Foot Anchor Coordinate:** Computes bottom-center foot coordinates $(x_1+x_2)/2, y_2$ rather than torso/head, avoiding false positives from customers browsing adjacent aisle shelving.
- **Streaming:** Provides an MJPEG multipart HTTP stream (`/api/live/stream`) for direct HTML video tag rendering without WebRTC overhead.

### 2.2 Polygon Service (`backend/app/services/polygon_service.py`)
- Uses `cv2.pointPolygonTest` to map customer normalized coordinates $[0..1]$ to $N$-vertex polygons.
- Handles non-convex and angled supermarket counter layouts.
- Supports interactive live dragging of vertices directly in the browser.

### 2.3 Waiting-Time & Congestion Engine (`backend/app/services/queue_analytics.py`)
- Applies Little's Law formula: $W = N_{\text{ahead}} \times S_{\text{eff}}$.
- Implements rolling-window median smoothing ($W=5$) to prevent jitter from momentary occlusion.
- Dynamically upgrades from configured assumptions to empirical throughput once $\ge 6$ checkout departures are logged.

### 2.4 Shop-Owner Recommendation Engine (`backend/app/services/recommendation_engine.py`)
- Evaluates queue metrics against deterministic supermarket operational rules:
  1. **Critical Overload:** Recommends opening auxiliary counter or deploying secondary bagger.
  2. **Severe Queue Imbalance:** Suggests redirecting incoming shoppers from slow to fast counter.
  3. **Systemic Store Congestion:** Alerts management when all counters cross threshold simultaneously.
  4. **Occlusion & Cutoff Warning:** Detects when shoppers linger near the frame boundary, suggesting camera angle tilt.

### 2.5 Local-First Database Layer (`backend/app/database.py`)
- **SQLite 3:** File-based, zero configuration, zero cloud cost (`backend/data/queueiq.db`).
- Stores historical aggregate measurements every $8$ seconds, active alerts, recommendations, and polygon coordinates.
- Provides immediate CSV export functionality.

### 2.6 Frontend Dashboard (`frontend/src/`)
- Built with **Next.js 14**, **React 18**, and **Tailwind CSS**.
- **Interactive Polygon Canvas:** Allows store operators to reshape queue regions in real-time.
- **Live Telemetry Chips:** Displays real-time FPS, CPU inference latency (ms), model status, and camera state.
- **Prominent Demo Mode:** Clearly distinguishes simulated presentation feeds from real camera measurements.
