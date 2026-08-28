import React from 'react';
import {
  FileText,
  FileVideo,
  FolderKanban,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminFile, AdminProjectItem } from '../../../services/adminService';
import { formatAdminDuration } from '../../../utils/time';
import { formatDate } from '../adminUtils';

const PAGE_SIZE = 15;

interface AdminProjectsTabProps {
  projects: AdminProjectItem[];
  totalProjects: number;
  loading: boolean;
  page: number;
  search: string;
  selectedProjectId: string | null;
  selectedProjectTitle: string;
  projectFiles: AdminFile[];
  loadingProjectFiles: boolean;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  onSelectProject: (projectId: string, projectTitle: string) => void;
  onCloseProjectFiles: () => void;
  onDeleteProject: (project: AdminProjectItem) => void;
  onOpenSubtitles: (file: AdminFile) => void;
  onDeleteFile: (file: AdminFile) => void;
}

export const AdminProjectsTab: React.FC<AdminProjectsTabProps> = ({
  projects,
  totalProjects,
  loading,
  page,
  search,
  selectedProjectId,
  selectedProjectTitle,
  projectFiles,
  loadingProjectFiles,
  onPageChange,
  onSearchChange,
  onRefresh,
  onSelectProject,
  onCloseProjectFiles,
  onDeleteProject,
  onOpenSubtitles,
  onDeleteFile,
}) => {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalProjects / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">
            {t('admin.projects.headerTitle')}
          </h2>
          <p className="text-xs ui-muted mt-0.5">{t('admin.projects.desc')}</p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="ui-button ui-button-secondary ui-button-compact self-start sm:self-auto"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('admin.refresh')}</span>
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
          placeholder={t('admin.projects.searchPlaceholder')}
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--ui-surface-subtle)] text-xs ui-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">{t('admin.projects.title')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.projects.owner')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.projects.language')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.projects.filesCount')}</th>
                <th className="px-5 py-3 font-semibold">{t('admin.projects.createdAt')}</th>
                <th className="px-5 py-3 font-semibold text-right">{t('admin.projects.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center ui-muted">
                    <Loader2 className="size-5 animate-spin mx-auto text-[var(--ui-accent)]" />
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center ui-muted text-xs">
                    {t('admin.projects.noProjects')}
                  </td>
                </tr>
              ) : (
                projects.map((proj) => {
                  const isSelected = selectedProjectId === proj.id;
                  return (
                    <tr
                      key={proj.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-[var(--ui-accent-soft)]/50'
                          : 'hover:bg-[var(--ui-surface-subtle)]/60'
                      }`}
                    >
                      <td className="px-5 py-3.5 font-semibold text-[var(--ui-text)]">
                        {proj.title}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-xs text-[var(--ui-text)]">
                          {proj.user_name}
                        </div>
                        <div className="text-[11px] ui-muted font-mono">{proj.user_email}</div>
                      </td>
                      <td className="px-5 py-3.5 text-xs uppercase font-mono text-[var(--ui-accent)]">
                        {proj.target_language}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold">{proj.files_count}</td>
                      <td className="px-5 py-3.5 text-xs ui-muted">
                        {formatDate(proj.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectProject(proj.id, proj.title)}
                            className={`ui-button ui-button-compact text-xs ${
                              isSelected ? 'ui-button-primary' : 'ui-button-secondary'
                            }`}
                          >
                            <FolderKanban className="size-3.5" />
                            <span>{t('admin.projects.viewFiles')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteProject(proj)}
                            className="ui-icon-button ui-icon-button-sm text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)]"
                            title={t('admin.projects.deleteProject')}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
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

      {selectedProjectId && (
        <div className="ui-card p-5 space-y-4 border-2 border-[var(--ui-accent)]/40 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] pb-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <FileVideo className="size-4 text-[var(--ui-accent)]" />
              <span>
                {t('admin.projects.filesInProject', { title: selectedProjectTitle })}
              </span>
            </div>
            <button
              type="button"
              onClick={onCloseProjectFiles}
              className="ui-button ui-button-ghost ui-button-compact text-xs flex items-center gap-1.5"
            >
              <span className="font-bold">✕</span>
              <span>{t('admin.actions.close')}</span>
            </button>
          </div>

          {loadingProjectFiles ? (
            <div className="py-8 flex justify-center ui-muted">
              <Loader2 className="size-5 animate-spin text-[var(--ui-accent)]" />
            </div>
          ) : projectFiles.length === 0 ? (
            <p className="text-xs ui-muted text-center py-6">
              {t('admin.projects.noFilesInProject')}
            </p>
          ) : (
            <div className="space-y-2">
              {projectFiles.map((file) => (
                <div
                  key={file.id}
                  className="ui-card-flat p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-[var(--ui-text)] truncate">
                      {file.file_name}
                    </div>
                    <div className="text-[11px] ui-muted mt-0.5 flex gap-2 flex-wrap">
                      <span>{formatAdminDuration(file.duration_seconds)}</span>
                      <span>·</span>
                      <span>Lang: {file.detected_source_lang || '—'}</span>
                      <span>·</span>
                      <span
                        className={`font-semibold ${
                          file.status === 'completed'
                            ? 'text-emerald-500'
                            : file.status === 'failed'
                              ? 'text-[var(--ui-danger)]'
                              : 'text-amber-500'
                        }`}
                      >
                        {file.status}
                      </span>
                      <span>·</span>
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                    {file.error_message && (
                      <p className="text-[11px] text-[var(--ui-danger)] mt-1 truncate">
                        {file.error_message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenSubtitles(file)}
                      className="ui-button ui-button-secondary ui-button-compact text-xs"
                    >
                      <FileText className="size-3.5 text-[var(--ui-accent)]" />
                      <span>{t('admin.files.viewSubtitles')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteFile(file)}
                      className="ui-icon-button ui-icon-button-sm text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)]"
                      title={t('admin.files.deleteFile')}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
