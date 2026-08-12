/**
 * Formats seconds into a human-readable string (e.g. 83.4 -> "01:23")
 */
export const formatDisplayTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Formats seconds into SRT timestamp format: HH:MM:SS,mmm (e.g. 83.45 -> "00:01:23,450")
 */
export const formatSrtTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis
    .toString()
    .padStart(3, '0')}`;
};

/**
 * Formats seconds into VTT timestamp format: HH:MM:SS.mmm (e.g. 83.45 -> "00:01:23.450")
 */
export const formatVttTimestamp = (seconds: number): string => {
  return formatSrtTimestamp(seconds).replace(',', '.');
};

/**
 * Parses timestamp string (e.g. "00:01:23,450" or "01:23.450") into total seconds number
 */
export const parseTimestampToSeconds = (timestampStr: string): number => {
  if (!timestampStr) return 0;
  const normalized = timestampStr.trim().replace(',', '.');
  const parts = normalized.split(':');
  
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const mins = parseFloat(parts[1]);
    const secs = parseFloat(parts[2]);
    return hours * 3600 + mins * 60 + secs;
  } else if (parts.length === 2) {
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    return mins * 60 + secs;
  }
  return parseFloat(normalized) || 0;
};
