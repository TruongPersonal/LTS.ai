import React, { useEffect, useState } from 'react';
import { AlertCircle, Archive, ArrowLeft, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FileMedia, Project } from '../types/database';
import { fileService } from '../services/fileService';
import type { ProcessingProgress } from '../types/processing';
import { FileListTabs } from '../components/media/FileListTabs';
import { DrivePickerModal } from '../components/media/DrivePickerModal';
import { ExportModal } from '../components/editor/ExportModal';
import type { SubtitleExportFormat, SubtitleExportTrack } from '../utils/exporter';
import { downloadProjectZip, downloadSubtitleFile } from '../utils/exporter';
import { subtitleService } from '../services/subtitleService';
import { parseSubtitleFile } from '../utils/subtitleParsers';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface ProjectDetailPageProps {
  project: Project;
  routeLoading?: boolean;
  onBack: () => void;
  onOpenFileEditor: (file: FileMedia) => void;
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({ project, routeLoading = false, onBack, onOpenFileEditor }) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [exportFileTarget, setExportFileTarget] = useState<FileMedia | null>(null);
  const [isProjectZipExportOpen, setIsProjectZipExportOpen] = useState(false);
  const [deletingFile, setDeletingFile] = useState<FileMedia | null>(null);
  const [processingProgressByFile, setProcessingProgressByFile] = useState<Record<string, ProcessingProgress>>({});

  const [todayProcessedDuration, setTodayProcessedDuration] = useState<number>(0);

  const loadFiles = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setFiles(await fileService.getFilesByProject(project.id));
      setTodayProcessedDuration(await fileService.getTodayProcessedDurationSeconds());
    }
    catch (error) { console.error('Error loading files:', error); setLoadError(t('project.loadError')); }
    finally { setLoading(false); }
  }, [project.id, t]);

  useEffect(() => { void loadFiles(); }, [loadFiles]);

  const handleSelectDriveFile = async (driveFileId: string, fileName: string, mimeType: string, durationSeconds: number, existingSubtitle?: { content: string; language: string }) => {
    const createdFile = await fileService.addFile(project.id, driveFileId, fileName, mimeType, durationSeconds, existingSubtitle ? 'existing_subtitle' : 'media', existingSubtitle?.language || null);
    if (existingSubtitle) await subtitleService.saveSubtitles(createdFile.id, existingSubtitle.language, parseSubtitleFile(existingSubtitle.content));
    setFiles((current) => {
      const exists = current.some((f) => f.id === createdFile.id);
      return exists
        ? current.map((f) => (f.id === createdFile.id ? createdFile : f))
        : [createdFile, ...current];
    });
    // Clear stale progress entry (if any) to avoid showing old status after reset
    setProcessingProgressByFile((current) => {
      if (!current[createdFile.id]) return current;
      const updated = { ...current };
      delete updated[createdFile.id];
      return updated;
    });
  };

  const handleProcessingProgress = (progress: ProcessingProgress) => {
    setProcessingProgressByFile((current) => ({ ...current, [progress.fileId]: progress }));
    if (progress.stage === 'completed' || progress.stage === 'failed') {
      setTimeout(() => {
        setFiles((currentFiles) =>
          currentFiles.map((f) =>
            f.id === progress.fileId
              ? {
                  ...f,
                  status: progress.stage === 'completed' ? 'completed' : 'failed',
                  error_message: progress.stage === 'failed' ? (progress.message || t('processing.processFailed')) : f.error_message,
                }
              : f
          )
        );
      }, 1200);
    }
  };
  const handleStartProcessAll = async () => {
    try {
      await fileService.startProcessingAllDrafts(project.id, handleProcessingProgress);
    } catch {
      // Processing may have partial failures - reload to get final state
    } finally {
      setTimeout(async () => {
        await loadFiles();
      }, 1500);
    }
  };

  const handleRenameFile = async (fileId: string, newFileName: string) => {
    await fileService.updateFileName(fileId, newFileName);
    await loadFiles();
  };

  const handleConfirmDeleteFile = async () => {
    if (!deletingFile) return;
    await fileService.deleteFile(deletingFile.id);
    setFiles((current) => current.filter((file) => file.id !== deletingFile.id));
    setProcessingProgressByFile((current) => { const next = { ...current }; delete next[deletingFile.id]; return next; });
    setDeletingFile(null);
  };

  const handleConfirmSingleExport = async (format: SubtitleExportFormat, track: SubtitleExportTrack = 'target') => {
    if (!exportFileTarget) return;
    const targetSub = await subtitleService.getSubtitleByFile(exportFileTarget.id, project.target_language);
    const sourceLang = exportFileTarget.detected_source_lang;
    const sourceSub = sourceLang ? await subtitleService.getSubtitleByFile(exportFileTarget.id, sourceLang) : null;
    downloadSubtitleFile(targetSub?.content || [], sourceSub?.content || [], exportFileTarget.file_name, format, track);
  };
  const handleConfirmZipExport = async (format: SubtitleExportFormat, track: SubtitleExportTrack = 'target') => {
    const items = await Promise.all(
      files
        .filter((file) => file.status === 'completed')
        .map(async (file) => {
          const targetSub = await subtitleService.getSubtitleByFile(file.id, project.target_language);
          const sourceLang = file.detected_source_lang;
          const sourceSub = sourceLang ? await subtitleService.getSubtitleByFile(file.id, sourceLang) : null;
          return {
            fileName: file.file_name,
            subtitles: targetSub?.content || [],
            sourceSubtitles: sourceSub?.content || [],
          };
        })
    );
    downloadProjectZip(project.title, items, format, track);
  };

  const hasActiveProcessing = files.some(
    (f) => f.status === 'processing' || f.status === 'queued'
  ) || Object.values(processingProgressByFile).some(
    (p) => p && !['completed', 'failed'].includes(p.stage)
  );
  const isQuotaExceeded = todayProcessedDuration >= 3600;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasActiveProcessing) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasActiveProcessing]);

  return (
    <div className="workspace-page ui-container py-9 sm:py-12 space-y-8">
      <header className="project-workspace-header">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button onClick={onBack} className="ui-icon-button shrink-0" title={t('navigation.backProjects')} aria-label={t('navigation.backProjects')}><ArrowLeft className="size-4" /></button>
            <div className="min-w-0 max-w-3xl">
              {routeLoading || !project.title ? (
                <div className="space-y-2 py-1">
                  <div className="ui-skeleton h-8 w-64 rounded-lg" />
                  <div className="ui-skeleton h-4 w-96 rounded-md" />
                </div>
              ) : (
                <>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] break-words">{project.title}</h1>
                  {project.description && <p className="text-sm ui-muted mt-2 leading-relaxed">{project.description}</p>}
                </>
              )}
            </div>
        </div>
        <div className="project-action-buttons flex items-center gap-2 shrink-0 flex-nowrap whitespace-nowrap">
          <button onClick={() => setIsProjectZipExportOpen(true)} className="ui-button ui-button-secondary whitespace-nowrap"><Archive className="size-4" />{t('project.exportZip')}</button>
          <button onClick={() => setIsDrivePickerOpen(true)} disabled={isQuotaExceeded} className="ui-button ui-button-primary whitespace-nowrap"><HardDrive className="size-4" />{t('media.addDrive')}</button>
        </div>
      </header>


      {loading ? (
        <div className="media-workspace-list" aria-label={t('accessibility.loadingFiles')} role="status">{[0, 1, 2].map((item) => <div key={item} className="ui-skeleton h-[104px] w-full" />)}</div>
      ) : loadError ? (
        <div className="workspace-empty-state" role="alert"><AlertCircle className="size-7 text-[var(--ui-danger)]" /><p className="text-sm font-bold">{loadError}</p><button onClick={() => void loadFiles()} className="ui-button ui-button-secondary">{t('project.retryLoad')}</button></div>
      ) : (
        <FileListTabs files={files} processingProgressByFile={processingProgressByFile} onStartProcessAll={handleStartProcessAll} onOpenFileEditor={onOpenFileEditor} onExportFile={setExportFileTarget} onRenameFile={handleRenameFile} onDeleteFile={async (fileId) => { const file = files.find((item) => item.id === fileId); if (file) setDeletingFile(file); }} onOpenDrivePicker={() => setIsDrivePickerOpen(true)} isProcessing={hasActiveProcessing} />
      )}

      <DrivePickerModal isOpen={isDrivePickerOpen} onClose={() => setIsDrivePickerOpen(false)} onSelectDriveFile={handleSelectDriveFile} />
      {exportFileTarget && <ExportModal isOpen onClose={() => setExportFileTarget(null)} title={exportFileTarget.file_name} onConfirmExport={handleConfirmSingleExport} />}
      <ExportModal isOpen={isProjectZipExportOpen} onClose={() => setIsProjectZipExportOpen(false)} isProjectZip title={project.title} onConfirmExport={handleConfirmZipExport} />
      <ConfirmDialog isOpen={Boolean(deletingFile)} onClose={() => setDeletingFile(null)} title={t('project.deleteFileTitle')} message={t('project.deleteFileMessage', { name: deletingFile?.file_name || '' })} confirmText={t('project.deleteFileAction')} onConfirm={handleConfirmDeleteFile} />
    </div>
  );
};
