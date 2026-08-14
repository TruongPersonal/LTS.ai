import { useCallback, useEffect, useState } from 'react';
import i18n from '../i18n';
import { getGoogleAccessToken } from '../lib/supabase';

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

  const loadVideo = useCallback(async () => {
    if (!driveFileId) {
      setVideoError(i18n.t('editor.video.empty'));
      setVideoLoading(false);
      return;
    }

    setVideoLoading(true);
    setVideoError(null);

    try {
      if (inputSource === 'media' || inputSource === 'existing_subtitle') {
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) {
          setVideoError(i18n.t('editor.video.sessionExpired'));
          return;
        }

        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setVideoError(i18n.t('editor.video.sessionExpired'));
            return;
          }
          throw new Error(`Google Drive fetch failed with status: ${response.status}`);
        }

        const rawBlob = await response.blob();
        if (rawBlob.size === 0) {
          setVideoError(i18n.t('processing.emptyMediaFile'));
          return;
        }

        // Determine correct media MIME type (video or audio)
        const headerType = response.headers.get('content-type');
        let finalType = 'video/mp4';
        if (headerType && !headerType.includes('octet-stream')) {
          finalType = headerType;
        } else if (inputMime && !inputMime.includes('octet-stream')) {
          finalType = inputMime;
        } else if (fileName) {
          const ext = fileName.split('.').pop()?.toLowerCase();
          if (ext === 'mp3') finalType = 'audio/mpeg';
          else if (ext === 'wav') finalType = 'audio/wav';
          else if (ext === 'm4a') finalType = 'audio/mp4';
          else if (ext === 'aac') finalType = 'audio/aac';
          else if (ext === 'flac') finalType = 'audio/flac';
          else if (ext === 'ogg') finalType = 'audio/ogg';
          else if (ext === 'webm') finalType = 'video/webm';
          else if (ext === 'mov') finalType = 'video/quicktime';
          else finalType = 'video/mp4';
        }

        const resolvedBlob = new Blob([rawBlob], { type: finalType });
        const objectUrl = URL.createObjectURL(resolvedBlob);
        setVideoUrl((prev) => {
          if (prev && prev.startsWith('blob:')) {
            URL.revokeObjectURL(prev);
          }
          return objectUrl;
        });
      } else {
        setVideoUrl(driveFileId);
      }
    } catch (error) {
      console.error('Error preparing video source:', error);
      setVideoError(i18n.t('editor.video.cannotOpen'));
    } finally {
      setVideoLoading(false);
    }
  }, [driveFileId, inputSource, fileName, inputMime]);

  useEffect(() => {
    void loadVideo();
    return () => {
      setVideoUrl((prev) => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return '';
      });
    };
  }, [loadVideo]);

  return {
    videoUrl,
    videoLoading,
    videoError,
    currentTime,
    setCurrentTime,
    reloadVideo: loadVideo,
  };
};
