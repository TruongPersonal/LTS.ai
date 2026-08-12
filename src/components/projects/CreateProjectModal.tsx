import React, { useState } from 'react';
import { AlertCircle, ChevronDown, FolderPlus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TargetLanguageCode } from '../../types/database';
import { TARGET_LANGUAGES } from '../../types/project';
import { ModalWrapper } from '../common/ModalWrapper';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string, targetLanguage: TargetLanguageCode) => Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguageCode>('vi');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setErrorMsg(null); setSubmitting(true);
    try {
      await onSubmit(title.trim(), description.trim(), targetLanguage);
      setTitle(''); setDescription(''); setTargetLanguage('vi'); onClose();
    } catch (error) {
      console.error('Failed to create project:', error);
      setErrorMsg(t('project.createError'));
    } finally { setSubmitting(false); }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={t('project.createTitle')} subtitle={t('project.createSubtitle')} icon={<FolderPlus className="size-5" />} maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && <div role="alert" className="ui-status-error p-3 text-xs flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{errorMsg}</div>}
        <label className="block"><span className="block text-xs font-semibold mb-1.5">{t('project.name')} <span className="text-[var(--ui-danger)]">*</span></span><input data-autofocus type="text" required placeholder={t('project.namePlaceholder')} value={title} onChange={(event) => setTitle(event.target.value)} className="ui-input text-xs" /></label>
        <label className="block"><span className="block text-xs font-semibold mb-1.5">{t('project.description')}</span><textarea rows={3} placeholder={t('project.descriptionPlaceholder')} value={description} onChange={(event) => setDescription(event.target.value)} className="ui-input text-xs resize-none" /></label>
        <label className="block">
          <span className="block text-xs font-semibold mb-1.5">{t('project.targetLanguage')}</span>
          <div className="relative">
            <select
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value as TargetLanguageCode)}
              className="ui-select text-xs font-semibold appearance-none pr-9"
            >
              {TARGET_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.flag} {language.nativeName} ({language.code.toUpperCase()})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 ui-soft pointer-events-none" />
          </div>
        </label>
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--ui-border)]"><button type="button" onClick={onClose} className="ui-button ui-button-secondary">{t('common.cancel')}</button><button type="submit" disabled={submitting} className="ui-button ui-button-primary">{submitting && <Loader2 className="size-4 animate-spin" />}<span>{submitting ? t('project.creating') : t('project.createAction')}</span></button></div>
      </form>
    </ModalWrapper>
  );
};
