import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  adminService,
  type AdminAuditLog,
  type AdminFile,
  type AdminOverview,
  type AdminProjectItem,
  type AdminSubtitle,
  type AdminUser,
  type SystemConfig,
} from '../services/adminService';
import { updatePlanLimitsFromQuotas } from '../types/database';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminSidebar, type AdminTab } from '../components/admin/AdminSidebar';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { SubtitleViewerModal } from '../components/admin/SubtitleViewerModal';
import { AuditLogDetailModal } from '../components/admin/AuditLogDetailModal';
import { AdminToaster, type ToastItem, type ToastType } from '../components/admin/AdminToaster';
import { AdminOverviewTab } from '../components/admin/tabs/AdminOverviewTab';
import { AdminUsersTab } from '../components/admin/tabs/AdminUsersTab';
import { AdminProjectsTab } from '../components/admin/tabs/AdminProjectsTab';
import { AdminSystemConfigTab } from '../components/admin/tabs/AdminSystemConfigTab';
import { AdminAuditLogsTab } from '../components/admin/tabs/AdminAuditLogsTab';

const PAGE_SIZE = 15;

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();

  const activeTab: AdminTab = useMemo(() => {
    if (section === 'users') return 'users';
    if (section === 'projects') return 'projects';
    if (section === 'system') return 'system';
    if (section === 'logs' || section === 'audit_logs') return 'audit_logs';
    return 'overview';
  }, [section]);

  const handleSelectTab = (tab: AdminTab) => {
    const routePath = tab === 'audit_logs' ? 'logs' : tab;
    navigate(`/admin/${routePath}`);
  };

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [userSubTab, setUserSubTab] = useState<'users' | 'admins'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [projects, setProjects] = useState<AdminProjectItem[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectsSearch, setProjectsSearch] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectTitle, setSelectedProjectTitle] = useState<string>('');
  const [projectFiles, setProjectFiles] = useState<AdminFile[]>([]);
  const [loadingProjectFiles, setLoadingProjectFiles] = useState(false);

  const [selectedFileForSubtitles, setSelectedFileForSubtitles] = useState<AdminFile | null>(null);
  const [fileSubtitles, setFileSubtitles] = useState<AdminSubtitle[]>([]);
  const [loadingSubtitles, setLoadingSubtitles] = useState(false);
  const [deletingSubtitles, setDeletingSubtitles] = useState(false);

  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [loadingSystemConfig, setLoadingSystemConfig] = useState(false);
  const [savingSystemConfig, setSavingSystemConfig] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [totalAuditLogs, setTotalAuditLogs] = useState(0);
  const [auditLogsPage, setAuditLogsPage] = useState(1);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<AdminAuditLog | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDangerous?: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      setOverview(await adminService.getOverview());
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('admin.loadError'), 'error');
    } finally {
      setLoadingOverview(false);
    }
  }, [showToast, t]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const role = userSubTab === 'admins' ? 'admin' : 'user';
      const res = await adminService.listUsers(usersSearch, usersPage, PAGE_SIZE, '', role);
      setUsers(res.users);
      setTotalUsers(res.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('admin.loadError'), 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, [showToast, t, userSubTab, usersPage, usersSearch]);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await adminService.listProjects(projectsSearch, projectsPage, PAGE_SIZE);
      setProjects(res.projects);
      setTotalProjects(res.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('admin.loadError'), 'error');
    } finally {
      setLoadingProjects(false);
    }
  }, [projectsPage, projectsSearch, showToast, t]);

  const loadProjectFiles = useCallback(
    async (projectId: string, projectTitle: string) => {
      setSelectedProjectId(projectId);
      setSelectedProjectTitle(projectTitle);
      setLoadingProjectFiles(true);
      try {
        const res = await adminService.getProjectFiles(projectId);
        setProjectFiles(res.files);
      } catch (err) {
        showToast(err instanceof Error ? err.message : t('admin.loadError'), 'error');
      } finally {
        setLoadingProjectFiles(false);
      }
    },
    [showToast, t]
  );

  const loadSystemConfig = useCallback(async () => {
    setLoadingSystemConfig(true);
    try {
      const cfg = await adminService.getSystemConfig();
      setSystemConfig(cfg);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('admin.loadError'), 'error');
    } finally {
      setLoadingSystemConfig(false);
    }
  }, [showToast, t]);

  const loadAuditLogs = useCallback(async () => {
    setLoadingAuditLogs(true);
    try {
      const res = await adminService.listAuditLogs(auditLogsPage, PAGE_SIZE);
      setAuditLogs(res.logs);
      setTotalAuditLogs(res.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('admin.loadError'), 'error');
    } finally {
      setLoadingAuditLogs(false);
    }
  }, [auditLogsPage, showToast, t]);

  useEffect(() => {
    if (activeTab === 'overview') void loadOverview();
    if (activeTab === 'users') void loadUsers();
    if (activeTab === 'projects') void loadProjects();
    if (activeTab === 'system') void loadSystemConfig();
    if (activeTab === 'audit_logs') void loadAuditLogs();
  }, [activeTab, loadAuditLogs, loadOverview, loadProjects, loadSystemConfig, loadUsers]);

  const handleBanUser = (user: AdminUser) => {
    setConfirmModal({
      isOpen: true,
      title: t('admin.users.banConfirmTitle'),
      message: t('admin.users.banConfirmMessage', { email: user.email }),
      confirmText: t('admin.users.ban'),
      isDangerous: true,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await adminService.banUser(user.id);
          showToast(t('admin.users.banSuccess', 'Đã khoá tài khoản'));
          void loadUsers();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Action failed', 'error');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleUnbanUser = (user: AdminUser) => {
    setConfirmModal({
      isOpen: true,
      title: t('admin.users.unbanConfirmTitle'),
      message: t('admin.users.unbanConfirmMessage', { email: user.email }),
      confirmText: t('admin.users.unban'),
      isDangerous: false,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await adminService.unbanUser(user.id);
          showToast(t('admin.users.unbanSuccess', 'Đã mở khoá tài khoản'));
          void loadUsers();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Action failed', 'error');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleToggleRole = (user: AdminUser) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const roleLabel =
      nextRole === 'admin' ? t('admin.users.adminRole') : t('admin.users.userRole');

    setConfirmModal({
      isOpen: true,
      title: t('admin.users.setRoleConfirmTitle'),
      message: t('admin.users.setRoleConfirmMessage', { email: user.email, role: roleLabel }),
      confirmText: nextRole === 'admin' ? t('admin.users.makeAdmin') : t('admin.users.makeUser'),
      isDangerous: nextRole !== 'admin',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await adminService.setUserRole(user.id, nextRole);
          showToast(t('admin.users.roleUpdated', 'Đã cập nhật vai trò'));
          void loadUsers();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Action failed', 'error');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleResetQuota = (user: AdminUser) => {
    setConfirmModal({
      isOpen: true,
      title: t('admin.users.resetQuotaConfirmTitle'),
      message: t('admin.users.resetQuotaConfirmMessage', { email: user.email }),
      confirmText: t('admin.users.resetQuota'),
      isDangerous: false,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await adminService.resetUserQuota(user.id);
          showToast(
            t('admin.users.quotaResetSuccess', 'Đã đặt lại hạn mức sử dụng trong ngày')
          );
          void loadUsers();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Action failed', 'error');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleDeleteUser = (user: AdminUser) => {
    setConfirmModal({
      isOpen: true,
      title: t('admin.users.deleteConfirmTitle'),
      message: t('admin.users.deleteConfirmMessage', { email: user.email }),
      confirmText: t('admin.users.deleteUser'),
      isDangerous: true,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await adminService.deleteUser(user.id);
          showToast(t('admin.users.userDeleted', 'Đã xóa tài khoản người dùng'));
          void loadUsers();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Action failed', 'error');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleDeleteProject = (project: AdminProjectItem) => {
    setConfirmModal({
      isOpen: true,
      title: t('admin.projects.deleteConfirmTitle'),
      message: t('admin.projects.deleteConfirmMessage', {
        title: project.title,
        email: project.user_email,
      }),
      confirmText: t('admin.projects.deleteProject'),
      isDangerous: true,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await adminService.deleteProject(project.id);
          if (selectedProjectId === project.id) {
            setSelectedProjectId(null);
            setProjectFiles([]);
          }
          showToast(t('admin.projects.projectDeleted', 'Đã xóa dự án'));
          void loadProjects();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Action failed', 'error');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleDeleteFile = (file: AdminFile) => {
    setConfirmModal({
      isOpen: true,
      title: t('admin.files.deleteConfirmTitle'),
      message: t('admin.files.deleteConfirmMessage', { name: file.file_name }),
      confirmText: t('admin.files.deleteFile'),
      isDangerous: true,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await adminService.deleteFile(file.id);
          if (selectedProjectId) {
            void loadProjectFiles(selectedProjectId, selectedProjectTitle);
          }
          showToast(t('admin.files.fileDeleted', 'Đã xoá tệp'));
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Action failed', 'error');
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleOpenSubtitles = async (file: AdminFile) => {
    setSelectedFileForSubtitles(file);
    setLoadingSubtitles(true);
    try {
      const res = await adminService.getFileSubtitles(file.id);
      setFileSubtitles(res.subtitles);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('admin.loadError'), 'error');
    } finally {
      setLoadingSubtitles(false);
    }
  };

  const handleDeleteSubtitles = async () => {
    if (!selectedFileForSubtitles) return;
    setDeletingSubtitles(true);
    try {
      await adminService.deleteSubtitles(selectedFileForSubtitles.id);
      setFileSubtitles([]);
      showToast(t('admin.subtitles.deleteSubtitles'));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setDeletingSubtitles(false);
    }
  };

  const handleSaveSystemConfig = async (quotas: SystemConfig['quotas']) => {
    setSavingSystemConfig(true);
    try {
      await adminService.updateSystemConfig({ quotas });
      updatePlanLimitsFromQuotas(quotas);
      showToast(t('admin.system.configSaved'));
      void loadSystemConfig();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save config', 'error');
    } finally {
      setSavingSystemConfig(false);
    }
  };

  if (profile?.role !== 'admin') return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--ui-bg)] text-[var(--ui-text)]">
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <AdminHeader
          activeTab={activeTab}
          onToggleMobileMenu={() => setMobileSidebarOpen((v) => !v)}
        />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <AdminOverviewTab
              overview={overview}
              loading={loadingOverview}
              onRefresh={() => void loadOverview()}
            />
          )}

          {activeTab === 'users' && (
            <AdminUsersTab
              users={users}
              totalUsers={totalUsers}
              loading={loadingUsers}
              page={usersPage}
              search={usersSearch}
              subTab={userSubTab}
              currentAdminId={profile.id}
              onPageChange={setUsersPage}
              onSearchChange={setUsersSearch}
              onSubTabChange={setUserSubTab}
              onRefresh={() => void loadUsers()}
              onBanUser={handleBanUser}
              onUnbanUser={handleUnbanUser}
              onToggleRole={handleToggleRole}
              onResetQuota={handleResetQuota}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {activeTab === 'projects' && (
            <AdminProjectsTab
              projects={projects}
              totalProjects={totalProjects}
              loading={loadingProjects}
              page={projectsPage}
              search={projectsSearch}
              selectedProjectId={selectedProjectId}
              selectedProjectTitle={selectedProjectTitle}
              projectFiles={projectFiles}
              loadingProjectFiles={loadingProjectFiles}
              onPageChange={setProjectsPage}
              onSearchChange={setProjectsSearch}
              onRefresh={() => void loadProjects()}
              onSelectProject={(id, title) => void loadProjectFiles(id, title)}
              onCloseProjectFiles={() => setSelectedProjectId(null)}
              onDeleteProject={handleDeleteProject}
              onOpenSubtitles={(file) => void handleOpenSubtitles(file)}
              onDeleteFile={handleDeleteFile}
            />
          )}

          {activeTab === 'system' && (
            <AdminSystemConfigTab
              systemConfig={systemConfig}
              loading={loadingSystemConfig}
              saving={savingSystemConfig}
              onSave={handleSaveSystemConfig}
            />
          )}

          {activeTab === 'audit_logs' && (
            <AdminAuditLogsTab
              logs={auditLogs}
              totalLogs={totalAuditLogs}
              loading={loadingAuditLogs}
              page={auditLogsPage}
              onPageChange={setAuditLogsPage}
              onRefresh={() => void loadAuditLogs()}
              onSelectLog={setSelectedLogForDetails}
            />
          )}
        </main>
      </div>

      <ConfirmDialog
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDangerous={confirmModal.isDangerous}
        loading={confirmLoading}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <SubtitleViewerModal
        isOpen={Boolean(selectedFileForSubtitles)}
        fileName={selectedFileForSubtitles?.file_name || ''}
        subtitles={fileSubtitles}
        loading={loadingSubtitles}
        deleting={deletingSubtitles}
        onDeleteSubtitles={handleDeleteSubtitles}
        onClose={() => setSelectedFileForSubtitles(null)}
      />

      <AuditLogDetailModal
        isOpen={Boolean(selectedLogForDetails)}
        log={selectedLogForDetails}
        onClose={() => setSelectedLogForDetails(null)}
      />

      <AdminToaster toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
