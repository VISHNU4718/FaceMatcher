# FaceMatcher — AI Face Recognition System

Real-time face recognition web app with four modules: video scanning, live webcam matching, a searchable face database, and emotion detection.

**Stack:** FastAPI · face_recognition · DeepFace · OpenCV · React (Vite + TS) · Tailwind CSS · Framer Motion · SQLite

---

## Features

| Module | Route | Description |
|--------|-------|-------------|
| Video Match | `/video` | Upload reference face + video → scan every N frames → matched frame thumbnails with timestamps and confidence rings |
| Live Camera | `/live` | Webcam stream → WebSocket → real-time face bbox overlay with MATCH DETECTED alert |
| Face Database | `/database` | Register named faces in SQLite → identify faces in any photo → annotated results |
| Emotion Detect | `/emotion` | Upload or webcam snapshot → DeepFace → dominant emotion + animated 7-emotion bar chart |

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> **Windows note:** `face_recognition` requires dlib. Install pre-built wheels:
> ```
> pip install dlib-19.24.1-cp311-cp311-win_amd64.whl
> pip install face_recognition
> ```
> Or run inside WSL / Docker.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Architecture

```
browser ──REST/WS──► FastAPI (port 8000)
                       ├── face_recognition (dlib HOG)   # encoding + matching
                       ├── DeepFace (TF/Keras)            # emotion analysis
                       ├── OpenCV                         # frame extraction
                       └── SQLite                         # face registry
```

- Face encodings stored as `float64` BLOBs in SQLite, cached in-memory on startup
- Confidence = `1 - face_recognition_distance` (range 0–1, higher = better match)
- WebSocket frames capped at 6 fps client-side to avoid transport overload

## Deploy

### Backend → Render

1. Push repo to GitHub
2. New Render service → **Web Service** → **Docker** runtime
3. Root directory: `backend/` or use `render.yaml` at repo root
4. Free plan · port 10000 · ~30s cold start on first request

> **Warning:** DeepFace downloads ~200 MB of model weights on first use. Render free tier (512 MB RAM) may OOM under concurrent load. Upgrade to Hobby tier for production.

### Frontend → Vercel

```bash
cd frontend
npm run build
```

1. Push repo to GitHub
2. New Vercel project → import repo
3. Framework: **Vite**
4. Root directory: `frontend/`
5. Add env var: `VITE_API_URL=https://your-render-service.onrender.com`

`vercel.json` already handles SPA routing rewrites.

## Environment Variables

| File | Variable | Value |
|------|----------|-------|
| `frontend/.env.development` | `VITE_API_URL` | `http://localhost:8000` |
| `frontend/.env.production` | `VITE_API_URL` | your Render URL |

## Credits

Built by Vashishta, Vishnu, Srinesh
