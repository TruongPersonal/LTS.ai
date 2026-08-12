/**
 * Formats a MIME type string into a human-readable display label.
 */
export function formatMimeTypeLabel(mimeType?: string): string {
  if (!mimeType) return 'Media';
  if (mimeType.includes('mp4')) return 'Video MP4';
  if (mimeType.includes('webm')) return 'Video WebM';
  if (mimeType.includes('quicktime') || mimeType.includes('mov')) return 'Video MOV';
  if (mimeType.includes('matroska') || mimeType.includes('mkv')) return 'Video MKV';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'Audio MP3';
  if (mimeType.includes('wav')) return 'Audio WAV';
  if (mimeType.includes('flac')) return 'Audio FLAC';
  if (mimeType.startsWith('video/')) return `Video (${mimeType.split('/')[1].toUpperCase()})`;
  if (mimeType.startsWith('audio/')) return `Audio (${mimeType.split('/')[1].toUpperCase()})`;
  return mimeType;
}
