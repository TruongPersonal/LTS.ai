import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Link as LinkIcon, Loader2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TARGET_LANGUAGES } from '../../types/project';
import { ModalWrapper } from '../common/ModalWrapper';

interface DrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDriveFile: (
    driveFileId: string,
    fileName: string,
    mimeType: string,
    durationSeconds: number,
    existingSubtitle?: { content: string; language: string }
  ) => Promise<void>;
}

export const extractDriveFileId = (input: string): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD) return matchFileD[1];
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam) return matchIdParam[1];
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) return trimmed;
  return null;
};

export const DrivePickerModal: React.FC<DrivePickerModalProps> = ({ isOpen, onClose, onSelectDriveFile }) => {
  const { t } = useTranslation();
  const [driveUrlInput, setDriveUrlInput] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  const [includeSubtitle, setIncludeSubtitle] = useState(false);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [subtitleContent, setSubtitleContent] = useState('');
  const [subtitleLang, setSubtitleLang] = useState('vi');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isOpen) return null;

  const extractedId = extractDriveFileId(driveUrlInput);
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSubtitleFile(file);
    const reader = new FileReader();
    reader.onload = (loadEvent) => setSubtitleContent((loadEvent.target?.result as string) || '');
    reader.readAsText(file);
  };

  const isSubmitDisabled = submitting || !extractedId || (includeSubtitle && (!subtitleFile || !subtitleContent));
  const handleConfirm = async () => {
    setError(null);
    if (!extractedId) { setError(t('media.drive.invalidLink')); return; }
    if (includeSubtitle && (!subtitleFile || !subtitleContent)) { setError(t('media.drive.subtitleRequired')); return; }
    const finalFileName = customFileName.trim() || `Drive_Media_${extractedId.substring(0, 8)}.mp4`;
    setSubmitting(true);
    try {
      await onSelectDriveFile(extractedId, finalFileName, 'video/mp4', 600, includeSubtitle && subtitleContent ? { content: subtitleContent, language: subtitleLang } : undefined);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('media.drive.loadFailed'));
    } finally { setSubmitting(false); }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={t('media.drive.title')}>
      <div className="w-full space-y-6">
        {error && <div role="alert" className="ui-status-error p-3.5 text-xs flex items-center gap-2"><AlertCircle className="size-4 shrink-0" /><span>{error}</span></div>}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2"><label className="text-xs font-bold flex items-center gap-1.5"><LinkIcon className="size-3.5 text-[var(--ui-accent)]" /><span>{t('media.drive.linkLabel')}</span></label><span className="ui-badge ui-badge-compact">{t('media.drive.publicBadge')}</span></div>
            <input data-autofocus type="text" placeholder="https://drive.google.com/file/d/18xPZ_.../view?usp=sharing" value={driveUrlInput} onChange={(event) => setDriveUrlInput(event.target.value)} className="ui-input text-xs font-mono" />
            {extractedId ? <div className="ui-status-success p-2.5 text-[11px] font-mono flex items-center gap-2"><CheckCircle2 className="size-3.5 shrink-0" /><span className="truncate">{t('media.drive.fileIdDetected', { id: extractedId })}</span></div> : driveUrlInput ? <p className="text-[11px] text-[var(--ui-warning)] font-mono">{t('media.drive.linkHint')}</p> : null}
          </div>
          <div className="space-y-2"><label className="text-xs font-semibold">{t('media.drive.fileName')}</label><input type="text" placeholder={t('media.drive.fileNamePlaceholder')} value={customFileName} onChange={(event) => setCustomFileName(event.target.value)} className="ui-input text-xs" /></div>
        </div>

        <div className="pt-2 border-t border-[var(--ui-border)] space-y-4">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileText className="size-4 text-[var(--ui-accent)]" /><span className="text-xs font-semibold">{t('media.drive.hasSubtitle')}</span></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={includeSubtitle} onChange={(event) => setIncludeSubtitle(event.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-[var(--ui-border-strong)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--ui-accent)]" /></label></div>
          {includeSubtitle && <div className="p-4 rounded-2xl bg-[var(--ui-surface-subtle)] border border-[var(--ui-border)] space-y-4"><div className="space-y-2"><label className="text-xs font-semibold">{t('media.drive.subtitleFile')}</label><input type="file" accept=".srt,.vtt" onChange={handleFileChange} className="block w-full text-xs ui-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-[var(--ui-border)] file:text-xs file:font-semibold file:bg-[var(--ui-surface)] file:text-[var(--ui-text)] cursor-pointer" /></div><div className="space-y-2"><label className="text-xs font-semibold">{t('media.drive.sourceLanguage')}</label><select value={subtitleLang} onChange={(event) => setSubtitleLang(event.target.value)} className="ui-select text-xs cursor-pointer">{TARGET_LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.flag} {lang.nativeName}</option>)}</select></div></div>}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--ui-border)]"><button onClick={onClose} disabled={submitting} className="ui-button ui-button-secondary">{t('common.cancel')}</button><button onClick={handleConfirm} disabled={isSubmitDisabled} className="ui-button ui-button-primary">{submitting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}<span>{t('media.drive.uploadAction')}</span></button></div>
      </div>
    </ModalWrapper>
  );
};
