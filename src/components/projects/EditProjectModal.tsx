import React, { useEffect, useState } from 'react';
import { AlertCircle, Edit3, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../types/database';
import { ModalWrapper } from '../common/ModalWrapper';

interface EditProjectModalProps { isOpen: boolean; project: Project | null; onClose: () => void; onSubmit: (projectId: string, title: string, description: string) => Promise<void>; }

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, project, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useEffect(() => { if (project) { setTitle(project.title); setDescription(project.description || ''); setErrorMsg(null); } }, [project]);
  if (!isOpen || !project) return null;
  const handleSubmit = async (event: React.FormEvent) => { event.preventDefault(); if (!title.trim()) return; setSubmitting(true); setErrorMsg(null); try { await onSubmit(project.id, title.trim(), description.trim()); onClose(); } catch (error) { console.error('Failed to update project:', error); setErrorMsg(t('project.updateError')); } finally { setSubmitting(false); } };
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={t('project.editTitle')} subtitle={t('project.editSubtitle')} icon={<Edit3 className="size-5" />} maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && <div role="alert" className="ui-status-error p-3 text-xs flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{errorMsg}</div>}
        <label className="block"><span className="block text-xs font-semibold mb-1.5">{t('project.name')} <span className="text-[var(--ui-danger)]">*</span></span><input data-autofocus type="text" required value={title} onChange={(event) => setTitle(event.target.value)} className="ui-input text-xs" /></label>
        <label className="block"><span className="block text-xs font-semibold mb-1.5">{t('project.description')}</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="ui-input text-xs resize-none" /></label>
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--ui-border)]"><button type="button" onClick={onClose} className="ui-button ui-button-secondary">{t('common.cancel')}</button><button type="submit" disabled={submitting} className="ui-button ui-button-primary">{submitting && <Loader2 className="size-4 animate-spin" />}<span>{submitting ? t('project.updating') : t('project.updateAction')}</span></button></div>
      </form>
    </ModalWrapper>
  );
};
