import { getGoogleAccessToken, supabase } from '../lib/supabase';
import type { FileMedia, InputSource } from '../types/database';
import type { ProcessingProgressCallback, ProcessingStage } from '../types/processing';
import { extractFlacChunks, type AudioChunk } from './mediaAudioPreprocessor';
import {
  getTranscriptionProgressPercent,
  mergeTranscriptionChunks,
  type TranscriptionChunkResult,
} from '../utils/mediaProcessing';
import i18n from '../i18n';

type EdgeResult = {
  error?: string;
  code?: string;
  retryable?: boolean;
  provider_status?: number;
  source_language?: string;
  subtitles?: Array<{ id: number; start: number; end: number; text: string }>;
};

class EdgeInvocationError extends Error {
  readonly code?: string;
  readonly retryable?: boolean;
  readonly providerStatus?: number;

  constructor(payload: EdgeResult) {
    super(String(payload.error || 'Edge Function request failed.'));
    this.name = 'EdgeInvocationError';
    this.code = payload.code;
    this.retryable = payload.retryable;
    this.providerStatus = payload.provider_status;
  }
}

const emitProgress = (
  onProgress: ProcessingProgressCallback | undefined,
  fileId: string,
  stage: ProcessingStage,
  percent: number,
  message: string,
  chunkIndex?: number,
  chunkCount?: number
) => {
  onProgress?.({
    fileId,
    stage,
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    message,
    ...(chunkIndex === undefined ? {} : { chunkIndex }),
    ...(chunkCount === undefined ? {} : { chunkCount }),
  });
};

async function downloadDriveMedia(file: FileMedia, accessToken: string): Promise<Blob> {
  if (!accessToken) {
    throw new Error(i18n.t('editor.video.downloadFailed'));
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(i18n.t('editor.video.downloadFailed'));
    }
    throw new Error(`Google Drive tải media thất bại (${response.status}): ${detail.slice(0, 240)}`);
  }

  const blob = await response.blob();
  if (blob.size === 0) throw new Error('Google Drive trả về tệp media rỗng.');
  return blob;
}

async function handleInvokeError(error: any): Promise<never> {
  if (error && typeof error === 'object' && 'context' in error && error.context) {
    try {
      const resJson = (await error.context.json()) as EdgeResult;
      if (resJson?.error) {
        throw new EdgeInvocationError(resJson);
      }
    } catch (parsedError) {
      if (parsedError instanceof EdgeInvocationError) throw parsedError;
    }
  }
  throw error;
}

async function invokeJson(body: Record<string, unknown>): Promise<EdgeResult> {
  const { data, error } = await supabase.functions.invoke('process-media', { body });
  if (error) await handleInvokeError(error);
  if (data?.error) throw new Error(data.error);
  return data || {};
}

async function transcribeChunk(
  projectId: string,
  fileId: string,
  chunk: AudioChunk
): Promise<TranscriptionChunkResult> {
  const formData = new FormData();
  formData.append('action', 'transcribe_chunk');
  formData.append('project_id', projectId);
  formData.append('file_id', fileId);
  formData.append('chunk_start_seconds', String(chunk.startSeconds));
  formData.append('audio', chunk.blob, chunk.fileName);

  const { data, error } = await supabase.functions.invoke('process-media', {
    body: formData,
  });
  if (error) await handleInvokeError(error);
  if (data?.error) throw new Error(data.error);
  if (!data?.source_language || !Array.isArray(data?.subtitles)) {
    throw new Error('Edge Function trả về kết quả transcription không hợp lệ.');
  }

  return {
    sourceLanguage: String(data.source_language),
    subtitles: data.subtitles,
  };
}

function sanitizeErrorMessage(rawError: unknown): string {
  if (rawError instanceof EdgeInvocationError) {
    if (rawError.code === 'TRANSCRIPTION_PROVIDER_UNAVAILABLE') {
      return i18n.t('media.systemQuotaExceeded');
    }
    if (rawError.code === 'TRANSCRIPTION_PROVIDER_REQUEST_FAILED') {
      return i18n.t('processing.processFailed');
    }
  }

  const rawMessage = rawError instanceof Error ? rawError.message : String(rawError || '');
  
  // 1. Connection & Local Load & Processing Payload errors
  if (
    !rawMessage ||
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('Failed to send a request') ||
    rawMessage.includes('FunctionsFetchError') ||
    rawMessage.includes('Relay Error') ||
    rawMessage.toLowerCase().includes('load failed') ||
    rawMessage.toLowerCase().includes('ffmpeg') ||
    rawMessage.toLowerCase().includes('unexpected number of subtitle cues') ||
    rawMessage.toLowerCase().includes('returned invalid json') ||
    rawMessage.toLowerCase().includes('returned an empty response') ||
    rawMessage.toLowerCase().includes('duplicate subtitle ids') ||
    rawMessage.toLowerCase().includes('all translation models failed') ||
    rawMessage.toLowerCase().includes('all transcription models failed')
  ) {
    return i18n.t('processing.processFailed');
  }

  // 2. Rate Limit (429) errors
  if (rawMessage.includes('429') || rawMessage.toLowerCase().includes('rate limit')) {
    return i18n.t('media.systemQuotaExceeded');
  }

  // 3. Server 500 / Http Errors
  if (
    rawMessage.includes('non-2xx status code') ||
    rawMessage.includes('FunctionsHttpError') ||
    rawMessage.includes('500') ||
    rawMessage.includes('502') ||
    rawMessage.includes('503') ||
    rawMessage.includes('504') ||
    rawMessage.includes('model_decommissioned')
  ) {
    return i18n.t('media.serverError');
  }

  return rawMessage;
}

async function markFailed(projectId: string, fileId: string, error: unknown): Promise<void> {
  const message = sanitizeErrorMessage(error);
  try {
    await invokeJson({
      action: 'mark_failed',
      project_id: projectId,
      file_id: fileId,
      error_message: message.slice(0, 1000),
    });
  } catch (markError) {
    console.error('Could not mark file as failed:', markError);
  }
}

function getBlobDurationSeconds(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const media = document.createElement(blob.type.startsWith('audio/') ? 'audio' : 'video');
      media.src = url;
      media.onloadedmetadata = () => {
        const dur = Math.round(media.duration || 0);
        URL.revokeObjectURL(url);
        resolve(dur);
      };
      media.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
    } catch {
      resolve(0);
    }
  });
}

async function processMediaFile(
  projectId: string,
  file: FileMedia,
  accessToken: string,
  onProgress?: ProcessingProgressCallback
): Promise<void> {
  try {
    await supabase.from('files_media').update({ status: 'processing', error_message: null }).eq('id', file.id);
    emitProgress(onProgress, file.id, 'downloading', 10, 'Đang tải...');
    const mediaBlob = await downloadDriveMedia(file, accessToken);

    let effectiveDuration = file.duration_seconds || 0;
    const exactDuration = await getBlobDurationSeconds(mediaBlob);
    if (exactDuration > 0) {
      const todayProcessed = await fileService.getTodayProcessedDurationSeconds();
      if (todayProcessed + exactDuration > 3600) {
        throw new Error(i18n.t('media.drive.dailyDurationExceeded'));
      }
      if (exactDuration !== file.duration_seconds) {
        effectiveDuration = exactDuration;
        await supabase.from('files_media').update({ duration_seconds: exactDuration }).eq('id', file.id);
      }
    }

    emitProgress(onProgress, file.id, 'preprocessing', 25, 'Đang khởi tạo FFmpeg và tách audio...');

    const chunkResults: TranscriptionChunkResult[] = [];
    let sawChunk = false;

    for await (const chunk of extractFlacChunks(
      mediaBlob,
      file.mime_type || mediaBlob.type,
      file.id
    )) {
      if (!sawChunk) {
        emitProgress(
          onProgress,
          file.id,
          'preprocessing',
          45,
          `Đã tạo ${chunk.chunkCount} FLAC chunk (16 kHz mono).`,
          0,
          chunk.chunkCount
        );
        sawChunk = true;
      }

      const transcriptionPercent = getTranscriptionProgressPercent(chunk.index, chunk.chunkCount);
      emitProgress(
        onProgress,
        file.id,
        'transcribing',
        transcriptionPercent,
        `Đang nhận dạng giọng nói · chunk ${chunk.index + 1}/${chunk.chunkCount}`,
        chunk.index + 1,
        chunk.chunkCount
      );
      chunkResults.push(await transcribeChunk(projectId, file.id, chunk));
    }

    emitProgress(onProgress, file.id, 'finalizing', 86, 'Đang ghép các đoạn phụ đề...');
    const merged = mergeTranscriptionChunks(chunkResults);

    emitProgress(onProgress, file.id, 'finalizing', 90, 'Đang dịch và lưu phụ đề...');
    await invokeJson({
      action: 'finalize_media',
      project_id: projectId,
      file_id: file.id,
      source_language: merged.sourceLanguage,
      subtitles: merged.subtitles,
    });

    await fileService.recordProcessedDurationSeconds(effectiveDuration);
    emitProgress(onProgress, file.id, 'completed', 100, 'Hoàn thành xử lý video.');
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    await markFailed(projectId, file.id, message);
    emitProgress(onProgress, file.id, 'failed', 100, message);
    throw new Error(message);
  }
}

async function processExistingSubtitleFile(
  projectId: string,
  file: FileMedia,
  onProgress?: ProcessingProgressCallback
): Promise<void> {
  try {
    emitProgress(onProgress, file.id, 'preparing', 20, 'Đang chuẩn bị phụ đề đã nhập...');
    emitProgress(onProgress, file.id, 'finalizing', 75, 'Đang dịch và lưu phụ đề...');
    await invokeJson({
      action: 'process_existing_subtitle',
      project_id: projectId,
      file_id: file.id,
    });
    emitProgress(onProgress, file.id, 'completed', 100, 'Hoàn thành xử lý phụ đề.');
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    await markFailed(projectId, file.id, message);
    emitProgress(onProgress, file.id, 'failed', 100, message);
    throw new Error(message);
  }
}

async function processSingleFile(
  projectId: string,
  file: FileMedia,
  accessToken: string,
  onProgress?: ProcessingProgressCallback
): Promise<void> {
  emitProgress(onProgress, file.id, 'preparing', 5, 'Đang chuẩn bị xử lý...');
  if (file.input_source === 'existing_subtitle') {
    await processExistingSubtitleFile(projectId, file, onProgress);
    return;
  }
  await processMediaFile(projectId, file, accessToken, onProgress);
}

export const fileService = {
  async getTodayProcessedDurationSeconds(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('daily_processed_seconds, last_processed_date')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !profile) return 0;

      const todayStr = new Date().toISOString().split('T')[0];
      if (profile.last_processed_date !== todayStr) {
        return 0;
      }
      return profile.daily_processed_seconds || 0;
    } catch (err) {
      console.warn('Could not query profile processed duration:', err);
      return 0;
    }
  },

  async recordProcessedDurationSeconds(durationSeconds: number): Promise<void> {
    if (durationSeconds <= 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStr = new Date().toISOString().split('T')[0];
      const { data: profile } = await supabase
        .from('profiles')
        .select('daily_processed_seconds, last_processed_date')
        .eq('id', user.id)
        .maybeSingle();

      let nextSeconds = durationSeconds;
      if (profile && profile.last_processed_date === todayStr) {
        nextSeconds = (profile.daily_processed_seconds || 0) + durationSeconds;
      }

      await supabase.from('profiles').update({
        daily_processed_seconds: nextSeconds,
        last_processed_date: todayStr,
      }).eq('id', user.id);
    } catch (err) {
      console.warn('Could not record processed duration to profile:', err);
    }
  },

  async getFilesByProject(projectId: string): Promise<FileMedia[]> {
    await supabase
      .from('files_media')
      .update({ status: 'draft' })
      .eq('project_id', projectId)
      .in('status', ['queued', 'processing']);

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
      if (existing.status === 'failed') {
        const { data: resetData, error: resetError } = await supabase
          .from('files_media')
          .update({
            status: 'draft',
            file_name: fileName,
            mime_type: mimeType,
            duration_seconds: durationSeconds,
            input_source: inputSource,
            detected_source_lang: detectedSourceLang,
            error_message: null,
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (resetError) throw resetError;
        return resetData;
      }
      throw new Error(i18n.t('media.drive.duplicateFile'));
    }

    if (durationSeconds > 0) {
      const todayDuration = await this.getTodayProcessedDurationSeconds();
      if (todayDuration + durationSeconds > 3600) {
        throw new Error(i18n.t('media.drive.dailyDurationExceeded'));
      }
    }

    const newFile: Partial<FileMedia> = {
      project_id: projectId,
      drive_file_id: driveFileId,
      file_name: fileName,
      mime_type: mimeType,
      duration_seconds: durationSeconds,
      status: 'draft',
      input_source: inputSource,
      detected_source_lang: detectedSourceLang,
      error_message: null,
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

    const draftIds = processableFiles.map((f) => f.id);
    await supabase.from('files_media').update({ status: 'queued' }).in('id', draftIds);

    for (const file of processableFiles as FileMedia[]) {
      emitProgress(onProgress, file.id, 'queued', 0, 'Đang chờ xử lý...');
    }

    const hasMediaFile = processableFiles.some((file) => file.input_source === 'media');
    const accessToken = hasMediaFile ? await getGoogleAccessToken() : '';
    if (hasMediaFile && !accessToken) {
      const error = new Error('Không thể tải tệp. Phiên Google Drive đã hết hạn.');
      for (const file of processableFiles as FileMedia[]) {
        if (file.input_source === 'media') {
          await supabase.from('files_media').update({ status: 'failed', error_message: error.message }).eq('id', file.id);
          emitProgress(onProgress, file.id, 'failed', 100, error.message);
        }
      }
      throw error;
    }

    const failures: string[] = [];
    for (const file of processableFiles as FileMedia[]) {
      try {
        await processSingleFile(projectId, file, accessToken, onProgress);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown processing error';
        failures.push(`${file.file_name}: ${message}`);
      }
    }

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
    if (file.status !== 'failed') {
      throw new Error('Tệp này không còn ở trạng thái thất bại.');
    }

    emitProgress(onProgress, file.id, 'queued', 0, 'Đang chuẩn bị thử lại...');
    const accessToken = file.input_source === 'media' ? await getGoogleAccessToken() : '';
    if (file.input_source === 'media' && !accessToken) {
      const error = new Error('Google Drive access token is missing. Vui lòng đăng nhập lại bằng Google.');
      emitProgress(onProgress, file.id, 'failed', 100, error.message);
      throw error;
    }

    await processSingleFile(projectId, file as FileMedia, accessToken, onProgress);
  },

  async updateFileName(fileId: string, fileName: string): Promise<void> {
    const { error } = await supabase.from('files_media').update({ file_name: fileName }).eq('id', fileId);
    if (error) throw error;
  },

  async deleteFile(fileId: string): Promise<void> {
    const { error } = await supabase.from('files_media').delete().eq('id', fileId);
    if (error) throw error;
  },
};
