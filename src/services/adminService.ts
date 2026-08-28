import { supabase } from '../lib/supabase';
import type { FileMedia, Plan, Profile, SubtitleItem } from '../types/database';

export type AdminOverview = {
  revenue: {
    estimated_mrr: number;
    currency: string;
    source?: string;
  };
  users: {
    total: number;
    by_plan: Record<Plan, number>;
  };
  projects: { total: number };
  files: {
    total: number;
    completed: number;
    failed: number;
    total_processed_seconds: number;
    success_rate: number;
  };
};

export type AdminUser = Pick<
  Profile,
  'id' | 'email' | 'full_name' | 'role' | 'plan' | 'plan_expires_at' | 'daily_processed_seconds' | 'last_processed_date' | 'created_at'
>;

export type AdminProjectItem = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_language: string;
  created_at: string;
  updated_at: string;
  user_email: string;
  user_name: string;
  files_count: number;
};

export type AdminFile = Pick<
  FileMedia,
  | 'id'
  | 'project_id'
  | 'drive_file_id'
  | 'file_name'
  | 'mime_type'
  | 'duration_seconds'
  | 'detected_source_lang'
  | 'status'
  | 'input_source'
  | 'error_message'
  | 'created_at'
>;

export type AdminSubtitle = {
  id: string;
  file_id: string;
  language: string;
  content: SubtitleItem[];
  is_edited: boolean;
  updated_at: string;
};

export type SystemConfig = {
  quotas: {
    free_daily_minutes: number;
    free_max_file_size_mb: number;
    pro_daily_minutes: number;
    pro_max_file_size_mb: number;
    max_daily_minutes: number;
    max_max_file_size_mb: number;
  };
  models: {
    asr_primary_model: string;
    asr_fallback_model: string;
    translation_primary_model: string;
    translation_fallback_models: string[];
    available_asr_models: Array<{ id: string; name: string }>;
    available_translation_models: Array<{ id: string; name: string }>;
  };
  api_status: {
    groq_configured: boolean;
    gemini_configured: boolean;
    stripe_configured: boolean;
    groq_key_masked?: string;
    gemini_key_masked?: string;
    stripe_key_masked?: string;
  };
};

export type AdminAuditLog = {
  id: string;
  actor_user_id: string;
  target_user_id: string | null;
  action: string;
  old_value: unknown;
  new_value: {
    actor_email?: string;
    target_email?: string;
    target_name?: string;
    project_title?: string;
    file_name?: string;
    new_role?: string;
    quotas?: unknown;
    models?: unknown;
    api_keys_updated?: unknown;
    [key: string]: unknown;
  } | null;
  created_at: string;
};

type PaginatedResult<T> = {
  page: number;
  page_size: number;
  total: number;
} & T;

async function invokeAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const adminService = {
  getOverview(): Promise<AdminOverview> {
    return invokeAdmin<AdminOverview>({ action: 'overview' });
  },

  listUsers(
    search = '',
    page = 1,
    pageSize = 15,
    plan = '',
    role = ''
  ): Promise<PaginatedResult<{ users: AdminUser[] }>> {
    return invokeAdmin<PaginatedResult<{ users: AdminUser[] }>>({
      action: 'list_users',
      search,
      page,
      page_size: pageSize,
      plan,
      role,
    });
  },

  setUserRole(userId: string, role: 'admin' | 'user'): Promise<{ success: boolean; message: string }> {
    return invokeAdmin({ action: 'set_user_role', user_id: userId, role });
  },

  deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    return invokeAdmin({ action: 'delete_user', user_id: userId });
  },

  listProjects(
    search = '',
    page = 1,
    pageSize = 15
  ): Promise<PaginatedResult<{ projects: AdminProjectItem[] }>> {
    return invokeAdmin<PaginatedResult<{ projects: AdminProjectItem[] }>>({
      action: 'list_projects',
      search,
      page,
      page_size: pageSize,
    });
  },

  getProjectFiles(projectId: string): Promise<{ files: AdminFile[] }> {
    return invokeAdmin<{ files: AdminFile[] }>({
      action: 'get_project_files',
      project_id: projectId,
    });
  },

  getFileSubtitles(fileId: string): Promise<{ subtitles: AdminSubtitle[] }> {
    return invokeAdmin<{ subtitles: AdminSubtitle[] }>({
      action: 'get_file_subtitles',
      file_id: fileId,
    });
  },

  deleteProject(projectId: string): Promise<{ success: boolean; message: string }> {
    return invokeAdmin({ action: 'delete_project', project_id: projectId });
  },

  deleteFile(fileId: string): Promise<{ success: boolean; message: string }> {
    return invokeAdmin({ action: 'delete_file', file_id: fileId });
  },

  deleteSubtitles(fileId: string): Promise<{ success: boolean; message: string }> {
    return invokeAdmin({ action: 'delete_subtitles', file_id: fileId });
  },

  getSystemConfig(): Promise<SystemConfig> {
    return invokeAdmin<SystemConfig>({ action: 'get_system_config' });
  },

  updateSystemConfig(config: {
    quotas?: SystemConfig['quotas'];
  }): Promise<{ success: boolean; message: string }> {
    return invokeAdmin({ action: 'update_system_config', ...config });
  },

  listAuditLogs(page = 1, pageSize = 20): Promise<PaginatedResult<{ logs: AdminAuditLog[] }>> {
    return invokeAdmin<PaginatedResult<{ logs: AdminAuditLog[] }>>({
      action: 'list_audit_logs',
      page,
      page_size: pageSize,
    });
  },
};
