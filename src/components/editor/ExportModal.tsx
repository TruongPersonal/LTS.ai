import React, { useState } from 'react';
import { Archive, Download, FileCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SubtitleExportFormat } from '../../utils/exporter';
import { ModalWrapper } from '../common/ModalWrapper';

interface ExportModalProps { isOpen: boolean; onClose: () => void; title: string; isProjectZip?: boolean; onConfirmExport: (format: SubtitleExportFormat) => void; }

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, title, isProjectZip = false, onConfirmExport }) => {
  const { t } = useTranslation();
  const [selectedFormat, setSelectedFormat] = useState<SubtitleExportFormat>('srt');
  if (!isOpen) return null;
  const formats = [
    { id: 'srt', label: 'SRT', desc: t('export.srtDescription') },
    { id: 'vtt', label: 'VTT', desc: t('export.vttDescription') },
    { id: 'txt', label: 'TXT', desc: t('export.txtDescription') },
  ];
  const handleExport = () => { onConfirmExport(selectedFormat); onClose(); };
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={t(isProjectZip ? 'export.projectTitle' : 'export.fileTitle')} subtitle={title} icon={isProjectZip ? <Archive className="size-5" /> : <Download className="size-5" />} maxWidth="md">
      <div className="space-y-4"><p className="text-xs font-semibold">{t('export.chooseFormat')}</p><div className="space-y-2">{formats.map((format) => { const selected = selectedFormat === format.id; return <button data-autofocus={format.id === 'srt' ? true : undefined} key={format.id} type="button" onClick={() => setSelectedFormat(format.id as SubtitleExportFormat)} className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${selected ? 'bg-[var(--ui-accent-soft)] border-[var(--ui-accent)]' : 'bg-[var(--ui-surface-subtle)] border-[var(--ui-border)] hover:border-[var(--ui-border-strong)]'}`}><FileCode className={`size-5 mt-0.5 ${selected ? 'text-[var(--ui-accent)]' : 'ui-soft'}`} /><div><h4 className="text-xs font-bold">{format.label}</h4><p className="text-[11px] ui-muted mt-0.5">{format.desc}</p></div></button>; })}</div><div className="flex justify-end gap-2 pt-4 border-t border-[var(--ui-border)]"><button type="button" onClick={onClose} className="ui-button ui-button-secondary">{t('common.cancel')}</button><button type="button" onClick={handleExport} className="ui-button ui-button-primary"><Download className="size-4" />{t('export.download')}</button></div></div>
    </ModalWrapper>
  );
};
