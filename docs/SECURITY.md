# QueueIQ AI — Cybersecurity & Privacy Architecture

## 1. Threat Model & Privacy Principles

Traditional computer vision retail analytics systems often attract significant privacy scrutiny due to facial recognition or cloud video storage. QueueIQ AI enforces strict, privacy-by-design standards:

### 1.1 Zero Biometrics & Zero Facial Recognition
- **Detection Scope:** The YOLO model is constrained exclusively to COCO Class 0 (`person`) bounding boxes.
- **No Facial Features:** The system does not extract facial landmarks, facial encodings, gender, age, or biometric identifiers.
- **No Person Re-Identification:** Track IDs are temporary, volatile integers maintained strictly in volatile RAM while a customer stands in a queue. Once a customer departs the counter area, their track ID is deregistered and erased.

### 1.2 Local-First In-Memory Processing
- Raw video frames captured from the laptop webcam or video file are processed strictly in volatile memory (RAM buffers).
- **No Raw Video Storage:** Raw video streams are never saved to disk or transmitted across external networks.
- **Aggregate-Only Persistence:** The local SQLite database stores only aggregate numeric counts (e.g. `people_count: 3`, `wait_time_sec: 270`, `timestamp: 2026-10-16 10:15:00`).

---

## 2. Authentication & Session Management

### 2.1 Local Development Authentication (Default)
- For hackathons and local test environments, QueueIQ AI features a self-contained, signed JWT authentication service (`backend/app/services/auth_service.py`).
- Tokens are signed using HMAC-SHA256 with a local server secret key (`SECRET_KEY`).
- Token payloads include issue time (`iat`), expiration (`exp`), and user role (`STORE_OWNER`).
- When running in development mode without external keys, sessions are clearly tagged as `is_dev_mode: true` to prevent false claims of production OAuth.

### 2.2 Optional Google OAuth 2.0 Integration
QueueIQ AI is engineered to integrate with Google OAuth 2.0 without requiring paid authentication intermediaries (e.g. Firebase or Auth0):
1. **Google Cloud Console:** Create a free project and configure an OAuth 2.0 Client ID for Web Applications.
2. **Authorized JavaScript Origins:** Add `http://localhost:3000`.
3. **Authorized Redirect URIs:** Add `http://localhost:3000/api/auth/callback/google`.
4. **Environment Variables:**
   ```bash
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   ```
5. **Free-Tier Limits & Restrictions:**
   - Google OAuth free tier allows up to 100 sensitive scope consents in "Testing" mode or unlimited logins in "Published" mode with verification.
   - For an internal supermarket manager dashboard, Google OAuth provides secure identity verification without recurring fees.

---

## 3. Operational Protections

| Protection | Implementation | Local Dev vs Production Note |
|---|---|---|
| **CORS Policy** | FastAPI `CORSMiddleware` | Configured for `localhost:3000` & `127.0.0.1:8000`. In production, restrict to verified supermarket intranet domain. |
| **SQL Injection Prevention** | SQLite Parameterized Queries | 100% of SQLite database interactions use parameterized placeholders (`?`). Never string-concatenated. |
| **Alert Flood Prevention** | Cooldown Debouncing | 45-second cooldown per counter suppresses alert spamming. |
| **Camera Cleanup on Exit** | Graceful Lifespan Shutdown | Python `VideoCapture.release()` is automatically executed on application shutdown or camera switch. |
| **Secret Management** | Environment Variables | All sensitive keys are loaded via `.env` and excluded from Git commits via `.gitignore`. |
