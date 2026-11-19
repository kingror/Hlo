import {
  BezierControlPoints,
  EasingType,
  FrameRate,
  Keyframe,
  RornProject,
  TimelineClip,
} from './models';

export const MAGNETIC_SNAP_THRESHOLD_MS = 150;
export const MAX_UNDO_HISTORY = 50;

/**
 * Formats milliseconds into frame-accurate HH:MM:SS:FF timecode.
 */
export function formatTimecode(ms: number, fps: FrameRate): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const remainderMs = clamped % 1000;
  const frames = Math.min(fps - 1, Math.floor((remainderMs * fps + 0.001) / 1000));

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

/**
 * Snaps a candidate timestamp to a single frame boundary for the project FPS.
 */
export function snapToFrame(ms: number, fps: FrameRate): number {
  const frameMs = 1000 / fps;
  return Math.max(0, Math.round(ms / frameMs) * frameMs);
}

/**
 * Computes total timeline duration across all clips.
 */
export function getProjectDurationMs(project: Pick<RornProject, 'clips'>): number {
  if (project.clips.length === 0) return 0;
  return project.clips.reduce((max, clip) => Math.max(max, clip.startMs + clip.durationMs), 0);
}

/**
 * Magnetic Snapping (150ms proximity lock):
 * Returns the nearest snap point (other clip start/end, 0ms, or playheadMs)
 * within `thresholdMs` (default 150ms).
 */
export function computeMagneticSnap(
  candidateStartMs: number,
  clipDurationMs: number,
  movingClipId: string,
  allClips: TimelineClip[],
  playheadMs: number,
  enabled: boolean,
  thresholdMs = MAGNETIC_SNAP_THRESHOLD_MS
): { snappedStartMs: number; snapGuideMs: number | null } {
  const clamped = Math.max(0, candidateStartMs);
  if (!enabled) {
    return { snappedStartMs: clamped, snapGuideMs: null };
  }

  const targets: number[] = [0];
  for (const c of allClips) {
    if (c.id === movingClipId) continue;
    targets.push(c.startMs, c.startMs + c.durationMs);
  }
  targets.push(playheadMs);

  let bestDelta = thresholdMs + 1;
  let bestStart = clamped;
  let guide: number | null = null;

  const candidateEndMs = clamped + clipDurationMs;

  for (const target of targets) {
    const startDiff = Math.abs(clamped - target);
    if (startDiff <= thresholdMs && startDiff < bestDelta) {
      bestDelta = startDiff;
      bestStart = target;
      guide = target;
    }
    const endDiff = Math.abs(candidateEndMs - target);
    if (endDiff <= thresholdMs && endDiff < bestDelta && target - clipDurationMs >= 0) {
      bestDelta = endDiff;
      bestStart = target - clipDurationMs;
      guide = target;
    }
  }

  return { snappedStartMs: Math.max(0, Math.round(bestStart)), snapGuideMs: guide };
}

/**
 * Frame-accurate Split operation at splitTimeMs.
 * Splits the target clip into two contiguous clips preserving sourceInMs, effects, and keyframes.
 */
export function splitClipAtTime(
  clips: TimelineClip[],
  clipId: string,
  splitTimeMs: number,
  fps: FrameRate
): TimelineClip[] {
  const idx = clips.findIndex((c) => c.id === clipId);
  if (idx === -1) return clips;

  const target = clips[idx];
  const alignedSplit = Math.round(snapToFrame(splitTimeMs, fps));
  const minSegmentMs = Math.max(100, Math.round(1000 / fps));

  if (
    alignedSplit <= target.startMs + minSegmentMs ||
    alignedSplit >= target.startMs + target.durationMs - minSegmentMs
  ) {
    return clips;
  }

  const leftDuration = alignedSplit - target.startMs;
  const rightDuration = target.durationMs - leftDuration;

  const leftKeyframes = target.keyframes.filter((kf) => kf.timeOffsetMs <= leftDuration);
  const rightKeyframes = target.keyframes
    .filter((kf) => kf.timeOffsetMs >= leftDuration)
    .map((kf) => ({
      ...kf,
      id: `${kf.id}_r`,
      timeOffsetMs: kf.timeOffsetMs - leftDuration,
    }));

  const leftClip: TimelineClip = {
    ...target,
    durationMs: leftDuration,
    keyframes: leftKeyframes,
    audio: {
      ...target.audio,
      fadeOutMs: Math.min(target.audio.fadeOutMs, leftDuration),
    },
  };

  const rightClip: TimelineClip = {
    ...target,
    id: `${target.id}_part_${Date.now().toString(36).slice(-4)}`,
    name: `${target.name} (2)`,
    startMs: alignedSplit,
    durationMs: rightDuration,
    sourceInMs: target.sourceInMs + leftDuration,
    keyframes: rightKeyframes,
    audio: {
      ...target.audio,
      fadeInMs: Math.min(target.audio.fadeInMs, rightDuration),
    },
  };

  const next = [...clips];
  next.splice(idx, 1, leftClip, rightClip);
  return next;
}

/**
 * Ripple Delete: Removes the target clip and shifts all subsequent clips
 * on the same track left by the deleted clip's duration.
 */
export function rippleDeleteClip(clips: TimelineClip[], clipId: string): TimelineClip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;

  const gapDuration = target.durationMs;
  const deletedStart = target.startMs;
  const trackId = target.trackId;

  return clips
    .filter((c) => c.id !== clipId)
    .map((c) => {
      if (c.trackId === trackId && c.startMs > deletedStart) {
        return {
          ...c,
          startMs: Math.max(0, c.startMs - gapDuration),
        };
      }
      return c;
    });
}

/**
 * Standard cubic Bezier curve evaluation for easing t in [0, 1].
 */
export function getControlPointsForEasing(
  easing: EasingType,
  custom?: BezierControlPoints
): BezierControlPoints {
  switch (easing) {
    case 'linear':
      return { x1: 0, y1: 0, x2: 1, y2: 1 };
    case 'ease-in':
      return { x1: 0.42, y1: 0, x2: 1, y2: 1 };
    case 'ease-out':
      return { x1: 0, y1: 0, x2: 0.58, y2: 1 };
    case 'ease-in-out':
      return { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
    case 'custom':
      return custom ?? { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
  }
}

function sampleCubicBezier(a: number, b: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

export function evaluateBezier(t: number, pts: BezierControlPoints): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped === 0 || clamped === 1) return clamped;

  // Binary search parameter u so that X(u) ~= clamped
  let low = 0;
  let high = 1;
  let u = clamped;
  for (let i = 0; i < 14; i++) {
    u = (low + high) / 2;
    const x = sampleCubicBezier(pts.x1, pts.x2, u);
    if (Math.abs(x - clamped) < 0.0005) break;
    if (x < clamped) low = u;
    else high = u;
  }
  return sampleCubicBezier(pts.y1, pts.y2, u);
}

export interface TransformState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export const DEFAULT_TRANSFORM: TransformState = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

/**
 * Interpolates clip transform properties at timeOffsetMs using Bezier keyframes.
 */
export function interpolateKeyframes(keyframes: Keyframe[], timeOffsetMs: number): TransformState {
  if (!keyframes || keyframes.length === 0) {
    return { ...DEFAULT_TRANSFORM };
  }

  const sorted = [...keyframes].sort((a, b) => a.timeOffsetMs - b.timeOffsetMs);
  if (timeOffsetMs <= sorted[0].timeOffsetMs) {
    const k = sorted[0];
    return { x: k.x, y: k.y, scale: k.scale, rotation: k.rotation, opacity: k.opacity };
  }
  if (timeOffsetMs >= sorted[sorted.length - 1].timeOffsetMs) {
    const k = sorted[sorted.length - 1];
    return { x: k.x, y: k.y, scale: k.scale, rotation: k.rotation, opacity: k.opacity };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const k0 = sorted[i];
    const k1 = sorted[i + 1];
    if (timeOffsetMs >= k0.timeOffsetMs && timeOffsetMs <= k1.timeOffsetMs) {
      const span = Math.max(1, k1.timeOffsetMs - k0.timeOffsetMs);
      const rawT = (timeOffsetMs - k0.timeOffsetMs) / span;
      const pts = getControlPointsForEasing(k0.easing, k0.bezier);
      const easedT = evaluateBezier(rawT, pts);

      const lerp = (a: number, b: number) => a + (b - a) * easedT;
      return {
        x: lerp(k0.x, k1.x),
        y: lerp(k0.y, k1.y),
        scale: lerp(k0.scale, k1.scale),
        rotation: lerp(k0.rotation, k1.rotation),
        opacity: lerp(k0.opacity, k1.opacity),
      };
    }
  }

  return { ...DEFAULT_TRANSFORM };
}

/**
 * Computes effective audio gain at global timeline `timeMs` including
 * Fade-In, Fade-Out, and Sidechain Ducking (attenuating when primary/dialogue clips overlap).
 */
export function computeAudioGainAtTime(
  clip: TimelineClip,
  timeMs: number,
  allClips: TimelineClip[],
  trackMuted: boolean
): number {
  if (trackMuted || clip.audio.muted) return 0;
  if (timeMs < clip.startMs || timeMs > clip.startMs + clip.durationMs) return 0;

  const localMs = timeMs - clip.startMs;
  let gain = clip.audio.gain;

  // Fade-in envelope
  if (clip.audio.fadeInMs > 0 && localMs < clip.audio.fadeInMs) {
    gain *= Math.max(0, localMs / clip.audio.fadeInMs);
  }

  // Fade-out envelope
  const remainingMs = clip.durationMs - localMs;
  if (clip.audio.fadeOutMs > 0 && remainingMs < clip.audio.fadeOutMs) {
    gain *= Math.max(0, remainingMs / clip.audio.fadeOutMs);
  }

  // Sidechain Ducking: if enabled on this audio clip, duck whenever another higher-priority audio/video clip plays
  if (clip.audio.sidechainDucking) {
    const hasTriggerActive = allClips.some(
      (other) =>
        other.id !== clip.id &&
        other.trackId !== clip.trackId &&
        !other.audio.muted &&
        !other.audio.sidechainDucking &&
        (other.kind === 'audio' || other.kind === 'video' || other.proceduralPreset === 'voiceover-narration') &&
        timeMs >= other.startMs &&
        timeMs <= other.startMs + other.durationMs
    );
    if (hasTriggerActive) {
      gain *= Math.max(0.05, 1 - clip.audio.duckingDepth);
    }
  }

  return Number(gain.toFixed(4));
}

/**
 * Parses a standard Adobe/Resolve .CUBE 3D LUT text file and derives an average RGB shift matrix.
 */
export function parseCubeLut(cubeContent: string): {
  title: string;
  size: number;
  rgbShift: [number, number, number];
} {
  const lines = cubeContent.split(/\r?\n/);
  let title = 'Custom .CUBE LUT';
  let size = 33;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('TITLE')) {
      title = line.replace(/^TITLE\s+"?([^"]+)"?/, '$1').trim() || title;
      continue;
    }
    if (line.startsWith('LUT_3D_SIZE')) {
      const parsed = parseInt(line.split(/\s+/)[1], 10);
      if (!Number.isNaN(parsed)) size = parsed;
      continue;
    }
    const parts = line.split(/\s+/).map(Number);
    if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
      sumR += parts[0];
      sumG += parts[1];
      sumB += parts[2];
      count++;
    }
  }

  if (count === 0) {
    return { title, size, rgbShift: [1, 1, 1] };
  }

  const avgR = sumR / count;
  const avgG = sumG / count;
  const avgB = sumB / count;
  const baseline = (avgR + avgG + avgB) / 3 || 0.5;

  return {
    title,
    size,
    rgbShift: [
      Number((0.5 + (avgR / baseline) * 0.5).toFixed(3)),
      Number((0.5 + (avgG / baseline) * 0.5).toFixed(3)),
      Number((0.5 + (avgB / baseline) * 0.5).toFixed(3)),
    ],
  };
}

/**
 * Command Pattern Undo/Redo History Manager (capped at 50 operations).
 */
export interface HistoryEntry<T> {
  label: string;
  timestamp: number;
  state: T;
}

export class HistoryManager<T> {
  private undoStack: HistoryEntry<T>[] = [];
  private redoStack: HistoryEntry<T>[] = [];
  private current: HistoryEntry<T>;
  private readonly maxDepth: number;

  constructor(initialState: T, initialLabel = 'Initial State', maxDepth = MAX_UNDO_HISTORY) {
    this.maxDepth = maxDepth;
    this.current = {
      label: initialLabel,
      timestamp: Date.now(),
      state: structuredClone(initialState),
    };
  }

  getCurrent(): T {
    return this.current.state;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  getLastActionLabel(): string {
    return this.current.label;
  }

  execute(nextState: T, label: string): T {
    this.undoStack.push(this.current);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.current = {
      label,
      timestamp: Date.now(),
      state: structuredClone(nextState),
    };
    this.redoStack = [];
    return this.current.state;
  }

  undo(): T | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.redoStack.push(this.current);
    this.current = previous;
    return this.current.state;
  }

  redo(): T | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(this.current);
    this.current = next;
    return this.current.state;
  }
}
