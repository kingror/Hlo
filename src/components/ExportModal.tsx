import { useState } from 'react';
import { CheckCircle2, Cpu, Download, Loader2, X } from 'lucide-react';
import {
  ExportConfig,
  FrameRate,
  ResolutionPreset,
  RornProject,
  UNIVERSAL_CODEC_MATRIX,
} from '../domain/models';
import { exportTimelineVideo } from '../core/media/compositor';

interface ExportModalProps {
  project: RornProject;
  onClose: () => void;
}

export function ExportModal({ project, onClose }: ExportModalProps) {
  const [config, setConfig] = useState<ExportConfig>({
    container: 'MP4',
    videoCodec: 'H.265 (HEVC)',
    audioCodec: 'AAC',
    resolution: project.resolution,
    fps: project.fps,
    bitrateMbps: project.resolution === '4K UHD' ? 35 : 16,
    hardwareAccelerated: true,
    softwareFallbackEngine: 'FFmpeg',
  });

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const [downloadResult, setDownloadResult] = useState<{
    url: string;
    filename: string;
    sizeKb: number;
  } | null>(null);
  const [errorText, setErrorText] = useState('');

  async function handleStartExport() {
    setExporting(true);
    setErrorText('');
    setDownloadResult(null);
    setProgress(2);
    setStageText('Initializing Media3 Transformer graph...');

    try {
      const result = await exportTimelineVideo(project, config, (pct, stage) => {
        setProgress(pct);
        setStageText(stage);
      });
      const url = URL.createObjectURL(result.blob);
      setDownloadResult({
        url,
        filename: result.filename,
        sizeKb: Math.max(1, Math.round(result.blob.size / 1024)),
      });
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Export pipeline encountered an error.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      data-testid="export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700/80 bg-[#12161F] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 id="export-modal-title" className="font-display text-lg font-bold text-white">
              Export Render Pipeline
            </h2>
            <p className="text-xs text-slate-400">
              {project.name} · {project.aspectRatio}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            aria-label="Close export modal"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="export-container" className="block text-xs font-medium text-slate-300">
                Container
              </label>
              <select
                id="export-container"
                disabled={exporting}
                value={config.container}
                onChange={(e) =>
                  setConfig({ ...config, container: e.target.value as ExportConfig['container'] })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B0D11] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                {UNIVERSAL_CODEC_MATRIX.containers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="export-vcodec" className="block text-xs font-medium text-slate-300">
                Video Codec
              </label>
              <select
                id="export-vcodec"
                disabled={exporting}
                value={config.videoCodec}
                onChange={(e) =>
                  setConfig({ ...config, videoCodec: e.target.value as ExportConfig['videoCodec'] })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B0D11] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                {UNIVERSAL_CODEC_MATRIX.videoCodecs.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="export-acodec" className="block text-xs font-medium text-slate-300">
                Audio Codec
              </label>
              <select
                id="export-acodec"
                disabled={exporting}
                value={config.audioCodec}
                onChange={(e) =>
                  setConfig({ ...config, audioCodec: e.target.value as ExportConfig['audioCodec'] })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B0D11] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                {UNIVERSAL_CODEC_MATRIX.audioCodecs.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="export-res" className="block text-xs font-medium text-slate-300">
                Resolution
              </label>
              <select
                id="export-res"
                disabled={exporting}
                value={config.resolution}
                onChange={(e) =>
                  setConfig({ ...config, resolution: e.target.value as ResolutionPreset })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B0D11] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                {UNIVERSAL_CODEC_MATRIX.resolutions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="export-fps" className="block text-xs font-medium text-slate-300">
                Frame Rate
              </label>
              <select
                id="export-fps"
                disabled={exporting}
                value={config.fps}
                onChange={(e) =>
                  setConfig({ ...config, fps: Number(e.target.value) as FrameRate })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B0D11] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                {UNIVERSAL_CODEC_MATRIX.frameRates.map((f) => (
                  <option key={f} value={f}>
                    {f} FPS
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="export-bitrate" className="block text-xs font-medium text-slate-300">
                Bitrate ({config.bitrateMbps} Mbps)
              </label>
              <input
                id="export-bitrate"
                type="range"
                min={4}
                max={60}
                disabled={exporting}
                value={config.bitrateMbps}
                onChange={(e) => setConfig({ ...config, bitrateMbps: Number(e.target.value) })}
                className="mt-3 w-full accent-amber-500"
              />
            </div>
          </div>

          {/* Hardware Acceleration & Software Fallback Matrix */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0B0D11] p-3.5">
            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={config.hardwareAccelerated}
                disabled={exporting}
                onChange={(e) => setConfig({ ...config, hardwareAccelerated: e.target.checked })}
                className="h-4 w-4 rounded accent-amber-500"
              />
              <Cpu className="h-4 w-4 text-amber-400" />
              <span>Hardware-Accelerated Media3 Transformer</span>
            </label>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Decoder Fallback:</span>
              <select
                aria-label="Software decoder fallback"
                disabled={exporting}
                value={config.softwareFallbackEngine}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    softwareFallbackEngine: e.target.value as 'FFmpeg' | 'libdav1d',
                  })
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              >
                <option value="FFmpeg">FFmpeg</option>
                <option value="libdav1d">libdav1d (AV1)</option>
              </select>
            </div>
          </div>

          {/* Render Progress */}
          {(exporting || progress > 0) && (
            <div className="rounded-xl border border-slate-800 bg-[#0B0D11] p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-mono-tabular font-semibold text-amber-400">{progress}%</span>
                <span className="text-slate-400">{stageText}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-sky-400 transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {errorText && (
            <p role="alert" className="text-xs font-medium text-rose-400">
              {errorText}
            </p>
          )}

          {downloadResult && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-200">Render Ready</p>
                  <p className="font-mono-tabular text-xs text-emerald-300/80">
                    {downloadResult.filename} · {downloadResult.sizeKb} KB
                  </p>
                </div>
              </div>
              <a
                href={downloadResult.url}
                download={downloadResult.filename}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
              </a>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
          <button
            type="button"
            disabled={exporting}
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            data-testid="start-export-btn"
            disabled={exporting}
            onClick={() => void handleStartExport()}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60 cursor-pointer"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{exporting ? 'Rendering...' : 'Start Export'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
