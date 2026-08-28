import { forwardRef } from 'react';
import { Captions, PictureInPicture, Repeat } from 'lucide-react';

interface VideoSettingsMenuProps {
  subtitlesEnabled: boolean;
  hasSubtitlesTrack: boolean;
  onToggleSubtitles: () => void;
  pictureInPictureSupported: boolean;
  isPictureInPicture: boolean;
  onTogglePictureInPicture: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  playbackRate: number;
  onCyclePlaybackRate: () => void;
}

export const VideoSettingsMenu = forwardRef<HTMLDivElement, VideoSettingsMenuProps>(
  (
    {
      subtitlesEnabled,
      hasSubtitlesTrack,
      onToggleSubtitles,
      pictureInPictureSupported,
      isPictureInPicture,
      onTogglePictureInPicture,
      isLooping,
      onToggleLoop,
      playbackRate,
      onCyclePlaybackRate,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className="editor-video-settings-menu"
        role="dialog"
        aria-label="Video settings"
      >
        <button
          type="button"
          className="editor-video-settings-action editor-video-settings-subtitles"
          role="switch"
          aria-label="Subtitles"
          aria-checked={subtitlesEnabled && hasSubtitlesTrack}
          aria-keyshortcuts="C"
          disabled={!hasSubtitlesTrack}
          onClick={onToggleSubtitles}
        >
          <span className="editor-video-settings-label">
            <Captions className="size-4" aria-hidden="true" />
            <span>Subtitles</span>
          </span>
          <span className="editor-video-settings-action__value">
            {subtitlesEnabled && hasSubtitlesTrack ? 'On' : 'Off'}
          </span>
        </button>

        <button
          type="button"
          className="editor-video-settings-action"
          disabled={!pictureInPictureSupported}
          onClick={onTogglePictureInPicture}
        >
          <PictureInPicture className="size-4" aria-hidden="true" />
          <span>Picture in picture</span>
          <span className="editor-video-settings-action__value">
            {isPictureInPicture ? 'On' : 'Open'}
          </span>
        </button>

        <button
          type="button"
          className="editor-video-settings-action"
          role="switch"
          aria-label="Loop"
          aria-checked={isLooping}
          aria-keyshortcuts="L"
          onClick={onToggleLoop}
        >
          <Repeat className="size-4" aria-hidden="true" />
          <span>Loop</span>
          <span className="editor-video-settings-action__value">
            {isLooping ? 'On' : 'Off'}
          </span>
        </button>

        <button
          type="button"
          className="editor-video-settings-action editor-video-settings-speed"
          onClick={onCyclePlaybackRate}
          aria-label={`Playback speed ${playbackRate} times`}
        >
          <span>Playback speed</span>
          <span className="editor-video-settings-action__value">{playbackRate}×</span>
        </button>
      </div>
    );
  }
);

VideoSettingsMenu.displayName = 'VideoSettingsMenu';
