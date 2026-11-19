import { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Diamond,
  Lock,
  Magnet,
  Plus,
  Scissors,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { RornProject, TimelineClip, TrackType } from '../domain/models';
import { computeMagneticSnap, formatTimecode, getProjectDurationMs } from '../domain/timelineEngine';

interface TimelinePanelProps {
  project: RornProject;
  playheadMs: number;
  selectedClipIds: string[];
  onSeek: (ms: number) => void;
  onSelectClips: (ids: string[]) => void;
  onSplitSelected: () => void;
  onRippleDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onToggleMagneticSnap: () => void;
  onToggleProxyCache: () => void;
  onZoomChange: (zoomLevel: number) => void;
  onAddTrack: (type: TrackType) => void;
  onToggleTrackFlag: (trackId: string, flag: 'muted' | 'locked' | 'solo') => void;
  onCommitClipsMoveOrTrim: (nextClips: TimelineClip[], actionLabel: string) => void;
}

type DragMode =
  | {
      type: 'move';
      clipId: string;
      originClientX: number;
      originStartMs: number;
      originTrackId: string;
    }
  | {
      type: 'trim-left';
      clipId: string;
      originClientX: number;
      originStartMs: number;
      originDurationMs: number;
      originSourceInMs: number;
    }
  | {
      type: 'trim-right';
      clipId: string;
      originClientX: number;
      originDurationMs: number;
    };

export function TimelinePanel({
  project,
  playheadMs,
  selectedClipIds,
  onSeek,
  onSelectClips,
  onSplitSelected,
  onRippleDeleteSelected,
  onDuplicateSelected,
  onToggleMagneticSnap,
  onToggleProxyCache,
  onZoomChange,
  onAddTrack,
  onToggleTrackFlag,
  onCommitClipsMoveOrTrim,
}: TimelinePanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragMode | null>(null);
  const [previewClips, setPreviewClips] = useState<TimelineClip[] | null>(null);
  const [snapGuideMs, setSnapGuideMs] = useState<number | null>(null);
  const [showAddTrackMenu, setShowAddTrackMenu] = useState(false);

  const activeClips = previewClips ?? project.clips;
  const pxPerSec = project.zoomLevel;
  const pxPerMs = pxPerSec / 1000;
  const totalDurationMs = Math.max(15000, getProjectDurationMs({ clips: activeClips }) + 5000);
  const timelineWidthPx = Math.max(900, Math.ceil(totalDurationMs * pxPerMs));

  const sortedTracks = [...project.tracks].sort((a, b) => a.order - b.order);
  const primarySelectedId = selectedClipIds[0] ?? null;

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragState.originClientX;
      const dMs = dx / pxPerMs;

      if (dragState.type === 'move') {
        const targetClip = project.clips.find((c) => c.id === dragState.clipId);
        if (!targetClip) return;

        const rawStart = Math.max(0, dragState.originStartMs + dMs);
        const { snappedStartMs, snapGuideMs: guide } = computeMagneticSnap(
          rawStart,
          targetClip.durationMs,
          targetClip.id,
          project.clips,
          playheadMs,
          project.magneticSnappingEnabled
        );

        setSnapGuideMs(guide);
        setPreviewClips(
          project.clips.map((c) =>
            c.id === dragState.clipId ? { ...c, startMs: snappedStartMs } : c
          )
        );
      } else if (dragState.type === 'trim-left') {
        const maxTrim = dragState.originDurationMs - 300;
        const clampedDelta = Math.min(maxTrim, Math.max(-dragState.originStartMs, dMs));
        const nextStart = Math.max(0, Math.round(dragState.originStartMs + clampedDelta));
        const nextDur = Math.max(300, Math.round(dragState.originDurationMs - (nextStart - dragState.originStartMs)));
        const nextSourceIn = Math.max(0, Math.round(dragState.originSourceInMs + (nextStart - dragState.originStartMs)));

        setPreviewClips(
          project.clips.map((c) =>
            c.id === dragState.clipId
              ? { ...c, startMs: nextStart, durationMs: nextDur, sourceInMs: nextSourceIn }
              : c
          )
        );
      } else if (dragState.type === 'trim-right') {
        const nextDur = Math.max(300, Math.round(dragState.originDurationMs + dMs));
        setPreviewClips(
          project.clips.map((c) =>
            c.id === dragState.clipId ? { ...c, durationMs: nextDur } : c
          )
        );
      }
    };

    const handlePointerUp = () => {
      if (previewClips) {
        onCommitClipsMoveOrTrim(
          previewClips,
          dragState.type === 'move' ? 'Move timeline clip' : 'Trim timeline clip'
        );
      }
      setDragState(null);
      setPreviewClips(null);
      setSnapGuideMs(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, previewClips, project.clips, project.magneticSnappingEnabled, playheadMs, pxPerMs, onCommitClipsMoveOrTrim]);

  function handleRulerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    onSeek(Math.round(x / pxPerMs));
  }

  function handleClipClick(e: React.MouseEvent, clipId: string) {
    e.stopPropagation();
    if (e.shiftKey) {
      if (selectedClipIds.includes(clipId)) {
        onSelectClips(selectedClipIds.filter((id) => id !== clipId));
      } else {
        onSelectClips([...selectedClipIds, clipId]);
      }
    } else {
      onSelectClips([clipId]);
    }
  }

  const secondsMarkers: number[] = [];
  const stepSec = pxPerSec < 45 ? 2 : 1;
  for (let s = 0; s <= Math.ceil(totalDurationMs / 1000); s += stepSec) {
    secondsMarkers.push(s);
  }

  return (
    <section
      data-testid="timeline-panel"
      aria-label="Multi-track timeline"
      className="flex h-72 flex-col border-t border-slate-800 bg-[#0D1016] select-none"
    >
      {/* Timeline Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#11151E] px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="timeline-split-btn"
            disabled={!primarySelectedId}
            onClick={onSplitSelected}
            title="Frame-accurate Split at playhead"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0B0D11] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-amber-500/60 hover:text-white disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Scissors className="h-3.5 w-3.5 text-amber-400" />
            <span>Split</span>
          </button>

          <button
            type="button"
            data-testid="timeline-ripple-delete-btn"
            disabled={selectedClipIds.length === 0}
            onClick={onRippleDeleteSelected}
            title="Ripple Delete selected clip and close gap"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0B0D11] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-rose-500/60 hover:text-rose-300 disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
            <span>Ripple Delete</span>
          </button>

          <button
            type="button"
            disabled={!primarySelectedId}
            onClick={onDuplicateSelected}
            title="Duplicate selected clip"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0B0D11] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600 disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Copy className="h-3.5 w-3.5 text-slate-400" />
            <span>Duplicate</span>
          </button>

          <div className="mx-1 h-4 w-px bg-slate-800" aria-hidden="true" />

          <button
            type="button"
            onClick={onToggleMagneticSnap}
            aria-pressed={project.magneticSnappingEnabled}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              project.magneticSnappingEnabled
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                : 'border-slate-700/80 bg-[#0B0D11] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Magnet className="h-3.5 w-3.5" />
            <span>Snap 150ms</span>
          </button>

          <button
            type="button"
            onClick={onToggleProxyCache}
            aria-pressed={project.proxyCacheEnabled}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              project.proxyCacheEnabled
                ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                : 'border-slate-700/80 bg-[#0B0D11] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>4K Proxy LRU</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddTrackMenu((v) => !v)}
              className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-[#0B0D11] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600 cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              <span>Add Track</span>
            </button>

            {showAddTrackMenu && (
              <div className="absolute bottom-full left-0 z-30 mb-1.5 w-40 rounded-xl border border-slate-700 bg-[#141820] p-1.5 shadow-xl">
                {(
                  [
                    { type: 'video', label: 'Video / Overlay' },
                    { type: 'audio', label: 'Audio Track' },
                    { type: 'text', label: 'Text / Sticker' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      onAddTrack(item.type);
                      setShowAddTrackMenu(false);
                    }}
                    className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Zoom & Selection Readout */}
        <div className="flex items-center gap-3">
          {selectedClipIds.length > 1 && (
            <span className="font-mono-tabular text-xs text-amber-300">
              {selectedClipIds.length} selected
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Zoom out timeline"
              onClick={() => onZoomChange(Math.max(28, project.zoomLevel - 16))}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <input
              type="range"
              aria-label="Timeline zoom scale"
              min={28}
              max={160}
              value={project.zoomLevel}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-24 accent-amber-500"
            />
            <button
              type="button"
              aria-label="Zoom in timeline"
              onClick={() => onZoomChange(Math.min(160, project.zoomLevel + 16))}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Track Scrollable Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Track Headers Column */}
        <div className="w-44 shrink-0 border-r border-slate-800 bg-[#0E1118]">
          <div className="flex h-7 items-center border-b border-slate-800 px-3 font-mono-tabular text-[11px] text-slate-400">
            {formatTimecode(playheadMs, project.fps)}
          </div>
          <div className="divide-y divide-slate-800/70">
            {sortedTracks.map((track) => (
              <div
                key={track.id}
                className="flex h-11 items-center justify-between px-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-200">{track.name}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleTrackFlag(track.id, 'muted')}
                    aria-label={`${track.muted ? 'Unmute' : 'Mute'} ${track.name}`}
                    className={`rounded p-1 cursor-pointer ${
                      track.muted ? 'text-rose-400 bg-rose-500/10' : 'text-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleTrackFlag(track.id, 'locked')}
                    aria-label={`${track.locked ? 'Unlock' : 'Lock'} ${track.name}`}
                    className={`rounded p-1 cursor-pointer ${
                      track.locked ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {track.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Scrollable Lanes + Ruler */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 overflow-x-auto overflow-y-auto bg-[#090B10]"
          onClick={() => onSelectClips([])}
        >
          <div style={{ width: `${timelineWidthPx}px` }} className="relative min-h-full">
            {/* Time Ruler */}
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={handleRulerPointerDown}
              className="sticky top-0 z-20 h-7 cursor-pointer border-b border-slate-800 bg-[#10131A]"
            >
              {secondsMarkers.map((sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * pxPerSec}px` }}
                  className="absolute top-0 flex h-full flex-col justify-between border-l border-slate-700/70 pl-1"
                >
                  <span className="font-mono-tabular text-[10px] text-slate-400">
                    {sec}s
                  </span>
                </div>
              ))}
            </div>

            {/* Track Rows */}
            <div className="relative divide-y divide-slate-800/60">
              {sortedTracks.map((track) => {
                const trackClips = activeClips.filter((c) => c.trackId === track.id);
                return (
                  <div key={track.id} className="relative h-11 bg-[#0B0E14]">
                    {trackClips.map((clip) => {
                      const leftPx = clip.startMs * pxPerMs;
                      const widthPx = Math.max(22, clip.durationMs * pxPerMs);
                      const isSelected = selectedClipIds.includes(clip.id);

                      return (
                        <div
                          key={clip.id}
                          data-testid={`timeline-clip-${clip.id}`}
                          onClick={(e) => handleClipClick(e, clip.id)}
                          onPointerDown={(e) => {
                            if (track.locked) return;
                            e.stopPropagation();
                            onSelectClips(
                              e.shiftKey
                                ? selectedClipIds.includes(clip.id)
                                  ? selectedClipIds
                                  : [...selectedClipIds, clip.id]
                                : [clip.id]
                            );
                            setDragState({
                              type: 'move',
                              clipId: clip.id,
                              originClientX: e.clientX,
                              originStartMs: clip.startMs,
                              originTrackId: clip.trackId,
                            });
                          }}
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                            borderColor: isSelected ? '#F59E0B' : `${clip.colorTag}66`,
                            backgroundColor: isSelected ? `${clip.colorTag}30` : `${clip.colorTag}1C`,
                          }}
                          className={`group absolute top-1 bottom-1 flex items-center overflow-hidden rounded-lg border px-2 text-xs transition-colors ${
                            track.locked ? 'cursor-not-allowed opacity-60' : 'cursor-grab active:cursor-grabbing'
                          }`}
                        >
                          {/* Left Trim Handle */}
                          {!track.locked && (
                            <div
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setDragState({
                                  type: 'trim-left',
                                  clipId: clip.id,
                                  originClientX: e.clientX,
                                  originStartMs: clip.startMs,
                                  originDurationMs: clip.durationMs,
                                  originSourceInMs: clip.sourceInMs,
                                });
                              }}
                              className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-amber-400"
                            />
                          )}

                          {/* Audio Waveform Bars */}
                          {clip.kind === 'audio' && clip.audio.waveformPeaks.length > 0 && (
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-1 inset-y-1.5 flex items-end gap-[2px] opacity-45"
                            >
                              {clip.audio.waveformPeaks.slice(0, 36).map((peak, i) => (
                                <span
                                  key={i}
                                  style={{ height: `${Math.round(peak * 100)}%` }}
                                  className="flex-1 rounded-t-xs bg-teal-300"
                                />
                              ))}
                            </div>
                          )}

                          <span className="relative z-10 truncate font-medium text-slate-100">
                            {clip.name}
                          </span>

                          {/* Keyframe Diamonds */}
                          {clip.keyframes.map((kf) => (
                            <Diamond
                              key={kf.id}
                              style={{
                                left: `${Math.min(widthPx - 10, Math.max(4, kf.timeOffsetMs * pxPerMs))}px`,
                              }}
                              className="pointer-events-none absolute bottom-1 z-10 h-2.5 w-2.5 fill-amber-400 text-amber-300"
                            />
                          ))}

                          {/* Right Trim Handle */}
                          {!track.locked && (
                            <div
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setDragState({
                                  type: 'trim-right',
                                  clipId: clip.id,
                                  originClientX: e.clientX,
                                  originDurationMs: clip.durationMs,
                                });
                              }}
                              className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-amber-400"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* 150ms Magnetic Snap Guide Line */}
            {snapGuideMs !== null && (
              <div
                style={{ left: `${snapGuideMs * pxPerMs}px` }}
                className="pointer-events-none absolute inset-y-0 z-30 w-px bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]"
              />
            )}

            {/* Playhead Needle */}
            <div
              style={{ left: `${playheadMs * pxPerMs}px` }}
              className="pointer-events-none absolute inset-y-0 z-30 w-[2px] bg-amber-400"
            >
              <div className="-ml-[5px] h-3 w-3 rotate-45 bg-amber-400" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
