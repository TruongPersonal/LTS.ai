import { getGoogleAccessToken, supabase } from '../lib/supabase';
import { DEFAULT_PLAN, normalizePlan, PLAN_LIMITS, type FileMedia, type Plan } from '../types/database';
import type { ProcessingProgressCallback, ProcessingStage } from '../types/processing';
import { extractFlacChunks, type AudioChunk } from './mediaAudioPreprocessor';
import {
  getTranscriptionProgressPercent,
  mergeTranscriptionChunks,
  type TranscriptionChunkResult,
} from '../utils/mediaProcessing';
import i18n from '../i18n';

export type EdgeResult = {
  error?: string;
  code?: string;
  retryable?: boolean;
  provider_status?: number;
  attempt_id?: string;
  file?: FileMedia;
  source_language?: string;
  subtitles?: Array<{ id: number; start: number; end: number; text: string }>;
};

export class EdgeInvocationError extends Error {
  readonly code?: string;
  readonly retryable?: boolean;
  readonly providerStatus?: number;

  constructor(res: EdgeResult) {
    super(res.error || 'Edge Function Invocation Error');
    this.name = 'EdgeInvocationError';
    this.code = res.code;
    this.retryable = res.retryable;
    this.providerStatus = res.provider_status;
  }
}

export const emitProgress = (
  onProgress: ProcessingProgressCallback | undefined,
  fileId: string,
  stage: ProcessingStage,
  percent: number,
  message: string,
  chunkIndex?: number,
  chunkCount?: number
): void => {
  onProgress?.({
    fileId,
    stage,
    percent,
    message,
    ...(chunkIndex === undefined ? {} : { chunkIndex }),
    ...(chunkCount === undefined ? {} : { chunkCount }),
  });
};

export async function downloadDriveMedia(file: FileMedia, accessToken: string): Promise<Blob> {
  const token = accessToken || (await getGoogleAccessToken());
  if (!token) {
    throw new Error('Phiên làm việc Google Drive đã hết hạn (1 tiếng). Vui lòng đăng nhập lại.');
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Phiên làm việc Google Drive đã hết hạn (1 tiếng). Vui lòng đăng nhập lại.');
    }
    throw new Error(`Failed to download file from Google Drive (Status: ${response.status})`);
  }

  const blob = await response.blob();
  if (blob.size === 0) throw new Error('The Google Drive file contains no data.');
  return blob;
}

export async function handleInvokeError(error: unknown): Promise<never> {
  if (error && typeof error === 'object' && 'context' in error && error.context && typeof (error.context as any).json === 'function') {
    try {
      const resJson = (await (error.context as any).json()) as EdgeResult;
      if (resJson?.error) {
        throw new EdgeInvocationError(resJson);
      }
    } catch (parsedError) {
      if (parsedError instanceof EdgeInvocationError) throw parsedError;
    }
  }
  throw error;
}

export async function invokeJson(body: Record<string, unknown>): Promise<EdgeResult> {
  const { data, error } = await supabase.functions.invoke('process-media', { body });
  if (error) await handleInvokeError(error);
  if (data?.error) throw new Error(data.error);
  return data || {};
}

export async function transcribeChunk(
  projectId: string,
  fileId: string,
  attemptId: string,
  chunk: AudioChunk
): Promise<TranscriptionChunkResult> {
  const formData = new FormData();
  formData.append('action', 'transcribe_chunk');
  formData.append('project_id', projectId);
  formData.append('file_id', fileId);
  formData.append('attempt_id', attemptId);
  formData.append('chunk_index', String(chunk.index));
  formData.append('chunk_start_seconds', String(chunk.startSeconds));
  formData.append('audio', chunk.blob, chunk.fileName);

  const { data, error } = await supabase.functions.invoke('process-media', {
    body: formData,
  });
  if (error) await handleInvokeError(error);
  if (data?.error) throw new Error(data.error);
  if (!data?.source_language || !Array.isArray(data?.subtitles)) {
    throw new Error('System returned invalid transcription output.');
  }

  return {
    sourceLanguage: String(data.source_language),
    subtitles: data.subtitles,
  };
}

export function sanitizeErrorMessage(rawError: unknown): string {
  if (rawError instanceof EdgeInvocationError) {
    if (rawError.code === 'DAILY_QUOTA_EXCEEDED') {
      return 'You have reached your daily processing limit.';
    }
    if (rawError.code === 'TRANSCRIPTION_PROVIDER_UNAVAILABLE') {
      return 'System processing quota has been reached. Please try again later.';
    }
    if (rawError.code === 'TRANSCRIPTION_PROVIDER_REQUEST_FAILED') {
      return 'Unable to process media file. Please try again.';
    }
  }

  const rawMessage = rawError instanceof Error ? rawError.message : String(rawError || '');
  
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
    return 'Unable to process media file. Please try again.';
  }

  if (rawMessage.includes('429') || rawMessage.toLowerCase().includes('rate limit')) {
    return 'System processing quota has been reached. Please try again later.';
  }

  if (
    rawMessage.includes('non-2xx status code') ||
    rawMessage.includes('FunctionsHttpError') ||
    rawMessage.includes('500') ||
    rawMessage.includes('502') ||
    rawMessage.includes('503') ||
    rawMessage.includes('504') ||
    rawMessage.includes('model_decommissioned')
  ) {
    return 'Processing server encountered a temporary issue. Please try again.';
  }

  return rawMessage;
}

export async function markFailed(projectId: string, fileId: string, attemptId: string | null, error: unknown): Promise<void> {
  const message = sanitizeErrorMessage(error);
  try {
    await invokeJson({
      action: 'mark_failed',
      project_id: projectId,
      file_id: fileId,
      ...(attemptId ? { attempt_id: attemptId } : {}),
      error_message: message.slice(0, 1000),
    });
  } catch (markError) {
    console.error('Could not mark file as failed:', markError);
  }
}

export function getBlobDurationSeconds(blob: Blob): Promise<number> {
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

export async function getCurrentPlan(): Promise<Plan> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_PLAN;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile) return DEFAULT_PLAN;
    return normalizePlan(profile.plan);
  } catch (err) {
    console.warn('Could not query profile plan:', err);
    return DEFAULT_PLAN;
  }
}

export async function getTodayProcessedDurationSeconds(): Promise<number> {
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
}

export async function assertDailyDurationAvailable(durationSeconds: number): Promise<void> {
  if (durationSeconds <= 0) return;

  const [plan, todayProcessed] = await Promise.all([
    getCurrentPlan(),
    getTodayProcessedDurationSeconds(),
  ]);
  const limits = PLAN_LIMITS[plan];
  if (todayProcessed + durationSeconds > limits.dailyDurationSeconds) {
    throw new Error(
      i18n.t('media.drive.dailyDurationExceeded', {
        dailyDurationMinutes: Math.round(limits.dailyDurationSeconds / 60),
      })
    );
  }
}

export async function translateSubtitlesClientSide(
  projectId: string,
  fileId: string,
  sourceSubtitles: Array<{ id: number; start: number; end: number; text: string }>,
  sourceLanguage: string,
  targetLanguage: string,
  onProgress?: ProcessingProgressCallback
): Promise<Array<{ id: number; start: number; end: number; text: string }>> {
  if (sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) {
    return sourceSubtitles;
  }

  const BATCH_SIZE = 100;
  const translatedAll: Array<{ id: number; start: number; end: number; text: string }> = [];
  const totalBatches = Math.ceil(sourceSubtitles.length / BATCH_SIZE);

  for (let i = 0; i < sourceSubtitles.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    const batch = sourceSubtitles.slice(i, i + BATCH_SIZE);

    const progressPercent = 90 + Math.floor((batchIndex / totalBatches) * 8);
    emitProgress(
      onProgress,
      fileId,
      'finalizing',
      progressPercent,
      `Đang dịch phụ đề với Gemini 2.0 Flash · lô ${batchIndex}/${totalBatches}`,
      batchIndex,
      totalBatches
    );

    const res = await invokeJson({
      action: 'translate-batch',
      project_id: projectId,
      file_id: fileId,
      subtitles: batch,
      source_language: sourceLanguage,
      target_language: targetLanguage,
    });

    const batchTranslated = res.subtitles || [];
    translatedAll.push(...batchTranslated);
  }

  return sourceSubtitles.map((source, index) => {
    const translatedItem = translatedAll[index];
    return {
      id: index + 1,
      start: source.start,
      end: source.end,
      text: translatedItem?.text ? String(translatedItem.text).trim() : source.text,
    };
  });
}

export async function processMediaFile(
  projectId: string,
  file: FileMedia,
  accessToken: string,
  onProgress?: ProcessingProgressCallback
): Promise<void> {
  let attemptId = '';
  try {
    const started = await invokeJson({
      action: 'start_processing',
      project_id: projectId,
      file_id: file.id,
    });
    attemptId = String(started.attempt_id || '');
    if (!attemptId) throw new Error('Processing attempt was not created.');

    emitProgress(onProgress, file.id, 'downloading', 10, i18n.t('processing.downloading'));
    const mediaBlob = await downloadDriveMedia(file, accessToken);

    let effectiveDuration = file.duration_seconds || 0;
    const exactDuration = await getBlobDurationSeconds(mediaBlob);
    if (exactDuration > 0) {
      effectiveDuration = exactDuration;
    }
    await assertDailyDurationAvailable(effectiveDuration);

    emitProgress(onProgress, file.id, 'preprocessing', 25, i18n.t('processing.preprocessing'));

    const chunkResults: TranscriptionChunkResult[] = [];
    let sawChunk = false;

    const chunkIterator = extractFlacChunks(
      mediaBlob,
      file.mime_type || mediaBlob.type,
      file.id,
      effectiveDuration
    );
    const requestNextChunk = () => {
      const promise = chunkIterator.next();
      void promise.catch(() => undefined);
      return promise;
    };
    let nextChunkPromise: Promise<IteratorResult<AudioChunk, void>> | null = requestNextChunk();

    try {
      while (nextChunkPromise) {
        const nextChunk = await nextChunkPromise;
        if (nextChunk.done) {
          nextChunkPromise = null;
          break;
        }

        const chunk = nextChunk.value;
        nextChunkPromise = requestNextChunk();

        if (!sawChunk) {
          emitProgress(
            onProgress,
            file.id,
            'preprocessing',
            45,
            i18n.t('processing.preprocessing'),
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
          i18n.t('processing.transcribingChunk', { index: chunk.index + 1, count: chunk.chunkCount }),
          chunk.index + 1,
          chunk.chunkCount
        );
        chunkResults.push(await transcribeChunk(projectId, file.id, attemptId, chunk));
      }
    } finally {
      if (nextChunkPromise) {
        await nextChunkPromise.catch(() => undefined);
      }
      await chunkIterator.return().catch(() => undefined);
    }

    emitProgress(onProgress, file.id, 'finalizing', 86, i18n.t('processing.saving'));
    const merged = mergeTranscriptionChunks(chunkResults);

    await supabase.from('subtitles').upsert(
      {
        file_id: file.id,
        language: merged.sourceLanguage,
        content: merged.subtitles,
        is_edited: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'file_id,language' }
    );

    const { data: projectData } = await supabase
      .from('projects')
      .select('target_language')
      .eq('id', projectId)
      .single();
    const targetLanguage = projectData?.target_language || 'vi';

    const translatedSubtitles = await translateSubtitlesClientSide(
      projectId,
      file.id,
      merged.subtitles,
      merged.sourceLanguage,
      targetLanguage,
      onProgress
    );

    await supabase.from('subtitles').upsert(
      {
        file_id: file.id,
        language: targetLanguage,
        content: translatedSubtitles,
        is_edited: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'file_id,language' }
    );

    await invokeJson({
      action: 'complete_processing',
      project_id: projectId,
      file_id: file.id,
      attempt_id: attemptId,
      source_language: merged.sourceLanguage,
    });
    emitProgress(onProgress, file.id, 'completed', 100, 'Hoàn thành xử lý video.');
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    await markFailed(projectId, file.id, attemptId || null, message);
    emitProgress(onProgress, file.id, 'failed', 100, message);
    throw new Error(message);
  }
}

export async function processExistingSubtitleFile(
  projectId: string,
  file: FileMedia,
  onProgress?: ProcessingProgressCallback
): Promise<void> {
  try {
    await invokeJson({
      action: 'start_existing_subtitle',
      project_id: projectId,
      file_id: file.id,
    });
    emitProgress(onProgress, file.id, 'preparing', 20, 'Đang chuẩn bị phụ đề đã nhập...');
    
    const sourceLanguage = file.detected_source_lang || 'en';
    const { data: existing, error: existingError } = await supabase
      .from('subtitles')
      .select('content')
      .eq('file_id', file.id)
      .eq('language', sourceLanguage)
      .maybeSingle();
    if (existingError) throw existingError;

    const sourceSubtitles: Array<{ id: number; start: number; end: number; text: string }> = existing?.content || [];

    const { data: projectData } = await supabase
      .from('projects')
      .select('target_language')
      .eq('id', projectId)
      .single();
    const targetLanguage = projectData?.target_language || 'vi';

    emitProgress(onProgress, file.id, 'finalizing', 75, 'Đang dịch phụ đề...');

    const translatedSubtitles = await translateSubtitlesClientSide(
      projectId,
      file.id,
      sourceSubtitles,
      sourceLanguage,
      targetLanguage,
      onProgress
    );

    await supabase.from('subtitles').upsert(
      {
        file_id: file.id,
        language: targetLanguage,
        content: translatedSubtitles,
        is_edited: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'file_id,language' }
    );

    await invokeJson({
      action: 'complete_existing_subtitle',
      project_id: projectId,
      file_id: file.id,
    });
    emitProgress(onProgress, file.id, 'completed', 100, 'Hoàn thành xử lý phụ đề.');
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    await markFailed(projectId, file.id, null, message);
    emitProgress(onProgress, file.id, 'failed', 100, message);
    throw new Error(message);
  }
}

export async function processSingleFile(
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
