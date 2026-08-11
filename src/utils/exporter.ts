import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import type { SubtitleItem } from '../types/database';
import { exportToSrt, exportToVtt, exportToTxt } from './subtitleParsers';

export type SubtitleExportFormat = 'srt' | 'vtt' | 'txt';

/**
 * Single subtitle file export
 */
export const downloadSubtitleFile = (
  subtitles: SubtitleItem[],
  fileName: string,
  format: SubtitleExportFormat
) => {
  let content = '';
  let mimeType = 'text/plain;charset=utf-8';
  let extension = format;

  if (format === 'srt') {
    content = exportToSrt(subtitles);
    mimeType = 'application/x-subrip;charset=utf-8';
  } else if (format === 'vtt') {
    content = exportToVtt(subtitles);
    mimeType = 'text/vtt;charset=utf-8';
  } else {
    content = exportToTxt(subtitles);
  }

  const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
  const blob = new Blob([content], { type: mimeType });
  saveAs(blob, `${cleanFileName}.${extension}`);
};

export interface FileSubtitleExportPackage {
  fileName: string;
  subtitles: SubtitleItem[];
}

/**
 * Batch export whole project as a ZIP package containing all subtitle files
 */
export const downloadProjectZip = async (
  projectTitle: string,
  items: FileSubtitleExportPackage[],
  format: SubtitleExportFormat
) => {
  const zip = new JSZip();
  const folder = zip.folder(projectTitle || 'subtitles');

  items.forEach((item) => {
    let content = '';
    if (format === 'srt') {
      content = exportToSrt(item.subtitles);
    } else if (format === 'vtt') {
      content = exportToVtt(item.subtitles);
    } else {
      content = exportToTxt(item.subtitles);
    }
    const cleanFileName = item.fileName.replace(/\.[^/.]+$/, '');
    folder?.file(`${cleanFileName}.${format}`, content);
  });

  const contentBlob = await zip.generateAsync({ type: 'blob' });
  const cleanTitle = projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  saveAs(contentBlob, `${cleanTitle}_subtitles_${format}.zip`);
};
