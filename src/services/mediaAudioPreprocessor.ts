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

async function probeDurationSeconds(ffmpeg: FFmpeg, inputName: string, outputName: string): Promise<number> {
  const probeExit = await ffmpeg.ffprobe([
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputName,
    '-o',
    outputName,
  ]);

  if (probeExit !== 0) {
    throw new Error(`FFmpeg không thể xác định thời lượng media (mã ${probeExit}).`);
  }

  const durationData = await ffmpeg.readFile(outputName, 'utf8');
  const durationSeconds = Number(String(durationData).trim());
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('FFmpeg trả về thời lượng media không hợp lệ.');
  }
  return durationSeconds;
}

export async function* extractFlacChunks(
  mediaBlob: Blob,
  mimeType: string,
  fileId: string
): AsyncGenerator<AudioChunk, void, void> {
  const token = safeToken(fileId);
  const inputName = `input-${token}.${extensionForMimeType(mimeType)}`;
  const durationOutputName = `duration-${token}.txt`;
  const remainingOutputFiles = new Set<string>();
  const release = await acquireFfmpegLock();
  let ffmpeg: FFmpeg | null = null;

  try {
    ffmpeg = await getFfmpeg();
    await ffmpeg.writeFile(inputName, await fetchFile(mediaBlob));
    remainingOutputFiles.add(durationOutputName);
    const mediaDurationSeconds = await probeDurationSeconds(ffmpeg, inputName, durationOutputName);
    const durationDeleted = await ffmpeg.deleteFile(durationOutputName).catch(() => false);
    if (durationDeleted) remainingOutputFiles.delete(durationOutputName);
    const chunkCount = Math.ceil(mediaDurationSeconds / CHUNK_DURATION_SECONDS);

    if (chunkCount > MAX_SEGMENT_SCAN) {
      throw new Error('Media tạo ra quá nhiều FLAC chunk cho bản submission.');
    }

    for (let index = 0; index < chunkCount; index += 1) {
      const startSeconds = index * CHUNK_DURATION_SECONDS;
      const durationSeconds = Math.min(
        CHUNK_DURATION_SECONDS,
        mediaDurationSeconds - startSeconds
      );
      const outputName = `audio-${token}-${String(index).padStart(3, '0')}.flac`;
      remainingOutputFiles.add(outputName);

      // Encode each time range directly from the source into its final FLAC.
      // This avoids the previous segment-FLAC -> normalized-FLAC second encode.
      const chunkExit = await ffmpeg.exec([
        '-ss',
        String(startSeconds),
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
        String(durationSeconds),
        '-c:a',
        'flac',
        outputName,
      ]);

      if (chunkExit !== 0) {
        throw new Error(`FFmpeg không thể tạo FLAC chunk ${index + 1} (mã ${chunkExit}).`);
      }

      const data = await readBinary(ffmpeg, outputName);
      const metadata = inspectFlacMetadata(data);

      if (!metadata.hasAudioFrames || metadata.totalSamples <= 0) {
        throw new Error(`FLAC chunk ${index + 1} không chứa dữ liệu audio hợp lệ.`);
      }
      if (data.byteLength > MAX_SAFE_CHUNK_BYTES) {
        throw new Error(`FLAC chunk ${index + 1} vượt giới hạn 19.5 MB.`);
      }

      try {
        yield {
          index,
          fileName: outputName,
          blob: new Blob([data.buffer as unknown as BlobPart], { type: 'audio/flac' }),
          startSeconds,
          durationSeconds: metadata.totalSamples / 16000,
          chunkCount,
        };
      } finally {
        const deleted = await ffmpeg.deleteFile(outputName).catch(() => false);
        if (deleted) remainingOutputFiles.delete(outputName);
      }
    }
  } finally {
    if (ffmpeg) {
      const cleanup: Promise<unknown>[] = [ffmpeg.deleteFile(inputName)];
      for (const outputName of remainingOutputFiles) {
        cleanup.push(ffmpeg.deleteFile(outputName));
      }
      await Promise.allSettled(cleanup);
    }
    release();
  }
}
