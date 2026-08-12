import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Download, Loader2, MoreHorizontal, Pencil, Trash2, XCircle, Zap } from 'lucide-react';
import type { FileMedia } from '../../types/database';
import type { ProcessingProgress } from '../../types/processing';
import { formatMimeTypeLabel } from '../../utils/mediaFormat';
import { ModalWrapper } from '../common/ModalWrapper';

interface FileListTabsProps {
  files: FileMedia[];
  processingProgressByFile: Record<string, ProcessingProgress>;
  onStartProcessAll: () => Promise<void>;
  onOpenFileEditor: (file: FileMedia) => void;
  onExportFile: (file: FileMedia) => void;
  onDeleteFile: (fileId: string) => Promise<void>;
  onRenameFile: (fileId: string, newFileName: string) => Promise<void>;
  onOpenDrivePicker: () => void;
  isProcessing?: boolean;
}

interface FileRowProps {
  file: FileMedia;
  completed: boolean;
  progress?: ProcessingProgress;
  isProcessing?: boolean;
  onOpen: () => void;
  onExport: () => void;
  onRename: () => void;
  onDelete: () => void;
  renderProgress: (file: FileMedia) => React.ReactNode;
  renderStatusBadge: (status: FileMedia['status']) => React.ReactNode;
  isLiveProgress: (progress?: ProcessingProgress) => boolean;
}


function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const totalSecs = Math.round(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const FileRow: React.FC<FileRowProps> = ({ file, completed, progress, onOpen, onExport, onRename, onDelete, renderProgress, renderStatusBadge, isLiveProgress }) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const effectiveStatus: FileMedia['status'] = progress?.stage === 'completed' ? 'completed' : progress?.stage === 'failed' ? 'failed' : ((progress?.stage === 'queued' || file.status === 'queued') ? 'queued' : (isLiveProgress(progress) ? 'processing' : file.status));

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, []);

  return (
    <article className="file-workspace-row">
      <div className="flex items-start gap-3 min-w-0 flex-1 w-full">
        <div className="file-type-icon shrink-0">{completed ? <CheckCircle2 className="size-5" /> : <Clock className="size-5" />}</div>
        <div className="min-w-0 flex-1 w-full">
          <div className="flex flex-wrap items-center gap-2 min-w-0 w-full">
            <h4 className="text-sm font-bold truncate max-w-full" title={file.file_name}>{file.file_name}</h4>
            {renderStatusBadge(effectiveStatus)}
          </div>
          <p className="text-[11px] ui-muted mt-1">
            {formatMimeTypeLabel(file.mime_type)}
            {file.duration_seconds && file.duration_seconds > 0 ? ` • ${formatDuration(file.duration_seconds)}` : ''}
          </p>
          {file.status === 'failed' && file.error_message && <p className="mt-1.5 text-[10px] text-[var(--ui-danger)] line-clamp-2">{file.error_message}</p>}
          {!completed && renderProgress(file)}
        </div>
      </div>

      <div className="file-row-actions">
        {file.status === 'completed' && <button onClick={onOpen} disabled={isLiveProgress(progress)} className="ui-button ui-button-primary"><Pencil className="size-3.5" /><span>{t('media.edit')}</span></button>}
        <div className="file-row-menu relative" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((value) => !value)} disabled={isLiveProgress(progress)} className="ui-icon-button" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={t('common.more')} title={t('common.more')}><MoreHorizontal className="size-4" /></button>
          {menuOpen && (
            <div className="overflow-menu overflow-menu-right" role="menu">
              <button type="button" role="menuitem" disabled={isLiveProgress(progress)} onClick={() => { setMenuOpen(false); onRename(); }}><Pencil className="size-4" />{t('media.renameFile')}</button>
              {file.status === 'completed' && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onExport(); }}><Download className="size-4" />{t('media.download')}</button>}
              <button type="button" role="menuitem" className="ui-danger-text" disabled={isLiveProgress(progress)} onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 className="size-4" />{t('media.delete')}</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export const FileListTabs: React.FC<FileListTabsProps> = ({ files, processingProgressByFile, onStartProcessAll, onOpenFileEditor, onExportFile, onDeleteFile, onRenameFile, isProcessing }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'unfinished' | 'completed'>('unfinished');
  const [processing, setProcessing] = useState(false);
  const [renamingFile, setRenamingFile] = useState<FileMedia | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renamingSubmitting, setRenamingSubmitting] = useState(false);

  const unfinishedFiles = files.filter((file) => file.status === 'draft' || file.status === 'queued' || file.status === 'processing');
  const completedFiles = files.filter((file) => file.status === 'completed' || file.status === 'failed');
  const processableFiles = unfinishedFiles.filter((file) => file.status === 'draft');

  const handleStartProcess = async () => { setProcessing(true); try { await onStartProcessAll(); } finally { setProcessing(false); } };
  const isLiveProgress = (progress?: ProcessingProgress) => Boolean(progress && !['completed', 'failed'].includes(progress.stage));

  const handleOpenRenameModal = (file: FileMedia) => {
    setRenamingFile(file);
    setRenameDraft(file.file_name);
  };

  const handleConfirmRename = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!renamingFile || !renameDraft.trim()) return;
    setRenamingSubmitting(true);
    try {
      await onRenameFile(renamingFile.id, renameDraft.trim());
      setRenamingFile(null);
    } catch (error) {
      console.error('Failed to rename file:', error);
    } finally {
      setRenamingSubmitting(false);
    }
  };

  const translatedProgressMessage = (progress: ProcessingProgress) => {
    const keyByStage: Partial<Record<ProcessingProgress['stage'], string>> = { queued: 'processing.preparing', preparing: 'processing.preparing', downloading: 'processing.downloading', preprocessing: 'processing.ffmpeg', transcribing: 'processing.transcribing', finalizing: 'processing.saving', completed: 'processing.completed' };
    const key = keyByStage[progress.stage];
    return key ? t(key) : progress.message;
  };

  const renderProgress = (file: FileMedia) => {
    const progress = processingProgressByFile[file.id];
    if (!progress || file.status === 'completed' || file.status === 'failed') return null;
    const isFailed = progress.stage === 'failed';
    return (
      <div className="mt-3 space-y-1.5 max-w-xl" role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-[10px]"><span className={isFailed ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-text-muted)]'}>{translatedProgressMessage(progress)}</span><span className="font-mono ui-muted shrink-0">{progress.percent}%</span></div>
        <div className="h-1.5 rounded-full bg-[var(--ui-surface-muted)] overflow-hidden"><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${progress.percent}%`, background: isFailed ? 'var(--ui-danger)' : 'linear-gradient(90deg, #6f5ce7 0%, #5f9de8 100%)' }} /></div>
        {progress.chunkCount && progress.chunkCount > 1 && progress.chunkIndex ? <p className="text-[10px] ui-soft">{t('processing.chunkLabel', { current: progress.chunkIndex, total: progress.chunkCount })}</p> : null}
      </div>
    );
  };

  const renderStatusBadge = (status: FileMedia['status']) => {
    if (status === 'draft') return <span className="ui-badge"><Clock className="size-3.5" />{t('media.status.draft')}</span>;
    if (status === 'queued') return <span className="ui-badge"><Clock className="size-3.5" />{t('media.status.queued')}</span>;
    if (status === 'processing') return <span className="ui-badge ui-badge-accent"><Loader2 className="size-3.5 animate-spin" />{t('media.status.processing')}</span>;
    if (status === 'completed') return <span className="ui-badge ui-badge-success"><CheckCircle2 className="size-3.5" />{t('media.status.completed')}</span>;
    return <span className="ui-badge ui-badge-danger"><XCircle className="size-3.5" />{t('media.status.failed')}</span>;
  };

  const shownFiles = activeTab === 'unfinished' ? unfinishedFiles : completedFiles;
  return (
    <section className="space-y-0">
      <div className="media-tabs-header">
        <div className="attached-tab-group">
          <button
            type="button"
            onClick={() => setActiveTab('unfinished')}
            className={`attached-tab ${activeTab === 'unfinished' ? 'attached-tab-active' : ''}`}
            title={t('media.tabs.unfinished')}
            aria-label={t('media.tabs.unfinished')}
          >
            <Clock className="size-4" />
            <span className="attached-tab-badge">{unfinishedFiles.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`attached-tab ${activeTab === 'completed' ? 'attached-tab-active' : ''}`}
            title={t('media.tabs.completed')}
            aria-label={t('media.tabs.completed')}
          >
            <CheckCircle2 className="size-4" />
            <span className="attached-tab-badge">{completedFiles.length}</span>
          </button>
        </div>

        {activeTab === 'unfinished' && processableFiles.length > 0 && !processing && !isProcessing && (
          <button
            type="button"
            onClick={handleStartProcess}
            disabled={processing || isProcessing}
            className="ui-button ui-button-secondary mb-1.5"
            title={t('media.startAll', { count: processableFiles.length })}
            aria-label={t('media.startAll', { count: processableFiles.length })}
          >
            {processing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          </button>
        )}
      </div>

      <div className="media-container-box">
        {shownFiles.length === 0 ? (
          <div className="workspace-empty-container">
            {activeTab === 'unfinished' ? t('media.emptyUnfinished') : t('media.emptyCompleted')}
          </div>
        ) : (
          <div className="media-workspace-list">
            {shownFiles.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                completed={activeTab === 'completed'}
                progress={processingProgressByFile[file.id]}
                isProcessing={isProcessing}
                onOpen={() => onOpenFileEditor(file)}
                onExport={() => onExportFile(file)}
                onRename={() => handleOpenRenameModal(file)}
                onDelete={() => void onDeleteFile(file.id)}
                renderProgress={renderProgress}
                renderStatusBadge={renderStatusBadge}
                isLiveProgress={isLiveProgress}
              />
            ))}
          </div>
        )}
      </div>

      {renamingFile && (
        <ModalWrapper
          isOpen={Boolean(renamingFile)}
          onClose={() => setRenamingFile(null)}
          title={t('media.renameModalTitle')}
          subtitle={t('media.renameModalSubtitle')}
          icon={<Pencil className="size-5" />}
          maxWidth="lg"
        >
          <form onSubmit={handleConfirmRename} className="space-y-5">
            <label className="block">
              <span className="block text-xs font-semibold mb-1.5">
                {t('media.drive.fileName')} <span className="text-[var(--ui-danger)]">*</span>
              </span>
              <input
                data-autofocus
                type="text"
                required
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                className="ui-input text-xs"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--ui-border)]">
              <button
                type="button"
                onClick={() => setRenamingFile(null)}
                disabled={renamingSubmitting}
                className="ui-button ui-button-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={!renameDraft.trim() || renamingSubmitting}
                className="ui-button ui-button-primary"
              >
                {renamingSubmitting && <Loader2 className="size-4 animate-spin" />}
                <span>{renamingSubmitting ? t('media.savingRename') : t('media.saveRename')}</span>
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}
    </section>
  );
};
