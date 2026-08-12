import React, { useState } from 'react';
import { Archive, Download, FileCode, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SubtitleExportFormat, SubtitleExportTrack } from '../../utils/exporter';
import { ModalWrapper } from '../common/ModalWrapper';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  isProjectZip?: boolean;
  onConfirmExport: (format: SubtitleExportFormat, track?: SubtitleExportTrack) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  title,
  isProjectZip = false,
  onConfirmExport,
}) => {
  const { t } = useTranslation();
  const [selectedFormat, setSelectedFormat] = useState<SubtitleExportFormat>('srt');
  const [selectedTrack, setSelectedTrack] = useState<SubtitleExportTrack>('target');

  if (!isOpen) return null;

  const tracks = [
    { id: 'target', label: t('export.trackTarget'), desc: t('export.trackTargetDesc') },
    { id: 'source', label: t('export.trackSource'), desc: t('export.trackSourceDesc') },
    { id: 'bilingual', label: t('export.trackBilingual'), desc: t('export.trackBilingualDesc') },
  ];

  const formats = [
    { id: 'srt', label: 'SRT', desc: t('export.srtDescription') },
    { id: 'vtt', label: 'VTT', desc: t('export.vttDescription') },
    { id: 'txt', label: 'TXT', desc: t('export.txtDescription') },
  ];

  const handleExport = () => {
    onConfirmExport(selectedFormat, selectedTrack);
    onClose();
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={t(isProjectZip ? 'export.projectTitle' : 'export.fileTitle')}
      subtitle={title}
      icon={isProjectZip ? <Archive className="size-5" /> : <Download className="size-5" />}
      maxWidth="md"
    >
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold mb-2.5 flex items-center gap-1.5">
            <Layers className="size-3.5 text-[var(--ui-accent)]" />
            <span>{t('export.chooseTrack')}</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {tracks.map((tr) => {
              const selected = selectedTrack === tr.id;
              return (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => setSelectedTrack(tr.id as SubtitleExportTrack)}
                  className={`text-left p-3 rounded-xl border transition-colors ${
                    selected
                      ? 'bg-[var(--ui-accent-soft)] border-[var(--ui-accent)] font-medium'
                      : 'bg-[var(--ui-surface-subtle)] border-[var(--ui-border)] hover:border-[var(--ui-border-strong)]'
                  }`}
                >
                  <h4 className="text-xs font-bold">{tr.label}</h4>
                  <p className="text-[10px] ui-muted mt-0.5 leading-tight">{tr.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold mb-2.5">{t('export.chooseFormat')}</p>
          <div className="space-y-2">
            {formats.map((format) => {
              const selected = selectedFormat === format.id;
              return (
                <button
                  data-autofocus={format.id === 'srt' ? true : undefined}
                  key={format.id}
                  type="button"
                  onClick={() => setSelectedFormat(format.id as SubtitleExportFormat)}
                  className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${
                    selected
                      ? 'bg-[var(--ui-accent-soft)] border-[var(--ui-accent)]'
                      : 'bg-[var(--ui-surface-subtle)] border-[var(--ui-border)] hover:border-[var(--ui-border-strong)]'
                  }`}
                >
                  <FileCode className={`size-5 mt-0.5 ${selected ? 'text-[var(--ui-accent)]' : 'ui-soft'}`} />
                  <div>
                    <h4 className="text-xs font-bold">{format.label}</h4>
                    <p className="text-[11px] ui-muted mt-0.5">{format.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-[var(--ui-border)]">
          <button type="button" onClick={onClose} className="ui-button ui-button-secondary">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleExport} className="ui-button ui-button-primary">
            <Download className="size-4" />
            {t('export.download')}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
