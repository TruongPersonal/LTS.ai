import type { SubtitleItem } from '../types/database';
import { normalizeLanguageCode } from '../types/project';

export interface TranscriptionChunkResult {
  sourceLanguage: string;
  subtitles: SubtitleItem[];
}

export interface MergedTranscription {
  sourceLanguage: string;
  subtitles: SubtitleItem[];
}

export function mergeTranscriptionChunks(
  chunks: TranscriptionChunkResult[]
): MergedTranscription {
  const rawLanguage = chunks.find((chunk) => chunk.sourceLanguage.trim())?.sourceLanguage.trim();
  const sourceLanguage = rawLanguage ? normalizeLanguageCode(rawLanguage) : '';
  const merged = chunks.flatMap((chunk) => chunk.subtitles);

  if (!sourceLanguage || merged.length === 0) {
    throw new Error('No subtitle cues were returned by transcription.');
  }

  const subtitles = merged
    .filter(
      (cue) =>
        Number.isFinite(cue.start) &&
        Number.isFinite(cue.end) &&
        cue.start >= 0 &&
        cue.end >= cue.start &&
        cue.text.trim().length > 0
    )
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((cue, index) => ({
      id: index + 1,
      start: cue.start,
      end: cue.end,
      text: cue.text.trim(),
    }));

  if (subtitles.length === 0) {
    throw new Error('No subtitle cues were returned by transcription.');
  }

  return { sourceLanguage, subtitles };
}

export function getTranscriptionProgressPercent(chunkIndex: number, chunkCount: number): number {
  if (!Number.isFinite(chunkIndex) || !Number.isFinite(chunkCount) || chunkCount <= 0) return 55;
  if (chunkCount === 1) return 82;
  const safeIndex = Math.min(Math.max(Math.trunc(chunkIndex), 0), Math.trunc(chunkCount) - 1);
  return Math.round(56 + (26 * safeIndex) / (Math.trunc(chunkCount) - 1));
}
