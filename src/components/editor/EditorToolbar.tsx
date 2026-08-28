import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Download, FileVideo, Loader2, Wrench } from 'lucide-react';
import { CueVisibilityMenu } from './CueVisibilityMenu';
import type { CueVisibility, CueVisibilityKey } from '../../utils/cueVisibility';

interface EditorToolbarProps {
  fileName: string;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  globalVisibility: CueVisibility;
  cueActionsVisible: boolean;
  saving: boolean;
  isDirty: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  onBack: () => void;
  onToggleGlobalVisibility: (key: CueVisibilityKey) => void;
  onToggleCueActionsVisible: () => void;
  onSave: () => void;
  onExport: () => void;
  onExportVideo: () => void;
  exportVideoDisabled: boolean;
  showExportVideo?: boolean;
}

const ToolOffIcon: React.FC<{ className?: string }> = ({ className = 'size-4' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    <line x1="3" y1="3" x2="21" y2="21" stroke="var(--ui-danger, #ef4444)" strokeWidth="2.5" />
  </svg>
);

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  fileName,
  sourceLanguageLabel,
  targetLanguageLabel,
  globalVisibility,
  cueActionsVisible,
  saving,
  isDirty,
  saveSuccess,
  saveError,
  onBack,
  onToggleGlobalVisibility,
  onToggleCueActionsVisible,
  onSave,
  onExport,
  onExportVideo,
  exportVideoDisabled,
  showExportVideo = true,
}) => {
  const { t } = useTranslation();

  return (
    <header className="editor-local-toolbar">
      <div className="editor-toolbar-inner">
        {}
        <div className="editor-toolbar-main-row">
          <div className="editor-toolbar-lead">
            <button
              type="button"
              onClick={onBack}
              className="ui-button ui-button-ghost ui-icon-button shrink-0"
              title={t('editor.backToProject')}
              aria-label={t('editor.backToProject')}
            >
              <ArrowLeft className="size-4" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight truncate max-w-sm sm:max-w-md md:max-w-xl">
                {fileName}
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] ui-muted mt-0.5">
                <span>{sourceLanguageLabel}</span>
                <span className="text-[10px] ui-soft">→</span>
                <span className="font-semibold text-[var(--ui-accent)]">{targetLanguageLabel}</span>
              </div>
            </div>
          </div>

          {}
          <div className="editor-toolbar-view-controls">
            <CueVisibilityMenu
              metadataVisible={globalVisibility.metadata}
              sourceVisible={globalVisibility.source}
              onToggleMetadata={() => onToggleGlobalVisibility('metadata')}
              onToggleSource={() => onToggleGlobalVisibility('source')}
            />

            <button
              type="button"
              onClick={onToggleCueActionsVisible}
              className={`ui-button ${
                cueActionsVisible ? 'ui-button-secondary' : 'ui-button-ghost opacity-80'
              } ui-icon-button`}
              title={cueActionsVisible ? t('editor.visibility.actions') : t('editor.visibility.actionsHint')}
              aria-label={cueActionsVisible ? t('editor.visibility.actions') : t('editor.visibility.actionsHint')}
            >
              {cueActionsVisible ? <Wrench className="size-4" /> : <ToolOffIcon className="size-4" />}
            </button>
          </div>
        </div>

        {}
        <div className="editor-toolbar-action-controls">
          <div className="editor-toolbar-divider" />

          {saveSuccess && (
            <span className="text-xs font-semibold text-[var(--ui-success)] inline-flex items-center gap-1">
              <Check className="size-3.5" />
              {t('common.saved')}
            </span>
          )}

          {saveError && (
            <span className="text-xs font-semibold text-[var(--ui-danger)]">
              {saveError}
            </span>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || saving}
            className="ui-button ui-button-secondary"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            <span>{saving ? t('common.saving') : t('common.save')}</span>
          </button>

          <button
            type="button"
            onClick={onExport}
            className="ui-button ui-button-primary"
          >
            <Download className="size-4" />
            <span>{t('editor.export')}</span>
          </button>

          {showExportVideo && (
            <button
              type="button"
              onClick={onExportVideo}
              disabled={exportVideoDisabled}
              className="ui-button ui-button-secondary"
            >
              <FileVideo className="size-4" />
              <span>{t('editor.exportVideo')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
