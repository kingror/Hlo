import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAudioGainAtTime,
  computeMagneticSnap,
  evaluateBezier,
  formatTimecode,
  HistoryManager,
  interpolateKeyframes,
  parseCubeLut,
  rippleDeleteClip,
  splitClipAtTime,
} from './timelineEngine';
import {
  createDefaultAudioConfig,
  createDefaultChromaKey,
  createDefaultColorGrading,
  TimelineClip,
} from './models';

function makeClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: overrides.id ?? 'c1',
    trackId: overrides.trackId ?? 't1',
    name: overrides.name ?? 'Clip 1',
    kind: overrides.kind ?? 'video',
    startMs: overrides.startMs ?? 0,
    durationMs: overrides.durationMs ?? 4000,
    sourceInMs: overrides.sourceInMs ?? 0,
    sourceDurationMs: overrides.sourceDurationMs ?? 8000,
    colorTag: '#38BDF8',
    keyframes: overrides.keyframes ?? [],
    chromaKey: overrides.chromaKey ?? createDefaultChromaKey(),
    colorGrading: overrides.colorGrading ?? createDefaultColorGrading(),
    shader: overrides.shader ?? { type: 'none', intensity: 0 },
    audio: overrides.audio ?? createDefaultAudioConfig(),
    ...overrides,
  };
}

test('formatTimecode renders accurate HH:MM:SS:FF at 30fps and 60fps', () => {
  assert.equal(formatTimecode(0, 30), '00:00:00:00');
  assert.equal(formatTimecode(1500, 30), '00:00:01:15');
  assert.equal(formatTimecode(62500, 60), '00:01:02:30');
});

test('computeMagneticSnap locks within 150ms threshold and skips outside', () => {
  const existing = [makeClip({ id: 'c1', startMs: 0, durationMs: 3000 })];
  const snapped = computeMagneticSnap(3120, 2000, 'c2', existing, 5000, true);
  assert.equal(snapped.snappedStartMs, 3000);
  assert.equal(snapped.snapGuideMs, 3000);

  const notSnapped = computeMagneticSnap(3250, 2000, 'c2', existing, 5000, true);
  assert.equal(notSnapped.snappedStartMs, 3250);
  assert.equal(notSnapped.snapGuideMs, null);
});

test('splitClipAtTime divides clip cleanly and partitions keyframes', () => {
  const clip = makeClip({
    id: 'c1',
    startMs: 1000,
    durationMs: 4000,
    keyframes: [
      {
        id: 'k1',
        timeOffsetMs: 500,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        easing: 'linear',
        bezier: { x1: 0, y1: 0, x2: 1, y2: 1 },
      },
      {
        id: 'k2',
        timeOffsetMs: 3000,
        x: 20,
        y: 0,
        scale: 1.5,
        rotation: 15,
        opacity: 0.8,
        easing: 'ease-in-out',
        bezier: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
      },
    ],
  });

  const result = splitClipAtTime([clip], 'c1', 3000, 30);
  assert.equal(result.length, 2);
  assert.equal(result[0].durationMs, 2000);
  assert.equal(result[1].startMs, 3000);
  assert.equal(result[1].durationMs, 2000);
  assert.equal(result[1].sourceInMs, 2000);
  assert.equal(result[0].keyframes.length, 1);
  assert.equal(result[1].keyframes.length, 1);
  assert.equal(result[1].keyframes[0].timeOffsetMs, 1000);
});

test('rippleDeleteClip removes clip and shifts downstream clips on the same track left', () => {
  const clips = [
    makeClip({ id: 'c1', trackId: 'v1', startMs: 0, durationMs: 2000 }),
    makeClip({ id: 'c2', trackId: 'v1', startMs: 2000, durationMs: 1500 }),
    makeClip({ id: 'c3', trackId: 'v1', startMs: 3500, durationMs: 2000 }),
    makeClip({ id: 'a1', trackId: 'a1', startMs: 3500, durationMs: 2000 }),
  ];

  const after = rippleDeleteClip(clips, 'c2');
  assert.equal(after.length, 3);
  const c3 = after.find((c) => c.id === 'c3');
  const a1 = after.find((c) => c.id === 'a1');
  assert.equal(c3?.startMs, 2000);
  assert.equal(a1?.startMs, 3500);
});

test('Bezier keyframe interpolation evaluates smoothly across midpoint', () => {
  const linearVal = evaluateBezier(0.5, { x1: 0, y1: 0, x2: 1, y2: 1 });
  assert.ok(Math.abs(linearVal - 0.5) < 0.01);

  const state = interpolateKeyframes(
    [
      {
        id: 'k1',
        timeOffsetMs: 0,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 0,
        easing: 'linear',
        bezier: { x1: 0, y1: 0, x2: 1, y2: 1 },
      },
      {
        id: 'k2',
        timeOffsetMs: 1000,
        x: 100,
        y: -50,
        scale: 2,
        rotation: 90,
        opacity: 1,
        easing: 'linear',
        bezier: { x1: 0, y1: 0, x2: 1, y2: 1 },
      },
    ],
    500
  );
  assert.ok(Math.abs(state.x - 50) < 1);
  assert.ok(Math.abs(state.scale - 1.5) < 0.05);
  assert.ok(Math.abs(state.opacity - 0.5) < 0.05);
});

test('computeAudioGainAtTime applies fade envelopes and sidechain ducking', () => {
  const music = makeClip({
    id: 'bgm',
    trackId: 'a1',
    kind: 'audio',
    startMs: 0,
    durationMs: 6000,
    audio: {
      ...createDefaultAudioConfig(),
      gain: 1.0,
      fadeInMs: 1000,
      fadeOutMs: 1000,
      sidechainDucking: true,
      duckingDepth: 0.6,
    },
  });
  const voice = makeClip({
    id: 'vox',
    trackId: 'a2',
    kind: 'audio',
    proceduralPreset: 'voiceover-narration',
    startMs: 2000,
    durationMs: 2000,
  });

  // At 500ms: fade-in halfway (0.5), no voice overlap
  assert.equal(computeAudioGainAtTime(music, 500, [music, voice], false), 0.5);
  // At 2500ms: full fade, voice active -> ducked by 60% -> 0.4
  assert.equal(computeAudioGainAtTime(music, 2500, [music, voice], false), 0.4);
});

test('parseCubeLut extracts title, size, and normalized RGB shift', () => {
  const sample = `
TITLE "RORN Warm Film"
LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 0.9 0.8
`;
  const parsed = parseCubeLut(sample);
  assert.equal(parsed.title, 'RORN Warm Film');
  assert.equal(parsed.size, 2);
  assert.ok(parsed.rgbShift[0] > parsed.rgbShift[2]);
});

test('HistoryManager caps at 50 operations and supports undo/redo', () => {
  const hm = new HistoryManager<number>(0, 'Init', 50);
  for (let i = 1; i <= 55; i++) {
    hm.execute(i, `Step ${i}`);
  }
  assert.equal(hm.getCurrent(), 55);
  assert.equal(hm.getUndoCount(), 50);

  const undone = hm.undo();
  assert.equal(undone, 54);
  const redone = hm.redo();
  assert.equal(redone, 55);
});
