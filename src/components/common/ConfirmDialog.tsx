import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModalWrapper } from './ModalWrapper';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isDangerous?: boolean;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  type,
  isDangerous,
  loading = false,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  const resolvedConfirmText = confirmText || t('dialog.confirm');
  const resolvedCancelText = cancelText || t('dialog.cancel');

  const resolvedType = type ?? (isDangerous === false ? 'info' : 'danger');

  const icon = resolvedType === 'danger'
    ? <Trash2 className="size-5 text-[var(--ui-danger)]" />
    : resolvedType === 'warning'
      ? <AlertTriangle className="size-5 text-[var(--ui-warning)]" />
      : <CheckCircle2 className="size-5 text-[var(--ui-accent)]" />;

  const confirmClass = resolvedType === 'danger'
    ? 'ui-button-danger'
    : resolvedType === 'warning'
      ? 'bg-[var(--ui-warning)] border-[var(--ui-warning)] text-white hover:brightness-95'
      : 'ui-button-primary';

  const handleConfirmAction = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={title}
      icon={icon}
      maxWidth="sm"
      showCloseButton={!loading}
    >
      <div className="space-y-5">
        <p className="text-sm ui-muted leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--ui-border)]">
          <button
            data-autofocus
            type="button"
            onClick={onClose}
            disabled={loading}
            className="ui-button ui-button-secondary"
          >
            {resolvedCancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirmAction}
            disabled={loading}
            className={`ui-button ${confirmClass}`}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            <span>{resolvedConfirmText}</span>
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

