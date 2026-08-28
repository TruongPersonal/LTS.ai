import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.10';
const CORE_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@' + CORE_VERSION + '/dist/esm';
const CORE_MT_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@' + CORE_VERSION + '/dist/esm';

let ffmpegPromise: Promise<FFmpeg> | null = null;
let ffmpegLockTail = Promise.resolve();

function isCrossOriginIsolated(): boolean {
  return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated === true;
}

export async function getFfmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const useMultiThread = isCrossOriginIsolated();
      const baseURL = useMultiThread ? CORE_MT_BASE_URL : CORE_BASE_URL;
      const [coreURL, wasmURL, workerURL] = await Promise.all([
        toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript'),
        toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm'),
        useMultiThread
          ? toBlobURL(baseURL + '/ffmpeg-core.worker.js', 'text/javascript')
          : Promise.resolve(undefined),
      ]);
      await ffmpeg.load(
        useMultiThread ? { coreURL, wasmURL, workerURL } : { coreURL, wasmURL }
      );
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }

  return ffmpegPromise;
}

export function terminateFfmpeg(ffmpeg: FFmpeg): void {
  try {
    ffmpeg.terminate();
  } finally {
    
    ffmpegPromise = null;
  }
}

export async function acquireFfmpegLock(): Promise<() => void> {
  const previous = ffmpegLockTail;
  let release!: () => void;

  ffmpegLockTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  return release;
}
