/** Pure helpers for comparing faces. No browser or model dependencies, so they are unit-tested. */

export type Bbox = [top: number, right: number, bottom: number, left: number];

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Known {
  id: number;
  name: string;
  descriptor: ArrayLike<number>;
}

/** Confidence at or above which a face in a photo is named, when identifying against the gallery. */
export const IDENTIFY_MIN_CONFIDENCE = 0.4;
/** Confidence at or above which a live-camera face counts as a match. */
export const LIVE_MATCH_CONFIDENCE = 0.45;

export function euclidean(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new Error('Descriptors must have the same length.');
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Distance 0 -> confidence 1; distance >= 1 -> confidence 0. Higher is a closer match. */
export function distanceToConfidence(distance: number): number {
  return Math.min(1, Math.max(0, 1 - distance));
}

export function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function toBbox(box: Box, scale = 1): Bbox {
  const inv = 1 / scale;
  return [
    Math.round(box.y * inv),
    Math.round((box.x + box.width) * inv),
    Math.round((box.y + box.height) * inv),
    Math.round(box.x * inv),
  ];
}

export interface Identification {
  name: string;
  confidence: number;
  face_id: number | null;
}

/** Best gallery match for one descriptor. Faces below `minConfidence` are "Unknown". */
export function identify(
  descriptor: ArrayLike<number>,
  gallery: Known[],
  minConfidence = IDENTIFY_MIN_CONFIDENCE,
): Identification {
  let best: Known | null = null;
  let bestDistance = Infinity;
  for (const known of gallery) {
    const d = euclidean(descriptor, known.descriptor);
    if (d < bestDistance) {
      bestDistance = d;
      best = known;
    }
  }
  if (!best) return { name: 'Unknown', confidence: 0, face_id: null };
  const confidence = distanceToConfidence(bestDistance);
  if (confidence < minConfidence) return { name: 'Unknown', confidence: round(confidence, 3), face_id: null };
  return { name: best.name, confidence: round(confidence, 3), face_id: best.id };
}

/** face-api's expression labels -> the labels the UI uses. */
const EXPRESSION_LABELS: Record<string, string> = {
  neutral: 'neutral',
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  fearful: 'fear',
  disgusted: 'disgust',
  surprised: 'surprise',
};

export function normaliseEmotions(raw: Record<string, number>): {
  dominant: string;
  emotions: Record<string, number>;
} {
  const mapped: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const label = EXPRESSION_LABELS[key];
    if (label) mapped[label] = Math.max(0, value);
  }
  const total = Object.values(mapped).reduce((s, v) => s + v, 0) || 1;
  const emotions: Record<string, number> = {};
  let dominant = '';
  let top = -1;
  for (const [label, value] of Object.entries(mapped)) {
    emotions[label] = round(value / total, 4);
    if (value > top) {
      top = value;
      dominant = label;
    }
  }
  return { dominant, emotions };
}

/** Browsers do not expose a video's frame rate, so "every N frames" is converted using this. */
export const ASSUMED_FPS = 30;
export const MAX_VIDEO_SAMPLES = 240;

/**
 * Timestamps (seconds) at which a video is sampled: one every `frameSkip` frames at the assumed
 * frame rate, spaced out further if that would exceed `maxSamples`.
 */
export function sampleTimes(
  duration: number,
  frameSkip: number,
  fps = ASSUMED_FPS,
  maxSamples = MAX_VIDEO_SAMPLES,
): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  if (!Number.isInteger(frameSkip) || frameSkip < 1) throw new Error('Frame skip must be a whole number of at least 1.');
  let step = frameSkip / fps;
  if (duration / step > maxSamples) step = duration / maxSamples;
  const times: number[] = [];
  for (let t = 0; t < duration; t += step) times.push(round(t, 3));
  return times;
}
