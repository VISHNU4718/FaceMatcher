# FaceMatcher

A face recognition web app that runs entirely in the browser. Nothing is uploaded: photos, video frames and webcam frames are processed on your device with [`@vladmandic/face-api`](https://github.com/vladmandic/face-api) (TensorFlow.js). Registered faces are kept in the browser's IndexedDB.

**Live demo:** https://facematcher-mu.vercel.app

## Modules

| Route | What it does |
|-------|--------------|
| `/video` | Pick a reference photo and a video. The video is sampled every N frames, and each sampled frame is compared with the reference. Matches are shown with timestamp, confidence and a thumbnail, and can be exported as JSON. Progress is real, and a scan can be cancelled. |
| `/live` | Webcam matching against a reference photo, with a box and confidence drawn on every face. |
| `/database` | Register named faces, search them, delete them, and identify the people in any photo against the saved gallery. |
| `/emotion` | Upload a photo or use the webcam. Shows the dominant expression and the probability of each of seven. |
| `/` | Dashboard with the gallery size, activity from this browser and the status of the models. |

## How it works

- Detection uses SSD MobileNet v1 for still images and the Tiny Face Detector for video and webcam, where speed matters.
- Recognition uses face-api's 128-number face descriptor. Confidence is `1 - euclidean distance`, clamped to 0..1. A face is named in the gallery when confidence is at least 0.40, and a live face counts as a match at 0.45. Video matches use the threshold slider.
- Emotion comes from face-api's expression network. Its labels are mapped to happy, sad, angry, fear, surprise, disgust and neutral.
- The models (about 13 MB) are in `frontend/public/models` and are loaded the first time they are needed. WebGL is used when available, with CPU as a fallback.

## Limits

- Accuracy is that of face-api's small models. It is a demo-grade recogniser, not dlib/DeepFace-grade, and it is not suitable for anything where a wrong match matters.
- Browsers do not expose a video's frame rate, so "every N frames" assumes 30 fps. At most 240 frames are scanned per video. Longer videos are sampled more sparsely.
- Video uploads are limited to 100 MB and images to 5 MB.
- The gallery and the activity log live in this browser only. Clearing site data removes them.
- Speed depends on the device. Without WebGL the CPU backend is noticeably slower.

## Development

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests for matching, gallery storage and activity log
npm run build      # type-check and production build
```

The tests cover the pure matching code (distance, identification, emotion mapping, frame sampling), the IndexedDB gallery (with `fake-indexeddb`) and the activity log. The model-backed paths are checked by hand in a real browser.

## Deployment

The app is a static Vite build. The root `vercel.json` installs and builds in `frontend/`, publishes `frontend/dist` and rewrites all routes to `index.html`. Import the repository on Vercel with the default root directory.

## History

The first version used a FastAPI backend (`face_recognition`, DeepFace, OpenCV, SQLite, WebSocket). It needed dlib and TensorFlow on a server with persistent disk, so it could not be hosted for free and was replaced by this browser implementation. It is still available in git history.
