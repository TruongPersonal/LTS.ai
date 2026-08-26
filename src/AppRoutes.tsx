import React, { useEffect, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useAuth } from './hooks/useAuth';
import { AppSidebar } from './components/common/AppSidebar';
import { Footer } from './components/common/Footer';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { EditorPage } from './pages/EditorPage';
import { AdminPage } from './pages/AdminPage';
import { EditorSkeleton } from './components/common/LoadingSkeleton';
import { projectService } from './services/projectService';
import { fileService } from './services/fileService';
import { stripeCheckoutService } from './services/stripeCheckoutService';
import type { Project, FileMedia } from './types/database';

const PulseLoadingScreen: React.FC = () => (
  <div className="app-shell flex items-center justify-center min-h-screen">
    <div className="app-loading flex flex-col items-center justify-center" role="status" aria-live="polite">
      <div className="relative" style={{ animation: 'float-gravity 3.5s ease-in-out infinite' }}>
        <div
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: 28,
            background: 'var(--cosmic-gradient)',
            animation: 'spin 3s linear infinite',
            opacity: 0.7,
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: 28,
            background: 'var(--ui-canvas)',
            zIndex: 1,
            insetInline: 'auto',
          }}
        />
        <div
          className="relative size-20 sm:size-24 rounded-3xl ui-card flex items-center justify-center p-3.5"
          style={{
            zIndex: 2,
            boxShadow: '0 0 40px var(--ui-accent-glow)',
          }}
        >
          <img src="/logo.png" alt="LTS.ai" className="w-full h-full object-contain" />
        </div>
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
  if (!profile) return <Navigate to="/" replace />;

  const isEditorView = location.pathname.includes('/editor');
  const isAdminView = location.pathname.startsWith('/admin');
  const activeView = isAdminView
    ? 'admin'
    : isEditorView
      ? 'editor'
      : location.pathname.startsWith('/projects/')
        ? 'project'
        : 'projects';

  return (
    <div className="authenticated-shell">
      <AppSidebar
        onHome={() => navigate('/projects')}
        onCreateProject={() => navigate('/projects?intent=create')}
        onSearchProjects={() => navigate('/projects?intent=search')}
        onAdmin={() => navigate('/admin')}
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProfile } = useAuth();
  const intentType = searchParams.get('intent');
  const checkoutStatus = searchParams.get('checkout');
  const checkoutSessionId = searchParams.get('session_id');
  const [intentId, setIntentId] = useState(0);
  const [checkoutNotice, setCheckoutNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const handledCheckoutRef = useRef<string | null>(null);

  useEffect(() => {
    if (intentType) setIntentId((id) => id + 1);
  }, [intentType]);

  useEffect(() => {
    if (!checkoutStatus) return;

    const checkoutKey = `${checkoutStatus}:${checkoutSessionId || ''}`;
    if (handledCheckoutRef.current === checkoutKey) return;
    handledCheckoutRef.current = checkoutKey;

    const clearCheckoutParams = () => navigate('/projects', { replace: true });

    if (checkoutStatus === 'cancelled') {
      setCheckoutNotice({ type: 'error', message: t('subscription.checkoutCancelled') });
      clearCheckoutParams();
      return;
    }

    if (checkoutStatus !== 'success' || !checkoutSessionId) {
      setCheckoutNotice({ type: 'error', message: t('subscription.checkoutFailed') });
      clearCheckoutParams();
      return;
    }

    setCheckoutNotice({ type: 'success', message: t('subscription.checkoutProcessing') });
    void stripeCheckoutService
      .completeSession(checkoutSessionId)
      .then(async ({ plan }) => {
        await refreshProfile();
        setCheckoutNotice({
          type: 'success',
          message: t('subscription.checkoutSuccess', {
            plan: t(`subscription.plans.${plan}.name`),
          }),
        });
        clearCheckoutParams();
      })
      .catch((error) => {
        console.error('Could not verify Stripe Checkout:', error);
        setCheckoutNotice({ type: 'error', message: t('subscription.checkoutFailed') });
        clearCheckoutParams();
      });
  }, [checkoutSessionId, checkoutStatus, navigate, refreshProfile, t]);

  const intent =
    intentType === 'create' || intentType === 'search'
      ? { type: intentType as 'create' | 'search', id: intentId }
      : null;

  return (
    <DashboardPage
      intent={intent}
      checkoutNotice={checkoutNotice}
      onSelectProject={(project) => navigate(`/projects/${project.id}`)}
    />
  );
};

const ProjectDetailRoute: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
        if (!data) setError(t('routes.projectNotFound'));
        else setProject(data);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Error fetching project by ID:', err);
        setError(t('routes.projectLoadError'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [projectId, t]);

  if (error && !loading) {
    return (
      <div className="workspace-page ui-container py-12 text-center space-y-4">
        <p className="text-sm font-bold text-[var(--ui-danger)]">{error}</p>
        <button
          onClick={() => navigate('/projects')}
          className="ui-button ui-button-secondary"
        >
          {t('routes.backToProjects')}
        </button>
      </div>
    );
  }

  const activeProject: Project = project || {
    id: projectId || '',
    title: '',
    description: null,
    target_language: 'vi',
    created_at: '',
    updated_at: '',
    user_id: '',
  };

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
  const { t } = useTranslation();
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
          setError(t('routes.editorDataNotFound'));
        } else {
          setProject(projData);
          setFile(fileData);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Error fetching editor data:', err);
        setError(t('routes.editorDataLoadError'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [fileId, projectId, t]);

  if (loading) {
    return <EditorSkeleton />;
  }

  if (error) {
    return (
      <div className="workspace-page ui-container py-12 text-center space-y-4">
        <p className="text-sm font-bold text-[var(--ui-danger)]">{error}</p>
        <button
          onClick={() => navigate(`/projects/${projectId || ''}`)}
          className="ui-button ui-button-secondary"
        >
          {t('routes.backToProject')}
        </button>
      </div>
    );
  }

  const activeProject: Project = project || {
    id: projectId || '',
    title: '',
    description: null,
    target_language: 'vi',
    created_at: '',
    updated_at: '',
    user_id: '',
  };

  const activeFile: FileMedia = file || {
    id: fileId || '',
    project_id: projectId || '',
    drive_file_id: '',
    file_name: '',
    mime_type: 'video/mp4',
    duration_seconds: 0,
    status: 'draft',
    input_source: 'media',
    detected_source_lang: null,
    created_at: '',
    error_message: null,
  };

  return (
    <EditorPage
      file={activeFile}
      project={activeProject}
      routeLoading={false}
      onBack={() => navigate(`/projects/${activeProject.id}`)}
    />
  );
};

const AdminRoute: React.FC = () => {
  const { profile } = useAuth();
  if (profile?.role !== 'admin') return <Navigate to="/projects" replace />;
  return <AdminPage />;
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
        <Route path="/admin" element={<AdminRoute />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
