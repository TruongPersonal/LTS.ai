import { supabase } from '../lib/supabase';
import type { Project, TargetLanguageCode } from '../types/database';

export const projectService = {
  async getProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, files_media(count)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting projects:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      ...item,
      files_count: item.files_media?.[0]?.count || 0,
    }));
  },

  async getProjectById(projectId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('Error getting project details:', error);
      return null;
    }

    return data;
  },

  async createProject(
    userId: string,
    title: string,
    description: string,
    targetLanguage: TargetLanguageCode
  ): Promise<Project> {
    // Get current authenticated user ID directly from Supabase Auth Session
    const { data: { user } } = await supabase.auth.getUser();
    const activeUserId = user?.id || userId;

    const newProject = {
      user_id: activeUserId,
      title,
      description: description || null,
      target_language: targetLanguage,
    };

    const { data, error } = await supabase
      .from('projects')
      .insert([newProject])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error creating project:', error);
      throw new Error(error.message || 'Không thể tạo dự án trên Supabase Database');
    }

    return data;
  },

  async updateProject(
    projectId: string,
    title: string,
    description: string
  ): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({ title, description, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    if (error) throw error;
  },

  async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
  },
};
