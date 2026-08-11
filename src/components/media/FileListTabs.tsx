import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Download, Edit, FileAudio, FileText, Loader2, MoreHorizontal, RotateCcw, Trash2, XCircle, Zap } from 'lucide-react';
import type { FileMedia } from '../../types/database';
import type { ProcessingProgress } from '../../types/processing';
import { formatDisplayTime } from '../../utils/time';

interface FileListTabsProps {
  files: FileMedia[];
  processingProgressByFile: Record<string, ProcessingProgress>;
  onStartProcessAll: () => Promise<void>;
  onOpenFileEditor: (file: FileMedia) => void;
  onRetryFile: (file: FileMedia) => Promise<void>;
  onExportFile: (file: FileMedia) => void;
  onDeleteFile: (fileId: string) => Promise<void>;
  onOpenDrivePicker: () => void;
}

interface FileRowProps {
  file: FileMedia;
  completed: boolean;
  progress?: ProcessingProgress;
  retrying: boolean;
  onOpen: () => void;
  onRetry: () => void;
  onExport: () => void;
  onDelete: () => void;
  renderProgress: (file: FileMedia) => React.ReactNode;
  renderStatusBadge: (status: FileMedia['status']) => React.ReactNode;
  isLiveProgress: (progress?: ProcessingProgress) => boolean;
}

const FileRow: React.FC<FileRowProps> = ({ file, completed, progress, retrying, onOpen, onRetry, onExport, onDelete, renderProgress, renderStatusBadge, isLiveProgress }) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const effectiveStatus: FileMedia['status'] = isLiveProgress(progress) ? 'processing' : file.status;

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, []);

  return (
    <article className="file-workspace-row">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="file-type-icon">{completed ? <CheckCircle2 className="size-5" /> : file.mime_type.startsWith('video/') ? <FileText className="size-5" /> : <FileAudio className="size-5" />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-bold truncate" title={file.file_name}>{file.file_name}</h4>{renderStatusBadge(effectiveStatus)}</div>
          <p className="text-[11px] ui-muted mt-1">{formatDisplayTime(file.duration_seconds || 0)}</p>
          {file.status === 'failed' && file.error_message && <p className="mt-1.5 text-[10px] text-[var(--ui-danger)] line-clamp-2">{file.error_message}</p>}
          {!completed && renderProgress(file)}
        </div>
      </div>

      <div className="file-row-actions">
        {file.status === 'failed' && !isLiveProgress(progress) && <button onClick={onRetry} disabled={retrying} className="ui-button ui-button-secondary ui-danger-text">{retrying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}<span>{t('media.retry')}</span></button>}
        <button onClick={onOpen} disabled={isLiveProgress(progress)} className="ui-button ui-button-primary"><Edit className="size-3.5" /><span>{t('media.edit')}</span></button>
        <div className="file-row-menu relative" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="ui-icon-button" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={t('common.more')} title={t('common.more')}><MoreHorizontal className="size-4" /></button>
          {menuOpen && (
            <div className="overflow-menu overflow-menu-right" role="menu">
              {completed && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onExport(); }}><Download className="size-4" />{t('media.download')}</button>}
              <button type="button" role="menuitem" className="ui-danger-text" disabled={isLiveProgress(progress)} onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 className="size-4" />{t('media.delete')}</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export const FileListTabs: React.FC<FileListTabsProps> = ({ files, processingProgressByFile, onStartProcessAll, onOpenFileEditor, onRetryFile, onExportFile, onDeleteFile }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'unfinished' | 'completed'>('completed');
  const [processing, setProcessing] = useState(false);
  const [retryingFileId, setRetryingFileId] = useState<string | null>(null);
  const unfinishedFiles = files.filter((file) => file.status !== 'completed');
  const completedFiles = files.filter((file) => file.status === 'completed');
  const processableFiles = unfinishedFiles.filter((file) => file.status === 'draft' || file.status === 'failed');

  const handleStartProcess = async () => { setProcessing(true); try { await onStartProcessAll(); } finally { setProcessing(false); } };
  const handleRetryFile = async (file: FileMedia) => { setRetryingFileId(file.id); try { await onRetryFile(file); } finally { setRetryingFileId(null); } };
  const isLiveProgress = (progress?: ProcessingProgress) => Boolean(progress && !['completed', 'failed'].includes(progress.stage));

  const translatedProgressMessage = (progress: ProcessingProgress) => {
    const keyByStage: Partial<Record<ProcessingProgress['stage'], string>> = { queued: 'processing.preparing', preparing: 'processing.preparing', downloading: 'processing.downloading', preprocessing: 'processing.ffmpeg', transcribing: 'processing.transcribing', finalizing: 'processing.saving', completed: 'processing.completed' };
    const key = keyByStage[progress.stage];
    return key ? t(key) : progress.message;
  };

  const renderProgress = (file: FileMedia) => {
    const progress = processingProgressByFile[file.id];
    if (!progress || file.status === 'completed') return null;
    const isFailed = progress.stage === 'failed';
    return (
      <div className="mt-3 space-y-1.5 max-w-xl" role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-[10px]"><span className={isFailed ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-text-muted)]'}>{translatedProgressMessage(progress)}</span><span className="font-mono ui-muted shrink-0">{progress.percent}%</span></div>
        <div className="h-1.5 rounded-full bg-[var(--ui-surface-muted)] overflow-hidden"><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${progress.percent}%`, background: isFailed ? 'var(--ui-danger)' : 'linear-gradient(90deg, #6f5ce7 0%, #5f9de8 100%)' }} /></div>
        {progress.chunkCount && progress.chunkIndex ? <p className="text-[10px] ui-soft">{t('processing.chunkLabel', { current: progress.chunkIndex, total: progress.chunkCount })}</p> : null}
      </div>
    );
  };

  const renderStatusBadge = (status: FileMedia['status']) => {
    if (status === 'draft') return <span className="ui-badge"><Clock className="size-3.5" />{t('media.status.draft')}</span>;
    if (status === 'processing') return <span className="ui-badge ui-badge-accent"><Loader2 className="size-3.5 animate-spin" />{t('media.status.processing')}</span>;
    if (status === 'completed') return <span className="ui-badge ui-badge-success"><CheckCircle2 className="size-3.5" />{t('media.status.completed')}</span>;
    return <span className="ui-badge ui-badge-danger"><XCircle className="size-3.5" />{t('media.status.failed')}</span>;
  };

  const shownFiles = activeTab === 'unfinished' ? unfinishedFiles : completedFiles;
  return (
    <section className="space-y-4">
      <div className="media-section-toolbar">
        <div>
          <h2 className="text-base font-extrabold">{t('project.videosTitle')}</h2>
          <p className="text-xs ui-muted mt-1">{t('project.videosDescription')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="segment-control">
            <button
              onClick={() => setActiveTab('completed')}
              className={activeTab === 'completed' ? 'segment-active' : ''}
            >
              {t('media.tabs.completed')}
              <span>{completedFiles.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('unfinished')}
              className={activeTab === 'unfinished' ? 'segment-active' : ''}
            >
              {t('media.tabs.unfinished')}
              <span>{unfinishedFiles.length}</span>
            </button>
          </div>
          {activeTab === 'unfinished' && processableFiles.length > 0 && <button onClick={handleStartProcess} disabled={processing} className="ui-button ui-button-secondary">{processing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}<span>{t('media.startAll', { count: processableFiles.length })}</span></button>}
        </div>
      </div>
      <div className="media-workspace-list">{shownFiles.length === 0 ? <div className="workspace-empty-inline">{activeTab === 'unfinished' ? t('media.emptyUnfinished') : t('media.emptyCompleted')}</div> : shownFiles.map((file) => <FileRow key={file.id} file={file} completed={activeTab === 'completed'} progress={processingProgressByFile[file.id]} retrying={retryingFileId === file.id} onOpen={() => onOpenFileEditor(file)} onRetry={() => void handleRetryFile(file)} onExport={() => onExportFile(file)} onDelete={() => void onDeleteFile(file.id)} renderProgress={renderProgress} renderStatusBadge={renderStatusBadge} isLiveProgress={isLiveProgress} />)}</div>
    </section>
  );
};
