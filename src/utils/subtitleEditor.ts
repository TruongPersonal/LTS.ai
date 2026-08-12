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
  afterId: number
): SubtitleItem[] => {
  const index = items.findIndex((item) => item.id === afterId);
  if (index < 0) return items;

  const previous = items[index];
  const next = items[index + 1];
  const start = previous.end;
  const end = next && next.start > start ? next.start : start + 2;
  const nextId = items.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
  const inserted: SubtitleItem = { id: nextId, start, end, text: '' };

  return [...items.slice(0, index + 1), inserted, ...items.slice(index + 1)];
};

export const removeCue = (
  items: SubtitleItem[],
  id: number
): SubtitleItem[] => items.filter((item) => item.id !== id);

export const getSourceTextById = (
  sourceItems: SubtitleItem[],
  id: number
): string => sourceItems.find((item) => item.id === id)?.text ?? '';
