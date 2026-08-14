import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getGoogleAccessToken } from '../lib/supabase';

interface UseEditorVideoParams {
  driveFileId: string;
  inputSource: string;
}

export const useEditorVideo = ({ driveFileId, inputSource }: UseEditorVideoParams) => {
  const { t } = useTranslation();
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const loadVideo = useCallback(async () => {
    if (!driveFileId) {
      setVideoError(t('editor.video.empty'));
      setVideoLoading(false);
      return;
    }

    setVideoLoading(true);
    setVideoError(null);

    try {
      if (inputSource === 'media' || inputSource === 'existing_subtitle') {
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) {
          setVideoError(t('editor.video.sessionExpired'));
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
            setVideoError(t('editor.video.sessionExpired'));
            return;
          }
          throw new Error(`Google Drive fetch failed with status: ${response.status}`);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          setVideoError(t('processing.emptyMediaFile'));
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
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
      setVideoError(t('editor.video.cannotOpen'));
    } finally {
      setVideoLoading(false);
    }
  }, [driveFileId, inputSource, t]);

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
