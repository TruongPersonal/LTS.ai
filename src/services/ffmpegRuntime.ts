import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.10';
const CORE_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@' + CORE_VERSION + '/dist/esm';

let ffmpegPromise: Promise<FFmpeg> | null = null;
let ffmpegLockTail = Promise.resolve();

export async function getFfmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(CORE_BASE_URL + '/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL(CORE_BASE_URL + '/ffmpeg-core.wasm', 'application/wasm'),
      });
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }

  return ffmpegPromise;
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
