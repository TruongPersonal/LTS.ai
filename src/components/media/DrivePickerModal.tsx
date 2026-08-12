import React, { useState } from 'react';
import { AlertCircle, FileText, FolderUp, HardDrive, Loader2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TARGET_LANGUAGES } from '../../types/project';
import { ModalWrapper } from '../common/ModalWrapper';
import { openGoogleDrivePicker, type SelectedPickerFile } from '../../utils/googlePicker';
import { formatMimeTypeLabel } from '../../utils/mediaFormat';

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

function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}


export const DrivePickerModal: React.FC<DrivePickerModalProps> = ({ isOpen, onClose, onSelectDriveFile }) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<SelectedPickerFile | null>(null);
  const [customFileName, setCustomFileName] = useState('');
  const [includeSubtitle, setIncludeSubtitle] = useState(false);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [subtitleContent, setSubtitleContent] = useState('');
  const [subtitleLang, setSubtitleLang] = useState('vi');
  const [submitting, setSubmitting] = useState(false);
  const [openingPicker, setOpeningPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenPicker = async () => {
    setError(null);
    setOpeningPicker(true);
    try {
      const result = await openGoogleDrivePicker();
      if (result) {
        if (result.sizeBytes && result.sizeBytes > 500 * 1024 * 1024) {
          setError(t('media.drive.exceedsSizeLimit'));
          setSelectedFile(null);
          return;
        }
        setSelectedFile(result);
        setCustomFileName(stripFileExtension(result.name));
      }
    } catch (err: unknown) {
      console.error('Error opening Google Drive Picker:', err);
      setError(err instanceof Error ? err.message : t('media.drive.loadFailed'));
    } finally {
      setOpeningPicker(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSubtitleFile(file);
    const reader = new FileReader();
    reader.onload = (loadEvent) => setSubtitleContent((loadEvent.target?.result as string) || '');
    reader.readAsText(file);
  };

  const isSubmitDisabled = submitting || !selectedFile || (includeSubtitle && (!subtitleFile || !subtitleContent));

  const handleConfirm = async () => {
    setError(null);
    if (!selectedFile) {
      setError(t('media.drive.invalidLink'));
      return;
    }
    if (selectedFile.sizeBytes && selectedFile.sizeBytes > 500 * 1024 * 1024) {
      setError(t('media.drive.exceedsSizeLimit'));
      return;
    }
    if (includeSubtitle && (!subtitleFile || !subtitleContent)) {
      setError(t('media.drive.subtitleRequired'));
      return;
    }
    const rawCleanName = customFileName.trim() || stripFileExtension(selectedFile.name) || `Drive_Media_${selectedFile.id.substring(0, 8)}`;
    setSubmitting(true);
    try {
      await onSelectDriveFile(
        selectedFile.id,
        rawCleanName,
        selectedFile.mimeType || 'video/mp4',
        0,
        includeSubtitle && subtitleContent ? { content: subtitleContent, language: subtitleLang } : undefined
      );
      onClose();
      // Reset state after successful upload so modal is fresh next time
      setSelectedFile(null);
      setCustomFileName('');
      setIncludeSubtitle(false);
      setSubtitleFile(null);
      setSubtitleContent('');
      setSubtitleLang('vi');
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('media.drive.loadFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={t('media.drive.title')} subtitle={t('media.drive.subtitle')} icon={<HardDrive className="size-4" />}>
      <div className="w-full space-y-6">
        {error && (
          <div role="alert" className="ui-status-error p-3.5 text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <button
            type="button"
            onClick={handleOpenPicker}
            disabled={openingPicker}
            className="w-full p-6 rounded-2xl bg-[var(--ui-surface-subtle)] border border-[var(--ui-border)] text-center space-y-3 cursor-pointer"
          >
            <div className="size-12 rounded-2xl bg-[var(--ui-surface)] border border-[var(--ui-border)] p-2.5 mx-auto grid place-items-center shadow-xs text-[var(--ui-text)]">
              {openingPicker ? <Loader2 className="size-6 animate-spin text-[var(--ui-accent)]" /> : <FolderUp className="size-6" />}
            </div>
            <h3 className="text-sm font-bold">
              {selectedFile ? t('media.drive.reselectHeading') : t('media.drive.pickerHeading')}
            </h3>
          </button>
          <p className="text-[11px] ui-muted text-center pt-0.5">{t('media.drive.quotaHint')}</p>

          {selectedFile && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">{t('media.drive.fileName')}</label>
              <div className="p-3 rounded-xl bg-[var(--ui-surface-subtle)] border border-[var(--ui-border)] text-xs font-semibold text-[var(--ui-text)] truncate">
                {customFileName}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] ui-muted pt-0.5">
                <span>{t('media.drive.fileType')}: <strong className="font-semibold text-[var(--ui-text)]">{formatMimeTypeLabel(selectedFile.mimeType)}</strong></span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-[var(--ui-border)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-[var(--ui-accent)]" />
              <span className="text-xs font-semibold">{t('media.drive.hasSubtitle')}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeSubtitle}
                onChange={(event) => setIncludeSubtitle(event.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[var(--ui-border-strong)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--ui-accent)]" />
            </label>
          </div>

          {includeSubtitle && (
            <div className="p-4 rounded-2xl bg-[var(--ui-surface-subtle)] border border-[var(--ui-border)] space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold">{t('media.drive.subtitleFile')}</label>
                <input
                  type="file"
                  accept=".srt,.vtt"
                  onChange={handleFileChange}
                  className="block w-full text-xs ui-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-[var(--ui-border)] file:text-xs file:font-semibold file:bg-[var(--ui-surface)] file:text-[var(--ui-text)] cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold">{t('media.drive.sourceLanguage')}</label>
                <select
                  value={subtitleLang}
                  onChange={(event) => setSubtitleLang(event.target.value)}
                  className="ui-select text-xs cursor-pointer"
                >
                  {TARGET_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.nativeName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--ui-border)]">
          <button onClick={onClose} disabled={submitting} className="ui-button ui-button-secondary">
            {t('common.cancel')}
          </button>
          <button onClick={handleConfirm} disabled={isSubmitDisabled} className="ui-button ui-button-primary">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            <span>{submitting ? t('media.drive.uploadingAction') : t('media.drive.uploadAction')}</span>
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
