import type * as FaceApi from '@vladmandic/face-api';

/**
 * Loads face-api.js (TensorFlow.js) and its model weights, which are served from /models.
 * Everything runs in the browser; no image or video is uploaded anywhere.
 */

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EngineState {
  status: EngineStatus;
  backend: string | null;
  error: string | null;
}

let state: EngineState = { status: 'idle', backend: null, error: null };
let loading: Promise<typeof FaceApi> | null = null;
const listeners = new Set<() => void>();

function setState(next: EngineState): void {
  state = next;
  listeners.forEach((fn) => fn());
}

export function getEngineState(): EngineState {
  return state;
}

export function subscribeEngine(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadEngine(): Promise<typeof FaceApi> {
  if (loading) return loading;
  setState({ status: 'loading', backend: null, error: null });
  loading = (async () => {
    const faceapi = await import('@vladmandic/face-api');
    // face-api re-exports TensorFlow.js but its bundled typings are incomplete.
    const tf = faceapi.tf as unknown as {
      setBackend(name: string): Promise<boolean>;
      ready(): Promise<void>;
      getBackend(): string;
    };
    if (!(await tf.setBackend('webgl'))) await tf.setBackend('cpu');
    await tf.ready();
    const base = `${import.meta.env.BASE_URL}models`;
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(base),
      faceapi.nets.tinyFaceDetector.loadFromUri(base),
      faceapi.nets.faceLandmark68Net.loadFromUri(base),
      faceapi.nets.faceRecognitionNet.loadFromUri(base),
      faceapi.nets.faceExpressionNet.loadFromUri(base),
    ]);
    setState({ status: 'ready', backend: tf.getBackend(), error: null });
    return faceapi;
  })().catch((err: unknown) => {
    loading = null;
    setState({
      status: 'error',
      backend: null,
      error: err instanceof Error ? err.message : 'Could not load the face models.',
    });
    throw err;
  });
  return loading;
}
