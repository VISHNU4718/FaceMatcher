export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** 83.4 -> "1:23" */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatRelative(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, Math.floor((now - ts) / 1000));
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 0.75) return '#22c55e';
  if (confidence >= 0.5) return '#eab308';
  return '#ef4444';
}

export const EMOTION_EMOJI: Record<string, string> = {
  happy: '😄',
  sad: '😢',
  angry: '😠',
  fear: '😨',
  surprise: '😲',
  disgust: '🤢',
  neutral: '😐',
};

export const EMOTION_COLOR: Record<string, string> = {
  happy: '#FACC15',
  sad: '#60A5FA',
  angry: '#F43F5E',
  fear: '#A78BFA',
  surprise: '#F59E0B',
  disgust: '#84CC16',
  neutral: '#94A3B8',
};
