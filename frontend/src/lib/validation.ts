/** Input checks shared by the pages and the recognition code. Pure, so they are unit-tested. */

/** An error whose message is safe to show to the user. */
export class AppError extends Error {}

export const MAX_NAME_LENGTH = 60;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_FRAME_SKIP = 300;

interface FileLike {
  type: string;
  size: number;
}

/** Trimmed, non-empty name of at most MAX_NAME_LENGTH characters. */
export function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError('Enter a name.');
  if (trimmed.length > MAX_NAME_LENGTH) throw new AppError(`Names can be at most ${MAX_NAME_LENGTH} characters.`);
  return trimmed;
}

export function validateImageFile(file: FileLike): void {
  if (!file.type.startsWith('image/')) throw new AppError('That file is not an image.');
  if (file.size === 0) throw new AppError('That image is empty.');
  if (file.size > MAX_IMAGE_BYTES) throw new AppError('Image too large (max 5 MB).');
}

export function validateVideoFile(file: FileLike): void {
  if (!file.type.startsWith('video/')) throw new AppError('That file is not a video.');
  if (file.size === 0) throw new AppError('That video is empty.');
  if (file.size > MAX_VIDEO_BYTES) throw new AppError('Video too large (max 100 MB).');
}

/** Minimum confidence for a video match: above 0, at most 1. */
export function validateThreshold(threshold: number): number {
  if (!(threshold > 0 && threshold <= 1)) throw new AppError('Threshold must be between 0 and 1.');
  return threshold;
}

/** Whole number of frames between samples, 1..MAX_FRAME_SKIP. */
export function validateFrameSkip(frameSkip: number): number {
  if (!Number.isInteger(frameSkip) || frameSkip < 1 || frameSkip > MAX_FRAME_SKIP) {
    throw new AppError(`Frame skip must be a whole number from 1 to ${MAX_FRAME_SKIP}.`);
  }
  return frameSkip;
}

/** Message for a bad image or video file, or null if it is acceptable. For use in file pickers. */
export function fileProblem(file: FileLike, kind: 'image' | 'video'): string | null {
  try {
    (kind === 'image' ? validateImageFile : validateVideoFile)(file);
    return null;
  } catch (err) {
    return err instanceof AppError ? err.message : 'That file cannot be used.';
  }
}
