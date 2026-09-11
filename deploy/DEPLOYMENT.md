# V-DOCKX Deployment Guide & Architecture Manual

This document outlines the recommended deployment architectures for V-DOCKX, from local edge lab testing to cloud VPS and multi-cloud PaaS hosting.

---

## Architecture Summary

V-DOCKX consists of two main decoupled tiers:
1. **Next.js 16 Web Dashboard & Camera Transmitter**:
   - Client-side AR HUD, real-time 2D Arena Canvas with Bézier dynamic rerouting, mobile camera video transmitter (`/camera`), and mission control.
2. **FastAPI & WebSocket Telemetry Server**:
   - Real-time kinematic visual servoing, ArUco 6-DoF pose estimation, line tracking, semantic obstacle perception, and high-frequency (`10Hz-30Hz`) telemetry broadcast.
3. **Nginx Ingress Gateway (Reverse Proxy)**:
   - Unifies both frontend and backend under a single port (`80` / `443`), routing `/api` and `/ws` to FastAPI and `/` to Next.js.

---

## Deployment Strategy Comparison

| Strategy | Latency | Mobile Camera Access | Internet Required | Best Used For |
| :--- | :--- | :--- | :--- | :--- |
| **1. Local Host / Edge Compute** *(Recommended)* | **< 15 ms** | USB ADB / Wi-Fi Hotspot | No (Offline) | Real-world robotics, physical lab testing, low latency docking |
| **2. Docker Compose on Cloud VPS** | ~40 - 80 ms | Full HTTPS/WSS (Certbot) | Yes | Remote live demos, public hackathons, team collaboration |
| **3. Hybrid PaaS (Vercel + Railway)** | ~60 - 120 ms | Automatic HTTPS | Yes | Fast staging without managing virtual machine infrastructure |

---

## 🚀 Strategy 1: Local Host / Edge Lab Deployment (Recommended)

Because visual servoing and collision detection involve continuous video frame streaming and high-frequency motion commands, running the backend locally on the robot's edge compute (e.g., Raspberry Pi 5, NVIDIA Jetson, or Laptop) provides the lowest latency and highest safety margins.

### Option A: 1-Click Windows / Mac Launcher
1. Make sure Python 3.10+ and Node.js 18+ are installed.
2. If using USB tethering to your Android smartphone, ensure USB debugging is enabled.
3. Run the deployment script:
   ```powershell
   .\deploy\start_local.bat
   ```
   *(or `./deploy/start_local.sh` on Linux / macOS)*

### Option B: Local Docker Compose
```bash
docker compose up -d
```
- Open Mission Control: `http://localhost/` (or `http://localhost:3000`)
- Open Mobile Transmitter: `http://localhost/camera` (or `http://localhost:3000/camera`)

---

## 🌐 Strategy 2: Cloud VPS Deployment (DigitalOcean / AWS / Hetzner)

For a public demonstration where anyone with a smartphone can scan a QR code and pilot or stream video into the mission control:

### 1. Provision Ubuntu 22.04/24.04 Server
Install Docker & Docker Compose:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

### 2. Clone Repository & Start Containers
```bash
git clone https://github.com/your-org/V-DOCKX.git
cd V-DOCKX
docker compose up -d --build
```

### 3. HTTPS Setup (Mandatory for Mobile Phone Camera)
> **Crucial Requirement**: Modern mobile browsers (iOS Safari, Android Chrome) block camera streaming (`getUserMedia`) on unencrypted HTTP remote IP addresses. Camera access is only allowed on `http://localhost` or secure `https://` contexts!

To configure free SSL using Certbot / Let's Encrypt:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dock.yourdomain.com
```

Alternatively, use **Cloudflare Tunnels** for zero-configuration SSL without opening router ports:
```bash
cloudflared tunnel --url http://localhost:80
```
This generates an instant HTTPS URL (e.g. `https://vdockx.trycloudflare.com`) where mobile camera permissions are automatically allowed!

---

## ☁️ Strategy 3: Multi-Cloud PaaS (Vercel + Railway/Render)

If you prefer serverless/managed infrastructure:

### Backend (Railway / Render):
1. Deploy from the `backend/` directory or root repository.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Note your public backend URL (e.g., `https://vdockx-api.up.railway.app`).

### Frontend (Vercel):
1. Import the repository into Vercel and set the Root Directory to `frontend`.
2. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://vdockx-api.up.railway.app`
   - `NEXT_PUBLIC_WS_URL`: `wss://vdockx-api.up.railway.app/ws/telemetry`
3. Deploy!

---

## Production Health Checks & Verification

Verify that all services are operational after deployment:

1. **Backend Status Check**:
   ```bash
   curl http://localhost:8000/api/status
   ```
2. **Quantitative Analytics**:
   ```bash
   curl http://localhost:8000/api/analytics
   ```
3. **Camera Frame Endpoint**:
   ```bash
   curl http://localhost:3000/api/camera/frame
   ```
4. **Automated Verification Suite**:
   ```bash
   python scripts/run_all_tests.py
   ```
