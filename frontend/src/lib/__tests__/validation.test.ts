import { describe, expect, it } from 'vitest';
import {
  AppError,
  MAX_FRAME_SKIP,
  MAX_IMAGE_BYTES,
  MAX_NAME_LENGTH,
  MAX_VIDEO_BYTES,
  fileProblem,
  validateFrameSkip,
  validateImageFile,
  validateName,
  validateThreshold,
  validateVideoFile,
} from '../validation';

describe('validateName', () => {
  it('trims whitespace', () => {
    expect(validateName('  Ada Lovelace ')).toBe('Ada Lovelace');
  });
  it('rejects empty and whitespace-only names', () => {
    expect(() => validateName('')).toThrow(AppError);
    expect(() => validateName('   ')).toThrow('Enter a name.');
  });
  it('rejects names over the limit but accepts exactly the limit', () => {
    expect(validateName('a'.repeat(MAX_NAME_LENGTH))).toHaveLength(MAX_NAME_LENGTH);
    expect(() => validateName('a'.repeat(MAX_NAME_LENGTH + 1))).toThrow(AppError);
  });
});

describe('validateImageFile / validateVideoFile', () => {
  it('accepts a normal image and video', () => {
    expect(() => validateImageFile({ type: 'image/png', size: 1000 })).not.toThrow();
    expect(() => validateVideoFile({ type: 'video/mp4', size: 1000 })).not.toThrow();
  });
  it('rejects the wrong kind of file', () => {
    expect(() => validateImageFile({ type: 'application/pdf', size: 10 })).toThrow('not an image');
    expect(() => validateVideoFile({ type: 'image/png', size: 10 })).toThrow('not a video');
  });
  it('rejects empty files', () => {
    expect(() => validateImageFile({ type: 'image/png', size: 0 })).toThrow('empty');
    expect(() => validateVideoFile({ type: 'video/mp4', size: 0 })).toThrow('empty');
  });
  it('enforces size limits at the boundary', () => {
    expect(() => validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES })).not.toThrow();
    expect(() => validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 })).toThrow('max 5 MB');
    expect(() => validateVideoFile({ type: 'video/mp4', size: MAX_VIDEO_BYTES })).not.toThrow();
    expect(() => validateVideoFile({ type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 })).toThrow('max 100 MB');
  });
});

describe('fileProblem', () => {
  it('returns null for a valid file and a message for an invalid one', () => {
    expect(fileProblem({ type: 'image/png', size: 10 }, 'image')).toBeNull();
    expect(fileProblem({ type: 'text/plain', size: 10 }, 'image')).toBe('That file is not an image.');
    expect(fileProblem({ type: 'image/png', size: 10 }, 'video')).toBe('That file is not a video.');
  });
});

describe('validateThreshold', () => {
  it('accepts values in (0, 1]', () => {
    expect(validateThreshold(0.6)).toBe(0.6);
    expect(validateThreshold(1)).toBe(1);
  });
  it.each([0, -0.1, 1.01, NaN, Infinity])('rejects %s', (v) => {
    expect(() => validateThreshold(v)).toThrow(AppError);
  });
});

describe('validateFrameSkip', () => {
  it('accepts whole numbers in range', () => {
    expect(validateFrameSkip(1)).toBe(1);
    expect(validateFrameSkip(MAX_FRAME_SKIP)).toBe(MAX_FRAME_SKIP);
  });
  it.each([0, -3, 2.5, NaN, MAX_FRAME_SKIP + 1])('rejects %s', (v) => {
    expect(() => validateFrameSkip(v)).toThrow(AppError);
  });
});
