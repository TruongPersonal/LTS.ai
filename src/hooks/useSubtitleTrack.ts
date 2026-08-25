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

    const vtt = exportToVtt(subtitles);
    const blob = new Blob([vtt], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    setSubtitleTrackUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [subtitles]);

  return subtitleTrackUrl;
};
