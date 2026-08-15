import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VideoPlayerProps { videoUrl?: string; loading?: boolean; error?: string | null; currentTime: number; onTimeUpdate?: (seconds: number) => void; }

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, error = null, currentTime, onTimeUpdate }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => setPlaybackError(null), [videoUrl]);

  useEffect(() => {
    if (videoRef.current && currentTime >= 0) {
      const drift = Math.abs(videoRef.current.currentTime - currentTime);
      if (drift > 0.75) videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const visibleError = error || playbackError;
  return (
    <div className="w-full h-full min-h-0 bg-[var(--ui-video)] flex items-center justify-center overflow-hidden">
      {videoUrl && !visibleError ? (
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          className="w-full h-full object-contain bg-black animate-in fade-in duration-300"
          onTimeUpdate={(event) => onTimeUpdate?.(event.currentTarget.currentTime)}
          onError={() => setPlaybackError(t('editor.video.codecError'))}
        />
      ) : visibleError ? (
        <div className="max-w-md p-8 text-center text-[var(--ui-danger)] flex flex-col items-center gap-3 animate-in fade-in duration-200" role="alert">
          <AlertCircle className="size-7" />
          <p className="text-xs font-semibold">{t('editor.video.cannotOpen')}</p>
          <p className="text-[11px] leading-relaxed opacity-80">{visibleError}</p>
        </div>
      ) : (
        <div className="relative w-full h-full bg-[var(--ui-surface-subtle)] flex items-center justify-center p-8 transition-colors duration-700 overflow-hidden" role="status">
          <div className="absolute inset-0 ui-skeleton opacity-80 animate-out fade-out duration-700 fill-mode-forwards pointer-events-none" />
          <div className="relative z-10 size-12 rounded-2xl ui-skeleton shadow-sm animate-in zoom-in-95 duration-500" />
        </div>
      )}
    </div>
  );
};
