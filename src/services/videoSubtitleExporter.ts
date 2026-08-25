import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { SubtitleItem } from '../types/database';
import { exportToSrt } from '../utils/subtitleParsers';
import { acquireFfmpegLock, getFfmpeg } from './ffmpegRuntime';

const BUNDLED_FONT_URL = '/NotoSansCJKjp-Regular.otf';
const FONT_DIRECTORY = '/fonts';
const FONT_FILE = `${FONT_DIRECTORY}/NotoSansCJKjp-Regular.otf`;

export type VideoExportErrorKind = 'load' | 'unsupported' | 'execution' | 'output';

export class VideoSubtitleExportError extends Error {
  readonly kind: VideoExportErrorKind;

  constructor(kind: VideoExportErrorKind, message: string) {
    super(message);
    this.name = 'VideoSubtitleExportError';
    this.kind = kind;
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

async function ensureFontDirectory(ffmpeg: FFmpeg): Promise<void> {
  const rootEntries = await ffmpeg.listDir('/');
  const fontDirectoryExists = rootEntries.some(
    (entry) => entry.name === FONT_DIRECTORY.slice(1) && entry.isDir
  );
  if (!fontDirectoryExists) {
    await ffmpeg.createDir(FONT_DIRECTORY);
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
  const ownedFiles = [inputName, subtitleName, outputName, FONT_FILE];
  const release = await acquireFfmpegLock();
  let ffmpeg: FFmpeg | null = null;
  let progressListenerAttached = false;
  let phase: VideoExportErrorKind = 'load';

  const handleProgress = ({ progress }: { progress: number }) => {
    onProgress?.(clampProgress(progress));
  };

  try {
    try {
      ffmpeg = await getFfmpeg();
      await ensureFontDirectory(ffmpeg);
      await ffmpeg.writeFile(FONT_FILE, await fetchFile(BUNDLED_FONT_URL));
      phase = 'execution';
      ffmpeg.on('progress', handleProgress);
      progressListenerAttached = true;
      onProgress?.(0);

      await ffmpeg.writeFile(inputName, await fetchFile(videoBlob));
      await ffmpeg.writeFile(subtitleName, new TextEncoder().encode(exportToSrt(subtitles)));

      const exitCode = await ffmpeg.exec([
        '-y',
        '-i',
        inputName,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-vf',
        `subtitles=${subtitleName}:fontsdir=${FONT_DIRECTORY}:force_style=FontName=Noto Sans CJK JP`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
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
          'execution',
          `FFmpeg exited with code ${exitCode}.`
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
      return new Blob([Uint8Array.from(outputData)], { type: 'video/mp4' });
    } catch (error) {
      throw asVideoExportError(error, phase);
    }
  } finally {
    if (ffmpeg) {
      if (progressListenerAttached) {
        ffmpeg.off('progress', handleProgress);
      }
      await cleanupFiles(ffmpeg, ownedFiles);
    }
    release();
  }
}
