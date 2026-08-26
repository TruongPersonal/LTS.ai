import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { inspectFlacMetadata } from './flacMetadata';
import { acquireFfmpegLock, getFfmpeg } from './ffmpegRuntime';

export const CHUNK_DURATION_SECONDS = 420;
export const MAX_SAFE_CHUNK_BYTES = 19_500_000;
const MAX_SEGMENT_SCAN = 100;

export interface AudioChunk {
  index: number;
  fileName: string;
  blob: Blob;
  startSeconds: number;
  durationSeconds: number;
  chunkCount: number;
}

function extensionForMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogg',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac',
    'audio/x-flac': 'flac',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
  };
  return extensions[mimeType.toLowerCase()] ?? 'media';
}

function safeToken(value: string): string {
  const token = value.replace(/[^a-zA-Z0-9_-]/g, '-');
  if (!token) throw new Error('ID tệp không hợp lệ để xử lý audio.');
  return token;
}

async function readBinary(ffmpeg: FFmpeg, fileName: string): Promise<Uint8Array> {
  const data = await ffmpeg.readFile(fileName, 'binary');
  if (typeof data === 'string') {
    throw new Error('FFmpeg trả về audio không hợp lệ.');
  }
  return Uint8Array.from(data);
}

// FFmpeg's segment muxer can keep absolute packet timestamps in FLAC outputs even
// with -reset_timestamps 1. Re-encode each segment with sample-count timestamps
// so every chunk presented to the transcription provider starts at local time zero.
async function normalizeFlacSegment(
  ffmpeg: FFmpeg,
  inputName: string,
  normalizedName: string
): Promise<void> {
  const normalizeExit = await ffmpeg.exec([
    '-y',
    '-i',
    inputName,
    '-map',
    '0:a:0',
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-sample_fmt',
    's16',
    '-af',
    'asetpts=N/SR/TB',
    '-t',
    String(CHUNK_DURATION_SECONDS),
    '-c:a',
    'flac',
    normalizedName,
  ]);

  if (normalizeExit !== 0) {
    throw new Error(
      `FFmpeg không thể chuẩn hoá timestamp FLAC (mã ${normalizeExit}).`
    );
  }
}

export async function* extractFlacChunks(
  mediaBlob: Blob,
  mimeType: string,
  fileId: string
): AsyncGenerator<AudioChunk, void, void> {
  const token = safeToken(fileId);
  const inputName = `input-${token}.${extensionForMimeType(mimeType)}`;
  const outputPattern = `audio-${token}-%03d.flac`;
  const remainingSegmentFiles = new Set<string>();
  const release = await acquireFfmpegLock();
  let ffmpeg: FFmpeg | null = null;

  try {
    ffmpeg = await getFfmpeg();
    await ffmpeg.writeFile(inputName, await fetchFile(mediaBlob));

    const segmentExit = await ffmpeg.exec([
      '-i',
      inputName,
      '-map',
      '0:a:0',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-sample_fmt',
      's16',
      '-c:a',
      'flac',
      '-f',
      'segment',
      '-segment_time',
      '420',
      '-reset_timestamps',
      '1',
      outputPattern,
    ]);

    if (segmentExit !== 0) {
      throw new Error(`FFmpeg không thể tách audio thành FLAC (mã ${segmentExit}).`);
    }

    const segmentFiles = (await ffmpeg.listDir('/'))
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(`audio-${token}-`) && name.endsWith('.flac'))
      .sort();

    if (segmentFiles.length === 0) {
      throw new Error('FFmpeg không tạo được FLAC chunk từ media đã chọn.');
    }
    if (segmentFiles.length > MAX_SEGMENT_SCAN) {
      throw new Error('Media tạo ra quá nhiều FLAC chunk cho bản submission.');
    }

    segmentFiles.forEach((name) => remainingSegmentFiles.add(name));

    const usableSegmentFiles: string[] = [];
    for (const segmentFile of segmentFiles) {
      const segmentData = await readBinary(ffmpeg, segmentFile);
      const segmentMetadata = inspectFlacMetadata(segmentData);
      if (!segmentMetadata.hasAudioFrames) {
        const deleted = await ffmpeg.deleteFile(segmentFile).catch(() => false);
        if (deleted) remainingSegmentFiles.delete(segmentFile);
        continue;
      }
      usableSegmentFiles.push(segmentFile);
    }

    if (usableSegmentFiles.length === 0) {
      throw new Error('FFmpeg không tạo được FLAC chunk có dữ liệu audio.');
    }

    const chunkCount = usableSegmentFiles.length;
    for (let index = 0; index < chunkCount; index += 1) {
      const outputName = usableSegmentFiles[index];
      const normalizedName = `normalized-${outputName}`;
      remainingSegmentFiles.add(normalizedName);

      await normalizeFlacSegment(ffmpeg, outputName, normalizedName);
      const data = await readBinary(ffmpeg, normalizedName);
      const metadata = inspectFlacMetadata(data);

      if (!metadata.hasAudioFrames || metadata.totalSamples <= 0) {
        throw new Error(`FLAC chunk ${index + 1} không chứa dữ liệu audio hợp lệ.`);
      }
      if (data.byteLength > MAX_SAFE_CHUNK_BYTES) {
        throw new Error(`FLAC chunk ${index + 1} vượt giới hạn 19.5 MB.`);
      }

      const sourceDeleted = await ffmpeg.deleteFile(outputName).catch(() => false);
      if (sourceDeleted) remainingSegmentFiles.delete(outputName);

      try {
        yield {
          index,
          fileName: outputName,
          blob: new Blob([data.buffer as unknown as BlobPart], { type: 'audio/flac' }),
          startSeconds: index * CHUNK_DURATION_SECONDS,
          durationSeconds: metadata.totalSamples / 16000,
          chunkCount,
        };
      } finally {
        const normalizedDeleted = await ffmpeg.deleteFile(normalizedName).catch(() => false);
        if (normalizedDeleted) remainingSegmentFiles.delete(normalizedName);
      }
    }
  } finally {
    if (ffmpeg) {
      const cleanup: Promise<unknown>[] = [ffmpeg.deleteFile(inputName)];
      for (const outputName of remainingSegmentFiles) {
        cleanup.push(ffmpeg.deleteFile(outputName));
      }
      await Promise.allSettled(cleanup);
    }
    release();
  }
}
