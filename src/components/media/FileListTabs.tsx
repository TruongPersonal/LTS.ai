import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Loader2, Zap } from 'lucide-react';
import type { FileMedia } from '../../types/database';
import type { ProcessingProgress } from '../../types/processing';
import { FileRow } from './FileRow';
import { RenameFileModal } from './RenameFileModal';

interface FileListTabsProps {
  files: FileMedia[];
  processingProgressByFile: Record<string, ProcessingProgress>;
  onStartProcessAll: () => Promise<void>;
  onOpenFileEditor: (file: FileMedia) => void;
  onExportFile: (file: FileMedia) => void;
  onDeleteFile: (fileId: string) => Promise<void>;
  onRenameFile: (fileId: string, newFileName: string) => Promise<void>;
  isProcessing?: boolean;
}

export const FileListTabs: React.FC<FileListTabsProps> = ({
  files,
  processingProgressByFile,
  onStartProcessAll,
  onOpenFileEditor,
  onExportFile,
  onDeleteFile,
  onRenameFile,
  isProcessing = false,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'unfinished' | 'completed'>('unfinished');
  const [processing, setProcessing] = useState(false);
  const [renamingFile, setRenamingFile] = useState<FileMedia | null>(null);

  const unfinishedFiles = files.filter(
    (file) => file.status === 'draft' || file.status === 'queued' || file.status === 'processing'
  );
  const completedFiles = files.filter(
    (file) => file.status === 'completed' || file.status === 'failed'
  );
  const processableFiles = unfinishedFiles.filter((file) => file.status === 'draft');

  const handleStartProcess = async () => {
    setProcessing(true);
    try {
      await onStartProcessAll();
    } finally {
      setProcessing(false);
    }
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
                onOpen={() => onOpenFileEditor(file)}
                onExport={() => onExportFile(file)}
                onRename={() => setRenamingFile(file)}
                onDelete={() => void onDeleteFile(file.id)}
              />
            ))}
          </div>
        )}
      </div>

      <RenameFileModal
        file={renamingFile}
        isOpen={Boolean(renamingFile)}
        onClose={() => setRenamingFile(null)}
        onRename={onRenameFile}
      />
    </section>
  );
};
