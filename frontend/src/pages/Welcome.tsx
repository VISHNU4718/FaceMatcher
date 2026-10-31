import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Activity,
  Camera,
  Database,
  Film,
  Smile,
  Sparkles,
  Cpu,
  Brain,
  Users,
  Zap,
  ArrowUpRight,
  CircleDot,
  Eye,
  Trash2,
  Plus,
  UserCheck,
  ScanFace,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import Sparkline from '../components/Sparkline';
import Chip from '../components/Chip';
import EmptyState from '../components/EmptyState';
import { listFaces } from '../lib/api';
import { useEngine } from '../lib/useEngine';
import { Face } from '../types';
import {
  ActivityEvent,
  emotionTotals,
  getActivity,
  getDailyCounts,
  subscribeActivity,
} from '../lib/activity';
import { formatRelative } from '../lib/utils';
import { EMOTION_EMOJI, EMOTION_COLOR } from '../lib/utils';

const PAGE = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const KIND_ICON = {
  video: Film,
  identify: UserCheck,
  emotion: Smile,
  live: Camera,
  register: Plus,
  delete: Trash2,
} as const;

const KIND_ACCENT = {
  video: '#3B82F6',
  identify: '#10B981',
  emotion: '#F59E0B',
  live: '#8B5CF6',
  register: '#06B6D4',
  delete: '#F43F5E',
} as const;

export default function Welcome() {
  const [faces, setFaces] = useState<Face[]>([]);
  const engine = useEngine();
  const healthy = engine.status === 'ready' ? true : engine.status === 'error' ? false : null;
  const [activity, setActivity] = useState<ActivityEvent[]>(() => getActivity());
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeActivity(() => setActivity(getActivity())), []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listFaces()
      .then((all) => {
        if (!cancelled) setFaces(all);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => getDailyCounts(14), [activity, tick]);
  const totalEvents = activity.length;
  const eventsToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return activity.filter((a) => new Date(a.ts).toISOString().slice(0, 10) === today).length;
  }, [activity]);
  const emoTotals = useMemo(() => emotionTotals(), [activity]);

  const matchEvents = activity.filter((a) => a.kind === 'video' || a.kind === 'identify');
  const totalMatches = matchEvents.reduce((s, a) => s + Number(a.meta?.matches ?? 0), 0);

  return (
    <motion.div {...PAGE} className="flex flex-col gap-6">
      {/* Greeting / hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/8 p-6 lg:p-8">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 0% 0%, rgba(59,130,246,0.12), transparent 50%), radial-gradient(circle at 100% 100%, rgba(139,92,246,0.08), transparent 50%)',
          }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Chip variant="blue" icon={<Sparkles size={10} />}>OPERATIONS · LIVE</Chip>
              <Chip variant={healthy ? 'emerald' : 'rose'} icon={<CircleDot size={10} />}>
                {healthy ? 'Models ready' : healthy === false ? 'Models failed to load' : 'Loading models…'}
              </Chip>
            </div>
            <h1 className="font-syne font-bold text-3xl lg:text-4xl text-white leading-tight">
              Welcome back, <span className="bg-gradient-to-r from-blue-300 to-violet-300 bg-clip-text text-transparent">Operator</span>.
            </h1>
            <p className="text-slate-400 mt-2 max-w-xl">
              Your local FaceMatcher workspace. Run scans, monitor live feeds, and analyse emotion — all on a single self-hosted node.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/live"
              className="inline-flex items-center gap-2 px-5 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white font-syne font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/45 hover:-translate-y-0.5 transition-all"
            >
              <Camera size={14} /> Start Live Feed
            </Link>
            <Link
              to="/video"
              className="inline-flex items-center gap-2 px-5 h-10 rounded-lg border border-white/15 bg-white/[0.02] text-slate-200 font-syne font-medium text-sm hover:bg-white/5 hover:border-white/30 transition-all"
            >
              <Film size={14} /> New Video Scan
            </Link>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Enrolled Faces"
          value={faces.length}
          accent="#10B981"
          hint="Stored in this browser"
        />
        <StatCard
          icon={Activity}
          label="Events Today"
          value={eventsToday}
          accent="#3B82F6"
          delta={{ value: `${totalEvents} total`, positive: true }}
        />
        <StatCard
          icon={UserCheck}
          label="Total Matches"
          value={totalMatches}
          accent="#8B5CF6"
          hint="Across video + identify"
        />
        <StatCard
          icon={Zap}
          label="Inference backend"
          value={engine.backend ?? '—'}
          accent="#F59E0B"
          hint="TensorFlow.js, in your browser"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          {/* Activity chart */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase mb-1">
                  / Detection volume
                </p>
                <h3 className="font-syne font-bold text-lg text-white">Last 14 days</h3>
              </div>
              <div className="flex items-center gap-2">
                <Chip variant="blue" icon={<CircleDot size={9} />}>events / day</Chip>
              </div>
            </div>
            <ActivityChart data={counts} />
            <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
              <MiniStat label="Peak day" value={Math.max(...counts.map((c) => c.count), 0)} />
              <MiniStat label="Average" value={(counts.reduce((s, c) => s + c.count, 0) / counts.length).toFixed(1)} />
              <MiniStat label="Trend" value={
                <Sparkline values={counts.map((c) => c.count)} width={80} height={24} />
              } />
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase mb-1">
                  / Quick actions
                </p>
                <h3 className="font-syne font-bold text-lg text-white">Jump into a module</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QuickCard
                to="/video"
                icon={Film}
                title="Scan a Video"
                blurb="Find a face across every frame with timestamp-accurate hits."
                accent="from-blue-500/30 to-cyan-500/20"
              />
              <QuickCard
                to="/live"
                icon={Camera}
                title="Open Live Feed"
                blurb="Match a reference face on your webcam. Nothing leaves the browser."
                accent="from-violet-500/30 to-fuchsia-500/20"
              />
              <QuickCard
                to="/database"
                icon={Database}
                title="Manage Database"
                blurb="Enroll named faces, identify groups, browse the gallery."
                accent="from-emerald-500/30 to-teal-500/20"
              />
              <QuickCard
                to="/emotion"
                icon={Smile}
                title="Read Emotion"
                blurb="Live 7-class emotion analysis from your camera."
                accent="from-amber-500/30 to-orange-500/20"
              />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-5">
          {/* AI status */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase mb-1">
                  / AI runtime
                </p>
                <h3 className="font-syne font-bold text-lg text-white">Model status</h3>
              </div>
              <Chip variant={healthy ? 'emerald' : 'rose'}>
                {healthy ? 'READY' : healthy === false ? 'FAILED' : '…'}
              </Chip>
            </div>
            <div className="flex flex-col gap-2.5">
              <ModelRow
                icon={ScanFace}
                name="Face recognition"
                detail="face-api.js · ResNet · 128-D"
                online={healthy === true}
              />
              <ModelRow
                icon={Brain}
                name="Emotion"
                detail="face-api.js · 7-class expression net"
                online={healthy === true}
              />
              <ModelRow
                icon={Cpu}
                name="Detection"
                detail="SSD MobileNet (photos) · Tiny detector (video)"
                online={healthy === true}
              />
            </div>
          </div>

          {/* Emotion distribution */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase mb-1">
                  / Mood signal
                </p>
                <h3 className="font-syne font-bold text-lg text-white">Recent emotions</h3>
              </div>
              <Link to="/emotion" className="text-[11px] font-mono text-blue-300 hover:text-blue-200">
                Open →
              </Link>
            </div>
            {Object.keys(emoTotals).length === 0 ? (
              <EmptyState
                icon={Smile}
                title="No samples yet"
                description="Run the emotion module to populate this signal panel."
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {Object.entries(emoTotals)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([emo, count]) => {
                    const max = Math.max(...Object.values(emoTotals));
                    const pct = (count / max) * 100;
                    return (
                      <div key={emo}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 text-xs text-slate-300 capitalize">
                            <span>{EMOTION_EMOJI[emo] ?? '•'}</span>
                            <span>{emo}</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: EMOTION_COLOR[emo] ?? '#60A5FA' }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase mb-1">
              / Activity feed
            </p>
            <h3 className="font-syne font-bold text-lg text-white">Recent detections</h3>
          </div>
          <div className="flex items-center gap-2">
            <Chip>{activity.length} entries</Chip>
            <span className="text-[10px] font-mono text-slate-500">stored locally</span>
          </div>
        </div>
        {activity.length === 0 ? (
          <EmptyState
            icon={Eye}
            title="Nothing yet"
            description="Run a video scan, identify a face, or start the live feed — events land here."
            action={
              <Link
                to="/video"
                className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white font-syne text-sm font-semibold"
              >
                Run first scan <ArrowUpRight size={13} />
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {activity.slice(0, 8).map((a) => {
              const Icon = KIND_ICON[a.kind] ?? Activity;
              const accent = KIND_ACCENT[a.kind] ?? '#60A5FA';
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 shrink-0"
                    style={{ background: `${accent}1A` }}
                  >
                    <Icon size={14} style={{ color: accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{a.title}</p>
                    {a.detail && <p className="text-[11px] text-slate-500 truncate">{a.detail}</p>}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">
                    {formatRelative(a.ts)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-mono text-slate-500 tracking-widest uppercase mb-1">{label}</p>
      <div className="font-syne font-bold text-lg text-white">{value}</div>
    </div>
  );
}

function QuickCard({
  to,
  icon: Icon,
  title,
  blurb,
  accent,
}: {
  to: string;
  icon: typeof Film;
  title: string;
  blurb: string;
  accent: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all p-4"
    >
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${accent} blur-3xl opacity-50`} />
      <div className="relative flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
          <Icon size={17} className="text-blue-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className="font-syne font-semibold text-white text-sm">{title}</p>
            <ArrowUpRight size={13} className="text-slate-500 group-hover:text-white group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-xs text-slate-500 leading-snug">{blurb}</p>
        </div>
      </div>
    </Link>
  );
}

function ModelRow({
  icon: Icon,
  name,
  detail,
  online,
}: {
  icon: typeof Brain;
  name: string;
  detail: string;
  online: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-blue-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 truncate">{name}</p>
        <p className="text-[11px] font-mono text-slate-500 truncate">{detail}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        <span className={`text-[10px] font-mono ${online ? 'text-emerald-300' : 'text-rose-300'}`}>
          {online ? 'READY' : 'DOWN'}
        </span>
      </div>
    </div>
  );
}

function ActivityChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => {
        const h = (d.count / max) * 100;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
            <div className="relative w-full h-full flex items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(h, 4)}%` }}
                transition={{ duration: 0.5, delay: i * 0.025, ease: 'easeOut' }}
                className="w-full rounded-md bg-gradient-to-t from-blue-500/60 to-violet-500/60 group-hover:from-blue-400 group-hover:to-violet-400 transition-colors relative"
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono text-slate-300 bg-black/60 px-1.5 py-0.5 rounded border border-white/10 whitespace-nowrap">
                  {d.count}
                </div>
              </motion.div>
            </div>
            <span className="text-[9px] font-mono text-slate-600">
              {new Date(d.date).getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
