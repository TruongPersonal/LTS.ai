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

async function cleanupFiles(ffmpeg: FFmpeg, fileNames: string[]): Promise<void> {
  await Promise.allSettled(fileNames.map((fileName) => ffmpeg.deleteFile(fileName)));
}

let fontDataPromise: Promise<Uint8Array> | null = null;

async function loadBundledFontData(): Promise<Uint8Array> {
  if (!fontDataPromise) {
    fontDataPromise = fetchFile(BUNDLED_FONT_URL).catch((error) => {
      fontDataPromise = null;
      throw error;
    });
  }
  const data = await fontDataPromise;
  return data.slice(0);
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
}: VideoSubtitleExportOptions): Promise<Blob> {

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
  let inputMounted = false;

  let maxSeenProgress = 0;
  const handleProgress = ({ progress }: { progress: number }) => {
    const clamped = clampProgress(progress);
    if (clamped >= maxSeenProgress && clamped < 1) {
      maxSeenProgress = clamped;
      onProgress?.(clamped);
    }
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
    try {
      ffmpeg = await getFfmpeg();
      ffmpeg.on('log', handleLog);
      logListenerAttached = true;
      await ensureBundledFont(ffmpeg);
      phase = 'execution';
      ffmpeg.on('progress', handleProgress);
      progressListenerAttached = true;
      onProgress?.(0);

      await ffmpeg.createDir(mountDirectory);
      const workerFsType = 'WORKERFS' as Parameters<FFmpeg['mount']>[0];
      await ffmpeg.mount(workerFsType, { blobs: [{ name: inputName, data: videoBlob }] }, mountDirectory);
      inputMounted = true;
      await ffmpeg.writeFile(subtitleName, new TextEncoder().encode(exportToSrt(subtitles)));

      const exitCode = await ffmpeg.exec([
        '-y',
        '-i',
        inputPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-vf',
        `subtitles=${subtitleName}:fontsdir=${FONT_DIRECTORY}:force_style='FontName=Noto Sans CJK JP,FontSize=16,BorderStyle=3,BackColour=&H60000000,Outline=1,MarginV=14'`,
        '-c:v',
        'libx264',
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
      const outputData = await ffmpeg.readFile(outputName, 'binary');
      if (typeof outputData === 'string' || outputData.byteLength === 0) {
        throw new VideoSubtitleExportError(
          'output',
          'FFmpeg produced an empty output file.'
        );
      }

      onProgress?.(1);
      return new Blob([outputData as unknown as BlobPart], { type: 'video/mp4' });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[VideoSubtitleExporter]', { phase, error });
      }
      throw asVideoExportError(error, phase);
    }
  } finally {
    try {
      if (ffmpeg) {
        if (logListenerAttached) {
          try { ffmpeg.off('log', handleLog); } catch {  }
        }
        if (progressListenerAttached) {
          try { ffmpeg.off('progress', handleProgress); } catch {  }
        }
        await cleanupFiles(ffmpeg, ownedFiles).catch(() => undefined);
        if (inputMounted) {
          await ffmpeg.unmount(mountDirectory).catch(() => undefined);
        }
        await ffmpeg.deleteDir(mountDirectory).catch(() => undefined);
        terminateFfmpeg(ffmpeg);
      }
    } catch (cleanupError) {
      if (import.meta.env.DEV) {
        console.warn('[VideoSubtitleExporter] Cleanup error:', cleanupError);
      }
      if (ffmpeg) {
        terminateFfmpeg(ffmpeg);
      }
    } finally {
      release();
    }
  }
}
