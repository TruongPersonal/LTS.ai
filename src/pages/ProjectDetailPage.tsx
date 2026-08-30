import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import type { FileMedia, Project } from '../types/database';
import { useProjectFiles } from '../hooks/useProjectFiles';
import { ProjectDetailHeader } from '../components/projects/ProjectDetailHeader';
import { FileListTabs } from '../components/media/FileListTabs';
import { DrivePickerModal } from '../components/media/DrivePickerModal';
import { ExportModal } from '../components/editor/ExportModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { FileListSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import type { SubtitleExportFormat, SubtitleExportTrack } from '../utils/exporter';

interface ProjectDetailPageProps {
  project: Project;
  routeLoading?: boolean;
  onBack: () => void;
  onOpenFileEditor: (file: FileMedia) => void;
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  project,
  routeLoading = false,
  onBack,
  onOpenFileEditor,
}) => {
  const { t } = useTranslation();
  const {
    files,
    loading,
    loadError,
    processingProgressByFile,
    isProcessing,
    loadFiles,
    addDriveFile,
    processAllDrafts,
    resetFailedFiles,
    renameFile,
    deleteFile,
    exportSingleFile,
    exportProjectZip,
  } = useProjectFiles(project.id, project.target_language);

  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [exportFileTarget, setExportFileTarget] = useState<FileMedia | null>(null);
  const [isProjectZipExportOpen, setIsProjectZipExportOpen] = useState(false);
  const [deletingFile, setDeletingFile] = useState<FileMedia | null>(null);

  const completedFiles = files.filter((f) => f.status === 'completed');

  const handleConfirmSingleExport = async (
    format: SubtitleExportFormat,
    track: SubtitleExportTrack = 'target'
  ) => {
    if (!exportFileTarget) return;
    await exportSingleFile(exportFileTarget, format, track);
  };

  const handleConfirmZipExport = async (
    format: SubtitleExportFormat,
    track: SubtitleExportTrack = 'target'
  ) => {
    await exportProjectZip(project.title, format, track);
  };

  const handleConfirmDeleteFile = async () => {
    if (!deletingFile) return;
    await deleteFile(deletingFile.id);
    setDeletingFile(null);
  };

  return (
    <div className="workspace-page ui-container py-9 sm:py-12 space-y-8">
      {routeLoading ? (
        <div className="space-y-2 py-1">
          <div className="ui-skeleton h-8 w-64 rounded-lg" />
          <div className="ui-skeleton h-4 w-96 rounded-md" />
        </div>
      ) : (
        <ProjectDetailHeader
          project={project}
          completedFileCount={completedFiles.length}
          onBack={onBack}
          onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
          onOpenZipExport={() => setIsProjectZipExportOpen(true)}
        />
      )}

      {loading ? (
        <FileListSkeleton count={3} />
      ) : loadError ? (
        <EmptyState
          icon={AlertCircle}
          title={loadError}
          actionText={t('project.retryLoad')}
          onAction={() => void loadFiles()}
          actionVariant="secondary"
          role="alert"
          iconClassName="size-8 text-[var(--ui-danger)]"
        />
      ) : (
        <FileListTabs
          files={files}
          processingProgressByFile={processingProgressByFile}
          onStartProcessAll={processAllDrafts}
          onResetFailedFiles={resetFailedFiles}
          onOpenFileEditor={onOpenFileEditor}
          onExportFile={setExportFileTarget}
          onRenameFile={renameFile}
          onDeleteFile={async (fileId) => {
            const target = files.find((item) => item.id === fileId);
            if (target) setDeletingFile(target);
          }}
          isProcessing={isProcessing}
        />
      )}

      <DrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelectDriveFile={async (driveFileId, fileName, mimeType, durationSeconds, existingSubtitle) => {
          await addDriveFile(driveFileId, fileName, mimeType, durationSeconds, existingSubtitle);
        }}
      />

      {exportFileTarget && (
        <ExportModal
          isOpen
          onClose={() => setExportFileTarget(null)}
          title={exportFileTarget.file_name}
          onConfirmExport={handleConfirmSingleExport}
        />
      )}

      <ExportModal
        isOpen={isProjectZipExportOpen}
        onClose={() => setIsProjectZipExportOpen(false)}
        isProjectZip
        title={project.title}
        onConfirmExport={handleConfirmZipExport}
      />

      {deletingFile && (
        <ConfirmDialog
          isOpen
          onClose={() => setDeletingFile(null)}
          title={t('project.deleteFileTitle')}
          message={t('project.deleteFileMessage', { name: deletingFile.file_name })}
          confirmText={t('project.deleteFileAction')}
          onConfirm={handleConfirmDeleteFile}
          type="danger"
        />
      )}
    </div>
  );
};
