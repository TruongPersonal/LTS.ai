import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileVideo, FolderKanban, Loader2, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ModalWrapper } from '../components/common/ModalWrapper';
import { useAuth } from '../hooks/useAuth';
import { adminService, type AdminOverview, type AdminUser, type AdminUserDetail } from '../services/adminService';
import { PLAN_ORDER, type Plan } from '../types/database';

const PAGE_SIZE = 20;

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds || seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pendingPlanChange, setPendingPlanChange] = useState<{ user: AdminUser; plan: Plan } | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      setOverview(await adminService.getOverview());
    } catch (loadError) {
      setError(getErrorMessage(loadError, t('admin.loadError')));
    } finally {
      setLoadingOverview(false);
    }
  }, [t]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const result = await adminService.listUsers(search, page, PAGE_SIZE);
      setUsers(result.users);
      setTotalUsers(result.total);
    } catch (loadError) {
      setError(getErrorMessage(loadError, t('admin.loadError')));
    } finally {
      setLoadingUsers(false);
    }
  }, [page, search, t]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const pageLabel = t('admin.page', { current: page, total: totalPages });

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    await Promise.all([loadOverview(), loadUsers()]);
    setRefreshing(false);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const openUserDetail = async (userId: string) => {
    setSelectedUserId(userId);
    setSelectedUser(null);
    setLoadingDetail(true);
    try {
      setSelectedUser(await adminService.getUserDetail(userId));
    } catch (loadError) {
      setError(getErrorMessage(loadError, t('admin.loadError')));
      setSelectedUserId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const confirmPlanChange = async () => {
    if (!pendingPlanChange) return;
    setSavingPlan(true);
    setError(null);
    try {
      await adminService.setUserPlan(pendingPlanChange.user.id, pendingPlanChange.plan);
      await Promise.all([loadOverview(), loadUsers()]);
      if (selectedUserId === pendingPlanChange.user.id) {
        setSelectedUser(await adminService.getUserDetail(selectedUserId));
      }
    } catch (updateError) {
      setError(getErrorMessage(updateError, t('admin.updateError')));
    } finally {
      setSavingPlan(false);
      setPendingPlanChange(null);
    }
  };

  const planNames = useMemo(
    () => Object.fromEntries(PLAN_ORDER.map((plan) => [plan, t(`subscription.plans.${plan}.name`)])) as Record<Plan, string>,
    [t]
  );

  if (profile?.role !== 'admin') return null;

  return (
    <div className="workspace-page ui-container py-9 sm:py-12 space-y-8">
      <section className="workspace-page-header">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-accent)]">
            <ShieldCheck className="size-4" />
            <span>{t('admin.badge')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.035em] mt-2">{t('admin.title')}</h1>
          <p className="text-sm sm:text-base ui-muted mt-2 leading-relaxed">{t('admin.description')}</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={refreshing} className="ui-button ui-button-secondary shrink-0">
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{t('admin.refresh')}</span>
        </button>
      </section>

      {error && <div className="ui-status-error p-3 text-xs" role="alert">{error}</div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="ui-card p-5 space-y-3">
          <div className="flex items-center justify-between"><span className="text-xs ui-muted">{t('admin.users')}</span><Users className="size-4 text-[var(--ui-accent)]" /></div>
          <div className="text-3xl font-extrabold">{loadingOverview ? '—' : overview?.users.total ?? 0}</div>
          <div className="text-xs ui-muted flex flex-wrap gap-x-3 gap-y-1">
            <span>{planNames.free}: {overview?.users.by_plan.free ?? 0}</span>
            <span>{planNames.pro}: {overview?.users.by_plan.pro ?? 0}</span>
            <span>{planNames.max}: {overview?.users.by_plan.max ?? 0}</span>
          </div>
        </div>
        <div className="ui-card p-5 space-y-3">
          <div className="flex items-center justify-between"><span className="text-xs ui-muted">{t('admin.projects')}</span><FolderKanban className="size-4 text-[var(--ui-accent)]" /></div>
          <div className="text-3xl font-extrabold">{loadingOverview ? '—' : overview?.projects.total ?? 0}</div>
          <div className="text-xs ui-muted">{t('admin.total')}</div>
        </div>
        <div className="ui-card p-5 space-y-3">
          <div className="flex items-center justify-between"><span className="text-xs ui-muted">{t('admin.files')}</span><FileVideo className="size-4 text-[var(--ui-accent)]" /></div>
          <div className="text-3xl font-extrabold">{loadingOverview ? '—' : overview?.files.total ?? 0}</div>
          <div className="text-xs ui-muted">{t('admin.completedFiles')}: {overview?.files.completed ?? 0} · {t('admin.failedFiles')}: {overview?.files.failed ?? 0}</div>
        </div>
        <div className="ui-card p-5 space-y-3">
          <div className="flex items-center justify-between"><span className="text-xs ui-muted">{t('admin.planBreakdown')}</span><ShieldCheck className="size-4 text-[var(--ui-accent)]" /></div>
          <div className="space-y-2 text-xs">
            {PLAN_ORDER.map((plan) => {
              const count = overview?.users.by_plan[plan] ?? 0;
              const total = overview?.users.total || 1;
              return <div key={plan} className="flex items-center gap-2"><span className="w-10 font-semibold">{planNames[plan]}</span><div className="h-1.5 flex-1 rounded-full bg-[var(--ui-surface-subtle)] overflow-hidden"><div className="h-full rounded-full bg-[var(--ui-accent)]" style={{ width: `${Math.min(100, (count / total) * 100)}%` }} /></div><span className="w-6 text-right ui-muted">{count}</span></div>;
            })}
          </div>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[var(--ui-border)] space-y-4">
          <div>
            <h2 className="text-lg font-extrabold">{t('admin.userList')}</h2>
            <p className="text-xs ui-muted mt-1">{t('admin.userListDescription')}</p>
          </div>
          <form onSubmit={submitSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 ui-soft pointer-events-none" />
              <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('admin.searchPlaceholder')} className="ui-input pl-10" />
            </div>
            <button type="submit" className="ui-button ui-button-secondary">{t('admin.search')}</button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--ui-surface-subtle)] text-xs ui-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">{t('admin.user')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.plan')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.role')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.dailyUsage')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.createdAt')}</th>
                <th className="px-5 py-3 font-semibold text-right">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border)]">
              {loadingUsers ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center ui-muted"><Loader2 className="size-5 animate-spin mx-auto" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center ui-muted">{t('admin.noUsers')}</td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className="hover:bg-[var(--ui-surface-subtle)]/60">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-[var(--ui-text)]">{user.full_name || '—'}</div>
                    <div className="text-xs ui-muted mt-0.5">{user.email}</div>
                  </td>
                  <td className="px-5 py-4">
                    <select value={user.plan} onChange={(event) => setPendingPlanChange({ user, plan: event.target.value as Plan })} className="ui-select ui-select-compact w-28">
                      {PLAN_ORDER.map((plan) => <option key={plan} value={plan}>{planNames[plan]}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-4 text-xs">{user.role === 'admin' ? t('admin.adminRole') : t('admin.userRole')}</td>
                  <td className="px-5 py-4 text-xs">{formatDuration(user.daily_processed_seconds)}</td>
                  <td className="px-5 py-4 text-xs ui-muted">{formatDate(user.created_at)}</td>
                  <td className="px-5 py-4 text-right"><button type="button" onClick={() => void openUserDetail(user.id)} className="ui-button ui-button-ghost ui-button-compact">{t('admin.viewDetails')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-t border-[var(--ui-border)]">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loadingUsers} className="ui-button ui-button-secondary ui-button-compact">{t('admin.previousPage')}</button>
          <span className="text-xs ui-muted">{pageLabel}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loadingUsers} className="ui-button ui-button-secondary ui-button-compact">{t('admin.nextPage')}</button>
        </div>
      </section>

      <ModalWrapper
        isOpen={Boolean(selectedUserId)}
        onClose={() => { setSelectedUserId(null); setSelectedUser(null); }}
        title={t('admin.detailTitle')}
        subtitle={selectedUser?.profile.email}
        icon={<Users className="size-4" />}
        maxWidth="2xl"
      >
        {loadingDetail || !selectedUser ? (
          <div className="py-12 flex justify-center"><Loader2 className="size-5 animate-spin text-[var(--ui-accent)]" /></div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="ui-card-flat p-3"><div className="ui-muted">{t('admin.plan')}</div><div className="font-bold mt-1">{planNames[selectedUser.profile.plan]}</div></div>
              <div className="ui-card-flat p-3"><div className="ui-muted">{t('admin.role')}</div><div className="font-bold mt-1">{selectedUser.profile.role === 'admin' ? t('admin.adminRole') : t('admin.userRole')}</div></div>
              <div className="ui-card-flat p-3"><div className="ui-muted">{t('admin.projects')}</div><div className="font-bold mt-1">{selectedUser.projects.length}</div></div>
              <div className="ui-card-flat p-3"><div className="ui-muted">{t('admin.files')}</div><div className="font-bold mt-1">{selectedUser.files.length}</div></div>
            </div>
            <div>
              <h3 className="text-sm font-extrabold mb-3">{t('admin.projects')}</h3>
              {selectedUser.projects.length === 0 ? <p className="text-xs ui-muted">{t('admin.noProjects')}</p> : <div className="space-y-2">{selectedUser.projects.map((project) => <div key={project.id} className="ui-card-flat p-3 flex items-center justify-between gap-3"><div><div className="text-sm font-semibold">{project.title}</div><div className="text-xs ui-muted mt-0.5">{project.target_language} · {formatDate(project.created_at)}</div></div><span className="text-xs ui-muted">{selectedUser.files.filter((file) => file.project_id === project.id).length} {t('admin.files').toLowerCase()}</span></div>)}</div>}
            </div>
            <div>
              <h3 className="text-sm font-extrabold mb-3">{t('admin.files')}</h3>
              {selectedUser.files.length === 0 ? <p className="text-xs ui-muted">{t('admin.noFiles')}</p> : <div className="space-y-2 max-h-64 overflow-y-auto">{selectedUser.files.map((file) => <div key={file.id} className="ui-card-flat p-3"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold truncate">{file.file_name}</div><span className="text-xs shrink-0">{t(`media.status.${file.status}`)}</span></div><div className="text-xs ui-muted mt-1">{formatDuration(file.duration_seconds)} · {file.input_source} · {formatDate(file.created_at)}</div>{file.error_message && <div className="text-xs text-[var(--ui-danger)] mt-1 truncate">{file.error_message}</div>}</div>)}</div>}
            </div>
          </div>
        )}
      </ModalWrapper>

      {pendingPlanChange && pendingPlanChange.plan !== pendingPlanChange.user.plan && (
        <ConfirmDialog
          isOpen
          onClose={() => { if (!savingPlan) setPendingPlanChange(null); }}
          onConfirm={confirmPlanChange}
          loading={savingPlan}
          title={t('admin.changePlanTitle')}
          message={t('admin.changePlanMessage', { email: pendingPlanChange.user.email, from: planNames[pendingPlanChange.user.plan], to: planNames[pendingPlanChange.plan] })}
          confirmText={t('admin.changePlanAction')}
          type="info"
        />
      )}
    </div>
  );
};
