import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Camera, X, Zap, Smile, Activity, Cpu, Eye } from 'lucide-react';
import { useToast } from '../App';
import { detectEmotion, errorMessage } from '../lib/api';
import { useEngine } from '../lib/useEngine';
import { EmotionResponse, EmotionFace } from '../types';
import { EMOTION_EMOJI, EMOTION_COLOR } from '../lib/utils';
import PageHeader from '../components/PageHeader';
import Chip from '../components/Chip';
import EmptyState from '../components/EmptyState';
import { recordActivity } from '../lib/activity';

const PAGE = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

interface HistoryItem {
  id: string;
  preview: string;
  result: EmotionResponse;
  ts: string;
}

export default function EmotionDetect() {
  const { toast } = useToast();
  useEngine();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmotionResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [webcamMode, setWebcamMode] = useState(false);
  const [liveDetecting, setLiveDetecting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectingRef = useRef(false);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const liveLoggedRef = useRef(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastLatency, setLastLatency] = useState<number | null>(null);

  function drawOverlay(faces: EmotionFace[]) {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const face of faces) {
      const { x, y, w, h } = face.region;
      if (!w || !h) continue;
      const color = EMOTION_COLOR[face.dominant_emotion] ?? '#94a3b8';
      const emoji = EMOTION_EMOJI[face.dominant_emotion] ?? '😐';
      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      // Corner brackets
      const cs = 10;
      ctx.lineWidth = 3;
      [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(([bx,by,dx,dy]) => {
        ctx.beginPath(); ctx.moveTo(bx as number,(by as number)+(dy as number)*cs); ctx.lineTo(bx as number,by as number); ctx.lineTo((bx as number)+(dx as number)*cs,by as number); ctx.stroke();
      });
      // Label background
      const labelY = y > 30 ? y - 28 : y + h;
      ctx.fillStyle = color + 'dd';
      ctx.fillRect(x, labelY, w, 26);
      // Label text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px JetBrains Mono, monospace';
      ctx.fillText(`${emoji} ${face.dominant_emotion}`, x + 6, labelY + 17);
    }
  }

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast('Image too large (max 5 MB).', 'error'); return; }
    setFile(f);
    setResult(null);
    e.target.value = '';
  }

  useEffect(() => {
    if (webcamMode && result?.faces) {
      drawOverlay(result.faces);
    }
  }, [result, webcamMode]);

  async function captureAndDetect() {
    if (detectingRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    {
      detectingRef.current = true;
      setLiveDetecting(true);
      try {
        const t = performance.now();
        const data = await detectEmotion(canvas);
        setLastLatency(Math.round(performance.now() - t));
        setSessionCount((c) => c + 1);
        if (!data.face_detected || !data.faces || data.faces.length === 0) {
          setResult({ dominant_emotion: '', emotions: {}, face_detected: false, faces: [] });
          detectingRef.current = false;
          setLiveDetecting(false);
          return;
        }
        setResult(data);
        if (!liveLoggedRef.current && data.face_detected && data.dominant_emotion) {
          liveLoggedRef.current = true;
          recordActivity({
            kind: 'emotion',
            title: `Live emotion session`,
            detail: `First read: ${data.dominant_emotion}`,
            meta: { dominant: data.dominant_emotion },
          });
        }
      } catch { /* silent on individual frame errors */ }
      finally {
        detectingRef.current = false;
        setLiveDetecting(false);
      }
    }
  }

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      videoRef.current!.srcObject = stream;
      await videoRef.current!.play();
      setWebcamMode(true);
      setResult(null);
      liveLoggedRef.current = false;
      setSessionCount(0);
      setTimeout(() => {
        captureAndDetect();
        liveIntervalRef.current = setInterval(captureAndDetect, 1000);
      }, 600);
    } catch {
      toast('Camera access denied.', 'error');
    }
  }

  function stopWebcam() {
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const oc = overlayRef.current;
    if (oc) oc.getContext('2d')?.clearRect(0, 0, oc.width, oc.height);
    setWebcamMode(false);
    setLiveDetecting(false);
  }

  async function analyse() {
    if (!file) { toast('Upload an image first.', 'warning'); return; }
    setLoading(true);
    try {
      const t = performance.now();
      const data = await detectEmotion(file);
      setLastLatency(Math.round(performance.now() - t));
      setResult(data);
      recordActivity({
        kind: 'emotion',
        title: `Detected: ${data.dominant_emotion || 'no face'}`,
        detail: file.name,
        meta: { dominant: data.dominant_emotion || 'none' },
      });
      if (preview) {
        const item: HistoryItem = {
          id: Math.random().toString(36).slice(2),
          preview,
          result: data,
          ts: new Date().toLocaleTimeString(),
        };
        setHistory((h) => [item, ...h].slice(0, 5));
      }
      if (data.face_detected) toast(`Dominant emotion: ${data.dominant_emotion}`, 'success');
      else toast('No face detected in this image.', 'warning');
    } catch (err: unknown) {
      toast(errorMessage(err, 'Analysis failed.'), 'error');
    } finally {
      setLoading(false);
    }
  }

  const sorted = result
    ? Object.entries(result.emotions).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <motion.div {...PAGE} className="flex flex-col gap-6">
      <PageHeader
        icon={Smile}
        eyebrow="MODULE · 04"
        title="Emotion Detection"
        accent="#F59E0B, #FB923C"
        subtitle="Live webcam emotion analysis or upload a photo — runs entirely in your browser."
      />

      {/* Telemetry strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EmoTile icon={Activity} label="Session reads" value={sessionCount} accent="#F59E0B" />
        <EmoTile icon={Eye} label="Faces detected" value={result?.faces?.length ?? 0} accent="#3B82F6" />
        <EmoTile icon={Cpu} label="Inference" value={lastLatency !== null ? `${lastLatency} ms` : '—'} accent="#8B5CF6" />
        <EmoTile icon={Smile} label="Mode" value={webcamMode ? 'Live' : 'Upload'} accent="#10B981" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
        {/* Upload / webcam */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex flex-col gap-3">
            {/* Toggle */}
            <div className="flex gap-1.5 p-1 rounded-xl border border-white/8 bg-white/[0.02]">
              <button
                onClick={() => { stopWebcam(); }}
                className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-all duration-150 flex items-center justify-center gap-1.5 ${
                  !webcamMode ? 'bg-white/[0.07] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Upload size={12} />Upload
              </button>
              <button
                onClick={webcamMode ? stopWebcam : startWebcam}
                className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-all duration-150 flex items-center justify-center gap-1.5 ${
                  webcamMode ? 'bg-white/[0.07] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Camera size={12} />Webcam
              </button>
            </div>

            <canvas ref={canvasRef} className="hidden" />
            <div className={webcamMode ? 'relative' : 'hidden'}>
              <video ref={videoRef} className="w-full rounded-xl" playsInline muted />
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none rounded-xl" />
              {/* Live badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
                <span className={`w-1.5 h-1.5 rounded-full ${liveDetecting ? 'bg-amber-400 animate-pulse' : 'bg-green-400 animate-ping'}`} />
                <span className="text-[10px] font-mono text-white uppercase tracking-widest">
                  {liveDetecting ? 'Analysing' : 'Live'}
                </span>
              </div>
              <button onClick={stopWebcam} className="absolute top-2 right-2 bg-black/60 hover:bg-red-600/80 text-white rounded-full p-1">
                <X size={12} />
              </button>
            </div>

            {!webcamMode && (
              <>
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="uploaded" className="w-full rounded-xl max-h-[280px] object-cover" />
                    <button
                      onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-red-600/80 text-white rounded-full p-1 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label
                    className="flex flex-col items-center justify-center gap-2 h-[180px] border-2 border-dashed border-blue-500/20 rounded-xl cursor-pointer hover:border-blue-500/40 transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload size={24} className="text-slate-600" />
                    <span className="text-xs text-slate-600 font-sans">Click or drag an image</span>
                    <span className="text-[10px] font-mono text-slate-700">JPG · PNG · max 5 MB</span>
                  </label>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
                <button
                  onClick={analyse}
                  disabled={loading || !file}
                  className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? 'Analysing…' : 'Detect Emotion'}
                </button>
              </>
            )}

            {webcamMode && (
              <p className="text-xs font-mono text-slate-600 text-center">
                <Zap size={10} className="inline mr-1 text-amber-500" />
                Auto-detecting every 1s
              </p>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="glass p-4 flex flex-col gap-3">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Recent</span>
              <div className="flex flex-col gap-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 bg-navy-800/50 rounded-xl px-3 py-2">
                    <img src={h.preview} alt="" className="w-10 h-10 object-cover rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-white truncate">
                        {EMOTION_EMOJI[h.result.dominant_emotion] ?? '😐'} {h.result.dominant_emotion}
                      </p>
                      <p className="text-[10px] font-mono text-slate-600">{h.ts}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {result && result.face_detected ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col gap-4"
            >
              {/* Dominant emotion hero */}
              <div
                className="relative overflow-hidden rounded-2xl border border-white/8 p-6 flex items-center gap-5"
                style={{
                  background: `linear-gradient(135deg, ${EMOTION_COLOR[result.dominant_emotion] ?? '#1e293b'}1F, rgba(13,18,38,0.4))`,
                }}
              >
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-30" style={{ background: EMOTION_COLOR[result.dominant_emotion] ?? '#94a3b8' }} />
                <motion.div
                  key={result.dominant_emotion}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 22 }}
                  className="relative w-24 h-24 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-6xl shrink-0"
                >
                  {EMOTION_EMOJI[result.dominant_emotion] ?? '😐'}
                </motion.div>
                <div className="relative flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-slate-400 tracking-[0.2em] uppercase mb-1.5">
                    Dominant signal
                  </p>
                  <p
                    className="font-syne font-bold text-3xl tracking-tight capitalize"
                    style={{ color: EMOTION_COLOR[result.dominant_emotion] ?? '#94a3b8' }}
                  >
                    {result.dominant_emotion || 'unknown'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Chip variant={result.face_detected ? 'emerald' : 'amber'}>
                      {result.face_detected ? 'Face detected' : 'No face'}
                    </Chip>
                    <Chip>face-api.js · in browser</Chip>
                    {result.faces?.length ? <Chip variant="blue">{result.faces.length} region(s)</Chip> : null}
                  </div>
                </div>
              </div>

              {/* Bar chart */}
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase">Probability distribution</span>
                  <Chip>7 classes</Chip>
                </div>
                <div className="flex flex-col gap-2.5">
                  {sorted.map(([emo, val], i) => (
                    <div key={emo} className="flex items-center gap-3">
                      <span className="text-base w-7 text-center">{EMOTION_EMOJI[emo] ?? '😐'}</span>
                      <span className="text-xs text-slate-400 capitalize w-16">{emo}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: EMOTION_COLOR[emo] ?? '#94a3b8' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${val * 100}%` }}
                          transition={{ delay: i * 0.04, duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-slate-300 w-12 text-right tabular-nums">
                        {(val * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insights */}
              {sorted.length >= 2 && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                  <span className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase">Insight</span>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    <span className="capitalize text-white font-semibold">{sorted[0][0]}</span> dominates at{' '}
                    <span className="font-mono text-blue-300">{(sorted[0][1] * 100).toFixed(1)}%</span>, leading{' '}
                    <span className="capitalize text-white">{sorted[1][0]}</span> by{' '}
                    <span className="font-mono text-blue-300">{((sorted[0][1] - sorted[1][1]) * 100).toFixed(1)} pts</span>.
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Smile}
                title={
                  webcamMode
                    ? result
                      ? 'No face in frame'
                      : 'Waiting for first read…'
                    : 'Awaiting input'
                }
                description={
                  webcamMode
                    ? result
                      ? 'Detector ran but no face was localised. Move into frame, check lighting, or look toward the camera.'
                      : 'Stand in frame — analysis runs every second.'
                    : 'Drop an image or switch to Webcam mode to start analysis.'
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function EmoTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Smile;
  label: string;
  value: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-25" style={{ background: accent }} />
      <div className="relative w-7 h-7 rounded-md flex items-center justify-center border border-white/10" style={{ background: `${accent}1A` }}>
        <Icon size={13} style={{ color: accent }} />
      </div>
      <p className="relative text-[10px] font-mono text-slate-500 tracking-widest uppercase mt-2.5">{label}</p>
      <p className="relative font-syne font-bold text-lg text-white mt-1 leading-none">{value}</p>
    </div>
  );
}
