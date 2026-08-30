import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
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
import { projectService } from './services/projectService';
import { fileService } from './services/fileService';
import { stripeCheckoutService } from './services/stripeCheckoutService';
import { CheckoutSuccessModal } from './components/subscription/CheckoutSuccessModal';
import { Toaster, type ToastItem } from './components/common/Toaster';
import type { Project, FileMedia, Plan } from './types/database';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ProjectDetailPage = lazy(() =>
  import('./pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage }))
);
const EditorPage = lazy(() =>
  import('./pages/EditorPage').then((m) => ({ default: m.EditorPage }))
);
const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((m) => ({ default: m.AdminPage }))
);

const PulseLoadingScreen: React.FC = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--ui-canvas,#050814)] w-screen h-screen select-none">
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

const usePageLoading = (isDataLoading = false, durationMs = 300) => {
  const [minLoadingDone, setMinLoadingDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingDone(true);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  return isDataLoading || !minLoadingDone;
};

const PublicLandingRoute: React.FC = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const isPageLoading = usePageLoading(loading, 300);

  if (isPageLoading) return <PulseLoadingScreen />;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
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
  const isPageLoading = usePageLoading(loading, 300);

  if (isPageLoading) return <PulseLoadingScreen />;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile) return <Navigate to="/projects" replace />;

  return (
    <div className="app-shell">
      <LoginPage onViewLanding={() => navigate('/')} />
      <Footer />
    </div>
  );
};

const ProtectedUserLayout: React.FC = () => {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <PulseLoadingScreen />;
  if (!profile) return <Navigate to="/" replace />;
  if (profile.role === 'admin') return <Navigate to="/admin" replace />;

  const isEditorView = location.pathname.includes('/editor');
  const activeView = isEditorView
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { refreshProfile } = useAuth();
  const isPageLoading = usePageLoading(false, 300);
  const intentType = searchParams.get('intent');
  const checkoutStatus = searchParams.get('checkout');
  const checkoutSessionId = searchParams.get('session_id');
  const [activeIntent, setActiveIntent] = useState<{ type: 'create' | 'search'; id: number } | null>(null);
  const [successPlan, setSuccessPlan] = useState<Plan | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const handledCheckoutRef = useRef<string | null>(null);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (intentType === 'create' || intentType === 'search') {
      setActiveIntent({ type: intentType as 'create' | 'search', id: Date.now() });
      navigate('/projects', { replace: true });
    }
  }, [intentType, navigate]);

  useEffect(() => {
    if (!checkoutStatus) return;

    const checkoutKey = `${checkoutStatus}:${checkoutSessionId || ''}`;
    if (handledCheckoutRef.current === checkoutKey) return;
    handledCheckoutRef.current = checkoutKey;

    const clearCheckoutParams = () => navigate('/projects', { replace: true });

    if (checkoutStatus === 'cancelled') {
      showToast(t('subscription.checkoutCancelled'), 'error');
      clearCheckoutParams();
      return;
    }

    if (checkoutStatus !== 'success' || !checkoutSessionId) {
      showToast(t('subscription.checkoutFailed'), 'error');
      clearCheckoutParams();
      return;
    }

    showToast(t('subscription.checkoutProcessing'), 'info');
    void stripeCheckoutService
      .completeSession(checkoutSessionId)
      .then(async ({ plan }) => {
        await refreshProfile();
        setSuccessPlan(plan);
        clearCheckoutParams();
      })
      .catch((error) => {
        console.error('Could not verify Stripe Checkout:', error);
        showToast(t('subscription.checkoutFailed'), 'error');
        clearCheckoutParams();
      });
  }, [checkoutSessionId, checkoutStatus, navigate, refreshProfile, showToast, t]);

  if (isPageLoading) return <PulseLoadingScreen />;

  return (
    <>
      <DashboardPage
        intent={activeIntent}
        onSelectProject={(project) => navigate(`/projects/${project.id}`)}
      />

      <Toaster toasts={toasts} onDismiss={dismissToast} position="bottom-right" />

      {successPlan && (
        <CheckoutSuccessModal
          isOpen
          onClose={() => setSuccessPlan(null)}
          plan={successPlan}
        />
      )}
    </>
  );
};

const ProjectDetailRoute: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isPageLoading = usePageLoading(loading, 300);

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

  if (isPageLoading) return <PulseLoadingScreen />;

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
  const isPageLoading = usePageLoading(loading, 300);

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

  if (isPageLoading) return <PulseLoadingScreen />;

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
  const { profile, loading } = useAuth();
  const isPageLoading = usePageLoading(loading, 300);

  if (isPageLoading) return <PulseLoadingScreen />;
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role !== 'admin') return <Navigate to="/projects" replace />;
  return <AdminPage />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PulseLoadingScreen />}>
      <Routes>
        <Route path="/" element={<PublicLandingRoute />} />
        <Route path="/login" element={<PublicLoginRoute />} />

        <Route element={<ProtectedUserLayout />}>
          <Route path="/projects" element={<DashboardRoute />} />
          <Route path="/projects/:projectId" element={<ProjectDetailRoute />} />
          <Route path="/projects/:projectId/editor/:fileId" element={<EditorRoute />} />
        </Route>

        <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/admin/:section" element={<AdminRoute />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
