import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import type { TimingDraft } from '../../../hooks/useEditorDraft';

interface CueTimingEditorProps {
  timingDraft: TimingDraft | null;
  onDraftChange: (updater: (prev: TimingDraft | null) => TimingDraft | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CueTimingEditor: React.FC<CueTimingEditorProps> = ({
  timingDraft,
  onDraftChange,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <div className="editor-timing-edit flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <label>
        <span className="sr-only">{t('editor.timing.start')}</span>
        <input
          data-autofocus
          type="number"
          min="0"
          step="0.1"
          value={timingDraft?.start ?? ''}
          onChange={(e) => onDraftChange((prev) => (prev ? { ...prev, start: e.target.value } : prev))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
          }}
          className="ui-input !h-6 !w-16 !text-[11px] !px-1.5 text-center font-mono"
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
          onChange={(e) => onDraftChange((prev) => (prev ? { ...prev, end: e.target.value } : prev))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
          }}
          className="ui-input !h-6 !w-16 !text-[11px] !px-1.5 text-center font-mono"
        />
      </label>
      <div className="flex items-center gap-1 ml-0.5">
        <button
          type="button"
          onClick={onConfirm}
          className="editor-icon-button editor-icon-button-success !size-5.5"
          title={t('common.confirm')}
          aria-label={t('common.confirm')}
        >
          <Check className="size-3" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="editor-icon-button !size-5.5"
          title={t('common.cancel')}
          aria-label={t('common.cancel')}
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
};
