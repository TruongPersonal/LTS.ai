import React, { useEffect, useState } from 'react';
import { AlertCircle, Archive, ArrowLeft, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FileMedia, Project } from '../types/database';
import { getLanguageOption } from '../types/project';
import { fileService } from '../services/fileService';
import type { ProcessingProgress } from '../types/processing';
import { FileListTabs } from '../components/media/FileListTabs';
import { DrivePickerModal } from '../components/media/DrivePickerModal';
import { ExportModal } from '../components/editor/ExportModal';
import type { SubtitleExportFormat } from '../utils/exporter';
import { downloadProjectZip, downloadSubtitleFile } from '../utils/exporter';
import { subtitleService } from '../services/subtitleService';
import { parseSubtitleFile } from '../utils/subtitleParsers';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface ProjectDetailPageProps {
  project: Project;
  onBack: () => void;
  onOpenFileEditor: (file: FileMedia) => void;
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({ project, onBack, onOpenFileEditor }) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [exportFileTarget, setExportFileTarget] = useState<FileMedia | null>(null);
  const [isProjectZipExportOpen, setIsProjectZipExportOpen] = useState(false);
  const [deletingFile, setDeletingFile] = useState<FileMedia | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingProgressByFile, setProcessingProgressByFile] = useState<Record<string, ProcessingProgress>>({});
  const language = getLanguageOption(project.target_language);

  const loadFiles = async () => {
    setLoading(true);
    setLoadError(null);
    try { setFiles(await fileService.getFilesByProject(project.id)); }
    catch (error) { console.error('Error loading files:', error); setLoadError(t('project.loadError')); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadFiles(); }, [project.id]);

  const handleSelectDriveFile = async (driveFileId: string, fileName: string, mimeType: string, durationSeconds: number, existingSubtitle?: { content: string; language: string }) => {
    const createdFile = await fileService.addFile(project.id, driveFileId, fileName, mimeType, durationSeconds, existingSubtitle ? 'existing_subtitle' : 'media', existingSubtitle?.language || null);
    if (existingSubtitle) await subtitleService.saveSubtitles(createdFile.id, existingSubtitle.language, parseSubtitleFile(existingSubtitle.content));
    setFiles((current) => [createdFile, ...current]);
  };

  const handleProcessingProgress = (progress: ProcessingProgress) => setProcessingProgressByFile((current) => ({ ...current, [progress.fileId]: progress }));
  const handleStartProcessAll = async () => { setProcessingError(null); try { await fileService.startProcessingAllDrafts(project.id, handleProcessingProgress); } catch (error) { setProcessingError(error instanceof Error ? error.message : t('processing.processFailed')); } finally { await loadFiles(); } };
  const handleRetryFile = async (file: FileMedia) => { setProcessingError(null); try { await fileService.retryProcessingFile(project.id, file.id, handleProcessingProgress); } catch (error) { setProcessingError(error instanceof Error ? error.message : t('processing.retryFailed')); } finally { await loadFiles(); } };

  const handleConfirmDeleteFile = async () => {
    if (!deletingFile) return;
    await fileService.deleteFile(deletingFile.id);
    setFiles((current) => current.filter((file) => file.id !== deletingFile.id));
    setProcessingProgressByFile((current) => { const next = { ...current }; delete next[deletingFile.id]; return next; });
    setDeletingFile(null);
  };

  const handleConfirmSingleExport = async (format: SubtitleExportFormat) => {
    if (!exportFileTarget) return;
    const subtitle = await subtitleService.getSubtitleByFile(exportFileTarget.id, project.target_language);
    downloadSubtitleFile(subtitle?.content || [], exportFileTarget.file_name, format);
  };
  const handleConfirmZipExport = async (format: SubtitleExportFormat) => {
    const items = await Promise.all(files.filter((file) => file.status === 'completed').map(async (file) => ({ fileName: file.file_name, subtitles: (await subtitleService.getSubtitleByFile(file.id, project.target_language))?.content || [] })));
    downloadProjectZip(project.title, items, format);
  };

  return (
    <div className="workspace-page ui-container py-9 sm:py-12 space-y-8">
      <header className="project-workspace-header">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button onClick={onBack} className="ui-icon-button shrink-0" title={t('navigation.backProjects')} aria-label={t('navigation.backProjects')}><ArrowLeft className="size-4" /></button>
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5"><h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] break-words">{project.title}</h1>{language && <span className="project-language-pill"><span>{language.flag}</span>{language.nativeName}</span>}</div>
            <p className="text-sm ui-muted mt-2 leading-relaxed">{project.description || t('project.defaultDescription')}</p>
            <p className="text-xs ui-soft mt-2">{t('project.fileCount', { count: files.length })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button onClick={() => setIsProjectZipExportOpen(true)} className="ui-button ui-button-secondary"><Archive className="size-4" />{t('project.exportZip')}</button>
          <button onClick={() => setIsDrivePickerOpen(true)} className="ui-button ui-button-primary"><HardDrive className="size-4" />{t('media.addDrive')}</button>
        </div>
      </header>

      {processingError && <div role="alert" className="ui-status-error px-4 py-3 text-xs">{processingError}</div>}

      {loading ? (
        <div className="media-workspace-list" aria-label={t('accessibility.loadingFiles')} role="status">{[0, 1, 2].map((item) => <div key={item} className="ui-skeleton h-[104px] w-full" />)}</div>
      ) : loadError ? (
        <div className="workspace-empty-state" role="alert"><AlertCircle className="size-7 text-[var(--ui-danger)]" /><p className="text-sm font-bold">{loadError}</p><button onClick={() => void loadFiles()} className="ui-button ui-button-secondary">{t('project.retryLoad')}</button></div>
      ) : (
        <FileListTabs files={files} processingProgressByFile={processingProgressByFile} onStartProcessAll={handleStartProcessAll} onOpenFileEditor={onOpenFileEditor} onRetryFile={handleRetryFile} onExportFile={setExportFileTarget} onDeleteFile={async (fileId) => { const file = files.find((item) => item.id === fileId); if (file) setDeletingFile(file); }} onOpenDrivePicker={() => setIsDrivePickerOpen(true)} />
      )}

      <DrivePickerModal isOpen={isDrivePickerOpen} onClose={() => setIsDrivePickerOpen(false)} onSelectDriveFile={handleSelectDriveFile} />
      {exportFileTarget && <ExportModal isOpen onClose={() => setExportFileTarget(null)} title={exportFileTarget.file_name} onConfirmExport={handleConfirmSingleExport} />}
      <ExportModal isOpen={isProjectZipExportOpen} onClose={() => setIsProjectZipExportOpen(false)} isProjectZip title={project.title} onConfirmExport={handleConfirmZipExport} />
      <ConfirmDialog isOpen={Boolean(deletingFile)} onClose={() => setDeletingFile(null)} title={t('project.deleteFileTitle')} message={t('project.deleteFileMessage', { name: deletingFile?.file_name || '' })} confirmText={t('project.deleteFileAction')} onConfirm={handleConfirmDeleteFile} />
    </div>
  );
};
