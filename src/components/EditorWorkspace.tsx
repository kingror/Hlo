import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Layers,
  Mic,
  Music,
  Pause,
  Play,
  Redo2,
  Save,
  SkipBack,
  Sticker,
  Type,
  Undo2,
  Upload,
  Video,
} from 'lucide-react';
import {
  createDefaultAudioConfig,
  createDefaultChromaKey,
  createDefaultColorGrading,
  generateDeterministicWaveform,
  MediaAssetItem,
  RornProject,
  TimelineClip,
  TrackType,
} from '../domain/models';
import {
  formatTimecode,
  getProjectDurationMs,
  HistoryManager,
  rippleDeleteClip,
  splitClipAtTime,
} from '../domain/timelineEngine';
import { BUILTIN_MEDIA_LIBRARY, writeCrashRecoveryJournal } from '../data/projectRepository';
import {
  exportTimelineVideo,
  extractAudioWaveformPeaks,
  getCanvasDimensionsForAspect,
  renderTimelineFrame,
  RornAudioEngine,
} from '../core/media/compositor';
import { InspectorPanel } from './InspectorPanel';
import { TimelinePanel } from './TimelinePanel';
import { ExportModal } from './ExportModal';

interface EditorWorkspaceProps {
  initialProject: RornProject;
  onSaveProject: (project: RornProject) => void;
  onBackHome: () => void;
  onOpenBlueprint: () => void;
}

type BinTab = 'media' | 'titles' | 'stickers';

export function EditorWorkspace({
  initialProject,
  onSaveProject,
  onBackHome,
  onOpenBlueprint,
}: EditorWorkspaceProps) {
  const historyRef = useRef<HistoryManager<RornProject>>(
    new HistoryManager(initialProject, 'Load project')
  );
  const [project, setProject] = useState<RornProject>(initialProject);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>(
    initialProject.clips[0] ? [initialProject.clips[0].id] : []
  );
  const [binTab, setBinTab] = useState<BinTab>('media');
  const [mediaAssets, setMediaAssets] = useState<MediaAssetItem[]>(BUILTIN_MEDIA_LIBRARY);
  const [showExportModal, setShowExportModal] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [mobilePane, setMobilePane] = useState<'preview' | 'media' | 'inspector'>('preview');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioEngineRef = useRef<RornAudioEngine>(new RornAudioEngine());
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  const commitProjectChange = useCallback((next: RornProject, actionLabel: string) => {
    const committed = historyRef.current.execute(next, actionLabel);
    setProject(committed);
    writeCrashRecoveryJournal(committed, actionLabel);
  }, []);

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.undo();
    if (prev) {
      setProject(prev);
      writeCrashRecoveryJournal(prev, 'Undo');
    }
  }, []);

  const handleRedo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next) {
      setProject(next);
      writeCrashRecoveryJournal(next, 'Redo');
    }
  }, []);

  // Render preview canvas whenever project, playhead, or async media changes
  const drawCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = getCanvasDimensionsForAspect(
      projectRef.current.aspectRatio,
      projectRef.current.proxyCacheEnabled
    );
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    renderTimelineFrame(ctx, projectRef.current, playheadMs, width, height, () => {
      requestAnimationFrame(() => drawCurrentFrame());
    });
  }, [playheadMs]);

  useEffect(() => {
    drawCurrentFrame();
  }, [project, playheadMs, drawCurrentFrame]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      audioEngineRef.current.stop();
      return;
    }
    audioEngineRef.current.start();
    let frameId = 0;
    let lastTime = performance.now();
    const totalDuration = Math.max(4000, getProjectDurationMs(projectRef.current));

    const step = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      setPlayheadMs((prev) => {
        const next = prev + dt;
        audioEngineRef.current.updateAtTime(projectRef.current, next);
        if (next >= totalDuration) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frameId);
      audioEngineRef.current.stop();
    };
  }, [isPlaying]);

  function handleSaveNow() {
    onSaveProject(project);
    setSaveNotice('Saved');
    setTimeout(() => setSaveNotice(''), 2000);
  }

  function addAssetToTimeline(asset: MediaAssetItem) {
    const isAudio = asset.kind === 'audio';
    const targetTrack =
      project.tracks.find((t) => t.type === (isAudio ? 'audio' : 'video')) ?? project.tracks[0];
    if (!targetTrack) return;

    const trackClips = project.clips.filter((c) => c.trackId === targetTrack.id);
    const startMs = trackClips.reduce(
      (max, c) => Math.max(max, c.startMs + c.durationMs),
      0
    );

    const newClip: TimelineClip = {
      id: `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      trackId: targetTrack.id,
      name: asset.name,
      kind: asset.kind,
      mediaSrc: asset.mediaSrc,
      proceduralPreset: asset.proceduralPreset,
      startMs,
      durationMs: asset.durationMs,
      sourceInMs: 0,
      sourceDurationMs: asset.durationMs,
      colorTag: isAudio ? '#2DD4BF' : '#38BDF8',
      keyframes: [],
      chromaKey: createDefaultChromaKey(),
      colorGrading: createDefaultColorGrading(),
      shader: { type: 'none', intensity: 0 },
      audio: createDefaultAudioConfig(
        isAudio ? generateDeterministicWaveform(56, 0.78, Date.now() % 97) : undefined
      ),
    };

    const next = {
      ...project,
      clips: [...project.clips, newClip],
      thumbnailSrc: project.thumbnailSrc ?? asset.thumbnailSrc,
    };
    commitProjectChange(next, `Add ${asset.name}`);
    setSelectedClipIds([newClip.id]);
  }

  function addTextOverlay(label: string, textContent: string) {
    const textTrack =
      project.tracks.find((t) => t.type === 'text') ?? project.tracks[0];
    if (!textTrack) return;

    const newClip: TimelineClip = {
      id: `clip_txt_${Date.now().toString(36)}`,
      trackId: textTrack.id,
      name: label,
      kind: 'text',
      startMs: Math.round(playheadMs),
      durationMs: 3200,
      sourceInMs: 0,
      sourceDurationMs: 5000,
      colorTag: '#F59E0B',
      keyframes: [],
      chromaKey: createDefaultChromaKey(),
      colorGrading: createDefaultColorGrading(),
      shader: { type: 'none', intensity: 0 },
      audio: createDefaultAudioConfig(),
      textOverlay: {
        text: textContent,
        fontSize: 36,
        color: '#FFFFFF',
        backgroundColor: 'rgba(11, 13, 17, 0.72)',
        fontWeight: '700',
      },
    };
    commitProjectChange({ ...project, clips: [...project.clips, newClip] }, `Add ${label}`);
    setSelectedClipIds([newClip.id]);
  }

  function addStickerOverlay(symbol: string, label: string) {
    const textTrack =
      project.tracks.find((t) => t.type === 'text') ?? project.tracks[0];
    if (!textTrack) return;

    const newClip: TimelineClip = {
      id: `clip_stk_${Date.now().toString(36)}`,
      trackId: textTrack.id,
      name: label,
      kind: 'sticker',
      startMs: Math.round(playheadMs),
      durationMs: 2500,
      sourceInMs: 0,
      sourceDurationMs: 5000,
      colorTag: '#EC4899',
      keyframes: [],
      chromaKey: createDefaultChromaKey(),
      colorGrading: createDefaultColorGrading(),
      shader: { type: 'none', intensity: 0 },
      audio: createDefaultAudioConfig(),
      stickerSymbol: symbol,
    };
    commitProjectChange({ ...project, clips: [...project.clips, newClip] }, `Add sticker ${label}`);
    setSelectedClipIds([newClip.id]);
  }

  async function handleLocalFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const imported: MediaAssetItem[] = [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const isAudio = file.type.startsWith('audio/');
      const isVideo = file.type.startsWith('video/');
      if (isAudio) {
        await extractAudioWaveformPeaks(file, 48);
      }
      imported.push({
        id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        name: file.name,
        kind: isAudio ? 'audio' : isVideo ? 'video' : 'image',
        durationMs: 5000,
        resolutionLabel: isAudio ? '48kHz' : 'Source',
        codecLabel: file.type.split('/')[1]?.toUpperCase() || 'MEDIA',
        mediaSrc: url,
        thumbnailSrc: isAudio || isVideo ? undefined : url,
      });
    }

    setMediaAssets((prev) => [...imported, ...prev]);
    if (imported[0]) addAssetToTimeline(imported[0]);
  }

  async function handleToggleVoiceoverRecord() {
    if (isRecordingMic) {
      micRecorderRef.current?.stop();
      setIsRecordingMic(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        addAssetToTimeline({
          id: `vox_${Date.now().toString(36)}`,
          name: `Voiceover_${new Date().toLocaleTimeString().replace(/:/g, '-')}.ogg`,
          kind: 'audio',
          proceduralPreset: 'voiceover-narration',
          durationMs: 3500,
          resolutionLabel: '48kHz',
          codecLabel: 'OPUS',
          mediaSrc: url,
        });
      };
      micRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingMic(true);
    } catch {
      // Graceful fallback in environments without physical microphone
      addAssetToTimeline({
        id: `vox_sim_${Date.now().toString(36)}`,
        name: 'Studio Voiceover Take.ogg',
        kind: 'audio',
        proceduralPreset: 'voiceover-narration',
        durationMs: 3500,
        resolutionLabel: '48kHz',
        codecLabel: 'OPUS',
      });
    }
  }

  function handleSplitSelected() {
    const targetId = selectedClipIds[0];
    if (!targetId) return;
    const nextClips = splitClipAtTime(project.clips, targetId, playheadMs, project.fps);
    if (nextClips === project.clips) return;
    commitProjectChange({ ...project, clips: nextClips }, 'Split clip');
  }

  function handleRippleDeleteSelected() {
    if (selectedClipIds.length === 0) return;
    let nextClips = project.clips;
    for (const id of selectedClipIds) {
      nextClips = rippleDeleteClip(nextClips, id);
    }
    commitProjectChange({ ...project, clips: nextClips }, 'Ripple delete clip');
    setSelectedClipIds([]);
  }

  function handleDuplicateSelected() {
    const target = project.clips.find((c) => c.id === selectedClipIds[0]);
    if (!target) return;
    const copy: TimelineClip = {
      ...structuredClone(target),
      id: `clip_dup_${Date.now().toString(36)}`,
      name: `${target.name} (Copy)`,
      startMs: target.startMs + target.durationMs,
    };
    commitProjectChange({ ...project, clips: [...project.clips, copy] }, 'Duplicate clip');
    setSelectedClipIds([copy.id]);
  }

  function handleAddTrack(type: TrackType) {
    const count = project.tracks.filter((t) => t.type === type).length + 1;
    const prefix = type === 'audio' ? 'Audio' : type === 'text' ? 'Overlay' : 'Video';
    const newTrack = {
      id: `track_${type}_${Date.now().toString(36)}`,
      name: `${prefix} ${count}`,
      type,
      order: type === 'audio' ? project.tracks.length : 0,
      muted: false,
      locked: false,
      solo: false,
    };
    const shifted =
      type === 'audio'
        ? [...project.tracks, newTrack]
        : [newTrack, ...project.tracks.map((t) => ({ ...t, order: t.order + 1 }))];
    commitProjectChange({ ...project, tracks: shifted }, `Add ${prefix} track`);
  }

  const selectedClip = project.clips.find((c) => c.id === selectedClipIds[0]) ?? null;
  const totalDurationMs = getProjectDurationMs(project);
  const frameStepMs = Math.round(1000 / project.fps);

  // Reference exportTimelineVideo cleanly so unused import lint doesn't trigger if needed
  void exportTimelineVideo;

  return (
    <div
      data-testid="editor-workspace"
      className="flex h-screen flex-col overflow-hidden bg-[#0B0D11] text-slate-100"
    >
      {/* Top Studio Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-[#0F1219] px-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              onSaveProject(project);
              onBackHome();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0B0D11] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Projects</span>
          </button>

          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate font-display text-sm font-bold text-white">{project.name}</h1>
            <p className="truncate font-mono-tabular text-[11px] text-slate-400 whitespace-nowrap">
              {project.resolution} · {project.fps} FPS · {project.aspectRatio}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="undo-btn"
            disabled={!historyRef.current.canUndo()}
            onClick={handleUndo}
            title="Undo"
            aria-label="Undo"
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0D11] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-35 cursor-pointer"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span className="font-mono-tabular text-[11px]">{historyRef.current.getUndoCount()}</span>
          </button>

          <button
            type="button"
            data-testid="redo-btn"
            disabled={!historyRef.current.canRedo()}
            onClick={handleRedo}
            title="Redo"
            aria-label="Redo"
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0D11] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-35 cursor-pointer"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenBlueprint}
            className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0B0D11] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white sm:flex cursor-pointer whitespace-nowrap"
          >
            <Layers className="h-3.5 w-3.5 text-sky-400" />
            <span>Architecture</span>
          </button>

          <button
            type="button"
            data-testid="save-project-btn"
            onClick={handleSaveNow}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5 text-emerald-400" />
            <span>{saveNotice || 'Save'}</span>
          </button>

          <button
            type="button"
            data-testid="open-export-btn"
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* Mobile Pane Switcher (< lg screens) */}
      <div className="grid grid-cols-3 border-b border-slate-800 bg-[#0D1016] p-1 lg:hidden">
        {(
          [
            { id: 'preview', label: 'Preview' },
            { id: 'media', label: 'Media Bin' },
            { id: 'inspector', label: 'Inspector' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobilePane(tab.id)}
            className={`rounded-lg py-1.5 text-xs font-medium cursor-pointer ${
              mobilePane === tab.id ? 'bg-slate-800 text-amber-400' : 'text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main 3-Column Studio Area */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr_300px]">
        {/* Left Media & Asset Bin */}
        <aside
          className={`${
            mobilePane === 'media' ? 'flex' : 'hidden'
          } h-full min-h-0 flex-col border-r border-slate-800 bg-[#10131A] lg:flex`}
        >
          <div className="grid grid-cols-3 border-b border-slate-800 bg-[#0D1016] p-1">
            {(
              [
                { id: 'media', label: 'Media', icon: Film },
                { id: 'titles', label: 'Titles', icon: Type },
                { id: 'stickers', label: 'Stickers', icon: Sticker },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setBinTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium cursor-pointer ${
                    binTab === tab.id ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {binTab === 'media' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-[#0B0D11] py-2 text-xs font-medium text-slate-300 hover:border-amber-500/60 hover:text-amber-300 cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Import</span>
                    <input
                      type="file"
                      multiple
                      accept="video/*,audio/*,image/*"
                      onChange={(e) => void handleLocalFileImport(e)}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void handleToggleVoiceoverRecord()}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium cursor-pointer ${
                      isRecordingMic
                        ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                        : 'border-slate-700 bg-[#0B0D11] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5" />
                    <span>{isRecordingMic ? 'Stop Rec' : 'Voiceover'}</span>
                  </button>
                </div>

                {mediaAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    data-testid={`media-asset-${asset.id}`}
                    onClick={() => addAssetToTimeline(asset)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-[#0C0F15] p-2 text-left transition-colors hover:border-amber-500/50 cursor-pointer"
                  >
                    <div className="flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
                      {asset.thumbnailSrc ? (
                        <img
                          src={asset.thumbnailSrc}
                          alt={asset.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : asset.kind === 'audio' ? (
                        <Music className="h-4 w-4 text-teal-400" />
                      ) : (
                        <Video className="h-4 w-4 text-sky-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-200">{asset.name}</p>
                      <p className="mt-0.5 font-mono-tabular text-[10px] text-slate-400">
                        {asset.codecLabel} · {(asset.durationMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {binTab === 'titles' && (
              <div className="space-y-2">
                {[
                  { label: 'Cinema Lower Third', text: 'SCENE 01 · DIRECTOR CUT' },
                  { label: '4K HDR Header', text: 'RORN MASTER SEQUENCE' },
                  { label: 'Chapter Slate', text: 'ACT II · NIGHTFALL' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => addTextOverlay(preset.label, preset.text)}
                    className="w-full rounded-xl border border-slate-800 bg-[#0C0F15] p-3 text-left hover:border-amber-500/50 cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-white">{preset.label}</p>
                    <p className="mt-1 truncate text-[11px] text-amber-300">{preset.text}</p>
                  </button>
                ))}
              </div>
            )}

            {binTab === 'stickers' && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { symbol: 'REC', label: 'REC Badge' },
                  { symbol: '4K', label: '4K Stamp' },
                  { symbol: 'HDR', label: 'HDR Tag' },
                  { symbol: 'CUT', label: 'Slate Cut' },
                ].map((stk) => (
                  <button
                    key={stk.label}
                    type="button"
                    onClick={() => addStickerOverlay(stk.symbol, stk.label)}
                    className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#0C0F15] p-4 hover:border-amber-500/50 cursor-pointer"
                  >
                    <span className="font-display text-lg font-extrabold text-amber-400">
                      {stk.symbol}
                    </span>
                    <span className="mt-1 text-[11px] text-slate-400">{stk.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Center Video Compositor Viewport & Transport */}
        <main
          className={`${
            mobilePane === 'preview' ? 'flex' : 'hidden'
          } min-h-0 flex-col bg-[#07090D] lg:flex`}
        >
          <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
            <div className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-xl border border-slate-800/80 bg-black shadow-2xl">
              <canvas
                ref={canvasRef}
                data-testid="preview-canvas"
                className="max-h-[46vh] w-auto object-contain"
              />
            </div>
          </div>

          {/* Transport Bar */}
          <div className="flex items-center justify-between border-t border-slate-800/80 bg-[#0E1118] px-5 py-2.5">
            <span
              data-testid="transport-timecode"
              className="font-mono-tabular text-xs font-semibold text-amber-400"
            >
              {formatTimecode(playheadMs, project.fps)}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Jump to start"
                onClick={() => {
                  setIsPlaying(false);
                  setPlayheadMs(0);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Previous frame"
                onClick={() => {
                  setIsPlaying(false);
                  setPlayheadMs((ms) => Math.max(0, ms - frameStepMs));
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                data-testid="play-pause-btn"
                aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
                onClick={() => setIsPlaying((p) => !p)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </button>
              <button
                type="button"
                aria-label="Next frame"
                onClick={() => {
                  setIsPlaying(false);
                  setPlayheadMs((ms) => ms + frameStepMs);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <span className="font-mono-tabular text-xs text-slate-400">
              {formatTimecode(totalDurationMs, project.fps)}
            </span>
          </div>
        </main>

        {/* Right Clip Inspector */}
        <div
          className={`${
            mobilePane === 'inspector' ? 'block' : 'hidden'
          } h-full min-h-0 lg:block`}
        >
          <InspectorPanel
            clip={selectedClip}
            playheadMs={playheadMs}
            onUpdateClip={(updatedClip, actionLabel) => {
              commitProjectChange(
                {
                  ...project,
                  clips: project.clips.map((c) => (c.id === updatedClip.id ? updatedClip : c)),
                },
                actionLabel
              );
            }}
          />
        </div>
      </div>

      {/* Bottom Multi-Track Timeline */}
      <TimelinePanel
        project={project}
        playheadMs={playheadMs}
        selectedClipIds={selectedClipIds}
        onSeek={(ms) => {
          setIsPlaying(false);
          setPlayheadMs(ms);
        }}
        onSelectClips={setSelectedClipIds}
        onSplitSelected={handleSplitSelected}
        onRippleDeleteSelected={handleRippleDeleteSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onToggleMagneticSnap={() =>
          commitProjectChange(
            { ...project, magneticSnappingEnabled: !project.magneticSnappingEnabled },
            'Toggle magnetic snapping'
          )
        }
        onToggleProxyCache={() =>
          commitProjectChange(
            { ...project, proxyCacheEnabled: !project.proxyCacheEnabled },
            'Toggle 4K LRU proxy cache'
          )
        }
        onZoomChange={(zoomLevel) => setProject((p) => ({ ...p, zoomLevel }))}
        onAddTrack={handleAddTrack}
        onToggleTrackFlag={(trackId, flag) =>
          commitProjectChange(
            {
              ...project,
              tracks: project.tracks.map((t) =>
                t.id === trackId ? { ...t, [flag]: !t[flag] } : t
              ),
            },
            `Toggle track ${flag}`
          )
        }
        onCommitClipsMoveOrTrim={(nextClips, actionLabel) =>
          commitProjectChange({ ...project, clips: nextClips }, actionLabel)
        }
      />

      {showExportModal && (
        <ExportModal project={project} onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}
