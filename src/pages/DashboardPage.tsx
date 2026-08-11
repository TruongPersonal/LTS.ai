import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, FolderPlus, Plus, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Project, TargetLanguageCode } from '../types/database';
import { projectService } from '../services/projectService';
import { ProjectCard } from '../components/projects/ProjectCard';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import { EditProjectModal } from '../components/projects/EditProjectModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface DashboardPageProps {
  onSelectProject: (project: Project) => void;
  intent?: { type: 'create' | 'search'; id: number } | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onSelectProject, intent }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadProjects = async () => {
    if (!profile) return;
    setLoading(true);
    setLoadError(null);
    try { setProjects(await projectService.getProjects(profile.id)); }
    catch (error) { console.error('Error loading projects:', error); setLoadError(t('dashboard.loadError')); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadProjects(); }, [profile?.id]);
  useEffect(() => {
    if (!intent) return;
    if (intent.type === 'create') setIsCreateOpen(true);
    if (intent.type === 'search') window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [intent?.id]);

  const handleCreateProject = async (title: string, description: string, targetLanguage: TargetLanguageCode) => {
    if (!profile) return;
    const newProject = await projectService.createProject(profile.id, title, description, targetLanguage);
    setProjects((current) => [newProject, ...current]);
  };
  const handleUpdateProject = async (projectId: string, title: string, description: string) => {
    await projectService.updateProject(projectId, title, description);
    setProjects((current) => current.map((project) => project.id === projectId ? { ...project, title, description } : project));
  };
  const handleConfirmDeleteProject = async () => {
    if (!deletingProject) return;
    await projectService.deleteProject(deletingProject.id);
    setProjects((current) => current.filter((project) => project.id !== deletingProject.id));
    setDeletingProject(null);
  };

  const normalizedSearch = searchQuery.toLowerCase();
  const filteredProjects = projects.filter((project) => project.title.toLowerCase().includes(normalizedSearch) || Boolean(project.description?.toLowerCase().includes(normalizedSearch)));

  return (
    <div className="workspace-page ui-container py-9 sm:py-12 space-y-8">
      <section className="workspace-page-header">
        <div className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.035em]">{t('dashboard.title')}</h1>
          <p className="text-sm sm:text-base ui-muted mt-2 leading-relaxed">{t('dashboard.description')}</p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="ui-button ui-button-primary shrink-0"><Plus className="size-4" /><span>{t('project.create')}</span></button>
      </section>

      <section className="workspace-toolbar">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 ui-soft pointer-events-none" />
          <input ref={searchRef} type="search" placeholder={t('dashboard.searchPlaceholder')} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="ui-input workspace-search-input" />
        </div>
      </section>

      {loading ? (
        <div className="project-grid" aria-label={t('accessibility.loadingProjects')} role="status">
          {[0, 1, 2].map((item) => <div key={item} className="project-card ui-card-flat p-5 space-y-4"><div className="ui-skeleton h-10 w-10" /><div className="ui-skeleton h-5 w-2/3" /><div className="ui-skeleton h-12 w-full" /><div className="ui-skeleton h-4 w-1/2" /></div>)}
        </div>
      ) : loadError ? (
        <div className="workspace-empty-state" role="alert"><AlertCircle className="size-8 text-[var(--ui-danger)]" /><p className="text-sm font-bold">{loadError}</p><button onClick={() => void loadProjects()} className="ui-button ui-button-secondary">{t('dashboard.retryLoad')}</button></div>
      ) : filteredProjects.length === 0 && searchQuery ? (
        <div className="workspace-empty-state"><Search className="size-8 ui-soft" /><div><h2 className="text-base font-bold">{t('dashboard.noSearchResults.title')}</h2><p className="text-xs ui-muted mt-1">{t('dashboard.noSearchResults.description')}</p></div></div>
      ) : (
        <div className="project-grid">
          {!searchQuery && (
            <button type="button" onClick={() => setIsCreateOpen(true)} className="project-create-tile ui-focus-ring">
              <span className="project-create-icon"><FolderPlus className="size-5" /></span>
              <span className="text-base font-extrabold">{t('dashboard.createTileTitle')}</span>
              <span className="text-xs ui-muted leading-relaxed">{t('dashboard.createTileDescription')}</span>
            </button>
          )}
          {filteredProjects.map((project) => <ProjectCard key={project.id} project={project} onSelect={onSelectProject} onEdit={setEditingProject} onDelete={setDeletingProject} />)}
        </div>
      )}

      <CreateProjectModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSubmit={handleCreateProject} />
      {editingProject && <EditProjectModal isOpen project={editingProject} onClose={() => setEditingProject(null)} onSubmit={handleUpdateProject} />}
      {deletingProject && <ConfirmDialog isOpen onClose={() => setDeletingProject(null)} onConfirm={handleConfirmDeleteProject} title={t('project.deleteProjectTitle')} message={t('project.deleteProjectMessage', { name: deletingProject.title })} confirmText={t('project.deleteProjectAction')} type="danger" />}
    </div>
  );
};
