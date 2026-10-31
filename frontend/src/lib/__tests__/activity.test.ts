import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearActivity,
  emotionTotals,
  getActivity,
  getDailyCounts,
  recordActivity,
  type ActivityEvent,
} from '../activity';
import { formatRelative, formatTime } from '../utils';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('activity log', () => {
  it('records newest first and clears', () => {
    recordActivity({ kind: 'register', title: 'one' });
    recordActivity({ kind: 'video', title: 'two' });
    expect(getActivity().map((e) => e.title)).toEqual(['two', 'one']);
    clearActivity();
    expect(getActivity()).toEqual([]);
  });
  it('keeps at most 200 events', () => {
    for (let i = 0; i < 205; i++) recordActivity({ kind: 'live', title: String(i) });
    expect(getActivity()).toHaveLength(200);
    expect(getActivity()[0].title).toBe('204');
  });
  it('survives corrupt storage', () => {
    localStorage.setItem('facematcher.activity.v1', '{not json');
    expect(getActivity()).toEqual([]);
  });
});

describe('aggregations', () => {
  const now = new Date(2026, 9, 31, 12).getTime();
  const ev = (kind: ActivityEvent['kind'], ts: number, meta?: ActivityEvent['meta']): ActivityEvent => ({
    id: String(ts) + kind, ts, kind, title: kind, meta,
  });
  it('counts events per local day, oldest first', () => {
    const counts = getDailyCounts(3, [ev('video', now), ev('live', now), ev('live', now - 86_400_000)], now);
    expect(counts.map((c) => c.count)).toEqual([0, 1, 2]);
  });
  it('totals dominant emotions and skips "none"', () => {
    const totals = emotionTotals([
      ev('emotion', now, { dominant: 'happy' }),
      ev('emotion', now, { dominant: 'happy' }),
      ev('emotion', now, { dominant: 'none' }),
      ev('video', now, { dominant: 'sad' }),
    ]);
    expect(totals).toEqual({ happy: 2 });
  });
});

describe('formatters', () => {
  it('formats times', () => {
    expect(formatTime(83.4)).toBe('1:23');
    expect(formatTime(-1)).toBe('0:00');
  });
  it('formats relative times', () => {
    expect(formatRelative(1000, 1000)).toBe('just now');
    expect(formatRelative(0, 5 * 60_000)).toBe('5m ago');
    expect(formatRelative(0, 3 * 86_400_000)).toBe('3d ago');
  });
});
