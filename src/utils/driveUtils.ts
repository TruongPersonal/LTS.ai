/**
 * Extracts a Google Drive File ID from a URL or raw ID string.
 * Supports /file/d/{id}, ?id={id}, or direct 25-50 char IDs.
 */
export const extractDriveFileId = (input: string): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD) return matchFileD[1];
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam) return matchIdParam[1];
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) return trimmed;
  return null;
};
