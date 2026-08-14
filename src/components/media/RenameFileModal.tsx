import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileMedia } from '../../types/database';
import { ModalWrapper } from '../common/ModalWrapper';

interface RenameFileModalProps {
  file: FileMedia | null;
  isOpen: boolean;
  onClose: () => void;
  onRename: (fileId: string, newName: string) => Promise<void>;
}

export const RenameFileModal: React.FC<RenameFileModalProps> = ({
  file,
  isOpen,
  onClose,
  onRename,
}) => {
  const { t } = useTranslation();
  const [nameDraft, setNameDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (file) {
      setNameDraft(file.file_name);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === file.file_name) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await onRename(file.id, trimmed);
      onClose();
    } catch (error) {
      console.error('Error renaming file:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={t('media.renameModalTitle')}
      subtitle={t('media.renameModalSubtitle')}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="rename-file-input" className="block text-xs font-semibold ui-muted mb-1.5">
            {t('media.drive.fileName')}
          </label>
          <input
            id="rename-file-input"
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            disabled={submitting}
            autoFocus
            required
            className="ui-input w-full"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="ui-button ui-button-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || !nameDraft.trim()}
            className="ui-button ui-button-primary"
          >
            {submitting ? t('media.savingRename') : t('media.saveRename')}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};
