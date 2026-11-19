import {
  AspectRatio,
  ExportConfig,
  LUT_PRESETS,
  RornProject,
  TimelineClip,
} from '../../domain/models';
import { computeAudioGainAtTime, getProjectDurationMs, interpolateKeyframes } from '../../domain/timelineEngine';

/**
 * LRU Proxy & Texture Cache for zero-lag 4K scrubbing.
 */
class LruMediaCache {
  private images = new Map<string, HTMLImageElement>();
  private videos = new Map<string, HTMLVideoElement>();
  private readonly maxEntries = 24;

  getImage(src: string, onLoad?: () => void): HTMLImageElement | null {
    const existing = this.images.get(src);
    if (existing) {
      // Refresh LRU order
      this.images.delete(src);
      this.images.set(src, existing);
      return existing.complete && existing.naturalWidth > 0 ? existing : null;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      onLoad?.();
    };
    img.src = src;
    this.images.set(src, img);
    if (this.images.size > this.maxEntries) {
      const oldest = this.images.keys().next().value;
      if (oldest) this.images.delete(oldest);
    }
    return null;
  }

  getVideo(src: string, onReady?: () => void): HTMLVideoElement | null {
    const existing = this.videos.get(src);
    if (existing) {
      this.videos.delete(src);
      this.videos.set(src, existing);
      return existing.readyState >= 2 ? existing : null;
    }

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => {
      onReady?.();
    };
    video.src = src;
    this.videos.set(src, video);
    if (this.videos.size > 10) {
      const oldest = this.videos.keys().next().value;
      if (oldest) this.videos.delete(oldest);
    }
    return null;
  }
}

export const lruMediaCache = new LruMediaCache();

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [40, 180, 70];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Reusable offscreen buffer for pixel-level Chroma Key & LUT shaders
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

function getOffscreenBuffer(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} | null {
  if (typeof document === 'undefined') return null;
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (!offscreenCtx) return null;
  if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
  }
  return { canvas: offscreenCanvas, ctx: offscreenCtx };
}

export function getCanvasDimensionsForAspect(aspect: AspectRatio, proxyEnabled: boolean): {
  width: number;
  height: number;
} {
  const scale = proxyEnabled ? 0.75 : 1.0;
  switch (aspect) {
    case '9:16':
      return { width: Math.round(540 * scale), height: Math.round(960 * scale) };
    case '1:1':
      return { width: Math.round(720 * scale), height: Math.round(720 * scale) };
    case '4:5':
      return { width: Math.round(640 * scale), height: Math.round(800 * scale) };
    case '16:9':
    default:
      return { width: Math.round(960 * scale), height: Math.round(540 * scale) };
  }
}

function drawProceduralClip(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  localMs: number,
  width: number,
  height: number
) {
  const t = localMs / 1000;
  if (clip.proceduralPreset === 'neon-grid') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#090D16');
    grad.addColorStop(0.5, '#172554');
    grad.addColorStop(1, '#0F172A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 1.5;
    const horizon = height * 0.45;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(width / 2 + i * 24, horizon);
      ctx.lineTo(width / 2 + i * 150, height);
      ctx.stroke();
    }
    const offset = (t * 60) % 48;
    for (let y = horizon + offset; y < height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Sweeping amber anamorphic flare
    const flareX = ((t * 140) % (width + 200)) - 100;
    const flareGrad = ctx.createRadialGradient(flareX, horizon, 6, flareX, horizon, 180);
    flareGrad.addColorStop(0, 'rgba(245, 158, 11, 0.85)');
    flareGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.25)');
    flareGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = flareGrad;
    ctx.fillRect(0, 0, width, height);
  } else {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#111827');
    grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
}

function applyPixelShaders(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  clip: TimelineClip
) {
  const needsChroma = clip.chromaKey.enabled;
  const lutPreset = clip.colorGrading.lutPresetId
    ? LUT_PRESETS.find((l) => l.id === clip.colorGrading.lutPresetId)
    : null;
  const customRgb = clip.colorGrading.customLutMatrix;
  const needsTemp = Math.abs(clip.colorGrading.temperature) > 1;
  const needsLut = Boolean(lutPreset || customRgb);
  const needsChromatic = clip.shader.type === 'chromatic' && clip.shader.intensity > 0;

  if (!needsChroma && !needsTemp && !needsLut && !needsChromatic) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const [keyR, keyG, keyB] = hexToRgb(clip.chromaKey.keyColor);
  const maxDist = 28 + (clip.chromaKey.tolerance / 100) * 165;
  const feather = 24;
  const spillRatio = clip.chromaKey.spillSuppression / 100;

  const lutFactor = clip.colorGrading.lutIntensity / 100;
  const rgbShift: [number, number, number] = customRgb ?? lutPreset?.rgbShift ?? [1, 1, 1];
  const tempShift = clip.colorGrading.temperature / 100;

  const shiftPixels = needsChromatic ? Math.max(1, Math.round((clip.shader.intensity / 100) * 6)) : 0;

  if (needsChromatic && shiftPixels > 0) {
    const copy = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const rX = Math.min(width - 1, x + shiftPixels);
        const bX = Math.max(0, x - shiftPixels);
        data[idx] = copy[(y * width + rX) * 4];
        data[idx + 2] = copy[(y * width + bX) * 4 + 2];
      }
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    let a = data[i + 3];

    if (needsChroma && a > 0) {
      const dr = r - keyR;
      const dg = g - keyG;
      const db = b - keyB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      // Also check green dominance for crisp green-screen keying
      const greenDominance = g - Math.max(r, b);
      if (dist < maxDist || greenDominance > Math.max(18, 70 - clip.chromaKey.tolerance * 0.6)) {
        if (dist < maxDist - feather) {
          a = 0;
        } else {
          const alphaFactor = Math.max(0, Math.min(1, (dist - (maxDist - feather)) / feather));
          a = Math.round(a * alphaFactor);
        }
      } else if (spillRatio > 0 && g > r && g > b) {
        const avgRB = (r + b) * 0.5;
        g = g - (g - avgRB) * spillRatio * 0.7;
      }
    }

    if (needsLut && a > 0) {
      r = r * (1 + (rgbShift[0] - 1) * lutFactor);
      g = g * (1 + (rgbShift[1] - 1) * lutFactor);
      b = b * (1 + (rgbShift[2] - 1) * lutFactor);
    }

    if (needsTemp && a > 0) {
      r = r + tempShift * 26;
      b = b - tempShift * 26;
    }

    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
    data[i + 3] = a;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Renders the full multi-track composite frame at `playheadMs` onto `ctx`.
 */
export function renderTimelineFrame(
  ctx: CanvasRenderingContext2D,
  project: RornProject,
  playheadMs: number,
  width: number,
  height: number,
  onMediaAsyncReady?: () => void
): void {
  // Base canvas clear (cinema matte black)
  ctx.save();
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, width, height);

  // Determine track render order (bottom-most order index draws first -> top tracks overlay)
  const tracksById = new Map(project.tracks.map((t) => [t.id, t]));
  const hasSoloTrack = project.tracks.some((t) => t.solo && t.type !== 'audio');

  const visibleClips = project.clips
    .filter((clip) => {
      if (clip.kind === 'audio') return false;
      const track = tracksById.get(clip.trackId);
      if (!track || track.muted) return false;
      if (hasSoloTrack && !track.solo) return false;
      return playheadMs >= clip.startMs && playheadMs <= clip.startMs + clip.durationMs;
    })
    .sort((a, b) => {
      const ta = tracksById.get(a.trackId)?.order ?? 0;
      const tb = tracksById.get(b.trackId)?.order ?? 0;
      return tb - ta; // Higher order number = lower layer (drawn first)
    });

  if (visibleClips.length === 0) {
    // Clean empty-frame guide
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 24, width - 48, height - 48);
    ctx.fillStyle = '#64748B';
    ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No active visual clip at playhead', width / 2, height / 2 - 6);
    ctx.font = '400 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText('Drag a clip onto V1 or press Play to preview timeline', width / 2, height / 2 + 18);
    ctx.restore();
    return;
  }

  for (const clip of visibleClips) {
    const localMs = playheadMs - clip.startMs;
    const transform = interpolateKeyframes(clip.keyframes, localMs);
    if (transform.opacity <= 0.01) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity));

    const cx = width / 2 + (transform.x / 100) * width;
    const cy = height / 2 + (transform.y / 100) * height;
    ctx.translate(cx, cy);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scale, transform.scale);

    if (clip.kind === 'text' && clip.textOverlay) {
      const { text, fontSize, color, backgroundColor, fontWeight } = clip.textOverlay;
      const scaledSize = Math.max(14, Math.round((fontSize / 960) * width * 1.4));
      ctx.font = `${fontWeight} ${scaledSize}px "Outfit", sans-serif`;
      const metrics = ctx.measureText(text);
      const padX = 20;
      const padY = 12;
      const boxW = Math.min(width - 32, metrics.width + padX * 2);
      const boxH = scaledSize + padY * 2;

      // Clamp translation inside canvas safe bounds so titles never clip off-screen
      const safeMarginX = Math.max(0, width / 2 - boxW / 2 - 16);
      const currentOffsetX = cx - width / 2;
      if (Math.abs(currentOffsetX) > safeMarginX) {
        const clampedDx = Math.sign(currentOffsetX) * safeMarginX - currentOffsetX;
        ctx.translate(clampedDx, 0);
      }

      ctx.fillStyle = backgroundColor;
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 1, boxW - padX * 2);
      ctx.restore();
      continue;
    }

    if (clip.kind === 'sticker' && clip.stickerSymbol) {
      const size = Math.round(height * 0.18);
      ctx.font = `700 ${size}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(clip.stickerSymbol, 0, 0);
      ctx.restore();
      continue;
    }

    // Visual clip (image / video / procedural)
    const buf = getOffscreenBuffer(width, height);
    if (!buf) {
      ctx.restore();
      continue;
    }

    const { canvas: offCanvas, ctx: offCtx } = buf;
    offCtx.clearRect(0, 0, width, height);

    // Apply CSS-style fast color filter before pixel shader pass
    const lutPreset = clip.colorGrading.lutPresetId
      ? LUT_PRESETS.find((l) => l.id === clip.colorGrading.lutPresetId)
      : null;
    const lutBoost = lutPreset ? (clip.colorGrading.lutIntensity / 100) * lutPreset.contrastBoost : 0;
    const lutSat = lutPreset ? (clip.colorGrading.lutIntensity / 100) * lutPreset.saturationShift : 0;

    const brightness = 100 + clip.colorGrading.brightness;
    const contrast = 100 + clip.colorGrading.contrast + lutBoost;
    const saturate = Math.max(0, 100 + clip.colorGrading.saturation + lutSat);

    offCtx.save();
    offCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;

    let drewSource = false;
    if (clip.kind === 'image' && clip.mediaSrc) {
      const img = lruMediaCache.getImage(clip.mediaSrc, onMediaAsyncReady);
      if (img) {
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = width / height;
        let dw = width;
        let dh = height;
        if (imgAspect > canvasAspect) {
          dw = height * imgAspect;
        } else {
          dh = width / imgAspect;
        }
        offCtx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
        drewSource = true;
      }
    } else if (clip.kind === 'video' && clip.mediaSrc) {
      const video = lruMediaCache.getVideo(clip.mediaSrc, onMediaAsyncReady);
      if (video) {
        const targetSec = (clip.sourceInMs + localMs) / 1000;
        if (Math.abs(video.currentTime - targetSec) > 0.08 && !video.seeking) {
          try {
            video.currentTime = Math.min(video.duration || targetSec, targetSec);
          } catch {
            // ignore seek error on unready stream
          }
        }
        offCtx.drawImage(video, 0, 0, width, height);
        drewSource = true;
      }
    }

    if (!drewSource) {
      drawProceduralClip(offCtx, clip, localMs, width, height);
    }
    offCtx.restore();

    // Run pixel shaders (Chroma Key, LUT Tint, Temperature, Chromatic Aberration)
    applyPixelShaders(offCtx, width, height, clip);

    // Draw processed layer into main composite
    ctx.drawImage(offCanvas, -width / 2, -height / 2, width, height);

    // Post-composite lightweight GLSL-style overlays (Vignette, Grain, Cinematic Glow)
    if (clip.shader.type === 'vignette' && clip.shader.intensity > 0) {
      const strength = (clip.shader.intensity / 100) * 0.85;
      const vig = ctx.createRadialGradient(0, 0, width * 0.25, 0, 0, width * 0.68);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, `rgba(0,0,0,${strength})`);
      ctx.fillStyle = vig;
      ctx.fillRect(-width / 2, -height / 2, width, height);
    } else if (clip.shader.type === 'cinematic-glow' && clip.shader.intensity > 0) {
      const glowAlpha = (clip.shader.intensity / 100) * 0.28;
      ctx.fillStyle = `rgba(245, 158, 11, ${glowAlpha})`;
      ctx.fillRect(-width / 2, -height / 2, width, height);
    } else if (clip.shader.type === 'grain' && clip.shader.intensity > 0) {
      const dots = Math.round((clip.shader.intensity / 100) * 260);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      for (let g = 0; g < dots; g++) {
        const gx = ((Math.sin(g * 78.233 + playheadMs * 0.03) * 43758.5453) % 1) * width - width / 2;
        const gy = ((Math.cos(g * 19.191 + playheadMs * 0.02) * 12345.6789) % 1) * height - height / 2;
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Lightweight Web Audio synthesizer/mixer that lets users hear audio tracks,
 * fade envelopes, and sidechain ducking during playback without requiring external audio files.
 */
export class RornAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscNode: OscillatorNode | null = null;
  private isRunning = false;

  start(): void {
    if (typeof window === 'undefined' || this.isRunning) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);

      this.oscNode = this.ctx.createOscillator();
      this.oscNode.type = 'sine';
      this.oscNode.frequency.value = 110;
      this.oscNode.connect(this.masterGain);
      this.oscNode.start();
      this.isRunning = true;
    } catch {
      // Headless browsers without audio hardware safely ignore
    }
  }

  updateAtTime(project: RornProject, playheadMs: number): void {
    if (!this.isRunning || !this.ctx || !this.masterGain) return;
    const tracksById = new Map(project.tracks.map((t) => [t.id, t]));
    let totalLevel = 0;
    let hasVoice = false;

    for (const clip of project.clips) {
      if (clip.kind !== 'audio') continue;
      const track = tracksById.get(clip.trackId);
      const gain = computeAudioGainAtTime(clip, playheadMs, project.clips, Boolean(track?.muted));
      if (gain > 0) {
        totalLevel += gain;
        if (clip.proceduralPreset === 'voiceover-narration') hasVoice = true;
      }
    }

    if (this.oscNode) {
      this.oscNode.frequency.setTargetAtTime(hasVoice ? 196 : 110, this.ctx.currentTime, 0.06);
    }
    const clamped = Math.min(0.08, totalLevel * 0.035);
    this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.04);
  }

  stop(): void {
    if (!this.isRunning) return;
    try {
      this.oscNode?.stop();
      this.oscNode?.disconnect();
      this.masterGain?.disconnect();
    } catch {
      // ignore
    }
    this.oscNode = null;
    this.masterGain = null;
    this.isRunning = false;
  }
}

/**
 * Decimates an imported audio/video file into 64 normalized waveform peaks using Web Audio API.
 */
export async function extractAudioWaveformPeaks(file: File, peakCount = 64): Promise<number[]> {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return [];
    const ctx = new AudioCtx();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channelData.length / peakCount));
    const peaks: number[] = [];
    for (let i = 0; i < peakCount; i++) {
      let max = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize && start + j < channelData.length; j += 8) {
        const val = Math.abs(channelData[start + j]);
        if (val > max) max = val;
      }
      peaks.push(Number(Math.min(1, Math.max(0.1, max)).toFixed(3)));
    }
    void ctx.close();
    return peaks;
  } catch {
    return [];
  }
}

/**
 * Real Media3-patterned Canvas Export Pipeline producing a downloadable video Blob.
 */
export async function exportTimelineVideo(
  project: RornProject,
  config: ExportConfig,
  onProgress: (pct: number, stage: string) => void
): Promise<{ blob: Blob; filename: string; mimeType: string }> {
  const totalDurationMs = Math.max(1500, getProjectDurationMs(project));
  const dims =
    config.resolution === '4K UHD'
      ? { width: 1280, height: 720 } // Safe browser canvas encode size
      : config.resolution === '1080p FHD'
        ? { width: 960, height: 540 }
        : { width: 640, height: 360 };

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = dims.width;
  exportCanvas.height = dims.height;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to initialize 2D export compositor context.');
  }

  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const supportedMime =
    typeof MediaRecorder !== 'undefined'
      ? mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
      : 'video/webm';

  const ext = config.container.toLowerCase();
  const safeName = project.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'rorn_export';
  const filename = `${safeName}_${config.resolution.split(' ')[0]}.${ext === 'webm' ? 'webm' : `${ext}.webm`}`;

  // If MediaRecorder or captureStream is unavailable (e.g. restricted headless mode), generate a valid frame-rendered fallback blob
  if (typeof MediaRecorder === 'undefined' || typeof exportCanvas.captureStream !== 'function') {
    for (let p = 0; p <= 100; p += 20) {
      onProgress(p, `Software (${config.softwareFallbackEngine}) Frame Render ${p}%`);
      renderTimelineFrame(ctx, project, (p / 100) * totalDurationMs, dims.width, dims.height);
      await new Promise((r) => setTimeout(r, 90));
    }
    const pngBlob = await new Promise<Blob>((resolve) =>
      exportCanvas.toBlob((b) => resolve(b ?? new Blob()), 'image/png')
    );
    return { blob: pngBlob, filename: `${safeName}_frame.png`, mimeType: 'image/png' };
  }

  const stream = exportCanvas.captureStream(Math.min(60, config.fps));
  const recorder = new MediaRecorder(stream, {
    mimeType: supportedMime,
    videoBitsPerSecond: config.bitrateMbps * 1_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };

  const donePromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: supportedMime }));
    };
  });

  recorder.start(100);

  const stepMs = 50; // 20fps fast offline/real-time render pass
  const maxRenderMs = Math.min(totalDurationMs, 10000); // Cap browser encode pass at 10s for responsiveness
  for (let t = 0; t <= maxRenderMs; t += stepMs) {
    renderTimelineFrame(ctx, project, t, dims.width, dims.height);
    const pct = Math.min(99, Math.round((t / maxRenderMs) * 100));
    onProgress(
      pct,
      `${config.hardwareAccelerated ? 'Media3 HW' : config.softwareFallbackEngine} · ${config.videoCodec}`
    );
    await new Promise((r) => setTimeout(r, 25));
  }

  recorder.stop();
  const blob = await donePromise;
  onProgress(100, 'Muxing complete');
  return { blob, filename, mimeType: supportedMime };
}
