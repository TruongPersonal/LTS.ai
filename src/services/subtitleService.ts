import { supabase } from '../lib/supabase';
import type { SubtitleItem, SubtitleRecord } from '../types/database';
import { normalizeLanguageCode } from '../types/project';

interface SubtitlePair {
  source: SubtitleRecord | null;
  target: SubtitleRecord | null;
}

export const subtitleService = {
  async getSubtitleByFile(fileId: string, language?: string): Promise<SubtitleRecord | null> {
    if (language) {
      const normalized = normalizeLanguageCode(language);
      const { data, error } = await supabase
        .from('subtitles')
        .select('*')
        .eq('file_id', fileId);

      if (error) throw error;
      const records = (data || []) as SubtitleRecord[];
      return records.find((r) => normalizeLanguageCode(r.language) === normalized) || null;
    }

    const { data, error } = await supabase
      .from('subtitles')
      .select('*')
      .eq('file_id', fileId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getSubtitlePair(
    fileId: string,
    sourceLanguage: string | null,
    targetLanguage: string
  ): Promise<SubtitlePair> {
    const { data, error } = await supabase
      .from('subtitles')
      .select('*')
      .eq('file_id', fileId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const records = (data || []) as SubtitleRecord[];
    const normalizedTarget = normalizeLanguageCode(targetLanguage);
    const normalizedSource = sourceLanguage ? normalizeLanguageCode(sourceLanguage) : null;

    const target = records.find((r) => normalizeLanguageCode(r.language) === normalizedTarget) ?? null;
    const source = (
      normalizedSource
        ? records.find((r) => normalizeLanguageCode(r.language) === normalizedSource)
        : undefined
    ) ?? records.find((r) => normalizeLanguageCode(r.language) !== normalizedTarget) ?? target;

    return { source, target };
  },

  async saveSubtitles(fileId: string, language: string, content: SubtitleItem[]): Promise<void> {
    const sanitizedContent = content.map((item, idx) => ({
      id: typeof item.id === 'number' ? item.id : idx + 1,
      start: Number.isFinite(Number(item.start)) ? Math.max(0, Number(item.start)) : 0,
      end: Number.isFinite(Number(item.end)) ? Math.max(0, Number(item.end)) : 0,
      text: typeof item.text === 'string' ? item.text : String(item.text || ''),
    }));

    const { error } = await supabase
      .from('subtitles')
      .upsert(
        {
          file_id: fileId,
          language,
          content: sanitizedContent as unknown as Record<string, unknown>[],
          is_edited: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'file_id,language' }
      );

    if (error) throw error;
  },
};
