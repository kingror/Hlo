import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    let frameId = 0;
    const durationMs = 1750;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(1, elapsed / durationMs);
      // Smooth eased progress from 1 to 100
      const eased = 1 - Math.pow(1 - ratio, 2.1);
      const pct = Math.max(1, Math.min(100, Math.round(1 + eased * 99)));
      setProgress(pct);

      if (ratio < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        const timer = setTimeout(() => onComplete(), 180);
        return () => clearTimeout(timer);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [onComplete]);

  return (
    <div
      data-testid="splash-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#07090D] px-6 py-12 select-none"
    >
      {/* Top spacer */}
      <div className="h-6" />

      {/* Center: Premium RORN Logo & Dynamic Gradient Glow */}
      <div className="relative flex flex-col items-center justify-center">
        <div
          aria-hidden="true"
          className="animate-rorn-glow absolute -inset-12 rounded-full bg-gradient-to-tr from-amber-500/25 via-sky-500/20 to-indigo-500/25 blur-3xl"
        />
        <div className="relative flex flex-col items-center gap-5">
          {/* Geometric Cinema Aperture / Blade Mark */}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-[#0E121A] shadow-2xl">
            <div
              aria-hidden="true"
              className="animate-rorn-gradient absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/20 via-transparent to-sky-400/20 opacity-80"
            />
            <svg
              viewBox="0 0 64 64"
              className="relative h-12 w-12"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="rorn-mark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="50%" stopColor="#FBBF24" />
                  <stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
              <path
                d="M14 14H36C43.732 14 50 20.268 50 28C50 33.782 46.494 38.745 41.494 40.875L50 50H38.5L31 41.5H23V50H14V14ZM23 22.5V33.5H35.5C38.538 33.5 41 31.038 41 28C41 24.962 38.538 22.5 35.5 22.5H23Z"
                fill="url(#rorn-mark-grad)"
              />
            </svg>
          </div>

          <div className="text-center">
            <h1 className="animate-rorn-gradient bg-gradient-to-r from-amber-300 via-white to-sky-300 bg-clip-text font-display text-5xl font-extrabold tracking-[0.22em] text-transparent sm:text-6xl">
              RORN
            </h1>
            <p className="mt-2 text-xs font-medium tracking-[0.28em] text-slate-400">
              NON-LINEAR CINEMA STUDIO
            </p>
          </div>
        </div>
      </div>

      {/* Bottom: Counter directly above top-left of sleek horizontal line progress bar */}
      <div className="w-full max-w-xl pb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span
            data-testid="splash-percentage"
            className="font-mono-tabular text-sm font-semibold text-amber-400"
          >
            {progress}%
          </span>
          <span className="text-xs text-slate-500">Initializing timeline engine</span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={1}
          aria-valuemax={100}
          aria-label="RORN initialization progress"
          className="relative h-[3px] w-full overflow-hidden rounded-full bg-slate-800/90"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-sky-400 shadow-[0_0_12px_rgba(245,158,11,0.65)] transition-[width] duration-75 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
