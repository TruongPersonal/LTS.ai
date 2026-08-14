import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus } from 'lucide-react';
import type { SubtitleItem } from '../../../types/database';
import { formatDisplayTime } from '../../../utils/time';
import { CueTimingEditor } from './CueTimingEditor';
import type { TimingDraft } from '../../../hooks/useEditorDraft';

interface CueHeaderProps {
  item: SubtitleItem;
  index: number;
  metadataVisible: boolean;
  cueActionsVisible: boolean;
  isEditingTiming: boolean;
  timingDraft: TimingDraft | null;
  onDraftTimingChange: (updater: (prev: TimingDraft | null) => TimingDraft | null) => void;
  onStartTimingEdit: (e: React.MouseEvent) => void;
  onConfirmTimingEdit: () => void;
  onCancelTimingEdit: () => void;
  onAddCueAfter: (e: React.MouseEvent) => void;
  visibilityMenu?: React.ReactNode;
}

export const CueHeader: React.FC<CueHeaderProps> = ({
  item,
  index,
  metadataVisible,
  cueActionsVisible,
  isEditingTiming,
  timingDraft,
  onDraftTimingChange,
  onStartTimingEdit,
  onConfirmTimingEdit,
  onCancelTimingEdit,
  onAddCueAfter,
  visibilityMenu,
}) => {
  const { t } = useTranslation();

  return (
    <div className="editor-cue-metadata-row">
      <div className="flex items-center gap-2.5 min-w-0">
        {metadataVisible && (
          <span className="text-xs font-extrabold text-[var(--ui-accent)]">
            #{index + 1}
          </span>
        )}

        {metadataVisible &&
          (isEditingTiming ? (
            <CueTimingEditor
              timingDraft={timingDraft}
              onDraftChange={onDraftTimingChange}
              onConfirm={onConfirmTimingEdit}
              onCancel={onCancelTimingEdit}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onStartTimingEdit}
                className="editor-timing-badge"
                title={t('accessibility.editTiming')}
                aria-label={t('accessibility.editTiming')}
              >
                <span>{formatDisplayTime(item.start)}</span>
                <span className="text-[10px] ui-soft">→</span>
                <span>{formatDisplayTime(item.end)}</span>
                <span className="editor-timing-duration">
                  ({Math.max(0, item.end - item.start).toFixed(1)}s)
                </span>
              </button>

              {cueActionsVisible && (
                <button
                  type="button"
                  onClick={onStartTimingEdit}
                  className="editor-icon-button !size-5.5 text-[var(--ui-muted)] hover:text-[var(--ui-accent)]"
                  title={t('accessibility.editTiming')}
                  aria-label={t('accessibility.editTiming')}
                >
                  <Pencil className="size-2.5" />
                </button>
              )}
            </div>
          ))}
      </div>

      {cueActionsVisible && (
        <div
          className="editor-cue-header-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onAddCueAfter}
            className="editor-icon-button"
            title={t('accessibility.addCueAfter')}
            aria-label={t('accessibility.addCueAfter')}
          >
            <Plus className="size-3.5" />
          </button>
          {visibilityMenu}
        </div>
      )}
    </div>
  );
};
