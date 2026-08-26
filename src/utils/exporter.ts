import type { SubtitleItem } from '../types/database';
import { exportToSrt, exportToVtt, exportToTxt } from './subtitleParsers';

export type SubtitleExportFormat = 'srt' | 'vtt' | 'txt';
export type SubtitleExportTrack = 'target' | 'source' | 'bilingual';


export interface FileSubtitleExportPackage {
  fileName: string;
  subtitles: SubtitleItem[];
  sourceSubtitles?: SubtitleItem[];
}

/**
 * Single subtitle file export
 */
export const downloadSubtitleFile = async (
  targetSubtitles: SubtitleItem[],
  sourceSubtitles: SubtitleItem[] = [],
  fileName: string,
  format: SubtitleExportFormat,
  track: SubtitleExportTrack = 'target'
) => {
  // Lazily load file-saver so it stays out of the route chunks until an export happens.
  const { saveAs } = await import('file-saver');
  const cleanFileName = fileName;

  const getContent = (items: SubtitleItem[]) => {
    let content = '';
    let mimeType = 'text/plain;charset=utf-8';
    if (format === 'srt') {
      content = exportToSrt(items);
      mimeType = 'application/x-subrip;charset=utf-8';
    } else if (format === 'vtt') {
      content = exportToVtt(items);
      mimeType = 'text/vtt;charset=utf-8';
    } else {
      content = exportToTxt(items);
    }
    return { content, mimeType };
  };

  const exportBlob = (items: SubtitleItem[], suffix: string) => {
    const { content, mimeType } = getContent(items);
    const blob = new Blob([content], { type: mimeType });
    const outputName = suffix ? `${cleanFileName}_${suffix}.${format}` : `${cleanFileName}.${format}`;
    saveAs(blob, outputName);
  };

  const effectiveSource = (sourceSubtitles && sourceSubtitles.length > 0) ? sourceSubtitles : targetSubtitles;

  if (track === 'source') {
    exportBlob(effectiveSource, 'original');
  } else if (track === 'bilingual') {
    // Export BOTH files (both translated file and original file)
    exportBlob(targetSubtitles, 'translation');
    window.setTimeout(() => {
      exportBlob(effectiveSource, 'original');
    }, 250);
  } else {
    // track === 'target'
    exportBlob(targetSubtitles, '');
  }
};

/**
 * Batch export whole project as a ZIP package containing all subtitle files
 */
export const downloadProjectZip = async (
  projectTitle: string,
  items: FileSubtitleExportPackage[],
  format: SubtitleExportFormat,
  track: SubtitleExportTrack = 'target'
) => {
  // Lazily load jszip + file-saver so they stay out of the route chunks until an export happens.
  const [{ default: JSZip }, { saveAs }] = await Promise.all([
    import('jszip'),
    import('file-saver'),
  ]);
  const zip = new JSZip();
  const folder = zip.folder(projectTitle || 'subtitles');

  const getContent = (items: SubtitleItem[]) => {
    if (format === 'srt') return exportToSrt(items);
    if (format === 'vtt') return exportToVtt(items);
    return exportToTxt(items);
  };

  items.forEach((item) => {
    const cleanFileName = item.fileName;
    const effectiveSource = (item.sourceSubtitles && item.sourceSubtitles.length > 0) ? item.sourceSubtitles : item.subtitles;

    if (track === 'source') {
      folder?.file(`${cleanFileName}_original.${format}`, getContent(effectiveSource));
    } else if (track === 'bilingual') {
      folder?.file(`${cleanFileName}_translation.${format}`, getContent(item.subtitles));
      folder?.file(`${cleanFileName}_original.${format}`, getContent(effectiveSource));
    } else {
      folder?.file(`${cleanFileName}.${format}`, getContent(item.subtitles));
    }
  });

  const contentBlob = await zip.generateAsync({ type: 'blob' });
  const cleanTitle = projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  saveAs(contentBlob, `${cleanTitle}_subtitles_${format}.zip`);
};
