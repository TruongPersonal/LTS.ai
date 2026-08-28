import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { SubtitleItem } from '../../types/database';
import { CueCard } from './CueCard';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatDisplayTime } from '../../utils/time';
import type { CueVisibility, CueVisibilityKey } from '../../utils/cueVisibility';
import type { TimingDraft } from '../../hooks/useEditorDraft';

const noopCueAction = (_id: number): void => undefined;

interface EditorCueListProps {
  subtitles: SubtitleItem[];
  sourceSubtitles: SubtitleItem[];
  activeCueId: number | null;
  cueDensity: string;
  globalVisibility: CueVisibility;
  cueActionsVisible: boolean;
  editingTimingCueId: number | null;
  editingTextCueId: number | null;
  timingDraft: TimingDraft | null;
  textDraft: string | null;
  sourceDraft: string | null;
  cuePendingDelete: number | null;
  cueViewportRef: React.RefObject<HTMLDivElement | null>;
  cueRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  onUserScrollInteraction?: () => void;
  onSelectCue: (item: SubtitleItem) => void;
  onCueVisibilityToggle: (cueId: number, key: CueVisibilityKey, currentResolvedValue: boolean) => void;
  getResolvedVisibility: (cueId: number) => CueVisibility;
  onAddCue: (afterId?: number) => void;
  onStartTextEdit: (item: SubtitleItem) => void;
  onCancelTextEdit: () => void;
  onConfirmTextEdit: (id: number) => void;
  onStartTimingEdit: (item: SubtitleItem) => void;
  onCancelTimingEdit: () => void;
  onConfirmTimingEdit: (id: number) => void;
  setTimingDraft: React.Dispatch<React.SetStateAction<TimingDraft | null>>;
  setTextDraft: (text: string) => void;
  setSourceDraft: (text: string) => void;
  onSetCuePendingDelete: (id: number | null) => void;
  onConfirmDeleteCue: (id: number) => void;
}

const EditorCueListComponent: React.FC<EditorCueListProps> = ({
  subtitles,
  sourceSubtitles,
  activeCueId,
  cueDensity,
  globalVisibility: _globalVisibility,
  cueActionsVisible,
  editingTimingCueId,
  editingTextCueId,
  timingDraft,
  textDraft,
  sourceDraft,
  cuePendingDelete,
  cueViewportRef,
  cueRefs,
  onUserScrollInteraction,
  onSelectCue,
  onCueVisibilityToggle,
  getResolvedVisibility,
  onAddCue,
  onStartTextEdit,
  onCancelTextEdit,
  onConfirmTextEdit,
  onStartTimingEdit,
  onCancelTimingEdit,
  onConfirmTimingEdit,
  setTimingDraft,
  setTextDraft,
  setSourceDraft,
  onSetCuePendingDelete,
  onConfirmDeleteCue,
}) => {
  const { t } = useTranslation();
  const sourceTextById = useMemo(
    () => new Map(sourceSubtitles.map((item) => [item.id, item.text])),
    [sourceSubtitles]
  );

  const pendingDeleteCue =
    cuePendingDelete !== null
      ? subtitles.find((item) => item.id === cuePendingDelete) ?? null
      : null;

  return (
    <div
      ref={cueViewportRef}
      data-cue-density={cueDensity}
      className="editor-cue-viewport"
      aria-label={t('editor.subtitleList')}
      onWheel={onUserScrollInteraction}
      onTouchMove={onUserScrollInteraction}
      onPointerDown={onUserScrollInteraction}
      onKeyDown={onUserScrollInteraction}
    >
      {subtitles.length === 0 ? (
        <div className="h-full ui-card-flat flex flex-col items-center justify-center gap-3 text-center p-6">
          <p className="text-sm font-semibold">{t('editor.noTargetSubtitle')}</p>
          <button
            type="button"
            onClick={() => onAddCue()}
            className="ui-button ui-button-primary"
          >
            <Plus className="size-4" />
            <span>{t('editor.createFirstCue')}</span>
          </button>
        </div>
      ) : (
        <div className="editor-cue-stack">
          {subtitles.map((item, index) => {
            const visibility = getResolvedVisibility(item.id);
            const isEditingTiming = editingTimingCueId === item.id;
            const isEditingText = editingTextCueId === item.id;

            return (
              <CueCard
                key={item.id}
                item={item}
                index={index}
                isActive={item.id === activeCueId}
                sourceText={sourceTextById.get(item.id) ?? ''}
                metadataVisible={visibility.metadata}
                sourceVisible={visibility.source}
                cueActionsVisible={cueActionsVisible}
                editingTimingCueId={isEditingTiming ? item.id : null}
                editingTextCueId={isEditingText ? item.id : null}
                timingDraft={isEditingTiming ? timingDraft : null}
                textDraft={isEditingText ? textDraft : null}
                sourceDraft={isEditingText ? sourceDraft : null}
                cueRefs={cueRefs}
                onSelectCard={onSelectCue}
                onCueVisibilityToggle={onCueVisibilityToggle}
                onAddCue={onAddCue}
                onStartTextEdit={onStartTextEdit}
                onCancelTextEdit={onCancelTextEdit}
                onConfirmTextEdit={isEditingText ? onConfirmTextEdit : noopCueAction}
                onStartTimingEdit={onStartTimingEdit}
                onCancelTimingEdit={onCancelTimingEdit}
                onConfirmTimingEdit={isEditingTiming ? onConfirmTimingEdit : noopCueAction}
                onSetCuePendingDelete={onSetCuePendingDelete}
                setTimingDraft={setTimingDraft}
                setTextDraft={setTextDraft}
                setSourceDraft={setSourceDraft}
              />
            );
          })}
        </div>
      )}

      {pendingDeleteCue && (
        <ConfirmDialog
          isOpen={Boolean(cuePendingDelete)}
          onClose={() => onSetCuePendingDelete(null)}
          title={t('editor.deleteCueDialog.title')}
          message={t('editor.deleteCueDialog.message', {
            index: subtitles.findIndex((i) => i.id === pendingDeleteCue.id) + 1,
            timing: `${formatDisplayTime(pendingDeleteCue.start)} → ${formatDisplayTime(
              pendingDeleteCue.end
            )}`,
          })}
          confirmText={t('editor.deleteCueDialog.confirm')}
          onConfirm={() => {
            onConfirmDeleteCue(pendingDeleteCue.id);
            onSetCuePendingDelete(null);
          }}
          type="danger"
        />
      )}
    </div>
  );
};

export const EditorCueList = React.memo(EditorCueListComponent);
