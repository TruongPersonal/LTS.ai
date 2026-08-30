import React from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, ArrowLeft, HardDrive } from 'lucide-react';
import type { Project } from '../../types/database';
import { getLanguageOption } from '../../types/project';

interface ProjectDetailHeaderProps {
  project: Project;
  completedFileCount: number;
  onBack: () => void;
  onOpenDrivePicker: () => void;
  onOpenZipExport: () => void;
}

export const ProjectDetailHeader: React.FC<ProjectDetailHeaderProps> = ({
  project,
  completedFileCount,
  onBack,
  onOpenDrivePicker,
  onOpenZipExport,
}) => {
  const { t } = useTranslation();
  const targetLangOption = getLanguageOption(project.target_language);

  return (
    <section className="project-workspace-header">
      <div className="flex items-start gap-3 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="ui-button ui-button-secondary ui-icon-button shrink-0"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="size-4.5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate max-w-xl">
              {project.title}
            </h1>
            {targetLangOption && (
              <span className="ui-badge ui-badge-accent font-mono text-[11px]">
                {targetLangOption.nativeName}
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-xs sm:text-sm ui-muted mt-1 truncate max-w-2xl">
              {project.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
        <button
          type="button"
          onClick={onOpenDrivePicker}
          className="ui-button ui-button-primary flex-1 sm:flex-initial justify-center"
        >
          <HardDrive className="size-4.5" />
          <span>{t('media.addDrive')}</span>
        </button>

        {completedFileCount > 0 && (
          <button
            type="button"
            onClick={onOpenZipExport}
            className="ui-button ui-button-secondary flex-1 sm:flex-initial justify-center"
          >
            <Archive className="size-4.5" />
            <span>{t('project.exportZip')}</span>
          </button>
        )}
      </div>
    </section>
  );
};
