import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Download, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { FileMedia } from '../../types/database';
import type { ProcessingProgress } from '../../types/processing';
import { formatMimeTypeLabel } from '../../utils/mediaFormat';
import { formatDuration } from '../../utils/time';
import { FileStatusBadge } from './FileStatusBadge';
import { FileProgressBar } from './FileProgressBar';

interface FileRowProps {
  file: FileMedia;
  completed: boolean;
  progress?: ProcessingProgress;
  onOpen: () => void;
  onExport: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export const FileRow: React.FC<FileRowProps> = ({
  file,
  completed,
  progress,
  onOpen,
  onExport,
  onRename,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isLiveProcessing = Boolean(progress && !['completed', 'failed'].includes(progress.stage));
  const effectiveStatus: FileMedia['status'] =
    progress?.stage === 'completed'
      ? 'completed'
      : progress?.stage === 'failed'
      ? 'failed'
      : progress?.stage === 'queued' || file.status === 'queued'
      ? 'queued'
      : isLiveProcessing
      ? 'processing'
      : file.status;

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  return (
    <article className="file-workspace-row">
      <div className="flex items-start gap-3 min-w-0 flex-1 w-full">
        <div className="file-type-icon shrink-0">
          {completed ? <CheckCircle2 className="size-5" /> : <Clock className="size-5" />}
        </div>
        <div className="min-w-0 flex-1 w-full">
          <div className="flex flex-wrap items-center gap-2 min-w-0 w-full">
            <h4 className="text-sm font-bold truncate max-w-full" title={file.file_name}>
              {file.file_name}
            </h4>
            <FileStatusBadge status={effectiveStatus} />
          </div>
          <p className="text-[11px] ui-muted mt-1">
            {formatMimeTypeLabel(file.mime_type)}
            {completed && file.duration_seconds && file.duration_seconds > 0
              ? ` • ${formatDuration(file.duration_seconds)}`
              : ''}
          </p>
          {file.status === 'failed' && file.error_message && (
            <p className="mt-1.5 text-[10px] text-[var(--ui-danger)] line-clamp-2">
              {file.error_message}
            </p>
          )}
          {!completed && <FileProgressBar progress={progress} />}
        </div>
      </div>

      <div className="file-row-actions">
        {file.status === 'completed' && (
          <button
            onClick={onOpen}
            disabled={isLiveProcessing}
            className="ui-button ui-button-primary"
          >
            <Pencil className="size-3.5" />
            <span>{t('media.edit')}</span>
          </button>
        )}

        <div className="file-row-menu relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((val) => !val)}
            disabled={isLiveProcessing}
            className="ui-icon-button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t('common.more')}
            title={t('common.more')}
          >
            <MoreHorizontal className="size-4" />
          </button>

          {menuOpen && (
            <div className="overflow-menu overflow-menu-right" role="menu">
              <button
                type="button"
                role="menuitem"
                disabled={isLiveProcessing}
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
              >
                <Pencil className="size-4" />
                {t('media.renameFile')}
              </button>

              {file.status === 'completed' && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onExport();
                  }}
                >
                  <Download className="size-4" />
                  {t('media.download')}
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                className="ui-danger-text"
                disabled={isLiveProcessing}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="size-4" />
                {t('media.delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

