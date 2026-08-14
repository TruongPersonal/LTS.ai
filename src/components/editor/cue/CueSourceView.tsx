import React from 'react';

interface CueSourceViewProps {
  sourceText: string;
  isEditing: boolean;
  sourceDraft: string | null;
  onSourceDraftChange: (text: string) => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onClick: (e: React.MouseEvent) => void;
  extraEyeMenu?: React.ReactNode;
}

export const CueSourceView: React.FC<CueSourceViewProps> = ({
  sourceText,
  isEditing,
  sourceDraft,
  onSourceDraftChange,
  onConfirmEdit,
  onCancelEdit,
  onClick,
  extraEyeMenu,
}) => {
  return (
    <div className="editor-source-box" onClick={onClick}>
      <div className="editor-cue-text-line">
        {isEditing ? (
          <textarea
            value={sourceDraft ?? ''}
            onChange={(e) => onSourceDraftChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onConfirmEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            className="editor-translation-input ui-input text-xs"
            rows={2}
          />
        ) : (
          <p className="editor-source-static text-xs ui-muted">
            {sourceText || <span className="opacity-40">-</span>}
          </p>
        )}
        {extraEyeMenu}
      </div>
    </div>
  );
};
