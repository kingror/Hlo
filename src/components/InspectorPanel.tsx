import { useState } from 'react';
import {
  Diamond,
  Palette,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  Wand2,
} from 'lucide-react';
import {
  EasingType,
  Keyframe,
  LUT_PRESETS,
  ShaderEffectType,
  TimelineClip,
} from '../domain/models';
import { interpolateKeyframes, parseCubeLut } from '../domain/timelineEngine';

interface InspectorPanelProps {
  clip: TimelineClip | null;
  playheadMs: number;
  onUpdateClip: (updated: TimelineClip, actionLabel: string) => void;
}

type InspectorTab = 'transform' | 'chroma' | 'color' | 'audio';

export function InspectorPanel({ clip, playheadMs, onUpdateClip }: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('transform');

  if (!clip) {
    return (
      <aside className="flex h-full flex-col items-center justify-center border-l border-slate-800 bg-[#10131A] p-6 text-center">
        <Sliders className="h-8 w-8 text-slate-600" />
        <h3 className="mt-3 font-display text-sm font-semibold text-slate-200">Clip Inspector</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Select any clip on the timeline to edit Bezier keyframes, Chroma Key, 3D LUTs, shaders, or
          audio sidechain ducking.
        </p>
      </aside>
    );
  }

  const localMs = Math.max(0, Math.min(clip.durationMs, Math.round(playheadMs - clip.startMs)));
  const currentTransform = interpolateKeyframes(clip.keyframes, localMs);

  function addOrUpdateKeyframeAtPlayhead(patch: Partial<Keyframe>) {
    if (!clip) return;
    const existingIdx = clip.keyframes.findIndex((k) => Math.abs(k.timeOffsetMs - localMs) <= 80);
    let nextKeyframes: Keyframe[];

    if (existingIdx >= 0) {
      nextKeyframes = clip.keyframes.map((k, idx) =>
        idx === existingIdx ? { ...k, ...patch } : k
      );
    } else {
      const newKf: Keyframe = {
        id: `kf_${Date.now().toString(36)}`,
        timeOffsetMs: localMs,
        x: patch.x ?? Number(currentTransform.x.toFixed(1)),
        y: patch.y ?? Number(currentTransform.y.toFixed(1)),
        scale: patch.scale ?? Number(currentTransform.scale.toFixed(2)),
        rotation: patch.rotation ?? Number(currentTransform.rotation.toFixed(1)),
        opacity: patch.opacity ?? Number(currentTransform.opacity.toFixed(2)),
        easing: patch.easing ?? 'ease-in-out',
        bezier: patch.bezier ?? { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
      };
      nextKeyframes = [...clip.keyframes, newKf].sort((a, b) => a.timeOffsetMs - b.timeOffsetMs);
    }

    onUpdateClip({ ...clip, keyframes: nextKeyframes }, 'Edit Bezier keyframe');
  }

  function removeKeyframe(kfId: string) {
    if (!clip) return;
    onUpdateClip(
      { ...clip, keyframes: clip.keyframes.filter((k) => k.id !== kfId) },
      'Remove keyframe'
    );
  }

  async function handleCubeFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !clip) return;
    const text = await file.text();
    const parsed = parseCubeLut(text);
    onUpdateClip(
      {
        ...clip,
        colorGrading: {
          ...clip.colorGrading,
          lutPresetId: null,
          customLutName: parsed.title || file.name,
          customLutMatrix: parsed.rgbShift,
        },
      },
      `Apply .CUBE LUT (${file.name})`
    );
  }

  return (
    <aside
      data-testid="inspector-panel"
      className="flex h-full flex-col border-l border-slate-800 bg-[#10131A]"
    >
      {/* Selected Clip Header */}
      <div className="border-b border-slate-800 px-4 py-3">
        <p className="truncate font-display text-sm font-semibold text-white">{clip.name}</p>
        <p className="mt-0.5 font-mono-tabular text-xs text-slate-400">
          {clip.kind.toUpperCase()} · {(clip.durationMs / 1000).toFixed(2)}s
        </p>
      </div>

      {/* Inspector Tabs */}
      <div className="grid grid-cols-4 border-b border-slate-800 bg-[#0D1016] p-1">
        {(
          [
            { id: 'transform', label: 'Motion', icon: Diamond },
            { id: 'chroma', label: 'Keyer', icon: Wand2 },
            { id: 'color', label: 'Color', icon: Palette },
            { id: 'audio', label: 'Audio', icon: Volume2 },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium transition-colors cursor-pointer ${
                active ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'transform' && (
          <>
            {clip.kind === 'text' && clip.textOverlay && (
              <div className="space-y-2 border-b border-slate-800 pb-4">
                <label htmlFor="inspector-text-content" className="block text-xs font-medium text-slate-300">
                  Title Text
                </label>
                <input
                  id="inspector-text-content"
                  type="text"
                  value={clip.textOverlay.text}
                  onChange={(e) =>
                    onUpdateClip(
                      {
                        ...clip,
                        textOverlay: { ...clip.textOverlay!, text: e.target.value },
                      },
                      'Edit title overlay text'
                    )
                  }
                  className="w-full rounded-lg border border-slate-700 bg-[#0B0D11] px-3 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Bezier Keyframes ({clip.keyframes.length})
              </span>
              <button
                type="button"
                onClick={() => addOrUpdateKeyframeAtPlayhead({})}
                className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 cursor-pointer"
              >
                <Diamond className="h-3 w-3" />
                <span>Add @ {(localMs / 1000).toFixed(1)}s</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-400">
                  <label htmlFor="kf-x">Position X</label>
                  <span className="font-mono-tabular text-slate-200">{currentTransform.x.toFixed(0)}%</span>
                </div>
                <input
                  id="kf-x"
                  type="range"
                  min={-60}
                  max={60}
                  step={1}
                  value={currentTransform.x}
                  onChange={(e) => addOrUpdateKeyframeAtPlayhead({ x: Number(e.target.value) })}
                  className="mt-1 w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400">
                  <label htmlFor="kf-y">Position Y</label>
                  <span className="font-mono-tabular text-slate-200">{currentTransform.y.toFixed(0)}%</span>
                </div>
                <input
                  id="kf-y"
                  type="range"
                  min={-60}
                  max={60}
                  step={1}
                  value={currentTransform.y}
                  onChange={(e) => addOrUpdateKeyframeAtPlayhead({ y: Number(e.target.value) })}
                  className="mt-1 w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400">
                  <label htmlFor="kf-scale">Scale</label>
                  <span className="font-mono-tabular text-slate-200">{currentTransform.scale.toFixed(2)}x</span>
                </div>
                <input
                  id="kf-scale"
                  type="range"
                  min={0.25}
                  max={2.5}
                  step={0.05}
                  value={currentTransform.scale}
                  onChange={(e) => addOrUpdateKeyframeAtPlayhead({ scale: Number(e.target.value) })}
                  className="mt-1 w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400">
                  <label htmlFor="kf-rot">Rotation</label>
                  <span className="font-mono-tabular text-slate-200">{currentTransform.rotation.toFixed(0)}°</span>
                </div>
                <input
                  id="kf-rot"
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={currentTransform.rotation}
                  onChange={(e) => addOrUpdateKeyframeAtPlayhead({ rotation: Number(e.target.value) })}
                  className="mt-1 w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400">
                  <label htmlFor="kf-opacity">Opacity</label>
                  <span className="font-mono-tabular text-slate-200">
                    {Math.round(currentTransform.opacity * 100)}%
                  </span>
                </div>
                <input
                  id="kf-opacity"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={currentTransform.opacity}
                  onChange={(e) => addOrUpdateKeyframeAtPlayhead({ opacity: Number(e.target.value) })}
                  className="mt-1 w-full accent-amber-500"
                />
              </div>
            </div>

            {clip.keyframes.length > 0 && (
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <p className="text-xs font-medium text-slate-400">Keyframe Timeline</p>
                {clip.keyframes.map((kf) => (
                  <div
                    key={kf.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#0B0D11] px-2.5 py-2 text-xs"
                  >
                    <span className="font-mono-tabular text-amber-400">
                      {(kf.timeOffsetMs / 1000).toFixed(2)}s
                    </span>
                    <select
                      aria-label={`Easing at ${(kf.timeOffsetMs / 1000).toFixed(2)}s`}
                      value={kf.easing}
                      onChange={(e) => {
                        const easing = e.target.value as EasingType;
                        onUpdateClip(
                          {
                            ...clip,
                            keyframes: clip.keyframes.map((item) =>
                              item.id === kf.id ? { ...item, easing } : item
                            ),
                          },
                          'Change keyframe Bezier easing'
                        );
                      }}
                      className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-200"
                    >
                      <option value="linear">Linear</option>
                      <option value="ease-in">Ease In</option>
                      <option value="ease-out">Ease Out</option>
                      <option value="ease-in-out">Bezier Ease-In-Out</option>
                      <option value="custom">Custom Cubic</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeKeyframe(kf.id)}
                      aria-label={`Delete keyframe at ${(kf.timeOffsetMs / 1000).toFixed(2)}s`}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'chroma' && (
          <div className="space-y-4">
            <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0B0D11] p-3 cursor-pointer">
              <span className="text-xs font-semibold text-white">Enable Chroma Key (Green Screen)</span>
              <input
                type="checkbox"
                checked={clip.chromaKey.enabled}
                onChange={(e) =>
                  onUpdateClip(
                    {
                      ...clip,
                      chromaKey: { ...clip.chromaKey, enabled: e.target.checked },
                    },
                    'Toggle Chroma Key'
                  )
                }
                className="h-4 w-4 accent-emerald-500"
              />
            </label>

            <div>
              <label htmlFor="chroma-color" className="block text-xs font-medium text-slate-300">
                Key Color
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="chroma-color"
                  type="color"
                  value={clip.chromaKey.keyColor}
                  onChange={(e) =>
                    onUpdateClip(
                      { ...clip, chromaKey: { ...clip.chromaKey, keyColor: e.target.value } },
                      'Update Chroma Key color'
                    )
                  }
                  className="h-9 w-12 cursor-pointer rounded border border-slate-700 bg-transparent"
                />
                <span className="font-mono-tabular text-xs text-slate-300">
                  {clip.chromaKey.keyColor.toUpperCase()}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400">
                <label htmlFor="chroma-tol">Tolerance</label>
                <span className="font-mono-tabular text-slate-200">{clip.chromaKey.tolerance}%</span>
              </div>
              <input
                id="chroma-tol"
                type="range"
                min={5}
                max={95}
                value={clip.chromaKey.tolerance}
                onChange={(e) =>
                  onUpdateClip(
                    { ...clip, chromaKey: { ...clip.chromaKey, tolerance: Number(e.target.value) } },
                    'Adjust Chroma Key tolerance'
                  )
                }
                className="mt-1 w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400">
                <label htmlFor="chroma-spill">Spill Suppression</label>
                <span className="font-mono-tabular text-slate-200">
                  {clip.chromaKey.spillSuppression}%
                </span>
              </div>
              <input
                id="chroma-spill"
                type="range"
                min={0}
                max={100}
                value={clip.chromaKey.spillSuppression}
                onChange={(e) =>
                  onUpdateClip(
                    {
                      ...clip,
                      chromaKey: { ...clip.chromaKey, spillSuppression: Number(e.target.value) },
                    },
                    'Adjust green spill suppression'
                  )
                }
                className="mt-1 w-full accent-emerald-500"
              />
            </div>
          </div>
        )}

        {activeTab === 'color' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="lut-select" className="block text-xs font-medium text-slate-300">
                3D LUT Preset (.CUBE)
              </label>
              <select
                id="lut-select"
                value={clip.colorGrading.lutPresetId ?? ''}
                onChange={(e) =>
                  onUpdateClip(
                    {
                      ...clip,
                      colorGrading: {
                        ...clip.colorGrading,
                        lutPresetId: e.target.value || null,
                        customLutName: undefined,
                        customLutMatrix: undefined,
                      },
                    },
                    'Apply color grading LUT'
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B0D11] px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">None (Rec.709 Neutral)</option>
                {LUT_PRESETS.map((lut) => (
                  <option key={lut.id} value={lut.id}>
                    {lut.name}
                  </option>
                ))}
              </select>

              <label className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-[#0B0D11] py-2 text-xs font-medium text-slate-300 hover:border-amber-500/60 hover:text-amber-300 cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>
                  {clip.colorGrading.customLutName
                    ? `Loaded: ${clip.colorGrading.customLutName}`
                    : 'Import .CUBE LUT File'}
                </span>
                <input
                  type="file"
                  accept=".cube,.txt"
                  onChange={(e) => void handleCubeFileUpload(e)}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400">
                <label htmlFor="grade-brightness">Exposure / Brightness</label>
                <span className="font-mono-tabular text-slate-200">{clip.colorGrading.brightness}</span>
              </div>
              <input
                id="grade-brightness"
                type="range"
                min={-60}
                max={60}
                value={clip.colorGrading.brightness}
                onChange={(e) =>
                  onUpdateClip(
                    {
                      ...clip,
                      colorGrading: { ...clip.colorGrading, brightness: Number(e.target.value) },
                    },
                    'Adjust brightness'
                  )
                }
                className="mt-1 w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400">
                <label htmlFor="grade-contrast">Contrast</label>
                <span className="font-mono-tabular text-slate-200">{clip.colorGrading.contrast}</span>
              </div>
              <input
                id="grade-contrast"
                type="range"
                min={-50}
                max={70}
                value={clip.colorGrading.contrast}
                onChange={(e) =>
                  onUpdateClip(
                    {
                      ...clip,
                      colorGrading: { ...clip.colorGrading, contrast: Number(e.target.value) },
                    },
                    'Adjust contrast'
                  )
                }
                className="mt-1 w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400">
                <label htmlFor="grade-sat">Saturation</label>
                <span className="font-mono-tabular text-slate-200">{clip.colorGrading.saturation}</span>
              </div>
              <input
                id="grade-sat"
                type="range"
                min={-100}
                max={100}
                value={clip.colorGrading.saturation}
                onChange={(e) =>
                  onUpdateClip(
                    {
                      ...clip,
                      colorGrading: { ...clip.colorGrading, saturation: Number(e.target.value) },
                    },
                    'Adjust saturation'
                  )
                }
                className="mt-1 w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400">
                <label htmlFor="grade-temp">Color Temperature</label>
                <span className="font-mono-tabular text-slate-200">
                  {clip.colorGrading.temperature > 0
                    ? `+${clip.colorGrading.temperature} Warm`
                    : `${clip.colorGrading.temperature} Cool`}
                </span>
              </div>
              <input
                id="grade-temp"
                type="range"
                min={-100}
                max={100}
                value={clip.colorGrading.temperature}
                onChange={(e) =>
                  onUpdateClip(
                    {
                      ...clip,
                      colorGrading: { ...clip.colorGrading, temperature: Number(e.target.value) },
                    },
                    'Adjust color temperature'
                  )
                }
                className="mt-1 w-full accent-amber-500"
              />
            </div>

            <div className="border-t border-slate-800 pt-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                <label htmlFor="shader-effect">GLSL Shader Effect</label>
              </div>
              <select
                id="shader-effect"
                value={clip.shader.type}
                onChange={(e) =>
                  onUpdateClip(
                    {
                      ...clip,
                      shader: {
                        type: e.target.value as ShaderEffectType,
                        intensity: clip.shader.intensity || 40,
                      },
                    },
                    'Apply GLSL shader effect'
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B0D11] px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="none">None</option>
                <option value="vignette">Optical Vignette</option>
                <option value="chromatic">Chromatic Aberration</option>
                <option value="grain">35mm Film Grain</option>
                <option value="cinematic-glow">Anamorphic Halation Glow</option>
              </select>

              {clip.shader.type !== 'none' && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <label htmlFor="shader-intensity">Shader Intensity</label>
                    <span className="font-mono-tabular text-slate-200">{clip.shader.intensity}%</span>
                  </div>
                  <input
                    id="shader-intensity"
                    type="range"
                    min={0}
                    max={100}
                    value={clip.shader.intensity}
                    onChange={(e) =>
                      onUpdateClip(
                        {
                          ...clip,
                          shader: { ...clip.shader, intensity: Number(e.target.value) },
                        },
                        'Adjust shader intensity'
                      )
                    }
                    className="mt-1 w-full accent-sky-400"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-4">
            <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0B0D11] p-3 cursor-pointer">
              <span className="text-xs font-semibold text-white">Mute Clip Audio</span>
              <input
                type="checkbox"
                checked={clip.audio.muted}
                onChange={(e) =>
                  onUpdateClip(
                    { ...clip, audio: { ...clip.audio, muted: e.target.checked } },
                    'Toggle clip audio mute'
                  )
                }
                className="h-4 w-4 accent-rose-500"
              />
            </label>

            <div>
              <div className="flex justify-between text-xs text-slate-400">
                <label htmlFor="audio-gain">Track Gain</label>
                <span className="font-mono-tabular text-slate-200">
                  {Math.round(clip.audio.gain * 100)}%
                </span>
              </div>
              <input
                id="audio-gain"
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={clip.audio.gain}
                onChange={(e) =>
                  onUpdateClip(
                    { ...clip, audio: { ...clip.audio, gain: Number(e.target.value) } },
                    'Adjust audio gain'
                  )
                }
                className="mt-1 w-full accent-sky-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="audio-fadein" className="block text-xs text-slate-400">
                  Fade In ({clip.audio.fadeInMs}ms)
                </label>
                <input
                  id="audio-fadein"
                  type="range"
                  min={0}
                  max={2500}
                  step={50}
                  value={clip.audio.fadeInMs}
                  onChange={(e) =>
                    onUpdateClip(
                      { ...clip, audio: { ...clip.audio, fadeInMs: Number(e.target.value) } },
                      'Adjust audio fade-in'
                    )
                  }
                  className="mt-1 w-full accent-sky-400"
                />
              </div>
              <div>
                <label htmlFor="audio-fadeout" className="block text-xs text-slate-400">
                  Fade Out ({clip.audio.fadeOutMs}ms)
                </label>
                <input
                  id="audio-fadeout"
                  type="range"
                  min={0}
                  max={2500}
                  step={50}
                  value={clip.audio.fadeOutMs}
                  onChange={(e) =>
                    onUpdateClip(
                      { ...clip, audio: { ...clip.audio, fadeOutMs: Number(e.target.value) } },
                      'Adjust audio fade-out'
                    )
                  }
                  className="mt-1 w-full accent-sky-400"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0B0D11] p-3.5 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="block text-xs font-semibold text-white">
                    Sidechain Ducking
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Auto-lower BGM when voiceover/primary clips speak
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={clip.audio.sidechainDucking}
                  onChange={(e) =>
                    onUpdateClip(
                      { ...clip, audio: { ...clip.audio, sidechainDucking: e.target.checked } },
                      'Toggle audio sidechain ducking'
                    )
                  }
                  className="h-4 w-4 accent-teal-400"
                />
              </label>

              {clip.audio.sidechainDucking && (
                <div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <label htmlFor="ducking-depth">Ducking Attenuation</label>
                    <span className="font-mono-tabular text-teal-300">
                      -{Math.round(clip.audio.duckingDepth * 100)}%
                    </span>
                  </div>
                  <input
                    id="ducking-depth"
                    type="range"
                    min={0.1}
                    max={0.9}
                    step={0.05}
                    value={clip.audio.duckingDepth}
                    onChange={(e) =>
                      onUpdateClip(
                        { ...clip, audio: { ...clip.audio, duckingDepth: Number(e.target.value) } },
                        'Adjust sidechain ducking depth'
                      )
                    }
                    className="mt-1 w-full accent-teal-400"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
