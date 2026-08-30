import React from 'react';
import { Eye, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminAuditLog } from '../../../services/adminService';
import { formatDateTime, getActionBadgeClass } from '../adminUtils';

const PAGE_SIZE = 15;

interface AdminAuditLogsTabProps {
  logs: AdminAuditLog[];
  totalLogs: number;
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onSelectLog: (log: AdminAuditLog) => void;
}

export const AdminAuditLogsTab: React.FC<AdminAuditLogsTabProps> = ({
  logs,
  totalLogs,
  loading,
  page,
  onPageChange,
  onRefresh,
  onSelectLog,
}) => {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">{t('admin.logs.title')}</h2>
          <p className="text-xs ui-muted mt-0.5">{t('admin.logs.description')}</p>
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

      <div className="ui-card overflow-hidden">
        {/* Mobile Card List View (< 768px) */}
        <div className="md:hidden divide-y divide-[var(--ui-border)]">
          {loading ? (
            <div className="p-8 text-center ui-muted">
              <Loader2 className="size-5 animate-spin mx-auto text-[var(--ui-accent)]" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center ui-muted text-xs">
              {t('admin.logs.noLogs')}
            </div>
          ) : (
            logs.map((log) => {
              const actorEmail = String(
                (log.new_value as Record<string, unknown> | null)?.actor_email ||
                  log.actor_user_id ||
                  '—'
              );

              const getTargetDisplay = () => {
                const details = (log.new_value || log.old_value || {}) as Record<
                  string,
                  unknown
                >;
                if (details.target_email) return String(details.target_email);
                if (details.project_title) return `Dự án: ${details.project_title}`;
                if (details.file_name) return `Tệp: ${details.file_name}`;
                if (log.target_user_id)
                  return `User ID: ${log.target_user_id.slice(0, 8)}...`;
                return t('admin.logs.systemTarget', 'Toàn hệ thống');
              };

              return (
                <div key={log.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${getActionBadgeClass(log.action)}`}
                    >
                      {log.action}
                    </span>
                    <span className="text-[11px] font-mono ui-muted">
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <div>
                      <span className="ui-muted text-[10px] uppercase font-semibold block">{t('admin.logs.actor')}</span>
                      <span className="font-mono font-medium text-[var(--ui-text)]">{actorEmail}</span>
                    </div>
                    <div>
                      <span className="ui-muted text-[10px] uppercase font-semibold block">{t('admin.logs.target')}</span>
                      <span className="font-medium text-[var(--ui-text)]">{getTargetDisplay()}</span>
                    </div>
                  </div>

                  <div className="pt-1.5 flex justify-end border-t border-[var(--ui-border)]/40">
                    <button
                      type="button"
                      onClick={() => onSelectLog(log)}
                      className="ui-button ui-button-secondary ui-button-compact text-xs flex items-center gap-1.5"
                    >
                      <Eye className="size-3.5" />
                      <span>{t('admin.logs.viewDetails', 'Xem chi tiết')}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--ui-surface-subtle)] text-xs ui-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">{t('admin.logs.time')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.logs.actor')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.logs.action')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.logs.target')}</th>
                <th className="px-5 py-3 font-semibold text-right">{t('admin.logs.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center ui-muted">
                    <Loader2 className="size-5 animate-spin mx-auto text-[var(--ui-accent)]" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center ui-muted text-xs">
                    {t('admin.logs.noLogs')}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actorEmail = String(
                    (log.new_value as Record<string, unknown> | null)?.actor_email ||
                      log.actor_user_id ||
                      '—'
                  );

                  const getTargetDisplay = () => {
                    const details = (log.new_value || log.old_value || {}) as Record<
                      string,
                      unknown
                    >;
                    if (details.target_email) return String(details.target_email);
                    if (details.project_title) return `Dự án: ${details.project_title}`;
                    if (details.file_name) return `Tệp: ${details.file_name}`;
                    if (log.target_user_id)
                      return `User ID: ${log.target_user_id.slice(0, 8)}...`;
                    return t('admin.logs.systemTarget', 'Toàn hệ thống');
                  };

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[var(--ui-surface-subtle)]/60 transition-colors"
                    >
                      <td className="px-5 py-3 text-xs font-mono ui-muted whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold text-[var(--ui-text)] font-mono">
                        {actorEmail}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${getActionBadgeClass(log.action)}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-[var(--ui-text)] max-w-xs truncate">
                        <span className="font-medium">{getTargetDisplay()}</span>
                      </td>
                      <td className="px-5 py-3 text-xs whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => onSelectLog(log)}
                          className="ui-button ui-button-secondary ui-button-compact inline-flex items-center gap-1.5"
                        >
                          <Eye className="size-3.5" />
                          <span>{t('admin.logs.viewDetails', 'Xem chi tiết')}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
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
