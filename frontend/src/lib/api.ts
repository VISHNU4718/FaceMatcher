import type {
  EmotionResponse,
  Face,
  IdentifyResponse,
  LiveMatchResponse,
  VideoMatchResponse,
  VideoMatchResult,
} from '../types';
import { loadEngine } from './engine';
import { addFace, getAllFaces, removeFace } from './gallery';
import {
  ASSUMED_FPS,
  Box,
  LIVE_MATCH_CONFIDENCE,
  distanceToConfidence,
  euclidean,
  identify,
  normaliseEmotions,
  round,
  sampleTimes,
  toBbox,
} from './matching';

/** Face detection, recognition and emotion analysis, all running in the browser. */

export class AppError extends Error {}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AppError) return err.message;
  console.error(err);
  return fallback;
}

export const MAX_NAME_LENGTH = 60;
const MAX_STILL_SIDE = 1024;
const MAX_VIDEO_SIDE = 640;
const MIN_EMOTION_FACE = 40;

// ---------------------------------------------------------------- images

interface Still {
  canvas: HTMLCanvasElement;
  /** canvas size / original size, so boxes can be mapped back to the original image */
  scale: number;
  width: number;
  height: number;
}

function drawScaled(source: CanvasImageSource, w: number, h: number, maxSide: number): Still {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { canvas, scale, width: w, height: h };
}

async function loadStill(file: Blob): Promise<Still> {
  if (!file.type.startsWith('image/')) throw new AppError('That file is not an image.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new AppError('This image could not be read. Try a JPG or PNG.');
  }
  try {
    return drawScaled(bitmap, bitmap.width, bitmap.height, MAX_STILL_SIDE);
  } finally {
    bitmap.close();
  }
}

/** Downscale an image so its longest side is at most `maxDim`. Used by the upload drop zones. */
export async function compressImage(file: File, maxDim: number): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (Math.max(bitmap.width, bitmap.height) <= maxDim) {
      bitmap.close();
      return file;
    }
    const still = drawScaled(bitmap, bitmap.width, bitmap.height, maxDim);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => still.canvas.toBlob(res, 'image/jpeg', 0.9));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

function area(b: Box): number {
  return b.width * b.height;
}

function thumbnail(canvas: HTMLCanvasElement, box: Box): string {
  const margin = 0.35;
  const size = Math.max(box.width, box.height) * (1 + margin * 2);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const sx = Math.max(0, cx - size / 2);
  const sy = Math.max(0, cy - size / 2);
  const sw = Math.min(size, canvas.width - sx);
  const sh = Math.min(size, canvas.height - sy);
  const out = document.createElement('canvas');
  out.width = out.height = 192;
  out.getContext('2d')!.drawImage(canvas, sx, sy, sw, sh, 0, 0, 192, 192);
  return out.toDataURL('image/jpeg', 0.8);
}

// ---------------------------------------------------------------- gallery

export async function listFaces(): Promise<Face[]> {
  const all = await getAllFaces();
  return all.map((stored) => {
    const face: Face & { descriptor?: number[] } = { ...stored };
    delete face.descriptor;
    return face;
  });
}

export async function deleteFace(id: number): Promise<void> {
  if (!(await removeFace(id))) throw new AppError('Face not found.');
}

export async function registerFace(name: string, file: Blob): Promise<Face> {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError('Enter a name.');
  if (trimmed.length > MAX_NAME_LENGTH) throw new AppError(`Names can be at most ${MAX_NAME_LENGTH} characters.`);
  const faceapi = await loadEngine();
  const still = await loadStill(file);
  const found = await faceapi
    .detectAllFaces(still.canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (found.length === 0) throw new AppError('No face detected in the provided image.');
  const biggest = found.reduce((a, b) => (area(b.detection.box) > area(a.detection.box) ? b : a));
  return addFace(trimmed, biggest.descriptor, thumbnail(still.canvas, biggest.detection.box));
}

export async function identifyFaces(file: Blob): Promise<IdentifyResponse> {
  const faceapi = await loadEngine();
  const still = await loadStill(file);
  const found = await faceapi
    .detectAllFaces(still.canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  const gallery = await getAllFaces();
  const results = found.map((f) => ({
    bbox: toBbox(f.detection.box, still.scale),
    ...identify(f.descriptor, gallery),
  }));
  return { results, face_count: found.length };
}

// ---------------------------------------------------------------- emotion

/** Accepts an uploaded image, or a canvas holding a webcam frame (analysed with the faster detector). */
export async function detectEmotion(source: Blob | HTMLCanvasElement): Promise<EmotionResponse> {
  const faceapi = await loadEngine();
  let canvas: HTMLCanvasElement;
  let scale = 1;
  let options;
  if (source instanceof HTMLCanvasElement) {
    canvas = source;
    options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
  } else {
    const still = await loadStill(source);
    canvas = still.canvas;
    scale = still.scale;
    options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
  }
  const found = await faceapi.detectAllFaces(canvas, options).withFaceLandmarks().withFaceExpressions();
  const faces = found
    .filter((f) => f.detection.box.width / scale >= MIN_EMOTION_FACE && f.detection.box.height / scale >= MIN_EMOTION_FACE)
    .map((f) => {
      const { dominant, emotions } = normaliseEmotions({ ...f.expressions });
      const b = f.detection.box;
      return {
        dominant_emotion: dominant,
        emotions,
        region: {
          x: Math.round(b.x / scale),
          y: Math.round(b.y / scale),
          w: Math.round(b.width / scale),
          h: Math.round(b.height / scale),
        },
      };
    });
  const first = faces[0];
  return {
    dominant_emotion: first?.dominant_emotion ?? '',
    emotions: first?.emotions ?? {},
    face_detected: faces.length > 0,
    faces,
  };
}

// ---------------------------------------------------------------- video

export interface VideoScanOptions {
  reference: Blob;
  video: File;
  /** minimum confidence (1 - distance) to report a match */
  threshold: number;
  /** analyse one frame in every `frameSkip`, assuming ASSUMED_FPS */
  frameSkip: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
      reject(new AppError('The video could not be decoded.'));
    };
    video.addEventListener('seeked', done);
    video.addEventListener('error', fail);
    video.currentTime = time;
  });
}

function openVideo(file: File): Promise<{ video: HTMLVideoElement; release: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const release = () => URL.revokeObjectURL(url);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        release();
        reject(new AppError('This video has no readable duration.'));
      } else {
        resolve({ video, release });
      }
    };
    video.onerror = () => {
      release();
      reject(new AppError('This video format is not supported by your browser. Try an MP4 (H.264) or WebM.'));
    };
    video.src = url;
  });
}

export async function matchVideo(opts: VideoScanOptions): Promise<VideoMatchResponse> {
  const { reference, video: file, threshold, frameSkip, onProgress, signal } = opts;
  if (!(threshold > 0 && threshold <= 1)) throw new AppError('Threshold must be between 0 and 1.');
  const faceapi = await loadEngine();

  const refStill = await loadStill(reference);
  const refFaces = await faceapi
    .detectAllFaces(refStill.canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (refFaces.length === 0) throw new AppError('No face detected in reference image.');
  const refDescriptor = refFaces.reduce((a, b) => (area(b.detection.box) > area(a.detection.box) ? b : a)).descriptor;

  const { video, release } = await openVideo(file);
  try {
    const times = sampleTimes(video.duration, frameSkip);
    const detector = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
    const matches: VideoMatchResult[] = [];

    for (let i = 0; i < times.length; i++) {
      if (signal?.aborted) throw new AppError('Scan cancelled.');
      await seek(video, Math.min(times[i], Math.max(0, video.duration - 0.05)));
      const frame = drawScaled(video, video.videoWidth, video.videoHeight, MAX_VIDEO_SIDE);
      const found = await faceapi.detectAllFaces(frame.canvas, detector).withFaceLandmarks().withFaceDescriptors();

      let best: { confidence: number; box: Box } | null = null;
      for (const f of found) {
        const confidence = distanceToConfidence(euclidean(refDescriptor, f.descriptor));
        if (confidence >= threshold && (!best || confidence > best.confidence)) {
          best = { confidence, box: f.detection.box };
        }
      }
      if (best) {
        matches.push({
          timestamp_seconds: round(times[i], 2),
          frame_number: Math.round(times[i] * ASSUMED_FPS),
          confidence: round(best.confidence, 3),
          bbox: toBbox(best.box, frame.scale),
          frame_url: frame.canvas.toDataURL('image/jpeg', 0.8),
        });
      }
      onProgress?.(i + 1, times.length);
    }
    return {
      total_frames_scanned: times.length,
      video_duration_seconds: round(video.duration, 2),
      fps: ASSUMED_FPS,
      matches,
    };
  } finally {
    release();
  }
}

// ---------------------------------------------------------------- live camera

export class LiveMatcher {
  private constructor(
    private readonly faceapi: typeof import('@vladmandic/face-api'),
    private readonly reference: Float32Array,
  ) {}

  static async create(reference: Blob): Promise<LiveMatcher> {
    const faceapi = await loadEngine();
    const still = await loadStill(reference);
    const found = await faceapi
      .detectAllFaces(still.canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    if (found.length === 0) throw new AppError('No face in reference image.');
    const biggest = found.reduce((a, b) => (area(b.detection.box) > area(a.detection.box) ? b : a));
    return new LiveMatcher(faceapi, biggest.descriptor);
  }

  async process(video: HTMLVideoElement): Promise<LiveMatchResponse> {
    const t0 = performance.now();
    const options = new this.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    const found = await this.faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
    const matches = found.map((f) => {
      const confidence = distanceToConfidence(euclidean(this.reference, f.descriptor));
      return {
        bbox: toBbox(f.detection.box),
        confidence: round(confidence, 3),
        is_match: confidence >= LIVE_MATCH_CONFIDENCE,
      };
    });
    return { matches, face_count: found.length, processing_ms: Math.round(performance.now() - t0) };
  }
}
