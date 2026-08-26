import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import type { Project, TargetLanguageCode } from '../types/database';
import { ProjectGrid } from '../components/projects/ProjectGrid';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import { EditProjectModal } from '../components/projects/EditProjectModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface DashboardPageProps {
  onSelectProject: (project: Project) => void;
  intent?: { type: 'create' | 'search'; id: number } | null;
  checkoutNotice?: { type: 'success' | 'error'; message: string } | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onSelectProject, intent, checkoutNotice }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const {
    projects,
    filteredProjects,
    loading,
    loadError,
    searchQuery,
    setSearchQuery,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
  } = useProjects(profile?.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!intent) return;
    if (intent.type === 'create') setIsCreateOpen(true);
    if (intent.type === 'search') {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [intent]);

  const handleCreateProject = async (
    title: string,
    description: string,
    targetLanguage: TargetLanguageCode
  ) => {
    await createProject(title, description, targetLanguage);
  };

  const handleUpdateProject = async (projectId: string, title: string, description: string) => {
    await updateProject(projectId, title, description);
  };

  const handleConfirmDeleteProject = async () => {
    if (!deletingProject) return;
    await deleteProject(deletingProject.id);
    setDeletingProject(null);
  };

  return (
    <div className="workspace-page ui-container py-9 sm:py-12 space-y-8">
      {checkoutNotice && (
        <div className={checkoutNotice.type === 'success' ? 'ui-status-success p-3 text-xs' : 'ui-status-error p-3 text-xs'} role="status">
          {checkoutNotice.message}
        </div>
      )}
      <section className="workspace-page-header">
        <div className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.035em]">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm sm:text-base ui-muted mt-2 leading-relaxed">
            {t('dashboard.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="ui-button ui-button-primary shrink-0"
        >
          <Plus className="size-4" />
          <span>{t('project.create')}</span>
        </button>
      </section>

      <section className="workspace-toolbar">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 ui-soft pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            placeholder={t('dashboard.searchPlaceholder')}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="ui-input workspace-search-input"
          />
        </div>
      </section>

      <ProjectGrid
        projects={projects}
        filteredProjects={filteredProjects}
        loading={loading}
        loadError={loadError}
        searchQuery={searchQuery}
        onRetry={() => void loadProjects()}
        onSelectProject={onSelectProject}
        onEditProject={setEditingProject}
        onDeleteProject={setDeletingProject}
        onCreateProject={() => setIsCreateOpen(true)}
      />

      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateProject}
      />

      {editingProject && (
        <EditProjectModal
          isOpen
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSubmit={handleUpdateProject}
        />
      )}

      {deletingProject && (
        <ConfirmDialog
          isOpen
          onClose={() => setDeletingProject(null)}
          onConfirm={handleConfirmDeleteProject}
          title={t('project.deleteProjectTitle')}
          message={t('project.deleteProjectMessage', { name: deletingProject.title })}
          confirmText={t('project.deleteProjectAction')}
          type="danger"
        />
      )}
    </div>
  );
};
