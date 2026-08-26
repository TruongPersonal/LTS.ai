import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '../i18n';
import { getGoogleAccessToken } from '../lib/supabase';

const pendingDriveMediaFetches = new Map<string, Promise<Blob>>();

class GoogleDriveSessionError extends Error {}

interface UseEditorVideoParams {
  driveFileId: string;
  inputSource: string;
  fileName?: string;
  mimeType?: string;
}

function resolveMediaMime(
  response: Response,
  inputMime?: string,
  fileName?: string,
): string {
  const headerType = response.headers.get('content-type');

  if (headerType && !headerType.includes('octet-stream')) {
    return headerType;
  }

  if (inputMime && !inputMime.includes('octet-stream')) {
    return inputMime;
  }

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
): Promise<Blob> {
  const existing = pendingDriveMediaFetches.get(driveFileId);

  if (existing) {
    return existing;
  }

  const fetchPromise = (async () => {
    const accessToken = await getGoogleAccessToken();

    if (!accessToken) {
      throw new GoogleDriveSessionError();
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new GoogleDriveSessionError();
      }

      throw new Error(
        `Google Drive fetch failed with status: ${response.status}`,
      );
    }

    const rawBlob = await response.blob();

    if (rawBlob.size === 0) {
      throw new Error('Google Drive returned an empty media file.');
    }

    const resolvedMime = resolveMediaMime(
      response,
      inputMime,
      fileName,
    );

    // Không tạo new Blob([rawBlob]); tránh thêm một bước copy.
    return rawBlob.type === resolvedMime
      ? rawBlob
      : rawBlob.slice(0, rawBlob.size, resolvedMime);
  })();

  pendingDriveMediaFetches.set(driveFileId, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    pendingDriveMediaFetches.delete(driveFileId);
  }
}

export const useEditorVideo = ({
  driveFileId,
  inputSource,
  fileName,
  mimeType: inputMime,
}: UseEditorVideoParams) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const objectUrlRef = useRef<string | null>(null);

  const isDriveMedia =
    inputSource === 'media' || inputSource === 'existing_subtitle';

  const releaseObjectUrl = useCallback(() => {
    if (!objectUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  const loadVideoBlob = useCallback(
    async (): Promise<Blob | null> => {
      if (!isDriveMedia) {
        return null;
      }

      if (videoBlob) {
        return videoBlob;
      }

      const blob = await fetchDriveMediaBlob(
        driveFileId,
        inputMime,
        fileName,
      );

      setVideoBlob(blob);

      return blob;
    },
    [
      driveFileId,
      fileName,
      inputMime,
      isDriveMedia,
      videoBlob,
    ],
  );

  const loadVideo = useCallback(async () => {
    if (!driveFileId) {
      releaseObjectUrl();
      setVideoBlob(null);
      setVideoUrl('');
      setVideoError(i18n.t('editor.video.empty'));
      setVideoLoading(false);
      return;
    }

    setVideoLoading(true);
    setVideoError(null);
    setVideoUrl('');
    setVideoBlob(null);
    releaseObjectUrl();

    try {
      if (isDriveMedia) {
        const blob = await fetchDriveMediaBlob(
          driveFileId,
          inputMime,
          fileName,
        );

        setVideoBlob(blob);

        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setVideoUrl(objectUrl);
      } else {
        setVideoUrl(driveFileId);
      }
    } catch (error) {
      console.error('Error preparing video source:', error);

      setVideoError(
        error instanceof GoogleDriveSessionError
          ? i18n.t('editor.video.sessionExpired')
          : i18n.t('editor.video.cannotOpen'),
      );
    } finally {
      setVideoLoading(false);
    }
  }, [
    driveFileId,
    fileName,
    inputMime,
    isDriveMedia,
    releaseObjectUrl,
  ]);

  useEffect(() => {
    void loadVideo();

    return releaseObjectUrl;
  }, [loadVideo, releaseObjectUrl]);

  return {
    videoUrl,
    videoBlob,
    videoLoading,
    videoError,
    currentTime,
    setCurrentTime,
    loadVideoBlob,
    reloadVideo: loadVideo,
  };
};