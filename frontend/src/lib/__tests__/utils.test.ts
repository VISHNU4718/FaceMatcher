import { describe, expect, it } from 'vitest';
import { confidenceColor, formatRelative, formatTime, uid } from '../utils';

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(83.4)).toBe('1:23');
    expect(formatTime(600)).toBe('10:00');
  });
  it('returns 0:00 for invalid input', () => {
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });
});

describe('formatRelative', () => {
  const now = 1_000_000_000_000;
  it('picks a sensible unit', () => {
    expect(formatRelative(now - 2_000, now)).toBe('just now');
    expect(formatRelative(now - 30_000, now)).toBe('30s ago');
    expect(formatRelative(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(formatRelative(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
  it('treats future timestamps as now', () => {
    expect(formatRelative(now + 60_000, now)).toBe('just now');
  });
});

describe('confidenceColor', () => {
  it('uses green, yellow and red bands', () => {
    expect(confidenceColor(0.9)).toBe('#22c55e');
    expect(confidenceColor(0.6)).toBe('#eab308');
    expect(confidenceColor(0.2)).toBe('#ef4444');
  });
});

describe('uid', () => {
  it('returns distinct ids', () => {
    expect(uid()).not.toBe(uid());
  });
});
