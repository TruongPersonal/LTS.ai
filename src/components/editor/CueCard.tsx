import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import type { SubtitleItem } from '../../types/database';
import { CueVisibilityMenu } from './CueVisibilityMenu';
import type { CueVisibilityKey } from '../../utils/cueVisibility';
import type { TimingDraft } from '../../hooks/useEditorDraft';
import { CueHeader } from './cue/CueHeader';
import { CueSourceView } from './cue/CueSourceView';
import { CueTranslationView } from './cue/CueTranslationView';

interface CueCardProps {
  item: SubtitleItem;
  index: number;
  isActive: boolean;
  sourceText: string;
  metadataVisible: boolean;
  sourceVisible: boolean;
  cueActionsVisible: boolean;
  editingTimingCueId: number | null;
  editingTextCueId: number | null;
  timingDraft: TimingDraft | null;
  textDraft: string | null;
  sourceDraft: string | null;
  cardRef: (node: HTMLDivElement | null) => void;
  onSelectCard: (item: SubtitleItem) => void;
  onCueVisibilityToggle: (cueId: number, key: CueVisibilityKey, currentResolvedValue: boolean) => void;
  onAddCue: (afterId?: number) => void;
  onStartTextEdit: (item: SubtitleItem) => void;
  onCancelTextEdit: () => void;
  onConfirmTextEdit: (id: number) => void;
  onStartTimingEdit: (cue: SubtitleItem) => void;
  onCancelTimingEdit: () => void;
  onConfirmTimingEdit: (id: number) => void;
  onSetCuePendingDelete: (id: number) => void;
  setTimingDraft: React.Dispatch<React.SetStateAction<TimingDraft | null>>;
  setTextDraft: (text: string) => void;
  setSourceDraft: (text: string) => void;
}

export const CueCard: React.FC<CueCardProps> = ({
  item,
  index,
  isActive,
  sourceText,
  metadataVisible,
  sourceVisible,
  cueActionsVisible,
  editingTimingCueId,
  editingTextCueId,
  timingDraft,
  textDraft,
  sourceDraft,
  cardRef,
  onSelectCard,
  onCueVisibilityToggle,
  onAddCue,
  onStartTextEdit,
  onCancelTextEdit,
  onConfirmTextEdit,
  onStartTimingEdit,
  onCancelTimingEdit,
  onConfirmTimingEdit,
  onSetCuePendingDelete,
  setTimingDraft,
  setTextDraft,
  setSourceDraft,
}) => {
  const { t } = useTranslation();
  const isEditing = editingTextCueId === item.id;
  const isEditingTiming = editingTimingCueId === item.id;

  const hasHeaderRow = metadataVisible || cueActionsVisible;
  const showEyeInHeader = cueActionsVisible && hasHeaderRow;
  const showEyeInSource = cueActionsVisible && !hasHeaderRow && sourceVisible;
  const showEyeInTranslation = cueActionsVisible && !hasHeaderRow && !sourceVisible;

  const visibilityMenu = (
    <CueVisibilityMenu
      compact
      metadataVisible={metadataVisible}
      sourceVisible={sourceVisible}
      onToggleMetadata={() => onCueVisibilityToggle(item.id, 'metadata', metadataVisible)}
      onToggleSource={() => onCueVisibilityToggle(item.id, 'source', sourceVisible)}
    />
  );

  return (
    <div
      ref={cardRef}
      onClick={() => onSelectCard(item)}
      data-metadata-visible={String(metadataVisible)}
      data-source-visible={String(sourceVisible)}
      data-actions-visible={String(cueActionsVisible)}
      className={`editor-cue-card ${isActive ? 'editor-cue-card-active' : ''}`}
    >
      <div className="editor-cue-content">
        {hasHeaderRow && (
          <CueHeader
            item={item}
            index={index}
            metadataVisible={metadataVisible}
            cueActionsVisible={cueActionsVisible}
            isEditingTiming={isEditingTiming}
            timingDraft={timingDraft}
            onDraftTimingChange={setTimingDraft}
            onStartTimingEdit={(e) => {
              e.stopPropagation();
              onStartTimingEdit(item);
            }}
            onConfirmTimingEdit={() => onConfirmTimingEdit(item.id)}
            onCancelTimingEdit={onCancelTimingEdit}
            onAddCueAfter={(e) => {
              e.stopPropagation();
              onAddCue(item.id);
            }}
            visibilityMenu={showEyeInHeader ? visibilityMenu : undefined}
          />
        )}

        {sourceVisible && (
          <CueSourceView
            sourceText={sourceText}
            isEditing={isEditing}
            sourceDraft={sourceDraft}
            onSourceDraftChange={setSourceDraft}
            onConfirmEdit={() => onConfirmTextEdit(item.id)}
            onCancelEdit={onCancelTextEdit}
            onClick={() => {
              if (!isEditing) onSelectCard(item);
            }}
            extraEyeMenu={showEyeInSource ? visibilityMenu : undefined}
          />
        )}

        <CueTranslationView
          targetText={item.text}
          isEditing={isEditing}
          textDraft={textDraft}
          onTextDraftChange={setTextDraft}
          onConfirmEdit={() => onConfirmTextEdit(item.id)}
          onCancelEdit={onCancelTextEdit}
          onClick={() => {
            if (!isEditing) onSelectCard(item);
          }}
          extraEyeMenu={showEyeInTranslation ? visibilityMenu : undefined}
        />

        {/* Bottom bar with prominent Edit pencil and Delete trash buttons on the bottom right */}
        {cueActionsVisible && (
          <div className="editor-cue-bottom-bar flex items-center justify-between mt-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
            <div />
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onCancelTextEdit}
                  className="ui-button ui-button-ghost !h-6.5 !px-2 !text-xs"
                  title={t('common.cancel')}
                  aria-label={t('common.cancel')}
                >
                  <X className="size-3" />
                  <span>{t('common.cancel')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onConfirmTextEdit(item.id)}
                  className="ui-button ui-button-primary !h-6.5 !px-2.5 !text-xs"
                  title={t('common.save')}
                  aria-label={t('common.save')}
                >
                  <Check className="size-3" />
                  <span>{t('common.save')}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onStartTextEdit(item)}
                  className="editor-card-bottom-edit-btn"
                  title={t('common.edit')}
                  aria-label={t('common.edit')}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onSetCuePendingDelete(item.id)}
                  className="editor-card-bottom-delete-btn"
                  title={t('accessibility.deleteCue')}
                  aria-label={t('accessibility.deleteCue')}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
