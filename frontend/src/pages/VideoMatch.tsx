import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Download, ChevronRight, Clock, Film, Filter, SortDesc, Search, AlertCircle } from 'lucide-react';
import DropZone from '../components/DropZone';
import ConfidenceRing from '../components/ConfidenceRing';
import Skeleton from '../components/Skeleton';
import PageHeader from '../components/PageHeader';
import Chip from '../components/Chip';
import EmptyState from '../components/EmptyState';
import { recordActivity } from '../lib/activity';
import { useToast } from '../App';
import { errorMessage, matchVideo } from '../lib/api';
import { useEngine } from '../lib/useEngine';
import { VideoMatchResponse, VideoMatchResult } from '../types';
import { formatTime } from '../lib/utils';
import { ASSUMED_FPS, MAX_VIDEO_SAMPLES } from '../lib/matching';

const PAGE = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function VideoMatch() {
  const { toast } = useToast();
  const [refImg, setRefImg] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [threshold, setThreshold] = useState(0.6);
  const [frameSkip, setFrameSkip] = useState(5);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<VideoMatchResponse | null>(null);
  const [minConf, setMinConf] = useState(0);
  const [sortBy, setSortBy] = useState<'time' | 'conf'>('time');
  const [view, setView] = useState<'grid' | 'timeline'>('grid');
  const abortRef = useRef<AbortController | null>(null);
  const [scanLabel, setScanLabel] = useState('Loading models…');
  useEngine();

  const filteredMatches = (result?.matches ?? [])
    .filter((m) => m.confidence >= minConf)
    .sort((a, b) =>
      sortBy === 'time' ? a.timestamp_seconds - b.timestamp_seconds : b.confidence - a.confidence,
    );

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleSubmit() {
    if (!refImg || !video) { toast('Upload both reference image and video.', 'warning'); return; }
    setLoading(true);
    setResult(null);
    setProgress(0);
    setScanLabel('Loading models and reading the reference face…');
    abortRef.current = new AbortController();
    try {
      const data = await matchVideo({
        reference: refImg,
        video,
        threshold,
        frameSkip,
        signal: abortRef.current.signal,
        onProgress: (done, total) => {
          setProgress((done / total) * 100);
          setScanLabel(`Analysing frame ${done} of ${total}…`);
        },
      });
      setResult(data);
      recordActivity({
        kind: 'video',
        title: `Video scan: ${data.matches.length} match${data.matches.length === 1 ? '' : 'es'}`,
        detail: `${video.name} · ${data.total_frames_scanned} frames scanned · ${data.video_duration_seconds.toFixed(1)}s`,
        meta: { matches: data.matches.length, frames: data.total_frames_scanned },
      });
      if (data.matches.length === 0) {
        toast('No face matches found in video.', 'info');
      } else {
        toast(`Found ${data.matches.length} match${data.matches.length > 1 ? 'es' : ''}!`, 'success');
      }
    } catch (err: unknown) {
      setProgress(0);
      toast(errorMessage(err, 'Processing failed.'), 'error');
    } finally {
      setLoading(false);
    }
  }

  function exportJSON() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(
      { ...result, matches: result.matches.map(({ frame_url: _frame, ...m }) => m) },
      null,
      2,
    )], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'facematcher-results.json';
    a.click();
  }

  return (
    <motion.div {...PAGE} className="flex flex-col gap-6">
      <PageHeader
        icon={Film}
        eyebrow="MODULE · 01"
        title="Video Match"
        accent="#3B82F6, #06B6D4"
        subtitle="Scan a video for a reference face and extract matched frames with timestamps."
      />

      {/* Upload + config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DropZone accept="image" file={refImg} onFile={setRefImg} label="Reference Face" />
        <DropZone accept="video" file={video} onFile={setVideo} label="Target Video" />
      </div>

      {/* Config */}
      <div className="glass p-5 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        <div className="flex-1">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">
            Confidence Threshold
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="range" min={0.3} max={0.95} step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="font-mono text-blue-400 text-sm w-10 text-right">{(threshold * 100).toFixed(0)}%</span>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-mono">higher = stricter matching</p>
        </div>
        <div className="flex-1">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">
            Frame Skip
          </label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {[2, 5, 10, 15].map((n) => (
              <button
                key={n}
                onClick={() => setFrameSkip(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all duration-150 ${
                  frameSkip === n
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'border-blue-500/10 text-slate-500 hover:text-slate-300 hover:border-blue-500/25'
                }`}
              >
                every {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-1 font-mono">one frame every N, assuming {ASSUMED_FPS} fps (capped at {MAX_VIDEO_SAMPLES} frames per video)</p>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !refImg || !video}
        className="btn-primary flex items-center gap-2 self-start disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Play size={15} />
        {loading ? 'Processing…' : 'Scan Video'}
      </button>

      {/* Progress */}
      {loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">{scanLabel}</span>
            <span className="flex items-center gap-3">
              <span className="text-xs font-mono text-blue-400">{Math.floor(progress)}%</span>
              <button onClick={() => abortRef.current?.abort()} className="text-xs font-mono text-slate-400 hover:text-white">
                Cancel
              </button>
            </span>
          </div>
          <div className="progress-bar">
            <motion.div
              className="progress-fill"
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            <span className="text-xs text-slate-600 font-mono">Running face_recognition engine…</span>
          </div>
        </motion.div>
      )}

      {/* Skeleton */}
      {loading && !result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Skeleton className="h-40" count={4} />
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ResultStat label="Matches" value={result.matches.length} highlight={result.matches.length > 0} accent="#10B981" />
            <ResultStat label="Frames Scanned" value={result.total_frames_scanned} accent="#3B82F6" />
            <ResultStat label="Duration" value={formatTime(result.video_duration_seconds)} accent="#8B5CF6" />
            <ResultStat label="Assumed FPS" value={result.fps.toFixed(0)} accent="#F59E0B" />
          </div>

          {result.matches.length > 0 ? (
            <>
              {/* Filter bar */}
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter size={13} className="text-slate-500" />
                  <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">Min confidence</span>
                </div>
                <div className="flex gap-1.5">
                  {[0, 0.5, 0.7, 0.85].map((v) => (
                    <button
                      key={v}
                      onClick={() => setMinConf(v)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all ${
                        minConf === v
                          ? 'bg-blue-500/15 border-blue-500/40 text-blue-200'
                          : 'border-white/10 text-slate-400 hover:border-white/25'
                      }`}
                    >
                      {v === 0 ? 'all' : `${(v * 100).toFixed(0)}%+`}
                    </button>
                  ))}
                </div>
                <div className="w-px h-5 bg-white/10" />
                <div className="flex items-center gap-2">
                  <SortDesc size={13} className="text-slate-500" />
                  <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">Sort</span>
                </div>
                <div className="flex gap-1.5">
                  {(['time', 'conf'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSortBy(s)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all ${
                        sortBy === s
                          ? 'bg-blue-500/15 border-blue-500/40 text-blue-200'
                          : 'border-white/10 text-slate-400 hover:border-white/25'
                      }`}
                    >
                      {s === 'time' ? 'by time' : 'by confidence'}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={() => setView('grid')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono border ${
                      view === 'grid'
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setView('timeline')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono border ${
                      view === 'timeline'
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Timeline
                  </button>
                  <button onClick={exportJSON} className="btn-ghost flex items-center gap-1.5 text-[11px] font-mono">
                    <Download size={12} /> JSON
                  </button>
                </div>
              </div>

              {/* Timeline view */}
              {view === 'timeline' && (
                <TimelineView
                  matches={filteredMatches}
                  duration={result.video_duration_seconds}
                />
              )}

              {/* Grid */}
              {view === 'grid' && (
                filteredMatches.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title="No matches at this threshold"
                    description="Lower the minimum confidence to see more results."
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {filteredMatches.map((m, i) => (
                      <MatchCard key={i} match={m} index={i} />
                    ))}
                  </div>
                )
              )}
            </>
          ) : (
            <EmptyState
              icon={AlertCircle}
              title="No face matches found"
              description="Try lowering the threshold or upload a sharper reference image."
            />
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function MatchCard({ match, index }: { match: VideoMatchResult; index: number }) {
  return (
    <motion.a
      href={match.frame_url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      className="group flex flex-col gap-2 p-2.5 rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all"
    >
      <div className="relative">
        <img
          src={match.frame_url}
          alt={`Match at ${formatTime(match.timestamp_seconds)}`}
          className="w-full aspect-video object-cover rounded-lg bg-navy-800 ring-1 ring-white/5"
        />
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] font-mono text-white flex items-center gap-1">
          <Clock size={9} /> {formatTime(match.timestamp_seconds)}
        </div>
        <div className="absolute bottom-1.5 right-1.5">
          <ConfidenceRing confidence={match.confidence} size={36} />
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span>frame · {match.frame_number}</span>
        <span className="opacity-0 group-hover:opacity-100 text-blue-300 flex items-center gap-0.5 transition-opacity">
          open <ChevronRight size={10} />
        </span>
      </div>
    </motion.a>
  );
}

function ResultStat({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-25" style={{ background: accent }} />
      <p className="relative text-[10px] font-mono text-slate-500 tracking-widest uppercase">{label}</p>
      <p className={`relative font-syne font-bold text-2xl mt-1.5 leading-none ${highlight ? 'text-emerald-300' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}

function TimelineView({ matches, duration }: { matches: VideoMatchResult[]; duration: number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">Match timeline</span>
        <span className="text-[10px] font-mono text-slate-500">
          {matches.length} marker{matches.length === 1 ? '' : 's'} over {formatTime(duration)}
        </span>
      </div>
      <div className="relative h-20">
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-blue-500/0 via-blue-500/40 to-blue-500/0" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between text-[9px] font-mono text-slate-600">
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <div key={p} className="flex flex-col items-center">
              <div className="w-px h-2 bg-white/10 mb-1" />
              <span>{formatTime(duration * p)}</span>
            </div>
          ))}
        </div>
        {matches.map((m, i) => {
          const left = (m.timestamp_seconds / duration) * 100;
          return (
            <a
              key={i}
              href={m.frame_url}
              target="_blank"
              rel="noreferrer"
              className="absolute top-1/2 -translate-y-1/2 group"
              style={{ left: `${left}%` }}
              title={`${formatTime(m.timestamp_seconds)} · ${(m.confidence * 100).toFixed(0)}%`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full ring-2 ring-black/40 hover:scale-150 transition-transform"
                style={{ background: m.confidence > 0.7 ? '#34d399' : m.confidence > 0.5 ? '#fbbf24' : '#fb7185' }}
              />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-black/80 border border-white/10 text-[10px] font-mono text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(m.timestamp_seconds)} · {(m.confidence * 100).toFixed(0)}%
              </div>
            </a>
          );
        })}
      </div>
      {matches.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {matches.slice(0, 12).map((m, i) => (
            <a
              key={i}
              href={m.frame_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 hover:border-white/25 text-[10px] font-mono text-slate-300"
            >
              <Clock size={9} />
              {formatTime(m.timestamp_seconds)}
              <span className="text-slate-500">·</span>
              <span style={{ color: m.confidence > 0.7 ? '#34d399' : m.confidence > 0.5 ? '#fbbf24' : '#fb7185' }}>
                {(m.confidence * 100).toFixed(0)}%
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
