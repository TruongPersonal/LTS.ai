import React from 'react';
import { AlertCircle, CheckCircle2, FileVideo, Loader2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModalWrapper } from '../common/ModalWrapper';

export type VideoExportStatus =
  | 'idle'
  | 'confirm'
  | 'preparing'
  | 'exporting'
  | 'canceling'
  | 'completed'
  | 'canceled'
  | 'error';

export interface VideoExportModalProps {
  isOpen: boolean;
  fileName: string;
  status: VideoExportStatus;
  progress: number;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const VideoExportModal: React.FC<VideoExportModalProps> = ({
  isOpen,
  fileName,
  status,
  progress,
  error,
  onClose,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const isConfirming = status === 'confirm';
  const isBusy = status === 'preparing' || status === 'exporting' || status === 'canceling';
  const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
  const handleClose = isBusy ? () => undefined : onClose;

  const statusContent = {
    idle: null,
    confirm: (
      <div className="space-y-2" role="status" aria-live="polite">
        <p className="text-sm font-semibold text-[var(--ui-text)]">
          {t('editor.videoExport.confirmMessage')}
        </p>
        <p className="text-sm ui-muted leading-relaxed">
          {t('editor.videoExport.confirmDescription')}
        </p>
      </div>
    ),
    preparing: (
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]" role="status" aria-live="polite">
        <Loader2 className="size-4 animate-spin text-[var(--ui-accent)]" aria-hidden="true" />
        <span>{t('editor.videoExport.preparing')}</span>
      </div>
    ),
    exporting: (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]">
          <Loader2 className="size-4 animate-spin text-[var(--ui-accent)]" aria-hidden="true" />
          <span>{t('editor.videoExport.exporting')}</span>
        </div>
        <div
          className="w-full space-y-1.5"
          role="progressbar"
          aria-label={t('editor.videoExport.exporting')}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="flex justify-end text-[10px] font-mono font-bold text-[var(--ui-accent)]">
            <span>{percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-px">
            <div
              className="h-full rounded-full bg-[var(--ui-accent)] transition-[width] duration-300 ease-out"
              style={{ width: String(percent) + '%' }}
            />
          </div>
        </div>
      </div>
    ),
    canceling: (
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]" role="status" aria-live="polite" aria-busy="true">
        <Loader2 className="size-4 animate-spin text-[var(--ui-accent)]" aria-hidden="true" />
        <span>{t('editor.videoExport.canceling')}</span>
      </div>
    ),
    completed: (
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-success)]" role="status" aria-live="polite">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        <span>{t('editor.videoExport.completed')}</span>
      </div>
    ),
    canceled: (
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]" role="status" aria-live="polite">
        <XCircle className="size-4 text-[var(--ui-muted)]" aria-hidden="true" />
        <span>{t('editor.videoExport.canceled')}</span>
      </div>
    ),
    error: (
      <div className="flex items-start gap-2 text-sm font-semibold text-[var(--ui-danger)]" role="alert">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{error || t('editor.videoExport.executionError')}</span>
      </div>
    ),
  }[status];

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={handleClose}
      title={t('editor.videoExport.title')}
      subtitle={fileName}
      icon={<FileVideo className="size-5" />}
      maxWidth="sm"
    >
      <div className="space-y-5">
        <div className="min-h-10">{statusContent}</div>

        {isConfirming && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--ui-border)] pt-4">
            <button type="button" onClick={onCancel} className="ui-button ui-button-secondary" data-autofocus>
              {t('editor.videoExport.cancel')}
            </button>
            <button type="button" onClick={onConfirm} className="ui-button ui-button-primary">
              {t('editor.videoExport.confirm')}
            </button>
          </div>
        )}

        {isBusy && (
          <div className="flex justify-end border-t border-[var(--ui-border)] pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={status === 'canceling'}
              className="ui-button ui-button-danger"
            >
              {status === 'canceling' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <span>
                {t(status === 'canceling' ? 'editor.videoExport.canceling' : 'editor.videoExport.cancel')}
              </span>
            </button>
          </div>
        )}

        {!isBusy && !isConfirming && status !== 'idle' && (
          <div className="flex justify-end border-t border-[var(--ui-border)] pt-4">
            <button type="button" onClick={handleClose} className="ui-button ui-button-primary" data-autofocus>
              {t('editor.videoExport.close')}
            </button>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};
