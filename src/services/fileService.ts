import { getGoogleAccessToken, supabase } from '../lib/supabase';
import type { FileMedia, InputSource } from '../types/database';
import type { ProcessingProgressCallback, ProcessingStage } from '../types/processing';
import { extractFlacChunks, type AudioChunk } from './mediaAudioPreprocessor';
import {
  getTranscriptionProgressPercent,
  mergeTranscriptionChunks,
  type TranscriptionChunkResult,
} from '../utils/mediaProcessing';

type EdgeResult = {
  error?: string;
  source_language?: string;
  subtitles?: Array<{ id: number; start: number; end: number; text: string }>;
};

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
    throw new Error('Google Drive access token is missing. Vui lòng đăng nhập lại bằng Google.');
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error('Không thể tải video từ Google Drive. Phiên Google đã hết hạn hoặc thiếu quyền Drive; vui lòng đăng nhập lại bằng Google.');
    }
    throw new Error(`Google Drive tải media thất bại (${response.status}): ${detail.slice(0, 240)}`);
  }

  const blob = await response.blob();
  if (blob.size === 0) throw new Error('Google Drive trả về tệp media rỗng.');
  return blob;
}

async function invokeJson(body: Record<string, unknown>): Promise<EdgeResult> {
  const { data, error } = await supabase.functions.invoke('process-media', { body });
  if (error) throw error;
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
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.source_language || !Array.isArray(data?.subtitles)) {
    throw new Error('Edge Function trả về kết quả transcription không hợp lệ.');
  }

  return {
    sourceLanguage: String(data.source_language),
    subtitles: data.subtitles,
  };
}

async function markFailed(projectId: string, fileId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown processing error';
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

async function processMediaFile(
  projectId: string,
  file: FileMedia,
  accessToken: string,
  onProgress?: ProcessingProgressCallback
): Promise<void> {
  try {
    emitProgress(onProgress, file.id, 'downloading', 10, 'Đang tải video từ Google Drive...');
    const mediaBlob = await downloadDriveMedia(file, accessToken);
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

    emitProgress(onProgress, file.id, 'completed', 100, 'Hoàn thành xử lý video.');
  } catch (error) {
    await markFailed(projectId, file.id, error);
    const message = error instanceof Error ? error.message : 'Không thể xử lý video.';
    emitProgress(onProgress, file.id, 'failed', 100, message);
    throw error;
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
    await markFailed(projectId, file.id, error);
    const message = error instanceof Error ? error.message : 'Không thể xử lý phụ đề.';
    emitProgress(onProgress, file.id, 'failed', 100, message);
    throw error;
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
  async getFilesByProject(projectId: string): Promise<FileMedia[]> {
    const { data, error } = await supabase
      .from('files_media')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
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
      .in('status', ['draft', 'failed'])
      .order('created_at', { ascending: true });

    if (filesError) throw filesError;
    if (!processableFiles?.length) return;

    for (const file of processableFiles as FileMedia[]) {
      emitProgress(onProgress, file.id, 'queued', 0, 'Đang chờ xử lý...');
    }

    const hasMediaFile = processableFiles.some((file) => file.input_source === 'media');
    const accessToken = hasMediaFile ? await getGoogleAccessToken() : '';
    if (hasMediaFile && !accessToken) {
      const error = new Error('Google Drive access token is missing. Vui lòng đăng nhập lại bằng Google.');
      for (const file of processableFiles as FileMedia[]) {
        if (file.input_source === 'media') {
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

  async deleteFile(fileId: string): Promise<void> {
    const { error } = await supabase.from('files_media').delete().eq('id', fileId);
    if (error) throw error;
  },
};
