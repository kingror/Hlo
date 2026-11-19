import { useState } from 'react';
import {
  Copy,
  Film,
  FolderOpen,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  AspectRatio,
  FrameRate,
  PermissionGrantState,
  ResolutionPreset,
  RornProject,
  UNIVERSAL_CODEC_MATRIX,
} from '../domain/models';
import { formatTimecode, getProjectDurationMs } from '../domain/timelineEngine';
import { RecoveryJournalEntry } from '../data/projectRepository';

interface HomeScreenProps {
  projects: RornProject[];
  permissions: PermissionGrantState;
  recoveryEntry: RecoveryJournalEntry | null;
  onCreateProject: (params: {
    name: string;
    resolution: ResolutionPreset;
    fps: FrameRate;
    aspectRatio: AspectRatio;
  }) => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onDuplicateProject: (projectId: string) => void;
  onRestoreRecovery: () => void;
  onDismissRecovery: () => void;
  onOpenPermissions: () => void;
  onOpenBlueprint: () => void;
}

export function HomeScreen({
  projects,
  permissions,
  recoveryEntry,
  onCreateProject,
  onOpenProject,
  onDeleteProject,
  onRenameProject,
  onDuplicateProject,
  onRestoreRecovery,
  onDismissRecovery,
  onOpenPermissions,
  onOpenBlueprint,
}: HomeScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [nameError, setNameError] = useState('');
  const [resolution, setResolution] = useState<ResolutionPreset>('4K UHD');
  const [fps, setFps] = useState<FrameRate>(60);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  function handleOpenCreateDialog() {
    setProjectName('');
    setNameError('');
    setResolution('4K UHD');
    setFps(60);
    setAspectRatio('16:9');
    setShowNewModal(true);
  }

  function handleSubmitNew(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) {
      setNameError('Please enter a project name.');
      return;
    }
    onCreateProject({ name: trimmed, resolution, fps, aspectRatio });
    setShowNewModal(false);
  }

  function startRename(project: RornProject) {
    setRenamingId(project.id);
    setRenameValue(project.name);
  }

  function commitRename(projectId: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onRenameProject(projectId, trimmed);
    }
    setRenamingId(null);
  }

  const grantedCount = (['storage', 'camera', 'microphone', 'notifications'] as const).filter(
    (k) => permissions[k] === 'granted'
  ).length;

  return (
    <div className="min-h-screen bg-[#0B0D11] text-slate-100">
      {/* Top Bar Contract: Brand — Nav Links — Primary CTA */}
      <header className="border-b border-slate-800/90 bg-[#0D1016]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <span className="font-display text-xl font-extrabold tracking-[0.18em] text-white whitespace-nowrap shrink-0">
            RORN
          </span>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 md:flex">
            <button
              type="button"
              onClick={onOpenBlueprint}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Architecture
            </button>
            <button
              type="button"
              onClick={onOpenBlueprint}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Codec Matrix
            </button>
            <button
              type="button"
              onClick={onOpenPermissions}
              className="flex items-center gap-1.5 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Permissions ({grantedCount}/4)</span>
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateDialog}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Crash Recovery Journal Banner if present */}
        {recoveryEntry && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Unsaved Recovery Snapshot Available: {recoveryEntry.projectName}
                </p>
                <p className="text-xs text-amber-300/80">
                  Last checkpoint ({recoveryEntry.actionLabel}) recorded{' '}
                  {new Date(recoveryEntry.savedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRestoreRecovery}
                className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer whitespace-nowrap"
              >
                Restore Session
              </button>
              <button
                type="button"
                onClick={onDismissRecovery}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Primary Launch Section: Prominent + New Button */}
        <section className="rounded-2xl border border-slate-800 bg-[#11141C] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl">
                Project Studio
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Create a multi-track 4K sequence or resume a recent project saved in local Room storage.
              </p>
            </div>

            <button
              type="button"
              data-testid="home-new-project-btn"
              onClick={handleOpenCreateDialog}
              className="group flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 px-7 py-4 font-display text-base font-bold text-slate-950 shadow-lg shadow-amber-500/15 transition-transform hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
              <span>New</span>
            </button>
          </div>
        </section>

        {/* Recent Projects Section positioned directly below */}
        <section className="mt-10" aria-labelledby="recent-projects-heading">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 id="recent-projects-heading" className="font-display text-xl font-semibold text-white">
                Recent Projects
              </h2>
              <p className="mt-0.5 text-xs text-slate-400 font-mono-tabular">
                {projects.length} saved {projects.length === 1 ? 'project' : 'projects'}
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recent projects..."
                aria-label="Search recent projects"
                className="w-full rounded-xl border border-slate-800 bg-[#11141C] py-2 pr-3 pl-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-[#10131A] px-6 py-14 text-center">
              <Film className="h-10 w-10 text-slate-600" />
              <h3 className="mt-4 font-display text-lg font-semibold text-slate-200">
                {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                {projects.length === 0
                  ? 'Start your first timeline sequence with the + New button above.'
                  : 'Try clearing your search filter or start a new timeline project.'}
              </p>
              <button
                type="button"
                onClick={handleOpenCreateDialog}
                className="mt-5 flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create Project</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => {
                const durationMs = getProjectDurationMs(project);
                const firstVisual = project.clips.find((c) => c.mediaSrc);
                const thumb = project.thumbnailSrc ?? firstVisual?.mediaSrc;
                const isRenaming = renamingId === project.id;

                return (
                  <article
                    key={project.id}
                    data-testid={`project-card-${project.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-[#11141C] transition-colors hover:border-slate-700"
                  >
                    {/* Thumbnail Preview */}
                    <button
                      type="button"
                      onClick={() => onOpenProject(project.id)}
                      aria-label={`Open project ${project.name}`}
                      className="relative aspect-video w-full overflow-hidden bg-[#090B0F] text-left cursor-pointer"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={project.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-[#0B0D11]">
                          <Layers className="h-8 w-8 text-slate-600" />
                          <span className="mt-2 text-xs text-slate-500">Empty Timeline</span>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-3">
                        <div className="flex items-center justify-between text-xs text-slate-200 font-mono-tabular">
                          <span>{project.resolution}</span>
                          <span>{formatTimecode(durationMs, project.fps)}</span>
                        </div>
                      </div>
                    </button>

                    {/* Project Details */}
                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        {isRenaming ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              commitRename(project.id);
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              aria-label={`Rename ${project.name}`}
                              className="w-full rounded-lg border border-amber-500 bg-[#0B0D11] px-2.5 py-1 text-sm text-white focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-slate-950 cursor-pointer"
                            >
                              Save
                            </button>
                          </form>
                        ) : (
                          <h3 className="truncate font-display text-base font-semibold text-white">
                            {project.name}
                          </h3>
                        )}

                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono-tabular">
                          <span>{project.fps} FPS</span>
                          <span aria-hidden="true">·</span>
                          <span>{project.aspectRatio}</span>
                          <span aria-hidden="true">·</span>
                          <span>{project.clips.length} clips</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                        <button
                          type="button"
                          onClick={() => onOpenProject(project.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-500 hover:text-slate-950 cursor-pointer whitespace-nowrap"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          <span>Open Editor</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startRename(project)}
                            aria-label={`Rename '${project.name}'`}
                            title="Rename project"
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateProject(project.id)}
                            aria-label={`Duplicate '${project.name}'`}
                            title="Duplicate project"
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(project.id)}
                            aria-label={`Delete '${project.name}'`}
                            title="Delete project"
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Create New Project Modal */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-project-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <form
            onSubmit={handleSubmitNew}
            className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-[#141820] p-6 shadow-2xl"
          >
            <h2 id="new-project-modal-title" className="font-display text-xl font-bold text-white">
              Create New Project
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Configure timeline sequence settings. Stored automatically in Room DB.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="new-project-name" className="block text-xs font-medium text-slate-300">
                  Project Name
                </label>
                <input
                  id="new-project-name"
                  type="text"
                  autoFocus
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  placeholder="e.g. Alpine Documentary 4K"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B0D11] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                />
                {nameError && (
                  <p className="mt-1 text-xs font-medium text-rose-400" role="alert">
                    {nameError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-project-res" className="block text-xs font-medium text-slate-300">
                    Resolution
                  </label>
                  <select
                    id="new-project-res"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as ResolutionPreset)}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B0D11] px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  >
                    {UNIVERSAL_CODEC_MATRIX.resolutions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="new-project-fps" className="block text-xs font-medium text-slate-300">
                    Frame Rate
                  </label>
                  <select
                    id="new-project-fps"
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value) as FrameRate)}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B0D11] px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  >
                    {UNIVERSAL_CODEC_MATRIX.frameRates.map((f) => (
                      <option key={f} value={f}>
                        {f} FPS
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-300">Aspect Ratio</span>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {(['16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map((ar) => (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => setAspectRatio(ar)}
                      className={`rounded-xl border py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        aspectRatio === ar
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                          : 'border-slate-700 bg-[#0B0D11] text-slate-400 hover:text-white'
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer"
              >
                Create & Open
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
