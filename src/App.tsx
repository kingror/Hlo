import { useState } from 'react';
import {
  AspectRatio,
  FrameRate,
  PermissionGrantState,
  ResolutionPreset,
  RornProject,
} from './domain/models';
import {
  clearCrashRecoveryJournal,
  createNewProject,
  deleteProjectById,
  duplicateProjectById,
  loadAllProjects,
  loadPermissionState,
  readCrashRecoveryJournal,
  RecoveryJournalEntry,
  renameProjectById,
  savePermissionState,
  upsertProject,
} from './data/projectRepository';
import { SplashScreen } from './components/SplashScreen';
import { PermissionModal } from './components/PermissionModal';
import { HomeScreen } from './components/HomeScreen';
import { EditorWorkspace } from './components/EditorWorkspace';
import { BlueprintModal } from './components/BlueprintModal';

type AppScreen = 'splash' | 'home' | 'editor';

export default function App() {
  const isAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [screen, setScreen] = useState<AppScreen>(isAutostart ? 'home' : 'splash');
  const [permissions, setPermissions] = useState<PermissionGrantState>(() => loadPermissionState());
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [projects, setProjects] = useState<RornProject[]>(() => loadAllProjects());
  const [activeProject, setActiveProject] = useState<RornProject | null>(null);
  const [recoveryEntry, setRecoveryEntry] = useState<RecoveryJournalEntry | null>(() =>
    readCrashRecoveryJournal()
  );
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);

  function handleSplashComplete() {
    setScreen('home');
    if (!permissions.completed) {
      setShowPermissionModal(true);
    }
  }

  function handlePermissionsComplete(nextState: PermissionGrantState) {
    savePermissionState(nextState);
    setPermissions(nextState);
    setShowPermissionModal(false);
  }

  function handleCreateProject(params: {
    name: string;
    resolution: ResolutionPreset;
    fps: FrameRate;
    aspectRatio: AspectRatio;
  }) {
    const created = createNewProject(params);
    setProjects(loadAllProjects());
    setActiveProject(created);
    setScreen('editor');
  }

  function handleOpenProject(projectId: string) {
    const target = projects.find((p) => p.id === projectId);
    if (!target) return;
    setActiveProject(target);
    setScreen('editor');
  }

  function handleSaveProject(updated: RornProject) {
    const nextList = upsertProject(updated);
    setProjects(nextList);
    setActiveProject(updated);
    clearCrashRecoveryJournal();
    setRecoveryEntry(null);
  }

  function handleRestoreRecovery() {
    if (!recoveryEntry) return;
    const restored = recoveryEntry.project;
    setProjects(upsertProject(restored));
    setActiveProject(restored);
    clearCrashRecoveryJournal();
    setRecoveryEntry(null);
    setScreen('editor');
  }

  return (
    <div className="min-h-screen bg-[#0B0D11] text-slate-100">
      {screen === 'splash' && <SplashScreen onComplete={handleSplashComplete} />}

      {screen === 'home' && (
        <HomeScreen
          projects={projects}
          permissions={permissions}
          recoveryEntry={recoveryEntry}
          onCreateProject={handleCreateProject}
          onOpenProject={handleOpenProject}
          onDeleteProject={(id) => setProjects(deleteProjectById(id))}
          onRenameProject={(id, newName) => setProjects(renameProjectById(id, newName))}
          onDuplicateProject={(id) => setProjects(duplicateProjectById(id))}
          onRestoreRecovery={handleRestoreRecovery}
          onDismissRecovery={() => {
            clearCrashRecoveryJournal();
            setRecoveryEntry(null);
          }}
          onOpenPermissions={() => setShowPermissionModal(true)}
          onOpenBlueprint={() => setShowBlueprintModal(true)}
        />
      )}

      {screen === 'editor' && activeProject && (
        <EditorWorkspace
          key={activeProject.id}
          initialProject={activeProject}
          onSaveProject={handleSaveProject}
          onBackHome={() => {
            setProjects(loadAllProjects());
            setScreen('home');
          }}
          onOpenBlueprint={() => setShowBlueprintModal(true)}
        />
      )}

      {showPermissionModal && (
        <PermissionModal
          initialState={permissions}
          onComplete={handlePermissionsComplete}
        />
      )}

      {showBlueprintModal && (
        <BlueprintModal onClose={() => setShowBlueprintModal(false)} />
      )}
    </div>
  );
}
