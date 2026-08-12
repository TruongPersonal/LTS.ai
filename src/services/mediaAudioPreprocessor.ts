import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.10';
const CORE_BASE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
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

let ffmpegPromise: Promise<FFmpeg> | null = null;

async function getFfmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
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

export async function* extractFlacChunks(
  mediaBlob: Blob,
  mimeType: string,
  fileId: string
): AsyncGenerator<AudioChunk, void, void> {
  const ffmpeg = await getFfmpeg();
  const token = safeToken(fileId);
  const inputName = `input-${token}.${extensionForMimeType(mimeType)}`;
  const outputPattern = `audio-${token}-%03d.flac`;

  try {
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

    const chunkCount = segmentFiles.length;
    for (let index = 0; index < chunkCount; index += 1) {
      const outputName = segmentFiles[index];
      const data = await readBinary(ffmpeg, outputName);

      if (data.byteLength === 0) {
        throw new Error(`FLAC chunk ${index + 1} rỗng.`);
      }
      if (data.byteLength > MAX_SAFE_CHUNK_BYTES) {
        throw new Error(`FLAC chunk ${index + 1} vượt giới hạn 19.5 MB.`);
      }

      try {
        yield {
          index,
          fileName: outputName,
          blob: new Blob([data.buffer as unknown as BlobPart], { type: 'audio/flac' }),
          startSeconds: index * CHUNK_DURATION_SECONDS,
          durationSeconds: CHUNK_DURATION_SECONDS,
          chunkCount,
        };
      } finally {
        await ffmpeg.deleteFile(outputName).catch(() => false);
      }
    }
  } finally {
    const cleanup: Promise<unknown>[] = [ffmpeg.deleteFile(inputName)];
    for (let index = 0; index < MAX_SEGMENT_SCAN; index += 1) {
      const outputName = `audio-${token}-${String(index).padStart(3, '0')}.flac`;
      cleanup.push(ffmpeg.deleteFile(outputName));
    }
    await Promise.allSettled(cleanup);
  }
}
