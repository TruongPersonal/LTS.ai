import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t('editor.unsavedDialog.title')}
      message={t('editor.unsavedDialog.message')}
      confirmText={t('editor.unsavedDialog.confirm')}
      type="warning"
    />
  );
};
