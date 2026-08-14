import React from 'react';

interface CueTranslationViewProps {
  targetText: string;
  isEditing: boolean;
  textDraft: string | null;
  onTextDraftChange: (text: string) => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onClick: (e: React.MouseEvent) => void;
  extraEyeMenu?: React.ReactNode;
}

export const CueTranslationView: React.FC<CueTranslationViewProps> = ({
  targetText,
  isEditing,
  textDraft,
  onTextDraftChange,
  onConfirmEdit,
  onCancelEdit,
  onClick,
  extraEyeMenu,
}) => {
  return (
    <div className="editor-cue-text-line" onClick={onClick}>
      {isEditing ? (
        <textarea
          data-autofocus
          value={textDraft ?? ''}
          onChange={(e) => onTextDraftChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onConfirmEdit();
            if (e.key === 'Escape') onCancelEdit();
          }}
          className="editor-translation-input ui-input text-xs font-medium"
          rows={2}
        />
      ) : (
        <p className="editor-translation-static text-xs font-semibold text-[var(--ui-text)]">
          {targetText || <span className="text-[var(--ui-text-muted)] opacity-40 font-normal">-</span>}
        </p>
      )}
      {extraEyeMenu}
    </div>
  );
};
