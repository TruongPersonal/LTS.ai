import React from 'react';
import { FileText, FileVideo, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminFile } from '../../../services/adminService';
import { formatAdminDuration } from '../../../utils/time';
import { formatDate } from '../adminUtils';

interface AdminProjectFileListProps {
  selectedProjectTitle: string;
  projectFiles: AdminFile[];
  loadingProjectFiles: boolean;
  onCloseProjectFiles: () => void;
  onOpenSubtitles: (file: AdminFile) => void;
  onDeleteFile: (file: AdminFile) => void;
}

export const AdminProjectFileList: React.FC<AdminProjectFileListProps> = ({
  selectedProjectTitle,
  projectFiles,
  loadingProjectFiles,
  onCloseProjectFiles,
  onOpenSubtitles,
  onDeleteFile,
}) => {
  const { t } = useTranslation();

  return (
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
                  aria-label={t('admin.files.deleteFile')}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
