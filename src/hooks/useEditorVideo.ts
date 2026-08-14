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

        const streamUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          driveFileId
        )}?alt=media&access_token=${encodeURIComponent(accessToken)}`;

        setVideoUrl(streamUrl);
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
