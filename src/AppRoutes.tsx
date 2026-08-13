import React, { useEffect, useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
  useSearchParams,
  Outlet,
} from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppSidebar } from './components/common/AppSidebar';
import { Footer } from './components/common/Footer';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { EditorPage } from './pages/EditorPage';
import { projectService } from './services/projectService';
import { fileService } from './services/fileService';
import type { Project, FileMedia } from './types/database';

const PulseLoadingScreen: React.FC = () => (
  <div className="app-shell flex items-center justify-center min-h-screen">
    <div className="app-loading flex flex-col items-center justify-center" role="status" aria-live="polite">
      <div className="size-20 sm:size-24 rounded-3xl ui-card flex items-center justify-center p-3.5 shadow-xl border border-[var(--ui-border)] animate-pulse">
        <img src="/logo.png" alt="LTS.ai" className="w-full h-full object-contain" />
      </div>
    </div>
  </div>
);

const useFixedLoading = (authLoading: boolean, durationMs = 1200) => {
  const [minLoadingDone, setMinLoadingDone] = useState(false);
  const [wasInitiallyLoading] = useState(authLoading);

  useEffect(() => {
    if (!wasInitiallyLoading) return;
    const timer = setTimeout(() => {
      setMinLoadingDone(true);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, wasInitiallyLoading]);

  if (!wasInitiallyLoading) return false;
  return authLoading || !minLoadingDone;
};

const PublicLandingRoute: React.FC = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const isAppLoading = useFixedLoading(loading, 1200);

  if (isAppLoading) return <PulseLoadingScreen />;
  if (profile) return <Navigate to="/projects" replace />;

  return (
    <div className="app-shell">
      <LandingPage onGetStarted={() => navigate('/login')} />
      <Footer />
    </div>
  );
};

const PublicLoginRoute: React.FC = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const isAppLoading = useFixedLoading(loading, 1200);

  if (isAppLoading) return <PulseLoadingScreen />;
  if (profile) return <Navigate to="/projects" replace />;

  return (
    <div className="app-shell">
      <LoginPage onViewLanding={() => navigate('/')} />
      <Footer />
    </div>
  );
};

const ProtectedLayout: React.FC = () => {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAppLoading = useFixedLoading(loading, 1200);

  if (isAppLoading) return <PulseLoadingScreen />;

  if (!profile) {
    return <Navigate to="/" replace />;
  }

  const isEditorView = location.pathname.includes('/editor');
  const activeView = isEditorView
    ? 'editor'
    : location.pathname.startsWith('/projects/')
    ? 'project'
    : 'projects';

  const handleHome = () => {
    navigate('/projects');
  };

  const handleCreateProject = () => {
    navigate('/projects?intent=create');
  };

  const handleSearchProjects = () => {
    navigate('/projects?intent=search');
  };

  return (
    <div className="authenticated-shell">
      <AppSidebar
        onHome={handleHome}
        onCreateProject={handleCreateProject}
        onSearchProjects={handleSearchProjects}
        editorActive={isEditorView}
        activeView={activeView}
      />
      <div className="app-content">
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const DashboardRoute: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intentType = searchParams.get('intent');
  const [intentId, setIntentId] = useState(0);

  useEffect(() => {
    if (intentType) setIntentId((id) => id + 1);
  }, [intentType]);

  const intent = intentType === 'create' || intentType === 'search'
    ? { type: intentType as 'create' | 'search', id: intentId }
    : null;

  return (
    <DashboardPage
      intent={intent}
      onSelectProject={(project) => navigate(`/projects/${project.id}`)}
    />
  );
};

const ProjectDetailRoute: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    projectService
      .getProjectById(projectId)
      .then((data) => {
        if (!mounted) return;
        if (!data) setError('Không tìm thấy dự án.');
        else setProject(data);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Error fetching project by ID:', err);
        setError('Không thể tải thông tin dự án.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  if (error && !loading) {
    return (
      <div className="workspace-page ui-container py-12 text-center space-y-4">
        <p className="text-sm font-bold text-[var(--ui-danger)]">{error}</p>
        <button onClick={() => navigate('/projects')} className="ui-button ui-button-secondary">
          Về danh sách dự án
        </button>
      </div>
    );
  }

  const activeProject = project || { id: projectId || '', title: '', description: null, target_language: 'vi', created_at: '', updated_at: '', user_id: '' };

  return (
    <ProjectDetailPage
      project={activeProject}
      routeLoading={loading}
      onBack={() => navigate('/projects')}
      onOpenFileEditor={(file) => navigate(`/projects/${activeProject.id}/editor/${file.id}`)}
    />
  );
};

const EditorRoute: React.FC = () => {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [file, setFile] = useState<FileMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !fileId) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      projectService.getProjectById(projectId),
      fileService.getFileById(fileId),
    ])
      .then(([projData, fileData]) => {
        if (!mounted) return;
        if (!projData || !fileData) {
          setError('Không tìm thấy tệp hoặc dự án.');
        } else {
          setProject(projData);
          setFile(fileData);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Error fetching editor data:', err);
        setError('Không thể tải dữ liệu biên tập.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [fileId, projectId]);

  if (error && !loading) {
    return (
      <div className="workspace-page ui-container py-12 text-center space-y-4">
        <p className="text-sm font-bold text-[var(--ui-danger)]">{error}</p>
        <button onClick={() => navigate(`/projects/${projectId || ''}`)} className="ui-button ui-button-secondary">
          Quay lại dự án
        </button>
      </div>
    );
  }

  const activeProject = project || { id: projectId || '', title: '', description: null, target_language: 'vi', created_at: '', updated_at: '', user_id: '' };
  const activeFile = file || { id: fileId || '', project_id: projectId || '', drive_file_id: '', file_name: '', mime_type: 'video/mp4', duration_seconds: 0, status: 'draft', input_source: 'media', detected_source_lang: null, created_at: '', error_message: null };

  return (
    <EditorPage
      file={activeFile}
      project={activeProject}
      routeLoading={loading}
      onBack={() => navigate(`/projects/${activeProject.id}`)}
    />
  );
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<PublicLandingRoute />} />
      <Route path="/login" element={<PublicLoginRoute />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/projects" element={<DashboardRoute />} />
        <Route path="/projects/:projectId" element={<ProjectDetailRoute />} />
        <Route path="/projects/:projectId/editor/:fileId" element={<EditorRoute />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
