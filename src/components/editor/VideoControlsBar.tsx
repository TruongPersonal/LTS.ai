import React from 'react';
import { Maximize, Pause, Play, Settings2, Volume2, VolumeX } from 'lucide-react';
import { formatPlayerTime } from '../../utils/time';

interface VideoControlsBarProps {
  currentTime: number;
  duration: number;
  progressPercent: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  settingsOpen: boolean;
  settingsButtonRef: React.RefObject<HTMLButtonElement | null>;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onProgressChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleSettings: () => void;
  onToggleFullscreen: () => void;
}

export const VideoControlsBar: React.FC<VideoControlsBarProps> = ({
  currentTime,
  duration,
  progressPercent,
  isPlaying,
  volume,
  isMuted,
  isFullscreen,
  settingsOpen,
  settingsButtonRef,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onProgressChange,
  onToggleSettings,
  onToggleFullscreen,
}) => {
  const volumeIsMuted = isMuted || volume === 0;

  return (
    <div className="editor-video-controls" aria-label="Video controls">
      <input
        className="editor-video-progress"
        type="range"
        min="0"
        max={duration || 0}
        step="0.01"
        value={duration > 0 ? Math.min(currentTime, duration) : 0}
        disabled={duration <= 0}
        onChange={onProgressChange}
        aria-label="Video progress"
        style={{ '--video-progress': `${progressPercent}%` } as React.CSSProperties}
      />

      <div className="editor-video-controls__row">
        <div className="editor-video-controls__group editor-video-controls__group--primary">
          <button
            type="button"
            className="editor-video-control-button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
            aria-keyshortcuts="Space"
          >
            {isPlaying ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4 fill-current" aria-hidden="true" />
            )}
          </button>

          <div className="editor-video-volume">
            <button
              type="button"
              className="editor-video-control-button"
              onClick={onToggleMute}
              aria-label={volumeIsMuted ? 'Restore volume' : 'Mute video'}
              aria-keyshortcuts="M"
            >
              {volumeIsMuted ? (
                <VolumeX className="size-4" aria-hidden="true" />
              ) : (
                <Volume2 className="size-4" aria-hidden="true" />
              )}
            </button>
            <input
              className="editor-video-volume-range"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={onVolumeChange}
              aria-label="Video volume"
              style={{ '--volume-progress': `${volume * 100}%` } as React.CSSProperties}
            />
          </div>

          <span className="editor-video-time" aria-live="off">
            {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
          </span>
        </div>

        <div className="editor-video-controls__group editor-video-controls__group--secondary">
          <button
            type="button"
            className="editor-video-control-button"
            ref={settingsButtonRef}
            onClick={onToggleSettings}
            aria-label="Video settings"
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
          >
            <Settings2 className="size-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="editor-video-control-button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'}
            aria-keyshortcuts="F"
          >
            <Maximize className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
