import type { SubtitleItem } from '../types/database';

export const findActiveCueId = (
  items: SubtitleItem[],
  currentTime: number
): number | null => {
  const active = items.find(
    (item) => currentTime >= item.start && currentTime < item.end
  );
  return active?.id ?? null;
};

export const insertCueAfter = (
  items: SubtitleItem[],
  afterId?: number
): SubtitleItem[] => {
  if (items.length === 0) {
    return [{ id: 1, start: 0, end: 2, text: '' }];
  }

  const index = afterId !== undefined ? items.findIndex((item) => item.id === afterId) : items.length - 1;
  const targetIndex = index >= 0 ? index : items.length - 1;

  const previous = items[targetIndex];
  const next = items[targetIndex + 1];
  const start = previous.end;
  const end = next && next.start > start ? next.start : start + 2;
  const nextId = items.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
  const inserted: SubtitleItem = { id: nextId, start, end, text: '' };

  return [...items.slice(0, targetIndex + 1), inserted, ...items.slice(targetIndex + 1)];
};

export const removeCue = (
  items: SubtitleItem[],
  id: number
): SubtitleItem[] => items.filter((item) => item.id !== id);

export const getSourceTextById = (
  sourceItems: SubtitleItem[],
  id: number
): string => sourceItems.find((item) => item.id === id)?.text ?? '';
