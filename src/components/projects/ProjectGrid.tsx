import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, FolderPlus, Search } from 'lucide-react';
import type { Project } from '../../types/database';
import { ProjectCard } from './ProjectCard';
import { ProjectGridSkeleton } from '../common/LoadingSkeleton';
import { EmptyState } from '../common/EmptyState';

interface ProjectGridProps {
  projects: Project[];
  filteredProjects: Project[];
  loading: boolean;
  loadError: string | null;
  searchQuery: string;
  onRetry: () => void;
  onSelectProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onCreateProject?: () => void;
}

export const ProjectGrid: React.FC<ProjectGridProps> = ({
  projects,
  filteredProjects,
  loading,
  loadError,
  searchQuery,
  onRetry,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onCreateProject,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return <ProjectGridSkeleton count={3} />;
  }

  if (loadError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={loadError}
        actionText={t('dashboard.retryLoad')}
        onAction={onRetry}
        actionVariant="secondary"
        role="alert"
        iconClassName="size-8 text-[var(--ui-danger)]"
      />
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderPlus}
        title={t('dashboard.empty.title')}
        description={t('dashboard.empty.description')}
        actionText={t('dashboard.empty.createAction')}
        onAction={onCreateProject}
      />
    );
  }

  if (filteredProjects.length === 0 && searchQuery) {
    return (
      <EmptyState
        icon={Search}
        title={t('dashboard.noSearchResults.title')}
        description={t('dashboard.noSearchResults.description')}
      />
    );
  }

  return (
    <div className="project-grid">
      {filteredProjects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onSelect={onSelectProject}
          onEdit={onEditProject}
          onDelete={onDeleteProject}
        />
      ))}
    </div>
  );
};
