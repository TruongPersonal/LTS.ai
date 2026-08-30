import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertCircle, ArrowDownLeft, PictureInPicture2, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VideoSettingsMenu } from './VideoSettingsMenu';
import { VideoControlsBar } from './VideoControlsBar';

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  videoUrl?: string;
  loading?: boolean;
  error?: string | null;
  onTimeUpdate?: (seconds: number) => void;
  subtitleTrackUrl?: string;
  subtitleLanguage?: string;
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 1.75, 2, 0.25, 0.5, 0.75];
const CONTROLS_HIDE_DELAY = 2200;

const isTextEntryTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  (
    {
      videoUrl,
      error = null,
      onTimeUpdate,
      subtitleTrackUrl,
      subtitleLanguage,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const playerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const trackRef = useRef<HTMLTrackElement>(null);
    const settingsMenuRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);
    const controlsTimeoutRef = useRef<number | null>(null);
    const pendingSeekRef = useRef<number | null>(null);
    const lastAudibleVolumeRef = useRef(1);
    const wasSettingsOpenRef = useRef(false);
    const restoreSettingsFocusRef = useRef(true);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
    const [isPictureInPicture, setIsPictureInPicture] = useState(false);
    const [isLooping, setIsLooping] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (seconds: number) => {
          const video = videoRef.current;
          if (!video || !Number.isFinite(seconds)) return;

          const requestedTime = Math.max(seconds, 0);
          const safeTime =
            Number.isFinite(video.duration) && video.duration > 0
              ? Math.min(requestedTime, video.duration)
              : requestedTime;

          if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
            pendingSeekRef.current = safeTime;
          } else {
            pendingSeekRef.current = null;
          }

          video.currentTime = safeTime;
          setCurrentTime(safeTime);
          onTimeUpdate?.(safeTime);
        },
      }),
      [onTimeUpdate],
    );

    const clearControlsTimeout = useCallback(() => {
      if (controlsTimeoutRef.current !== null) {
        window.clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
    }, []);

    const scheduleControlsHide = useCallback(() => {
      clearControlsTimeout();
      controlsTimeoutRef.current = window.setTimeout(() => {
        if (!videoRef.current?.paused && !settingsOpen) {
          setControlsVisible(false);
          if (
            document.activeElement instanceof HTMLElement &&
            playerRef.current?.contains(document.activeElement)
          ) {
            document.activeElement.blur();
          }
        }
      }, CONTROLS_HIDE_DELAY);
    }, [clearControlsTimeout, settingsOpen]);

    const showControls = useCallback(() => {
      setControlsVisible(true);
      if (!videoRef.current?.paused) scheduleControlsHide();
    }, [scheduleControlsHide]);

    useEffect(() => {
      if (!settingsOpen) {
        if (wasSettingsOpenRef.current && restoreSettingsFocusRef.current) {
          settingsButtonRef.current?.focus();
        }
        restoreSettingsFocusRef.current = true;
        wasSettingsOpenRef.current = false;
        return;
      }

      wasSettingsOpenRef.current = true;
      restoreSettingsFocusRef.current = true;

      const firstSetting =
        settingsMenuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
      firstSetting?.focus();

      const handleSettingsKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        setSettingsOpen(false);
        settingsButtonRef.current?.focus();
      };

      const handleSettingsPointerDown = (event: PointerEvent) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (settingsMenuRef.current?.contains(target)) return;
        if (settingsButtonRef.current?.contains(target)) return;
        restoreSettingsFocusRef.current = false;
        setSettingsOpen(false);
      };

      document.addEventListener('keydown', handleSettingsKeyDown);
      document.addEventListener('pointerdown', handleSettingsPointerDown);
      return () => {
        document.removeEventListener('keydown', handleSettingsKeyDown);
        document.removeEventListener('pointerdown', handleSettingsPointerDown);
      };
    }, [settingsOpen]);

    useEffect(() => {
      setPlaybackError(null);
      pendingSeekRef.current = null;
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setIsFullscreen(false);
      setControlsVisible(true);
      setSettingsOpen(false);
      setIsPictureInPicture(false);
      setIsLooping(false);
      clearControlsTimeout();

      const video = videoRef.current;
      if (!video) return;

      video.pause();
      video.loop = false;
      video.currentTime = 0;
      video.load();
    }, [clearControlsTimeout, videoUrl]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadedMetadata = () => {
        const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
        const pendingSeek = pendingSeekRef.current;
        const nextTime =
          pendingSeek !== null && Number.isFinite(pendingSeek)
            ? nextDuration > 0
              ? Math.min(Math.max(pendingSeek, 0), nextDuration)
              : Math.max(pendingSeek, 0)
            : Number.isFinite(video.currentTime)
              ? video.currentTime
              : 0;

        if (pendingSeek !== null) {
          video.currentTime = nextTime;
          pendingSeekRef.current = null;
        }

        setDuration(nextDuration);
        setCurrentTime(nextTime);
        setVolume(video.volume);
        setIsMuted(video.muted);
        setPlaybackRate(video.playbackRate);
        if (video.volume > 0) lastAudibleVolumeRef.current = video.volume;
      };

      const handleTimeUpdate = () => {
        const nextTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        setCurrentTime(nextTime);
        onTimeUpdate?.(nextTime);
      };

      const handlePlay = () => {
        setIsPlaying(true);
        scheduleControlsHide();
      };

      const handlePause = () => {
        setIsPlaying(false);
        setControlsVisible(true);
        clearControlsTimeout();
      };

      const handleVolumeChange = () => {
        setVolume(video.volume);
        setIsMuted(video.muted);
        if (video.volume > 0) lastAudibleVolumeRef.current = video.volume;
      };

      const handleRateChange = () => setPlaybackRate(video.playbackRate);

      const handleEnterPictureInPicture = () => setIsPictureInPicture(true);

      const handleLeavePictureInPicture = () => setIsPictureInPicture(false);

      const handleEnded = () => {
        setIsPlaying(false);
        setControlsVisible(true);
        clearControlsTimeout();
        const endTime = Number.isFinite(video.duration) ? video.duration : video.currentTime;
        if (Number.isFinite(endTime)) {
          setCurrentTime(endTime);
          onTimeUpdate?.(endTime);
        }
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('volumechange', handleVolumeChange);
      video.addEventListener('ratechange', handleRateChange);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('enterpictureinpicture', handleEnterPictureInPicture);
      video.addEventListener('leavepictureinpicture', handleLeavePictureInPicture);

      setIsPictureInPicture(document.pictureInPictureElement === video);

      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        handleLoadedMetadata();
      }

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('volumechange', handleVolumeChange);
        video.removeEventListener('ratechange', handleRateChange);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('enterpictureinpicture', handleEnterPictureInPicture);
        video.removeEventListener('leavepictureinpicture', handleLeavePictureInPicture);
      };
    }, [clearControlsTimeout, onTimeUpdate, scheduleControlsHide, videoUrl]);

    useEffect(() => {
      const applyTrackMode = () => {
        const mode = subtitleTrackUrl && subtitlesEnabled ? 'showing' : 'hidden';
        if (trackRef.current?.track) {
          trackRef.current.track.mode = mode;
        }
        if (videoRef.current?.textTracks) {
          for (let i = 0; i < videoRef.current.textTracks.length; i++) {
            videoRef.current.textTracks[i].mode = mode;
          }
        }
      };

      applyTrackMode();
      const id1 = window.setTimeout(applyTrackMode, 50);
      const id2 = window.setTimeout(applyTrackMode, 200);
      return () => {
        window.clearTimeout(id1);
        window.clearTimeout(id2);
      };
    }, [subtitleTrackUrl, subtitlesEnabled]);

    useEffect(() => () => clearControlsTimeout(), [clearControlsTimeout]);

    useEffect(() => {
      const video = videoRef.current;
      const player = playerRef.current;

      const handleFullscreenChange = () => {
        const isFs = Boolean(
          document.fullscreenElement === player ||
          document.fullscreenElement === video ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement === player ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement === video
        );
        setIsFullscreen(isFs);
      };

      const handleWebkitBegin = () => setIsFullscreen(true);
      const handleWebkitEnd = () => setIsFullscreen(false);

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

      if (video) {
        video.addEventListener('webkitbeginfullscreen', handleWebkitBegin);
        video.addEventListener('webkitendfullscreen', handleWebkitEnd);
      }

      handleFullscreenChange();
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        if (video) {
          video.removeEventListener('webkitbeginfullscreen', handleWebkitBegin);
          video.removeEventListener('webkitendfullscreen', handleWebkitEnd);
        }
      };
    }, [videoUrl]);

    const togglePlay = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      if (video.paused) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    }, []);

    const seekBy = useCallback(
      (offsetSeconds: number) => {
        const video = videoRef.current;
        if (!video || !Number.isFinite(offsetSeconds)) return;

        const currentVideoTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        const nextVideoTime = Math.max(0, currentVideoTime + offsetSeconds);
        const safeTime =
          Number.isFinite(video.duration) && video.duration > 0
            ? Math.min(nextVideoTime, video.duration)
            : nextVideoTime;

        video.currentTime = safeTime;
        setCurrentTime(safeTime);
        onTimeUpdate?.(safeTime);
      },
      [onTimeUpdate]
    );

    const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      const nextTime = Number(event.currentTarget.value);
      if (!video || duration <= 0 || !Number.isFinite(nextTime)) return;

      const safeTime = Math.min(Math.max(nextTime, 0), duration);
      video.currentTime = safeTime;
      setCurrentTime(safeTime);
      onTimeUpdate?.(safeTime);
    };

    const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      const nextVolume = Number(event.currentTarget.value);
      if (!video || !Number.isFinite(nextVolume)) return;

      const safeVolume = Math.min(Math.max(nextVolume, 0), 1);
      video.volume = safeVolume;
      video.muted = false;
      if (safeVolume > 0) lastAudibleVolumeRef.current = safeVolume;
    };

    const toggleMute = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      if (video.volume > 0 && !video.muted) {
        lastAudibleVolumeRef.current = video.volume;
        video.muted = false;
        video.volume = 0;
        return;
      }

      video.muted = false;
      video.volume = lastAudibleVolumeRef.current > 0 ? lastAudibleVolumeRef.current : 1;
    }, []);

    const cyclePlaybackRate = () => {
      const video = videoRef.current;
      if (!video) return;

      const currentIndex = PLAYBACK_RATES.findIndex(
        (rate) => Math.abs(rate - video.playbackRate) < 0.01
      );
      const nextRate = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
      video.playbackRate = nextRate;
    };

    const toggleSubtitles = useCallback(() => {
      if (subtitleTrackUrl) setSubtitlesEnabled((enabled) => !enabled);
    }, [subtitleTrackUrl]);

    const toggleLoop = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      const nextLoopState = !video.loop;
      video.loop = nextLoopState;
      setIsLooping(nextLoopState);
    }, []);

    const togglePictureInPicture = async () => {
      const video = videoRef.current;
      if (!video || !pictureInPictureSupported) return;

      try {
        if (document.pictureInPictureElement === video) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
        setSettingsOpen(false);
      } catch {
        
      }
    };

    const toggleFullscreen = useCallback(async () => {
      const player = playerRef.current;
      const video = videoRef.current;
      if (!player && !video) return;

      const doc = document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
      };

      const playerEl = player as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
      };

      const videoEl = video as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitEnterFullscreen?: () => void;
        webkitExitFullscreen?: () => void;
        webkitSupportsFullscreen?: boolean;
      };

      try {
        if (doc.fullscreenElement || doc.webkitFullscreenElement) {
          if (doc.exitFullscreen) await doc.exitFullscreen();
          else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        } else if (playerEl && playerEl.requestFullscreen) {
          await playerEl.requestFullscreen();
        } else if (playerEl && playerEl.webkitRequestFullscreen) {
          await playerEl.webkitRequestFullscreen();
        } else if (videoEl && videoEl.webkitEnterFullscreen) {
          videoEl.webkitEnterFullscreen();
        } else if (videoEl && videoEl.requestFullscreen) {
          await videoEl.requestFullscreen();
        }
      } catch {
        if (videoEl && videoEl.webkitEnterFullscreen) {
          try {
            videoEl.webkitEnterFullscreen();
          } catch {
            
          }
        }
      } finally {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        scheduleControlsHide();
      }
    }, [scheduleControlsHide]);

    useEffect(() => {
      const handleKeyboardShortcut = (event: KeyboardEvent) => {
        if (isTextEntryTarget(event.target)) return;

        const target = event.target;
        const isRangeInput = target instanceof HTMLInputElement && target.type === 'range';
        const isArrowKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight';

        if (isArrowKey && isRangeInput) return;

        if (event.repeat && ['Space', 'KeyC', 'KeyF', 'KeyL', 'KeyM'].includes(event.code)) {
          event.preventDefault();
          return;
        }

        if (event.code === 'Space') {
          event.preventDefault();
          togglePlay();
          return;
        }

        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          seekBy(
            event.key === 'ArrowLeft' ? (event.shiftKey ? -0.1 : -5) : event.shiftKey ? 0.1 : 5
          );
          return;
        }

        switch (event.key.toLowerCase()) {
          case 'c':
            event.preventDefault();
            toggleSubtitles();
            break;
          case 'f':
            event.preventDefault();
            void toggleFullscreen();
            break;
          case 'l':
            event.preventDefault();
            toggleLoop();
            break;
          case 'm':
            event.preventDefault();
            toggleMute();
            break;
          default:
            break;
        }
      };

      document.addEventListener('keydown', handleKeyboardShortcut);
      return () => document.removeEventListener('keydown', handleKeyboardShortcut);
    }, [seekBy, toggleFullscreen, toggleLoop, toggleMute, togglePlay, toggleSubtitles]);

    const visibleError = error || playbackError;
    const progressPercent =
      duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
    const pictureInPictureSupported =
      typeof document !== 'undefined' &&
      document.pictureInPictureEnabled === true &&
      typeof HTMLVideoElement !== 'undefined' &&
      'requestPictureInPicture' in HTMLVideoElement.prototype;

    return (
      <div className="w-full h-full min-h-0 bg-[var(--ui-video)] flex items-center justify-center overflow-hidden">
        {videoUrl && !visibleError ? (
          <div
            ref={playerRef}
            className="editor-player"
            data-playing={isPlaying}
            data-controls-visible={controlsVisible}
            onPointerEnter={showControls}
            onPointerMove={showControls}
            onPointerLeave={() => {
              if (!videoRef.current?.paused) scheduleControlsHide();
            }}
            onFocusCapture={showControls}
            onTouchStart={showControls}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              preload="metadata"
              playsInline
              className="editor-video"
              onClick={togglePlay}
              onError={() => setPlaybackError(t('editor.video.codecError'))}
            >
              {subtitleTrackUrl && (
                <track
                  ref={trackRef}
                  kind="subtitles"
                  src={subtitleTrackUrl}
                  srcLang={subtitleLanguage}
                  label="Subtitles"
                  default={subtitlesEnabled}
                  onLoad={() => {
                    const mode = subtitlesEnabled ? 'showing' : 'hidden';
                    if (trackRef.current?.track) {
                      trackRef.current.track.mode = mode;
                    }
                    if (videoRef.current?.textTracks) {
                      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
                        videoRef.current.textTracks[i].mode = mode;
                      }
                    }
                  }}
                />
              )}
            </video>

            {isPictureInPicture && (
              <div className="absolute inset-0 bg-[var(--ui-surface)] flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in zoom-in-95 duration-200">
                <div className="size-14 rounded-2xl bg-[var(--ui-accent-soft)] border border-[var(--ui-accent)]/30 text-[var(--ui-accent)] flex items-center justify-center shadow-lg mb-3">
                  <PictureInPicture2 className="size-7" />
                </div>
                <h4 className="text-sm font-bold text-[var(--ui-text)]">
                  {t('editor.video.pipPlaying')}
                </h4>
                <button
                  type="button"
                  onClick={() => void togglePictureInPicture()}
                  className="ui-button ui-button-primary mt-4 flex items-center gap-2"
                >
                  <ArrowDownLeft className="size-4" />
                  <span>{t('editor.video.pipExit')}</span>
                </button>
              </div>
            )}

            {!isPlaying && !isPictureInPicture && (
              <button
                type="button"
                className="editor-video-center-play"
                onClick={togglePlay}
                aria-label="Play video"
              >
                <Play className="size-7 fill-current" aria-hidden="true" />
              </button>
            )}

            {settingsOpen && (
              <VideoSettingsMenu
                ref={settingsMenuRef}
                subtitlesEnabled={subtitlesEnabled}
                hasSubtitlesTrack={Boolean(subtitleTrackUrl)}
                onToggleSubtitles={toggleSubtitles}
                pictureInPictureSupported={pictureInPictureSupported}
                isPictureInPicture={isPictureInPicture}
                onTogglePictureInPicture={() => void togglePictureInPicture()}
                isLooping={isLooping}
                onToggleLoop={toggleLoop}
                playbackRate={playbackRate}
                onCyclePlaybackRate={cyclePlaybackRate}
              />
            )}

            <VideoControlsBar
              currentTime={currentTime}
              duration={duration}
              progressPercent={progressPercent}
              isPlaying={isPlaying}
              volume={volume}
              isMuted={isMuted}
              isFullscreen={isFullscreen}
              settingsOpen={settingsOpen}
              settingsButtonRef={settingsButtonRef}
              onTogglePlay={togglePlay}
              onToggleMute={toggleMute}
              onVolumeChange={handleVolumeChange}
              onProgressChange={handleProgressChange}
              onToggleSettings={() => {
                setSettingsOpen((open) => !open);
                showControls();
              }}
              onToggleFullscreen={() => void toggleFullscreen()}
            />
          </div>
        ) : visibleError ? (
          <div
            className="max-w-md p-8 text-center text-[var(--ui-danger)] flex flex-col items-center gap-3 animate-in fade-in duration-200"
            role="alert"
          >
            <AlertCircle className="size-7" />
            <p className="text-xs font-semibold">{t('editor.video.cannotOpen')}</p>
            <p className="text-[11px] leading-relaxed opacity-80">{visibleError}</p>
          </div>
        ) : (
          <div
            className="relative w-full h-full bg-[var(--ui-surface-subtle)] flex items-center justify-center p-8 transition-colors duration-700 overflow-hidden"
            role="status"
          >
            <div className="absolute inset-0 ui-skeleton opacity-80 animate-out fade-out duration-700 fill-mode-forwards pointer-events-none" />
            <div className="relative z-10 size-12 rounded-2xl ui-skeleton shadow-sm animate-in zoom-in-95 duration-500" />
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
