import React, { useState, useRef, useEffect } from 'react';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LandingHeroVideoProps {
  videoSrc?: string;
  posterSrc?: string;
}

export const LandingHeroVideo: React.FC<LandingHeroVideoProps> = ({
  videoSrc = '/landing-video.mp4',
  posterSrc = '/landing-preview.png',
}) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [duration, setDuration] = useState('00:18');
  const [hasVideoError, setHasVideoError] = useState(false);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Continuous timer while playing (starts at 00:00 and increments endlessly)
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleStartPlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current || hasVideoError) return;

    videoRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch((err) => {
        console.warn('Video playback failed:', err);
        setIsPlaying(false);
      });
  };

  const handlePause = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (dur && !isNaN(dur) && isFinite(dur)) {
      setDuration(formatTime(dur));
    }
    setHasVideoError(false);
  };

  return (
    <div className="landing-product-proof" aria-label={t('landing.previewAria')}>
      {/* macOS Window Toolbar */}
      <div className="landing-proof-toolbar">
        <span className="size-2.5 rounded-full bg-[var(--ui-danger)]" />
        <span className="size-2.5 rounded-full bg-[var(--ui-warning)]" />
        <span className="size-2.5 rounded-full bg-[var(--ui-success)]" />
        <span className="ml-2 text-[11px] ui-muted font-mono font-bold">LTS.ai Editor</span>
      </div>

      {/* Main Video & Poster Stage */}
      <div
        onClick={isPlaying ? handlePause : undefined}
        className="landing-proof-video relative overflow-hidden group select-none cursor-pointer"
      >
        {/* Real HTML5 Video Tag with Loop & Muted */}
        <video
          ref={videoRef}
          src={videoSrc}
          poster={posterSrc}
          preload="metadata"
          loop
          muted
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          onError={() => setHasVideoError(true)}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${
            isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Poster Thumbnail Image when paused / idle */}
        <img
          src={posterSrc}
          alt="Video Preview"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-all duration-500 ${
            isPlaying ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-85 group-hover:scale-105'
          }`}
        />

        {/* Ambient Dark Gradient Layer */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20 pointer-events-none" />

        {/* Central Play Button: Only clicking this button starts the video */}
        {!isPlaying && (
          <div
            onClick={handleStartPlay}
            className="relative z-10 size-16 sm:size-18 rounded-full bg-white/20 hover:bg-white/35 border border-white/35 grid place-items-center shadow-2xl transition-all transform hover:scale-110 active:scale-95 backdrop-blur-md cursor-pointer"
          >
            <Play className="size-7 sm:size-8 text-white ml-1 fill-white/90" />
          </div>
        )}

        {/* Dynamic Timestamp Badge */}
        <span className="landing-proof-time z-10 pointer-events-none font-mono">
          {isPlaying ? formatTime(elapsedSeconds) : `00:00 → ${duration}`}
        </span>
      </div>

      {/* Subtitle Cue Banner */}
      <div className="landing-proof-cue">
        <div>
          <p>{t('landing.mock.originalLabel')}</p>
          <strong>{t('landing.mock.originalText')}</strong>
        </div>
        <div>
          <p className="text-[var(--ui-accent)]">{t('landing.mock.targetLabel')}</p>
          <strong>{t('landing.mock.translatedText')}</strong>
        </div>
      </div>
    </div>
  );
};
