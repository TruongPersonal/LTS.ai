import { getGoogleAccessToken, supabase } from '../lib/supabase';
import type { FileMedia, InputSource } from '../types/database';
import type { ProcessingProgressCallback } from '../types/processing';
import i18n from '../i18n';
import {
  assertDailyDurationAvailable,
  emitProgress,
  getTodayProcessedDurationSeconds,
  invokeJson,
  processSingleFile,
} from './mediaProcessingPipeline';

const FILE_PROCESSING_CONCURRENCY = 1;

export const fileService = {
  getTodayProcessedDurationSeconds,

  async getFilesByProject(projectId: string): Promise<FileMedia[]> {
    void invokeJson({
      action: 'recover_stale_files',
      project_id: projectId,
    }).catch(() => undefined);

    const { data, error } = await supabase
      .from('files_media')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getFileById(fileId: string): Promise<FileMedia | null> {
    const { data, error } = await supabase
      .from('files_media')
      .select('*')
      .eq('id', fileId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async addFile(
    projectId: string,
    driveFileId: string,
    fileName: string,
    mimeType: string,
    durationSeconds: number,
    inputSource: InputSource = 'media',
    detectedSourceLang: string | null = null
  ): Promise<FileMedia> {
    const { data: existing } = await supabase
      .from('files_media')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('drive_file_id', driveFileId)
      .maybeSingle();

    if (existing) {
      throw new Error(i18n.t('media.drive.duplicateFile'));
    }

    if (durationSeconds > 0) {
      await assertDailyDurationAvailable(durationSeconds);
    }

    const newFile = {
      project_id: projectId,
      drive_file_id: driveFileId,
      file_name: fileName,
      mime_type: mimeType,
      input_source: inputSource,
      detected_source_lang: detectedSourceLang,
    };

    const { data, error } = await supabase
      .from('files_media')
      .insert(newFile)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async startProcessingAllDrafts(
    projectId: string,
    onProgress?: ProcessingProgressCallback
  ): Promise<void> {
    const { data: processableFiles, error: filesError } = await supabase
      .from('files_media')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'draft')
      .order('created_at', { ascending: true });

    if (filesError) throw filesError;
    if (!processableFiles?.length) return;

    for (const file of processableFiles as FileMedia[]) {
      emitProgress(onProgress, file.id, 'queued', 0, i18n.t('processing.waiting', 'Đang chờ xử lý...'));
    }

    const hasMediaFile = processableFiles.some((file) => file.input_source === 'media');
    const accessToken = hasMediaFile ? await getGoogleAccessToken() : '';

    const files = processableFiles as FileMedia[];
    const failures: string[] = [];
    let nextFileIndex = 0;

    const processNextFile = async (): Promise<void> => {
      while (nextFileIndex < files.length) {
        const file = files[nextFileIndex];
        nextFileIndex += 1;
        try {
          await processSingleFile(projectId, file, accessToken, onProgress);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown processing error';
          failures.push(`${file.file_name}: ${message}`);
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(FILE_PROCESSING_CONCURRENCY, files.length) },
        () => processNextFile()
      )
    );

    if (failures.length) {
      throw new Error(failures.join('\n'));
    }
  },

  async retryProcessingFile(
    projectId: string,
    fileId: string,
    onProgress?: ProcessingProgressCallback
  ): Promise<void> {
    const { data: file, error: fileError } = await supabase
      .from('files_media')
      .select('*')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .single();

    if (fileError) throw fileError;
    if (!file || file.status !== 'failed') return;

    emitProgress(onProgress, file.id, 'queued', 0, i18n.t('processing.retryPreparing', 'Đang chuẩn bị thử lại...'));
    const accessToken = file.input_source === 'media' ? await getGoogleAccessToken() : '';

    await processSingleFile(projectId, file as FileMedia, accessToken, onProgress);
  },

  async processSingleDraftFile(
    projectId: string,
    file: FileMedia,
    onProgress?: ProcessingProgressCallback
  ): Promise<void> {
    const accessToken = file.input_source === 'media' ? await getGoogleAccessToken() : '';
    await processSingleFile(projectId, file, accessToken, onProgress);
  },

  async updateFileName(fileId: string, fileName: string): Promise<void> {
    const { error } = await supabase.from('files_media').update({ file_name: fileName }).eq('id', fileId);
    if (error) throw error;
  },

  async deleteFile(fileId: string): Promise<void> {
    const { error } = await supabase.from('files_media').delete().eq('id', fileId);
    if (error) throw error;
  },

  async resetFailedFiles(projectId: string): Promise<void> {
    await invokeJson({
      action: 'reset_failed_files',
      project_id: projectId,
    });
  },
};
