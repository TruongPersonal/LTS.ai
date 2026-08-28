import { useEffect, useState } from 'react';
import type { SubtitleItem } from '../types/database';
import { exportToVtt } from '../utils/subtitleParsers';

export const useSubtitleTrack = (subtitles: SubtitleItem[]): string | undefined => {
  const [subtitleTrackUrl, setSubtitleTrackUrl] = useState<string | undefined>();

  useEffect(() => {
    if (subtitles.length === 0) {
      setSubtitleTrackUrl(undefined);
      return;
    }

    let activeUrl: string | undefined;
    const timeoutId = window.setTimeout(() => {
      const vtt = exportToVtt(subtitles);
      const blob = new Blob([vtt], { type: 'text/vtt' });
      activeUrl = URL.createObjectURL(blob);
      setSubtitleTrackUrl(activeUrl);
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [subtitles]);

  return subtitleTrackUrl;
};
