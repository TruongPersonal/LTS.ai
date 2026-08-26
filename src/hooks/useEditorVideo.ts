import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '../i18n';
import { getGoogleAccessToken } from '../lib/supabase';

const DRIVE_MEDIA_WORKER_URL = '/drive-media-sw.js';
const DRIVE_MEDIA_PREFIX = '/__drive_media__/';
const TOKEN_REQUEST_TYPE = 'drive-media-token-request';

let driveMediaWorkerPromise: Promise<void> | null = null;
let tokenResponderInstalled = false;

class GoogleDriveSessionError extends Error {}

function installDriveTokenResponder(): void {
  if (tokenResponderInstalled || !('serviceWorker' in navigator)) return;
  tokenResponderInstalled = true;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== TOKEN_REQUEST_TYPE || !event.ports[0]) return;
    const responsePort = event.ports[0];
    void getGoogleAccessToken()
      .then((token) => responsePort.postMessage({ token: token || null }))
      .catch(() => responsePort.postMessage({ token: null }));
  });
}

function waitForServiceWorkerController(): Promise<void> {
  if (navigator.serviceWorker.controller) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      reject(new Error('Drive media worker did not take control.'));
    }, 5000);
    const handleControllerChange = () => {
      if (!navigator.serviceWorker.controller) return;
      window.clearTimeout(timeoutId);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      resolve();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
  });
}

async function ensureDriveMediaWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker is unavailable.');
  }
  installDriveTokenResponder();

  if (!driveMediaWorkerPromise) {
    driveMediaWorkerPromise = (async () => {
      await navigator.serviceWorker.register(DRIVE_MEDIA_WORKER_URL, { scope: '/' });
      await navigator.serviceWorker.ready;
      await waitForServiceWorkerController();
    })().catch((error) => {
      driveMediaWorkerPromise = null;
      throw error;
    });
  }

  return driveMediaWorkerPromise;
}

function resolveMediaMime(response: Response, inputMime?: string, fileName?: string): string {
  const headerType = response.headers.get('content-type');
  if (headerType && !headerType.includes('octet-stream')) return headerType;
  if (inputMime && !inputMime.includes('octet-stream')) return inputMime;

  const extension = fileName?.split('.').pop()?.toLowerCase();
  const extensionTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    webm: 'video/webm',
    mov: 'video/quicktime',
  };
  return (extension && extensionTypes[extension]) || 'video/mp4';
}

async function fetchDriveMediaBlob(
  driveFileId: string,
  inputMime?: string,
  fileName?: string,
  signal?: AbortSignal
): Promise<Blob> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new GoogleDriveSessionError();

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    }
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GoogleDriveSessionError();
    }
    throw new Error(`Google Drive fetch failed with status: ${response.status}`);
  }

  const rawBlob = await response.blob();
  if (rawBlob.size === 0) throw new Error('Google Drive returned an empty media file.');
  const resolvedMime = resolveMediaMime(response, inputMime, fileName);
  return rawBlob.type === resolvedMime ? rawBlob : rawBlob.slice(0, rawBlob.size, resolvedMime);
}

interface UseEditorVideoParams {
  driveFileId: string;
  inputSource: string;
  fileName?: string;
  mimeType?: string;
}

export const useEditorVideo = ({
  driveFileId,
  inputSource,
  fileName,
  mimeType: inputMime,
}: UseEditorVideoParams) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const fallbackBlobRef = useRef<Blob | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const isDriveMedia = inputSource === 'media' || inputSource === 'existing_subtitle';

  const releaseObjectUrl = useCallback(() => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  const loadVideoBlob = useCallback(
    async (signal?: AbortSignal): Promise<Blob | null> => {
      if (!isDriveMedia) return null;
      if (fallbackBlobRef.current) return fallbackBlobRef.current;
      return fetchDriveMediaBlob(driveFileId, inputMime, fileName, signal);
    },
    [driveFileId, fileName, inputMime, isDriveMedia]
  );

  const loadVideo = useCallback(async () => {
    if (!driveFileId) {
      setVideoError(i18n.t('editor.video.empty'));
      setVideoLoading(false);
      return;
    }

    setVideoLoading(true);
    setVideoError(null);
    setVideoUrl('');
    fallbackBlobRef.current = null;
    releaseObjectUrl();

    try {
      if (isDriveMedia) {
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) throw new GoogleDriveSessionError();

        try {
          await ensureDriveMediaWorker();
          const mimeQuery = inputMime ? `?mime=${encodeURIComponent(inputMime)}` : '';
          setVideoUrl(`${DRIVE_MEDIA_PREFIX}${encodeURIComponent(driveFileId)}${mimeQuery}`);
        } catch (workerError) {
          if (import.meta.env.DEV) {
            console.warn('[EditorVideo] Range streaming unavailable, using Blob fallback.', workerError);
          }
          const blob = await fetchDriveMediaBlob(driveFileId, inputMime, fileName);
          fallbackBlobRef.current = blob;
          const objectUrl = URL.createObjectURL(blob);
          objectUrlRef.current = objectUrl;
          setVideoUrl(objectUrl);
        }
      } else {
        setVideoUrl(driveFileId);
      }
    } catch (error) {
      console.error('Error preparing video source:', error);
      setVideoError(
        error instanceof GoogleDriveSessionError
          ? i18n.t('editor.video.sessionExpired')
          : i18n.t('editor.video.cannotOpen')
      );
    } finally {
      setVideoLoading(false);
    }
  }, [driveFileId, fileName, inputMime, isDriveMedia, releaseObjectUrl]);

  useEffect(() => {
    void loadVideo();
    return releaseObjectUrl;
  }, [loadVideo, releaseObjectUrl]);

  return {
    videoUrl,
    videoLoading,
    videoError,
    currentTime,
    setCurrentTime,
    loadVideoBlob,
    reloadVideo: loadVideo,
  };
};
