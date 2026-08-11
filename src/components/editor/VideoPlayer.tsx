import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VideoPlayerProps { videoUrl?: string; loading?: boolean; error?: string | null; currentTime: number; onTimeUpdate?: (seconds: number) => void; }

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, loading = false, error = null, currentTime, onTimeUpdate }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  useEffect(() => setPlaybackError(null), [videoUrl]);
  useEffect(() => { if (videoRef.current && currentTime >= 0) { const drift = Math.abs(videoRef.current.currentTime - currentTime); if (drift > 0.75) videoRef.current.currentTime = currentTime; } }, [currentTime]);
  const visibleError = error || playbackError;
  return (
    <div className="w-full h-full min-h-0 bg-[var(--ui-video)] flex items-center justify-center overflow-hidden">
      {videoUrl && !visibleError ? <video ref={videoRef} src={videoUrl} controls autoPlay playsInline className="w-full h-full object-contain bg-black" onTimeUpdate={(event) => onTimeUpdate?.(event.currentTarget.currentTime)} onError={() => setPlaybackError(t('editor.video.codecError'))} /> : loading ? <div className="p-8 text-center text-white/80 flex flex-col items-center gap-3" role="status"><Loader2 className="size-7 animate-spin" /><p className="text-xs font-medium">{t('editor.video.loading')}</p></div> : visibleError ? <div className="max-w-md p-8 text-center text-[var(--ui-danger)] flex flex-col items-center gap-3" role="alert"><AlertCircle className="size-7" /><p className="text-xs font-semibold">{t('editor.video.cannotOpen')}</p><p className="text-[11px] leading-relaxed opacity-80">{visibleError}</p></div> : <div className="p-8 text-center text-white/60 flex flex-col items-center gap-2"><Video className="size-7" /><p className="text-xs font-medium">{t('editor.video.empty')}</p></div>}
    </div>
  );
};
