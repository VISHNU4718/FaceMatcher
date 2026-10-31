import { describe, expect, it } from 'vitest';
import {
  distanceToConfidence,
  euclidean,
  identify,
  normaliseEmotions,
  sampleTimes,
  toBbox,
} from '../matching';

describe('euclidean / confidence', () => {
  it('is zero for identical vectors and the L2 norm otherwise', () => {
    expect(euclidean([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(euclidean([0, 0], [3, 4])).toBe(5);
  });
  it('rejects descriptors of different length', () => {
    expect(() => euclidean([1], [1, 2])).toThrow();
  });
  it('maps distance to a 0..1 confidence', () => {
    expect(distanceToConfidence(0)).toBe(1);
    expect(distanceToConfidence(0.25)).toBe(0.75);
    expect(distanceToConfidence(3)).toBe(0);
  });
});

describe('toBbox', () => {
  it('returns [top, right, bottom, left] and undoes scaling', () => {
    expect(toBbox({ x: 10, y: 20, width: 30, height: 40 })).toEqual([20, 40, 60, 10]);
    expect(toBbox({ x: 10, y: 20, width: 30, height: 40 }, 0.5)).toEqual([40, 80, 120, 20]);
  });
});

describe('identify', () => {
  const gallery = [
    { id: 1, name: 'Ada', descriptor: [0, 0] },
    { id: 2, name: 'Grace', descriptor: [1, 0] },
  ];
  it('returns the closest gallery face', () => {
    expect(identify([0.1, 0], gallery)).toEqual({ name: 'Ada', confidence: 0.9, face_id: 1 });
  });
  it('returns Unknown when nothing is close enough', () => {
    expect(identify([0.5, 0.9], gallery, 0.5).name).toBe('Unknown');
    expect(identify([0.5, 0.9], gallery, 0.5).face_id).toBeNull();
  });
  it('returns Unknown for an empty gallery', () => {
    expect(identify([0, 0], [])).toEqual({ name: 'Unknown', confidence: 0, face_id: null });
  });
});

describe('normaliseEmotions', () => {
  it('renames face-api labels, normalises to 1 and finds the dominant one', () => {
    const out = normaliseEmotions({ neutral: 0.1, happy: 0.1, fearful: 0.6, surprised: 0.2, other: 5 });
    expect(out.dominant).toBe('fear');
    expect(Object.keys(out.emotions).sort()).toEqual(['fear', 'happy', 'neutral', 'surprise']);
    const sum = Object.values(out.emotions).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 3);
  });
  it('copes with all zeros', () => {
    expect(normaliseEmotions({ happy: 0, sad: 0 }).emotions.happy).toBe(0);
  });
});

describe('sampleTimes', () => {
  it('samples every N frames at the assumed fps', () => {
    expect(sampleTimes(1, 15)).toEqual([0, 0.5]);
  });
  it('caps the number of samples', () => {
    const t = sampleTimes(600, 1, 30, 100);
    expect(t.length).toBeLessThanOrEqual(101);
    expect(t[0]).toBe(0);
  });
  it('returns nothing for an unknown duration', () => {
    expect(sampleTimes(NaN, 5)).toEqual([]);
    expect(sampleTimes(0, 5)).toEqual([]);
  });
  it('rejects an invalid frame skip', () => {
    expect(() => sampleTimes(10, 0)).toThrow();
    expect(() => sampleTimes(10, 1.5)).toThrow();
  });
});
