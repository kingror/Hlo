import { Cpu, Database, Film, Layers, X } from 'lucide-react';
import { ARCHITECTURE_MODULES, UNIVERSAL_CODEC_MATRIX } from '../domain/models';

interface BlueprintModalProps {
  onClose: () => void;
}

export function BlueprintModal({ onClose }: BlueprintModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blueprint-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#12161F] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 id="blueprint-modal-title" className="font-display text-xl font-bold text-white">
              RORN Clean Architecture & Universal Codec Matrix
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Modular separation across presentation, timeline domain, Room storage, and Media3/OpenGL core
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close architecture modal"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-8">
          {/* Clean Architecture Modules */}
          <section>
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-amber-400">
              <Layers className="h-4 w-4" />
              <span>Modular Package Structure</span>
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              {ARCHITECTURE_MODULES.map((mod) => (
                <div
                  key={mod.module}
                  className="rounded-xl border border-slate-800 bg-[#0C0F15] p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono-tabular text-sm font-bold text-white">
                      {mod.module}
                    </span>
                    <span className="text-xs font-medium text-sky-400">{mod.layer}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{mod.tech}</p>
                  <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                    {mod.responsibilities.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Universal Format & Codec Matrix */}
          <section>
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-sky-400">
              <Film className="h-4 w-4" />
              <span>Universal Format & Codec Support Matrix</span>
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-[#0C0F15] p-4">
                <p className="text-xs font-semibold text-slate-300">Containers</p>
                <p className="mt-2 font-mono-tabular text-xs leading-relaxed text-slate-400">
                  {UNIVERSAL_CODEC_MATRIX.containers.join(' · ')}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#0C0F15] p-4">
                <p className="text-xs font-semibold text-slate-300">Video Codecs</p>
                <p className="mt-2 font-mono-tabular text-xs leading-relaxed text-slate-400">
                  {UNIVERSAL_CODEC_MATRIX.videoCodecs.join(' · ')}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#0C0F15] p-4">
                <p className="text-xs font-semibold text-slate-300">Audio Codecs</p>
                <p className="mt-2 font-mono-tabular text-xs leading-relaxed text-slate-400">
                  {UNIVERSAL_CODEC_MATRIX.audioCodecs.join(' · ')}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#0C0F15] p-4">
                <p className="text-xs font-semibold text-slate-300">Resolutions & Frame Rates</p>
                <p className="mt-2 font-mono-tabular text-xs leading-relaxed text-slate-400">
                  {UNIVERSAL_CODEC_MATRIX.resolutions.join(' · ')} @{' '}
                  {UNIVERSAL_CODEC_MATRIX.frameRates.join('/')} FPS
                </p>
              </div>
            </div>
          </section>

          {/* Persistence & Engine Guarantees */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0C0F15] p-4">
              <Database className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-white">Room Persistence & Crash Journal</p>
                <p className="mt-1 text-xs text-slate-400">
                  Every timeline command checkpoints to local IndexedDB/Storage journaling alongside
                  a 50-step Command Pattern Undo/Redo stack.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0C0F15] p-4">
              <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-white">LRU 4K Proxy & Decoder Fallback</p>
                <p className="mt-1 text-xs text-slate-400">
                  Hardware-accelerated Media3 Transformer pipeline paired with FFmpeg/libdav1d
                  software fallback and LRU proxy texture caching.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
