import { supabase } from '../lib/supabase';
import type { FileMedia, Plan, Profile, Project } from '../types/database';

export type AdminOverview = {
  users: {
    total: number;
    by_plan: Record<Plan, number>;
  };
  projects: { total: number };
  files: {
    total: number;
    completed: number;
    failed: number;
  };
};

export type AdminUser = Pick<
  Profile,
  'id' | 'email' | 'full_name' | 'role' | 'plan' | 'daily_processed_seconds' | 'last_processed_date' | 'created_at'
>;

export type AdminProject = Pick<
  Project,
  'id' | 'title' | 'description' | 'target_language' | 'created_at' | 'updated_at'
>;

export type AdminFile = Pick<
  FileMedia,
  | 'id'
  | 'project_id'
  | 'file_name'
  | 'mime_type'
  | 'duration_seconds'
  | 'detected_source_lang'
  | 'status'
  | 'input_source'
  | 'error_message'
  | 'created_at'
>;

export type AdminUserDetail = {
  profile: AdminUser;
  projects: AdminProject[];
  files: AdminFile[];
};

type UserListResult = {
  users: AdminUser[];
  page: number;
  page_size: number;
  total: number;
};

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

  listUsers(search: string, page: number, pageSize = 20): Promise<UserListResult> {
    return invokeAdmin<UserListResult>({
      action: 'list_users',
      search,
      page,
      page_size: pageSize,
    });
  },

  getUserDetail(userId: string): Promise<AdminUserDetail> {
    return invokeAdmin<AdminUserDetail>({ action: 'get_user_detail', user_id: userId });
  },

  setUserPlan(userId: string, plan: Plan): Promise<void> {
    return invokeAdmin({ action: 'set_user_plan', user_id: userId, plan });
  },
};
