import React from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SubtitleItem } from '../../types/database';
import { formatDisplayTime } from '../../utils/time';
import { CueVisibilityMenu } from './CueVisibilityMenu';
import type { CueVisibilityKey } from '../../utils/cueVisibility';

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
  timingDraft: { start: string; end: string } | null;
  textDraft: string | null;
  sourceDraft: string | null;
  cardRef: (node: HTMLDivElement | null) => void;
  onSelectCard: (item: SubtitleItem) => void;
  onCueVisibilityToggle: (cueId: number, key: CueVisibilityKey, currentResolvedValue: boolean) => void;
  onAddCue: (afterId?: number) => void;
  onStartTextEdit: (item: SubtitleItem) => void;
  onCancelTextEdit: () => void;
  onConfirmTextEdit: (id: number) => void;
  onSetCuePendingDelete: (id: number) => void;
  setTimingDraft: React.Dispatch<React.SetStateAction<{ start: string; end: string } | null>>;
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
          <div className="editor-cue-metadata-row">
            <div className="flex items-center gap-2.5 min-w-0">
              {metadataVisible && <span className="text-xs font-extrabold text-[var(--ui-accent)]">#{index + 1}</span>}
              {metadataVisible && (
                isEditingTiming ? (
                  <div className="editor-timing-edit" onClick={(event) => event.stopPropagation()}>
                    <label>
                      <span className="sr-only">{t('editor.timing.start')}</span>
                      <input
                        data-autofocus
                        type="number"
                        min="0"
                        step="0.1"
                        value={timingDraft?.start ?? ''}
                        onChange={(event) => setTimingDraft((draft) => (draft ? { ...draft, start: event.target.value } : draft))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') onConfirmTextEdit(item.id);
                          if (event.key === 'Escape') onCancelTextEdit();
                        }}
                        className="ui-input"
                      />
                    </label>
                    <span className="text-[10px] ui-soft">→</span>
                    <label>
                      <span className="sr-only">{t('editor.timing.end')}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={timingDraft?.end ?? ''}
                        onChange={(event) => setTimingDraft((draft) => (draft ? { ...draft, end: event.target.value } : draft))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') onConfirmTextEdit(item.id);
                          if (event.key === 'Escape') onCancelTextEdit();
                        }}
                        className="ui-input"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="editor-timing-static">
                    <span className="text-[11px] font-mono ui-muted shrink-0">
                      {formatDisplayTime(item.start)} → {formatDisplayTime(item.end)}
                    </span>
                  </div>
                )
              )}
            </div>
            <div className="editor-cue-header-actions" onClick={(event) => event.stopPropagation()}>
              {showEyeInHeader && visibilityMenu}
              {cueActionsVisible && (
                <button
                  type="button"
                  onClick={() => onAddCue(item.id)}
                  className="ui-icon-button ui-icon-button-sm"
                  aria-label={t('editor.cue.addAfterAria', { index: index + 1 })}
                >
                  <Plus className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {sourceVisible && (
          <div className="editor-cue-source-row">
            {isEditing ? (
              <>
                <div className="editor-source-edit" onClick={(event) => event.stopPropagation()}>
                  <textarea
                    value={sourceDraft ?? ''}
                    onChange={(event) => setSourceDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') onCancelTextEdit();
                      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) onConfirmTextEdit(item.id);
                    }}
                    className="ui-input editor-target-input text-xs"
                  />
                </div>
                {showEyeInSource && <div className="editor-inline-actions" onClick={(event) => event.stopPropagation()}>{visibilityMenu}</div>}
              </>
            ) : (
              <>
                <p className="editor-cue-source whitespace-pre-wrap">{sourceText || '—'}</p>
                {showEyeInSource && <div className="editor-inline-actions" onClick={(event) => event.stopPropagation()}>{visibilityMenu}</div>}
              </>
            )}
          </div>
        )}

        <div className="editor-translation-row">
          {isEditing ? (
            <>
              <div className="editor-translation-edit" onClick={(event) => event.stopPropagation()}>
                <textarea
                  autoFocus
                  value={textDraft ?? ''}
                  onChange={(event) => setTextDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') onCancelTextEdit();
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) onConfirmTextEdit(item.id);
                  }}
                  className="ui-input editor-target-input"
                />
              </div>
              <div className="editor-inline-actions" onClick={(event) => event.stopPropagation()}>
                {showEyeInTranslation && visibilityMenu}
                <button
                  type="button"
                  onClick={() => onConfirmTextEdit(item.id)}
                  className="ui-icon-button ui-icon-button-sm"
                  aria-label={t('editor.cue.confirmTranslation')}
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onCancelTextEdit}
                  className="ui-icon-button ui-icon-button-sm"
                  aria-label={t('editor.cue.cancelTranslation')}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="editor-translation-static whitespace-pre-wrap">{item.text || '—'}</p>
              <div className="editor-inline-actions" onClick={(event) => event.stopPropagation()}>
                {showEyeInTranslation && visibilityMenu}
                {cueActionsVisible && (
                  <button
                    type="button"
                    onClick={() => onStartTextEdit(item)}
                    className="ui-icon-button ui-icon-button-sm"
                    aria-label={t('editor.cue.editTranslationAria', { index: index + 1 })}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
                {cueActionsVisible && (
                  <button
                    type="button"
                    onClick={() => onSetCuePendingDelete(item.id)}
                    className="ui-icon-button ui-icon-button-sm ui-danger-text"
                    aria-label={t('editor.cue.deleteAria', { index: index + 1 })}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
