import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { SubtitleItem } from '../types/database';
import { exportToSrt } from '../utils/subtitleParsers';
import { acquireFfmpegLock, getFfmpeg, terminateFfmpeg } from './ffmpegRuntime';

const BUNDLED_FONT_URL = '/NotoSansCJKjp-Regular.otf';
const FONT_DIRECTORY = '/fonts';
const FONT_FILE = `${FONT_DIRECTORY}/NotoSansCJKjp-Regular.otf`;

export type VideoExportErrorKind = 'load' | 'unsupported' | 'execution' | 'output';

export class VideoSubtitleExportError extends Error {
  readonly kind: VideoExportErrorKind;
  readonly reason?: 'av1';

  constructor(kind: VideoExportErrorKind, message: string, reason?: 'av1') {
    super(message);
    this.name = 'VideoSubtitleExportError';
    this.kind = kind;
    this.reason = reason;
  }
}

export interface VideoSubtitleExportOptions {
  videoBlob: Blob;
  subtitles: SubtitleItem[];
  fileName: string;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asVideoExportError(
  error: unknown,
  fallbackKind: VideoExportErrorKind
): VideoSubtitleExportError {
  if (error instanceof VideoSubtitleExportError) return error;
  return new VideoSubtitleExportError(fallbackKind, messageFromError(error));
}

function createInvocationToken(fileName: string): string {
  const baseName = fileName.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48) || 'video';
  const randomPart = Math.random().toString(36).slice(2);
  return `${baseName}-${Date.now().toString(36)}-${randomPart}`;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}

function createVideoExportCanceledError(): Error {
  const error = new Error('Video export was canceled.');
  error.name = 'AbortError';
  return error;
}

async function cleanupFiles(ffmpeg: FFmpeg, fileNames: string[]): Promise<void> {
  await Promise.allSettled(fileNames.map((fileName) => ffmpeg.deleteFile(fileName)));
}

// The bundled CJK font (~5 MB) is fetched once per app session and kept in the
// FFmpeg filesystem across exports, so repeated exports skip both the network
// fetch and the filesystem write.
let fontDataPromise: Promise<Uint8Array> | null = null;

function loadBundledFontData(): Promise<Uint8Array> {
  if (!fontDataPromise) {
    fontDataPromise = fetchFile(BUNDLED_FONT_URL).catch((error) => {
      fontDataPromise = null;
      throw error;
    });
  }
  return fontDataPromise;
}

async function ensureBundledFont(ffmpeg: FFmpeg): Promise<void> {
  const rootEntries = await ffmpeg.listDir('/');
  const fontDirectoryExists = rootEntries.some(
    (entry) => entry.name === FONT_DIRECTORY.slice(1) && entry.isDir
  );
  if (!fontDirectoryExists) {
    await ffmpeg.createDir(FONT_DIRECTORY);
  }

  const fontFileName = FONT_FILE.slice(FONT_DIRECTORY.length + 1);
  const fontExists = fontDirectoryExists
    ? (await ffmpeg.listDir(FONT_DIRECTORY)).some(
        (entry) => entry.name === fontFileName && !entry.isDir
      )
    : false;
  if (!fontExists) {
    await ffmpeg.writeFile(FONT_FILE, await loadBundledFontData());
  }
}

export async function exportVideoWithSubtitles({
  videoBlob,
  subtitles,
  fileName,
  onProgress,
  signal,
}: VideoSubtitleExportOptions): Promise<Blob> {
  if (signal?.aborted) {
    throw createVideoExportCanceledError();
  }

  if (
    videoBlob.size === 0 ||
    !videoBlob.type.toLowerCase().startsWith('video/') ||
    videoBlob.type.toLowerCase().startsWith('audio/')
  ) {
    throw new VideoSubtitleExportError(
      'unsupported',
      'Video export requires a non-empty video Blob.'
    );
  }

  if (subtitles.length === 0) {
    throw new VideoSubtitleExportError(
      'unsupported',
      'Video export requires at least one target subtitle.'
    );
  }

  const token = createInvocationToken(fileName);
  const inputName = `export-${token}-input.mp4`;
  const subtitleName = `export-${token}-subtitles.srt`;
  const outputName = `export-${token}-output.mp4`;
  const mountDirectory = `/workerfs-${token}`;
  const inputPath = `${mountDirectory}/${inputName}`;
  const ownedFiles = [subtitleName, outputName];
  const release = await acquireFfmpegLock();
  let ffmpeg: FFmpeg | null = null;
  let progressListenerAttached = false;
  let logListenerAttached = false;
  let phase: VideoExportErrorKind = 'load';
  let av1InputDetected = false;
  let av1DecodeFailureDetected = false;
  let canceled = Boolean(signal?.aborted);
  let cancelListenerAttached = false;
  let inputMounted = false;

  const handleAbort = () => {
    canceled = true;
    if (ffmpeg) {
      terminateFfmpeg(ffmpeg);
    }
  };

  const throwIfCanceled = () => {
    if (canceled || signal?.aborted) {
      if (ffmpeg) {
        terminateFfmpeg(ffmpeg);
      }
      throw createVideoExportCanceledError();
    }
  };

  const handleProgress = ({ progress }: { progress: number }) => {
    onProgress?.(clampProgress(progress));
  };
  const handleLog = ({ message }: { message: string }) => {
    if (/\b(?:Video: av1|av1 \(native\)|\[av1 @)/i.test(message)) {
      av1InputDetected = true;
    }
    if (
      /Failed to get pixel format|Missing Sequence Header|Error while decoding stream.*(?:Function not implemented|Invalid data found when processing input)/i.test(
        message
      )
    ) {
      av1DecodeFailureDetected = true;
    }
    if (import.meta.env.DEV) {
      console.log('[FFmpeg]', message);
    }
  };

  try {
    if (signal) {
      signal.addEventListener('abort', handleAbort, { once: true });
      cancelListenerAttached = true;
    }
    throwIfCanceled();

    try {
      ffmpeg = await getFfmpeg();
      throwIfCanceled();
      ffmpeg.on('log', handleLog);
      logListenerAttached = true;
      await ensureBundledFont(ffmpeg);
      throwIfCanceled();
      phase = 'execution';
      ffmpeg.on('progress', handleProgress);
      progressListenerAttached = true;
      onProgress?.(0);

      await ffmpeg.createDir(mountDirectory);
      await ffmpeg.mount('WORKERFS', { blobs: [{ name: inputName, data: videoBlob }] }, mountDirectory);
      inputMounted = true;
      throwIfCanceled();
      await ffmpeg.writeFile(subtitleName, new TextEncoder().encode(exportToSrt(subtitles)));
      throwIfCanceled();

      const exitCode = await ffmpeg.exec([
        '-y',
        '-i',
        inputPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-vf',
        `subtitles=${subtitleName}:fontsdir=${FONT_DIRECTORY}:force_style=FontName=Noto Sans CJK JP`,
        '-c:v',
        'libx264',
        // ultrafast is the fastest x264 preset; on the single-thread WASM core
        // it cuts encode time roughly 2-3x vs veryfast at the cost of a larger
        // output file. Encoding speed is the dominant UX cost of this export.
        '-preset',
        'ultrafast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputName,
      ]);

      if (exitCode !== 0) {
        throw new VideoSubtitleExportError(
          av1InputDetected && av1DecodeFailureDetected ? 'unsupported' : 'execution',
          av1InputDetected && av1DecodeFailureDetected
            ? 'AV1 video decoding is not supported by the current FFmpeg WASM core.'
            : `FFmpeg exited with code ${exitCode}.`,
          av1InputDetected && av1DecodeFailureDetected ? 'av1' : undefined
        );
      }

      phase = 'output';
      throwIfCanceled();
      const outputData = await ffmpeg.readFile(outputName, 'binary');
      if (typeof outputData === 'string' || outputData.byteLength === 0) {
        throw new VideoSubtitleExportError(
          'output',
          'FFmpeg produced an empty output file.'
        );
      }

      throwIfCanceled();
      onProgress?.(1);
      // readFile already returns a copy transferred from the FFmpeg worker, so
      // wrap it directly instead of duplicating hundreds of MB synchronously.
      return new Blob([outputData as unknown as BlobPart], { type: 'video/mp4' });
    } catch (error) {
      if (canceled || signal?.aborted) {
        throw createVideoExportCanceledError();
      }
      if (import.meta.env.DEV) {
        console.error('[VideoSubtitleExporter]', { phase, error });
      }
      throw asVideoExportError(error, phase);
    }
  } finally {
    if (signal && cancelListenerAttached) {
      signal.removeEventListener('abort', handleAbort);
    }
    if (ffmpeg) {
      if (logListenerAttached) {
        ffmpeg.off('log', handleLog);
      }
      if (progressListenerAttached) {
        ffmpeg.off('progress', handleProgress);
      }
      await cleanupFiles(ffmpeg, ownedFiles);
      if (inputMounted) {
        await ffmpeg.unmount(mountDirectory).catch(() => undefined);
      }
      await ffmpeg.deleteDir(mountDirectory).catch(() => undefined);
    }
    release();
  }
}
