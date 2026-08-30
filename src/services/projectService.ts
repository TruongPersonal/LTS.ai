import { supabase } from '../lib/supabase';
import type { Project, TargetLanguageCode } from '../types/database';

export const projectService = {
  async getProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, files_media(count)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => ({
      ...item,
      files_count: item.files_media?.[0]?.count || 0,
    }));
  },

  async getProjectById(projectId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createProject(
    userId: string,
    title: string,
    description: string,
    targetLanguage: TargetLanguageCode
  ): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert([{ user_id: userId, title, description: description || null, target_language: targetLanguage }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProject(projectId: string, title: string, description: string): Promise<void> {
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
