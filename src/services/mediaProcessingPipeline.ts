import { forceExpireGoogleSession, getGoogleAccessToken, supabase } from '../lib/supabase';
import { DEFAULT_PLAN, normalizePlan, PLAN_LIMITS, type FileMedia, type Plan } from '../types/database';
import type { ProcessingProgressCallback, ProcessingStage } from '../types/processing';
import { extractFlacChunks, type AudioChunk } from './mediaAudioPreprocessor';
import {
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

export async function downloadDriveMedia(
  file: FileMedia,
  accessToken: string,
  onDownloadProgress?: (percent: number) => void
): Promise<Blob> {
  const token = accessToken || (await getGoogleAccessToken());

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await forceExpireGoogleSession();
    }
    throw new Error(`Failed to download file from Google Drive (Status: ${response.status})`);
  }

  const contentLengthHeader = response.headers.get('Content-Length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  if (!response.body || !totalBytes || totalBytes <= 0) {
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('The Google Drive file contains no data.');
    onDownloadProgress?.(25);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let receivedBytes = 0;
  let lastReported = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedBytes += value.length;
      const pct = Math.min(25, Math.max(0, Math.round((receivedBytes / totalBytes) * 25)));
      if (pct > lastReported) {
        lastReported = pct;
        onDownloadProgress?.(pct);
      }
    }
  }

  const mimeType = file.mime_type || response.headers.get('Content-Type') || 'video/mp4';
  const blob = new Blob(chunks, { type: mimeType });
  if (blob.size === 0) throw new Error('The Google Drive file contains no data.');
  onDownloadProgress?.(25);
  return blob;
}

export async function runWithSmoothProgress<T>(
  asyncTask: () => Promise<T>,
  startPercent: number,
  targetPercent: number,
  onTick: (percent: number) => void,
  intervalMs = 280
): Promise<T> {
  let current = startPercent;
  onTick(Math.round(current));

  const ceiling = Math.max(startPercent, targetPercent - 1);
  const timer = setInterval(() => {
    const remaining = ceiling - current;
    if (remaining > 0.4) {
      current += Math.max(0.25, remaining * 0.08);
      onTick(Math.min(ceiling, Math.round(current)));
    }
  }, intervalMs);

  try {
    const result = await asyncTask();
    clearInterval(timer);
    onTick(targetPercent);
    return result;
  } catch (err) {
    clearInterval(timer);
    throw err;
  }
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
  if (rawError instanceof EdgeInvocationError && rawError.code === 'DAILY_QUOTA_EXCEEDED') {
    return 'Daily processing quota exceeded.';
  }

  const rawMessage = rawError instanceof Error ? rawError.message : String(rawError || '');
  if (
    rawMessage.toLowerCase().includes('quota') ||
    rawMessage.toLowerCase().includes('limit') ||
    rawMessage.includes('429')
  ) {
    return 'Daily processing quota exceeded.';
  }

  return 'Unable to process media file. Please try again.';
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

    const batchStart = 80 + Math.round(((batchIndex - 1) / totalBatches) * 18);
    const batchTarget = 80 + Math.round((batchIndex / totalBatches) * 18);

    const res = await runWithSmoothProgress(
      () =>
        invokeJson({
          action: 'translate-batch',
          project_id: projectId,
          file_id: fileId,
          subtitles: batch,
          source_language: sourceLanguage,
          target_language: targetLanguage,
        }),
      batchStart,
      batchTarget,
      (pct) => {
        emitProgress(
          onProgress,
          fileId,
          'finalizing',
          pct,
          i18n.t('processing.translatingBatch', 'Đang dịch phụ đề với Gemini 2.0 Flash · lô {{batch}}/{{total}}', {
            batch: batchIndex,
            total: totalBatches,
          }),
          batchIndex,
          totalBatches
        );
      }
    );

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

    emitProgress(onProgress, file.id, 'downloading', 0, i18n.t('processing.downloading'));
    const mediaBlob = await downloadDriveMedia(file, accessToken, (pct) => {
      emitProgress(onProgress, file.id, 'downloading', pct, i18n.t('processing.downloading'));
    });

    let effectiveDuration = file.duration_seconds || 0;
    const exactDuration = await getBlobDurationSeconds(mediaBlob);
    if (exactDuration > 0) {
      effectiveDuration = exactDuration;
    }
    await assertDailyDurationAvailable(effectiveDuration);

    emitProgress(onProgress, file.id, 'preprocessing', 26, i18n.t('processing.preprocessing'));

    const chunkResults: TranscriptionChunkResult[] = [];
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

        const totalChunks = Math.max(1, chunk.chunkCount);
        const chunkStart = 35 + Math.round((45 * chunk.index) / totalChunks);
        const chunkTarget = 35 + Math.round((45 * (chunk.index + 1)) / totalChunks);

        const chunkResult = await runWithSmoothProgress(
          () => transcribeChunk(projectId, file.id, attemptId, chunk),
          chunkStart,
          chunkTarget,
          (pct) => {
            emitProgress(
              onProgress,
              file.id,
              'transcribing',
              pct,
              i18n.t('processing.transcribingChunk', { index: chunk.index + 1, count: totalChunks }),
              chunk.index + 1,
              totalChunks
            );
          }
        );
        chunkResults.push(chunkResult);
      }
    } finally {
      if (nextChunkPromise) {
        await nextChunkPromise.catch(() => undefined);
      }
      await chunkIterator.return().catch(() => undefined);
    }

    emitProgress(onProgress, file.id, 'finalizing', 81, i18n.t('processing.saving'));
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

    emitProgress(onProgress, file.id, 'finalizing', 98, i18n.t('processing.saving'));

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
    emitProgress(onProgress, file.id, 'completed', 100, i18n.t('processing.videoCompleted', 'Hoàn thành xử lý video.'));
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
    emitProgress(onProgress, file.id, 'preparing', 20, i18n.t('processing.existingSubPreparing', 'Đang chuẩn bị phụ đề đã nhập...'));
    
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

    emitProgress(onProgress, file.id, 'finalizing', 75, i18n.t('processing.translating', 'Đang dịch phụ đề...'));

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
    emitProgress(onProgress, file.id, 'completed', 100, i18n.t('processing.existingSubCompleted', 'Hoàn thành xử lý phụ đề.'));
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
  emitProgress(onProgress, file.id, 'preparing', 0, i18n.t('processing.processingPreparing', 'Đang chuẩn bị xử lý...'));
  if (file.input_source === 'existing_subtitle') {
    await processExistingSubtitleFile(projectId, file, onProgress);
    return;
  }
  await processMediaFile(projectId, file, accessToken, onProgress);
}
