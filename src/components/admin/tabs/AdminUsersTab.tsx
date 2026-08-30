import React, { useMemo } from 'react';
import {
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminUser } from '../../../services/adminService';
import { PLAN_ORDER, type Plan } from '../../../types/database';
import { formatAdminDuration } from '../../../utils/time';
import { formatDate } from '../adminUtils';

const PAGE_SIZE = 15;

interface AdminUsersTabProps {
  users: AdminUser[];
  totalUsers: number;
  loading: boolean;
  page: number;
  search: string;
  subTab: 'users' | 'admins';
  currentAdminId?: string;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onSubTabChange: (subTab: 'users' | 'admins') => void;
  onRefresh: () => void;
  onPromoteAdmin: (user: AdminUser) => void;
  onDeleteUser: (user: AdminUser) => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  totalUsers,
  loading,
  page,
  search,
  subTab,
  currentAdminId,
  onPageChange,
  onSearchChange,
  onSubTabChange,
  onRefresh,
  onPromoteAdmin,
  onDeleteUser,
}) => {
  const { t } = useTranslation();

  const planNames = useMemo(
    () =>
      Object.fromEntries(
        PLAN_ORDER.map((plan) => [plan, t(`subscription.plans.${plan}.name`)])
      ) as Record<Plan, string>,
    [t]
  );

  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">{t('admin.users.title')}</h2>
          <p className="text-xs ui-muted mt-0.5">{t('admin.users.desc')}</p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="ui-button ui-button-secondary ui-button-compact w-full sm:w-auto justify-center"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('admin.refresh')}</span>
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-[var(--ui-border)] pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            onSubTabChange('users');
            onPageChange(1);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            subTab === 'users'
              ? 'bg-[var(--ui-accent)] text-white shadow-xs'
              : 'ui-muted hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface-subtle)]'
          }`}
        >
          <Users className="size-3.5" />
          <span>{t('admin.users.tabRegularUsers')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onSubTabChange('admins');
            onPageChange(1);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            subTab === 'admins'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'ui-muted hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface-subtle)]'
          }`}
        >
          <Shield className="size-3.5" />
          <span>{t('admin.users.tabAdmins')}</span>
        </button>
      </div>

      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 ui-soft pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value);
            onPageChange(1);
          }}
          placeholder={t('admin.users.searchPlaceholder')}
          className="ui-input ui-search-input text-xs"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onPageChange(1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs ui-muted hover:text-[var(--ui-text)] font-bold"
          >
            ✕
          </button>
        )}
      </div>

      <div className="ui-card overflow-hidden">
        {/* Mobile Card List View (< 768px) */}
        <div className="md:hidden divide-y divide-[var(--ui-border)]">
          {loading ? (
            <div className="p-8 text-center ui-muted">
              <Loader2 className="size-5 animate-spin mx-auto text-[var(--ui-accent)]" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center ui-muted text-xs">
              {subTab === 'admins'
                ? t('admin.users.noAdmins')
                : t('admin.users.noUsers')}
            </div>
          ) : (
            users.map((user) => (
              <div key={user.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[var(--ui-text)] truncate">
                      {user.full_name || '—'}
                    </div>
                    <div className="text-xs ui-muted font-mono truncate">{user.email}</div>
                  </div>
                  {subTab === 'users' && (
                    <span
                      className={`ui-badge ui-badge-compact font-bold shrink-0 ${
                        user.plan === 'max'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : user.plan === 'pro'
                            ? 'ui-badge-accent'
                            : ''
                      }`}
                    >
                      {planNames[user.plan]}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[var(--ui-border)]/50">
                  <div>
                    <span className="ui-muted block text-[10px] uppercase font-semibold">{t('admin.users.createdAt')}</span>
                    <span className="font-mono text-xs">{formatDate(user.created_at)}</span>
                  </div>
                  {subTab === 'users' && (
                    <div>
                      <span className="ui-muted block text-[10px] uppercase font-semibold">{t('admin.users.dailyUsage')}</span>
                      <span className="font-mono text-xs">{formatAdminDuration(user.daily_processed_seconds)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--ui-border)]/40">
                  {subTab === 'users' && (
                    <button
                      type="button"
                      onClick={() => onPromoteAdmin(user)}
                      className="ui-button ui-button-secondary ui-button-compact text-purple-400 hover:bg-purple-500/10 flex items-center gap-1.5"
                    >
                      <UserCheck className="size-3.5" />
                      <span>{t('admin.users.makeAdmin')}</span>
                    </button>
                  )}

                  {user.id !== currentAdminId && (
                    <button
                      type="button"
                      onClick={() => onDeleteUser(user)}
                      className="ui-button ui-button-secondary ui-button-compact text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)] flex items-center gap-1.5"
                    >
                      <Trash2 className="size-3.5" />
                      <span>{t('admin.users.deleteUser')}</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-[var(--ui-surface-subtle)] text-xs ui-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">{t('admin.users.user')}</th>
                {subTab === 'users' && (
                  <th className="px-5 py-3 font-semibold">{t('admin.users.plan')}</th>
                )}
                {subTab === 'users' && (
                  <th className="px-5 py-3 font-semibold">{t('admin.users.dailyUsage')}</th>
                )}
                <th className="px-5 py-3 font-semibold">{t('admin.users.createdAt')}</th>
                <th className="px-5 py-3 font-semibold text-right">{t('admin.users.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center ui-muted">
                    <Loader2 className="size-5 animate-spin mx-auto text-[var(--ui-accent)]" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center ui-muted text-xs">
                    {subTab === 'admins'
                      ? t('admin.users.noAdmins')
                      : t('admin.users.noUsers')}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-[var(--ui-surface-subtle)]/60 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[var(--ui-text)]">
                        {user.full_name || '—'}
                      </div>
                      <div className="text-xs ui-muted font-mono">{user.email}</div>
                    </td>

                    {subTab === 'users' && (
                      <td className="px-5 py-3.5">
                        <span
                          className={`ui-badge ui-badge-compact font-bold ${
                            user.plan === 'max'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : user.plan === 'pro'
                                ? 'ui-badge-accent'
                                : ''
                          }`}
                        >
                          {planNames[user.plan]}
                        </span>
                      </td>
                    )}

                    {subTab === 'users' && (
                      <td className="px-5 py-3.5 text-xs font-mono">
                        {formatAdminDuration(user.daily_processed_seconds)}
                      </td>
                    )}

                    <td className="px-5 py-3.5 text-xs ui-muted">
                      {formatDate(user.created_at)}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {subTab === 'users' && (
                          <button
                            type="button"
                            onClick={() => onPromoteAdmin(user)}
                            className="ui-icon-button ui-icon-button-sm text-purple-400 hover:bg-purple-500/10"
                            aria-label={t('admin.users.makeAdmin')}
                          >
                            <UserCheck className="size-3.5" />
                          </button>
                        )}

                        {user.id !== currentAdminId && (
                          <button
                            type="button"
                            onClick={() => onDeleteUser(user)}
                            className="ui-icon-button ui-icon-button-sm text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)]"
                            aria-label={t('admin.users.deleteUser')}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-[var(--ui-border)] text-xs">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
            className="ui-button ui-button-secondary ui-button-compact"
          >
            {t('admin.pagination.previous')}
          </button>
          <span className="ui-muted">
            {t('admin.pagination.page', { current: page, total: totalPages })}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
            className="ui-button ui-button-secondary ui-button-compact"
          >
            {t('admin.pagination.next')}
          </button>
        </div>
      </div>
    </div>
  );
};
