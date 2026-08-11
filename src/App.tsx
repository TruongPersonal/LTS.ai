import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppSidebar } from './components/common/AppSidebar';
import { Footer } from './components/common/Footer';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { EditorPage } from './pages/EditorPage';
import type { Project, FileMedia } from './types/database';
import './i18n';

type DashboardIntent = { type: 'create' | 'search'; id: number } | null;

const MainApp: React.FC = () => {
  const { t } = useTranslation();
  const { profile, loading } = useAuth();
  const [showLandingPage, setShowLandingPage] = useState<boolean>(!profile);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileMedia | null>(null);
  const [, setEditorDirty] = useState<boolean>(false);
  const [dashboardIntent, setDashboardIntent] = useState<DashboardIntent>(null);
  const [intentId, setIntentId] = useState(0);

  if (loading) {
    return (
      <div className="app-shell">
        <div className="app-loading flex flex-col items-center gap-4" role="status" aria-live="polite">
          <div className="size-14 rounded-2xl ui-card flex items-center justify-center p-2.5"><img src="/logo.png" alt="LTS.ai" className="w-full h-full object-contain" /></div>
          <div className="size-5 rounded-full border-2 border-[var(--ui-border)] border-t-[var(--ui-accent)] animate-spin" aria-label={t('accessibility.loadingApp')} />
        </div>
      </div>
    );
  }

  if (!profile) {
    if (showLandingPage) return <div className="app-shell"><LandingPage onGetStarted={() => setShowLandingPage(false)} /><Footer /></div>;
    return <div className="app-shell"><LoginPage onViewLanding={() => setShowLandingPage(true)} /><Footer /></div>;
  }

  const handleGoDashboard = () => {
    setEditorDirty(false);
    setSelectedProject(null);
    setSelectedFile(null);
  };
  const requestDashboardIntent = (type: 'create' | 'search') => {
    const nextId = intentId + 1;
    setIntentId(nextId);
    handleGoDashboard();
    setDashboardIntent({ type, id: nextId });
  };

  const isEditorView = Boolean(selectedFile && selectedProject);
  const activeView = isEditorView ? 'editor' : selectedProject ? 'project' : 'projects';

  return (
    <div className="authenticated-shell">
      <AppSidebar onHome={handleGoDashboard} onCreateProject={() => requestDashboardIntent('create')} onSearchProjects={() => requestDashboardIntent('search')} editorActive={isEditorView} activeView={activeView} />
      <div className="app-content">
        <main className="app-main">
          {selectedFile && selectedProject ? (
            <EditorPage file={selectedFile} project={selectedProject} onDirtyChange={setEditorDirty} onBack={() => { setEditorDirty(false); setSelectedFile(null); }} />
          ) : selectedProject ? (
            <ProjectDetailPage project={selectedProject} onBack={() => setSelectedProject(null)} onOpenFileEditor={(file) => { setEditorDirty(false); setSelectedFile(file); }} />
          ) : (
            <DashboardPage intent={dashboardIntent} onSelectProject={(project) => { setSelectedProject(project); setSelectedFile(null); }} />
          )}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return <ThemeProvider><AuthProvider><MainApp /></AuthProvider></ThemeProvider>;
}
