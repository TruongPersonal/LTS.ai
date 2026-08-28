import React from 'react';
import { FileText, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModalWrapper } from '../common/ModalWrapper';
import type { AdminSubtitle } from '../../services/adminService';
import { formatVttTimestamp } from '../../utils/time';

interface SubtitleViewerModalProps {
  isOpen: boolean;
  fileName: string;
  subtitles: AdminSubtitle[];
  loading?: boolean;
  deleting?: boolean;
  onDeleteSubtitles?: () => void | Promise<void>;
  onClose: () => void;
}

export const SubtitleViewerModal: React.FC<SubtitleViewerModalProps> = ({
  isOpen,
  fileName,
  subtitles,
  loading = false,
  deleting = false,
  onDeleteSubtitles,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedTrackIndex, setSelectedTrackIndex] = React.useState(0);

  const activeTrack = subtitles[selectedTrackIndex] || subtitles[0];
  const cues = Array.isArray(activeTrack?.content) ? activeTrack.content : [];

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={t('admin.subtitles.viewerTitle')}
      subtitle={fileName}
      icon={<FileText className="size-5" />}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex justify-center items-center gap-2 ui-muted text-sm">
            <Loader2 className="size-5 animate-spin text-[var(--ui-accent)]" />
            <span>{t('admin.subtitles.loading')}</span>
          </div>
        ) : subtitles.length === 0 ? (
          <div className="py-12 text-center ui-muted text-sm">
            {t('admin.subtitles.noSubtitles')}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] pb-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                {subtitles.map((track, index) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => setSelectedTrackIndex(index)}
                    className={`ui-button ui-button-compact text-xs font-semibold ${
                      index === selectedTrackIndex ? 'ui-button-primary' : 'ui-button-secondary'
                    }`}
                  >
                    {track.language.toUpperCase()}({track.content?.length || 0})
                  </button>
                ))}
              </div>

              {onDeleteSubtitles && (
                <button
                  type="button"
                  onClick={() => void onDeleteSubtitles()}
                  disabled={deleting}
                  className="ui-button ui-button-danger ui-button-compact text-xs shrink-0"
                >
                  <Trash2 className="size-3.5" />
                  <span>{deleting ? t('admin.actions.deleting') : t('admin.subtitles.deleteSubtitles')}</span>
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {cues.length === 0 ? (
                <p className="text-xs ui-muted text-center py-6">{t('admin.subtitles.emptyTrack')}</p>
              ) : (
                cues.map((cue, idx) => (
                  <div
                    key={cue.id ?? idx}
                    className="p-3 rounded-lg bg-[var(--ui-surface-subtle)] border border-[var(--ui-border)] text-xs space-y-1 hover:border-[var(--ui-accent)]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] ui-muted font-mono">
                      <span>#{idx + 1}</span>
                      <span>
                        {formatVttTimestamp(cue.start)} ➔ {formatVttTimestamp(cue.end)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--ui-text)] leading-relaxed">{cue.text}</p>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div className="flex justify-end border-t border-[var(--ui-border)] pt-4">
          <button type="button" onClick={onClose} className="ui-button ui-button-secondary">
            {t('admin.actions.close')}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
