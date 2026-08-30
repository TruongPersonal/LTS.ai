import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubtitleItem } from '../types/database';
import { exportVideoWithSubtitles, VideoSubtitleExportError } from '../services/videoSubtitleExporter';

import type { VideoExportStatus } from '../components/editor/VideoExportModal';

interface UseVideoExportParams {
  fileName: string;
  loadVideoBlob: () => Promise<Blob | null>;
}

export const useVideoExport = ({ fileName, loadVideoBlob }: UseVideoExportParams) => {
  const { t } = useTranslation();
  const [videoExportOpen, setVideoExportOpen] = useState(false);
  const [videoExportStatus, setVideoExportStatus] = useState<VideoExportStatus>('idle');
  const [videoExportProgress, setVideoExportProgress] = useState(0);
  const [videoExportError, setVideoExportError] = useState<string | null>(null);

  const videoExportBusy =
    videoExportStatus === 'preparing' ||
    videoExportStatus === 'exporting';

  const resetVideoExportModal = useCallback(() => {
    setVideoExportOpen(false);
    setVideoExportStatus('idle');
    setVideoExportProgress(0);
    setVideoExportError(null);
  }, []);

  const handleOpenVideoExport = useCallback(() => {
    if (videoExportOpen) return;
    setVideoExportOpen(true);
    setVideoExportStatus('confirm');
    setVideoExportProgress(0);
    setVideoExportError(null);
  }, [videoExportOpen]);

  const handleConfirmVideoExport = useCallback(async (
    exportSubtitles: SubtitleItem[],
  ) => {
    if (videoExportStatus !== 'confirm') return;

    try {
      setVideoExportProgress(0);
      setVideoExportStatus('preparing');
      let exportBlob: Blob | null;
      try {
        exportBlob = await loadVideoBlob();
      } catch (error) {
        throw new VideoSubtitleExportError(
          'load',
          error instanceof Error ? error.message : 'Unable to download source video.'
        );
      }
      if (!exportBlob) {
        throw new VideoSubtitleExportError('load', 'Source video is unavailable.');
      }
      setVideoExportStatus('exporting');

      const output = await exportVideoWithSubtitles({
        videoBlob: exportBlob,
        subtitles: exportSubtitles,
        fileName,
        onProgress: setVideoExportProgress,
      });

      const baseName = fileName.replace(/\.[^/.]+$/, '') || fileName;
      const { saveAs } = await import('file-saver');
      saveAs(output, baseName + '_subtitled.mp4');
      setVideoExportProgress(1);
      setVideoExportStatus('completed');
    } catch (error) {
      const message =
        error instanceof VideoSubtitleExportError && (error.reason === 'av1' || error.kind === 'unsupported')
          ? t('editor.videoExport.unsupportedError', 'Định dạng video này chưa được hỗ trợ xuất phụ đề.')
          : t('editor.videoExport.exportError', 'Không thể xuất video. Vui lòng thử lại.');
      setVideoExportError(message);
      setVideoExportStatus('error');
    }
  }, [videoExportStatus, loadVideoBlob, fileName, t]);

  const handleCloseVideoExport = useCallback(() => {
    if (videoExportBusy) return;
    resetVideoExportModal();
  }, [videoExportBusy, resetVideoExportModal]);

  return {
    videoExportOpen,
    videoExportStatus,
    videoExportProgress,
    videoExportError,
    videoExportBusy,
    handleOpenVideoExport,
    handleConfirmVideoExport,
    handleCloseVideoExport,
  };
};
