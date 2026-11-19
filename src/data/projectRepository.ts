import {
  AspectRatio,
  createDefaultAudioConfig,
  createDefaultChromaKey,
  createDefaultColorGrading,
  FrameRate,
  generateDeterministicWaveform,
  MediaAssetItem,
  PermissionGrantState,
  ResolutionPreset,
  RornProject,
  TimelineClip,
  TimelineTrack,
} from '../domain/models';

const PROJECTS_STORAGE_KEY = 'rorn_room_projects_v1';
const PERMISSIONS_STORAGE_KEY = 'rorn_permissions_v1';
const RECOVERY_JOURNAL_KEY = 'rorn_crash_recovery_journal_v1';
const IDB_NAME = 'rorn_room_db';
const IDB_STORE = 'projects';

export const SAMPLE_IMAGES = {
  mountain: '/src/assets/images/sample_cinema_mountain_1795089455658.jpg',
  greenscreen: '/src/assets/images/sample_studio_greenscreen_1795089456774.jpg',
  urbanNight: '/src/assets/images/sample_urban_night_1795089456740.jpg',
};

export const BUILTIN_MEDIA_LIBRARY: MediaAssetItem[] = [
  {
    id: 'asset_alpine',
    name: 'Alpine Sunrise Aerial.mp4',
    kind: 'image',
    durationMs: 6000,
    resolutionLabel: '4K UHD',
    codecLabel: 'H.265 HEVC',
    mediaSrc: SAMPLE_IMAGES.mountain,
    thumbnailSrc: SAMPLE_IMAGES.mountain,
  },
  {
    id: 'asset_greenscreen',
    name: 'Director Slate GreenScreen.mov',
    kind: 'image',
    durationMs: 5000,
    resolutionLabel: '1080p FHD',
    codecLabel: 'ProRes / H.264',
    mediaSrc: SAMPLE_IMAGES.greenscreen,
    thumbnailSrc: SAMPLE_IMAGES.greenscreen,
  },
  {
    id: 'asset_urban',
    name: 'Rainy Avenue Night.mkv',
    kind: 'image',
    durationMs: 6000,
    resolutionLabel: '4K UHD',
    codecLabel: 'AV1 10-bit',
    mediaSrc: SAMPLE_IMAGES.urbanNight,
    thumbnailSrc: SAMPLE_IMAGES.urbanNight,
  },
  {
    id: 'asset_motion_grid',
    name: 'Anamorphic Light Sweep.mp4',
    kind: 'procedural',
    proceduralPreset: 'neon-grid',
    durationMs: 5000,
    resolutionLabel: '4K UHD',
    codecLabel: 'VP9',
  },
  {
    id: 'asset_audio_bgm',
    name: 'Cinema Pulse Score.wav',
    kind: 'audio',
    proceduralPreset: 'synth-beat',
    durationMs: 9000,
    resolutionLabel: '48kHz 24-bit',
    codecLabel: 'PCM / FLAC',
  },
  {
    id: 'asset_audio_vox',
    name: 'Director Voiceover.ogg',
    kind: 'audio',
    proceduralPreset: 'voiceover-narration',
    durationMs: 3500,
    resolutionLabel: '48kHz Stereo',
    codecLabel: 'OPUS',
  },
];

export function createDefaultTracks(): TimelineTrack[] {
  return [
    { id: 'track_t1', name: 'Text & Titles', type: 'text', order: 0, muted: false, locked: false, solo: false },
    { id: 'track_v2', name: 'Overlay / Key', type: 'video', order: 1, muted: false, locked: false, solo: false },
    { id: 'track_v1', name: 'Main Video', type: 'video', order: 2, muted: false, locked: false, solo: false },
    { id: 'track_a1', name: 'Voiceover', type: 'audio', order: 3, muted: false, locked: false, solo: false },
    { id: 'track_a2', name: 'Score / BGM', type: 'audio', order: 4, muted: false, locked: false, solo: false },
  ];
}

export function createSeedProjects(): RornProject[] {
  const now = Date.now();

  const chromaDemoClips: TimelineClip[] = [
    {
      id: 'clip_bg_alpine',
      trackId: 'track_v1',
      name: 'Alpine Sunrise Aerial.mp4',
      kind: 'image',
      mediaSrc: SAMPLE_IMAGES.mountain,
      startMs: 0,
      durationMs: 5500,
      sourceInMs: 0,
      sourceDurationMs: 6000,
      colorTag: '#38BDF8',
      keyframes: [
        {
          id: 'kf_1',
          timeOffsetMs: 0,
          x: 0,
          y: 0,
          scale: 1.0,
          rotation: 0,
          opacity: 1,
          easing: 'ease-in-out',
          bezier: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
        },
        {
          id: 'kf_2',
          timeOffsetMs: 5500,
          x: 0,
          y: -4,
          scale: 1.12,
          rotation: 0,
          opacity: 1,
          easing: 'ease-in-out',
          bezier: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
        },
      ],
      chromaKey: createDefaultChromaKey(),
      colorGrading: {
        ...createDefaultColorGrading(),
        lutPresetId: 'teal-orange',
        lutIntensity: 70,
        contrast: 8,
      },
      shader: { type: 'vignette', intensity: 30 },
      audio: createDefaultAudioConfig(),
    },
    {
      id: 'clip_bg_urban',
      trackId: 'track_v1',
      name: 'Rainy Avenue Night.mkv',
      kind: 'image',
      mediaSrc: SAMPLE_IMAGES.urbanNight,
      startMs: 5500,
      durationMs: 4500,
      sourceInMs: 0,
      sourceDurationMs: 6000,
      colorTag: '#38BDF8',
      keyframes: [],
      chromaKey: createDefaultChromaKey(),
      colorGrading: {
        ...createDefaultColorGrading(),
        lutPresetId: 'kodak-2383',
        lutIntensity: 80,
      },
      shader: { type: 'chromatic', intensity: 22 },
      audio: createDefaultAudioConfig(),
    },
    {
      id: 'clip_fg_greenscreen',
      trackId: 'track_v2',
      name: 'Director Slate GreenScreen.mov',
      kind: 'image',
      mediaSrc: SAMPLE_IMAGES.greenscreen,
      startMs: 800,
      durationMs: 4200,
      sourceInMs: 0,
      sourceDurationMs: 5000,
      colorTag: '#10B981',
      keyframes: [
        {
          id: 'kf_gs_1',
          timeOffsetMs: 0,
          x: 24,
          y: 12,
          scale: 0.85,
          rotation: 0,
          opacity: 0,
          easing: 'ease-out',
          bezier: { x1: 0, y1: 0, x2: 0.58, y2: 1 },
        },
        {
          id: 'kf_gs_2',
          timeOffsetMs: 700,
          x: 18,
          y: 8,
          scale: 0.88,
          rotation: 0,
          opacity: 1,
          easing: 'ease-in-out',
          bezier: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
        },
      ],
      chromaKey: {
        enabled: true,
        keyColor: '#36C258',
        tolerance: 46,
        spillSuppression: 55,
      },
      colorGrading: createDefaultColorGrading(),
      shader: { type: 'none', intensity: 0 },
      audio: createDefaultAudioConfig(),
    },
    {
      id: 'clip_title_intro',
      trackId: 'track_t1',
      name: 'RORN Cinema Title',
      kind: 'text',
      startMs: 400,
      durationMs: 3600,
      sourceInMs: 0,
      sourceDurationMs: 5000,
      colorTag: '#F59E0B',
      keyframes: [
        {
          id: 'kf_txt_1',
          timeOffsetMs: 0,
          x: 0,
          y: -32,
          scale: 0.94,
          rotation: 0,
          opacity: 0,
          easing: 'ease-out',
          bezier: { x1: 0, y1: 0, x2: 0.58, y2: 1 },
        },
        {
          id: 'kf_txt_2',
          timeOffsetMs: 600,
          x: 0,
          y: -34,
          scale: 1.0,
          rotation: 0,
          opacity: 1,
          easing: 'ease-out',
          bezier: { x1: 0, y1: 0, x2: 0.58, y2: 1 },
        },
      ],
      chromaKey: createDefaultChromaKey(),
      colorGrading: createDefaultColorGrading(),
      shader: { type: 'none', intensity: 0 },
      audio: createDefaultAudioConfig(),
      textOverlay: {
        text: 'ALPINE EXPEDITION · 4K HDR',
        fontSize: 24,
        color: '#F8FAFC',
        backgroundColor: 'rgba(11, 13, 17, 0.72)',
        fontWeight: '700',
      },
    },
    {
      id: 'clip_vox_1',
      trackId: 'track_a1',
      name: 'Director Voiceover.ogg',
      kind: 'audio',
      proceduralPreset: 'voiceover-narration',
      startMs: 2000,
      durationMs: 3500,
      sourceInMs: 0,
      sourceDurationMs: 3500,
      colorTag: '#A78BFA',
      keyframes: [],
      chromaKey: createDefaultChromaKey(),
      colorGrading: createDefaultColorGrading(),
      shader: { type: 'none', intensity: 0 },
      audio: {
        ...createDefaultAudioConfig(generateDeterministicWaveform(56, 0.85, 41)),
        gain: 1.1,
        fadeInMs: 250,
        fadeOutMs: 300,
      },
    },
    {
      id: 'clip_bgm_1',
      trackId: 'track_a2',
      name: 'Cinema Pulse Score.wav',
      kind: 'audio',
      proceduralPreset: 'synth-beat',
      startMs: 0,
      durationMs: 9500,
      sourceInMs: 0,
      sourceDurationMs: 12000,
      colorTag: '#2DD4BF',
      keyframes: [],
      chromaKey: createDefaultChromaKey(),
      colorGrading: createDefaultColorGrading(),
      shader: { type: 'none', intensity: 0 },
      audio: {
        ...createDefaultAudioConfig(generateDeterministicWaveform(72, 0.72, 99)),
        gain: 0.85,
        fadeInMs: 800,
        fadeOutMs: 1200,
        sidechainDucking: true,
        duckingDepth: 0.6,
      },
    },
  ];

  const nightReelClips: TimelineClip[] = [
    {
      id: 'clip_nr_1',
      trackId: 'track_v1',
      name: 'Rainy Avenue Night.mkv',
      kind: 'image',
      mediaSrc: SAMPLE_IMAGES.urbanNight,
      startMs: 0,
      durationMs: 6000,
      sourceInMs: 0,
      sourceDurationMs: 6000,
      colorTag: '#38BDF8',
      keyframes: [],
      chromaKey: createDefaultChromaKey(),
      colorGrading: {
        ...createDefaultColorGrading(),
        lutPresetId: 'nordic-slate',
        lutIntensity: 75,
      },
      shader: { type: 'grain', intensity: 25 },
      audio: createDefaultAudioConfig(),
    },
    {
      id: 'clip_nr_audio',
      trackId: 'track_a2',
      name: 'Cinema Pulse Score.wav',
      kind: 'audio',
      proceduralPreset: 'synth-beat',
      startMs: 0,
      durationMs: 6000,
      sourceInMs: 0,
      sourceDurationMs: 9000,
      colorTag: '#2DD4BF',
      keyframes: [],
      chromaKey: createDefaultChromaKey(),
      colorGrading: createDefaultColorGrading(),
      shader: { type: 'none', intensity: 0 },
      audio: {
        ...createDefaultAudioConfig(generateDeterministicWaveform(60, 0.75, 13)),
        fadeInMs: 500,
        fadeOutMs: 800,
      },
    },
  ];

  return [
    {
      id: 'proj_alpine_chroma',
      name: 'Alpine Chroma Key Composite',
      resolution: '4K UHD',
      fps: 60,
      aspectRatio: '16:9',
      createdAt: now - 1000 * 60 * 60 * 3,
      updatedAt: now - 1000 * 60 * 18,
      thumbnailSrc: SAMPLE_IMAGES.mountain,
      tracks: createDefaultTracks(),
      clips: chromaDemoClips,
      proxyCacheEnabled: true,
      magneticSnappingEnabled: true,
      zoomLevel: 72,
    },
    {
      id: 'proj_tokyo_grade',
      name: 'Midnight Street Color Grade',
      resolution: '1080p FHD',
      fps: 24,
      aspectRatio: '16:9',
      createdAt: now - 1000 * 60 * 60 * 28,
      updatedAt: now - 1000 * 60 * 60 * 5,
      thumbnailSrc: SAMPLE_IMAGES.urbanNight,
      tracks: createDefaultTracks(),
      clips: nightReelClips,
      proxyCacheEnabled: true,
      magneticSnappingEnabled: true,
      zoomLevel: 68,
    },
  ];
}

function openRoomDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function syncProjectsToIdb(projects: RornProject[]): Promise<void> {
  const db = await openRoomDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.clear();
    for (const p of projects) {
      store.put(p);
    }
  } catch {
    // localStorage remains authoritative synchronous fallback
  }
}

export function loadAllProjects(): RornProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) {
      const seeded = createSeedProjects();
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(seeded));
      void syncProjectsToIdb(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as RornProject[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = createSeedProjects();
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return createSeedProjects();
  }
}

export function saveAllProjects(projects: RornProject[]): void {
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(sorted));
    void syncProjectsToIdb(sorted);
  } catch {
    // ignore storage quota errors in restricted sandboxes
  }
}

export function createNewProject(params: {
  name: string;
  resolution: ResolutionPreset;
  fps: FrameRate;
  aspectRatio: AspectRatio;
}): RornProject {
  const now = Date.now();
  const project: RornProject = {
    id: `proj_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: params.name.trim(),
    resolution: params.resolution,
    fps: params.fps,
    aspectRatio: params.aspectRatio,
    createdAt: now,
    updatedAt: now,
    tracks: createDefaultTracks(),
    clips: [],
    proxyCacheEnabled: params.resolution === '4K UHD',
    magneticSnappingEnabled: true,
    zoomLevel: 72,
  };
  const all = loadAllProjects();
  saveAllProjects([project, ...all]);
  return project;
}

export function upsertProject(project: RornProject): RornProject[] {
  const updated: RornProject = {
    ...project,
    updatedAt: Date.now(),
  };
  const all = loadAllProjects();
  const idx = all.findIndex((p) => p.id === updated.id);
  const next = idx >= 0 ? all.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...all];
  saveAllProjects(next);
  return next;
}

export function deleteProjectById(projectId: string): RornProject[] {
  const next = loadAllProjects().filter((p) => p.id !== projectId);
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
    void syncProjectsToIdb(next);
  } catch {
    // ignore
  }
  return next;
}

export function renameProjectById(projectId: string, newName: string): RornProject[] {
  const trimmed = newName.trim();
  if (!trimmed) return loadAllProjects();
  const next = loadAllProjects().map((p) =>
    p.id === projectId ? { ...p, name: trimmed, updatedAt: Date.now() } : p
  );
  saveAllProjects(next);
  return next;
}

export function duplicateProjectById(projectId: string): RornProject[] {
  const all = loadAllProjects();
  const src = all.find((p) => p.id === projectId);
  if (!src) return all;
  const now = Date.now();
  const copy: RornProject = {
    ...structuredClone(src),
    id: `proj_${now.toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    name: `${src.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
  const next = [copy, ...all];
  saveAllProjects(next);
  return next;
}

export interface RecoveryJournalEntry {
  projectId: string;
  projectName: string;
  actionLabel: string;
  savedAt: number;
  project: RornProject;
}

export function writeCrashRecoveryJournal(project: RornProject, actionLabel: string): void {
  try {
    const entry: RecoveryJournalEntry = {
      projectId: project.id,
      projectName: project.name,
      actionLabel,
      savedAt: Date.now(),
      project,
    };
    localStorage.setItem(RECOVERY_JOURNAL_KEY, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export function readCrashRecoveryJournal(): RecoveryJournalEntry | null {
  try {
    const raw = localStorage.getItem(RECOVERY_JOURNAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RecoveryJournalEntry;
  } catch {
    return null;
  }
}

export function clearCrashRecoveryJournal(): void {
  try {
    localStorage.removeItem(RECOVERY_JOURNAL_KEY);
  } catch {
    // ignore
  }
}

export function loadPermissionState(): PermissionGrantState {
  try {
    const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (!raw) {
      return {
        storage: 'pending',
        camera: 'pending',
        microphone: 'pending',
        notifications: 'pending',
        completed: false,
      };
    }
    return JSON.parse(raw) as PermissionGrantState;
  } catch {
    return {
      storage: 'pending',
      camera: 'pending',
      microphone: 'pending',
      notifications: 'pending',
      completed: false,
    };
  }
}

export function savePermissionState(state: PermissionGrantState): void {
  try {
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
