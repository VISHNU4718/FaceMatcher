export type ActivityKind = 'video' | 'identify' | 'emotion' | 'live' | 'register' | 'delete';

export interface ActivityEvent {
  id: string;
  ts: number;
  kind: ActivityKind;
  title: string;
  detail?: string;
  meta?: Record<string, string | number>;
}

export type NewActivity = Omit<ActivityEvent, 'id' | 'ts'>;

const KEY = 'facematcher.activity.v1';
const MAX_EVENTS = 200;
const listeners = new Set<() => void>();

function read(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ActivityEvent[]) : [];
  } catch {
    return [];
  }
}

function write(events: ActivityEvent[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    /* storage full or unavailable: the log is best-effort */
  }
  listeners.forEach((fn) => fn());
}

/** Newest first. */
export function getActivity(): ActivityEvent[] {
  return read();
}

export function recordActivity(event: NewActivity): void {
  const entry: ActivityEvent = {
    ...event,
    id: Math.random().toString(36).slice(2, 10),
    ts: Date.now(),
  };
  write([entry, ...read()].slice(0, MAX_EVENTS));
}

export function clearActivity(): void {
  write([]);
}

export function subscribeActivity(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Event counts for each of the last `days` local days, oldest first, ending today. */
export function getDailyCounts(
  days: number,
  events: ActivityEvent[] = read(),
  now: number = Date.now(),
): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(dayKey(e.ts), (counts.get(dayKey(e.ts)) ?? 0) + 1);
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(now - i * 86_400_000);
    out.push({ date, count: counts.get(date) ?? 0 });
  }
  return out;
}

/** How often each dominant emotion was logged. */
export function emotionTotals(events: ActivityEvent[] = read()): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const e of events) {
    if (e.kind !== 'emotion') continue;
    const emo = e.meta?.dominant;
    if (typeof emo !== 'string' || emo === 'none') continue;
    totals[emo] = (totals[emo] ?? 0) + 1;
  }
  return totals;
}
