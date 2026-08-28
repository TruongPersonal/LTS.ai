export type TargetLanguageCode = 'vi' | 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'it';

export type FileStatus = 'draft' | 'processing' | 'completed' | 'failed';

export type InputSource = 'media' | 'existing_subtitle';

export type Plan = 'free' | 'pro' | 'max';

export type UserRole = 'user' | 'admin';

export interface PlanLimits {
  maxFileSizeBytes: number;
  dailyDurationSeconds: number;
}

export interface RawQuotasConfig {
  free_daily_minutes?: number;
  free_max_file_size_mb?: number;
  pro_daily_minutes?: number;
  pro_max_file_size_mb?: number;
  max_daily_minutes?: number;
  max_max_file_size_mb?: number;
}

export const DEFAULT_PLAN: Plan = 'free';

export const DEFAULT_PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxFileSizeBytes: 50 * 1024 * 1024,
    dailyDurationSeconds: 10 * 60,
  },
  pro: {
    maxFileSizeBytes: 200 * 1024 * 1024,
    dailyDurationSeconds: 60 * 60,
  },
  max: {
    maxFileSizeBytes: 500 * 1024 * 1024,
    dailyDurationSeconds: 300 * 60,
  },
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { ...DEFAULT_PLAN_LIMITS.free },
  pro: { ...DEFAULT_PLAN_LIMITS.pro },
  max: { ...DEFAULT_PLAN_LIMITS.max },
};

type LimitsListener = (limits: Record<Plan, PlanLimits>) => void;
const listeners = new Set<LimitsListener>();

export function updatePlanLimitsFromQuotas(quotas: RawQuotasConfig) {
  if (quotas.free_daily_minutes != null) {
    PLAN_LIMITS.free.dailyDurationSeconds = Number(quotas.free_daily_minutes) * 60;
  }
  if (quotas.free_max_file_size_mb != null) {
    PLAN_LIMITS.free.maxFileSizeBytes = Number(quotas.free_max_file_size_mb) * 1024 * 1024;
  }
  if (quotas.pro_daily_minutes != null) {
    PLAN_LIMITS.pro.dailyDurationSeconds = Number(quotas.pro_daily_minutes) * 60;
  }
  if (quotas.pro_max_file_size_mb != null) {
    PLAN_LIMITS.pro.maxFileSizeBytes = Number(quotas.pro_max_file_size_mb) * 1024 * 1024;
  }
  if (quotas.max_daily_minutes != null) {
    PLAN_LIMITS.max.dailyDurationSeconds = Number(quotas.max_daily_minutes) * 60;
  }
  if (quotas.max_max_file_size_mb != null) {
    PLAN_LIMITS.max.maxFileSizeBytes = Number(quotas.max_max_file_size_mb) * 1024 * 1024;
  }
  listeners.forEach((fn) => fn(PLAN_LIMITS));
}

export function subscribeToPlanLimits(fn: LimitsListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const PLAN_ORDER: readonly Plan[] = ['free', 'pro', 'max'];

export const isPlan = (value: unknown): value is Plan =>
  typeof value === 'string' && PLAN_ORDER.includes(value as Plan);

export const normalizePlan = (value: unknown): Plan => (isPlan(value) ? value : DEFAULT_PLAN);

export const isUserRole = (value: unknown): value is UserRole =>
  value === 'user' || value === 'admin';

export const normalizeUserRole = (value: unknown): UserRole =>
  isUserRole(value) ? value : 'user';

export const getPlanLimits = (value: unknown): PlanLimits => PLAN_LIMITS[normalizePlan(value)];

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  plan: Plan;
  plan_expires_at?: string | null;
  daily_processed_seconds?: number;
  last_processed_date?: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_language: TargetLanguageCode;
  created_at: string;
  updated_at: string;
  files_count?: number;
}

export interface FileMedia {
  id: string;
  project_id: string;
  drive_file_id: string;
  file_name: string;
  mime_type: string;
  duration_seconds: number | null;
  detected_source_lang: string | null;
  status: FileStatus;
  input_source: InputSource;
  error_message: string | null;
  processing_attempt_id?: string | null;
  processing_last_activity_at?: string | null;
  created_at: string;
}

export interface SubtitleItem {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface SubtitleRecord {
  id: string;
  file_id: string;
  language: string;
  content: SubtitleItem[];
  is_edited: boolean;
  updated_at: string;
}
