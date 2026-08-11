import type { SubtitleItem } from '../types/database';
import { formatSrtTimestamp, formatVttTimestamp, parseTimestampToSeconds } from './time';

/**
 * Converts SubtitleItem[] array to standard .srt formatted text
 */
export const exportToSrt = (subtitles: SubtitleItem[]): string => {
  return subtitles
    .map((item, index) => {
      const seq = index + 1;
      const startStr = formatSrtTimestamp(item.start);
      const endStr = formatSrtTimestamp(item.end);
      return `${seq}\n${startStr} --> ${endStr}\n${item.text.trim()}\n`;
    })
    .join('\n');
};

/**
 * Converts SubtitleItem[] array to WebVTT (.vtt) formatted text
 */
export const exportToVtt = (subtitles: SubtitleItem[]): string => {
  const header = 'WEBVTT\n\n';
  const body = subtitles
    .map((item, index) => {
      const seq = index + 1;
      const startStr = formatVttTimestamp(item.start);
      const endStr = formatVttTimestamp(item.end);
      return `${seq}\n${startStr} --> ${endStr}\n${item.text.trim()}\n`;
    })
    .join('\n');
  return header + body;
};

/**
 * Converts SubtitleItem[] array to plain text (.txt) format
 */
export const exportToTxt = (subtitles: SubtitleItem[]): string => {
  return subtitles.map((item) => item.text.trim()).join('\n');
};

/**
 * Parses raw .srt or .vtt file string content into SubtitleItem[]
 */
export const parseSubtitleFile = (content: string): SubtitleItem[] => {
  if (!content) return [];
  const cleanContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = cleanContent.split(/\n\s*\n/);
  const items: SubtitleItem[] = [];
  let currentId = 1;

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;

    const [startStr, endStr] = timeLine.split('-->');
    const start = parseTimestampToSeconds(startStr);
    const end = parseTimestampToSeconds(endStr);

    const textLines = lines.filter(
      (l) => !l.includes('-->') && !/^\d+$/.test(l) && l !== 'WEBVTT'
    );

    const text = textLines.join(' ');
    if (text) {
      items.push({
        id: currentId++,
        start,
        end,
        text,
      });
    }
  }

  return items;
};
