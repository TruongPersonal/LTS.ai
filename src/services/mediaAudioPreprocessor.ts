import { FFmpeg } from '@ffmpeg/ffmpeg';
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
  return data;
}

export async function* extractFlacChunks(
  mediaBlob: Blob,
  mimeType: string,
  fileId: string,
  mediaDurationSeconds: number
): AsyncGenerator<AudioChunk, void, void> {
  const token = safeToken(fileId);
  const inputName = `input-${token}.${extensionForMimeType(mimeType)}`;
  const remainingOutputFiles = new Set<string>();
  const inputPath = inputName;
  const release = await acquireFfmpegLock();
  let ffmpeg: FFmpeg | null = null;

  try {
    ffmpeg = await getFfmpeg();

    await ffmpeg.writeFile(
      inputName,
      new Uint8Array(await mediaBlob.arrayBuffer())
    );
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
        inputPath,
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
      const activeFfmpeg = ffmpeg;
      await Promise.allSettled(
        Array.from(remainingOutputFiles, (outputName) => activeFfmpeg.deleteFile(outputName))
      );
      await ffmpeg.deleteFile(inputName).catch(() => undefined);
    }
    release();
  }
}
