import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project, TargetLanguageCode } from '../types/database';
import { projectService } from '../services/projectService';

export const useProjects = (userId?: string | null) => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadProjects = useCallback(async () => {
    if (!userId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const data = await projectService.getProjects(userId);
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setLoadError(t('dashboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(
    async (title: string, description: string, targetLanguage: TargetLanguageCode): Promise<Project> => {
      if (!userId) throw new Error('User not authenticated');
      const newProject = await projectService.createProject(userId, title, description, targetLanguage);
      setProjects((current) => [newProject, ...current]);
      return newProject;
    },
    [userId]
  );

  const updateProject = useCallback(
    async (projectId: string, title: string, description: string): Promise<void> => {
      await projectService.updateProject(projectId, title, description);
      setProjects((current) =>
        current.map((p) => (p.id === projectId ? { ...p, title, description } : p))
      );
    },
    []
  );

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    await projectService.deleteProject(projectId);
    setProjects((current) => current.filter((p) => p.id !== projectId));
  }, []);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const normalized = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(normalized) ||
        Boolean(p.description?.toLowerCase().includes(normalized))
    );
  }, [projects, searchQuery]);

  return {
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
  };
};
