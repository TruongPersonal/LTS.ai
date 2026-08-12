export type TargetLanguageCode = 'vi' | 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'it';

export type FileStatus = 'draft' | 'queued' | 'processing' | 'completed' | 'failed';

export type InputSource = 'media' | 'existing_subtitle';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
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
