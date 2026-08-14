import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { SubtitleItem } from '../../types/database';
import { CueCard } from './CueCard';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatDisplayTime } from '../../utils/time';
import { getSourceTextById } from '../../utils/subtitleEditor';
import type { CueVisibility, CueVisibilityKey } from '../../utils/cueVisibility';
import type { TimingDraft } from '../../hooks/useEditorDraft';

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

export const EditorCueList: React.FC<EditorCueListProps> = ({
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
            const sourceText = getSourceTextById(sourceSubtitles, item.id);

            return (
              <CueCard
                key={item.id}
                item={item}
                index={index}
                isActive={item.id === activeCueId}
                sourceText={sourceText}
                metadataVisible={visibility.metadata}
                sourceVisible={visibility.source}
                cueActionsVisible={cueActionsVisible}
                editingTimingCueId={editingTimingCueId}
                editingTextCueId={editingTextCueId}
                timingDraft={timingDraft}
                textDraft={textDraft}
                sourceDraft={sourceDraft}
                cardRef={(node) => {
                  if (node) cueRefs.current.set(item.id, node);
                  else cueRefs.current.delete(item.id);
                }}
                onSelectCard={onSelectCue}
                onCueVisibilityToggle={onCueVisibilityToggle}
                onAddCue={onAddCue}
                onStartTextEdit={onStartTextEdit}
                onCancelTextEdit={onCancelTextEdit}
                onConfirmTextEdit={onConfirmTextEdit}
                onStartTimingEdit={onStartTimingEdit}
                onCancelTimingEdit={onCancelTimingEdit}
                onConfirmTimingEdit={onConfirmTimingEdit}
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
