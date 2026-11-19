export type ResolutionPreset = '480p SD' | '720p HD' | '1080p FHD' | '1440p QHD' | '4K UHD';
export type FrameRate = 24 | 30 | 50 | 60 | 120;
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export type TrackType = 'video' | 'audio' | 'text' | 'sticker' | 'overlay';

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'custom';

export interface BezierControlPoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Keyframe {
  id: string;
  timeOffsetMs: number; // Relative to clip startMs
  x: number; // -100 to 100 (% offset from center)
  y: number; // -100 to 100 (% offset from center)
  scale: number; // 0.1 to 3.0
  rotation: number; // -360 to 360 deg
  opacity: number; // 0 to 1
  easing: EasingType;
  bezier: BezierControlPoints;
}

export interface ChromaKeyConfig {
  enabled: boolean;
  keyColor: string; // Hex e.g. #28B446
  tolerance: number; // 0 to 100
  spillSuppression: number; // 0 to 100
}

export interface ColorGradingConfig {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  temperature: number; // -100 (cool) to 100 (warm)
  lutPresetId: string | null;
  lutIntensity: number; // 0 to 100
  customLutName?: string;
  customLutMatrix?: [number, number, number]; // Avg RGB tint shift parsed from .CUBE
}

export type ShaderEffectType = 'none' | 'vignette' | 'chromatic' | 'grain' | 'sharpen' | 'cinematic-glow';

export interface ShaderEffectConfig {
  type: ShaderEffectType;
  intensity: number; // 0 to 100
}

export interface AudioConfig {
  gain: number; // 0 to 2.0 (1.0 = 0dB)
  fadeInMs: number;
  fadeOutMs: number;
  sidechainDucking: boolean;
  duckingDepth: number; // 0 to 0.9 (fraction attenuated when voice/primary audio is active)
  muted: boolean;
  waveformPeaks: number[]; // Decimated 0..1 waveform samples
}

export interface TextOverlayConfig {
  text: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  fontWeight: '500' | '700' | '800';
}

export type MediaSourceKind = 'image' | 'video' | 'audio' | 'procedural' | 'text' | 'sticker';

export interface TimelineClip {
  id: string;
  trackId: string;
  name: string;
  kind: MediaSourceKind;
  mediaSrc?: string; // URL, blob URL, or generated asset path
  proceduralPreset?: 'alpine-motion' | 'neon-grid' | 'studio-slate' | 'synth-beat' | 'voiceover-narration';
  startMs: number;
  durationMs: number;
  sourceInMs: number;
  sourceDurationMs: number;
  colorTag: string;
  keyframes: Keyframe[];
  chromaKey: ChromaKeyConfig;
  colorGrading: ColorGradingConfig;
  shader: ShaderEffectConfig;
  audio: AudioConfig;
  textOverlay?: TextOverlayConfig;
  stickerSymbol?: string;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  order: number;
  muted: boolean;
  locked: boolean;
  solo: boolean;
}

export interface RornProject {
  id: string;
  name: string;
  resolution: ResolutionPreset;
  fps: FrameRate;
  aspectRatio: AspectRatio;
  createdAt: number;
  updatedAt: number;
  thumbnailSrc?: string;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  proxyCacheEnabled: boolean;
  magneticSnappingEnabled: boolean;
  zoomLevel: number; // pixels per second (e.g. 24 to 180)
}

export interface PermissionGrantState {
  storage: 'pending' | 'granted' | 'denied';
  camera: 'pending' | 'granted' | 'denied';
  microphone: 'pending' | 'granted' | 'denied';
  notifications: 'pending' | 'granted' | 'denied';
  completed: boolean;
}

export interface MediaAssetItem {
  id: string;
  name: string;
  kind: MediaSourceKind;
  durationMs: number;
  resolutionLabel: string;
  codecLabel: string;
  mediaSrc?: string;
  proceduralPreset?: TimelineClip['proceduralPreset'];
  thumbnailSrc?: string;
}

export interface LutPreset {
  id: string;
  name: string;
  description: string;
  rgbShift: [number, number, number];
  contrastBoost: number;
  saturationShift: number;
}

export interface ExportConfig {
  container: 'MP4' | 'MKV' | 'AVI' | 'MOV' | 'WEBM' | '3GP' | 'FLV' | 'TS' | 'M4V' | 'WMV';
  videoCodec: 'H.264 (AVC)' | 'H.265 (HEVC)' | 'VP8' | 'VP9' | 'AV1' | 'MPEG-4';
  audioCodec: 'AAC' | 'MP3' | 'OPUS' | 'FLAC' | 'WAV' | 'OGG' | 'PCM';
  resolution: ResolutionPreset;
  fps: FrameRate;
  bitrateMbps: number;
  hardwareAccelerated: boolean;
  softwareFallbackEngine: 'FFmpeg' | 'libdav1d';
}

export const LUT_PRESETS: LutPreset[] = [
  {
    id: 'teal-orange',
    name: 'Teal & Amber Cinema',
    description: 'Warm skin highlights with deep cyan shadow separation',
    rgbShift: [1.08, 0.99, 0.92],
    contrastBoost: 14,
    saturationShift: 12,
  },
  {
    id: 'kodak-2383',
    name: 'Film Print 2383',
    description: 'Rich theatrical print curve with gentle highlight roll-off',
    rgbShift: [1.04, 1.01, 0.95],
    contrastBoost: 18,
    saturationShift: -6,
  },
  {
    id: 'nordic-slate',
    name: 'Nordic Desaturated',
    description: 'Cool slate midtones with crisp architectural contrast',
    rgbShift: [0.92, 0.98, 1.09],
    contrastBoost: 10,
    saturationShift: -24,
  },
  {
    id: 'bleach-bypass',
    name: 'Silver Bleach Bypass',
    description: 'High-contrast metallic tonal compression',
    rgbShift: [1.0, 1.0, 1.0],
    contrastBoost: 32,
    saturationShift: -42,
  },
];

export const UNIVERSAL_CODEC_MATRIX = {
  containers: ['MP4', 'MKV', 'AVI', 'MOV', 'WEBM', '3GP', 'FLV', 'TS', 'M4V', 'WMV'] as const,
  videoCodecs: ['H.264 (AVC)', 'H.265 (HEVC)', 'VP8', 'VP9', 'AV1', 'MPEG-4'] as const,
  audioCodecs: ['AAC', 'MP3', 'OPUS', 'FLAC', 'WAV', 'OGG', 'PCM'] as const,
  resolutions: ['480p SD', '720p HD', '1080p FHD', '1440p QHD', '4K UHD'] as const,
  frameRates: [24, 30, 50, 60, 120] as const,
};

export const ARCHITECTURE_MODULES = [
  {
    module: ':app',
    layer: 'Presentation Layer',
    tech: 'Jetpack Compose · ViewModels · UI State',
    responsibilities: [
      'SplashScreen with 1%-100% progress & dynamic RORN gradient emblem',
      'PermissionGateDialog (Storage, Camera, Microphone, Notifications)',
      'ProjectHomeScreen (+ New CTA & Recent Projects Room list)',
      'EditorWorkspaceScreen with multi-track gesture canvas & inspector',
    ],
  },
  {
    module: ':domain',
    layer: 'Business Logic Layer',
    tech: 'Pure Kotlin/TS UseCases · Timeline Models · Undo/Redo Commands',
    responsibilities: [
      'SplitClipUseCase & RippleDeleteUseCase (frame-accurate math)',
      'MagneticSnapEngine (150ms proximity lock against clip boundaries)',
      'BezierKeyframeEvaluator & SidechainDuckingEnvelope',
      'CommandHistoryManager (up to 50 undoable operations)',
    ],
  },
  {
    module: ':data',
    layer: 'Data & Storage Layer',
    tech: 'Room DB · Recovery Journal · LRU Proxy Cache · File Repository',
    responsibilities: [
      'ProjectDao & TimelineEntity relational persistence',
      'CrashRecoveryJournalDao (auto-checkpoint every command)',
      'LruProxyCacheManager for 4K zero-lag scrubbing',
      'CubeLutFileParser for .CUBE 3D LUT ingestion',
    ],
  },
  {
    module: ':core:media',
    layer: 'Multimedia & Rendering Engine',
    tech: 'Media3 Transformer · OpenGL ES / WebGL Shaders · Audio Mixer',
    responsibilities: [
      'ChromaKeyGLShader (green screen alpha matte & spill suppression)',
      'ColorGradingShader (LUT 3D sampling + temperature/contrast)',
      'MultiTrackAudioMixer (volume automation & sidechain ducking)',
      'Hardware Export Pipeline with FFmpeg/libdav1d software fallback',
    ],
  },
];

export function createDefaultChromaKey(): ChromaKeyConfig {
  return {
    enabled: false,
    keyColor: '#28B446',
    tolerance: 38,
    spillSuppression: 45,
  };
}

export function createDefaultColorGrading(): ColorGradingConfig {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    lutPresetId: null,
    lutIntensity: 85,
  };
}

export function createDefaultAudioConfig(peaks?: number[]): AudioConfig {
  return {
    gain: 1.0,
    fadeInMs: 0,
    fadeOutMs: 0,
    sidechainDucking: false,
    duckingDepth: 0.55,
    muted: false,
    waveformPeaks: peaks ?? generateDeterministicWaveform(48, 0.65),
  };
}

export function generateDeterministicWaveform(count: number, energy = 0.7, seed = 17): number[] {
  const result: number[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const rand = s / 4294967296;
    const envelope = Math.sin((i / Math.max(1, count - 1)) * Math.PI) * 0.45 + 0.55;
    const peak = Math.min(1, Math.max(0.12, (0.25 + rand * 0.75) * energy * envelope));
    result.push(Number(peak.toFixed(3)));
  }
  return result;
}
