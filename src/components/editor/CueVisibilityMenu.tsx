import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CueVisibilityMenuProps {
  metadataVisible: boolean;
  sourceVisible: boolean;
  actionsVisible?: boolean;
  onToggleMetadata: () => void;
  onToggleSource: () => void;
  onToggleActions?: () => void;
  label?: string;
  compact?: boolean;
}

export const CueVisibilityMenu: React.FC<CueVisibilityMenuProps> = ({
  metadataVisible,
  sourceVisible,
  actionsVisible,
  onToggleMetadata,
  onToggleSource,
  onToggleActions,
  label,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const closeAfterBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  };

  return (
    <div
      className={`cue-visibility-menu ${compact ? 'cue-visibility-menu-compact' : ''}`}
      onBlurCapture={closeAfterBlur}
    >
      <button
        type="button"
        className={compact ? 'ui-icon-button ui-icon-button-sm cue-visibility-trigger' : 'ui-button ui-button-secondary ui-button-compact cue-visibility-trigger'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label || t('editor.visibility.details')}
        onClick={() => setOpen((value) => !value)}
      >
        <Eye className="size-4" />
        {!compact && <span className="cue-visibility-toolbar-label">{label || t('editor.visibility.details')}</span>}
      </button>

      {open && (
        <div className="cue-visibility-popover" role="menu" aria-label={t('editor.visibility.title')}>
          <div className="cue-visibility-popover-heading">{t('editor.visibility.title')}</div>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={metadataVisible}
            className="cue-visibility-option"
            onClick={(event) => { event.stopPropagation(); onToggleMetadata(); }}
          >
            <span className="cue-visibility-option-icon">{metadataVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</span>
            <span className="cue-visibility-option-copy">
              <strong>{t('editor.visibility.metadata')}</strong>
            </span>
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={sourceVisible}
            className="cue-visibility-option"
            onClick={(event) => { event.stopPropagation(); onToggleSource(); }}
          >
            <span className="cue-visibility-option-icon">{sourceVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</span>
            <span className="cue-visibility-option-copy">
              <strong>{t('editor.visibility.source')}</strong>
            </span>
          </button>
          {onToggleActions && (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={Boolean(actionsVisible)}
              className="cue-visibility-option"
              onClick={(event) => { event.stopPropagation(); onToggleActions(); }}
            >
              <span className="cue-visibility-option-icon">{actionsVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</span>
              <span className="cue-visibility-option-copy">
                <strong>{t('editor.visibility.actions')}</strong>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
